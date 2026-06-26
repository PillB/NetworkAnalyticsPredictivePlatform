"""Small deterministic adapters useful for composition and tests."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from threading import Lock
from typing import Mapping

from .models import Actor, OIDCRequirements, VerifiedIdentityClaims, require_aware
from .protocols import IdentityVerificationError


@dataclass
class DeterministicFakeVerifier:
    """Verifies registered opaque credentials without parsing or accepting JWTs."""

    credentials: Mapping[str, VerifiedIdentityClaims]

    def verify(
        self,
        credential: str,
        *,
        requirements: OIDCRequirements,
        expected_nonce: str,
        now: datetime,
    ) -> VerifiedIdentityClaims:
        require_aware(now, "now")
        claims = self.credentials.get(credential)
        if claims is None:
            raise IdentityVerificationError("credential is unknown or unsigned")
        if claims.issuer != requirements.issuer:
            raise IdentityVerificationError("issuer mismatch")
        if requirements.audience not in claims.audiences:
            raise IdentityVerificationError("audience mismatch")
        if claims.expires_at <= now:
            raise IdentityVerificationError("credential expired")
        if claims.issued_at > now:
            raise IdentityVerificationError("credential issued in the future")
        if requirements.require_nonce and claims.nonce != expected_nonce:
            raise IdentityVerificationError("nonce mismatch")
        if claims.acr != requirements.minimum_acr:
            raise IdentityVerificationError("authentication assurance is insufficient")
        return claims


@dataclass(frozen=True)
class StaticActorMapper:
    actors: Mapping[tuple[str, str], Actor]

    def map_actor(self, claims: VerifiedIdentityClaims) -> Actor | None:
        return self.actors.get((claims.issuer, claims.subject))


@dataclass
class InMemoryReplayProtector:
    """Thread-safe reference adapter; production may use a shared atomic store."""

    _consumed: set[tuple[str, str, str, str]] = field(default_factory=set)
    _lock: Lock = field(default_factory=Lock)

    def consume(self, claims: VerifiedIdentityClaims, *, now: datetime) -> bool:
        require_aware(now, "now")
        key = (
            claims.issuer,
            claims.subject,
            claims.token_id,
            claims.nonce or "",
        )
        with self._lock:
            if key in self._consumed:
                return False
            self._consumed.add(key)
            return True
