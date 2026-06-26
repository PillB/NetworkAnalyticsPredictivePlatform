# ADR 0003: React Workbench with Cytoscape Adapter

## Status

Accepted for P0, subject to rendering and accessibility spikes.

## Decision

Use React and TypeScript with a coordinated workspace. Use Cytoscape.js behind an internal renderer adapter, union-projection layout manifests, and a separate DOM/table accessibility representation.

## Rationale

Cytoscape supports the bounded graph size, investigative styling, preset coordinates, compound semantics, and interaction needed for P0. An adapter permits later migration.

## Alternatives

- Sigma.js: deferred for larger WebGL workloads.
- Independent force layouts: rejected because they destroy temporal orientation.
- Canvas-only accessibility: rejected.

## Migration trigger

Reassess when measured Cytoscape workloads fail budgets or visible projections exceed the bounded interaction model.

## Traceability

REQ-FR-006, 007, 013, 014; REQ-NFR-002, 003, 006; GATE-I, J, L.
