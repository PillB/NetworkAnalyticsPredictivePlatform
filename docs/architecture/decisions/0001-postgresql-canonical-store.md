# ADR 0001: PostgreSQL as Canonical Store

## Status

Accepted for P0.

## Decision

Use PostgreSQL 18 as the authoritative store for temporal assertions, provenance, authorization context, jobs, findings, reports, and audit. Build disposable graph projections for traversal, visualization, and analytics.

## Rationale

The P0 differentiator depends more on bitemporal correctness, transactions, provenance, correction impact, authorization, and report reconstruction than unbounded traversal.

## Alternatives

- Neo4j-first: stronger traversal but weaker P0 fit for transactional temporal evidence and contextual authorization.
- Hybrid: strong queries but introduces projection drift, dual authorization, and operational complexity.

## Migration trigger

Add a rebuildable graph read model when representative bounded path workloads fail the Phase 2 budgets after relational tuning.

## Traceability

REQ-FR-002–005, REQ-FR-015–018; GATE-A, B, I, K.
