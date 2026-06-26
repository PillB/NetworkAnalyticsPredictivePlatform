# Network Analytics Predictive Platform — Master Specification

Version: 0.1  
Date: June 25, 2026  
Status: authoritative implementation baseline

## 1. Purpose

This file is the entry point for all product requirements, architecture decisions, technical constraints, black-box tests, user tests, and release gates.

If implementation behavior conflicts with this specification, the conflict must be resolved through a documented requirement or architecture decision change. Code does not silently redefine the product.

## 2. Product objective

Deliver a professional criminal-network analysis application that:

- supports evidence-backed graph investigation;
- reconstructs valid history and historical knowledge independently;
- compares networks over time with stable visual orientation;
- detects communities and tracks birth, continuation, split, merge, death, and resurgence;
- preserves assertion-level provenance and downstream dependencies;
- provides explainable, uncertainty-aware decision support;
- supports CPU-only operation with optional acceleration;
- guides a novice through one complete analysis;
- gives experts efficient, customizable visualization and analysis controls; and
- enforces purpose, authorization, audit, correction, retention, and dissemination controls.

The platform does not determine guilt. Association, centrality, community membership, anomaly, or model output is not proof of criminal conduct.

## 3. Authoritative documents

### Research

- [Market, workflow, and governance baseline](docs/research/phase-1a-market-and-workflows.md)
- [Temporal graph and community research](docs/research/phase-1b-temporal-graphs-and-communities.md)
- [State-of-the-art synthesis and evaluation gates](docs/research/phase-1c-state-of-art-synthesis.md)

### Requirements and UX

- [Product and system requirements](docs/requirements/phase-2-product-requirements.md)
- [Financial fraud-ring and cuentas mulas use case](docs/requirements/financial-fraud-ring-use-case.md)
- [Guided analysis journey](docs/ux/guided-analysis-journey.md)
- [i2-class AI-enhanced execution checklist](docs/implementation/i2-better-ai-execution-checklist.md)

### Architecture

- [System architecture](docs/architecture/system-architecture.md)
- [ADR 0001: PostgreSQL canonical store](docs/architecture/decisions/0001-postgresql-canonical-store.md)
- [ADR 0007: PostgreSQL bitemporal schema](docs/architecture/decisions/0007-postgresql-bitemporal-schema.md)
- [ADR 0008: Service contract and authorization](docs/architecture/decisions/0008-service-contract-and-authorization.md)
- [ADR 0002: Modular monolith and worker](docs/architecture/decisions/0002-modular-monolith-and-worker.md)
- [ADR 0003: React/Cytoscape workbench](docs/architecture/decisions/0003-react-cytoscape-workbench.md)
- [ADR 0004: Authorized immutable projections](docs/architecture/decisions/0004-authorized-projections.md)
- [ADR 0005: Detection/lineage separation](docs/architecture/decisions/0005-detection-lineage-separation.md)
- [ADR 0006: Predictive model boundary](docs/architecture/decisions/0006-predictive-model-boundary.md)
- [ADR 0011: PostgreSQL application repository](docs/architecture/decisions/0011-postgresql-application-repository.md)
- [ADR 0012: OIDC/policy session boundary](docs/architecture/decisions/0012-oidc-policy-session-boundary.md)
- [ADR 0013: Object storage and audit anchoring](docs/architecture/decisions/0013-object-storage-and-audit-anchoring.md)
- [ADR 0014: SDK-neutral S3-compatible adapters](docs/architecture/decisions/0014-sdk-neutral-s3-compatible-adapters.md)
- [ADR 0015: PostgreSQL security stores](docs/architecture/decisions/0015-postgresql-security-store-adapters.md)
- [ADR 0016: PyJWT OIDC verification](docs/architecture/decisions/0016-pyjwt-oidc-verification.md)
- [ADR 0017: Financial fraud-ring detection](docs/architecture/decisions/0017-financial-fraud-ring-detection.md)

### Verification

- [Black-box system tests](docs/specifications/black-box-tests.md)
- [User acceptance and journey tests](docs/specifications/user-acceptance-tests.md)
- [Requirements and decisions traceability](docs/specifications/traceability-matrix.md)

### Persistent execution state

- [Agent state](AGENT_STATE.md)

## 4. Product boundary

### P0 — first differentiated vertical slice

