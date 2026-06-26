"""Durable-job domain contracts and dependency-light reference repository."""

from .models import (
    CheckpointRequest,
    CorrectionImpact,
    DependencyKind,
    DependencyRef,
    JobSnapshot,
    JobSpec,
    JobState,
    Lease,
    OutboxEvent,
    Publication,
    PublicationState,
    StagedOutput,
)
from .repository import (
    DeadlineExceeded,
    IdempotencyConflict,
    InMemoryJobRepository,
    InvalidTransition,
    JobError,
    LeaseConflict,
)

__all__ = [
    "CheckpointRequest",
    "CorrectionImpact",
    "DeadlineExceeded",
    "DependencyKind",
    "DependencyRef",
    "IdempotencyConflict",
    "InMemoryJobRepository",
    "InvalidTransition",
    "JobError",
    "JobSnapshot",
    "JobSpec",
    "JobState",
    "Lease",
    "LeaseConflict",
    "OutboxEvent",
    "Publication",
    "PublicationState",
    "StagedOutput",
]
