# System Architecture

Date: June 25, 2026  
Status: approved P0 architecture

## 1. Architecture outcome

The P0 system is a security-focused modular monolith with a separate analytics worker:

```text
┌──────────────────────────────── Browser ────────────────────────────────┐
│ React + TypeScript investigation workbench                             │
│ Graph | Timeline | Map | Table | Evidence | Lineage | Guided workflow  │
└───────────────────────────────┬─────────────────────────────────────────┘
                                │ HTTPS / JSON / SSE
┌───────────────────────────────▼─────────────────────────────────────────┐
│ FastAPI application                                                    │
│                                                                       │
│ Cases & purpose     Temporal reconstruction    Graph projection/paths  │
│ Provenance          Policy & authorization     Analysis versioning     │
│ Findings/reports    Jobs & progress            Audit & correction      │
└───────────────┬────────────────────┬─────────────────────┬──────────────┘
                │                    │                     │
      ┌─────────▼────────┐  ┌────────▼────────┐  ┌────────▼────────────┐
      │ PostgreSQL 18   │  │ S3-compatible  │  │ Python CPU worker   │
      │ canonical data  │  │ object storage │  │ igraph/leidenalg    │
      │ history/policy  │  │ evidence/report│  │ lineage/sensitivity │
      │ jobs/audit      │  │ audit anchors  │  │ future gated models │
      └─────────────────┘  └─────────────────┘  └─────────────────────┘
                │
      OIDC identity provider + OpenTelemetry Collector
```

PostgreSQL is authoritative. Graph render models, community projections, layouts, reports, and future feature snapshots are versioned derived artifacts.

## 2. Why this shape

The most difficult product invariants are:

- valid-time and known-at reconstruction;
- immutable source and assertion history;
- exact provenance and downstream dependencies;
- purpose-, case-, source-, and field-aware authorization;
- correction impact;
- reproducible reports;
- audit integrity; and
- CPU-first operation.

A relational transactional authority fits these invariants better than a graph-database-first design. Bounded graph projections provide the P0 traversal and analytical workflow without dual-write consistency risk.

## 3. Technology baseline

### Frontend

- React 19 with TypeScript strict mode.
- Vite.
- React Router Data Mode.
- React Aria Components.
- Redux Toolkit for synchronized workspace state.
- TanStack Query for authoritative server state.
- XState for the versioned guided workflow only.
- Cytoscape.js behind an internal renderer adapter.
- React/SVG timeline with D3 time scales.
- TanStack Table using semantic table markup.
- TanStack Virtual only where measured and accessibility-tested.
- MapLibre GL JS with table/text fallback.
- React Hook Form and schema validation.
- CSS variables, modules, and design tokens.
- Vitest, React Testing Library, MSW, Storybook, Playwright, and axe.

### Backend

- Python 3.12 or later compatible runtime, pinned during scaffolding.
- FastAPI.
- Pydantic request/response contracts.
- SQLAlchemy with Psycopg and Alembic.
- PostgreSQL 18.
- PostgreSQL-backed bounded job queue.
- Python analytics worker.
- python-igraph and leidenalg.
- Arrow/Parquet analytical interchange.
- Versioned S3-compatible object storage.
- Jinja-based structured HTML and headless Chromium report rendering.
- OpenTelemetry instrumentation.

### Runtime and operations

- External OIDC; Keycloak is the reference self-hosted provider.
- Docker Compose for local development.
- Signed containers on a managed container service or hardened host for the first deployment.
- Kubernetes, Kafka, Redis/Celery, service mesh, and external policy engines are deferred.

Exact package versions are locked at scaffold time and updated through tested dependency changes.

## 4. Modular boundaries

```text
backend/
  cases/
  identity/
  evidence/
  temporal/
  provenance/
  policy/
  graph_projection/
  community/
  lineage/
  analysis_versions/
  jobs/
  findings/
  reporting/
  audit/
  telemetry/

frontend/
  app-shell/
  authorization/
  workflow/
  workspace/
  graph/
  timeline/
  map/
  evidence-table/
  evidence-inspector/
  community-lineage/
  explanations/
  analysis-versions/
  findings/
  reports/
  accessibility/
```

Modules communicate through typed domain interfaces. They must not import another module's persistence implementation directly.

