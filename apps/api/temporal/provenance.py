"""Serializable provenance packages with temporal leakage checks."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .models import AssertionRevision, HistoricalQuery, TemporalWindowQuery


class FutureLeakageError(ValueError):
    """Raised when a snapshot depends on evidence unavailable at its cutoff."""


@dataclass(frozen=True)
class TemporalSnapshot:
    query: HistoricalQuery
    dependencies: tuple[AssertionRevision, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "dependencies", tuple(self.dependencies))
        invalid = [
            revision.revision_id
            for revision in self.dependencies
            if not revision.visible_at(self.query.known_at)
            or not revision.applies_at(self.query.valid_at)
            or (
                self.query.case_id is not None
                and revision.case_id != self.query.case_id
            )
        ]
        if invalid:
            joined = ", ".join(sorted(invalid))
            raise FutureLeakageError(
                f"snapshot contains post-cutoff or out-of-scope revisions: {joined}"
            )

    @property
    def revision_ids(self) -> tuple[str, ...]:
        return tuple(revision.revision_id for revision in self.dependencies)

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "TemporalSnapshotV1",
            "query": self.query.to_dict(),
            "assertion_revision_ids": list(self.revision_ids),
            "provenance": [
                revision.to_dict(include_source=True)
                for revision in self.dependencies
            ],
        }


@dataclass(frozen=True)
class TemporalWindowSnapshot:
    query: TemporalWindowQuery
    dependencies: tuple[AssertionRevision, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "dependencies", tuple(self.dependencies))
        invalid = [
            revision.revision_id
            for revision in self.dependencies
            if not revision.visible_at(self.query.known_at)
            or not revision.applies_during(self.query.valid_during)
            or (
                self.query.case_id is not None
                and revision.case_id != self.query.case_id
            )
        ]
        if invalid:
            joined = ", ".join(sorted(invalid))
            raise FutureLeakageError(
                f"window snapshot contains post-cutoff or out-of-scope revisions: {joined}"
            )

    @property
    def revision_ids(self) -> tuple[str, ...]:
        return tuple(revision.revision_id for revision in self.dependencies)

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "TemporalWindowSnapshotV1",
            "query": self.query.to_dict(),
            "assertion_revision_ids": list(self.revision_ids),
            "provenance": [
                revision.to_dict(include_source=True)
                for revision in self.dependencies
            ],
        }
