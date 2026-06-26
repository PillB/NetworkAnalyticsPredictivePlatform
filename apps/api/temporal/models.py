"""Immutable records for bitemporal assertions."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping


def require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")


def isoformat_utc(value: datetime | None) -> str | None:
    if value is None:
        return None
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


@dataclass(frozen=True)
class TemporalInterval:
    """A half-open interval ``[start, end)``; ``end=None`` means unbounded."""

    start: datetime
    end: datetime | None = None

    def __post_init__(self) -> None:
        require_aware(self.start, "start")
        if self.end is not None:
            require_aware(self.end, "end")
            if self.end <= self.start:
                raise ValueError("interval end must be later than start")

    def contains(self, instant: datetime) -> bool:
        require_aware(instant, "instant")
        return self.start <= instant and (self.end is None or instant < self.end)

    def overlaps(self, other: "TemporalInterval") -> bool:
        self_ends_after_other_starts = self.end is None or other.start < self.end
        other_ends_after_self_starts = other.end is None or self.start < other.end
        return self_ends_after_other_starts and other_ends_after_self_starts

    def to_dict(self) -> dict[str, str | None]:
        return {"start": isoformat_utc(self.start), "end": isoformat_utc(self.end)}


class AssertionClass(str, Enum):
    SOURCE_REPORT = "source_report"
    ALLEGATION = "allegation"
    ANALYST_JUDGMENT = "analyst_judgment"
    OBSERVED_EVENT = "observed_event"
    PERSISTENT_STATE = "persistent_state"


@dataclass(frozen=True)
class SourceRecord:
    source_record_id: str
    source_name: str
    original_reference: str
    source_reliability: str
    information_credibility: str
    acquired_at: datetime
    metadata: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        require_aware(self.acquired_at, "acquired_at")
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))

    def to_dict(self) -> dict[str, Any]:
        return {
            "source_record_id": self.source_record_id,
            "source_name": self.source_name,
            "original_reference": self.original_reference,
            "source_reliability": self.source_reliability,
            "information_credibility": self.information_credibility,
            "acquired_at": isoformat_utc(self.acquired_at),
            "metadata": dict(self.metadata),
        }


@dataclass(frozen=True)
class AssertionRevision:
    assertion_id: str
    revision_id: str
    case_id: str
    subject_ref: str
    predicate: str
    object_value: str
    assertion_class: AssertionClass
    valid_during: TemporalInterval
    recorded_during: TemporalInterval
    source: SourceRecord
    status: str = "active"
    analytical_confidence: float = 1.0
    handling_label: str = "training"
    field_restrictions: tuple[str, ...] = ()
    created_by: str = "fixture"
    event_at: datetime | None = None
    event_precision: str | None = None
    supersedes_revision_id: str | None = None
    correction_reason: str | None = None

    def __post_init__(self) -> None:
        if not 0.0 <= self.analytical_confidence <= 1.0:
            raise ValueError("analytical_confidence must be between 0 and 1")
        if self.event_at is not None:
            require_aware(self.event_at, "event_at")
            if not self.valid_during.contains(self.event_at):
                raise ValueError("event_at must fall within valid_during")
        if self.assertion_class is AssertionClass.OBSERVED_EVENT and self.event_at is None:
            raise ValueError("observed events require event_at")
        object.__setattr__(self, "field_restrictions", tuple(self.field_restrictions))

    def applies_at(self, valid_at: datetime) -> bool:
        if not self.valid_during.contains(valid_at):
            return False
        if self.assertion_class is AssertionClass.OBSERVED_EVENT:
            return valid_at == self.event_at
        return True

    def applies_during(self, valid_during: TemporalInterval) -> bool:
        """Return whether this assertion has any support inside a valid-time window."""

        return self.valid_during.overlaps(valid_during)

    def visible_at(self, known_at: datetime) -> bool:
        return self.recorded_during.contains(known_at)

    def to_dict(self, *, include_source: bool = True) -> dict[str, Any]:
        result: dict[str, Any] = {
            "contract": "AssertionRevisionV1",
            "assertion_id": self.assertion_id,
            "revision_id": self.revision_id,
            "case_id": self.case_id,
            "subject_ref": self.subject_ref,
            "predicate": self.predicate,
            "object_value": self.object_value,
            "assertion_class": self.assertion_class.value,
            "event_at": isoformat_utc(self.event_at),
            "event_precision": self.event_precision,
            "valid_during": self.valid_during.to_dict(),
            "recorded_during": self.recorded_during.to_dict(),
            "source_record_id": self.source.source_record_id,
            "status": self.status,
            "analytical_confidence": self.analytical_confidence,
            "handling_label": self.handling_label,
            "field_restrictions": list(self.field_restrictions),
            "created_by": self.created_by,
            "supersedes_revision_id": self.supersedes_revision_id,
            "correction_reason": self.correction_reason,
        }
        if include_source:
            result["source"] = self.source.to_dict()
        return result


@dataclass(frozen=True)
class HistoricalQuery:
    valid_at: datetime
    known_at: datetime
    case_id: str | None = None

    def __post_init__(self) -> None:
        require_aware(self.valid_at, "valid_at")
        require_aware(self.known_at, "known_at")

    def to_dict(self) -> dict[str, str | None]:
        return {
            "contract": "HistoricalQueryV1",
            "valid_at": isoformat_utc(self.valid_at),
            "known_at": isoformat_utc(self.known_at),
            "case_id": self.case_id,
        }


@dataclass(frozen=True)
class TemporalWindowQuery:
    valid_during: TemporalInterval
    known_at: datetime
    case_id: str | None = None

    def __post_init__(self) -> None:
        require_aware(self.known_at, "known_at")

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "TemporalWindowQueryV1",
            "valid_during": self.valid_during.to_dict(),
            "known_at": isoformat_utc(self.known_at),
            "case_id": self.case_id,
        }
