"""Security controls for the GitHub Pages to local API demo bridge."""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable
from urllib.parse import parse_qs, urlparse
from uuid import UUID, uuid5


DEFAULT_ALLOWED_ORIGIN = "https://pillb.github.io"
DEFAULT_ACCOUNTS_PATH = "local-demo-accounts.txt"
DEMO_ID_NAMESPACE = UUID("370ec18d-1209-5e7e-b9e9-2cf17a5721e4")


@dataclass(frozen=True)
class DemoAccount:
    username: str
    password: str
    actor_id: str
    purpose: str = "training"
    allowed_fields: tuple[str, ...] = ("device_signature", "precise_location")


@dataclass(frozen=True)
class DemoSecurityConfig:
    auth_required: bool
    token_secret: str
    accounts_path: Path
    allowed_origins: tuple[str, ...]
    token_ttl_seconds: int
    postgres_dsn: str | None
    require_postgres_tls: bool
    workbench_source: str

    @classmethod
    def from_env(cls) -> "DemoSecurityConfig":
        allowed = tuple(
            origin.strip().rstrip("/")
            for origin in os.environ.get(
                "NAPP_DEMO_ALLOWED_ORIGINS",
                DEFAULT_ALLOWED_ORIGIN,
            ).split(",")
            if origin.strip()
        )
        return cls(
            auth_required=os.environ.get("NAPP_DEMO_AUTH_REQUIRED", "0") == "1",
            token_secret=os.environ.get("NAPP_DEMO_TOKEN_SECRET", ""),
            accounts_path=Path(
                os.environ.get("NAPP_DEMO_ACCOUNTS_FILE", DEFAULT_ACCOUNTS_PATH)
            ),
            allowed_origins=allowed,
            token_ttl_seconds=int(os.environ.get("NAPP_DEMO_TOKEN_TTL_SECONDS", "3600")),
            postgres_dsn=os.environ.get("NAPP_POSTGRES_DSN"),
            require_postgres_tls=os.environ.get("NAPP_DEMO_REQUIRE_POSTGRES_TLS", "1") != "0",
            workbench_source=os.environ.get("NAPP_DEMO_WORKBENCH_SOURCE", "synthetic").strip().lower(),
        )


def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def _b64url_decode(value: str) -> bytes:
    padding = "=" * (-len(value) % 4)
    return base64.urlsafe_b64decode(f"{value}{padding}".encode("ascii"))


def _effective_secret(config: DemoSecurityConfig) -> str:
    if config.token_secret:
        return config.token_secret
    if config.auth_required:
        raise ValueError("NAPP_DEMO_TOKEN_SECRET is required when demo auth is enabled")
    return "static-training-disabled-demo-secret"


