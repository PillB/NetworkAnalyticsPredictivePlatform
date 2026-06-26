"""Immutable identity, grant, policy, session, audit, and RLS contracts."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timezone
from enum import Enum
from types import MappingProxyType
from typing import Mapping


def require_aware(value: datetime, field_name: str) -> None:
    if value.tzinfo is None or value.utcoffset() is None:
        raise ValueError(f"{field_name} must be timezone-aware")


def _required(value: str, field_name: str) -> None:
    if not value or not value.strip():
        raise ValueError(f"{field_name} is required")


def _sorted_unique(values: tuple[str, ...]) -> tuple[str, ...]:
    return tuple(sorted(set(values)))


@dataclass(frozen=True)
class OIDCRequirements:
    issuer: str
    audience: str
    minimum_acr: str
    require_nonce: bool = True

    def __post_init__(self) -> None:
        _required(self.issuer, "issuer")
        _required(self.audience, "audience")
        _required(self.minimum_acr, "minimum_acr")


@dataclass(frozen=True)
class VerifiedIdentityClaims:
    """Claims emitted only after an adapter has verified a signed credential."""

    issuer: str
    subject: str
    audiences: tuple[str, ...]
    expires_at: datetime
    issued_at: datetime
    nonce: str | None
    acr: str
    token_id: str
    verification_method: str

    def __post_init__(self) -> None:
        for name in (
            "issuer",
            "subject",
            "acr",
            "token_id",
            "verification_method",
        ):
            _required(getattr(self, name), name)
        if not self.audiences:
            raise ValueError("audiences is required")
        require_aware(self.expires_at, "expires_at")
        require_aware(self.issued_at, "issued_at")
        object.__setattr__(self, "audiences", _sorted_unique(self.audiences))


@dataclass(frozen=True)
class Actor:
    actor_id: str
    identity_issuer: str
    identity_subject: str
    roles: tuple[str, ...] = ()
    active: bool = True

    def __post_init__(self) -> None:
        for name in ("actor_id", "identity_issuer", "identity_subject"):
            _required(getattr(self, name), name)
        object.__setattr__(self, "roles", _sorted_unique(self.roles))


@dataclass(frozen=True)
class PurposeSelection:
    purpose_id: str
    purpose: str

    def __post_init__(self) -> None:
        _required(self.purpose_id, "purpose_id")
        _required(self.purpose, "purpose")


@dataclass(frozen=True)
class CaseGrant:
    grant_id: str
    actor_id: str
    case_id: str
    purposes: tuple[str, ...]
    expires_at: datetime
    policy_version: str
    allowed_handling_labels: tuple[str, ...]
    allowed_fields: tuple[str, ...]
    revoked_at: datetime | None = None

    def __post_init__(self) -> None:
        for name in ("grant_id", "actor_id", "case_id", "policy_version"):
            _required(getattr(self, name), name)
        if not self.purposes:
            raise ValueError("purposes is required")
        require_aware(self.expires_at, "expires_at")
        if self.revoked_at is not None:
            require_aware(self.revoked_at, "revoked_at")
        object.__setattr__(self, "purposes", _sorted_unique(self.purposes))
        object.__setattr__(
            self,
            "allowed_handling_labels",
            _sorted_unique(self.allowed_handling_labels),
        )
        object.__setattr__(self, "allowed_fields", _sorted_unique(self.allowed_fields))


@dataclass(frozen=True)
class AuthorizationRequest:
    case_id: str
    purpose: PurposeSelection
    requested_handling_labels: tuple[str, ...]
    requested_fields: tuple[str, ...]

    def __post_init__(self) -> None:
        _required(self.case_id, "case_id")
        object.__setattr__(
            self,
            "requested_handling_labels",
            _sorted_unique(self.requested_handling_labels),
        )
        object.__setattr__(
            self, "requested_fields", _sorted_unique(self.requested_fields)
        )


@dataclass(frozen=True)
class PolicyInput:
    actor: Actor
    grant: CaseGrant
    request: AuthorizationRequest
    policy_version: str
    evaluated_at: datetime

    def __post_init__(self) -> None:
        _required(self.policy_version, "policy_version")
        require_aware(self.evaluated_at, "evaluated_at")


@dataclass(frozen=True)
class PolicyDecision:
    allowed: bool
    policy_version: str
    decision_id: str
    allowed_handling_labels: tuple[str, ...] = ()
    allowed_fields: tuple[str, ...] = ()
    reason_code: str = "denied"

    def __post_init__(self) -> None:
        _required(self.policy_version, "policy_version")
        _required(self.decision_id, "decision_id")
        _required(self.reason_code, "reason_code")
        object.__setattr__(
            self,
            "allowed_handling_labels",
            _sorted_unique(self.allowed_handling_labels),
        )
        object.__setattr__(self, "allowed_fields", _sorted_unique(self.allowed_fields))


@dataclass(frozen=True)
class AuthorizationSession:
    session_id: str
    actor_id: str
    case_id: str
    purpose_id: str
    purpose: str
    grant_id: str
    policy_version: str
    policy_decision_id: str
    allowed_handling_labels: tuple[str, ...]
    allowed_fields: tuple[str, ...]
    established_at: datetime
    expires_at: datetime

    def __post_init__(self) -> None:
        for name in (
            "session_id",
            "actor_id",
            "case_id",
            "purpose_id",
            "purpose",
            "grant_id",
            "policy_version",
            "policy_decision_id",
        ):
            _required(getattr(self, name), name)
        require_aware(self.established_at, "established_at")
        require_aware(self.expires_at, "expires_at")
        if self.expires_at <= self.established_at:
            raise ValueError("expires_at must be later than established_at")
        object.__setattr__(
            self,
            "allowed_handling_labels",
            _sorted_unique(self.allowed_handling_labels),
        )
        object.__setattr__(self, "allowed_fields", _sorted_unique(self.allowed_fields))


class AuditOutcome(str, Enum):
    ALLOWED = "allowed"
    DENIED = "denied"


@dataclass(frozen=True)
class SecurityAuditEvent:
    """Content-free audit intent containing identifiers and outcome only."""

    event_id: str
    event_type: str
    outcome: AuditOutcome
    occurred_at: datetime
    request_id: str
    actor_id: str | None = None
    case_id: str | None = None
    purpose_id: str | None = None
    grant_id: str | None = None
    session_id: str | None = None
    policy_version: str | None = None
    reason_code: str | None = None

    def __post_init__(self) -> None:
        for name in ("event_id", "event_type", "request_id"):
            _required(getattr(self, name), name)
        require_aware(self.occurred_at, "occurred_at")


@dataclass(frozen=True)
class ConnectionTransactionContext:
    """Values an adapter may apply with transaction-local database settings."""

    actor_id: str
    purpose_id: str
    case_id: str
    authorization_session_id: str
    policy_version: str

    def __post_init__(self) -> None:
        for name in (
            "actor_id",
            "purpose_id",
            "case_id",
            "authorization_session_id",
            "policy_version",
        ):
            _required(getattr(self, name), name)

    @property
    def values(self) -> Mapping[str, str]:
        return MappingProxyType(
            {
                "app.actor_id": self.actor_id,
                "app.purpose_id": self.purpose_id,
                "app.authorized_case_ids": f"{{{self.case_id}}}",
                "app.authorization_session_id": self.authorization_session_id,
                "app.policy_version": self.policy_version,
            }
        )

    @classmethod
    def from_session(
        cls, session: AuthorizationSession
    ) -> "ConnectionTransactionContext":
        return cls(
            actor_id=session.actor_id,
            purpose_id=session.purpose_id,
            case_id=session.case_id,
            authorization_session_id=session.session_id,
            policy_version=session.policy_version,
        )


UTC = timezone.utc
