from __future__ import annotations

import json
import unittest
from datetime import datetime, timezone

from analytics.lineage import build_lineage
from analytics.lineage import CommunityInput, CommunitySnapshot
from apps.api.contracts import (
    AuthorizationContext,
    AuthorizationContextV1,
    CaseManifest,
    StructuredError,
    deterministic_json,
)
from apps.api.service import (
    AnalysisService,
    AuthorizationDenied,
    InvalidServiceRequest,
)
from apps.api.temporal import (
    AssertionClass,
    AssertionRevision,
    HistoricalQuery,
    InMemoryAssertionRepository,
    SourceRecord,
    TemporalInterval,
)

UTC = timezone.utc


def at(day: int) -> datetime:
    return datetime(2026, 3, day, tzinfo=UTC)


def source(source_id: str) -> SourceRecord:
    return SourceRecord(
        source_record_id=source_id,
        source_name=f"Source {source_id}",
        original_reference=f"fixture:{source_id}",
        source_reliability="A",
        information_credibility="1",
        acquired_at=at(1),
        metadata={"z": 2, "a": 1},
    )


def revision(
    revision_id: str,
    *,
    assertion_id: str | None = None,
    case_id: str = "case-1",
    label: str = "internal",
    restrictions: tuple[str, ...] = (),
    object_value: str = "entity:b",
    recorded_start: int = 1,
    recorded_end: int | None = None,
) -> AssertionRevision:
    return AssertionRevision(
        assertion_id=assertion_id or revision_id,
        revision_id=revision_id,
        case_id=case_id,
        subject_ref="entity:a",
        predicate="knows",
        object_value=object_value,
        assertion_class=AssertionClass.PERSISTENT_STATE,
        valid_during=TemporalInterval(at(1), None),
        recorded_during=TemporalInterval(
            at(recorded_start), at(recorded_end) if recorded_end else None
        ),
        source=source(f"source-{revision_id}"),
        handling_label=label,
        field_restrictions=restrictions,
    )


class CountingRepository(InMemoryAssertionRepository):
    def __init__(self, revisions=()):
        super().__init__(revisions)
        self.snapshot_calls = 0

    def snapshot(self, query):
        self.snapshot_calls += 1
        return super().snapshot(query)


class ServiceFixture(unittest.TestCase):
    def setUp(self) -> None:
        self.repository = CountingRepository(
            (
                revision("open-r1"),
                revision("restricted-r1", label="restricted"),
                revision("field-r1", restrictions=("object_value",)),
                revision(
                    "changing-r1",
                    assertion_id="changing",
                    object_value="before",
                    recorded_end=5,
                ),
                revision(
                    "changing-r2",
                    assertion_id="changing",
                    object_value="after",
                    recorded_start=5,
                ),
            )
        )
        self.lineage_calls = 0

        def lineage_builder(snapshots, config=None):
            self.lineage_calls += 1
            return build_lineage(snapshots, config)

        self.service = AnalysisService(self.repository, lineage_builder)
        self.manifest = CaseManifest(
            case_id="case-1",
            jurisdiction="training",
            owner="unit-test",
            permissible_purposes=("analysis", "review"),
            handling_policy_version="policy-7",
            source_high_water_marks={"evidence": "42"},
        )

    def authorization(
        self,
        *,
        actor: str = "analyst-1",
        purpose: str = "analysis",
        labels: tuple[str, ...] = ("internal",),
        fields: tuple[str, ...] = (),
        case_id: str = "case-1",
        policy: str = "policy-7",
    ) -> AuthorizationContext:
        return AuthorizationContext(
            actor_id=actor,
            case_id=case_id,
            purpose=purpose,
            authorization_id=f"grant-{actor}-{purpose}",
            allowed_handling_labels=labels,
            allowed_fields=fields,
            policy_version=policy,
        )

    def query(self, known_day: int = 4, *, case_id: str = "case-1"):
        return HistoricalQuery(at(2), at(known_day), case_id=case_id)


