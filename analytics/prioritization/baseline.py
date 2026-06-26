from __future__ import annotations

import math
import re
from dataclasses import replace
from typing import Iterable, Mapping

from .model import (
    FACTOR_NAMES,
    BaselineConfig,
    EvidenceContribution,
    EvidenceRecord,
    FactorContribution,
    PriorityAssessment,
    PriorityItem,
    RankedAssessment,
    RemovalSensitivity,
)


_PROTECTED_TOKENS = {
    "age",
    "birthdate",
    "citizenship",
    "color",
    "disability",
    "ethnicity",
    "familial_status",
    "gender",
    "gender_identity",
    "genetic_information",
    "marital_status",
    "national_origin",
    "pregnancy",
    "race",
    "religion",
    "sex",
    "sexual_orientation",
    "veteran_status",
}
_PROTECTED_ALIASES = {
    "date_of_birth",
    "dob",
    "native_language",
    "place_of_birth",
}
_LIMITATIONS = (
    "This is an uncalibrated evidence-review ordering baseline.",
    "It does not estimate guilt, criminality, dangerousness, or future conduct.",
    "The index is only comparable for inputs produced under the same baseline version.",
)


def _round(value: float) -> float:
    return round(min(100.0, max(0.0, value)), 6)


def _round_signed(value: float) -> float:
    return round(min(100.0, max(-100.0, value)), 6)


def _normalized_key(key: object) -> str:
    text = re.sub(r"[^a-z0-9]+", "_", str(key).strip().lower()).strip("_")
    return text


def _reject_protected_attributes(value: object, path: str = "attributes") -> None:
    if isinstance(value, Mapping):
        for key, nested in value.items():
            normalized = _normalized_key(key)
            if normalized in _PROTECTED_TOKENS or normalized in _PROTECTED_ALIASES:
                raise ValueError(f"protected attribute prohibited at {path}.{key}")
            _reject_protected_attributes(nested, f"{path}.{key}")
    elif isinstance(value, (list, tuple)):
        for index, nested in enumerate(value):
            _reject_protected_attributes(nested, f"{path}[{index}]")


def _select_known_revisions(
    item: PriorityItem,
) -> tuple[tuple[EvidenceRecord, ...], tuple[str, ...]]:
    selected: dict[str, EvidenceRecord] = {}
    excluded: list[str] = []
    seen_dependencies: set[str] = set()
    for record in item.evidence:
        if record.dependency_id in seen_dependencies:
            raise ValueError(f"duplicate evidence dependency: {record.dependency_id}")
        seen_dependencies.add(record.dependency_id)
        _reject_protected_attributes(record.attributes, f"evidence.{record.dependency_id}")
        if record.observed_at > item.as_of or record.recorded_at > item.as_of:
            excluded.append(record.dependency_id)
            continue
        current = selected.get(record.record_id)
        if current is None or record.version > current.version:
            if current is not None:
                excluded.append(current.dependency_id)
            selected[record.record_id] = record
        else:
            excluded.append(record.dependency_id)
    return (
        tuple(sorted(selected.values(), key=lambda record: record.dependency_id)),
        tuple(sorted(excluded)),
    )


def _recency(record: EvidenceRecord, item: PriorityItem, config: BaselineConfig) -> float:
    age_days = (item.as_of - record.observed_at).total_seconds() / 86400.0
    return 2.0 ** (-age_days / config.recency_half_life_days)


def _record_contribution(
    record: EvidenceRecord, item: PriorityItem, config: BaselineConfig
) -> EvidenceContribution:
    values = {
        "quality": record.quality,
        "recency": _recency(record, item, config),
        "corroboration": record.corroboration,
        "change": record.change,
        "coverage": record.coverage,
    }
    factors: list[FactorContribution] = []
    for factor in FACTOR_NAMES:
        value = values[factor]
        weight = config.factor_weights[factor]
        if value is None:
            penalty = config.missing_factor_penalty * weight * 100.0
            factors.append(
                FactorContribution(factor, None, 0.0, 0.0, 0.0, _round(penalty))
            )
            continue
        points = value * weight * 100.0
        lower = max(0.0, value - config.uncertainty_margin) * weight * 100.0
        upper = min(1.0, value + config.uncertainty_margin) * weight * 100.0
        factors.append(
            FactorContribution(
                factor,
                _round(value),
                _round(points),
                _round(lower),
                _round(upper),
                0.0,
            )
        )
    penalty = sum(factor.missing_penalty_points for factor in factors)
    return EvidenceContribution(
        dependency_id=record.dependency_id,
        factors=tuple(factors),
        points=_round(sum(factor.weighted_points for factor in factors) - penalty),
        lower_points=_round(sum(factor.lower_points for factor in factors) - penalty),
        upper_points=_round(sum(factor.upper_points for factor in factors) - penalty),
    )


def _abstention_reasons(
    records: tuple[EvidenceRecord, ...],
    contributions: tuple[EvidenceContribution, ...],
    config: BaselineConfig,
) -> tuple[str, ...]:
    reasons: list[str] = []
    if len(records) < config.minimum_evidence_count:
        reasons.append("minimum_evidence_not_met")
    observed = sum(
        factor.normalized_value is not None
        for contribution in contributions
        for factor in contribution.factors
    )
    possible = len(records) * len(FACTOR_NAMES)
    if possible == 0 or observed / possible < config.minimum_observed_factor_fraction:
        reasons.append("minimum_factor_coverage_not_met")
    return tuple(reasons)


