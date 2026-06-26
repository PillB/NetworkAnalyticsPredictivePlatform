from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
import math
from typing import Iterable

from .model import PriorityAssessment


@dataclass(frozen=True)
class FutureOutcome:
    item_id: str
    label: float
    observed_at: datetime
    label_definition_version: str

    def __post_init__(self) -> None:
        if not math.isfinite(self.label) or not 0.0 <= self.label <= 1.0:
            raise ValueError("label must be in [0, 1]")
        if self.observed_at.tzinfo is None or self.observed_at.utcoffset() is None:
            raise ValueError("observed_at must be timezone-aware")
        if not self.label_definition_version.strip():
            raise ValueError("label_definition_version must not be empty")


@dataclass(frozen=True)
class EvaluationRow:
    item_id: str
    baseline_version: str
    input_version_id: str
    prediction_as_of: datetime
    uncalibrated_index: float
    future_label: float
    label_observed_at: datetime
    label_definition_version: str


@dataclass(frozen=True)
class EmpiricalBin:
    lower_index: float
    upper_index: float
    count: int
    mean_uncalibrated_index: float
    mean_future_label: float
    calibrated: bool = False


def prepare_evaluation_rows(
    assessments: Iterable[PriorityAssessment],
    outcomes: Iterable[FutureOutcome],
) -> tuple[EvaluationRow, ...]:
    """Align ordered outputs to later labels without asserting calibration."""

    outcome_by_item: dict[str, FutureOutcome] = {}
    for outcome in outcomes:
        if outcome.item_id in outcome_by_item:
            raise ValueError(f"duplicate future outcome for {outcome.item_id}")
        outcome_by_item[outcome.item_id] = outcome
    rows = []
    for assessment in assessments:
        outcome = outcome_by_item.get(assessment.item_id)
        if assessment.status != "ordered" or outcome is None:
            continue
        if outcome.observed_at <= assessment.as_of:
            raise ValueError(
                f"future label for {assessment.item_id} must be observed after prediction"
            )
        assert assessment.evidence_priority_index is not None
        rows.append(
            EvaluationRow(
                item_id=assessment.item_id,
                baseline_version=assessment.baseline_version,
                input_version_id=assessment.input_version_id,
                prediction_as_of=assessment.as_of,
                uncalibrated_index=assessment.evidence_priority_index,
                future_label=outcome.label,
                label_observed_at=outcome.observed_at,
                label_definition_version=outcome.label_definition_version,
            )
        )
    return tuple(sorted(rows, key=lambda row: (row.prediction_as_of, row.item_id)))


def empirical_bins(
    rows: Iterable[EvaluationRow], *, bin_count: int = 10
) -> tuple[EmpiricalBin, ...]:
    """Summarize future labels by fixed index bins; this does not calibrate."""

    if bin_count < 1:
        raise ValueError("bin_count must be positive")
    buckets: list[list[EvaluationRow]] = [[] for _ in range(bin_count)]
    for row in rows:
        index = min(100.0, max(0.0, row.uncalibrated_index))
        bucket = min(bin_count - 1, int(index / (100.0 / bin_count)))
        buckets[bucket].append(row)
    result = []
    width = 100.0 / bin_count
    for index, bucket in enumerate(buckets):
        if not bucket:
            continue
        result.append(
            EmpiricalBin(
                lower_index=round(index * width, 6),
                upper_index=round((index + 1) * width, 6),
                count=len(bucket),
                mean_uncalibrated_index=round(
                    sum(row.uncalibrated_index for row in bucket) / len(bucket), 6
                ),
                mean_future_label=round(
                    sum(row.future_label for row in bucket) / len(bucket), 6
                ),
            )
        )
    return tuple(result)
