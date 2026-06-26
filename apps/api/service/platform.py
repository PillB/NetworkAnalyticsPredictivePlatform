"""Projection-first application service over temporal and lineage interfaces."""

from __future__ import annotations

from dataclasses import fields, is_dataclass
from typing import Any, Callable, Iterable, Mapping, Sequence

from apps.api.contracts import (
    AuthorizationContext,
    AuthorizedTemporalProjection,
    CaseManifest,
    ComparisonResult,
    LineageResult,
    ReportDraft,
)
from apps.api.contracts._json import json_value, stable_digest
from apps.api.temporal import HistoricalQuery, TemporalWindowQuery

from .errors import AuthorizationDenied, InvalidServiceRequest


DEFAULT_PROJECTION_FIELDS = (
    "analytical_confidence",
    "assertion_class",
    "assertion_id",
    "case_id",
    "event_at",
    "event_precision",
    "handling_label",
    "object_value",
    "predicate",
    "revision_id",
    "status",
    "subject_ref",
    "valid_during",
)
MANDATORY_PROJECTION_FIELDS = (
    "assertion_id",
    "case_id",
    "handling_label",
    "revision_id",
)


def _contract_payload(value: Any) -> Any:
    if is_dataclass(value):
        return {
            item.name: _contract_payload(getattr(value, item.name))
            for item in fields(value)
        }
    return json_value(value)


def _lineage_payload(result: Any) -> Mapping[str, Any]:
    payload = _contract_payload(result)
    if not isinstance(payload, Mapping):
        raise InvalidServiceRequest("lineage engine returned an unsupported result")
    return payload


