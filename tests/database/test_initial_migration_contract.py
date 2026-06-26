from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FORWARD_PATH = REPO_ROOT / "db" / "migrations" / "0001_initial.sql"
ROLLBACK_PATH = REPO_ROOT / "db" / "migrations" / "0001_initial.down.sql"


def normalized_sql(path: Path) -> str:
    sql = path.read_text(encoding="utf-8")
    sql = re.sub(r"--[^\n]*", " ", sql)
    return re.sub(r"\s+", " ", sql).strip().lower()


def table_definition(sql: str, table: str) -> str:
    match = re.search(
        rf"create table napp\.{re.escape(table)}\s*\((.*?)\);",
        sql,
        flags=re.DOTALL,
    )
    if not match:
        raise AssertionError(f"missing CREATE TABLE napp.{table}")
    return match.group(1)


class InitialMigrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.raw_forward = FORWARD_PATH.read_text(encoding="utf-8")
        cls.forward = normalized_sql(FORWARD_PATH)
        cls.rollback = normalized_sql(ROLLBACK_PATH)

    def test_migrations_are_transactional_and_rollback_is_scoped(self) -> None:
        self.assertRegex(self.forward, r"^begin;")
        self.assertRegex(self.forward, r"commit;$")
        self.assertIn("create schema if not exists napp", self.forward)
        self.assertRegex(self.rollback, r"^begin;")
        self.assertIn("drop schema if exists napp cascade", self.rollback)
        self.assertNotIn("drop extension", self.rollback)

    def test_required_domain_tables_exist(self) -> None:
        required = {
            "cases",
            "case_purpose_sessions",
            "entities",
            "sources",
            "assertions",
            "assertion_revisions",
            "authorized_projections",
            "authorized_projection_revisions",
            "analysis_versions",
            "analysis_dependencies",
            "community_runs",
            "community_observations",
            "community_memberships",
            "community_lineage_versions",
            "community_lineage_identities",
            "community_lineage_events",
            "community_lineage_event_endpoints",
            "reports",
            "report_versions",
            "report_dependencies",
            "audit_events",
            "audit_checkpoints",
        }
        for table in required:
            with self.subTest(table=table):
                self.assertIn(f"create table napp.{table}", self.forward)

    def test_assertion_revisions_are_bitemporal_and_append_only(self) -> None:
        definition = table_definition(self.forward, "assertion_revisions")
        self.assertIn("valid_period tstzrange not null", definition)
        self.assertIn("recorded_period tstzrange generated always as", definition)
        self.assertIn("tstzrange(recorded_at, null, '[)')", definition)
        self.assertIn("upper_inf(recorded_period)", definition)
        self.assertIn("'observed_event'", definition)
        self.assertIn("'persistent_state'", definition)
        self.assertIn("supersedes_revision_id uuid", definition)
        self.assertIn("unique (assertion_id, revision_number)", definition)
        self.assertIn("unique (supersedes_revision_id)", definition)
        self.assertIn("deferrable initially immediate", definition)
        self.assertIn("assertion_revisions_bitemporal_gist_idx", self.forward)
        self.assertRegex(
            self.forward,
            r"create trigger assertion_revisions_append_only "
            r"before update or delete on napp\.assertion_revisions",
        )

    def test_revision_trigger_enforces_linear_monotone_corrections(self) -> None:
        self.assertIn("create function napp.enforce_assertion_revision_insert()", self.forward)
        self.assertIn("new.revision_number <> 1", self.forward)
        self.assertIn(
            "new.revision_number <> predecessor.revision_number + 1",
            self.forward,
        )
        self.assertIn("new.recorded_at < predecessor.recorded_at", self.forward)
        self.assertIn(
            "predecessor.assertion_id <> new.assertion_id",
            self.forward,
        )

    def test_projection_population_uses_exact_revision_foreign_keys(self) -> None:
        definition = table_definition(
            self.forward, "authorized_projection_revisions"
        )
        self.assertIn("assertion_revision_id uuid not null", definition)
        self.assertIn(
            "references napp.assertion_revisions(case_id, id) on delete restrict",
            definition,
        )
        projection = table_definition(self.forward, "authorized_projections")
        for digest in (
            "policy_digest bytea not null",
            "authorization_digest bytea not null",
            "manifest_digest bytea not null",
        ):
            self.assertIn(digest, projection)
        self.assertIn("actor_id uuid not null", projection)
        self.assertIn("purpose_id uuid not null", projection)
        self.assertIn("known_at timestamptz not null", projection)

    def test_analysis_community_and_lineage_are_versioned_and_separate(self) -> None:
        analysis = table_definition(self.forward, "analysis_versions")
        self.assertIn("version_number integer not null", analysis)
        self.assertIn("recipe_digest bytea not null", analysis)
        run = table_definition(self.forward, "community_runs")
        for field in (
            "projection_id uuid not null",
            "algorithm text not null",
            "algorithm_version text not null",
            "objective text not null",
            "parameters jsonb not null",
            "random_seed bigint not null",
            "period tstzrange not null",
            "input_digest bytea not null",
        ):
            self.assertIn(field, run)
        event = table_definition(self.forward, "community_lineage_events")
        for event_type in (
            "'birth'",
            "'continuation'",
            "'split'",
            "'merge'",
            "'death'",
            "'resurgence'",
        ):
            self.assertIn(event_type, event)
        endpoints = table_definition(
            self.forward, "community_lineage_event_endpoints"
        )
        self.assertIn("endpoint_role in ('parent', 'child')", endpoints)
        self.assertIn("community_observation_id uuid", endpoints)

    def test_report_dependencies_are_exact_and_single_target(self) -> None:
        definition = table_definition(self.forward, "report_dependencies")
        self.assertIn("assertion_revision_id uuid", definition)
        self.assertIn("projection_id uuid", definition)
        self.assertIn("analysis_version_id uuid", definition)
        self.assertIn("community_run_id uuid", definition)
        self.assertIn("lineage_event_id uuid", definition)
        self.assertRegex(
            definition,
            r"check \(num_nonnulls\( assertion_revision_id, projection_id, "
            r"analysis_version_id, community_run_id, lineage_event_id \) = 1\)",
        )
        report = table_definition(self.forward, "report_versions")
        self.assertIn("manifest_digest bytea not null", report)
        self.assertIn("content_digest bytea", report)
        self.assertIn("released_at timestamptz", report)

    def test_audit_is_append_only_hash_chained_and_checkpointable(self) -> None:
        audit = table_definition(self.forward, "audit_events")
        self.assertIn("previous_hash bytea not null", audit)
        self.assertIn("event_hash bytea not null", audit)
        self.assertIn("metadata jsonb not null", audit)
        self.assertIn("create function napp.prepare_audit_event()", self.forward)
        self.assertRegex(
            self.forward,
            r"create function napp\.prepare_audit_event\(\) returns trigger "
            r"language plpgsql security definer "
            r"set search_path = pg_catalog, napp",
        )
        self.assertIn("for update", self.forward)
        self.assertIn("public.digest(", self.forward)
        self.assertRegex(
            self.forward,
            r"create trigger audit_events_append_only "
            r"before update or delete on napp\.audit_events",
        )
        checkpoint = table_definition(self.forward, "audit_checkpoints")
        self.assertIn("external_anchor_uri text not null", checkpoint)
        self.assertIn("through_sequence bigint not null", checkpoint)

    def test_case_scoped_tables_have_forced_rls_policy_scaffolding(self) -> None:
        self.assertIn("create function napp.case_is_authorized(target_case_id uuid)", self.forward)
        self.assertIn("alter table napp.cases force row level security", self.forward)
        self.assertIn("create policy cases_case_scope", self.forward)
        self.assertIn("create policy audit_events_insert_scope", self.forward)
        self.assertRegex(
            self.forward,
            r"create policy audit_events_read_scope .*?using \( "
            r"napp\.current_actor_id\(\) is not null "
            r"and napp\.current_purpose_id\(\) is not null",
        )
        rls_loop = re.search(
            r"foreach table_name in array array\[(.*?)\].*?end loop;",
            self.forward,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(rls_loop)
        assert rls_loop is not None
        loop_tables = rls_loop.group(1)
        for table in (
            "entities",
            "sources",
            "assertion_revisions",
            "authorized_projections",
            "analysis_versions",
            "community_runs",
            "community_memberships",
            "community_lineage_events",
            "report_versions",
            "report_dependencies",
        ):
            with self.subTest(table=table):
                self.assertIn(f"'{table}'", loop_tables)
        self.assertIn("revoke all on all tables in schema napp from public", self.forward)

    def test_migration_contains_operational_comments_and_no_cascade_deletes(self) -> None:
        self.assertGreaterEqual(
            len(re.findall(r"comment on (?:table|column|function)", self.forward)),
            20,
        )
        self.assertNotIn("on delete cascade", self.forward)
        self.assertNotRegex(self.forward, r"\bserial\b")


if __name__ == "__main__":
    unittest.main()