Required backend ports:

```text
AssertionRepository
HistoricalGraphReader
GraphProjectionProvider
PathQueryEngine
PolicyDecisionPoint
EvidenceObjectStore
DependencyGraph
JobDispatcher
CommunityDetector
LineageMatcher
ReportRenderer
AuditSink
ModelRunner
```

## 5. Canonical temporal and evidence model

### Core records

```text
case
case_membership
purpose_session
policy_version

source
source_artifact
source_record

entity
identity_candidate
identity_decision

assertion
assertion_revision
assertion_contradiction
assertion_supersession
```

`assertion` is a stable logical identity. `assertion_revision` is immutable except for closing its recorded-time range.

Essential revision fields:

```text
assertion_id
revision_id
case_id
subject_ref
predicate
object_ref or literal_value
assertion_class
event_at and event_precision
valid_during
recorded_during
source_record_id
source_reliability
information_credibility
analytical_confidence
status
handling_label
field_restrictions
created_by
correction_reason
```

Historical state uses:

```sql
valid_during @> :valid_at
AND recorded_during @> :known_at
```

Point events remain point events. Persistent state and intervals are modeled explicitly.

### Correction transaction

1. Close the prior revision's `recorded_during`.
2. Insert the replacement revision.
3. Record correction/supersession relationships.
4. Enqueue dependency-impact analysis.
5. Write audit and outbox events.
6. Commit atomically.

Historical revisions are never overwritten.

## 6. Provenance and dependency graph

```text
derived_artifact
artifact_version
dependency_edge
analysis_recipe
analysis_version
graph_projection
layout_manifest
saved_view
finding
finding_claim
report
report_version
report_claim
```

Every dependency points to an exact version.

Examples:

```text
report claim
  → finding version
  → lineage event version
  → community observation
  → graph projection
  → assertion revisions
  → source records/artifacts
```

Correction impact performs reverse recursive traversal from changed assertion revisions.

Derived artifacts inherit source restrictions. Inherited restrictions are cached for fast denial and recomputed before publication or export.

## 7. Authorization architecture

Use RBAC plus contextual ABAC.

Every decision evaluates:

```text
principal
role
case membership
active permissible purpose
operation
resource case/source/field
sensitivity and handling
policy version
retention/temporal state
```

Enforcement:

1. OIDC authenticates.
2. Application policy module produces the authoritative decision and explanation.
3. Request transactions receive actor, case, purpose, and policy context.
4. Forced PostgreSQL RLS provides defense in depth.
5. Restricted views and response serializers enforce field controls.
6. Derived artifacts enforce inherited restrictions.
7. Downloads and exports are reauthorized and audited.

Runtime database roles:

- do not own sensitive tables;
- are not superusers;
- cannot bypass RLS; and
- use minimal reviewed security-definer functions.

Traversal, community detection, layouts, and future models operate on the authorized projection. Restricted data are not computed first and hidden later.

## 8. Historical graph projection

`HistoricalGraphReader` creates an immutable projection from:

```text
case
authorization digest
event/valid range
known-at cutoff
relation projection
evidence threshold
identity-resolution version
source high-water marks
projection recipe version
```

Contract:

```text
GraphProjectionV1
  metadata
  nodes
  edges
  assertion_revision_ids
  source coverage and missingness
  inherited restrictions
  reproducibility manifest
```

Cache keys include authorization digest, policy version, time scope, source high-water mark, and recipe hash. A projection cannot be reused across incompatible authorization contexts.

## 9. Path and graph query architecture

P0 uses authorized relational adjacency:

- indexes on case, subject, object, relation, and status;
- GiST temporal indexes;
- recursive CTE paths;
- explicit hop, node, edge, and execution budgets;
- cycle prevention; and
- assertion-revision provenance for every edge.

`PathQueryEngine` isolates the storage implementation.

A graph read model is introduced only if pilot benchmarks show:

- bounded path P95 above three seconds after tuning;
- excessive adjacency scans;
- traversal concurrency degrading reconstruction;
- analytical projections missing budgets; or
- pilot scale outside the demonstrated relational envelope.

A future graph store is disposable and rebuildable from PostgreSQL through an outbox/CDC projection.

## 10. Community and lineage architecture