- Synthetic Harbor Lantern case.
- Synthetic financial transaction case for cuentas mulas and fraud-ring auto-detection.
- Purpose-bound case entry.
- Assertion-level temporal evidence.
- Valid-time and known-at reconstruction.
- Evidence and provenance drill-down.
- Search, bounded expansion, paths, filters, and synchronized views.
- Anchored before/after comparison.
- CPU community detection.
- Versioned community-lineage DAG.
- Split/merge/resurgence explanation and alternatives.
- Correction impact preview.
- Guided ELI5 analysis.
- Smart defaults and safe visualization customization.
- Direct graph manipulation: drag nodes, spin/rotate view, undo/redo layout edits, and reset to recommended layout without changing analysis versions.
- Structured finding and reconstructable report.
- Tamper-evident audit.
- Keyboard and equivalent table/text workflows.

### P1

- Reversible identity-resolution workflow.
- Collaborative review.
- Controlled dissemination and redaction.
- Retention and revalidation.
- Alternative hypotheses.
- Evidence-constrained lead prioritization after predictive gates pass.

### P2

- Temporal learned models.
- Incremental analytics.
- Larger graph read model.
- Advanced overlapping/multiplex communities.
- Streaming and optional GPU acceleration.

### Prohibited

- Person-level criminality or guilt scoring.
- Autonomous accusation, enforcement, or dissemination.
- Model outputs written into the evidence graph as facts.
- Protected-characteristic inference.
- Automatic identity merges without review.
- Hidden analytical defaults.
- Post-computation hiding of restricted data.

## 5. Functional requirements register

| ID | Priority | Summary |
|---|---:|---|
| REQ-FR-001 | P0 | Case and permissible-purpose scope |
| REQ-FR-002 | P0 | Assertion-level temporal model |
| REQ-FR-003 | P0 | Valid-at and known-at reconstruction |
| REQ-FR-004 | P0 | Complete provenance drill-down |
| REQ-FR-005 | P0 | Evidence-class separation |
| REQ-FR-006 | P0 | Temporal graph exploration |
| REQ-FR-007 | P0 | Anchored temporal comparison |
| REQ-FR-008 | P0 | Versioned community observations |
| REQ-FR-009 | P0 | Community-lineage DAG |
| REQ-FR-010 | P0 | Lineage explanation and alternatives |
| REQ-FR-011 | P0 | Guided novice analysis |
| REQ-FR-012 | P0 | Transparent smart defaults |
| REQ-FR-013 | P0 | Safe customizable visualization |
| REQ-FR-014 | P0 | Synchronized graph/timeline/map/table state |
| REQ-FR-015 | P0 | Structured finding and report |
| REQ-FR-016 | P0 | Tamper-evident audit |
| REQ-FR-017 | P0 | Correction impact preview |
| REQ-FR-018 | P0 | Immutable analysis versions |
| REQ-FR-019 | P0 | Complete loading/error/recovery states |
| REQ-FR-020 | P1 | Reversible identity resolution |
| REQ-FR-021 | P1 | Alternative hypotheses |
| REQ-FR-022 | P1 | Collaborative review |
| REQ-FR-023 | P1 | Controlled dissemination |
| REQ-FR-024 | P1 | Retention and revalidation |
| REQ-FR-025 | P1 | Evidence-constrained lead prioritization |
| REQ-FR-026 | P2 | Optional temporal learned models |
| REQ-FR-027 | P2 | Incremental analytics |
| REQ-FR-028 | P0 | Financial transaction mule-account and fraud-ring review workflow |
| REQ-FR-029 | P0 | Interactive graph layout manipulation with visual undo/redo/reset |

Detailed acceptance criteria are in the Phase 2 requirements.

## 6. Non-functional requirements register

| ID | Priority | Summary |
|---|---:|---|
| REQ-NFR-001 | P0 | Deterministic reconstruction and recorded stochastic variation |
| REQ-NFR-002 | P0 | Complete P0 workflow on 8 CPU cores / 16 GB / no GPU |
| REQ-NFR-003 | P0 | WCAG 2.2 AA critical journey |
| REQ-NFR-004 | P0 | Durable writes and atomic analytical publication |
| REQ-NFR-005 | P0 | Complete reproducibility manifest |
| REQ-NFR-006 | P0 | Evidentially neutral visual defaults |
| REQ-NFR-007 | P0 | Evidence, temporal validity, uncertainty, and alternatives |
| REQ-NFR-008 | P0 | Content-free operational telemetry |
| REQ-NFR-009 | P1 | 99.5% pilot monthly availability target |
| REQ-NFR-010 | P1 | Independently testable module interfaces |
| REQ-NFR-011 | P1 | Reproducible hardware and acceleration assumptions |
| REQ-NFR-012 | P1 | Localization-ready user-facing content |

