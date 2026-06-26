"""Service exceptions with stable, transport-neutral error payloads."""

from __future__ import annotations

from typing import Any, Mapping

from apps.api.contracts import StructuredError


class ServiceError(Exception):
    def __init__(self, error: StructuredError) -> None:
        super().__init__(error.message)
        self.error = error

    def to_dict(self) -> dict[str, Any]:
        return self.error.to_dict()


class AuthorizationDenied(ServiceError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "authorization_denied",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(
            StructuredError(
                code=code,
                message=message,
                status=403,
                details=details or {},
                recovery=("Confirm the active case and permissible purpose.",),
            )
        )


class InvalidServiceRequest(ServiceError):
    def __init__(
        self,
        message: str,
        *,
        code: str = "invalid_request",
        details: Mapping[str, Any] | None = None,
    ) -> None:
        super().__init__(
            StructuredError(
                code=code,
                message=message,
                status=422,
                details=details or {},
            )
        )
