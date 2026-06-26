# ADR 0005: Separate Community Detection from Lineage

## Status

Accepted.

## Decision

Community observations are detector outputs local to a projection and period. A separate lineage module creates candidate links, accepted links, lifecycle events, persistent identities, uncertainty, and analyst overrides.

## Rationale

Detector labels are arbitrary. Temporal smoothing does not provide defensible split, merge, death, or resurgence semantics.

## Consequences

- Independent and temporally coupled detectors can be compared.
- Analyst corrections never overwrite detector output.
- Lineage confidence and alternatives are first-class.

## Traceability

REQ-FR-008–010; GATE-C, D, H.
