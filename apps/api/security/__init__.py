"""Production-oriented OIDC and policy boundary contracts."""

from .adapters import (
    DeterministicFakeVerifier,
    InMemoryReplayProtector,
    StaticActorMapper,
)
from .boundary import (
    ActorMappingDenied,
    AuthorizationBoundary,
    GrantDenied,
    IdentityClaimsRejected,
    PolicyDenied,
    SecurityBoundaryError,
)
from .models import (
    Actor,
    AuditOutcome,
    AuthorizationRequest,
    AuthorizationSession,
    CaseGrant,
    ConnectionTransactionContext,
    OIDCRequirements,
    PolicyDecision,
    PolicyInput,
    PurposeSelection,
    SecurityAuditEvent,
    VerifiedIdentityClaims,
)
from .protocols import (
    ActorMapper,
    IdentityVerificationError,
    IdentityVerifier,
    PolicyEvaluator,
    ReplayProtector,
)
from .postgres import (
    PostgreSQLActorMapper,
    PostgreSQLCaseGrantStore,
    PostgreSQLReplayProtector,
)
from .pyjwt_verifier import PyJWKIdentityVerifier

__all__ = [
    "Actor",
    "ActorMapper",
    "ActorMappingDenied",
    "AuditOutcome",
    "AuthorizationBoundary",
    "AuthorizationRequest",
    "AuthorizationSession",
    "CaseGrant",
    "ConnectionTransactionContext",
    "DeterministicFakeVerifier",
    "GrantDenied",
    "IdentityClaimsRejected",
    "IdentityVerificationError",
    "IdentityVerifier",
    "InMemoryReplayProtector",
    "OIDCRequirements",
    "PolicyDecision",
    "PolicyDenied",
    "PolicyEvaluator",
    "PolicyInput",
    "PostgreSQLActorMapper",
    "PostgreSQLCaseGrantStore",
    "PostgreSQLReplayProtector",
    "PyJWKIdentityVerifier",
    "PurposeSelection",
    "ReplayProtector",
    "SecurityAuditEvent",
    "SecurityBoundaryError",
    "StaticActorMapper",
    "VerifiedIdentityClaims",
]
