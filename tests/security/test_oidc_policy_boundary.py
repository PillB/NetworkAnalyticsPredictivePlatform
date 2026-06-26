from __future__ import annotations

import unittest
from dataclasses import asdict
from datetime import datetime, timedelta, timezone

from apps.api.security import (
    Actor,
    AuditOutcome,
    AuthorizationBoundary,
    AuthorizationRequest,
    CaseGrant,
    ConnectionTransactionContext,
    DeterministicFakeVerifier,
    GrantDenied,
    IdentityClaimsRejected,
    IdentityVerificationError,
    InMemoryReplayProtector,
    OIDCRequirements,
    PolicyDecision,
    PolicyDenied,
    PurposeSelection,
    SecurityAuditEvent,
    StaticActorMapper,
    VerifiedIdentityClaims,
)

UTC = timezone.utc
NOW = datetime(2026, 6, 25, 12, tzinfo=UTC)


class StaticPolicy:
    def __init__(
        self,
        *,
        allowed: bool = True,
        version: str = "policy-7",
        labels: tuple[str, ...] = ("internal",),
        fields: tuple[str, ...] = ("subject_ref",),
    ) -> None:
        self.allowed = allowed
        self.version = version
        self.labels = labels
        self.fields = fields

    def evaluate(self, policy_input):
        return PolicyDecision(
            allowed=self.allowed,
            policy_version=self.version,
            decision_id="decision-1",
            allowed_handling_labels=self.labels,
            allowed_fields=self.fields,
            reason_code="allowed" if self.allowed else "role_denied",
        )


class BrokenPolicy:
    def evaluate(self, policy_input):
        raise RuntimeError("policy unavailable")


def claims(**overrides) -> VerifiedIdentityClaims:
    values = {
        "issuer": "https://id.example.test",
        "subject": "subject-1",
        "audiences": ("network-api",),
        "expires_at": NOW + timedelta(minutes=20),
        "issued_at": NOW - timedelta(minutes=1),
        "nonce": "nonce-1",
        "acr": "urn:example:loa:2",
        "token_id": "token-1",
        "verification_method": "fake:signed-fixture",
    }
    values.update(overrides)
    return VerifiedIdentityClaims(**values)


def grant(**overrides) -> CaseGrant:
    values = {
        "grant_id": "grant-1",
        "actor_id": "actor-1",
        "case_id": "case-1",
        "purposes": ("analysis",),
        "expires_at": NOW + timedelta(minutes=30),
        "policy_version": "policy-7",
        "allowed_handling_labels": ("internal", "restricted"),
        "allowed_fields": ("subject_ref", "object_value"),
    }
    values.update(overrides)
    return CaseGrant(**values)


def request(**overrides) -> AuthorizationRequest:
    values = {
        "case_id": "case-1",
        "purpose": PurposeSelection("purpose-analysis", "analysis"),
        "requested_handling_labels": ("internal", "restricted"),
        "requested_fields": ("subject_ref", "object_value"),
    }
    values.update(overrides)
    return AuthorizationRequest(**values)


class SecurityFixture(unittest.TestCase):
    def requirements(self, **overrides) -> OIDCRequirements:
        values = {
            "issuer": "https://id.example.test",
            "audience": "network-api",
            "minimum_acr": "urn:example:loa:2",
        }
        values.update(overrides)
        return OIDCRequirements(**values)

    def boundary(self, policy=None) -> AuthorizationBoundary:
        actor = Actor(
            actor_id="actor-1",
            identity_issuer="https://id.example.test",
            identity_subject="subject-1",
            roles=("analyst",),
        )
        return AuthorizationBoundary(
            requirements=self.requirements(),
            actor_mapper=StaticActorMapper(
                {(actor.identity_issuer, actor.identity_subject): actor}
            ),
            replay_protector=InMemoryReplayProtector(),
            policy_evaluator=policy or StaticPolicy(),
            current_policy_version="policy-7",
            session_id_factory=lambda: "session-1",
        )