## 7. Architecture decision register

| Decision | Outcome |
|---|---|
| DEC-001 | PostgreSQL 18 is the canonical authority |
| DEC-002 | FastAPI modular monolith plus separate analytics worker |
| DEC-003 | React/TypeScript/Vite investigation workbench |
| DEC-004 | Cytoscape.js through a renderer adapter |
| DEC-005 | Authorized immutable graph projections |
| DEC-006 | App policy service plus forced PostgreSQL RLS |
| DEC-007 | CPU python-igraph/Leiden community baseline |
| DEC-008 | Community detection and lineage are separate |
| DEC-009 | PostgreSQL-backed bounded analytical jobs |
| DEC-010 | Versioned S3-compatible source/report storage |
| DEC-011 | Structured reports with exact dependency versions |
| DEC-012 | OIDC authentication; no application-managed production passwords |
| DEC-013 | Redux workspace state, TanStack Query server state, XState tutorial |
| DEC-014 | Custom dual-time timeline and MapLibre map with accessible fallbacks |
| DEC-015 | OpenTelemetry with allowlisted content-free telemetry |
| DEC-016 | Predictive models are gated derived artifacts |
| DEC-017 | Graph database, distributed queue, Kubernetes, and external policy engine are deferred migration options |
| DEC-018 | One versioned Harbor Lantern JSON interchange is the canonical cross-layer fixture |
| DEC-019 | Temporal window projections are authorized before graph construction, comparison, lineage, and reporting |
| DEC-020 | FastAPI serves versioned service contracts and the workbench; static fallback is training-only and explicitly labeled |
| DEC-021 | PostgreSQL evidence revisions are append-only, valid-time ranged, known-from ranged, and linked by immutable correction lineage |
| DEC-022 | Playwright API-backed and fallback browser journeys are frontend promotion gates |
| DEC-023 | Durable analytical jobs use bounded attempts, case-scoped lease fencing, staged immutable outputs, atomic result-head publication, and exact stale dependencies |
| DEC-024 | The initial scoring capability is an uncalibrated relationship/gap evidence-review priority baseline with abstention, exact dependencies, sensitivity, and prohibited person-level criminality targets |
| DEC-025 | psycopg 3 imports external identities deterministically, applies transaction-local RLS context, and must serialize point/window projections identically to the reference temporal repository |
| DEC-026 | Production authorization sessions require verified OIDC claims, explicit purpose, current expiring case grants, replay protection, current explicit policy allow, least-privilege fields/labels, and pooled transaction context reset |
| DEC-027 | Source/report objects are immutable SHA-256-addressed artifacts; reports bind exact dependencies and audit checkpoints are exported as content-free chained receipts |
| DEC-028 | CPU feasibility claims require a reproducible hardware record, dataset shape, percentile measurements, and explicit distinction between in-memory feasibility and production database/service performance |
| DEC-029 | Shared identity state uses SHA-256 issuer/subject/token/nonce digests, immutable grants plus append-only revocations, and atomic PostgreSQL replay consumption; raw credentials and claims are prohibited |
| DEC-030 | Cloud object adapters require provider-guaranteed conditional create, provider SHA-256 checksums, immutable manifests, and fail-closed handling of ambiguous writes |
| DEC-031 | Automated browser accessibility checks are prerequisites only; representative novice, overreliance, keyboard, zoom/reflow, and screen-reader sessions control the human-factor release gate |
| DEC-032 | OIDC ID tokens are verified through a trusted HTTPS JWKS endpoint with a fixed asymmetric algorithm allowlist, required claims, nonce/ACR checks, and multi-audience authorized-party validation |
| DEC-033 | GitHub Pages publishes only the synthetic static-training MVP from a generated subpath-safe artifact; operational data, identity, policy, persistence, and API capabilities require the production deployment |
| DEC-034 | Financial fraud-ring and cuentas mulas MVP uses explainable CPU-first account/ring review indicators; temporal GNNs and adaptive models are gated derived artifacts |
| DEC-035 | Node dragging, graph spin/rotation, undo/redo, and layout reset are visualization-state operations and do not create analytical versions |

## 8. Required architecture invariants

