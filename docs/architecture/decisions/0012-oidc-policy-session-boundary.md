# ADR 0012: OIDC Identity and Purpose-Bound Policy Sessions

## Status

Accepted.

## Decision

Production authentication is delegated to an external OIDC provider and a
signature-verifying identity adapter. The application does not implement
password authentication, parse credentials in the policy layer, or accept
unsigned JWTs. The adapter returns a `VerifiedIdentityClaims` contract only
after cryptographic verification. The application boundary independently
checks the configured issuer, audience, expiry, issue time, nonce, and required
authentication-context (`acr`) value.

The boundary maps the verified `(issuer, subject)` pair to an active internal
actor. It requires an explicit purpose selection and a case grant matching that
actor, case, and purpose. A grant carries its expiry, optional revocation time,
policy version, handling-label allowance, and field allowance. Expired,
revoked, cross-actor, cross-case, wrong-purpose, and stale-policy grants deny
access.

Nonce and token identifiers are consumed through an atomic replay-protection
adapter. A repeated identity proof denies access. The in-memory implementation
is a deterministic reference only; multi-instance production deployments need
a shared atomic store with retention at least through credential expiry.

Policy evaluation uses a dependency-light protocol. Only an explicit allow
under the current policy version may establish an authorization session.
Missing decisions, denials, stale decisions, and evaluator errors fail closed.
Session handling labels and fields are the intersection of:

- values explicitly requested for the session;
- values allowed by the active case grant; and
- values allowed by the current policy decision.

The session expires at the earlier of identity expiry and grant expiry.
Transaction adapters derive transaction-local PostgreSQL context from the
session: actor UUID, purpose UUID, a one-element authorized-case UUID array
(mapping an external case key deterministically when necessary),
authorization-session ID, and policy version. Adapters must set these values
inside each transaction and must not preserve them across pooled connection
reuse.

Security audit intents are content-free. They contain event, request, actor,
case, purpose, grant, session, policy, outcome, reason, and time identifiers
only. Credentials, claims payloads, source content, queries, evidence, and
analytical results are excluded.

## Rationale

Separating cryptographic verification from application policy permits provider
and JWT-library changes without coupling policy contracts to either. Rechecking
semantic claims at the boundary protects against a misconfigured adapter.
Explicit purpose and current grants prevent an authenticated identity from
being treated as authorized by default. Least-privilege intersection prevents
either a broad request, broad grant, or broad policy result from independently
expanding a session.

The contracts are frozen standard-library dataclasses and protocols. This keeps
the boundary independently testable and avoids adding a second policy or token
framework before deployment requirements justify one.

## Consequences

- OIDC Authorization Code with PKCE and secure backend session handling remain
  transport-adapter responsibilities.
- A production verifier must validate signatures against trusted issuer keys,
  reject `alg=none` and disallowed algorithms, and apply key-rotation and clock
  policies before returning verified claims.
- Actor lifecycle, grant persistence, revocation distribution, and shared
  replay storage remain adapter responsibilities.
- Authentication success alone never creates case access.
- Long-running work must be reauthorized against a current grant and policy
  before publication.
- PostgreSQL RLS remains defense in depth; detailed field and handling policy
  stays in the application authorization boundary and authorized projections.

## Traceability

DEC-006, DEC-012; REQ-FR-001, REQ-FR-014, REQ-FR-016, REQ-FR-023;
REQ-NFR-004, REQ-NFR-010; BB-AUTH-001–006; GATE-K.
