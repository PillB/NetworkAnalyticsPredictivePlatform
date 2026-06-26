from __future__ import annotations

import os
from pathlib import Path

import psycopg


ROOT = Path(__file__).resolve().parents[2]


def test_dsn() -> str | None:
    return os.environ.get("NAPP_TEST_DSN")


def ensure_migrations(dsn: str) -> None:
    """Apply 0001/0002 only when their marker tables are absent."""

    with psycopg.connect(dsn, autocommit=True) as connection:
        initial_exists = connection.execute(
            "SELECT to_regclass('napp.assertion_revisions')"
        ).fetchone()[0]
        if initial_exists is None:
            connection.execute(
                (ROOT / "db/migrations/0001_initial.sql").read_text(
                    encoding="utf-8"
                )
            )
        jobs_exists = connection.execute(
            "SELECT to_regclass('napp.jobs')"
        ).fetchone()[0]
        if jobs_exists is None:
            connection.execute(
                (ROOT / "db/migrations/0002_jobs_and_staleness.sql").read_text(
                    encoding="utf-8"
                )
            )
        security_exists = connection.execute(
            "SELECT to_regclass('napp.security_actors')"
        ).fetchone()[0]
        if security_exists is None:
            connection.execute(
                (
                    ROOT
                    / "db/migrations/0003_security_identity_and_grants.sql"
                ).read_text(encoding="utf-8")
            )
