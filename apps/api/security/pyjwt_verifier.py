"""Production-configurable OIDC ID-token verification using PyJWT."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

import jwt

from .models import OIDCRequirements, VerifiedIdentityClaims, require_aware
from .protocols import IdentityVerificationError


@dataclass
class PyJWKIdentityVerifier:
    """Verify signed OIDC ID tokens against a configured HTTPS JWKS endpoint."""

    jwks_url: str
    algorithms: tuple[str, ...] = ("RS256",)
    leeway_seconds: int = 30
    cache_lifespan_seconds: int = 300
    _client: Any = field(init=False, repr=False)

    def __post_init__(self) -> None:
        if not self.jwks_url.startswith("https://"):
            raise ValueError("jwks_url must use HTTPS")
        if not self.algorithms or any(
            algorithm.lower() == "none" or algorithm.startswith("HS")
            for algorithm in self.algorithms
        ):
            raise ValueError(
                "algorithms must be an explicit asymmetric allowlist"
            )
        if self.leeway_seconds < 0 or self.cache_lifespan_seconds < 1:
            raise ValueError("leeway and cache lifespan are invalid")
        self._client = jwt.PyJWKClient(
            self.jwks_url,
            cache_keys=True,
            lifespan=self.cache_lifespan_seconds,
        )

    def verify(
        self,
        credential: str,
        *,
        requirements: OIDCRequirements,
        expected_nonce: str,
        now: datetime,
    ) -> VerifiedIdentityClaims:
        require_aware(now, "now")
        if not credential or not expected_nonce:
            raise IdentityVerificationError(
                "credential and expected nonce are required"
            )
        try:
            signing_key = self._client.get_signing_key_from_jwt(credential)
            claims = jwt.decode(
                credential,
                signing_key.key,
                algorithms=list(self.algorithms),
                audience=requirements.audience,
                issuer=requirements.issuer,
                leeway=self.leeway_seconds,
                options={
                    "require": [
                        "iss",
                        "sub",
                        "aud",
                        "exp",
                        "iat",
                        "nonce",
                        "acr",
                        "jti",
                    ],
                    "verify_signature": True,
                    "verify_exp": True,
                    "verify_iat": True,
                    "verify_aud": True,
                    "verify_iss": True,
                },
            )
            audiences = _audiences(claims.get("aud"))
            _validate_authorized_party(
                claims,
                audiences=audiences,
                expected_audience=requirements.audience,
            )
            nonce = _required_string(claims, "nonce")
            acr = _required_string(claims, "acr")
            if nonce != expected_nonce:
                raise IdentityVerificationError("nonce mismatch")
            if acr != requirements.minimum_acr:
                raise IdentityVerificationError(
                    "authentication assurance is insufficient"
                )
            issued_at = _numeric_date(claims, "iat")
            expires_at = _numeric_date(claims, "exp")
            if issued_at > now:
                raise IdentityVerificationError(
                    "credential issued in the future"
                )
            if expires_at <= now:
                raise IdentityVerificationError("credential expired")
            return VerifiedIdentityClaims(
                issuer=_required_string(claims, "iss"),
                subject=_required_string(claims, "sub"),
                audiences=audiences,
                expires_at=expires_at,
                issued_at=issued_at,
                nonce=nonce,
                acr=acr,
                token_id=_required_string(claims, "jti"),
                verification_method=f"pyjwt:jwks:{signing_key.key_id}",
            )
        except IdentityVerificationError:
            raise
        except Exception as exc:
            raise IdentityVerificationError(
                "signed OIDC credential verification failed"
            ) from exc


def _required_string(claims: dict[str, Any], name: str) -> str:
    value = claims.get(name)
    if not isinstance(value, str) or not value:
        raise IdentityVerificationError(f"{name} claim is required")
    return value


def _numeric_date(claims: dict[str, Any], name: str) -> datetime:
    value = claims.get(name)
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        raise IdentityVerificationError(f"{name} claim must be a NumericDate")
    return datetime.fromtimestamp(value, timezone.utc)


def _audiences(value: Any) -> tuple[str, ...]:
    if isinstance(value, str) and value:
        return (value,)
    if (
        isinstance(value, list)
        and value
        and all(isinstance(item, str) and item for item in value)
    ):
        return tuple(value)
    raise IdentityVerificationError("aud claim is invalid")


def _validate_authorized_party(
    claims: dict[str, Any],
    *,
    audiences: tuple[str, ...],
    expected_audience: str,
) -> None:
    authorized_party = claims.get("azp")
    if len(audiences) > 1:
        if authorized_party != expected_audience:
            raise IdentityVerificationError(
                "multi-audience token requires matching azp"
            )
    elif authorized_party is not None and authorized_party != expected_audience:
        raise IdentityVerificationError("azp mismatch")
