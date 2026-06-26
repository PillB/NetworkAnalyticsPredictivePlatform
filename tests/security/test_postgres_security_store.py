from __future__ import annotations

import unittest
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from typing import Any

from apps.api.security import (
    PostgreSQLActorMapper,
    PostgreSQLCaseGrantStore,
    PostgreSQLReplayProtector,
    VerifiedIdentityClaims,
)

UTC = timezone.utc
NOW = datetime(2026, 6, 25, 12, tzinfo=UTC)
ACTOR_ID = "20000000-0000-0000-0000-000000000001"
CASE_ID = "10000000-0000-0000-0000-000000000001"
GRANT_ID = "60000000-0000-0000-0000-000000000001"


def claims(**overrides: Any) -> VerifiedIdentityClaims:
    values: dict[str, Any] = {
        "issuer": "https://id.example.test",
        "subject": "sensitive-subject",
        "audiences": ("network-api",),
        "expires_at": NOW + timedelta(minutes=10),
        "issued_at": NOW - timedelta(minutes=1),
        "nonce": "sensitive-nonce",
        "acr": "urn:example:loa:2",
        "token_id": "sensitive-token-id",
        "verification_method": "test",
    }
    values.update(overrides)
    return VerifiedIdentityClaims(**values)


class FakeCursor:
    def __init__(self, connection: "FakeConnection") -> None:
        self.connection = connection

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, statement: str, parameters: tuple[Any, ...]) -> None:
        self.connection.calls.append((statement, parameters))
        if self.connection.error is not None:
            raise self.connection.error

    def fetchall(self) -> list[dict[str, Any]]:
        return list(self.connection.rows)


class FakeConnection:
    def __init__(
        self,
        rows: list[dict[str, Any]] | None = None,
        error: Exception | None = None,
    ) -> None:
        self.rows = rows or []
        self.error = error
        self.calls: list[tuple[str, tuple[Any, ...]]] = []
        self.transaction_count = 0

    @contextmanager
    def transaction(self):
        self.transaction_count += 1
        yield

    def cursor(self, *, row_factory: Any = None) -> FakeCursor:
        return FakeCursor(self)


class FakePool:
    def __init__(self, connection: FakeConnection) -> None:
        self.connection_value = connection

    @contextmanager
    def connection(self):
        yield self.connection_value


def grant_row(**overrides: Any) -> dict[str, Any]:
    row = {
        "grant_id": GRANT_ID,
        "actor_id": ACTOR_ID,
        "case_id": CASE_ID,
        "purposes": ["analysis"],
        "expires_at": NOW + timedelta(hours=1),
        "policy_version": "policy-7",
        "allowed_handling_labels": ["internal"],
        "allowed_fields": ["subject_ref"],
        "revoked_at": None,
    }
    row.update(overrides)
    return row


