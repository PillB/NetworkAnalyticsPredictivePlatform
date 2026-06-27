"""Build the authorized Harbor Lantern workbench bootstrap contract."""

from __future__ import annotations

from dataclasses import asdict
from datetime import datetime
from typing import Any

from analytics.lineage import CommunityInput, CommunitySnapshot, build_lineage
from analytics.prioritization import (
    EvidenceRecord,
    PriorityItem,
    assess_priority,
    rank_assessments,
)
from analytics.lineage.fixtures import harbor_lantern_split

from .contracts import (
    AuthorizationContext,
    CaseManifest,
    WorkbenchBootstrap,
)
from .contracts._json import json_value
from .fixture_loader import load_harbor_lantern_fixture
from .service import AnalysisService
from .temporal import TemporalInterval, TemporalWindowQuery
from .temporal.fixtures import harbor_lantern_repository


def _instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def harbor_lantern_manifest() -> CaseManifest:
    return CaseManifest(
        case_id="harbor-lantern",
        jurisdiction="training",
        owner="network-analytics-platform",
        permissible_purposes=("training", "analysis", "review"),
        handling_policy_version="policy-v1",
        source_high_water_marks={"canonical_fixture": "1.0.0"},
        projection_recipe_version="harbor-lantern-window-v1",
    )


def harbor_lantern_training_authorization(
    *,
    actor_id: str,
    purpose: str,
    authorization_id: str,
    allowed_fields: tuple[str, ...] = ("device_signature", "precise_location"),
) -> AuthorizationContext:
    return AuthorizationContext(
        actor_id=actor_id,
        case_id="harbor-lantern",
        purpose=purpose,
        authorization_id=authorization_id,
        allowed_handling_labels=("training",),
        allowed_fields=allowed_fields,
        policy_version="policy-v1",
        attributes={"synthetic_training": True},
    )