class AuthorizationTests(ServiceFixture):
    def test_allow_and_deny_happen_before_repository_access(self) -> None:
        projection = self.service.project(
            self.manifest, self.authorization(), self.query()
        )
        self.assertEqual(self.repository.snapshot_calls, 1)
        self.assertIn("open-r1", projection.assertion_revision_ids)

        denied_contexts = (
            (self.authorization(purpose=""), self.query()),
            (self.authorization(case_id="another-case"), self.query()),
            (self.authorization(purpose="unapproved"), self.query()),
            (self.authorization(policy="policy-6"), self.query()),
        )
        for context, query in denied_contexts:
            with self.subTest(context=context):
                with self.assertRaises(AuthorizationDenied):
                    self.service.project(self.manifest, context, query)
        self.assertEqual(
            self.repository.snapshot_calls,
            1,
            "denied requests must not touch case data",
        )

    def test_handling_labels_and_field_restrictions_filter_projection(self) -> None:
        narrow = self.service.project(
            self.manifest, self.authorization(), self.query()
        )
        self.assertEqual(
            narrow.assertion_revision_ids,
            ("changing-r1", "open-r1"),
        )
        self.assertEqual(narrow.excluded_revision_count, 2)

        broad = self.service.project(
            self.manifest,
            self.authorization(
                labels=("internal", "restricted"),
                fields=("object_value",),
            ),
            self.query(),
        )
        self.assertEqual(
            broad.assertion_revision_ids,
            ("changing-r1", "field-r1", "open-r1", "restricted-r1"),
        )
        self.assertEqual(
            broad.inherited_handling_labels, ("internal", "restricted")
        )

    def test_projection_requires_non_leaking_identity_fields(self) -> None:
        with self.assertRaises(InvalidServiceRequest) as raised:
            self.service.project(
                self.manifest,
                self.authorization(),
                self.query(),
                requested_fields=("revision_id",),
            )
        self.assertEqual(
            raised.exception.error.to_dict()["error"]["code"], "invalid_request"
        )


class CacheIsolationTests(ServiceFixture):
    def test_cache_key_is_isolated_by_actor_purpose_policy_and_grants(self) -> None:
        contexts = (
            self.authorization(),
            self.authorization(actor="analyst-2"),
            self.authorization(purpose="review"),
            self.authorization(labels=("internal", "restricted")),
            self.authorization(fields=("object_value",)),
        )
        projections = [
            self.service.project(self.manifest, context, self.query())
            for context in contexts
        ]
        self.assertEqual(len({item.cache_key for item in projections}), len(contexts))
        self.assertEqual(self.repository.snapshot_calls, len(contexts))

        cached = self.service.project(
            self.manifest, self.authorization(), self.query()
        )
        self.assertIs(cached, projections[0])
        self.assertEqual(self.repository.snapshot_calls, len(contexts))

    def test_requested_fields_and_source_versions_change_cache_key(self) -> None:
        default = self.service.project(
            self.manifest, self.authorization(), self.query()
        )
        minimal_fields = (
            "assertion_id",
            "case_id",
            "handling_label",
            "revision_id",
        )
        minimal = self.service.project(
            self.manifest,
            self.authorization(),
            self.query(),
            requested_fields=minimal_fields,
        )
        changed_manifest = CaseManifest(
            case_id="case-1",
            jurisdiction="training",
            owner="unit-test",
            permissible_purposes=("analysis", "review"),
            handling_policy_version="policy-7",
            source_high_water_marks={"evidence": "43"},
        )
        changed_source = self.service.project(
            changed_manifest, self.authorization(), self.query()
        )
        self.assertEqual(
            len({default.cache_key, minimal.cache_key, changed_source.cache_key}), 3
        )


