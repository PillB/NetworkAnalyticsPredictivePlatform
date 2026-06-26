from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID

from apps.api.persistence.rls import RLSContext, TransactionScopedRLS
from apps.api.security import AuthorizationSession

from .fakes import FakeConnection, FakePool


ACTOR = UUID("20000000-0000-0000-0000-000000000001")
PURPOSE = UUID("70000000-0000-0000-0000-000000000001")
CASE = UUID("10000000-0000-0000-0000-000000000001")


class TransactionScopedRLSTests(unittest.TestCase):
    def test_context_sets_only_transaction_local_values(self) -> None:
        connection = FakeConnection()
        manager = TransactionScopedRLS(FakePool(connection))

        with manager.transaction(
            RLSContext(actor_id=ACTOR, purpose_id=PURPOSE, case_ids=(CASE,))
        ):
            pass

        self.assertEqual(3, len(connection.calls))
        self.assertTrue(
            all("set_config" in statement for statement, _ in connection.calls)
        )
        self.assertTrue(all(parameters[-1:] for _, parameters in connection.calls))
        self.assertEqual((f"{{{CASE}}}",), connection.calls[2][1])
        self.assertEqual(0, connection.rollback_count)

    def test_context_rolls_back_non_idle_connection_before_pool_reuse(self) -> None:
        connection = FakeConnection(leave_non_idle=True)
        manager = TransactionScopedRLS(FakePool(connection))

        with self.assertRaises(RuntimeError):
            with manager.transaction(
                RLSContext(actor_id=ACTOR, purpose_id=PURPOSE, case_ids=(CASE,))
            ):
                raise RuntimeError("application failure")

        self.assertEqual(1, connection.rollback_count)

    def test_authorization_session_sets_full_transaction_context(self) -> None:
        now = datetime(2026, 6, 25, tzinfo=timezone.utc)
        session = AuthorizationSession(
            session_id="session-7",
            actor_id=str(ACTOR),
            case_id="harbor-lantern",
            purpose_id=str(PURPOSE),
            purpose="analysis",
            grant_id="grant-7",
            policy_version="policy-7",
            policy_decision_id="decision-7",
            allowed_handling_labels=("training",),
            allowed_fields=("subject_ref",),
            established_at=now,
            expires_at=now + timedelta(minutes=5),
        )
        connection = FakeConnection()
        manager = TransactionScopedRLS(FakePool(connection))

        with manager.transaction(RLSContext.from_authorization_session(session)):
            pass

        settings = {
            statement.split("'")[1]: parameters[0]
            for statement, parameters in connection.calls
        }
        self.assertEqual(str(ACTOR), settings["app.actor_id"])
        self.assertEqual(str(PURPOSE), settings["app.purpose_id"])
        self.assertEqual("session-7", settings["app.authorization_session_id"])
        self.assertEqual("policy-7", settings["app.policy_version"])