def build_harbor_lantern_workbench(
    authorization: AuthorizationContext,
    *,
    repository: Any | None = None,
) -> WorkbenchBootstrap:
    fixture = load_harbor_lantern_fixture()
    scope = fixture["case"]["scope"]
    service = AnalysisService(repository or harbor_lantern_repository(), build_lineage)
    manifest = harbor_lantern_manifest()

    def query(start_key: str, end_key: str) -> TemporalWindowQuery:
        return TemporalWindowQuery(
            valid_during=TemporalInterval(
                _instant(scope[start_key]),
                _instant(scope[end_key]),
            ),
            known_at=_instant(scope["knownAt"]),
            case_id=manifest.case_id,
        )

    before = service.project_window(
        manifest,
        authorization,
        query("beforeStart", "beforeEnd"),
    )
    after = service.project_window(
        manifest,
        authorization,
        query("afterStart", "afterEnd"),
    )
    comparison = service.compare(before, after)
    authorized_members = {
        value
        for assertion in after.assertions
        for value in (
            assertion.get("subject_ref"),
            assertion.get("object_value"),
        )
        if isinstance(value, str)
    }
    authorized_lineage_snapshots = tuple(
        CommunitySnapshot(
            snapshot.snapshot_id,
            tuple(
                CommunityInput(
                    community.label,
                    frozenset(community.members & authorized_members),
                    confidence=community.confidence,
                    metadata=community.metadata,
                )
                for community in snapshot.communities
                if community.members & authorized_members
            ),
            metadata=snapshot.metadata,
        )
        for snapshot in harbor_lantern_split()
    )
    lineage = service.build_lineage(after, authorized_lineage_snapshots)
    report = service.draft_report(
        after,
        title="Harbor Lantern · Guided analysis report",
        question=fixture["case"]["question"],
        assessment=(
            "The authorized evidence is consistent with a possible temporary "
            "split; this is a pattern, not a determination of wrongdoing."
        ),
        contrary_evidence=(
            "The disputed alias may join two people incorrectly, and a "
            "source-coverage gap may make gradual drift appear abrupt."
        ),
        limitations=(
            "Synthetic training data; missing observations are not negative evidence."
        ),
        comparison=comparison,
        lineage=lineage,
    )

    visible_revision_ids = set(before.assertion_revision_ids) | set(
        after.assertion_revision_ids
    )
    relationships = tuple(
        relationship
        for relationship in fixture["relationships"]
        if relationship["revisionId"] in visible_revision_ids
    )
    visible_node_ids = {
        node_id
        for relationship in relationships
        for node_id in (relationship["subject"], relationship["object"])
    }
    nodes = tuple(
        node for node in fixture["nodes"] if node["id"] in visible_node_ids
    )
    relationship_by_revision = {
        relationship["revisionId"]: relationship
        for relationship in relationships
    }
    node_label_by_id = {node["id"]: node["label"] for node in nodes}
    priority_labels: dict[str, str] = {}
    priority_item_types: dict[str, str] = {}

    def priority_record(relationship: Any) -> EvidenceRecord:
        return EvidenceRecord(
            record_id=relationship["revisionId"],
            version=1,
            observed_at=_instant(relationship["validStart"]),
            recorded_at=_instant(relationship["recordedStart"]),
            quality=float(relationship["confidenceValue"]),
            corroboration={
                "1 · confirmed": 0.9,
                "2 · probably true": 0.65,
                "3 · possibly true": 0.35,
            }.get(relationship["credibility"], 0.4),
            change={
                "appeared": 0.8,
                "no-longer-observed": 0.6,
                "uncertain": 0.5,
                "observed": 0.3,
            }[relationship["status"]],
            coverage=0.78,
            attributes={
                "evidence_class": relationship["evidenceClass"],
                "handling_label": relationship["handlingLabel"],
            },
        )

    priority_items = []
    for target in relationships:
        supporting = tuple(
            relationship
            for relationship in relationships
            if {
                target["subject"],
                target["object"],
            }
            & {
                relationship["subject"],
                relationship["object"],
            }
        )
        records = tuple(priority_record(relationship) for relationship in supporting)
        priority_labels[target["id"]] = (
            f"{node_label_by_id[target['subject']]} "
            f"{target['predicate']} "
            f"{node_label_by_id[target['object']]}"
        )
        priority_item_types[target["id"]] = "relationship_review"
        priority_items.append(
            PriorityItem(
                item_id=target["id"],
                snapshot_id=after.projection_id,
                snapshot_version=1,
                as_of=_instant(scope["knownAt"]),
                evidence=records,
                attributes={
                    "item_type": "relationship_review",
                    "relation": target["relation"],
                },
            )
        )
    gap_item_id = "coverage-gap-feb24-mar02"
    priority_labels[gap_item_id] = "February 24–March 2 source-coverage gap"
    priority_item_types[gap_item_id] = "evidence_gap"
    priority_items.append(
        PriorityItem(
            item_id=gap_item_id,
            snapshot_id=after.projection_id,
            snapshot_version=1,
            as_of=_instant(scope["knownAt"]),
            evidence=(priority_record(relationships[0]),),
            attributes={"item_type": "evidence_gap"},
        )
    )
    ranked = rank_assessments(
        assess_priority(item)
        for item in priority_items
    )
    prioritization = []
    for ranked_item in ranked:
        prioritization.append(
            {
                **json_value(asdict(ranked_item)),
                "display_label": priority_labels[ranked_item.assessment.item_id],
                "item_type": priority_item_types[ranked_item.assessment.item_id],
                "dependency_sources": [
                    relationship_by_revision[dependency.split("@v", 1)[0]][
                        "source"
                    ]
                    for dependency in ranked_item.assessment.dependencies
                ],
            }
        )

    return WorkbenchBootstrap(
        fixture_schema=fixture["schema"],
        fixture_version=fixture["fixtureVersion"],
        case=fixture["case"],
        authorization_digest=authorization.digest,
        guided_steps=tuple(fixture["guidedSteps"]),
        nodes=nodes,
        relationships=relationships,
        defaults=fixture["defaults"],
        before_projection=before.to_dict(),
        after_projection=after.to_dict(),
        comparison=comparison.to_dict(),
        lineage=lineage.to_dict(),
        prioritization=tuple(prioritization),
        report=report.to_dict(),
        excluded_relationship_count=(
            len(fixture["relationships"]) - len(relationships)
        ),
    )