- Evidence and derived analysis remain different record classes.
- Assertion revisions are not overwritten.
- Every graph projection records exact assertion revisions.
- Authorization is applied before traversal and analytics.
- Cache keys include authorization and policy identity.
- Analysis versions and visualization presets are separate.
- Community labels are local observations; lineage creates persistent identity.
- Analyst overrides create new versions and preserve algorithm output.
- Failed jobs never replace valid published results.
- Released reports never depend on mutable current state.
- Operational telemetry contains no raw case content.
- Canvas visualizations have equivalent semantic DOM/table representations.

## 9. Data and API contracts

Required versioned contracts:

```text
AssertionRevisionV1
HistoricalQueryV1
TemporalWindowQueryV1
TemporalWindowSnapshotV1
AuthorizationContextV1
CaseManifestV1
AuthorizedTemporalProjectionV1
ComparisonResultV1
LineageResultV1
ReportDraftV1
WorkbenchBootstrapV1
StructuredErrorV1
GraphProjectionV1
LayoutManifestV1
AnalysisRecipeV1
AnalysisVersionV1
CommunityObservationV1
CommunityLineageV1
ExplanationPackageV1
FindingV1
ReportManifestV1
JobStatusV1
AuditEventV1
FeatureSnapshotV1       future
PredictionArtifactV1    future
EvidencePriorityAssessmentV1
DurableJobV1
PublicationManifestV1
CorrectionImpactV1
AuthorizationSessionV1
ContentAddressedObjectV1
ExternalAuditAnchorReceiptV1
```

Breaking changes require a versioned contract and migration.

Evidence-priority indices are not probabilities or criminality/risk scores.
They may order relationships, events, hypotheses, anomalies, or evidence gaps
for human review, but never people by presumed guilt, dangerousness, or future
conduct. Operational use remains gated until temporal evaluation, robustness,
human-factor, and governance evidence is approved.

## 10. Smart-default contract

Every consequential default exposes:

- value;
- plain-language purpose;
- reason for selection;
- expected effect;
- risk or interpretation warning;
- customization;
- reset action; and
- version identifier.

Defaults cannot silently depend on protected attributes, future evidence, or inaccessible data.

## 11. Explanation contract

Every actionable derived output includes:

- precise question or target;
- source assertions;
- event/valid and known-at cutoffs;
- transformation and algorithm versions;
- supporting and contrary evidence;
- missingness and observation coverage;
- uncertainty and sensitivity;
- alternative explanations;
- effect of removing material evidence; and
- human review state.

Attention or generated prose alone is not an explanation.

## 12. Performance budgets

Reference P0 fixture:

- 1,000 entities;
- 10,000 relationships/assertions;
- 12 periods;
- 25 sources;
- corrections, supersession, uncertain identities, and missing intervals;
- 8 CPU cores, 16 GB RAM, no GPU.

| Operation | P95 |
|---|---:|
| Warm shell/case summary | 2 s |
| Search/provenance drill-down | 1 s |
| Historical reconstruction | 2 s |
| Two-period change | 3 s |
| Visible graph update, 1,000 nodes / 5,000 edges | 2 s |
| Pan/zoom/selection feedback | 100 ms |
| Community and lineage | 10 s |
| Correction impact preview | 5 s |
| Report generation | 10 s |

## 13. Release gates

- GATE-A: temporal correctness.
- GATE-B: complete provenance.
- GATE-C: community-lineage accuracy.
- GATE-D: uncertainty responsiveness.
- GATE-E: predictive value over baseline.
- GATE-F: predictive calibration.
- GATE-G: robustness.
- GATE-H: explanation validity.
- GATE-I: CPU performance.
- GATE-J: human factors.
- GATE-K: governance/security.
- GATE-L: accessibility.

P0 requires A, B, C, D, H, I, J, K, and L. Predictive gates E and F activate for P1/P2 models.

## 14. Definition of done

A feature is complete only when:

1. Its requirement and decision IDs are identified.
2. Black-box acceptance tests exist.
3. Unit/integration tests cover its invariants.
4. User and accessibility behavior is specified.
5. Authorization and audit behavior is tested.
6. Error, empty, stale, and recovery states exist.
7. Performance is measured where relevant.
8. Documentation is updated.
9. `AGENT_STATE.md` records the result.

## 15. Change control

Changes to P0 scope, prohibited behavior, data semantics, authorization order, evidence classes, predictive boundaries, or release gates require:

- documented rationale;
- impact on requirements and tests;
- ADR update or replacement;
- contradiction/risk review; and
- `AGENT_STATE.md` ledger entry.
