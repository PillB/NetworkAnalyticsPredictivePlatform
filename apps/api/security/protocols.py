"""Adapter protocols for identity, actor mapping, replay, and policy."""

from __future__ import annotations

from datetime import datetime
from typing import Protocol

from .models import (
    Actor,
    OIDCRequirements,
    PolicyDecision,
    PolicyInput,
    VerifiedIdentityClaims,
)


class IdentityVerificationError(Exception):
    """Raised when a credential is not signed or does not meet OIDC requirements."""


class IdentityVerifier(Protocol):
    def verify(
        self,
        credential: str,
        *,
        requirements: OIDCRequirements,
        expected_nonce: str,
        now: datetime,
    ) -> VerifiedIdentityClaims:
        """Verify signature and claims; never accept unsigned credentials."""


class ActorMapper(Protocol):
    def map_actor(self, claims: VerifiedIdentityClaims) -> Actor | None:
        """Map a verified issuer/subject pair to an application actor."""


class ReplayProtector(Protocol):
    def consume(self, claims: VerifiedIdentityClaims, *, now: datetime) -> bool:
        """Atomically consume a token/nonce identity, returning false on replay."""


class PolicyEvaluator(Protocol):
    def evaluate(self, policy_input: PolicyInput) -> PolicyDecision:
        """Return an explicit decision; errors and missing decisions deny access."""