Detection and lineage are separate.

### Detection

1. Reconstruct authorized state.
2. Build explicit graph projection.
3. Validate relation and weight semantics.
4. Run independent Leiden/CPM per period.
5. Run repeated seeds.
6. Store every run and membership.
7. Calculate assignment stability.
8. Publish only after provenance validation.

Records:

```text
community_run
community_observation
community_membership
community_run_metric
```

### Lineage

```text
observations
  → candidate links
  → scored alternatives
  → accepted links
  → lifecycle events
  → persistent lineage identities
```

Records:

```text
lineage_run
lineage_candidate
lineage_link
lineage_event
lineage_identity
lineage_override
```

Birth, continuation, split, merge, death, and resurgence are explicit. Overrides create new versions and do not erase algorithm output.

## 11. Analytical jobs

P0 uses PostgreSQL jobs:

```text
job_run
job_attempt
job_progress
job_artifact_staging
```

Semantics:

- idempotency key;
- immutable input manifest;
- authorization/policy digest;
- lease and heartbeat;
- retries;
- cancellation;
- named progress stages;
- staged output; and
- atomic publication.

Workers claim jobs with row locks and `SKIP LOCKED`.

Failed jobs never replace the last valid result. The `JobDispatcher` seam permits migration to a managed queue or workflow engine.

Progress is delivered by REST plus Server-Sent Events, with polling fallback.

## 12. Frontend workbench architecture

```text
User intent
  → typed workspace command
  → workspace state/query specification
  → backend projection or job
  → immutable view model
  → synchronized renderers
```

Renderers are not authoritative data stores.

### State ownership

- TanStack Query: server records, projections, analyses, reports, jobs, and provenance.
- Redux Toolkit: selection, filters, temporal scope, comparison, active view, inspector, visualization draft, and local undo.
- XState: guided workflow step, guards, explanations, recovery, and knowledge checks.
- Local component state: hover, temporary camera state, and uncommitted UI details.

Production disables Redux DevTools and clears case-scoped caches when authorization changes.

## 13. Graph visualization architecture

Use Cytoscape.js through `GraphRendererAdapter`:

```ts
interface GraphRendererAdapter {
  setModel(model: GraphRenderModel): void;
  setSelection(ids: string[]): void;
  setViewport(viewport: Viewport): void;
  exportImage(options: ExportOptions): Promise<Blob>;
  destroy(): void;
}
```

The adapter avoids renderer lock-in.

### Stable temporal layout

- Compute coordinates over the union of compared projections.
- Return a versioned layout manifest from the backend/layout module.
- Use Cytoscape preset positions in every pane.
- Synchronize camera transforms.
- Position new nodes near established neighbors.
- Store analyst dragging as a visualization preset, not canonical layout.

Stable layouts are paired with redundant visual and textual change summaries so stability does not hide change.

### Accessibility mirror

The canvas is not treated as the semantic representation.

Provide:

- DOM relationship navigator;
- arrow-key traversal;
- inspector opening;
- graph summary;
- live selection announcements; and
- equivalent evidence table.

## 14. Timeline, map, and table

### Timeline

Custom React/SVG timeline using D3 scales and virtualized lanes:

- event points;
- validity intervals;
- knowledge-time additions;
- corrections;
- missingness bands;
- lifecycle events;
- comparison windows.

All events have a keyboard-operable list equivalent.

### Map

MapLibre GL JS:

- GeoJSON points, routes, and uncertainty areas;
- restricted precision;
- missing-coordinate counts;
- rotation disabled by default;
- cooperative gestures;
- synchronized selection;
- evidence table/text fallback when WebGL is unavailable.

### Table

TanStack Table with semantic markup:

- server sorting/filtering;
- column presets;
- stable sorting;
- synchronized selection;
- evidence and restriction indicators;
- community before/after;
- policy-aware export.

Pagination precedes virtualization.

## 15. Visualization safety and customization

`VisualizationEncodingRegistry` controls allowed mappings:

- entity type → shape and categorical color;
- evidence class → border and line style;
- confidence/completeness → bounded opacity;
- community → optional outline/hull;
- temporal change → outline, pattern, icon, and text;
- restriction → handling marker.

Forbidden defaults:

