"""Optional FastAPI adapter; the temporal domain does not depend on FastAPI."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from .demo_bundle import (
    build_harbor_lantern_workbench,
    harbor_lantern_training_authorization,
)
from .service import ServiceError
from .temporal.fixtures import harbor_lantern_repository
from .temporal.models import HistoricalQuery

try:
    from fastapi import FastAPI, Header, HTTPException
    from fastapi.responses import RedirectResponse
    from fastapi.staticfiles import StaticFiles
except ImportError:  # pragma: no cover - depends on the deployment environment
    FastAPI = None  # type: ignore[assignment,misc]
    Header = None  # type: ignore[assignment,misc]
    HTTPException = None  # type: ignore[assignment,misc]
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
        case_id: str,
        x_actor_id: str = Header(..., alias="X-Actor-Id"),
        x_purpose: str = Header(..., alias="X-Purpose"),
        x_authorization_id: str = Header(..., alias="X-Authorization-Id"),
        x_allowed_fields: str = Header(
            "device_signature,precise_location",
            alias="X-Allowed-Fields",
        ),
    ) -> dict[str, Any]:
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
