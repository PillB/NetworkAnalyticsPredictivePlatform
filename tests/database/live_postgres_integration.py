"""Live PostgreSQL 18 migration, trigger, RLS, audit, and rollback checks."""

from __future__ import annotations

import os
import shutil
import subprocess
import sys
import tempfile
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import UUID

from psycopg_pool import ConnectionPool

from apps.api.persistence import HarborLanternImporter, PostgreSQLAssertionRepository
from apps.api.security import (
    PostgreSQLActorMapper,
    PostgreSQLCaseGrantStore,
    PostgreSQLReplayProtector,
    VerifiedIdentityClaims,
)
from apps.api.temporal import HistoricalQuery, TemporalInterval, TemporalWindowQuery
from apps.api.temporal.fixtures import harbor_lantern_repository


ROOT = Path(__file__).resolve().parents[2]
POSTGRES_BIN = Path(
    os.environ.get("POSTGRES_BIN", "/usr/local/opt/postgresql@18/bin")
)
PORT = int(os.environ.get("NAPP_TEST_POSTGRES_PORT", "55433"))
ACTOR = UUID("20000000-0000-0000-0000-000000000011")
PURPOSE = UUID("70000000-0000-0000-0000-000000000011")


def instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def verify_application_repository(database: str) -> None:
    dsn = f"host=/tmp port={PORT} dbname={database}"
    reference = harbor_lantern_repository()
    point_queries = (
        HistoricalQuery(
            valid_at=instant("2026-03-01T10:00:00Z"),
            known_at=instant("2026-03-10T00:00:00Z"),
            case_id="harbor-lantern",
        ),
        HistoricalQuery(
            valid_at=instant("2026-03-10T00:00:00Z"),
            known_at=instant("2026-03-20T00:00:00Z"),
            case_id="harbor-lantern",
        ),
        HistoricalQuery(
            valid_at=instant("2026-03-10T00:00:00Z"),
            known_at=instant("2026-03-26T00:00:00Z"),
            case_id="harbor-lantern",
        ),
    )
    window_queries = (
        TemporalWindowQuery(
            valid_during=TemporalInterval(
                instant("2026-03-01T00:00:00Z"),
                instant("2026-03-02T00:00:00Z"),
            ),
            known_at=instant("2026-03-21T00:00:00Z"),
            case_id="harbor-lantern",
        ),
        TemporalWindowQuery(
            valid_during=TemporalInterval(
                instant("2026-03-01T00:00:00Z"),
                instant("2026-03-31T00:00:00Z"),
            ),
            known_at=instant("2026-03-26T00:00:00Z"),
            case_id="harbor-lantern",
        ),
    )

    with ConnectionPool(dsn, min_size=1, max_size=2) as pool:
        importer = HarborLanternImporter(
            pool, actor_id=ACTOR, purpose_id=PURPOSE
        )
        first = importer.import_fixture()
        if importer.import_fixture() != first:
            raise AssertionError("canonical PostgreSQL import is not idempotent")
        repository = PostgreSQLAssertionRepository(
            pool, actor_id=ACTOR, purpose_id=PURPOSE
        )
        for query in point_queries:
            expected = reference.snapshot(query).to_dict()
            actual = repository.snapshot(query).to_dict()
            if actual != expected:
                raise AssertionError(
                    f"PostgreSQL point projection differs at {query}: "
                    f"expected={expected!r}, actual={actual!r}"
                )
        for query in window_queries:
            expected = reference.window_snapshot(query).to_dict()
            actual = repository.window_snapshot(query).to_dict()
            if actual != expected:
                raise AssertionError(
                    f"PostgreSQL window projection differs at {query}: "
                    f"expected={expected!r}, actual={actual!r}"
                )


def binary(name: str) -> str:
    candidate = POSTGRES_BIN / name
    if not candidate.exists():
        raise RuntimeError(f"PostgreSQL binary is missing: {candidate}")
    return str(candidate)


def run(
    args: list[str],
    *,
    check: bool = True,
    capture: bool = True,
) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        args,
        cwd=ROOT,
        text=True,
        check=check,
        capture_output=capture,
        env={**os.environ, "LC_ALL": "C"},
    )


