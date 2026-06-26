from __future__ import annotations

import unittest
from datetime import datetime
from uuid import UUID

from psycopg_pool import ConnectionPool

from apps.api.persistence import HarborLanternImporter, PostgreSQLAssertionRepository
from apps.api.temporal import HistoricalQuery, TemporalInterval, TemporalWindowQuery

from .postgres_helper import ensure_migrations, test_dsn


ACTOR = UUID("20000000-0000-0000-0000-000000000011")
PURPOSE = UUID("70000000-0000-0000-0000-000000000011")


def instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@unittest.skipUnless(test_dsn(), "NAPP_TEST_DSN is not set")
class PostgreSQLPersistenceIntegrationTests(unittest.TestCase):
    pool: ConnectionPool

    @classmethod
    def setUpClass(cls) -> None:
        dsn = test_dsn()
        if dsn is None:
            raise unittest.SkipTest("NAPP_TEST_DSN is not set")
        ensure_migrations(dsn)
        cls.pool = ConnectionPool(dsn, min_size=1, max_size=2)
        cls.pool.open()

    @classmethod
    def tearDownClass(cls) -> None:
        cls.pool.close()

    def repository(self) -> PostgreSQLAssertionRepository:
        HarborLanternImporter(
            self.pool, actor_id=ACTOR, purpose_id=PURPOSE
        ).import_fixture()
        return PostgreSQLAssertionRepository(
            self.pool, actor_id=ACTOR, purpose_id=PURPOSE
        )

    def test_fixture_import_is_idempotent_and_correction_aware(self) -> None:
        importer = HarborLanternImporter(
            self.pool, actor_id=ACTOR, purpose_id=PURPOSE
        )
        first = importer.import_fixture()
        second = importer.import_fixture()
        repository = PostgreSQLAssertionRepository(
            self.pool, actor_id=ACTOR, purpose_id=PURPOSE
        )

        before = repository.snapshot(
            HistoricalQuery(
                valid_at=instant("2026-03-10T00:00:00Z"),
                known_at=instant("2026-03-20T00:00:00Z"),
                case_id="harbor-lantern",
            )
        )
        after = repository.snapshot(
            HistoricalQuery(
                valid_at=instant("2026-03-10T00:00:00Z"),
                known_at=instant("2026-03-26T00:00:00Z"),
                case_id="harbor-lantern",
            )
        )

        self.assertEqual(first, second)
        self.assertIn("hl-berth-access-r1", before.revision_ids)
        self.assertNotIn("hl-berth-access-r2", before.revision_ids)
        self.assertNotIn("hl-berth-access-r1", after.revision_ids)
        self.assertIn("hl-berth-access-r2", after.revision_ids)
        self.assertEqual(
            "halcyon", repository.history("hl-berth-access")[1].object_value
        )

    def test_point_and_window_queries_do_not_leak_future_evidence(self) -> None:
        repository = self.repository()
        early = repository.snapshot(
            HistoricalQuery(
                valid_at=instant("2026-03-01T10:00:00Z"),
                known_at=instant("2026-03-10T00:00:00Z"),
                case_id="harbor-lantern",
            )
        )
        at_event = repository.snapshot(
            HistoricalQuery(
                valid_at=instant("2026-03-01T10:00:00Z"),
                known_at=instant("2026-03-21T00:00:00Z"),
                case_id="harbor-lantern",
            )
        )
        after_event = repository.snapshot(
            HistoricalQuery(
                valid_at=instant("2026-03-02T00:00:00Z"),
                known_at=instant("2026-03-21T00:00:00Z"),
                case_id="harbor-lantern",
            )
        )
        window = repository.window_snapshot(
            TemporalWindowQuery(
                valid_during=TemporalInterval(
                    instant("2026-03-01T00:00:00Z"),
                    instant("2026-03-02T00:00:00Z"),
                ),
                known_at=instant("2026-03-21T00:00:00Z"),
                case_id="harbor-lantern",
            )
        )

        self.assertNotIn("hl-radio-contact-r1", early.revision_ids)
        self.assertIn("hl-radio-contact-r1", at_event.revision_ids)
        self.assertNotIn("hl-radio-contact-r1", after_event.revision_ids)
        self.assertIn("hl-radio-contact-r1", window.revision_ids)
