"""Authorization-aware service layer."""

from .errors import AuthorizationDenied, InvalidServiceRequest, ServiceError
from .platform import (
    DEFAULT_PROJECTION_FIELDS,
    MANDATORY_PROJECTION_FIELDS,
    AnalysisService,
)

__all__ = [
    "AnalysisService",
    "AuthorizationDenied",
    "DEFAULT_PROJECTION_FIELDS",
    "InvalidServiceRequest",
    "MANDATORY_PROJECTION_FIELDS",
    "ServiceError",
]
