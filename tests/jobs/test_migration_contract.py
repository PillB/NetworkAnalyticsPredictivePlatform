from __future__ import annotations

import re
import unittest
from pathlib import Path


REPO_ROOT = Path(__file__).resolve().parents[2]
FORWARD_PATH = REPO_ROOT / "db" / "migrations" / "0002_jobs_and_staleness.sql"
ROLLBACK_PATH = (
    REPO_ROOT / "db" / "migrations" / "0002_jobs_and_staleness.down.sql"
)


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


class JobsMigrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.forward = normalized_sql(FORWARD_PATH)
        cls.rollback = normalized_sql(ROLLBACK_PATH)

    def test_migrations_are_transactional_and_scoped(self) -> None:
        self.assertRegex(self.forward, r"^begin;")
        self.assertRegex(self.forward, r"commit;$")
        self.assertRegex(self.rollback, r"^begin;")
        self.assertRegex(self.rollback, r"commit;$")
        self.assertNotIn("drop schema", self.rollback)
        self.assertNotIn("drop table if exists napp.cases", self.rollback)

    def test_required_tables_exist(self) -> None:
        for table in (
            "jobs",
            "job_attempts",
            "job_staged_outputs",
            "job_publications",
            "job_publication_outputs",
            "job_result_heads",
            "job_dependencies",
            "correction_impacts",
            "audit_outbox",
            "audit_checkpoint_requests",
        ):
            with self.subTest(table=table):
                self.assertIn(f"create table napp.{table}", self.forward)

    def test_jobs_are_idempotent_bounded_and_deadlined(self) -> None:
        jobs = table_definition(self.forward, "jobs")
        self.assertIn("unique (case_id, idempotency_key)", jobs)
        self.assertIn("input_digest bytea not null", jobs)
        self.assertIn("max_attempts integer not null", jobs)
        self.assertIn("attempt_count integer not null", jobs)
        self.assertIn("attempt_count >= 0 and attempt_count <= max_attempts", jobs)
        self.assertIn("deadline_at timestamptz", jobs)
        for state in (
            "'queued'",
            "'running'",
            "'retry_wait'",
            "'succeeded'",
            "'failed'",
            "'cancelled'",
        ):
            self.assertIn(state, jobs)

    def test_claim_and_lease_contract_is_concurrency_safe(self) -> None:
        attempts = table_definition(self.forward, "job_attempts")
        self.assertIn("lease_token uuid not null unique", attempts)
        self.assertIn("leased_until timestamptz not null", attempts)
        self.assertIn("job_attempts_one_active_idx", self.forward)
        self.assertIn("create function napp.claim_job( target_case_id uuid", self.forward)
        self.assertIn(
            "create function napp.reap_expired_job_leases(target_case_id uuid)",
            self.forward,
        )
        self.assertIn(
            "perform napp.reap_expired_job_leases(target_case_id)",
            self.forward,
        )
        self.assertIn("for update skip locked", self.forward)
        self.assertIn("case_id = target_case_id", self.forward)
        self.assertIn("attempt_count < max_attempts", self.forward)
        self.assertIn("create function napp.heartbeat_job(", self.forward)
        self.assertIn("attempt.lease_token = target_lease_token", self.forward)
        self.assertIn("napp.case_is_authorized(job.case_id)", self.forward)
        self.assertIn(
            "attempt.leased_until > statement_timestamp()", self.forward
        )

    def test_staging_and_publication_are_separated_and_atomic(self) -> None:
        staged = table_definition(self.forward, "job_staged_outputs")
        self.assertIn("unique (attempt_id, output_name)", staged)
        self.assertIn("content_digest bytea not null", staged)
        heads = table_definition(self.forward, "job_result_heads")
        self.assertIn("primary key (case_id, result_key)", heads)
        self.assertIn("publication_id uuid not null", heads)
        self.assertIn("create function napp.publish_job(", self.forward)
        self.assertIn("job.cancellation_requested_at is null", self.forward)
        self.assertIn("successful publication requires staged output", self.forward)
        self.assertIn("jsonb_to_recordset(target_dependencies)", self.forward)
        self.assertIn("insert into napp.job_dependencies", self.forward)
        self.assertIn("pg_advisory_xact_lock", self.forward)
        self.assertIn("on conflict (case_id, result_key) do update", self.forward)
        self.assertIn("'publication.committed'", self.forward)
        self.assertNotIn("on delete cascade", self.forward)

    def test_publication_retains_history_and_exact_dependencies(self) -> None:
        publications = table_definition(self.forward, "job_publications")
        self.assertIn("generation integer not null", publications)
        self.assertIn("supersedes_publication_id uuid", publications)
        self.assertIn("stale_at timestamptz", publications)
        self.assertIn("unique (job_id, completion_key)", publications)
        dependencies = table_definition(self.forward, "job_dependencies")
        self.assertIn("dependency_kind text not null", dependencies)
        self.assertIn("dependency_id uuid not null", dependencies)
        self.assertIn("dependency_version text not null", dependencies)
        self.assertIn("'publication'", dependencies)
        self.assertIn("job_dependencies_reverse_idx", self.forward)

    def test_correction_impact_and_audit_requests_are_idempotent(self) -> None:
        impacts = table_definition(self.forward, "correction_impacts")
        self.assertIn("unique (case_id, correction_id, publication_id)", impacts)
        self.assertIn("propagation_depth integer not null", impacts)
        self.assertIn(
            "create function napp.record_correction_impact(", self.forward
        )
        self.assertIn(
            "if not napp.case_is_authorized(target_case_id)",
            self.forward,
        )
        self.assertIn("with recursive impacted as", self.forward)
        self.assertIn("parent.path || dependency.publication_id", self.forward)
        outbox = table_definition(self.forward, "audit_outbox")
        self.assertIn("dispatched_at timestamptz", outbox)
        self.assertIn("audit_outbox_dispatch_idx", self.forward)
        checkpoints = table_definition(
            self.forward, "audit_checkpoint_requests"
        )
        self.assertIn(
            "unique (case_id, through_outbox_event_id)", checkpoints
        )
        self.assertIn("fulfilled_checkpoint_id bigint", checkpoints)

    def test_all_new_tables_are_forced_rls_and_public_access_is_revoked(self) -> None:
        rls_loop = re.search(
            r"foreach table_name in array array\[(.*?)\].*?end loop;",
            self.forward,
            flags=re.DOTALL,
        )
        self.assertIsNotNone(rls_loop)
        assert rls_loop is not None
        for table in (
            "jobs",
            "job_attempts",
            "job_staged_outputs",
            "job_publications",
            "job_publication_outputs",
            "job_result_heads",
            "job_dependencies",
            "correction_impacts",
            "audit_outbox",
            "audit_checkpoint_requests",
        ):
            with self.subTest(table=table):
                self.assertIn(f"'{table}'", rls_loop.group(1))
        self.assertIn("force row level security", self.forward)
        self.assertIn("revoke all on napp.jobs", self.forward)
        self.assertIn("from public", self.forward)


if __name__ == "__main__":
    unittest.main()
