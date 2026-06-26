# ADR 0015: PostgreSQL Security Store Adapters

## Status

Accepted.

## Decision

Multi-instance deployments use PostgreSQL-backed adapters for actor mapping,
case-grant lookup, and replay consumption. The adapters call the hardened
`SECURITY DEFINER` functions introduced by migration 0003 rather than selecting
security tables directly. These stores remain separate from evidence, graph,
report, and analytical-result tables.

Actor mapping passes 32-byte SHA-256 issuer and subject digests to
`napp.resolve_security_actor`. The database stores
the issuer fingerprint, subject digest, internal actor UUID, roles, and active
state. It does not store raw issuer or subject values, credentials, tokens,
nonces, or complete claims. The adapter
reconstructs the in-memory actor's verified issuer and subject from the already
verified claims only after one active mapping is found.

Grant lookup calls `napp.resolve_current_case_grant` with a parameterized actor
UUID, case UUID, explicit purpose, current policy version, and aware evaluation
time. The function excludes grants that are not yet issued, expired, or
revoked by that time. Missing, malformed, stale, or unavailable grant state
fails closed.

Replay protection hashes issuer, subject, token ID, and nonce independently
and calls `napp.consume_oidc_replay` with those derived identifiers and
credential expiry. The database function performs one atomic
`INSERT ... ON CONFLICT DO NOTHING`. Already expired verified claims are
rejected before database access. Conflict and database errors return denial
rather than falling back to process-local state.

## Rationale

Process-local replay and mapping adapters cannot coordinate multiple API
instances. PostgreSQL provides transactional uniqueness for replay defense and
one authoritative revocation view without introducing another distributed
system. Digesting issuer, subject, token, and nonce identifiers reduces
disclosure if this narrow store is exposed, while issuer-and-subject mapping
remains deterministic.

## Consequences

- Digest values are sensitive pseudonymous security metadata, not
  anonymization; database access, backup encryption, retention, and audit
  controls still apply.
- SHA-256 UTF-8 digest construction is a compatibility contract and must not
  change without a versioned migration.
- Keyed hashing may replace SHA-256 if deployment threat analysis requires
  resistance to offline enumeration of a small identity namespace.
- A live PostgreSQL concurrency test is required before these adapters can be
  enabled in production.
- Authentication verification remains outside these stores. They accept only
  `VerifiedIdentityClaims`.

## Traceability

Extends ADR 0012. Supports DEC-006, DEC-012; REQ-FR-001, REQ-FR-014,
REQ-FR-016, REQ-FR-023; REQ-NFR-004, REQ-NFR-010; BB-AUTH-001–006; GATE-K.
