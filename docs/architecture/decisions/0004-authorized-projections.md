# ADR 0004: Authorized Immutable Graph Projections

## Status

Accepted.

## Decision

All traversal, community analysis, layouts, and future model inference operate on immutable projections created after purpose-, case-, source-, field-, and policy-aware authorization.

## Rationale

Computing over restricted data and hiding it later can leak topology, counts, paths, communities, or model effects. Projection manifests provide exact reproducibility and cache isolation.

## Consequences

- Cache keys include authorization and policy digests.
- Projections carry exact assertion-revision identifiers.
- Long jobs are reauthorized before publication.
- Future graph databases and ML systems receive only projection contracts.

## Traceability

REQ-FR-001, 003–010, 014, 023; GATE-A, B, C, H, K.
