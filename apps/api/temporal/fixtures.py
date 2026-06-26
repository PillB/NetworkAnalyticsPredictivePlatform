"""Canonical Harbor Lantern fixture adapter for temporal domain objects."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping

from apps.api.fixture_loader import load_harbor_lantern_fixture

from .models import AssertionClass, AssertionRevision, SourceRecord, TemporalInterval
from .repository import InMemoryAssertionRepository


def parse_instant(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _revision_from_record(record: Mapping[str, Any]) -> AssertionRevision:
    recorded_start = parse_instant(record["recordedStart"])
    if recorded_start is None:  # defensive: required by the interchange contract
        raise ValueError("recordedStart is required")
    source = SourceRecord(
        source_record_id=record["sourceId"],
        source_name=record["source"],
        original_reference=record["originalReference"],
        source_reliability=record["reliability"],
        information_credibility=record["credibility"],
        acquired_at=recorded_start,
        metadata={
            "synthetic": True,
            "fixture_schema": "HarborLanternInterchangeV1",
            "fixture_relationship_id": record.get("id"),
        },
    )
    return AssertionRevision(
        assertion_id=record["assertionId"],
        revision_id=record["revisionId"],
        case_id="harbor-lantern",
        subject_ref=record["subject"],
        predicate=record["predicateCode"],
        object_value=record["object"],
        assertion_class=AssertionClass(record["assertionClass"]),
        valid_during=TemporalInterval(
            parse_instant(record["validStart"]),  # type: ignore[arg-type]
            parse_instant(record.get("validEnd")),
        ),
        recorded_during=TemporalInterval(
            recorded_start,
            parse_instant(record.get("recordedEnd")),
        ),
        source=source,
        status=record.get("status", "active"),
        analytical_confidence=float(record["confidenceValue"]),
        handling_label=record.get("handlingLabel", "training"),
        field_restrictions=tuple(record.get("fieldRestrictions", ())),
        event_at=parse_instant(record.get("eventAt")),
        event_precision=record.get("eventPrecision"),
        supersedes_revision_id=record.get("supersedesRevisionId"),
        correction_reason=record.get("correctionReason"),
    )


def harbor_lantern_repository() -> InMemoryAssertionRepository:
    """Return all canonical UI assertions plus temporal correction scenarios."""

    fixture = load_harbor_lantern_fixture()
    records = tuple(fixture["relationships"]) + tuple(fixture["temporalCorrections"])
    return InMemoryAssertionRepository(_revision_from_record(record) for record in records)
