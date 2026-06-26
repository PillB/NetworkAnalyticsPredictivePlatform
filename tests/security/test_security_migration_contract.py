from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
FORWARD = ROOT / "db/migrations/0003_security_identity_and_grants.sql"
ROLLBACK = (
    ROOT / "db/migrations/0003_security_identity_and_grants.down.sql"
)


def normalized(path: Path) -> str:
    sql = re.sub(r"--[^\n]*", " ", path.read_text(encoding="utf-8"))
    return re.sub(r"\s+", " ", sql).strip().lower()


class SecurityMigrationContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.forward = normalized(FORWARD)
        cls.rollback = normalized(ROLLBACK)

    def test_transactional_scoped_migrations(self) -> None:
        self.assertRegex(self.forward, r"^begin;")
        self.assertRegex(self.forward, r"commit;$")
        self.assertRegex(self.rollback, r"^begin;")
        self.assertRegex(self.rollback, r"commit;$")
        self.assertNotIn("drop schema", self.rollback)
        self.assertNotIn("on delete cascade", self.forward)

    def test_only_digests_of_oidc_identifiers_are_persisted(self) -> None:
        for table in (
            "security_actors",
            "case_access_grants",
            "case_access_grant_revocations",
            "oidc_replay_consumptions",
        ):
            self.assertIn(f"create table napp.{table}", self.forward)
        self.assertIn("issuer_digest bytea not null", self.forward)
        self.assertIn("subject_digest bytea not null", self.forward)
        self.assertIn("token_digest bytea not null", self.forward)
        self.assertIn("nonce_digest bytea not null", self.forward)
        self.assertNotRegex(self.forward, r"\b(raw_token|claims_payload|jwt)\b")

    def test_grants_and_revocations_are_separate_append_only_records(self) -> None:
        self.assertIn("case_access_grants_append_only", self.forward)
        self.assertIn("case_access_grant_revocations_append_only", self.forward)
        self.assertIn("reject_security_record_mutation", self.forward)
        self.assertIn("not exists ( select 1 from napp.case_access_grant_revocations", self.forward)

    def test_replay_consumption_is_atomic_and_expiring(self) -> None:
        self.assertIn("create function napp.consume_oidc_replay(", self.forward)
        self.assertIn(
            "on conflict (issuer_digest, token_digest, nonce_digest) do nothing",
            self.forward,
        )
        self.assertIn("return found", self.forward)
        self.assertIn("target_expires_at <= statement_timestamp()", self.forward)
        self.assertIn("oidc_replay_expiry_idx", self.forward)

    def test_security_definer_functions_are_hardened_and_not_public(self) -> None:
        self.assertEqual(3, self.forward.count("security definer"))
        self.assertEqual(
            3, self.forward.count("set search_path = pg_catalog, napp")
        )
        self.assertIn(
            "revoke all on function napp.resolve_security_actor(bytea, bytea) from public",
            self.forward,
        )
        self.assertIn(
            "revoke all on function napp.consume_oidc_replay",
            self.forward,
        )


if __name__ == "__main__":
    unittest.main()