def _validate_corroboration_links(records: tuple[EvidenceRecord, ...]) -> None:
    available = {record.dependency_id for record in records}
    for record in records:
        missing = sorted(set(record.corroborates) - available)
        if missing:
            raise ValueError(
                f"{record.dependency_id} has unavailable corroboration dependencies: "
                + ", ".join(missing)
            )


def _assess_core(
    item: PriorityItem, config: BaselineConfig, *, include_sensitivity: bool
) -> PriorityAssessment:
    _reject_protected_attributes(item.attributes, "item.attributes")
    records, excluded = _select_known_revisions(item)
    _validate_corroboration_links(records)
    contributions = tuple(
        _record_contribution(record, item, config) for record in records
    )
    reasons = _abstention_reasons(records, contributions, config)
    dependencies = tuple(record.dependency_id for record in records)
    penalty = _round(
        sum(
            factor.missing_penalty_points
            for contribution in contributions
            for factor in contribution.factors
        )
        / max(1, len(contributions))
    )
    if reasons:
        assessment = PriorityAssessment(
            item_id=item.item_id,
            input_version_id=item.input_version_id,
            baseline_version=config.baseline_version,
            as_of=item.as_of,
            status="abstained",
            neutral_label="insufficient evidence for review ordering",
            evidence_priority_index=None,
            uncertainty_interval=None,
            dependencies=dependencies,
            excluded_dependencies=excluded,
            contributions=contributions,
            missingness_penalty_points=penalty,
            abstention_reasons=reasons,
            removal_sensitivity=(),
            limitations=_LIMITATIONS,
        )
    else:
        count = len(contributions)
        index = _round(sum(value.points for value in contributions) / count)
        lower = _round(sum(value.lower_points for value in contributions) / count)
        upper = _round(sum(value.upper_points for value in contributions) / count)
        label = (
            "higher evidence review priority"
            if index >= 66.666667
            else "standard evidence review priority"
            if index >= 33.333333
            else "lower evidence review priority"
        )
        assessment = PriorityAssessment(
            item_id=item.item_id,
            input_version_id=item.input_version_id,
            baseline_version=config.baseline_version,
            as_of=item.as_of,
            status="ordered",
            neutral_label=label,
            evidence_priority_index=index,
            uncertainty_interval=(lower, upper),
            dependencies=dependencies,
            excluded_dependencies=excluded,
            contributions=contributions,
            missingness_penalty_points=penalty,
            abstention_reasons=(),
            removal_sensitivity=(),
            limitations=_LIMITATIONS,
        )
    if not include_sensitivity:
        return assessment
    sensitivities = []
    for dependency_id in dependencies:
        reduced = replace(
            item,
            evidence=tuple(
                record
                for record in item.evidence
                if record.dependency_id != dependency_id
            ),
        )
        result = _assess_core(reduced, config, include_sensitivity=False)
        change = (
            None
            if assessment.evidence_priority_index is None
            or result.evidence_priority_index is None
            else _round_signed(
                result.evidence_priority_index - assessment.evidence_priority_index
            )
        )
        sensitivities.append(
            RemovalSensitivity(
                removed_dependency_id=dependency_id,
                resulting_status=result.status,
                resulting_index=result.evidence_priority_index,
                index_change=change,
            )
        )
    return replace(assessment, removal_sensitivity=tuple(sensitivities))


def assess_priority(
    item: PriorityItem, config: BaselineConfig | None = None
) -> PriorityAssessment:
    """Assess evidence-review priority without estimating guilt or criminality."""

    return _assess_core(item, config or BaselineConfig(), include_sensitivity=True)


def rank_assessments(
    assessments: Iterable[PriorityAssessment],
) -> tuple[RankedAssessment, ...]:
    """Return deterministic competition ranks; tied indexes share a rank."""

    values = tuple(assessments)
    if len({value.item_id for value in values}) != len(values):
        raise ValueError("item_id must be unique when ranking")
    ordered = sorted(
        values,
        key=lambda value: (
            value.status != "ordered",
            -(
                value.evidence_priority_index
                if value.evidence_priority_index is not None
                else -math.inf
            ),
            value.item_id,
        ),
    )
    tie_counts: dict[tuple[str, float | None], int] = {}
    for value in ordered:
        key = (value.status, value.evidence_priority_index)
        tie_counts[key] = tie_counts.get(key, 0) + 1
    result: list[RankedAssessment] = []
    previous_key: tuple[str, float | None] | None = None
    current_rank: int | None = None
    ordered_position = 0
    for value in ordered:
        key = (value.status, value.evidence_priority_index)
        if value.status == "ordered":
            ordered_position += 1
            if key != previous_key:
                current_rank = ordered_position
            rank = current_rank
        else:
            rank = None
        result.append(RankedAssessment(rank, tie_counts[key], value))
        previous_key = key
    return tuple(result)
