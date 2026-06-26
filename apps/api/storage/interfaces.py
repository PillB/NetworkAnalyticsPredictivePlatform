"""Dependency-light storage and external audit anchoring interfaces."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping, Protocol

from .models import (
    AnchorReceipt,
    AuditCheckpoint,
    ObjectRef,
    ReconstructedReport,
    ReportDependency,
    ReportManifest,
    RetentionMarker,
    StoredObject,
)


class ObjectStore(Protocol):
    def put(
        self,
        content: bytes,
        *,
        expected_digest: str | None = None,
        media_type: str = "application/octet-stream",
        metadata: Mapping[str, Any] | None = None,
    ) -> StoredObject: ...

    def get(self, digest: str) -> bytes: ...

    def inspect(self, digest: str) -> StoredObject: ...

    def record_retention(
        self,
        object_ref: ObjectRef,
        *,
        marker_id: str,
        disposition: str,
        retain_until: datetime | None = None,
        reason_code: str | None = None,
    ) -> RetentionMarker: ...

    def retention_markers(self, digest: str) -> tuple[RetentionMarker, ...]: ...


class ReportStore(Protocol):
    def put_report(
        self,
        report_key: str,
        content: bytes,
        *,
        dependencies: tuple[ReportDependency, ...],
        expected_digest: str | None = None,
        media_type: str = "application/octet-stream",
        metadata: Mapping[str, Any] | None = None,
    ) -> ReportManifest: ...

    def get_report(
        self, report_key: str, manifest_digest: str
    ) -> ReconstructedReport: ...


class AuditAnchor(Protocol):
    def anchor(self, checkpoint: AuditCheckpoint) -> AnchorReceipt: ...

    def verify(
        self,
        receipt: AnchorReceipt,
        *,
        expected_chain_hash: str | None = None,
    ) -> bool: ...