def psql(database: str, sql: str, *, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(
        [
            binary("psql"),
            "-X",
            "-A",
            "-t",
            "-v",
            "ON_ERROR_STOP=1",
            "-h",
            "/tmp",
            "-p",
            str(PORT),
            "-d",
            database,
            "-c",
            sql,
        ],
        check=check,
    )


def apply_file(database: str, path: Path) -> None:
    run(
        [
            binary("psql"),
            "-X",
            "-v",
            "ON_ERROR_STOP=1",
            "-h",
            "/tmp",
            "-p",
            str(PORT),
            "-d",
            database,
            "-f",
            str(path),
        ]
                )


def verify_shared_security_state(database: str) -> None:
    actor_id = "21000000-0000-0000-0000-000000000001"
    grant_id = "71000000-0000-0000-0000-000000000001"
    case_id = "10000000-0000-0000-0000-000000000099"
    psql(
        database,
        f"""
        INSERT INTO napp.cases (
            id, case_key, name, jurisdiction, permissible_purpose,
            owner_actor_id, valid_scope
        )
        VALUES (
            '{case_id}', 'security-live-case', 'Security live case',
            'training', 'analysis', '{actor_id}',
            tstzrange('2026-01-01Z', '2027-01-01Z', '[)')
        );
        INSERT INTO napp.security_actors (
            id, issuer_digest, subject_digest, roles
        )
        VALUES (
            '{actor_id}',
            digest('https://issuer.example.test', 'sha256'),
            digest('live-subject', 'sha256'), ARRAY['analyst']
        );
        INSERT INTO napp.case_access_grants (
            id, actor_id, case_id, purposes, expires_at, policy_version,
            allowed_handling_labels, allowed_fields
        )
        VALUES (
            '{grant_id}', '{actor_id}', '{case_id}', ARRAY['analysis'],
            '2027-01-01Z', 'policy-7', ARRAY['training'],
            ARRAY['subject_ref']
        );
        """,
    )
    resolved = psql(
        database,
        """
        SELECT actor_id || '|' || array_to_string(roles, ',')
        FROM napp.resolve_security_actor(
            digest('https://issuer.example.test', 'sha256'),
            digest('live-subject', 'sha256')
        );
        """,
    ).stdout.strip()
    if resolved != f"{actor_id}|analyst":
        raise AssertionError(f"security actor mapping failed: {resolved}")

    grant = psql(
        database,
        f"""
        SELECT grant_id || '|' || policy_version
        FROM napp.resolve_current_case_grant(
            '{actor_id}', '{case_id}', 'analysis', 'policy-7',
            statement_timestamp()
        );
        """,
    ).stdout.strip()
    if grant != f"{grant_id}|policy-7":
        raise AssertionError(f"current case grant resolution failed: {grant}")

    now = datetime.now(timezone.utc)
    claims = VerifiedIdentityClaims(
        issuer="https://issuer.example.test",
        subject="live-subject",
        audiences=("network-api",),
        expires_at=now + timedelta(minutes=10),
        issued_at=now - timedelta(minutes=1),
        nonce="adapter-live-nonce",
        acr="urn:example:loa:2",
        token_id="adapter-live-token",
        verification_method="live-test",
    )
    dsn = f"host=/tmp port={PORT} dbname={database}"
    with ConnectionPool(dsn, min_size=1, max_size=2) as pool:
        mapped_actor = PostgreSQLActorMapper(pool).map_actor(claims)
        if mapped_actor is None or mapped_actor.actor_id != actor_id:
            raise AssertionError("PostgreSQL actor adapter did not map live state")
        mapped_grant = PostgreSQLCaseGrantStore(pool).find_active_grant(
            actor_id=actor_id,
            case_id=case_id,
            purpose="analysis",
            policy_version="policy-7",
            now=now,
        )
        if mapped_grant is None or mapped_grant.grant_id != grant_id:
            raise AssertionError("PostgreSQL grant adapter did not resolve live state")
        replay_adapter = PostgreSQLReplayProtector(pool)
        if not replay_adapter.consume(claims, now=now):
            raise AssertionError("PostgreSQL replay adapter rejected first consume")
        if replay_adapter.consume(claims, now=now):
            raise AssertionError("PostgreSQL replay adapter accepted replay")

    replay = psql(
        database,
        """
        SELECT napp.consume_oidc_replay(
            decode(repeat('44', 32), 'hex'),
            decode(repeat('11', 32), 'hex'),
            decode(repeat('22', 32), 'hex'),
            decode(repeat('33', 32), 'hex'),
            '2027-01-01Z'
        );
        SELECT napp.consume_oidc_replay(
            decode(repeat('44', 32), 'hex'),
            decode(repeat('11', 32), 'hex'),
            decode(repeat('22', 32), 'hex'),
            decode(repeat('33', 32), 'hex'),
            '2027-01-01Z'
        );
        """,
    ).stdout.splitlines()
    if [value.strip() for value in replay if value.strip()] != ["t", "f"]:
        raise AssertionError(f"OIDC replay fence was not atomic: {replay}")

    psql(
        database,
        f"""
        INSERT INTO napp.case_access_grant_revocations (
            grant_id, reason_code
        ) VALUES ('{grant_id}', 'live_test');
        """,
    )
    revoked = psql(
        database,
        f"""
        SELECT count(*)
        FROM napp.resolve_current_case_grant(
            '{actor_id}', '{case_id}', 'analysis', 'policy-7',
            statement_timestamp()
        );
        """,
    ).stdout.strip()
    if revoked != "0":
        raise AssertionError("revoked case grant remained resolvable")

    mutation = psql(
        database,
        f"""
        UPDATE napp.case_access_grants
        SET policy_version = 'policy-8'
        WHERE id = '{grant_id}';
        """,
        check=False,
    )
    if mutation.returncode == 0 or "append-only" not in mutation.stderr:
        raise AssertionError("immutable case grant accepted UPDATE")


def main() -> int:
    if not POSTGRES_BIN.exists():
        print(f"SKIP: PostgreSQL 18 binaries not found at {POSTGRES_BIN}")
        return 0

    cluster = Path(tempfile.mkdtemp(prefix="napp-pg18-", dir="/tmp"))
    log = cluster.parent / f"{cluster.name}.log"
    database = "napp_live_test"
    started = False
    try:
        run(
            [
                binary("initdb"),
                "-D",
                str(cluster),
                "--no-locale",
                "--encoding=UTF8",
                "--auth=trust",
            ]
        )
        run(
            [
                binary("pg_ctl"),
                "-D",
                str(cluster),
                "-o",
                f"-p {PORT} -k /tmp -c listen_addresses=127.0.0.1",
                "-l",
                str(log),
                "start",
            ]
        )
        started = True
        run(
            [
                binary("createdb"),
                "-h",
                "/tmp",
                "-p",
                str(PORT),
                database,
            ]
        )
        version = psql(database, "SHOW server_version_num;").stdout
        if version.strip() != "180004":
            raise AssertionError(f"expected PostgreSQL 18.4, got: {version}")

        apply_file(database, ROOT / "db/migrations/0001_initial.sql")
        apply_file(database, ROOT / "db/migrations/0002_jobs_and_staleness.sql")
        apply_file(
            database,
            ROOT / "db/migrations/0003_security_identity_and_grants.sql",
        )
        verify_application_repository(database)
        verify_shared_security_state(database)
        psql(
            database,
            """
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'napp' AND c.relname = 'assertion_revisions'
              ) THEN RAISE EXCEPTION 'migration table missing'; END IF;
              IF NOT (
                SELECT relrowsecurity AND relforcerowsecurity
                FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
                WHERE n.nspname = 'napp' AND c.relname = 'assertion_revisions'
              ) THEN RAISE EXCEPTION 'forced RLS missing'; END IF;
            END $$;
            """,
        )

        psql(
            database,
            """
            INSERT INTO napp.cases
              (id, case_key, name, jurisdiction, permissible_purpose,
               owner_actor_id, valid_scope)
            VALUES
              ('10000000-0000-0000-0000-000000000001', 'live-case',
               'Live migration case', 'training', 'analysis',
               '20000000-0000-0000-0000-000000000001',
               tstzrange('2026-01-01Z', '2027-01-01Z', '[)'));
            """,
        )
        psql(
            database,
            """
            INSERT INTO napp.jobs
              (id, case_id, job_kind, idempotency_key, input_digest, parameters)
            VALUES
              ('80000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000001',
               'community', 'live-job-1',
               decode(repeat('ab', 32), 'hex'),
               '{"algorithm": "fixture"}');
            """,
        )
        unauthorized_claim = psql(
            database,
            """
            SELECT count(*) FROM napp.claim_job(
              '10000000-0000-0000-0000-000000000001',
              'unauthorized', interval '1 minute'
            );
            """,
            check=False,
        )
        if (
            unauthorized_claim.returncode == 0
            or "case authorization required" not in unauthorized_claim.stderr
        ):
            raise AssertionError("security-definer claim crossed case authorization")

        claim = psql(
            database,
            """
            WITH settings AS (
              SELECT
                set_config('app.actor_id',
                  '20000000-0000-0000-0000-000000000001', true),
                set_config('app.purpose_id',
                  '70000000-0000-0000-0000-000000000001', true),
                set_config('app.authorized_case_ids',
                  '{10000000-0000-0000-0000-000000000001}', true)
            )
            SELECT job_id || '|' || attempt_id || '|' || lease_token
            FROM settings,
            LATERAL napp.claim_job(
              '10000000-0000-0000-0000-000000000001',
              'live-worker', interval '5 minutes'
            );
            """,
        ).stdout.strip()
        job_id, attempt_id, lease_token = claim.split("|")
        if job_id != "80000000-0000-0000-0000-000000000001":
            raise AssertionError(f"unexpected claimed job: {claim}")

        psql(
            database,
            f"""
            INSERT INTO napp.job_staged_outputs
              (case_id, job_id, attempt_id, output_name, object_uri,
               content_digest, metadata)
            VALUES
              ('10000000-0000-0000-0000-000000000001',
               '{job_id}', '{attempt_id}', 'result.json',
               's3://synthetic/live/result.json',
               decode(repeat('cd', 32), 'hex'),
               '{{"rows": 2}}');
            """,
        )
        publication_id = psql(
            database,
            f"""
            WITH settings AS (
              SELECT
                set_config('app.actor_id',
                  '20000000-0000-0000-0000-000000000001', true),
                set_config('app.purpose_id',
                  '70000000-0000-0000-0000-000000000001', true),
                set_config('app.authorized_case_ids',
                  '{{10000000-0000-0000-0000-000000000001}}', true)
            )
            SELECT napp.publish_job(
              '{job_id}', '{lease_token}', 'community/current', 'complete-live',
              '[]'::jsonb
            )
            FROM settings;
            """,
        ).stdout.strip()
        if not publication_id:
            raise AssertionError("atomic publication did not return an ID")
        publication_check = psql(
            database,
            f"""
            SELECT
              (SELECT state FROM napp.jobs WHERE id = '{job_id}') || '|' ||
              (SELECT generation::text FROM napp.job_publications
               WHERE id = '{publication_id}') || '|' ||
              (SELECT publication_id::text FROM napp.job_result_heads
               WHERE case_id = '10000000-0000-0000-0000-000000000001'
                 AND result_key = 'community/current');
            """,
        ).stdout.strip()
        if publication_check != f"succeeded|1|{publication_id}":
            raise AssertionError(f"atomic publication state mismatch: {publication_check}")

        psql(
            database,
            """
            INSERT INTO napp.cases
              (id, case_key, name, jurisdiction, permissible_purpose,
               owner_actor_id, valid_scope)
            VALUES
              ('10000000-0000-0000-0000-000000000001', 'live-case',
               'Live migration case', 'training', 'analysis',
               '20000000-0000-0000-0000-000000000001',
               tstzrange('2026-01-01Z', '2027-01-01Z', '[)'))
            ON CONFLICT (id) DO NOTHING;
            INSERT INTO napp.entities
              (id, case_id, entity_key, entity_type, display_label)
            VALUES
              ('30000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000001',
               'subject', 'person', 'Synthetic Subject'),
              ('30000000-0000-0000-0000-000000000002',
               '10000000-0000-0000-0000-000000000001',
               'object', 'organization', 'Synthetic Object');
            INSERT INTO napp.sources
              (id, case_id, source_key, source_type, title, received_at)
            VALUES
              ('40000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000001',
               'source-1', 'training', 'Synthetic source', '2026-03-02Z');
            INSERT INTO napp.assertions
              (id, case_id, assertion_key, subject_entity_id, predicate,
               object_entity_id)
            VALUES
              ('50000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000001',
               'assertion-1',
               '30000000-0000-0000-0000-000000000001',
               'associated_with',
               '30000000-0000-0000-0000-000000000002');
            INSERT INTO napp.assertion_revisions
              (id, case_id, assertion_id, revision_number, source_id,
               assertion_class, evidence_status, confidence, validity_kind,
               valid_period, recorded_at, created_by_actor_id,
               supersedes_revision_id)
            VALUES
              ('60000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000001',
               '50000000-0000-0000-0000-000000000001',
               1, '40000000-0000-0000-0000-000000000001',
               'persistent_state', 'asserted', 0.6, 'interval',
               tstzrange('2026-03-01Z', '2026-04-01Z', '[)'),
               '2026-03-02Z',
               '20000000-0000-0000-0000-000000000001',
               NULL),
              ('60000000-0000-0000-0000-000000000002',
               '10000000-0000-0000-0000-000000000001',
               '50000000-0000-0000-0000-000000000001',
               2, '40000000-0000-0000-0000-000000000001',
               'persistent_state', 'corroborated', 0.8, 'interval',
               tstzrange('2026-03-01Z', '2026-04-01Z', '[)'),
               '2026-03-05Z',
               '20000000-0000-0000-0000-000000000001',
               '60000000-0000-0000-0000-000000000001');
            DO $$
            BEGIN
              IF NOT (
                SELECT bool_and(upper_inf(recorded_period))
                FROM napp.assertion_revisions
              ) THEN RAISE EXCEPTION 'recorded periods are not unbounded'; END IF;
              IF (
                SELECT count(*) FROM napp.assertion_revisions
                WHERE assertion_id = '50000000-0000-0000-0000-000000000001'
                  AND recorded_at <= '2026-03-03Z'
              ) <> 1 THEN RAISE EXCEPTION 'known-at reconstruction failed'; END IF;
              IF (
                SELECT revision_number FROM napp.assertion_revisions
                WHERE assertion_id = '50000000-0000-0000-0000-000000000001'
                  AND recorded_at <= '2026-03-06Z'
                ORDER BY revision_number DESC LIMIT 1
              ) <> 2 THEN RAISE EXCEPTION 'latest correction selection failed'; END IF;
            END $$;
            """,
        )

        mutation = psql(
            database,
            """
            UPDATE napp.assertion_revisions
            SET confidence = 0.9
            WHERE id = '60000000-0000-0000-0000-000000000001';
            """,
            check=False,
        )
        if mutation.returncode == 0 or "append-only" not in mutation.stderr:
            raise AssertionError("append-only mutation trigger did not reject UPDATE")

        invalid_correction = psql(
            database,
            """
            INSERT INTO napp.assertion_revisions
              (id, case_id, assertion_id, revision_number, source_id,
               assertion_class, evidence_status, validity_kind, valid_period,
               recorded_at, created_by_actor_id, supersedes_revision_id)
            VALUES
              ('60000000-0000-0000-0000-000000000003',
               '10000000-0000-0000-0000-000000000001',
               '50000000-0000-0000-0000-000000000001',
               4, '40000000-0000-0000-0000-000000000001',
               'persistent_state', 'asserted', 'interval',
               tstzrange('2026-03-01Z', '2026-04-01Z', '[)'),
               '2026-03-06Z',
               '20000000-0000-0000-0000-000000000001',
               '60000000-0000-0000-0000-000000000002');
            """,
            check=False,
        )
        if invalid_correction.returncode == 0 or "immediately follow" not in invalid_correction.stderr:
            raise AssertionError("correction trigger accepted a non-monotone revision")

        psql(
            database,
            """
            INSERT INTO napp.assertions
              (id, case_id, assertion_key, subject_entity_id, predicate,
               object_entity_id)
            VALUES
              ('50000000-0000-0000-0000-000000000002',
               '10000000-0000-0000-0000-000000000001',
               'concurrent-assertion',
               '30000000-0000-0000-0000-000000000001',
               'concurrent_test',
               '30000000-0000-0000-0000-000000000002');
            INSERT INTO napp.assertion_revisions
              (id, case_id, assertion_id, revision_number, source_id,
               assertion_class, evidence_status, validity_kind, valid_period,
               recorded_at, created_by_actor_id)
            VALUES
              ('61000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000001',
               '50000000-0000-0000-0000-000000000002',
               1, '40000000-0000-0000-0000-000000000001',
               'persistent_state', 'asserted', 'interval',
               tstzrange('2026-03-01Z', '2026-04-01Z', '[)'),
               '2026-03-02Z',
               '20000000-0000-0000-0000-000000000001');
            """,
        )
        concurrent_sql = (
            "INSERT INTO napp.assertion_revisions "
            "(id, case_id, assertion_id, revision_number, source_id, "
            "assertion_class, evidence_status, validity_kind, valid_period, "
            "recorded_at, created_by_actor_id, supersedes_revision_id) VALUES "
            "('{revision_id}', "
            "'10000000-0000-0000-0000-000000000001', "
            "'50000000-0000-0000-0000-000000000002', 2, "
            "'40000000-0000-0000-0000-000000000001', "
            "'persistent_state', 'asserted', 'interval', "
            "tstzrange('2026-03-01Z', '2026-04-01Z', '[)'), "
            "'2026-03-07Z', '20000000-0000-0000-0000-000000000001', "
            "'61000000-0000-0000-0000-000000000001');"
        )
        processes = [
            subprocess.Popen(
                [
                    binary("psql"),
                    "-X",
                    "-A",
                    "-t",
                    "-v",
                    "ON_ERROR_STOP=1",
                    "-h",
                    "/tmp",
                    "-p",
                    str(PORT),
                    "-d",
                    database,
                    "-c",
                    concurrent_sql.format(
                        revision_id=f"61000000-0000-0000-0000-00000000000{index}"
                    ),
                ],
                cwd=ROOT,
                text=True,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                env={**os.environ, "LC_ALL": "C"},
            )
            for index in (2, 3)
        ]
        results = [process.communicate(timeout=15) + (process.returncode,) for process in processes]
        if sorted(result[2] for result in results) != [0, 1]:
            raise AssertionError(f"concurrent corrections did not serialize: {results}")
        psql(
            database,
            """
            DO $$
            BEGIN
              IF (
                SELECT count(*) FROM napp.assertion_revisions
                WHERE supersedes_revision_id =
                  '61000000-0000-0000-0000-000000000001'
              ) <> 1
              THEN RAISE EXCEPTION 'multiple concurrent successors persisted'; END IF;
            END $$;
            """,
        )

        psql(
            database,
            f"""
            INSERT INTO napp.job_dependencies
              (case_id, publication_id, dependency_kind, dependency_id,
               dependency_version)
            VALUES
              ('10000000-0000-0000-0000-000000000001',
               '{publication_id}', 'assertion_revision',
               '60000000-0000-0000-0000-000000000001', '1');
            """,
        )
        impacted = psql(
            database,
            """
            WITH settings AS (
              SELECT
                set_config('app.actor_id',
                  '20000000-0000-0000-0000-000000000001', true),
                set_config('app.purpose_id',
                  '70000000-0000-0000-0000-000000000001', true),
                set_config('app.authorized_case_ids',
                  '{10000000-0000-0000-0000-000000000001}', true)
            )
            SELECT napp.record_correction_impact(
              '10000000-0000-0000-0000-000000000001',
              '90000000-0000-0000-0000-000000000001',
              'assertion_revision',
              '60000000-0000-0000-0000-000000000001',
              '1'
            )
            FROM settings;
            """,
        ).stdout.strip()
        if impacted != "1":
            raise AssertionError(f"correction impact did not mark publication: {impacted}")
        stale = psql(
            database,
            f"SELECT stale_at IS NOT NULL FROM napp.job_publications WHERE id = '{publication_id}';",
        ).stdout.strip()
        if stale != "t":
            raise AssertionError("published result was not retained and marked stale")

        psql(
            database,
            """
            CREATE ROLE napp_live_app;
            GRANT USAGE ON SCHEMA napp TO napp_live_app;
            GRANT SELECT ON napp.cases, napp.assertion_revisions TO napp_live_app;
            GRANT EXECUTE ON FUNCTION
              napp.current_actor_id(),
              napp.current_purpose_id(),
              napp.authorized_case_ids(),
              napp.case_is_authorized(uuid)
            TO napp_live_app;
            """,
        )
        rls = psql(
            database,
            """
            SET ROLE napp_live_app;
            SELECT count(*) AS denied_without_context FROM napp.cases;
            BEGIN;
            SET LOCAL app.actor_id = '20000000-0000-0000-0000-000000000001';
            SET LOCAL app.purpose_id = '70000000-0000-0000-0000-000000000001';
            SET LOCAL app.authorized_case_ids =
              '{10000000-0000-0000-0000-000000000001}';
            SELECT count(*) AS allowed_with_context FROM napp.cases;
            SELECT count(*) AS visible_revisions FROM napp.assertion_revisions;
            ROLLBACK;
            """,
        ).stdout
        values = [line.strip() for line in rls.splitlines() if line.strip().isdigit()]
        if values != ["0", "1", "4"]:
            raise AssertionError(f"unexpected RLS counts:\n{rls}")

        psql(
            database,
            """
            INSERT INTO napp.audit_events
              (actor_id, purpose_id, case_id, event_type, outcome, metadata)
            VALUES
              ('20000000-0000-0000-0000-000000000001',
               '70000000-0000-0000-0000-000000000001',
               '10000000-0000-0000-0000-000000000001',
               'live_test', 'succeeded', '{"content_free": true}');
            DO $$
            BEGIN
              IF (SELECT count(*) FROM napp.audit_events) <> 1
                 OR (SELECT last_sequence FROM napp.audit_chain_heads
                     WHERE chain_name = 'primary') <> 1
              THEN RAISE EXCEPTION 'audit chain did not advance'; END IF;
            END $$;
            """,
        )

        apply_file(
            database,
            ROOT / "db/migrations/0003_security_identity_and_grants.down.sql",
        )
        security_remaining = psql(
            database,
            "SELECT to_regclass('napp.security_actors') IS NULL;",
        ).stdout.strip()
        if security_remaining != "t":
            raise AssertionError("0003 rollback left security tables")
        apply_file(database, ROOT / "db/migrations/0002_jobs_and_staleness.down.sql")
        jobs_remaining = psql(
            database,
            "SELECT to_regclass('napp.jobs') IS NULL;",
        ).stdout.strip()
        if jobs_remaining != "t":
            raise AssertionError("0002 rollback left durable-job tables")
        apply_file(database, ROOT / "db/migrations/0001_initial.down.sql")
        remaining = psql(
            database,
            "SELECT count(*) FROM pg_namespace WHERE nspname = 'napp';",
        ).stdout
        if remaining.strip() != "0":
            raise AssertionError(f"rollback left napp schema:\n{remaining}")

        print(
            "PostgreSQL 18 live integration: migrations, bitemporal correction, "
            "concurrency, forced RLS, shared identity/grants/replay, atomic "
            "publication, stale propagation, audit chain, and rollback passed"
        )
        return 0
    except Exception:
        if log.exists():
            sys.stderr.write("\n--- postgres log ---\n")
            sys.stderr.write(log.read_text(encoding="utf-8", errors="replace"))
        raise
    finally:
        if started:
            run(
                [binary("pg_ctl"), "-D", str(cluster), "-m", "immediate", "stop"],
                check=False,
            )
        shutil.rmtree(cluster, ignore_errors=True)
        log.unlink(missing_ok=True)


if __name__ == "__main__":
    raise SystemExit(main())
