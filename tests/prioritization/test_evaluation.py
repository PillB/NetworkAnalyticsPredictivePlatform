from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from analytics.prioritization import (
    EvidenceRecord,
    FutureOutcome,
    PriorityItem,
    assess_priority,
    empirical_bins,
    prepare_evaluation_rows,
)


UTC = timezone.utc
AS_OF = datetime(2026, 2, 1, tzinfo=UTC)


def assessment(item_id: str = "item-a"):
    records = tuple(
        EvidenceRecord(
            record_id=f"evidence-{index}",
            version=1,
            observed_at=AS_OF - timedelta(days=index),
            recorded_at=AS_OF - timedelta(days=index),
            quality=0.7,
            corroboration=0.6,
            change=0.5,
            coverage=0.8,
        )
        for index in (1, 2)
    )
    return assess_priority(
        PriorityItem(item_id, f"snapshot-{item_id}", 1, AS_OF, records)
    )


class EvaluationUtilityTests(unittest.TestCase):
    def test_prepares_versioned_rows_only_for_later_labels(self) -> None:
        result = assessment()
        outcome = FutureOutcome(
            item_id=result.item_id,
            label=1.0,
            observed_at=AS_OF + timedelta(days=30),
            label_definition_version="review-completion-v1",
        )

        rows = prepare_evaluation_rows((result,), (outcome,))

        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0].baseline_version, result.baseline_version)
        self.assertEqual(rows[0].input_version_id, result.input_version_id)
        self.assertEqual(rows[0].label_definition_version, "review-completion-v1")

    def test_rejects_labels_available_at_prediction_time(self) -> None:
        result = assessment()
        outcome = FutureOutcome(
            result.item_id, 0.0, AS_OF, "review-completion-v1"
        )

        with self.assertRaisesRegex(ValueError, "observed after prediction"):
            prepare_evaluation_rows((result,), (outcome,))

    def test_empirical_bins_explicitly_do_not_claim_calibration(self) -> None:
        result = assessment()
        rows = prepare_evaluation_rows(
            (result,),
            (
                FutureOutcome(
                    result.item_id,
                    0.5,
                    AS_OF + timedelta(days=10),
                    "review-completion-v1",
                ),
            ),
        )

        bins = empirical_bins(rows, bin_count=5)

        self.assertEqual(len(bins), 1)
        self.assertFalse(bins[0].calibrated)
        self.assertEqual(bins[0].mean_future_label, 0.5)


if __name__ == "__main__":
    unittest.main()