class AnalysisService:
    """Coordinates authorization, immutable projection, analysis, and reporting."""

    def __init__(
        self,
        temporal_repository: Any,
        lineage_builder: Callable[..., Any],
        *,
        lineage_algorithm: str = "community-lineage",
        lineage_algorithm_version: str = "v1",
    ) -> None:
        self._repository = temporal_repository
        self._lineage_builder = lineage_builder
        self._lineage_algorithm = lineage_algorithm
        self._lineage_algorithm_version = lineage_algorithm_version
        self._projection_cache: dict[str, AuthorizedTemporalProjection] = {}

    @staticmethod
    def _authorize_request(
        manifest: CaseManifest,
        authorization: AuthorizationContext,
        query: HistoricalQuery | TemporalWindowQuery,
    ) -> None:
        if not authorization.purpose:
            raise AuthorizationDenied(
                "A permissible purpose is required.",
                code="purpose_required",
            )
        if (
            authorization.case_id != manifest.case_id
            or query.case_id != manifest.case_id
        ):
            raise AuthorizationDenied(
                "The authorization context does not match the requested case.",
                code="case_scope_denied",
            )
        if authorization.purpose not in manifest.permissible_purposes:
            raise AuthorizationDenied(
                "The requested purpose is not permitted for this case.",
                code="purpose_denied",
            )
        if authorization.policy_version != manifest.handling_policy_version:
            raise AuthorizationDenied(
                "The authorization policy is stale for this case.",
                code="policy_version_mismatch",
            )

    @staticmethod
    def _cache_key(
        manifest: CaseManifest,
        authorization: AuthorizationContext,
        query: HistoricalQuery | TemporalWindowQuery,
        requested_fields: tuple[str, ...],
    ) -> str:
        return stable_digest(
            {
                "contract": "AuthorizedTemporalProjectionCacheKeyV1",
                "manifest_digest": manifest.digest,
                "authorization_digest": authorization.digest,
                "policy_version": authorization.policy_version,
                "query": query.to_dict(),
                "requested_fields": requested_fields,
                "source_high_water_marks": manifest.source_high_water_marks,
                "projection_recipe_version": manifest.projection_recipe_version,
            }
        )

    def project(
        self,
        manifest: CaseManifest,
        authorization: AuthorizationContext,
        query: HistoricalQuery,
        *,
        requested_fields: Iterable[str] = DEFAULT_PROJECTION_FIELDS,
    ) -> AuthorizedTemporalProjection:
        """Authorize first, then build and cache an immutable temporal projection."""

        self._authorize_request(manifest, authorization, query)
        return self._project(
            manifest,
            authorization,
            query,
            lambda: self._repository.snapshot(query),
            requested_fields=requested_fields,
        )

    def project_window(
        self,
        manifest: CaseManifest,
        authorization: AuthorizationContext,
        query: TemporalWindowQuery,
        *,
        requested_fields: Iterable[str] = DEFAULT_PROJECTION_FIELDS,
    ) -> AuthorizedTemporalProjection:
        """Authorize first, then project every assertion overlapping a valid window."""

        self._authorize_request(manifest, authorization, query)
        return self._project(
            manifest,
            authorization,
            query,
            lambda: self._repository.window_snapshot(query),
            requested_fields=requested_fields,
        )

    def _project(
        self,
        manifest: CaseManifest,
        authorization: AuthorizationContext,
        query: HistoricalQuery | TemporalWindowQuery,
        snapshot_builder: Callable[[], Any],
        *,
        requested_fields: Iterable[str],
    ) -> AuthorizedTemporalProjection:
        self._authorize_request(manifest, authorization, query)
        selected_fields = tuple(sorted(set(requested_fields)))
        missing = sorted(set(MANDATORY_PROJECTION_FIELDS) - set(selected_fields))
        if missing:
            raise InvalidServiceRequest(
                "Projection omits mandatory fields.",
                details={"missing_fields": missing},
            )
        cache_key = self._cache_key(
            manifest, authorization, query, selected_fields
        )
        cached = self._projection_cache.get(cache_key)
        if cached is not None:
            return cached

        snapshot = snapshot_builder()
        allowed_labels = set(authorization.allowed_handling_labels)
        allowed_fields = set(authorization.allowed_fields)
        assertions: list[Mapping[str, Any]] = []
        revision_ids: list[str] = []
        labels: set[str] = set()
        excluded = 0

        for revision in snapshot.dependencies:
            restrictions = set(revision.field_restrictions)
            if revision.handling_label not in allowed_labels or not restrictions.issubset(
                allowed_fields
            ):
                excluded += 1
                continue
            serialized = revision.to_dict(include_source="source" in selected_fields)
            projected = {
                name: serialized[name]
                for name in selected_fields
                if name in serialized
            }
            assertions.append(projected)
            revision_ids.append(revision.revision_id)
            labels.add(revision.handling_label)

        ordered = sorted(assertions, key=lambda item: str(item["revision_id"]))
        revision_ids_tuple = tuple(sorted(revision_ids))
        identity_payload = {
            "cache_key": cache_key,
            "assertion_revision_ids": revision_ids_tuple,
            "assertions": ordered,
        }
        projection = AuthorizedTemporalProjection(
            projection_id=f"projection-{stable_digest(identity_payload)}",
            cache_key=cache_key,
            case_id=manifest.case_id,
            authorization_digest=authorization.digest,
            policy_version=authorization.policy_version,
            query=query.to_dict(),
            requested_fields=selected_fields,
            assertions=tuple(ordered),
            assertion_revision_ids=revision_ids_tuple,
            inherited_handling_labels=tuple(sorted(labels)),
            excluded_revision_count=excluded,
            manifest_digest=manifest.digest,
        )
        self._projection_cache[cache_key] = projection
        return projection

    @staticmethod
    def compare(
        before: AuthorizedTemporalProjection,
        after: AuthorizedTemporalProjection,
    ) -> ComparisonResult:
        if (
            before.case_id != after.case_id
            or before.authorization_digest != after.authorization_digest
            or before.policy_version != after.policy_version
        ):
            raise AuthorizationDenied(
                "Temporal projections cannot be compared across authorization contexts.",
                code="comparison_context_mismatch",
            )

        before_by_assertion = {
            str(item["assertion_id"]): item for item in before.assertions
        }
        after_by_assertion = {
            str(item["assertion_id"]): item for item in after.assertions
        }
        changed = []
        for assertion_id in sorted(before_by_assertion.keys() & after_by_assertion.keys()):
            left = before_by_assertion[assertion_id]
            right = after_by_assertion[assertion_id]
            if left.get("revision_id") != right.get("revision_id"):
                changed.append(
                    {
                        "assertion_id": assertion_id,
                        "before_revision_id": left.get("revision_id"),
                        "after_revision_id": right.get("revision_id"),
                    }
                )

        before_ids = set(before.assertion_revision_ids)
        after_ids = set(after.assertion_revision_ids)
        payload = {
            "before_projection_id": before.projection_id,
            "after_projection_id": after.projection_id,
            "changed_assertions": changed,
        }
        return ComparisonResult(
            comparison_id=f"comparison-{stable_digest(payload)}",
            before_projection_id=before.projection_id,
            after_projection_id=after.projection_id,
            authorization_digest=before.authorization_digest,
            added_revision_ids=tuple(sorted(after_ids - before_ids)),
            removed_revision_ids=tuple(sorted(before_ids - after_ids)),
            unchanged_revision_ids=tuple(sorted(before_ids & after_ids)),
            changed_assertions=tuple(changed),
            dependency_projection_ids=(before.projection_id, after.projection_id),
            assertion_revision_ids=tuple(sorted(before_ids | after_ids)),
            inherited_handling_labels=tuple(
                sorted(
                    set(before.inherited_handling_labels)
                    | set(after.inherited_handling_labels)
                )
            ),
        )

    def build_lineage(
        self,
        projection: AuthorizedTemporalProjection,
        snapshots: Sequence[Any],
        *,
        config: Any = None,
    ) -> LineageResult:
        """Run lineage only after an authorized projection exists."""

        if not projection.authorization_digest:
            raise AuthorizationDenied(
                "Lineage requires an authorized projection.",
                code="projection_authorization_required",
            )
        authorized_members = {
            value
            for assertion in projection.assertions
            for value in (
                assertion.get("subject_ref"),
                assertion.get("object_value"),
            )
            if isinstance(value, str)
        }
        unknown_members = sorted(
            {
                member
                for snapshot in snapshots
                for community in getattr(snapshot, "communities", ())
                for member in getattr(community, "members", ())
                if member not in authorized_members
            },
            key=str,
        )
        if unknown_members:
            raise InvalidServiceRequest(
                "Lineage input contains members outside the authorized projection.",
                code="lineage_projection_mismatch",
                details={"unknown_members": unknown_members},
            )
        result = (
            self._lineage_builder(snapshots)
            if config is None
            else self._lineage_builder(snapshots, config)
        )
        result_payload = _lineage_payload(result)
        identity_payload = {
            "projection_id": projection.projection_id,
            "algorithm": self._lineage_algorithm,
            "algorithm_version": self._lineage_algorithm_version,
            "result": result_payload,
        }
        return LineageResult(
            lineage_result_id=f"lineage-{stable_digest(identity_payload)}",
            projection_id=projection.projection_id,
            authorization_digest=projection.authorization_digest,
            algorithm=self._lineage_algorithm,
            algorithm_version=self._lineage_algorithm_version,
            result=result_payload,
            assertion_revision_ids=projection.assertion_revision_ids,
            inherited_handling_labels=projection.inherited_handling_labels,
        )

    @staticmethod
    def draft_report(
        projection: AuthorizedTemporalProjection,
        *,
        title: str,
        question: str,
        assessment: str,
        contrary_evidence: str,
        limitations: str,
        analyst_notes: str = "",
        comparison: ComparisonResult | None = None,
        lineage: LineageResult | None = None,
    ) -> ReportDraft:
        """Create a draft whose exact immutable dependencies are embedded."""

        for artifact in (comparison, lineage):
            if (
                artifact is not None
                and artifact.authorization_digest != projection.authorization_digest
            ):
                raise AuthorizationDenied(
                    "Report dependencies cross authorization contexts.",
                    code="report_context_mismatch",
                )
        if comparison is not None and projection.projection_id not in (
            comparison.dependency_projection_ids
        ):
            raise InvalidServiceRequest(
                "Comparison is not derived from the report projection.",
                code="report_dependency_mismatch",
            )
        if lineage is not None and lineage.projection_id != projection.projection_id:
            raise InvalidServiceRequest(
                "Lineage is not derived from the report projection.",
                code="report_dependency_mismatch",
            )

        revision_ids = set(projection.assertion_revision_ids)
        labels = set(projection.inherited_handling_labels)
        comparison_ids: tuple[str, ...] = ()
        lineage_ids: tuple[str, ...] = ()
        if comparison is not None:
            comparison_ids = (comparison.comparison_id,)
            revision_ids.update(comparison.assertion_revision_ids)
            labels.update(comparison.inherited_handling_labels)
        if lineage is not None:
            lineage_ids = (lineage.lineage_result_id,)
            revision_ids.update(lineage.assertion_revision_ids)
            labels.update(lineage.inherited_handling_labels)

        projection_ids = {projection.projection_id}
        if comparison is not None:
            projection_ids.update(comparison.dependency_projection_ids)
        ordered_projection_ids = tuple(sorted(projection_ids))
        provenance = {
            "projection_ids": list(ordered_projection_ids),
            "comparison_ids": list(comparison_ids),
            "lineage_result_ids": list(lineage_ids),
            "assertion_revision_ids": sorted(revision_ids),
            "authorization_digest": projection.authorization_digest,
        }
        identity_payload = {
            "case_id": projection.case_id,
            "title": title,
            "question": question,
            "assessment": assessment,
            "provenance": provenance,
        }
        return ReportDraft(
            report_id=f"report-{stable_digest(identity_payload)}",
            case_id=projection.case_id,
            authorization_digest=projection.authorization_digest,
            title=title,
            question=question,
            assessment=assessment,
            contrary_evidence=contrary_evidence,
            limitations=limitations,
            analyst_notes=analyst_notes,
            projection_ids=ordered_projection_ids,
            comparison_ids=comparison_ids,
            lineage_result_ids=lineage_ids,
            assertion_revision_ids=tuple(sorted(revision_ids)),
            inherited_handling_labels=tuple(sorted(labels)),
            provenance=provenance,
        )
