"""Immutable contracts for content-addressed objects, reports, and audit anchors."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from types import MappingProxyType
from typing import Any, Mapping


SHA256_LENGTH = 64


def validate_digest(value: str, field_name: str = "digest") -> str:
    normalized = value.lower()
    if len(normalized) != SHA256_LENGTH or any(
        character not in "0123456789abcdef" for character in normalized
    ):
        raise ValueError(f"{field_name} must be a lowercase SHA-256 hex digest")
    if value != normalized:
        raise ValueError(f"{field_name} must be a lowercase SHA-256 hex digest")
    return value


def require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")


def freeze_metadata(value: Mapping[str, Any]) -> Mapping[str, Any]:
    return MappingProxyType(dict(value))


@dataclass(frozen=True)
class ObjectRef:
    digest: str
    size: int
    media_type: str = "application/octet-stream"

    def __post_init__(self) -> None:
        validate_digest(self.digest)
        if self.size < 0:
            raise ValueError("size cannot be negative")
        if not self.media_type:
            raise ValueError("media_type is required")

    @property
    def uri(self) -> str:
        return f"sha256:{self.digest}"


@dataclass(frozen=True)
class StoredObject:
    ref: ObjectRef
    created_at: datetime
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        require_aware(self.created_at, "created_at")
        object.__setattr__(self, "metadata", freeze_metadata(self.metadata))


@dataclass(frozen=True, order=True)
class ReportDependency:
    name: str
    object_ref: ObjectRef
    role: str = "input"

    def __post_init__(self) -> None:
        if not self.name:
            raise ValueError("dependency name is required")
        if not self.role:
            raise ValueError("dependency role is required")


@dataclass(frozen=True)
class ReportManifest:
    report_key: str
    report_object: ObjectRef
    dependencies: tuple[ReportDependency, ...]
    created_at: datetime
    manifest_digest: str
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        validate_digest(self.manifest_digest, "manifest_digest")
        require_aware(self.created_at, "created_at")
        dependencies = tuple(self.dependencies)
        names = [dependency.name for dependency in dependencies]
        if len(names) != len(set(names)):
            raise ValueError("report dependency names must be unique")
        object.__setattr__(self, "dependencies", dependencies)
        object.__setattr__(self, "metadata", freeze_metadata(self.metadata))


@dataclass(frozen=True)
class ReconstructedReport:
    manifest: ReportManifest
    content: bytes
    dependencies: Mapping[str, bytes]

    def __post_init__(self) -> None:
        object.__setattr__(
            self, "dependencies", MappingProxyType(dict(self.dependencies))
        )


@dataclass(frozen=True)
class RetentionMarker:
    marker_id: str
    object_digest: str
    disposition: str
    recorded_at: datetime
    retain_until: datetime | None = None
    reason_code: str | None = None

    def __post_init__(self) -> None:
        validate_digest(self.object_digest, "object_digest")
        require_aware(self.recorded_at, "recorded_at")
        if self.retain_until is not None:
            require_aware(self.retain_until, "retain_until")
        if not self.marker_id or not self.disposition:
            raise ValueError("marker_id and disposition are required")


@dataclass(frozen=True)
class AuditCheckpoint:
    checkpoint_id: str
    stream_key: str
    through_sequence: int
    chain_hash: str
    created_at: datetime

    def __post_init__(self) -> None:
        if not self.checkpoint_id or not self.stream_key:
            raise ValueError("checkpoint_id and stream_key are required")
        if self.through_sequence < 0:
            raise ValueError("through_sequence cannot be negative")
        validate_digest(self.chain_hash, "chain_hash")
        require_aware(self.created_at, "created_at")


@dataclass(frozen=True)
class AnchorReceipt:
    checkpoint: AuditCheckpoint
    anchored_at: datetime
    previous_receipt_hash: str | None
    receipt_hash: str
    uri: str

    def __post_init__(self) -> None:
        require_aware(self.anchored_at, "anchored_at")
        if self.previous_receipt_hash is not None:
            validate_digest(self.previous_receipt_hash, "previous_receipt_hash")
        validate_digest(self.receipt_hash, "receipt_hash")
        if not self.uri:
            raise ValueError("uri is required")
