from __future__ import annotations

import os
from types import SimpleNamespace
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

from apps.api.demo_security import (
    DemoSecurityConfig,
    demo_security_status,
    postgres_runtime_security_probe,
    validate_postgres_transport_security,
    verify_demo_token,
)
from apps.api.optional_api import create_app


class DemoSecurityTests(unittest.TestCase):
    def test_postgres_transport_requires_verify_full_and_root_cert(self) -> None:
        insecure = validate_postgres_transport_security(
            "postgresql://demo:secret@localhost:5432/napp?sslmode=require"
        )
        self.assertFalse(insecure["passed"])
        self.assertIn("sslmode=verify-full is required to prevent MITM", insecure["failures"])
        self.assertIn("sslrootcert is required for server certificate validation", insecure["failures"])

        secure = validate_postgres_transport_security(
            "postgresql://demo:secret@localhost:5432/napp?sslmode=verify-full&sslrootcert=/tmp/root.crt"
        )
        self.assertTrue(secure["passed"])
        self.assertEqual(secure["mode"], "verify-full")

    def test_demo_status_fails_closed_when_required_inputs_are_missing(self) -> None:
        config = DemoSecurityConfig(
            auth_required=True,
            token_secret="",
            accounts_path=Path("missing-demo-accounts.txt"),
            allowed_origins=("https://pillb.github.io",),
            token_ttl_seconds=3600,
            postgres_dsn=None,
            require_postgres_tls=True,
            workbench_source="postgres",
        )

        status = demo_security_status(config)
        self.assertFalse(status["passed"])
        self.assertIn("NAPP_DEMO_TOKEN_SECRET is required", status["failures"])
        self.assertIn("demo accounts file is missing", status["failures"])
        self.assertIn("PostgreSQL TLS validation failed", status["failures"])
        self.assertEqual(status["browserToDatabase"], "prohibited")
        self.assertEqual(status["workbenchSource"], "postgres")

    def test_live_postgres_probe_checks_tls_role_rls_and_local_context(self) -> None:
        class FakeCursor:
            def __init__(self) -> None:
                self.last_statement = ""

            def __enter__(self) -> "FakeCursor":
                return self

            def __exit__(self, *_args: object) -> None:
                return None

            def execute(self, statement: str, _parameters: object = None) -> None:
                self.last_statement = statement

            def fetchone(self) -> tuple[object, ...]:
                if "pg_stat_ssl" in self.last_statement:
                    return (True,)
                if "pg_roles" in self.last_statement:
                    return (False, False)
                if "pg_class" in self.last_statement:
                    return (11, 11, 11)
                if "current_setting" in self.last_statement:
                    return ("demo-actor", "training", "{harbor-lantern}")
                return ("ok",)

        class FakeConnection:
            def __init__(self) -> None:
                self.rollback_called = False

            def __enter__(self) -> "FakeConnection":
                return self

            def __exit__(self, *_args: object) -> None:
                return None

            def cursor(self) -> FakeCursor:
                return FakeCursor()

            def rollback(self) -> None:
                self.rollback_called = True

        connection = FakeConnection()
        config = DemoSecurityConfig(
            auth_required=True,
            token_secret="test-secret",
            accounts_path=Path("missing-demo-accounts.txt"),
            allowed_origins=("https://pillb.github.io",),
            token_ttl_seconds=3600,
            postgres_dsn=(
                "postgresql://demo:secret@db.example.test:5432/napp"
                "?sslmode=verify-full&sslrootcert=/tmp/root.crt"
            ),
            require_postgres_tls=True,
            workbench_source="postgres",
        )

        probe = postgres_runtime_security_probe(
            config,
            connect=lambda *_args, **_kwargs: connection,
        )

        self.assertTrue(probe["passed"])
        self.assertTrue(probe["details"]["tlsActive"])
        self.assertFalse(probe["details"]["roleBypassRls"])
        self.assertEqual(probe["details"]["forcedRlsTableCount"], 11)
        self.assertTrue(probe["details"]["transactionLocalContextSet"])
        self.assertTrue(connection.rollback_called)

    def test_demo_login_token_and_workbench_bridge_are_origin_bound(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            accounts = Path(tmpdir) / "accounts.txt"
            accounts.write_text(
                "analyst@example.test:demo-pass-1:demo-analyst:training:device_signature,precise_location\n",
                "utf8",
            )
            env = {
                "NAPP_DEMO_AUTH_REQUIRED": "1",
                "NAPP_DEMO_TOKEN_SECRET": "test-secret-at-least-local",
                "NAPP_DEMO_ACCOUNTS_FILE": str(accounts),
                "NAPP_DEMO_ALLOWED_ORIGINS": "https://pillb.github.io",
                "NAPP_POSTGRES_DSN": "postgresql://demo:secret@localhost:5432/napp?sslmode=verify-full&sslrootcert=/tmp/root.crt",
            }
            with patch.dict(os.environ, env, clear=False):
                client = TestClient(create_app())

                denied_origin = client.post(
                    "/v1/demo/login",
                    headers={"Origin": "https://attacker.example"},
                    json={"username": "analyst@example.test", "password": "demo-pass-1"},
                )
                self.assertEqual(denied_origin.status_code, 403)

                login = client.post(
                    "/v1/demo/login",
                    headers={"Origin": "https://pillb.github.io"},
                    json={"username": "analyst@example.test", "password": "demo-pass-1"},
                )
                self.assertEqual(login.status_code, 200)
                payload = login.json()
                self.assertEqual(payload["contract"], "HybridDemoLoginV1")
                token_payload = verify_demo_token(payload["token"], DemoSecurityConfig.from_env())
                self.assertEqual(token_payload["actor_id"], "demo-analyst")

                unauthorized = client.get(
                    "/v1/cases/harbor-lantern/workbench",
                    headers={"Origin": "https://pillb.github.io"},
                )
                self.assertEqual(unauthorized.status_code, 401)

                authorized = client.get(
                    "/v1/cases/harbor-lantern/workbench",
                    headers={
                        "Origin": "https://pillb.github.io",
                        "Authorization": f"Bearer {payload['token']}",
                    },
                )
                self.assertEqual(authorized.status_code, 200)
                self.assertEqual(authorized.json()["contract"], "WorkbenchBootstrapV1")
                self.assertEqual(
                    authorized.headers.get("access-control-allow-origin"),
                    "https://pillb.github.io",
                )

                status = client.get("/v1/demo/security").json()
                self.assertTrue(status["passed"])
                self.assertTrue(status["postgresTls"]["passed"])

                probe_response = client.get(
                    "/v1/demo/postgres-probe",
                    headers={"Origin": "https://pillb.github.io"},
                )
                self.assertEqual(probe_response.status_code, 401)

                with patch(
                    "apps.api.optional_api.postgres_runtime_security_probe",
                    return_value={
                        "contract": "HybridDemoPostgresRuntimeProbeV1",
                        "passed": True,
                        "failures": [],
                    },
                ):
                    probe_response = client.get(
                        "/v1/demo/postgres-probe",
                        headers={
                            "Origin": "https://pillb.github.io",
                            "Authorization": f"Bearer {payload['token']}",
                        },
                    )
                self.assertEqual(probe_response.status_code, 200)
                self.assertTrue(probe_response.json()["passed"])

    def test_postgres_workbench_source_fails_closed_without_synthetic_fallback(self) -> None:
        with tempfile.TemporaryDirectory() as tmpdir:
            accounts = Path(tmpdir) / "accounts.txt"
            accounts.write_text(
                "analyst@example.test:demo-pass-1:demo-analyst:training:device_signature\n",
                "utf8",
            )
            env = {
                "NAPP_DEMO_AUTH_REQUIRED": "1",
                "NAPP_DEMO_TOKEN_SECRET": "test-secret-at-least-local",
                "NAPP_DEMO_ACCOUNTS_FILE": str(accounts),
                "NAPP_DEMO_ALLOWED_ORIGINS": "https://pillb.github.io",
                "NAPP_DEMO_WORKBENCH_SOURCE": "postgres",
                "NAPP_POSTGRES_DSN": "postgresql://demo:secret@localhost:5432/napp?sslmode=verify-full&sslrootcert=/tmp/root.crt",
            }
            with patch.dict(os.environ, env, clear=False):
                client = TestClient(create_app())
                login = client.post(
                    "/v1/demo/login",
                    headers={"Origin": "https://pillb.github.io"},
                    json={"username": "analyst@example.test", "password": "demo-pass-1"},
                )
                self.assertEqual(login.status_code, 200)

                with patch(
                    "apps.api.optional_api.postgres_runtime_security_probe",
                    return_value={
                        "contract": "HybridDemoPostgresRuntimeProbeV1",
                        "passed": False,
                        "transport": {"passed": False},
                        "failures": ["forced RLS missing"],
                    },
                ):
                    response = client.get(
                        "/v1/cases/harbor-lantern/workbench",
                        headers={
                            "Origin": "https://pillb.github.io",
                            "Authorization": f"Bearer {login.json()['token']}",
                        },
                    )

                self.assertEqual(response.status_code, 503)
                detail = response.json()["detail"]
                self.assertEqual(detail["error"]["code"], "postgres_demo_not_ready")
                self.assertIn("forced RLS missing", detail["error"]["details"]["failures"])

    def test_postgres_workbench_source_uses_postgres_repository_when_probe_passes(self) -> None:
        class FakePool:
            def __init__(self, **kwargs: object) -> None:
                self.kwargs = kwargs

            def __enter__(self) -> "FakePool":
                return self

            def __exit__(self, *_args: object) -> None:
                return None

        captured: dict[str, object] = {}

        class FakeRepository:
            def __init__(self, pool: object, *, actor_id: object, purpose_id: object) -> None:
                captured["pool"] = pool
                captured["actor_id"] = actor_id
                captured["purpose_id"] = purpose_id

        with tempfile.TemporaryDirectory() as tmpdir:
            accounts = Path(tmpdir) / "accounts.txt"
            accounts.write_text(
                "analyst@example.test:demo-pass-1:demo-analyst:training:device_signature\n",
                "utf8",
            )
            env = {
                "NAPP_DEMO_AUTH_REQUIRED": "1",
                "NAPP_DEMO_TOKEN_SECRET": "test-secret-at-least-local",
                "NAPP_DEMO_ACCOUNTS_FILE": str(accounts),
                "NAPP_DEMO_ALLOWED_ORIGINS": "https://pillb.github.io",
                "NAPP_DEMO_WORKBENCH_SOURCE": "postgres",
                "NAPP_POSTGRES_DSN": "postgresql://demo:secret@localhost:5432/napp?sslmode=verify-full&sslrootcert=/tmp/root.crt",
            }
            with patch.dict(os.environ, env, clear=False):
                client = TestClient(create_app())
                login = client.post(
                    "/v1/demo/login",
                    headers={"Origin": "https://pillb.github.io"},
                    json={"username": "analyst@example.test", "password": "demo-pass-1"},
                )
                self.assertEqual(login.status_code, 200)

                with (
                    patch(
                        "apps.api.optional_api.postgres_runtime_security_probe",
                        return_value={
                            "contract": "HybridDemoPostgresRuntimeProbeV1",
                            "passed": True,
                            "transport": {"passed": True},
                            "failures": [],
                        },
                    ),
                    patch("psycopg_pool.ConnectionPool", FakePool),
                    patch("apps.api.persistence.PostgreSQLAssertionRepository", FakeRepository),
                    patch(
                        "apps.api.optional_api.build_harbor_lantern_workbench",
                        return_value=SimpleNamespace(
                            to_dict=lambda: {
                                "contract": "WorkbenchBootstrapV1",
                                "source": "postgres",
                            }
                        ),
                    ) as builder,
                ):
                    response = client.get(
                        "/v1/cases/harbor-lantern/workbench",
                        headers={
                            "Origin": "https://pillb.github.io",
                            "Authorization": f"Bearer {login.json()['token']}",
                        },
                    )

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()["source"], "postgres")
                self.assertIn("repository", builder.call_args.kwargs)
                self.assertIsInstance(captured["pool"], FakePool)
                self.assertNotEqual(str(captured["actor_id"]), "demo-analyst")
                self.assertNotEqual(str(captured["purpose_id"]), "training")


if __name__ == "__main__":
    unittest.main()