class DerivedArtifactTests(ServiceFixture):
    @staticmethod
    def authorized_snapshots():
        return (
            CommunitySnapshot(
                "before",
                (CommunityInput("one", frozenset({"entity:a", "entity:b"})),),
            ),
            CommunitySnapshot(
                "after",
                (CommunityInput("renamed", frozenset({"entity:a", "entity:b"})),),
            ),
        )

    def test_no_post_computation_hiding(self) -> None:
        denied = self.authorization(purpose="unapproved")
        with self.assertRaises(AuthorizationDenied):
            self.service.project(self.manifest, denied, self.query())
        self.assertEqual(self.lineage_calls, 0)

        projection = self.service.project(
            self.manifest, self.authorization(), self.query()
        )
        lineage = self.service.build_lineage(
            projection, self.authorized_snapshots()
        )
        self.assertEqual(self.lineage_calls, 1)
        self.assertEqual(
            lineage.assertion_revision_ids, projection.assertion_revision_ids
        )
        self.assertNotIn("restricted-r1", lineage.assertion_revision_ids)
        self.assertNotIn("field-r1", lineage.assertion_revision_ids)

    def test_lineage_rejects_members_outside_projection(self) -> None:
        projection = self.service.project(
            self.manifest, self.authorization(), self.query()
        )
        snapshots = (
            CommunitySnapshot(
                "before",
                (
                    CommunityInput(
                        "invalid",
                        frozenset({"entity:a", "entity:not-authorized"}),
                    ),
                ),
            ),
        )

        with self.assertRaises(InvalidServiceRequest) as raised:
            self.service.build_lineage(projection, snapshots)
        self.assertEqual(
            raised.exception.error.to_dict()["error"]["code"],
            "lineage_projection_mismatch",
        )
        self.assertEqual(self.lineage_calls, 0)

    def test_comparison_is_deterministic_and_context_bound(self) -> None:
        before = self.service.project(
            self.manifest, self.authorization(), self.query(4)
        )
        after = self.service.project(
            self.manifest, self.authorization(), self.query(6)
        )
        first = self.service.compare(before, after)
        second = self.service.compare(before, after)

        self.assertEqual(first, second)
        self.assertEqual(
            first.changed_assertions,
            (
                {
                    "assertion_id": "changing",
                    "before_revision_id": "changing-r1",
                    "after_revision_id": "changing-r2",
                },
            ),
        )

        other_actor = self.service.project(
            self.manifest, self.authorization(actor="analyst-2"), self.query(6)
        )
        with self.assertRaises(AuthorizationDenied):
            self.service.compare(before, other_actor)

    def test_report_embeds_exact_provenance_dependencies(self) -> None:
        before = self.service.project(
            self.manifest, self.authorization(), self.query(4)
        )
        after = self.service.project(
            self.manifest, self.authorization(), self.query(6)
        )
        comparison = self.service.compare(before, after)
        lineage = self.service.build_lineage(after, self.authorized_snapshots())
        report = self.service.draft_report(
            after,
            title="Training report",
            question="What changed?",
            assessment="A split is consistent with the authorized evidence.",
            contrary_evidence="Coverage is incomplete.",
            limitations="Synthetic evidence only.",
            comparison=comparison,
            lineage=lineage,
        )
        payload = report.to_dict()

        self.assertEqual(payload["status"], "draft")
        self.assertEqual(
            set(payload["projection_ids"]),
            set(comparison.dependency_projection_ids),
        )
        self.assertEqual(payload["comparison_ids"], [comparison.comparison_id])
        self.assertEqual(
            payload["lineage_result_ids"], [lineage.lineage_result_id]
        )
        self.assertEqual(
            payload["provenance"]["assertion_revision_ids"],
            list(report.assertion_revision_ids),
        )
        self.assertEqual(
            set(report.assertion_revision_ids),
            set(comparison.assertion_revision_ids)
            | set(lineage.assertion_revision_ids),
        )
        self.assertEqual(report.inherited_handling_labels, ("internal",))


class SerializationTests(ServiceFixture):
    def test_contracts_are_deterministic_json_shaped_values(self) -> None:
        self.assertIs(AuthorizationContextV1, AuthorizationContext)
        projection = self.service.project(
            self.manifest, self.authorization(), self.query()
        )
        first = deterministic_json(projection)
        second = deterministic_json(projection)

        self.assertEqual(first, second)
        self.assertEqual(
            json.loads(first)["contract"], "AuthorizedTemporalProjectionV1"
        )
        self.assertNotIn("MappingProxyType", first)
        self.assertEqual(
            json.dumps(projection.to_dict(), sort_keys=True),
            json.dumps(projection.to_dict(), sort_keys=True),
        )

    def test_structured_error_shape_is_stable(self) -> None:
        error = StructuredError(
            code="permission_denied",
            message="Not allowed.",
            status=403,
            details={"z": 2, "a": 1},
            recovery=("Choose an authorized case.",),
        )
        payload = json.loads(deterministic_json(error))
        self.assertEqual(payload["contract"], "StructuredErrorV1")
        self.assertEqual(payload["error"]["status"], 403)
        self.assertEqual(list(payload["error"]["details"]), ["a", "z"])


if __name__ == "__main__":
    unittest.main()
