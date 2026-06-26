"""Versioned pure-Python API contracts."""

from .models import (
    AuthorizationContext,
    AuthorizedTemporalProjection,
    CaseManifest,
    ComparisonResult,
    LineageResult,
    ReportDraft,
    StructuredError,
    WorkbenchBootstrap,
    deterministic_json,
)

AuthorizationContextV1 = AuthorizationContext
AuthorizedTemporalProjectionV1 = AuthorizedTemporalProjection
CaseManifestV1 = CaseManifest
ComparisonResultV1 = ComparisonResult
LineageResultV1 = LineageResult
ReportDraftV1 = ReportDraft
StructuredErrorV1 = StructuredError
WorkbenchBootstrapV1 = WorkbenchBootstrap

__all__ = [
    "AuthorizationContext",
    "AuthorizationContextV1",
    "AuthorizedTemporalProjection",
    "AuthorizedTemporalProjectionV1",
    "CaseManifest",
    "CaseManifestV1",
    "ComparisonResult",
    "ComparisonResultV1",
    "LineageResult",
    "LineageResultV1",
    "ReportDraft",
    "ReportDraftV1",
    "StructuredError",
    "StructuredErrorV1",
    "WorkbenchBootstrap",
    "WorkbenchBootstrapV1",
    "deterministic_json",
]