- red as suspicion;
- centrality node sizing;
- risk-based center placement;
- unlabeled opacity;
- removal of evidence or uncertainty distinctions.

Presets are validated for safety and accessibility. “Reset to recommended” restores a deterministic preset.

Analysis versions and visualization presets remain separate.

## 16. Guided workflow architecture

XState implements the versioned 16-screen Harbor Lantern workflow.

The machine owns:

- current step;
- completion requirements;
- guards;
- explanations already shown;
- recovery transitions;
- resume state; and
- knowledge checks.

It does not own graph or server records.

Every screen must answer:

- What am I seeing?
- Why does it matter?
- What evidence supports it?
- What are my options?
- What could make the interpretation wrong?
- Can I recover?

## 17. Reporting architecture

Reports are structured blocks:

- narrative;
- citations;
- graph snapshot;
- timeline;
- map;
- evidence table;
- community lineage;
- methodology;
- reproducibility manifest.

The frontend edits the structured report and preview. The backend freezes the report version, runs preflight, renders HTML/PDF, hashes outputs, creates exact dependencies, publishes atomically, and audits the release.

Released reports never depend on mutable “current” state.

## 18. Audit architecture

Audit events are separate from logs:

```text
event_id
event_time
recorded_time
actor/session
purpose
case
action/resource
allowed/denied
policy version
before/after versions
correlation ID
previous hash
event hash
```

Controls:

- insert-only runtime role;
- canonical serialization;
- per-case or partitioned hash chains;
- periodic signed checkpoints;
- checkpoint copies in independently controlled immutable storage;
- verification command for modification, deletion, reordering, and gaps.

## 19. Security and privacy

- OIDC Authorization Code with PKCE.
- Secure HTTP-only same-site session cookies through the backend.
- CSRF protection.
- TLS and storage encryption.
- Separate credentials for API, worker, migration, backup, and monitoring.
- Object downloads use short-lived scoped access.
- Upload validation, size limits, malware scan, and parser isolation.
- Stored content is encoded or sanitized.
- No arbitrary server-side URL fetches.
- No unrestricted query language in P0.
- Node/edge budgets, timeouts, cancellation, and quotas.
- Reauthorize long-running results before publication.
- No sensitive content in logs, traces, metrics, URLs, browser storage, or product analytics.

## 20. Observability

Use OpenTelemetry with an allowlisted, content-free telemetry schema.

Monitor:

- API latency, errors, authorization denials, and database waits;
- worker queue age, duration, retries, cancellation, memory, and replay mismatch;
- provenance coverage, stale analyses, missing dependencies, post-cutoff violations, and report reconstruction;
- guided journey completion and recovery without case content;
- audit checkpoint age and verification.

Audit, security events, and diagnostic telemetry have separate stores and retention.

## 21. Deployment

### Local

Docker Compose:

- frontend;
- API;
- worker;
- PostgreSQL;
- local S3-compatible object storage;
- reference OIDC or explicit mock identity;
- optional OpenTelemetry Collector.

### First deployment

- managed container service or hardened container host;
- managed or customer-approved PostgreSQL;
- versioned object storage;
- external OIDC;
- OpenTelemetry Collector.

Kubernetes is introduced only for demonstrated scaling, availability, tenant, or organizational requirements.

## 22. Testing architecture

### Backend

- pytest and property-based semantic tests;
- real PostgreSQL and object-storage integration tests;
- RLS and policy negative tests;
- bitemporal leakage fixtures;
- provenance and correction-impact tests;
- audit mutation and restore tests;
- analytics and lineage benchmarks.

### Frontend

- Vitest state/encoding tests;
- React Testing Library and MSW;
- XState transition tests;
- Storybook states;
- axe automation;
- synchronization and versioning integration tests.

### End-to-end

Playwright:

- complete Harbor Lantern journey;
- keyboard-only and reduced-motion paths;
- evidence drill-down;
- temporal comparison;
- lineage explanation;
- customization/reset;
- correction impact;
- error recovery;
- report generation/reconstruction;
- restricted-role non-disclosure.

Manual assistive-technology tests remain release requirements.

### Performance

- kernel microbenchmarks;
- k6 API tests;
- Playwright browser timings;
- small, P0, pilot, and adversarial fixtures.

## 23. Repository layout

