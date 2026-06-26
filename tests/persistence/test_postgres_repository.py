from __future__ import annotations

import unittest
from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from apps.api.persistence.postgres import PostgreSQLAssertionRepository
from apps.api.temporal import HistoricalQuery, TemporalInterval, TemporalWindowQuery

from .fakes import FakeConnection, FakePool


UTC = timezone.utc
ACTOR = UUID("20000000-0000-0000-0000-000000000001")
PURPOSE = UUID("70000000-0000-0000-0000-000000000001")


def instant(day: int) -> datetime:
    return datetime(2026, 3, day, tzinfo=UTC)


def corrected_row() -> dict[str, object]:
    return {
        "id": UUID("30000000-0000-0000-0000-000000000002"),
        "revision_number": 2,
        "recorded_at": instant(25),
        "recorded_end": None,
        "assertion_class": "persistent_state",
        "evidence_status": "asserted",
        "confidence": Decimal("0.9900"),
        "validity_kind": "interval",
        "valid_start": instant(1),
        "valid_end": datetime(2026, 3, 31, tzinfo=UTC),
        "restrictions": {
            "handling_label": "training",
            "field_restrictions": [],
        },
        "payload": {
            "revision_key": "hl-berth-access-r2",
            "subject_ref": "marcus",
            "object_ref": "halcyon",
            "valid_start": "2026-03-01T00:00:00Z",
            "valid_end": "2026-03-31T00:00:00Z",
            "recorded_end": None,
            "status": "active",
            "created_by": "fixture",
            "ui": {
                "supersedesRevisionId": "hl-berth-access-r1",
                "correctionReason": "column correction",
            },
        },
        "rationale": "column correction",
        "supersedes_revision_id": UUID(
            "30000000-0000-0000-0000-000000000001"
        ),
        "assertion_key": "hl-berth-access",
        "predicate": "accessed_berth",
        "subject_ref": "marcus",
        "case_key": "harbor-lantern",
        "source_key": "hl-source-corrected-log",
        "source_name": "Corrected harbor access export",
        "object_uri": "HL-ACCESS-CORR#184",
        "received_at": instant(25),
        "source_restrictions": {"handling_label": "training"},
        "source_metadata": {
            "source_name": "Corrected harbor access export",
            "original_reference": "HL-ACCESS-CORR#184",
            "source_reliability": "A",
            "information_credibility": "1",
        },
    }


class PostgreSQLAssertionRepositoryTests(unittest.TestCase):
    def test_point_snapshot_uses_latest_known_successor_and_rehydrates_domain(
        self,
    ) -> None:
        connection = FakeConnection(rows=[corrected_row()])
        repository = PostgreSQLAssertionRepository(
            FakePool(connection), actor_id=ACTOR, purpose_id=PURPOSE
        )
        query = HistoricalQuery(
            valid_at=instant(10),
            known_at=instant(26),
            case_id="harbor-lantern",
        )

        snapshot = repository.snapshot(query)

        self.assertEqual(("hl-berth-access-r2",), snapshot.revision_ids)
        self.assertEqual("halcyon", snapshot.dependencies[0].object_value)
        self.assertEqual(
            "hl-berth-access-r1",
            snapshot.dependencies[0].supersedes_revision_id,
        )
        statement, parameters = connection.cursor_calls[0]
        self.assertIn("NOT EXISTS", statement)
        self.assertIn("known_successor.recorded_at <= %s", statement)
        self.assertEqual(query.known_at, parameters[1])
        self.assertEqual(query.known_at, parameters[2])

    def test_window_snapshot_uses_point_membership_and_half_open_interval_overlap(
        self,
    ) -> None:
        connection = FakeConnection(rows=[])
        repository = PostgreSQLAssertionRepository(
            FakePool(connection), actor_id=ACTOR, purpose_id=PURPOSE
        )
        query = TemporalWindowQuery(
            valid_during=TemporalInterval(instant(1), instant(20)),
            known_at=instant(21),
            case_id="harbor-lantern",
        )

        self.assertEqual((), repository.window_snapshot(query).revision_ids)
        statement, parameters = connection.cursor_calls[0]
        self.assertIn("lower(r.valid_period) >= %s", statement)
        self.assertIn(
            "COALESCE(%s::timestamptz, 'infinity'::timestamptz)", statement
        )
        self.assertIn("r.valid_period && tstzrange(%s, %s, '[)')", statement)
        self.assertEqual((instant(1), instant(20)), parameters[-2:])

    def test_repository_requires_case_scope(self) -> None:
        repository = PostgreSQLAssertionRepository(
            FakePool(), actor_id=ACTOR, purpose_id=PURPOSE
        )

        with self.assertRaisesRegex(ValueError, "case_id"):
            repository.reconstruct(
                HistoricalQuery(
                    valid_at=instant(1),
                    known_at=instant(2),
                    case_id=None,
                )
            )
