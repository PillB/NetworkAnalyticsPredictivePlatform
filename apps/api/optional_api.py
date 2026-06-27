"""Optional FastAPI adapter; the temporal domain does not depend on FastAPI."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .demo_security import (
    DemoSecurityConfig,
    authenticate_demo_account,
    demo_security_status,
    issue_demo_token,
    origin_allowed,
    postgres_runtime_security_probe,
    verify_demo_token,
)
from .demo_bundle import (
    build_harbor_lantern_workbench,
    harbor_lantern_training_authorization,
)
from .service import ServiceError
from .temporal.fixtures import harbor_lantern_repository
from .temporal.models import HistoricalQuery

try:
    from fastapi import Body, FastAPI, Header, HTTPException, Request
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.responses import RedirectResponse
    from fastapi.staticfiles import StaticFiles
except ImportError:  # pragma: no cover - depends on the deployment environment
    Body = None  # type: ignore[assignment,misc]
    FastAPI = None  # type: ignore[assignment,misc]
    Header = None  # type: ignore[assignment,misc]
    HTTPException = None  # type: ignore[assignment,misc]
    Request = None  # type: ignore[assignment,misc]
    CORSMiddleware = None  # type: ignore[assignment,misc]
    RedirectResponse = None  # type: ignore[assignment,misc]
    StaticFiles = None  # type: ignore[assignment,misc]


def fastapi_available() -> bool:
    return FastAPI is not None


def create_app() -> Any:
    if FastAPI is None:
        raise RuntimeError(
            "FastAPI is not installed; use apps.api.temporal as a pure Python domain"
        )

    app = FastAPI(title="Network Platform Temporal API", version="0.1.0")
    repository = harbor_lantern_repository()
    demo_config = DemoSecurityConfig.from_env()

    if demo_config.allowed_origins and CORSMiddleware is not None:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=list(demo_config.allowed_origins),
            allow_credentials=False,
            allow_methods=["GET", "POST", "OPTIONS"],
            allow_headers=[
                "Authorization",
                "Content-Type",
                "X-Actor-Id",
                "X-Purpose",
                "X-Authorization-Id",
                "X-Allowed-Fields",
            ],
            max_age=600,
        )

    @app.middleware("http")
    async def demo_security_headers(request: Any, call_next: Any) -> Any:
        response = await call_next(request)
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("Cache-Control", "no-store")
        if request.url.scheme == "https":
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        return response

    def _require_origin(request: Any) -> None:
        if not origin_allowed(request.headers.get("origin"), demo_config):
            raise HTTPException(status_code=403, detail="Origin is not allowed for this demo bridge")

    def _demo_payload_from_authorization(authorization: str | None) -> dict[str, Any] | None:
        if not authorization:
            return None
        scheme, _, token = authorization.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise HTTPException(status_code=401, detail="Bearer demo token is required")
        try:
            return verify_demo_token(token, demo_config)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @app.get("/v1/demo/security")
    def demo_security() -> dict[str, Any]:
        return demo_security_status(demo_config)

    @app.post("/v1/demo/login")
    def demo_login(
        request: Request,
        credentials: dict[str, str] = Body(...),
    ) -> dict[str, Any]:
        _require_origin(request)
        try:
            account = authenticate_demo_account(
                credentials.get("username", ""),
                credentials.get("password", ""),
                demo_config,
            )
            token = issue_demo_token(account, demo_config)
        except ValueError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc
        return {
            "contract": "HybridDemoLoginV1",
            "token": token,
            "actorId": account.actor_id,
            "purpose": account.purpose,
            "allowedFields": list(account.allowed_fields),
            "expiresInSeconds": demo_config.token_ttl_seconds,
        }

    @app.get("/v1/demo/postgres-probe")
    def demo_postgres_probe(
        request: Request,
        authorization: str | None = Header(None, alias="Authorization"),
    ) -> dict[str, Any]:
        _require_origin(request)
        demo_payload = _demo_payload_from_authorization(authorization)
        if demo_config.auth_required and demo_payload is None:
            raise HTTPException(status_code=401, detail="Demo login is required")
        return postgres_runtime_security_probe(demo_config)

    @app.get("/temporal/reconstruct")
    def reconstruct(valid_at: datetime, known_at: datetime) -> dict[str, Any]:
        try:
            query = HistoricalQuery(
                valid_at=valid_at,
                known_at=known_at,
                case_id="harbor-lantern",
            )
            return repository.snapshot(query).to_dict()
        except ValueError as exc:
            raise HTTPException(status_code=422, detail=str(exc)) from exc

    @app.get("/temporal/revisions/{revision_id}")
    def revision(revision_id: str) -> dict[str, Any]:
        try:
            return repository.get_revision(revision_id).to_dict()
        except KeyError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @app.get("/v1/cases/{case_id}/workbench")
    def workbench(
        request: Request,
        case_id: str,
        authorization: str | None = Header(None, alias="Authorization"),
        x_actor_id: str | None = Header(None, alias="X-Actor-Id"),
        x_purpose: str | None = Header(None, alias="X-Purpose"),
        x_authorization_id: str | None = Header(None, alias="X-Authorization-Id"),
        x_allowed_fields: str = Header(
            "device_signature,precise_location",
            alias="X-Allowed-Fields",
        ),
    ) -> dict[str, Any]:
        _require_origin(request)
        demo_payload = _demo_payload_from_authorization(authorization)
        if demo_config.auth_required and demo_payload is None:
            raise HTTPException(status_code=401, detail="Demo login is required")
        if demo_payload is not None:
            x_actor_id = str(demo_payload["actor_id"])
            x_purpose = str(demo_payload["purpose"])
            x_authorization_id = str(demo_payload["jti"])
            x_allowed_fields = ",".join(demo_payload.get("allowed_fields", []))
        if not x_actor_id or not x_purpose or not x_authorization_id:
            raise HTTPException(status_code=422, detail="Authorization headers or demo token are required")
        if case_id != "harbor-lantern":
            raise HTTPException(
                status_code=404,
                detail={
                    "contract": "StructuredErrorV1",
                    "error": {
                        "code": "case_not_found",
                        "message": "The requested training case does not exist.",
                        "status": 404,
                        "retryable": False,
                        "details": {"case_id": case_id},
                        "recovery": ["Select an authorized case."],
                    },
                },
            )
        authorization = harbor_lantern_training_authorization(
            actor_id=x_actor_id,
            purpose=x_purpose,
            authorization_id=x_authorization_id,
            allowed_fields=tuple(
                sorted(
                    field.strip()
                    for field in x_allowed_fields.split(",")
                    if field.strip()
                )
            ),
        )
        try:
            return build_harbor_lantern_workbench(authorization).to_dict()
        except ServiceError as exc:
            error = exc.error.to_dict()
            raise HTTPException(
                status_code=error["error"]["status"],
                detail=error,
            ) from exc

    from pathlib import Path

    repository_root = Path(__file__).resolve().parents[2]

    @app.get("/", include_in_schema=False)
    def root() -> Any:
        return RedirectResponse("/apps/web/")

    app.mount(
        "/apps/web",
        StaticFiles(directory=repository_root / "apps" / "web", html=True),
        name="web",
    )
    app.mount(
        "/packages",
        StaticFiles(directory=repository_root / "packages"),
        name="packages",
    )
    app.mount(
        "/data",
        StaticFiles(directory=repository_root / "data"),
        name="data",
    )

    return app


app = create_app() if fastapi_available() else None
