from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
import math
from types import MappingProxyType
from typing import Mapping


FACTOR_NAMES = ("quality", "recency", "corroboration", "change", "coverage")


def _empty_mapping() -> Mapping[str, object]:
    return MappingProxyType({})


def _require_aware(value: datetime, name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{name} must be timezone-aware")


@dataclass(frozen=True)
class EvidenceRecord:
    """A versioned, immutable evidence input known at a particular time."""

    record_id: str
    version: int
    observed_at: datetime
    recorded_at: datetime
    quality: float | None
    corroboration: float | None
    change: float | None
    coverage: float | None
    corroborates: tuple[str, ...] = ()
    attributes: Mapping[str, object] = field(default_factory=_empty_mapping)

    def __post_init__(self) -> None:
        if not self.record_id.strip():
            raise ValueError("record_id must not be empty")
        if self.version < 1:
            raise ValueError("version must be at least 1")
        _require_aware(self.observed_at, "observed_at")
        _require_aware(self.recorded_at, "recorded_at")
        if self.recorded_at < self.observed_at:
            raise ValueError("recorded_at cannot precede observed_at")
        for name in ("quality", "corroboration", "change", "coverage"):
            value = getattr(self, name)
            if value is not None and (
                not math.isfinite(value) or not 0.0 <= value <= 1.0
            ):
                raise ValueError(f"{name} must be in [0, 1] or None")
        if len(set(self.corroborates)) != len(self.corroborates):
            raise ValueError("corroborates must not contain duplicates")
        object.__setattr__(self, "corroborates", tuple(sorted(self.corroborates)))
        object.__setattr__(self, "attributes", MappingProxyType(dict(self.attributes)))

    @property
    def dependency_id(self) -> str:
        return f"{self.record_id}@v{self.version}"


@dataclass(frozen=True)
class PriorityItem:
    """A neutral review item; it must not represent guilt or criminality."""

    item_id: str
    snapshot_id: str
    snapshot_version: int
    as_of: datetime
    evidence: tuple[EvidenceRecord, ...]
    attributes: Mapping[str, object] = field(default_factory=_empty_mapping)

    def __post_init__(self) -> None:
        if not self.item_id.strip() or not self.snapshot_id.strip():
            raise ValueError("item_id and snapshot_id must not be empty")
        if self.snapshot_version < 1:
            raise ValueError("snapshot_version must be at least 1")
        _require_aware(self.as_of, "as_of")
        object.__setattr__(self, "evidence", tuple(self.evidence))
        object.__setattr__(self, "attributes", MappingProxyType(dict(self.attributes)))

    @property
    def input_version_id(self) -> str:
        return f"{self.snapshot_id}@v{self.snapshot_version}"


@dataclass(frozen=True)
class BaselineConfig:
    baseline_version: str = "evidence-priority-baseline-v1"
    factor_weights: Mapping[str, float] = field(
        default_factory=lambda: MappingProxyType(
            {
                "quality": 0.30,
                "recency": 0.20,
                "corroboration": 0.20,
                "change": 0.15,
                "coverage": 0.15,
            }
        )
    )
    recency_half_life_days: float = 90.0
    missing_factor_penalty: float = 0.04
    uncertainty_margin: float = 0.10
    minimum_evidence_count: int = 2
    minimum_observed_factor_fraction: float = 0.60

    def __post_init__(self) -> None:
        weights = dict(self.factor_weights)
        if not self.baseline_version.strip():
            raise ValueError("baseline_version must not be empty")
        if set(weights) != set(FACTOR_NAMES):
            raise ValueError(f"factor_weights must contain exactly {FACTOR_NAMES}")
        if any(
            not math.isfinite(value) or value < 0.0 or value > 1.0
            for value in weights.values()
        ):
            raise ValueError("factor weights must be in [0, 1]")
        if abs(sum(weights.values()) - 1.0) > 1e-12:
            raise ValueError("factor weights must sum to 1")
        if (
            not math.isfinite(self.recency_half_life_days)
            or self.recency_half_life_days <= 0
        ):
            raise ValueError("recency_half_life_days must be positive")
        if not math.isfinite(self.missing_factor_penalty) or not (
            0.0 <= self.missing_factor_penalty <= 1.0
        ):
            raise ValueError("missing_factor_penalty must be in [0, 1]")
        if not math.isfinite(self.uncertainty_margin) or not (
            0.0 <= self.uncertainty_margin <= 1.0
        ):
            raise ValueError("uncertainty_margin must be in [0, 1]")
        if self.minimum_evidence_count < 1:
            raise ValueError("minimum_evidence_count must be positive")
        if not math.isfinite(self.minimum_observed_factor_fraction) or not (
            0.0 <= self.minimum_observed_factor_fraction <= 1.0
        ):
            raise ValueError("minimum_observed_factor_fraction must be in [0, 1]")
        object.__setattr__(self, "factor_weights", MappingProxyType(weights))


@dataclass(frozen=True)
class FactorContribution:
    factor: str
    normalized_value: float | None
    weighted_points: float
    lower_points: float
    upper_points: float
    missing_penalty_points: float


@dataclass(frozen=True)
class EvidenceContribution:
    dependency_id: str
    factors: tuple[FactorContribution, ...]
    points: float
    lower_points: float
    upper_points: float


@dataclass(frozen=True)
class RemovalSensitivity:
    removed_dependency_id: str
    resulting_status: str
    resulting_index: float | None
    index_change: float | None


@dataclass(frozen=True)
class PriorityAssessment:
    item_id: str
    input_version_id: str
    baseline_version: str
    as_of: datetime
    status: str
    neutral_label: str
    evidence_priority_index: float | None
    uncertainty_interval: tuple[float, float] | None
    dependencies: tuple[str, ...]
    excluded_dependencies: tuple[str, ...]
    contributions: tuple[EvidenceContribution, ...]
    missingness_penalty_points: float
    abstention_reasons: tuple[str, ...]
    removal_sensitivity: tuple[RemovalSensitivity, ...]
    limitations: tuple[str, ...]
    is_guilt_or_criminality_score: bool = False


@dataclass(frozen=True)
class RankedAssessment:
    rank: int | None
    tie_size: int
    assessment: PriorityAssessment


UTC = timezone.utc
