"""Immutable contracts for bounded durable jobs and derived publications."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping


def require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")


def freeze_mapping(value: Mapping[str, Any]) -> Mapping[str, Any]:
    return MappingProxyType(dict(value))


class JobState(str, Enum):
    QUEUED = "queued"
    RUNNING = "running"
    RETRY_WAIT = "retry_wait"
    SUCCEEDED = "succeeded"
    FAILED = "failed"
    CANCELLED = "cancelled"


class PublicationState(str, Enum):
    CURRENT = "current"
    STALE = "stale"


class DependencyKind(str, Enum):
    ASSERTION_REVISION = "assertion_revision"
    PROJECTION = "projection"
    ANALYSIS_VERSION = "analysis_version"
    COMMUNITY_RUN = "community_run"
    LINEAGE_EVENT = "lineage_event"
    REPORT_VERSION = "report_version"
    PUBLICATION = "publication"


@dataclass(frozen=True)
class JobSpec:
    case_id: str
    kind: str
    idempotency_key: str
    input_digest: str
    parameters: Mapping[str, Any] = field(default_factory=dict)
    max_attempts: int = 3
    deadline_at: datetime | None = None

    def __post_init__(self) -> None:
        for name in ("case_id", "kind", "idempotency_key", "input_digest"):
            if not getattr(self, name):
                raise ValueError(f"{name} is required")
        if self.max_attempts < 1:
            raise ValueError("max_attempts must be at least 1")
        if self.deadline_at is not None:
            require_aware(self.deadline_at, "deadline_at")
        object.__setattr__(self, "parameters", freeze_mapping(self.parameters))


@dataclass(frozen=True)
class Lease:
    job_id: str
    attempt_id: str
    attempt_number: int
    worker_id: str
    token: str
    leased_until: datetime

    def __post_init__(self) -> None:
        require_aware(self.leased_until, "leased_until")


@dataclass(frozen=True)
class JobSnapshot:
    job_id: str
    spec: JobSpec
    state: JobState
    attempt_count: int
    available_at: datetime
    created_at: datetime
    updated_at: datetime
    cancellation_requested_at: datetime | None = None
    terminal_reason: str | None = None
    active_lease: Lease | None = None
    publication_id: str | None = None

    def __post_init__(self) -> None:
        for name in ("available_at", "created_at", "updated_at"):
            require_aware(getattr(self, name), name)
        if self.cancellation_requested_at is not None:
            require_aware(
                self.cancellation_requested_at, "cancellation_requested_at"
            )


@dataclass(frozen=True)
class StagedOutput:
    output_id: str
    job_id: str
    attempt_id: str
    name: str
    object_uri: str
    content_digest: str
    metadata: Mapping[str, Any]
    staged_at: datetime

    def __post_init__(self) -> None:
        require_aware(self.staged_at, "staged_at")
        object.__setattr__(self, "metadata", freeze_mapping(self.metadata))


@dataclass(frozen=True)
class DependencyRef:
    kind: DependencyKind
    target_id: str
    target_version: str

    def __post_init__(self) -> None:
        if not self.target_id or not self.target_version:
            raise ValueError("dependency target_id and target_version are required")


@dataclass(frozen=True)
class Publication:
    publication_id: str
    case_id: str
    result_key: str
    generation: int
    job_id: str
    attempt_id: str
    outputs: tuple[StagedOutput, ...]
    dependencies: tuple[DependencyRef, ...]
    state: PublicationState
    published_at: datetime
    stale_at: datetime | None = None
    stale_reason: str | None = None
    supersedes_publication_id: str | None = None

    def __post_init__(self) -> None:
        require_aware(self.published_at, "published_at")
        if self.stale_at is not None:
            require_aware(self.stale_at, "stale_at")


@dataclass(frozen=True)
class CorrectionImpact:
    impact_id: str
    case_id: str
    correction_id: str
    dependency: DependencyRef
    publication_id: str
    propagation_depth: int
    recorded_at: datetime

    def __post_init__(self) -> None:
        require_aware(self.recorded_at, "recorded_at")
        if self.propagation_depth < 0:
            raise ValueError("propagation_depth cannot be negative")


@dataclass(frozen=True)
class OutboxEvent:
    event_id: str
    case_id: str
    aggregate_type: str
    aggregate_id: str
    event_type: str
    payload: Mapping[str, Any]
    occurred_at: datetime
    dispatched_at: datetime | None = None

    def __post_init__(self) -> None:
        require_aware(self.occurred_at, "occurred_at")
        if self.dispatched_at is not None:
            require_aware(self.dispatched_at, "dispatched_at")
        object.__setattr__(self, "payload", freeze_mapping(self.payload))


@dataclass(frozen=True)
class CheckpointRequest:
    request_id: str
    case_id: str
    through_event_id: str
    requested_at: datetime
    requested_by: str

    def __post_init__(self) -> None:
        require_aware(self.requested_at, "requested_at")
        if not self.requested_by:
            raise ValueError("requested_by is required")


UTC = timezone.utc