def load_demo_accounts(path: Path) -> dict[str, DemoAccount]:
    accounts: dict[str, DemoAccount] = {}
    if not path.exists():
        return accounts
    for line_number, raw in enumerate(path.read_text("utf8").splitlines(), start=1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        parts = [part.strip() for part in line.split(":")]
        if len(parts) < 3:
            raise ValueError(f"Invalid demo account line {line_number}: expected username:password:actor_id")
        username, password, actor_id = parts[:3]
        purpose = parts[3] if len(parts) >= 4 and parts[3] else "training"
        fields = tuple(
            field.strip()
            for field in (parts[4] if len(parts) >= 5 else "device_signature,precise_location").split(",")
            if field.strip()
        )
        accounts[username] = DemoAccount(
            username=username,
            password=password,
            actor_id=actor_id,
            purpose=purpose,
            allowed_fields=fields or ("device_signature", "precise_location"),
        )
    return accounts


def origin_allowed(origin: str | None, config: DemoSecurityConfig) -> bool:
    if not origin:
        return True
    clean = origin.rstrip("/")
    return clean in config.allowed_origins


def issue_demo_token(account: DemoAccount, config: DemoSecurityConfig, now: int | None = None) -> str:
    issued_at = int(now if now is not None else time.time())
    payload = {
        "sub": account.username,
        "actor_id": account.actor_id,
        "purpose": account.purpose,
        "allowed_fields": list(account.allowed_fields),
        "iat": issued_at,
        "exp": issued_at + config.token_ttl_seconds,
        "jti": secrets.token_urlsafe(12),
    }
    body = _b64url_encode(json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf8"))
    signature = hmac.new(_effective_secret(config).encode("utf8"), body.encode("ascii"), hashlib.sha256).digest()
    return f"demo.{body}.{_b64url_encode(signature)}"


def verify_demo_token(token: str, config: DemoSecurityConfig, now: int | None = None) -> dict[str, Any]:
    try:
        prefix, body, signature = token.split(".", 2)
    except ValueError as exc:
        raise ValueError("Malformed demo token") from exc
    if prefix != "demo":
        raise ValueError("Unsupported demo token")
    expected = hmac.new(_effective_secret(config).encode("utf8"), body.encode("ascii"), hashlib.sha256).digest()
    if not hmac.compare_digest(_b64url_encode(expected), signature):
        raise ValueError("Invalid demo token signature")
    payload = json.loads(_b64url_decode(body))
    if int(payload.get("exp", 0)) <= int(now if now is not None else time.time()):
        raise ValueError("Expired demo token")
    return payload


def authenticate_demo_account(username: str, password: str, config: DemoSecurityConfig) -> DemoAccount:
    accounts = load_demo_accounts(config.accounts_path)
    account = accounts.get(username)
    if account is None or not hmac.compare_digest(account.password, password):
        raise ValueError("Invalid demo credentials")
    return account


def demo_context_uuid(kind: str, value: str) -> UUID:
    clean_kind = kind.strip()
    clean_value = value.strip()
    if clean_kind not in {"actor", "purpose"}:
        raise ValueError("demo context kind must be actor or purpose")
    if not clean_value:
        raise ValueError("demo context value must be non-empty")
    return uuid5(DEMO_ID_NAMESPACE, f"{clean_kind}:{clean_value}")


def validate_postgres_transport_security(dsn: str | None, *, required: bool = True) -> dict[str, Any]:
    if not dsn:
        return {
            "contract": "PostgresTransportSecurityCheckV1",
            "passed": not required,
            "mode": "not-configured",
            "failures": ["NAPP_POSTGRES_DSN is not configured"] if required else [],
        }
    parsed = urlparse(dsn)
    query = {key: values[-1] for key, values in parse_qs(parsed.query).items()}
    sslmode = query.get("sslmode", "")
    sslrootcert = query.get("sslrootcert", "")
    failures = []
    if parsed.scheme not in {"postgresql", "postgres"}:
        failures.append("DSN must use postgresql:// or postgres://")
    if sslmode != "verify-full":
        failures.append("sslmode=verify-full is required to prevent MITM")
    if not sslrootcert:
        failures.append("sslrootcert is required for server certificate validation")
    if parsed.hostname in {"", None}:
        failures.append("TCP host is required for hostname verification")
    return {
        "contract": "PostgresTransportSecurityCheckV1",
        "passed": not failures,
        "mode": sslmode or "unset",
        "host": parsed.hostname,
        "sslrootcertConfigured": bool(sslrootcert),
        "failures": failures,
    }


def demo_security_status(config: DemoSecurityConfig) -> dict[str, Any]:
    postgres_tls = validate_postgres_transport_security(
        config.postgres_dsn,
        required=config.require_postgres_tls,
    )
    failures = [
        config.auth_required and not config.token_secret and "NAPP_DEMO_TOKEN_SECRET is required",
        config.auth_required and not config.accounts_path.exists() and "demo accounts file is missing",
        not config.allowed_origins and "at least one allowed origin is required",
        config.workbench_source not in {"synthetic", "postgres"} and "NAPP_DEMO_WORKBENCH_SOURCE must be synthetic or postgres",
        config.require_postgres_tls and not postgres_tls["passed"] and "PostgreSQL TLS validation failed",
    ]
    return {
        "contract": "HybridDemoSecurityStatusV1",
        "authRequired": config.auth_required,
        "allowedOrigins": list(config.allowed_origins),
        "accountsFileConfigured": config.accounts_path.exists(),
        "tokenTtlSeconds": config.token_ttl_seconds,
        "workbenchSource": config.workbench_source,
        "postgresTls": postgres_tls,
        "rlsBoundary": "transaction-local SET LOCAL app.actor_id/app.purpose_id/app.authorized_case_ids",
        "browserToDatabase": "prohibited",
        "failures": [failure for failure in failures if failure],
        "passed": not [failure for failure in failures if failure],
    }


def postgres_runtime_security_probe(
    config: DemoSecurityConfig,
    *,
    connect: Callable[..., Any] | None = None,
) -> dict[str, Any]:
    """Check the live local PostgreSQL security posture without returning data."""

    transport = validate_postgres_transport_security(
        config.postgres_dsn,
        required=config.require_postgres_tls,
    )
    if not transport["passed"]:
        return {
            "contract": "HybridDemoPostgresRuntimeProbeV1",
            "passed": False,
            "transport": transport,
            "failures": transport["failures"],
        }
    if not config.postgres_dsn:
        return {
            "contract": "HybridDemoPostgresRuntimeProbeV1",
            "passed": False,
            "transport": transport,
            "failures": ["NAPP_POSTGRES_DSN is not configured"],
        }
    if connect is None:
        try:
            import psycopg
        except ImportError as exc:  # pragma: no cover - deployment dependent
            return {
                "contract": "HybridDemoPostgresRuntimeProbeV1",
                "passed": False,
                "transport": transport,
                "failures": [f"psycopg is unavailable: {exc}"],
            }
        connect = psycopg.connect

    failures: list[str] = []
    details: dict[str, Any] = {}
    try:
        with connect(config.postgres_dsn, connect_timeout=5) as connection:
            with connection.cursor() as cursor:
                cursor.execute("SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()")
                ssl_row = cursor.fetchone()
                tls_active = bool(ssl_row and ssl_row[0])
                details["tlsActive"] = tls_active
                if not tls_active:
                    failures.append("PostgreSQL session is not using TLS")

                cursor.execute(
                    "SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user"
                )
                role_row = cursor.fetchone()
                role_super = bool(role_row and role_row[0])
                role_bypass_rls = bool(role_row and role_row[1])
                details["roleSuperuser"] = role_super
                details["roleBypassRls"] = role_bypass_rls
                if role_super:
                    failures.append("runtime role must not be a superuser")
                if role_bypass_rls:
                    failures.append("runtime role must not have BYPASSRLS")

                cursor.execute(
                    """
                    SELECT
                        count(*) AS table_count,
                        count(*) FILTER (WHERE relrowsecurity) AS rls_enabled,
                        count(*) FILTER (WHERE relforcerowsecurity) AS forced_rls
                    FROM pg_class AS cls
                    JOIN pg_namespace AS ns ON ns.oid = cls.relnamespace
                    WHERE ns.nspname = 'napp'
                      AND cls.relkind IN ('r', 'p')
                      AND cls.relname IN (
                        'cases',
                        'entities',
                        'sources',
                        'assertions',
                        'assertion_revisions',
                        'authorized_projections',
                        'authorized_projection_revisions',
                        'analysis_versions',
                        'communities',
                        'reports',
                        'audit_events'
                      )
                    """
                )
                rls_row = cursor.fetchone() or (0, 0, 0)
                table_count, rls_enabled, forced_rls = map(int, rls_row[:3])
                details["nappTableCount"] = table_count
                details["rlsEnabledTableCount"] = rls_enabled
                details["forcedRlsTableCount"] = forced_rls
                if table_count == 0:
                    failures.append("napp schema tables were not found")
                if table_count and rls_enabled != table_count:
                    failures.append("all NAPP case tables must have row-level security enabled")
                if table_count and forced_rls != table_count:
                    failures.append("all NAPP case tables must force row-level security")

                cursor.execute("SELECT set_config('app.actor_id', %s, true)", ("demo-actor",))
                cursor.execute("SELECT set_config('app.purpose_id', %s, true)", ("training",))
                cursor.execute(
                    "SELECT set_config('app.authorized_case_ids', %s, true)",
                    ("{harbor-lantern}",),
                )
                cursor.execute(
                    """
                    SELECT
                        current_setting('app.actor_id', true),
                        current_setting('app.purpose_id', true),
                        current_setting('app.authorized_case_ids', true)
                    """
                )
                setting_row = cursor.fetchone() or ("", "", "")
                details["transactionLocalContextSet"] = setting_row == (
                    "demo-actor",
                    "training",
                    "{harbor-lantern}",
                )
                if not details["transactionLocalContextSet"]:
                    failures.append("transaction-local RLS context settings were not applied")
            rollback = getattr(connection, "rollback", None)
            if callable(rollback):
                rollback()
    except Exception as exc:  # pragma: no cover - exact driver errors vary
        failures.append(f"live PostgreSQL probe failed: {exc}")

    return {
        "contract": "HybridDemoPostgresRuntimeProbeV1",
        "passed": not failures,
        "transport": transport,
        "details": details,
        "failures": failures,
    }
