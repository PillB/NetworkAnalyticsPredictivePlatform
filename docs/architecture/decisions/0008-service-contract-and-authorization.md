# ADR 0008: Service Contracts and Authorization Boundary

## Status

Accepted.

## Decision

The Python application boundary uses immutable, dependency-light, versioned JSON
contracts for case manifests, authorization contexts, authorized temporal
projections, comparisons, lineage results, report drafts, and structured
errors.

The service authorizes the case, purpose, and policy version before calling the
temporal repository. It then applies handling-label and field restrictions
while constructing the immutable projection. Traversal and analytics consume
only that projection; they must not compute over a broader result and hide
restricted output afterward.

Projection cache keys include the full authorization digest, policy version,
case manifest, temporal query, requested fields, source high-water marks, and
projection recipe version. Derived contracts retain exact projection and
assertion-revision dependencies.

## Rationale

Keeping contracts as frozen dataclasses avoids coupling the domain to a web
framework or validation library. Authorization-before-analysis prevents
restricted records from influencing visible topology, counts, communities, or
scores. Exact immutable dependencies make comparisons, lineage, and reports
deterministic and reconstructable.

## Consequences

- A missing, stale, cross-case, or impermissible authorization context fails
  before repository access.
- Revisions with disallowed handling labels or unmet field restrictions never
  enter an analytical projection.
- Cache entries cannot be reused across actor, purpose, grant, policy, case,
  field-selection, temporal, or source-version boundaries.
- Comparison, lineage, and report dependencies must share one authorization
  context.
- Report drafts inherit handling labels and carry exact revision identifiers;
  they do not depend on mutable “current” records.
- HTTP adapters translate `StructuredErrorV1` without embedding transport
  concerns in the service layer.

## Traceability

REQ-FR-001, 003–010, 014–016, 019, 023; BB-AUTH-001–006; GATE-A, B, C, H, K.
