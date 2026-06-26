# ADR 0006: Predictive Models as Gated Derived Artifacts

## Status

Accepted.

## Decision

Predictive models are P1/P2 optional modules. They consume immutable authorized feature snapshots and publish versioned derived artifacts. They cannot alter evidence, identity, permissions, temporal history, or community lineage.

## Constraints

- No person-level criminality or guilt score.
- Required baseline, calibration, robustness, explanation, abstention, and human-review gates.
- Model outputs are never source assertions.

## Traceability

REQ-FR-025–027; GATE-E, F, G, H, K.
