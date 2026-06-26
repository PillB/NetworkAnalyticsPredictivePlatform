"""Fail-closed derivation of purpose-bound authorization sessions."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Callable

from .models import (
    AuthorizationRequest,
    AuthorizationSession,
    CaseGrant,
    OIDCRequirements,
    PolicyInput,
    VerifiedIdentityClaims,
    require_aware,
)
from .protocols import ActorMapper, PolicyEvaluator, ReplayProtector


class SecurityBoundaryError(Exception):
    code = "security_boundary_denied"


class IdentityClaimsRejected(SecurityBoundaryError):
    code = "identity_claims_rejected"


class ActorMappingDenied(SecurityBoundaryError):
    code = "actor_mapping_denied"


class GrantDenied(SecurityBoundaryError):
    code = "case_grant_denied"


class PolicyDenied(SecurityBoundaryError):
    code = "policy_denied"


@dataclass(frozen=True)
class AuthorizationBoundary:
    requirements: OIDCRequirements
    actor_mapper: ActorMapper
    replay_protector: ReplayProtector
    policy_evaluator: PolicyEvaluator
    current_policy_version: str
    session_id_factory: Callable[[], str]

    def derive_session(
        self,
        *,
        claims: VerifiedIdentityClaims,
        expected_nonce: str,
        grant: CaseGrant,
        request: AuthorizationRequest,
        now: datetime,
    ) -> AuthorizationSession:
        require_aware(now, "now")
        self._validate_claims(claims, expected_nonce=expected_nonce, now=now)

        if not self.replay_protector.consume(claims, now=now):
            raise IdentityClaimsRejected("credential or nonce replayed")

        actor = self.actor_mapper.map_actor(claims)
        if actor is None or not actor.active:
            raise ActorMappingDenied("identity is not mapped to an active actor")

        self._validate_grant(grant, actor.actor_id, request, now)

        policy_input = PolicyInput(
            actor=actor,
            grant=grant,
            request=request,
            policy_version=self.current_policy_version,
            evaluated_at=now,
        )
        try:
            decision = self.policy_evaluator.evaluate(policy_input)
        except Exception as exc:
            raise PolicyDenied("policy evaluation failed closed") from exc

        if (
            decision is None
            or not decision.allowed
            or decision.policy_version != self.current_policy_version
        ):
            raise PolicyDenied("policy did not return a current explicit allow")

        labels = _least_privilege(
            request.requested_handling_labels,
            grant.allowed_handling_labels,
            decision.allowed_handling_labels,
        )
        fields = _least_privilege(
            request.requested_fields,
            grant.allowed_fields,
            decision.allowed_fields,
        )

        return AuthorizationSession(
            session_id=self.session_id_factory(),
            actor_id=actor.actor_id,
            case_id=request.case_id,
            purpose_id=request.purpose.purpose_id,
            purpose=request.purpose.purpose,
            grant_id=grant.grant_id,
            policy_version=decision.policy_version,
            policy_decision_id=decision.decision_id,
            allowed_handling_labels=labels,
            allowed_fields=fields,
            established_at=now,
            expires_at=min(claims.expires_at, grant.expires_at),
        )

    def _validate_claims(
        self,
        claims: VerifiedIdentityClaims,
        *,
        expected_nonce: str,
        now: datetime,
    ) -> None:
        if claims.issuer != self.requirements.issuer:
            raise IdentityClaimsRejected("issuer mismatch")
        if self.requirements.audience not in claims.audiences:
            raise IdentityClaimsRejected("audience mismatch")
        if claims.expires_at <= now:
            raise IdentityClaimsRejected("identity claims expired")
        if claims.issued_at > now:
            raise IdentityClaimsRejected("identity claims issued in the future")
        if self.requirements.require_nonce and (
            not expected_nonce or claims.nonce != expected_nonce
        ):
            raise IdentityClaimsRejected("nonce mismatch")
        if claims.acr != self.requirements.minimum_acr:
            raise IdentityClaimsRejected("authentication assurance is insufficient")

    def _validate_grant(
        self,
        grant: CaseGrant,
        actor_id: str,
        request: AuthorizationRequest,
        now: datetime,
    ) -> None:
        if grant.actor_id != actor_id or grant.case_id != request.case_id:
            raise GrantDenied("grant does not match actor and case")
        if grant.revoked_at is not None and grant.revoked_at <= now:
            raise GrantDenied("grant is revoked")
        if grant.expires_at <= now:
            raise GrantDenied("grant is expired")
        if grant.policy_version != self.current_policy_version:
            raise GrantDenied("grant policy version is stale")
        if request.purpose.purpose not in grant.purposes:
            raise GrantDenied("purpose is not permitted by grant")


def _least_privilege(
    requested: tuple[str, ...],
    granted: tuple[str, ...],
    policy_allowed: tuple[str, ...],
) -> tuple[str, ...]:
    return tuple(sorted(set(requested) & set(granted) & set(policy_allowed)))