class VerifierTests(SecurityFixture):
    def verify(self, identity: VerifiedIdentityClaims) -> VerifiedIdentityClaims:
        verifier = DeterministicFakeVerifier({"opaque-signed": identity})
        return verifier.verify(
            "opaque-signed",
            requirements=self.requirements(),
            expected_nonce="nonce-1",
            now=NOW,
        )

    def test_rejects_wrong_issuer(self) -> None:
        with self.assertRaises(IdentityVerificationError):
            self.verify(claims(issuer="https://attacker.example"))

    def test_rejects_wrong_audience(self) -> None:
        with self.assertRaises(IdentityVerificationError):
            self.verify(claims(audiences=("different-api",)))

    def test_rejects_expired_claims(self) -> None:
        with self.assertRaises(IdentityVerificationError):
            self.verify(claims(expires_at=NOW))

    def test_rejects_unknown_or_unsigned_input(self) -> None:
        verifier = DeterministicFakeVerifier({})
        with self.assertRaises(IdentityVerificationError):
            verifier.verify(
                "eyJhbGciOiJub25lIn0.unsigned.",
                requirements=self.requirements(),
                expected_nonce="nonce-1",
                now=NOW,
            )

    def test_rejects_nonce_mismatch(self) -> None:
        with self.assertRaises(IdentityVerificationError):
            self.verify(claims(nonce="another-nonce"))


class BoundaryTests(SecurityFixture):
    def test_missing_purpose_is_rejected_at_contract_boundary(self) -> None:
        with self.assertRaises(ValueError):
            PurposeSelection("purpose-analysis", "")

    def test_revoked_and_stale_grants_are_denied(self) -> None:
        for invalid_grant in (
            grant(revoked_at=NOW - timedelta(seconds=1)),
            grant(policy_version="policy-6"),
        ):
            with self.subTest(grant=invalid_grant):
                with self.assertRaises(GrantDenied):
                    self.boundary().derive_session(
                        claims=claims(),
                        expected_nonce="nonce-1",
                        grant=invalid_grant,
                        request=request(),
                        now=NOW,
                    )

    def test_boundary_rechecks_nonce_and_rejects_replay(self) -> None:
        boundary = self.boundary()
        with self.assertRaises(IdentityClaimsRejected):
            boundary.derive_session(
                claims=claims(),
                expected_nonce="wrong-nonce",
                grant=grant(),
                request=request(),
                now=NOW,
            )

        session = boundary.derive_session(
            claims=claims(),
            expected_nonce="nonce-1",
            grant=grant(),
            request=request(),
            now=NOW,
        )
        self.assertEqual("session-1", session.session_id)
        with self.assertRaises(IdentityClaimsRejected):
            boundary.derive_session(
                claims=claims(),
                expected_nonce="nonce-1",
                grant=grant(),
                request=request(),
                now=NOW,
            )

    def test_session_uses_least_privilege_intersection(self) -> None:
        policy = StaticPolicy(
            labels=("internal", "policy-only"),
            fields=("subject_ref", "policy-only"),
        )
        session = self.boundary(policy).derive_session(
            claims=claims(),
            expected_nonce="nonce-1",
            grant=grant(),
            request=request(),
            now=NOW,
        )

        self.assertEqual(("internal",), session.allowed_handling_labels)
        self.assertEqual(("subject_ref",), session.allowed_fields)
        self.assertEqual(claims().expires_at, session.expires_at)

    def test_policy_errors_and_non_current_decisions_fail_closed(self) -> None:
        for policy in (
            BrokenPolicy(),
            StaticPolicy(allowed=False),
            StaticPolicy(version="policy-6"),
        ):
            with self.subTest(policy=type(policy).__name__):
                with self.assertRaises(PolicyDenied):
                    self.boundary(policy).derive_session(
                        claims=claims(),
                        expected_nonce="nonce-1",
                        grant=grant(),
                        request=request(),
                        now=NOW,
                    )

    def test_transaction_context_is_derived_from_session(self) -> None:
        session = self.boundary().derive_session(
            claims=claims(),
            expected_nonce="nonce-1",
            grant=grant(),
            request=request(),
            now=NOW,
        )
        context = ConnectionTransactionContext.from_session(session)

        self.assertEqual(
            {
                "app.actor_id": "actor-1",
                "app.purpose_id": "purpose-analysis",
                "app.authorized_case_ids": "{case-1}",
                "app.authorization_session_id": "session-1",
                "app.policy_version": "policy-7",
            },
            dict(context.values),
        )

    def test_audit_event_is_content_free(self) -> None:
        event = SecurityAuditEvent(
            event_id="audit-1",
            event_type="authorization_session",
            outcome=AuditOutcome.ALLOWED,
            occurred_at=NOW,
            request_id="request-1",
            actor_id="actor-1",
            case_id="case-1",
            purpose_id="purpose-analysis",
            grant_id="grant-1",
            session_id="session-1",
            policy_version="policy-7",
            reason_code="allowed",
        )

        audit = asdict(event)
        forbidden = {
            "content",
            "payload",
            "claims",
            "credential",
            "token",
            "query",
            "evidence",
            "source",
            "result",
        }
        self.assertTrue(forbidden.isdisjoint(audit))
        self.assertNotIn("object_value", repr(audit))


if __name__ == "__main__":
    unittest.main()