class PostgreSQLActorMapperTests(unittest.TestCase):
    def test_maps_active_actor_by_digest_without_querying_raw_claims(self) -> None:
        connection = FakeConnection(
            [{"actor_id": ACTOR_ID, "roles": ["analyst"]}]
        )

        actor = PostgreSQLActorMapper(FakePool(connection)).map_actor(claims())

        self.assertIsNotNone(actor)
        assert actor is not None
        self.assertEqual(ACTOR_ID, actor.actor_id)
        self.assertEqual(("analyst",), actor.roles)
        statement, parameters = connection.calls[0]
        self.assertIn("resolve_security_actor(%s, %s)", statement)
        self.assertEqual(2, len(parameters))
        self.assertIsInstance(parameters[0], bytes)
        self.assertEqual(32, len(parameters[0]))
        self.assertIsInstance(parameters[1], bytes)
        serialized = repr(parameters)
        for forbidden in (
            "https://id.example.test",
            "sensitive-subject",
            "sensitive-token-id",
            "sensitive-nonce",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_inactive_missing_ambiguous_and_database_error_fail_closed(self) -> None:
        cases = (
            FakeConnection([]),
            FakeConnection(
                [
                    {"actor_id": ACTOR_ID, "roles": []},
                    {"actor_id": ACTOR_ID, "roles": []},
                ]
            ),
            FakeConnection(error=RuntimeError("database unavailable")),
        )
        for connection in cases:
            with self.subTest(rows=connection.rows, error=connection.error):
                self.assertIsNone(
                    PostgreSQLActorMapper(FakePool(connection)).map_actor(claims())
                )


class PostgreSQLCaseGrantStoreTests(unittest.TestCase):
    def test_returns_one_active_expiring_revocable_grant(self) -> None:
        connection = FakeConnection([grant_row()])

        result = PostgreSQLCaseGrantStore(FakePool(connection)).find_active_grant(
            actor_id=ACTOR_ID,
            case_id=CASE_ID,
            purpose="analysis",
            policy_version="policy-7",
            now=NOW,
        )

        self.assertIsNotNone(result)
        assert result is not None
        self.assertEqual(GRANT_ID, result.grant_id)
        self.assertEqual(("analysis",), result.purposes)
        statement, parameters = connection.calls[0]
        self.assertIn("resolve_current_case_grant(", statement)
        self.assertEqual(
            (ACTOR_ID, CASE_ID, "analysis", "policy-7", NOW),
            parameters,
        )

    def test_missing_ambiguous_and_database_error_fail_closed(self) -> None:
        cases = (
            FakeConnection([]),
            FakeConnection([grant_row(), grant_row(grant_id=ACTOR_ID)]),
            FakeConnection(error=RuntimeError("database unavailable")),
        )
        for connection in cases:
            with self.subTest(rows=connection.rows, error=connection.error):
                result = PostgreSQLCaseGrantStore(
                    FakePool(connection)
                ).find_active_grant(
                    actor_id=ACTOR_ID,
                    case_id=CASE_ID,
                    purpose="analysis",
                    policy_version="policy-7",
                    now=NOW,
                )
                self.assertIsNone(result)

    def test_naive_time_is_rejected_before_database_access(self) -> None:
        connection = FakeConnection([grant_row()])
        with self.assertRaises(ValueError):
            PostgreSQLCaseGrantStore(FakePool(connection)).find_active_grant(
                actor_id=ACTOR_ID,
                case_id=CASE_ID,
                purpose="analysis",
                policy_version="policy-7",
                now=datetime(2026, 6, 25, 12),
            )
        self.assertEqual([], connection.calls)


class PostgreSQLReplayProtectorTests(unittest.TestCase):
    def test_atomic_consume_uses_digest_and_verified_expiry(self) -> None:
        connection = FakeConnection([{"consumed": True}])

        consumed = PostgreSQLReplayProtector(FakePool(connection)).consume(
            claims(), now=NOW
        )

        self.assertTrue(consumed)
        statement, parameters = connection.calls[0]
        self.assertIn("consume_oidc_replay(%s, %s, %s, %s, %s)", statement)
        self.assertIsInstance(parameters[0], bytes)
        self.assertEqual(32, len(parameters[0]))
        self.assertIsInstance(parameters[1], bytes)
        self.assertIsInstance(parameters[2], bytes)
        self.assertIsInstance(parameters[3], bytes)
        self.assertEqual(claims().expires_at, parameters[4])
        serialized = repr(parameters)
        for forbidden in (
            "https://id.example.test",
            "sensitive-subject",
            "sensitive-token-id",
            "sensitive-nonce",
        ):
            self.assertNotIn(forbidden, serialized)

    def test_conflict_and_database_error_fail_closed(self) -> None:
        for connection in (
            FakeConnection([{"consumed": False}]),
            FakeConnection(error=RuntimeError("database unavailable")),
        ):
            with self.subTest(error=connection.error):
                self.assertFalse(
                    PostgreSQLReplayProtector(FakePool(connection)).consume(
                        claims(), now=NOW
                    )
                )

    def test_expired_claims_fail_before_database_access(self) -> None:
        connection = FakeConnection([{"consumed": True}])
        self.assertFalse(
            PostgreSQLReplayProtector(FakePool(connection)).consume(
                claims(expires_at=NOW), now=NOW
            )
        )
        self.assertEqual([], connection.calls)

    def test_sql_is_parameterized(self) -> None:
        connections = (
            FakeConnection(
                [{"actor_id": ACTOR_ID, "roles": []}]
            ),
            FakeConnection([grant_row()]),
            FakeConnection([{"consumed": True}]),
        )
        PostgreSQLActorMapper(FakePool(connections[0])).map_actor(claims())
        PostgreSQLCaseGrantStore(FakePool(connections[1])).find_active_grant(
            actor_id=ACTOR_ID,
            case_id=CASE_ID,
            purpose="analysis",
            policy_version="policy-7",
            now=NOW,
        )
        PostgreSQLReplayProtector(FakePool(connections[2])).consume(
            claims(), now=NOW
        )

        for connection in connections:
            for statement, parameters in connection.calls:
                self.assertIn("%s", statement)
                self.assertNotIn(ACTOR_ID, statement)
                self.assertNotIn(CASE_ID, statement)
                self.assertNotIn("analysis", statement)
                self.assertTrue(parameters)


if __name__ == "__main__":
    unittest.main()
