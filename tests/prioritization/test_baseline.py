from __future__ import annotations

import unittest
from dataclasses import asdict, replace
from datetime import datetime, timedelta, timezone

from analytics.prioritization import (
    BaselineConfig,
    EvidenceRecord,
    PriorityItem,
    assess_priority,
    rank_assessments,
)


UTC = timezone.utc
AS_OF = datetime(2026, 1, 15, tzinfo=UTC)


def evidence(
    record_id: str,
    *,
    version: int = 1,
    days_old: int = 10,
    quality: float | None = 0.8,
    corroboration: float | None = 0.7,
    change: float | None = 0.6,
    coverage: float | None = 0.9,
    recorded_offset_days: int = 0,
    attributes: dict[str, object] | None = None,
) -> EvidenceRecord:
    observed_at = AS_OF - timedelta(days=days_old)
    return EvidenceRecord(
        record_id=record_id,
        version=version,
        observed_at=observed_at,
        recorded_at=observed_at + timedelta(days=recorded_offset_days),
        quality=quality,
        corroboration=corroboration,
        change=change,
        coverage=coverage,
        attributes=attributes or {},
    )


def item(
    item_id: str = "review-item-a",
    records: tuple[EvidenceRecord, ...] | None = None,
    **kwargs: object,
) -> PriorityItem:
    return PriorityItem(
        item_id=item_id,
        snapshot_id=f"snapshot-{item_id}",
        snapshot_version=2,
        as_of=AS_OF,
        evidence=records
        if records is not None
        else (evidence("source-a"), evidence("source-b", days_old=20)),
        **kwargs,
    )


