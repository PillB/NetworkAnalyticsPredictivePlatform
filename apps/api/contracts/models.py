"""Dependency-light immutable service and transport contracts."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Mapping

from ._json import canonical_json, freeze_mapping, json_value, stable_digest


def _sorted_unique(values: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(sorted(set(values)))


@dataclass(frozen=True)
class AuthorizationContext:
    actor_id: str
    case_id: str
    purpose: str
    authorization_id: str
    allowed_handling_labels: tuple[str, ...]
    allowed_fields: tuple[str, ...] = ()
    policy_version: str = "policy-v1"
    attributes: Mapping[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        for name in ("actor_id", "case_id", "authorization_id"):
            if not getattr(self, name):
                raise ValueError(f"{name} is required")
        object.__setattr__(
            self,
            "allowed_handling_labels",
            _sorted_unique(self.allowed_handling_labels),
        )
        object.__setattr__(self, "allowed_fields", _sorted_unique(self.allowed_fields))
        object.__setattr__(self, "attributes", freeze_mapping(self.attributes))

    @property
    def digest(self) -> str:
        return stable_digest(self.to_dict(include_digest=False))

    def to_dict(self, *, include_digest: bool = True) -> dict[str, Any]:
        result = {
            "contract": "AuthorizationContextV1",
            "actor_id": self.actor_id,
            "case_id": self.case_id,
            "purpose": self.purpose,
            "authorization_id": self.authorization_id,
            "allowed_handling_labels": list(self.allowed_handling_labels),
            "allowed_fields": list(self.allowed_fields),
            "policy_version": self.policy_version,
            "attributes": json_value(self.attributes),
        }
        if include_digest:
            result["authorization_digest"] = self.digest
        return result


@dataclass(frozen=True)
class CaseManifest:
    case_id: str
    jurisdiction: str
    owner: str
    permissible_purposes: tuple[str, ...]
    handling_policy_version: str
    source_high_water_marks: Mapping[str, str] = field(default_factory=dict)
    projection_recipe_version: str = "projection-v1"

    def __post_init__(self) -> None:
        if not self.case_id:
            raise ValueError("case_id is required")
        object.__setattr__(
            self, "permissible_purposes", _sorted_unique(self.permissible_purposes)
        )
        object.__setattr__(
            self,
            "source_high_water_marks",
            freeze_mapping(self.source_high_water_marks),
        )

    @property
    def digest(self) -> str:
        return stable_digest(self.to_dict(include_digest=False))

    def to_dict(self, *, include_digest: bool = True) -> dict[str, Any]:
        result = {
            "contract": "CaseManifestV1",
            "case_id": self.case_id,
            "jurisdiction": self.jurisdiction,
            "owner": self.owner,
            "permissible_purposes": list(self.permissible_purposes),
            "handling_policy_version": self.handling_policy_version,
            "source_high_water_marks": json_value(self.source_high_water_marks),
            "projection_recipe_version": self.projection_recipe_version,
        }
        if include_digest:
            result["manifest_digest"] = self.digest
        return result


@dataclass(frozen=True)
class AuthorizedTemporalProjection:
    projection_id: str
    cache_key: str
    case_id: str
    authorization_digest: str
    policy_version: str
    query: Mapping[str, Any]
    requested_fields: tuple[str, ...]
    assertions: tuple[Mapping[str, Any], ...]
    assertion_revision_ids: tuple[str, ...]
    inherited_handling_labels: tuple[str, ...]
    excluded_revision_count: int
    manifest_digest: str

    def __post_init__(self) -> None:
        object.__setattr__(self, "query", freeze_mapping(self.query))
        object.__setattr__(
            self,
            "assertions",
            tuple(freeze_mapping(assertion) for assertion in self.assertions),
        )
        object.__setattr__(self, "requested_fields", tuple(self.requested_fields))
        object.__setattr__(
            self, "assertion_revision_ids", tuple(self.assertion_revision_ids)
        )
        object.__setattr__(
            self,
            "inherited_handling_labels",
            _sorted_unique(self.inherited_handling_labels),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "AuthorizedTemporalProjectionV1",
            "projection_id": self.projection_id,
            "cache_key": self.cache_key,
            "case_id": self.case_id,
            "authorization_digest": self.authorization_digest,
            "policy_version": self.policy_version,
            "query": json_value(self.query),
            "requested_fields": list(self.requested_fields),
            "assertion_revision_ids": list(self.assertion_revision_ids),
            "assertions": json_value(self.assertions),
            "inherited_handling_labels": list(self.inherited_handling_labels),
            "excluded_revision_count": self.excluded_revision_count,
            "manifest_digest": self.manifest_digest,
        }


@dataclass(frozen=True)
class ComparisonResult:
    comparison_id: str
    before_projection_id: str
    after_projection_id: str
    authorization_digest: str
    added_revision_ids: tuple[str, ...]
    removed_revision_ids: tuple[str, ...]
    unchanged_revision_ids: tuple[str, ...]
    changed_assertions: tuple[Mapping[str, Any], ...]
    dependency_projection_ids: tuple[str, ...]
    assertion_revision_ids: tuple[str, ...]
    inherited_handling_labels: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(
            self,
            "changed_assertions",
            tuple(freeze_mapping(item) for item in self.changed_assertions),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "ComparisonResultV1",
            "comparison_id": self.comparison_id,
            "before_projection_id": self.before_projection_id,
            "after_projection_id": self.after_projection_id,
            "authorization_digest": self.authorization_digest,
            "added_revision_ids": list(self.added_revision_ids),
            "removed_revision_ids": list(self.removed_revision_ids),
            "unchanged_revision_ids": list(self.unchanged_revision_ids),
            "changed_assertions": json_value(self.changed_assertions),
            "dependency_projection_ids": list(self.dependency_projection_ids),
            "assertion_revision_ids": list(self.assertion_revision_ids),
            "inherited_handling_labels": list(self.inherited_handling_labels),
        }


@dataclass(frozen=True)
class LineageResult:
    lineage_result_id: str
    projection_id: str
    authorization_digest: str
    algorithm: str
    algorithm_version: str
    result: Mapping[str, Any]
    assertion_revision_ids: tuple[str, ...]
    inherited_handling_labels: tuple[str, ...]

    def __post_init__(self) -> None:
        object.__setattr__(self, "result", freeze_mapping(self.result))

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "LineageResultV1",
            "lineage_result_id": self.lineage_result_id,
            "projection_id": self.projection_id,
            "authorization_digest": self.authorization_digest,
            "algorithm": self.algorithm,
            "algorithm_version": self.algorithm_version,
            "result": json_value(self.result),
            "assertion_revision_ids": list(self.assertion_revision_ids),
            "inherited_handling_labels": list(self.inherited_handling_labels),
        }


@dataclass(frozen=True)
class ReportDraft:
    report_id: str
    case_id: str
    authorization_digest: str
    title: str
    question: str
    assessment: str
    contrary_evidence: str
    limitations: str
    analyst_notes: str
    projection_ids: tuple[str, ...]
    comparison_ids: tuple[str, ...]
    lineage_result_ids: tuple[str, ...]
    assertion_revision_ids: tuple[str, ...]
    inherited_handling_labels: tuple[str, ...]
    provenance: Mapping[str, Any]

    def __post_init__(self) -> None:
        object.__setattr__(self, "provenance", freeze_mapping(self.provenance))

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "ReportDraftV1",
            "report_id": self.report_id,
            "case_id": self.case_id,
            "authorization_digest": self.authorization_digest,
            "status": "draft",
            "title": self.title,
            "question": self.question,
            "assessment": self.assessment,
            "contrary_evidence": self.contrary_evidence,
            "limitations": self.limitations,
            "analyst_notes": self.analyst_notes,
            "projection_ids": list(self.projection_ids),
            "comparison_ids": list(self.comparison_ids),
            "lineage_result_ids": list(self.lineage_result_ids),
            "assertion_revision_ids": list(self.assertion_revision_ids),
            "inherited_handling_labels": list(self.inherited_handling_labels),
            "provenance": json_value(self.provenance),
        }


@dataclass(frozen=True)
class WorkbenchBootstrap:
    fixture_schema: str
    fixture_version: str
    case: Mapping[str, Any]
    authorization_digest: str
    guided_steps: tuple[Mapping[str, Any], ...]
    nodes: tuple[Mapping[str, Any], ...]
    relationships: tuple[Mapping[str, Any], ...]
    defaults: Mapping[str, Any]
    before_projection: Mapping[str, Any]
    after_projection: Mapping[str, Any]
    comparison: Mapping[str, Any]
    lineage: Mapping[str, Any]
    prioritization: tuple[Mapping[str, Any], ...]
    report: Mapping[str, Any]
    excluded_relationship_count: int = 0

    def __post_init__(self) -> None:
        object.__setattr__(self, "case", freeze_mapping(self.case))
        object.__setattr__(
            self,
            "guided_steps",
            tuple(freeze_mapping(item) for item in self.guided_steps),
        )
        object.__setattr__(
            self,
            "nodes",
            tuple(freeze_mapping(item) for item in self.nodes),
        )
        object.__setattr__(
            self,
            "relationships",
            tuple(freeze_mapping(item) for item in self.relationships),
        )
        object.__setattr__(self, "defaults", freeze_mapping(self.defaults))
        for name in (
            "before_projection",
            "after_projection",
            "comparison",
            "lineage",
            "report",
        ):
            object.__setattr__(self, name, freeze_mapping(getattr(self, name)))
        object.__setattr__(
            self,
            "prioritization",
            tuple(freeze_mapping(item) for item in self.prioritization),
        )

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "WorkbenchBootstrapV1",
            "fixture_schema": self.fixture_schema,
            "fixture_version": self.fixture_version,
            "case": json_value(self.case),
            "authorization_digest": self.authorization_digest,
            "guided_steps": json_value(self.guided_steps),
            "nodes": json_value(self.nodes),
            "relationships": json_value(self.relationships),
            "defaults": json_value(self.defaults),
            "before_projection": json_value(self.before_projection),
            "after_projection": json_value(self.after_projection),
            "comparison": json_value(self.comparison),
            "lineage": json_value(self.lineage),
            "prioritization": json_value(self.prioritization),
            "report": json_value(self.report),
            "excluded_relationship_count": self.excluded_relationship_count,
        }


@dataclass(frozen=True)
class StructuredError:
    code: str
    message: str
    status: int
    retryable: bool = False
    details: Mapping[str, Any] = field(default_factory=dict)
    recovery: tuple[str, ...] = ()

    def __post_init__(self) -> None:
        object.__setattr__(self, "details", freeze_mapping(self.details))

    def to_dict(self) -> dict[str, Any]:
        return {
            "contract": "StructuredErrorV1",
            "error": {
                "code": self.code,
                "message": self.message,
                "status": self.status,
                "retryable": self.retryable,
                "details": json_value(self.details),
                "recovery": list(self.recovery),
            },
        }


def deterministic_json(contract: Any) -> str:
    """Return the canonical JSON representation of any service contract."""

    return canonical_json(contract)