```text
apps/
  web/
  api/
  worker/

packages/
  contracts/
  design-system/
  graph-renderer/
  guided-workflow/

backend/
  src/network_platform/
    cases/
    evidence/
    temporal/
    provenance/
    policy/
    graph_projection/
    community/
    lineage/
    findings/
    reporting/
    audit/
    jobs/

analytics/
  community/
  lineage/
  evaluation/
  benchmarks/

data/
  synthetic/
  schemas/

tests/
  semantic/
  integration/
  e2e/
  performance/
  accessibility/

docs/
  research/
  requirements/
  ux/
  architecture/
  analyst/
  admin/
```

The final scaffold may simplify duplicate top-level/backend paths, but UI, data, application, analytics, and tests remain separated.

## 24. Migration triggers

### Add graph read model

When bounded path/expansion benchmarks fail after relational tuning.

### Add distributed queue

When job concurrency, reliability, or scheduling exceeds PostgreSQL queue limits.

### Add Kubernetes

When multiple scaling domains, HA targets, tenants, or organizational standards require it.

### Add external policy engine

When policy must be shared across services or centrally administered.

### Add Sigma.js/deck.gl

When measured Cytoscape or MapLibre workloads exceed budgets.

### Add temporal ML platform

Only after predictive gates pass and model lifecycle complexity exists.

## 25. Decision traceability

| Decision | Requirements | Gates |
|---|---|---|
| PostgreSQL canonical authority | REQ-FR-002–005, 015–018 | A, B, I, K |
| Explicit valid/recorded ranges | REQ-FR-002–003 | A |
| Exact dependency DAG | REQ-FR-004, 010, 015, 017 | B, D, H |
| Application policy plus forced RLS | REQ-FR-001, 004, 014, 016, 023 | B, K |
| Authorized immutable projections | REQ-FR-003, 006–010, 014, 018 | A, B, C, I, K |
| CPU igraph/Leiden | REQ-FR-008; REQ-NFR-002 | C, I |
| Detection/lineage separation | REQ-FR-008–010 | C, D, H |
| React coordinated workbench | REQ-FR-006–015 | I, J, L |
| Cytoscape adapter and stable layout | REQ-FR-006, 007, 013 | I, J, L |
| XState guided workflow | REQ-FR-011, 019 | J, L |
| Structured report builder | REQ-FR-015, 018 | A, B, H, K |
| Atomic jobs and result publication | REQ-FR-019; REQ-NFR-004 | I, K |
| OIDC plus contextual authorization | REQ-FR-001, 023 | K |
| Content-free OpenTelemetry | REQ-NFR-008 | K |
| Predictive models isolated as derived artifacts | REQ-FR-025–027 | E, F, G, H, K |

## 26. Rejected P0 alternatives

- Neo4j as canonical authority.
- Dual PostgreSQL/graph-store writes.
- Microservices.
- Next.js/server rendering.
- Sigma.js as the initial graph renderer.
- Client-owned graph model.
- Force layout independently per time window.
- Client-only PDF generation.
- Rich-text-only report editing.
- Redis/Celery/Kafka job infrastructure.
- Kubernetes by default.
- OPA by default.
- Temporal GNN deployment.

## 27. Architecture retrospective

What could make this wrong:

- PostgreSQL path or provenance queries may miss pilot budgets.
- RLS may introduce covert channels or unacceptable latency.
- Cytoscape may miss rendering budgets with complex styling or two panes.
- Custom timeline work may be underestimated.
- Canvas accessibility may remain weaker than table-first workflows.
- A PostgreSQL queue may not support required concurrency.
- Modular boundaries may erode without automated dependency checks.
- Object store and database versions may diverge.
- Stable layouts may hide structural change.
- Security accreditation may mandate different infrastructure.
- Lawful deletion may conflict with immutable audit and reproducibility.

Required early spikes:

1. Bitemporal correction and future-leakage proof.
2. Authorized projection and cache isolation proof.
3. Provenance/dependency impact benchmark.
4. Cytoscape two-pane rendering and stable-layout benchmark.
5. Keyboard-accessible graph/table synchronization proof.
6. Community plus lineage correctness benchmark.
7. Structured report reconstruction proof.

Phase 4 begins with these risks as executable vertical-slice tests.