class EvidencePriorityBaselineTests(unittest.TestCase):
    def test_abstains_when_minimum_evidence_is_not_met(self) -> None:
        result = assess_priority(item(records=(evidence("only"),)))

        self.assertEqual(result.status, "abstained")
        self.assertIsNone(result.evidence_priority_index)
        self.assertIn("minimum_evidence_not_met", result.abstention_reasons)
        self.assertEqual(
            result.neutral_label, "insufficient evidence for review ordering"
        )

    def test_abstains_when_factor_coverage_is_too_sparse(self) -> None:
        sparse = (
            evidence(
                "a", quality=0.8, corroboration=None, change=None, coverage=None
            ),
            evidence(
                "b", quality=0.8, corroboration=None, change=None, coverage=None
            ),
        )

        result = assess_priority(item(records=sparse))

        self.assertEqual(result.status, "abstained")
        self.assertIn("minimum_factor_coverage_not_met", result.abstention_reasons)
        self.assertGreater(result.missingness_penalty_points, 0)

    def test_future_evidence_is_excluded_before_version_selection(self) -> None:
        current = evidence("source-a", version=1)
        future_revision = EvidenceRecord(
            record_id="source-a",
            version=2,
            observed_at=AS_OF + timedelta(days=1),
            recorded_at=AS_OF + timedelta(days=1),
            quality=1.0,
            corroboration=1.0,
            change=1.0,
            coverage=1.0,
        )
        result = assess_priority(
            item(records=(current, future_revision, evidence("source-b")))
        )

        self.assertEqual(result.status, "ordered")
        self.assertEqual(result.dependencies, ("source-a@v1", "source-b@v1"))
        self.assertEqual(result.excluded_dependencies, ("source-a@v2",))

    def test_dependency_trace_uses_exact_selected_versions(self) -> None:
        old = evidence("source-a", version=1, quality=0.1)
        revised = evidence("source-a", version=2, quality=0.9)
        other = evidence("source-b")

        result = assess_priority(item(records=(other, old, revised)))

        self.assertEqual(result.input_version_id, "snapshot-review-item-a@v2")
        self.assertEqual(result.dependencies, ("source-a@v2", "source-b@v1"))
        self.assertEqual(result.excluded_dependencies, ("source-a@v1",))
        self.assertEqual(
            tuple(value.dependency_id for value in result.contributions),
            result.dependencies,
        )

    def test_rejects_protected_attributes_at_any_nested_level(self) -> None:
        with self.assertRaisesRegex(ValueError, "protected attribute prohibited"):
            assess_priority(item(attributes={"context": {"race": "prohibited"}}))

        with self.assertRaisesRegex(ValueError, "protected attribute prohibited"):
            assess_priority(
                item(
                    records=(
                        evidence("a", attributes={"date_of_birth": "prohibited"}),
                        evidence("b"),
                    )
                )
            )

    def test_factor_monotonicity_and_bounded_contributions(self) -> None:
        base_records = (evidence("a", quality=0.4), evidence("b", quality=0.4))
        improved_records = (
            evidence("a", quality=0.9),
            evidence("b", quality=0.9),
        )

        base = assess_priority(item(records=base_records))
        improved = assess_priority(item(records=improved_records))

        self.assertGreater(
            improved.evidence_priority_index, base.evidence_priority_index
        )
        self.assertLessEqual(improved.evidence_priority_index, 100.0)
        for contribution in improved.contributions:
            self.assertGreaterEqual(contribution.points, 0.0)
            self.assertLessEqual(contribution.points, 100.0)
            for factor in contribution.factors:
                self.assertGreaterEqual(factor.weighted_points, 0.0)
                self.assertLessEqual(
                    factor.weighted_points,
                    100.0 * BaselineConfig().factor_weights[factor.factor],
                )

    def test_uncertainty_and_counterfactual_removal_sensitivity_are_explicit(self) -> None:
        result = assess_priority(
            item(
                records=(
                    evidence("high", quality=1.0),
                    evidence("middle", quality=0.6),
                    evidence("low", quality=0.1),
                )
            )
        )

        self.assertIsNotNone(result.uncertainty_interval)
        assert result.uncertainty_interval is not None
        self.assertLessEqual(
            result.uncertainty_interval[0], result.evidence_priority_index
        )
        self.assertGreaterEqual(
            result.uncertainty_interval[1], result.evidence_priority_index
        )
        self.assertEqual(
            {value.removed_dependency_id for value in result.removal_sensitivity},
            set(result.dependencies),
        )
        removal = {
            value.removed_dependency_id: value for value in result.removal_sensitivity
        }
        self.assertLess(removal["high@v1"].index_change, 0)
        self.assertGreater(removal["low@v1"].index_change, 0)

    def test_removal_reports_abstention_instead_of_inventing_a_score(self) -> None:
        result = assess_priority(item())

        self.assertTrue(
            all(
                value.resulting_status == "abstained"
                and value.resulting_index is None
                and value.index_change is None
                for value in result.removal_sensitivity
            )
        )

    def test_ranking_is_deterministic_and_ties_share_competition_rank(self) -> None:
        same_records = (evidence("a"), evidence("b"))
        alpha = assess_priority(item("alpha", same_records))
        beta = assess_priority(item("beta", same_records))
        lower = assess_priority(
            item(
                "lower",
                (
                    evidence("c", quality=0.1, coverage=0.2),
                    evidence("d", quality=0.1, coverage=0.2),
                ),
            )
        )

        first = rank_assessments((lower, beta, alpha))
        second = rank_assessments((alpha, lower, beta))

        self.assertEqual(first, second)
        self.assertEqual(
            [(value.assessment.item_id, value.rank, value.tie_size) for value in first],
            [("alpha", 1, 2), ("beta", 1, 2), ("lower", 3, 1)],
        )

    def test_output_is_repeatable_and_uses_neutral_language(self) -> None:
        first = assess_priority(item())
        second = assess_priority(item())

        self.assertEqual(asdict(first), asdict(second))
        self.assertFalse(first.is_guilt_or_criminality_score)
        forbidden = ("guilty", "criminal", "suspect", "dangerous", "risk score")
        self.assertFalse(
            any(token in first.neutral_label.lower() for token in forbidden)
        )
        self.assertIn("uncalibrated", " ".join(first.limitations).lower())

    def test_recorded_after_cutoff_is_not_available_even_if_observed_earlier(self) -> None:
        late = evidence("late", days_old=4, recorded_offset_days=5)
        result = assess_priority(
            item(records=(late, evidence("known-a"), evidence("known-b")))
        )

        self.assertNotIn("late@v1", result.dependencies)
        self.assertIn("late@v1", result.excluded_dependencies)

    def test_config_limits_are_validated(self) -> None:
        with self.assertRaises(ValueError):
            BaselineConfig(missing_factor_penalty=1.1)
        with self.assertRaises(ValueError):
            BaselineConfig(uncertainty_margin=float("nan"))
        with self.assertRaises(ValueError):
            replace(BaselineConfig(), minimum_evidence_count=0)
        with self.assertRaises(ValueError):
            evidence("invalid", quality=float("nan"))


if __name__ == "__main__":
    unittest.main()
