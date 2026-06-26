from __future__ import annotations

import json
import unittest
from dataclasses import FrozenInstanceError
from datetime import datetime, timezone

from apps.api.temporal import (
    FutureLeakageError,
    HistoricalQuery,
    TemporalInterval,
    TemporalSnapshot,
    TemporalWindowQuery,
)
from apps.api.temporal.fixtures import harbor_lantern_repository

UTC = timezone.utc


def at(day: int, hour: int = 0) -> datetime:
    return datetime(2026, 3, day, hour, tzinfo=UTC)


class TemporalDomainTests(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = harbor_lantern_repository()

    def query(self, *, valid_at: datetime, known_at: datetime):
        return self.repository.reconstruct(
            HistoricalQuery(
                valid_at=valid_at,
                known_at=known_at,
                case_id="harbor-lantern",
            )
        )

    def test_late_evidence_is_hidden_until_recorded(self) -> None:
        before = self.query(valid_at=at(1, 10), known_at=at(10))
        after = self.query(valid_at=at(1, 10), known_at=at(21))

        self.assertNotIn("hl-radio-contact-r1", {item.revision_id for item in before})
        self.assertIn("hl-radio-contact-r1", {item.revision_id for item in after})

    def test_correction_preserves_historical_belief(self) -> None:
        march_20 = self.query(valid_at=at(10), known_at=at(20))
        march_26 = self.query(valid_at=at(10), known_at=at(26))

        self.assertIn("hl-berth-access-r1", {item.revision_id for item in march_20})
        self.assertNotIn("hl-berth-access-r2", {item.revision_id for item in march_20})
        self.assertNotIn("hl-berth-access-r1", {item.revision_id for item in march_26})
        self.assertIn("hl-berth-access-r2", {item.revision_id for item in march_26})

        history = self.repository.history("hl-berth-access")
        self.assertEqual(
            ("hl-berth-access-r1", "hl-berth-access-r2"),
            tuple(item.revision_id for item in history),
        )
        self.assertEqual(history[0].revision_id, history[1].supersedes_revision_id)

    def test_point_event_does_not_become_persistent(self) -> None:
        at_event = self.query(valid_at=at(1, 10), known_at=at(21))
        after_event = self.query(valid_at=at(2), known_at=at(21))

        self.assertIn("hl-radio-contact-r1", {item.revision_id for item in at_event})
        self.assertNotIn(
            "hl-radio-contact-r1", {item.revision_id for item in after_event}
        )
        self.assertIn(
            "hl-working-association-r1",
            {item.revision_id for item in after_event},
        )

    def test_revisions_and_nested_metadata_are_immutable(self) -> None:
        revision = self.repository.get_revision("hl-berth-access-r1")
        with self.assertRaises(FrozenInstanceError):
            revision.object_value = "berth:pier-9"  # type: ignore[misc]
        with self.assertRaises(TypeError):
            revision.source.metadata["synthetic"] = False  # type: ignore[index]

    def test_provenance_is_json_serializable_and_exact(self) -> None:
        snapshot = self.repository.snapshot(
            HistoricalQuery(at(10), at(26), case_id="harbor-lantern")
        )
        payload = snapshot.to_dict()

        json.dumps(payload)
        self.assertEqual("TemporalSnapshotV1", payload["contract"])
        self.assertEqual(
            list(snapshot.revision_ids), payload["assertion_revision_ids"]
        )
        corrected = next(
            item
            for item in payload["provenance"]
            if item["revision_id"] == "hl-berth-access-r2"
        )
        self.assertEqual(
            "HL-ACCESS-2026-03-CORR.csv#row-184",
            corrected["source"]["original_reference"],
        )
        self.assertEqual("2026-03-25T00:00:00Z", corrected["recorded_during"]["start"])

    def test_snapshot_rejects_future_dependency(self) -> None:
        future_revision = self.repository.get_revision("hl-radio-contact-r1")
        query = HistoricalQuery(at(1, 10), at(10), case_id="harbor-lantern")

        with self.assertRaises(FutureLeakageError):
            TemporalSnapshot(query=query, dependencies=(future_revision,))

    def test_repository_snapshot_contains_no_future_dependency(self) -> None:
        query = HistoricalQuery(at(1, 10), at(10), case_id="harbor-lantern")
        snapshot = self.repository.snapshot(query)

        self.assertTrue(
            all(
                revision.recorded_during.contains(query.known_at)
                for revision in snapshot.dependencies
            )
        )

    def test_half_open_recorded_intervals_switch_atomically(self) -> None:
        at_correction = self.query(valid_at=at(10), known_at=at(25))
        revision_ids = {item.revision_id for item in at_correction}

        self.assertNotIn("hl-berth-access-r1", revision_ids)
        self.assertIn("hl-berth-access-r2", revision_ids)

    def test_naive_datetimes_are_rejected(self) -> None:
        with self.assertRaises(ValueError):
            HistoricalQuery(
                valid_at=datetime(2026, 3, 1),
                known_at=at(10),
                case_id="harbor-lantern",
            )

    def test_window_reconstruction_includes_point_events_without_persisting_them(self) -> None:
        before = self.repository.window_snapshot(
            TemporalWindowQuery(
                valid_during=TemporalInterval(
                    datetime(2026, 1, 18, tzinfo=UTC),
                    datetime(2026, 2, 17, tzinfo=UTC),
                ),
                known_at=datetime(2026, 3, 18, 23, 59, tzinfo=UTC),
                case_id="harbor-lantern",
            )
        )
        revision_ids = set(before.revision_ids)

        self.assertIn("hl-transfer-r1", revision_ids)
        self.assertIn("hl-employment-r1", revision_ids)
        self.assertNotIn("hl-dock-visit-r1", revision_ids)

    def test_window_reconstruction_respects_known_at_cutoff(self) -> None:
        after_window = TemporalInterval(
            datetime(2026, 2, 17, tzinfo=UTC),
            datetime(2026, 3, 19, tzinfo=UTC),
        )
        early = self.repository.window_snapshot(
            TemporalWindowQuery(
                valid_during=after_window,
                known_at=at(10),
                case_id="harbor-lantern",
            )
        )
        complete = self.repository.window_snapshot(
            TemporalWindowQuery(
                valid_during=after_window,
                known_at=datetime(2026, 3, 18, 23, 59, tzinfo=UTC),
                case_id="harbor-lantern",
            )
        )

        self.assertNotIn("hl-dock-visit-r1", set(early.revision_ids))
        self.assertIn("hl-dock-visit-r1", set(complete.revision_ids))
        self.assertNotIn("hl-radio-contact-r1", set(complete.revision_ids))


if __name__ == "__main__":
    unittest.main()
