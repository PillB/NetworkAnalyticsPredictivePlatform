# i2-Class, AI-Enhanced Criminal Network Analysis Execution Checklist

Date: June 25, 2026  
Status: active delivery checklist

## Preamble: how this work will be executed

The product goal is not a narrow demo. The goal is a feature-complete i2-class investigation workbench, improved by governed temporal analytics, explainable AI, dynamic community detection, fraud-ring detection, and stronger novice guidance.

Execution follows this sequence:

1. Identify the competitor/workflow capability baseline.
2. Mark what is already implemented, what is partial, and what is missing.
3. Convert every gap into a phase checklist with testable done conditions.
4. Implement one vertical slice at a time.
5. Run unit, integration, browser, black-box, and deployment tests.
6. Retrospect after every phase: what could make this wrong, which assumptions were weak, and what must be fixed next.

All analytical output remains decision support. The system must not determine guilt, criminality, dangerousness, or enforcement action.

## 1. Feature baseline and gap map

| Capability group | i2-class expectation | Better-with-AI target | Current status | Gap / next action |
|---|---|---|---|---|
| Entity/link charting | Build visual charts of entities, relationships, events, and attributes | Interactive graph, provenance-backed edges, temporal comparison, layout undo/redo | Partial: SVG graph, semantic table, selectable relationships, drag/rotate/undo/redo/reset | Add richer chart authoring: manual entities, annotations, edge styling, saved layouts, multi-chart workspaces |
| Search and expansion | Search records and expand neighborhoods | Authorized pre-analytics expansion with explainable paths and uncertainty | Partial: projection/service contracts and UI fixture behavior | Add interactive search, expand-by-type, bounded path finder, and path explanations |
| Import and normalization | Load files/databases, normalize entities and links | Transaction/case import templates, schema validation, provenance, parser versions | Partial: canonical JSON fixture and PostgreSQL importer | Add CSV transaction upload in training mode and production import contract tests |
| Temporal analysis | Timelines, event ordering, chart filtering | Bitemporal valid-time/known-at reconstruction, before/after graph diff, leakage checks | Strong backend; partial UI | Add timeline scrubber, event histogram, temporal path replay, and side-by-side period presets |
| Geospatial analysis | Map locations and movements | Map/timeline/graph synchronized projections with accessible fallback | Designed, not implemented | Add MapLibre adapter boundary or static map fallback for synthetic cases |
| Community detection | Static clusters or manual groups | Dynamic community lifecycle: birth, continuation, split, merge, death, resurgence, uncertainty | Backend lineage implemented; UI demo partial | Add algorithm selector, lineage DAG viewer, parameter sensitivity, and persistence in reports |
| Financial fraud / cuentas mulas | Fraud-ring charting and transaction flow review | Explainable mule indicators plus temporal community roles; future TGNN/GNN gates | Implemented synthetic MVP | Add CSV import, larger synthetic benchmark, calibration harness, and analyst overreliance test |
| Crime organization prediction/detection | Identify groups, roles, intermediaries, risk/alerts | Evidence-constrained role/ring hypotheses, graph motifs, calibrated review priority, TGNN only after gates | Partial: community and priority baseline | Add role hypothesis engine, bridge/intermediary motifs, group-growth warnings, and hard-negative evaluation |
| AI assistance | Usually limited or external in traditional tools | Analyst copilot for query help, explanation, report drafting, contradiction search, model cards, next-best lawful steps | Not yet implemented as LLM feature; deterministic explanations exist | Add non-authoritative AI assistant behind source-grounding, audit, prompt safety, and no autonomous claims |
| Case management | Cases, tasks, collaboration, audit | Purpose-bound cases, grants, report dependencies, audit receipts | Backend contracts strong; UI partial | Add UI for case list, tasking, notes, review states, dissemination controls |
| Security/governance | Access control, audit, controlled data | OIDC, policy sessions, RLS, digest identity store, immutable reports, content-free telemetry | Strong contracts/adapters; production transport pending | Add PKCE browser session transport and external policy adapter |
| Usability/tutorial | Expert analyst workflow | ELI5 hand-held complete journeys for community and fraud cases | Implemented for two synthetic cases | Run representative novice, forced-colors, screen-reader, and overreliance sessions |
| Deployment | Enterprise/server deployment | GitHub Pages training artifact plus production FastAPI/PostgreSQL architecture | Pages live; production deployment not live | Validate latest Pages commit, add deployment badges/status, define production pilot runbook |

## 2. Phase checklist

### Phase A — Current MVP stabilization and deployment validation

Objective: make the current two-use-case training MVP reliably available and tested.

Deliverables:

- GitHub Pages training site with Harbor Lantern and financial fraud workflows.
- Remote Playwright validation after every deployment.
- CI workflow passing on `main`.
- Documentation links from README, master specification, requirements, ADRs, and traceability matrix.

Done conditions:

- `node --test tests/frontend/*.test.mjs` passes.
- `node tests/browser/pages.e2e.mjs` passes locally.
- GitHub Pages workflow conclusion is `success` for the latest commit.
- `PAGES_REMOTE_URL=https://pillb.github.io/NetworkAnalyticsPredictivePlatform node tests/browser/pages.e2e.mjs` passes.

Retrospective questions:

- Did GitHub Pages deploy the same commit that was tested locally?
- Did static Pages mode accidentally imply production authorization or operational data support?
- Did the UI remain understandable after adding a second use case?

### Phase B — i2-class chart authoring and exploration

Objective: close the core link-analysis interaction gap.

Deliverables:

- Manual chart workspace with selectable/movable nodes, saved layouts, annotations, edge labels, and chart notes.
- Search panel and bounded expand-by-type controls.
- Shortest/strongest path and temporal path replay.
- Undo/redo stack for view and chart-authoring actions, separate from analytical versions.

Done conditions:

- Unit tests cover graph-state reducer transitions.
- Browser tests cover node creation, edge creation, annotation, save/restore layout, undo/redo, and reset.
- Black-box tests prove view edits do not mutate evidence or analysis versions.
- Accessibility tests prove equivalent table/text operations for chart actions.

Retrospective questions:

- Are chart edits evidence assertions, analyst annotations, or visual state? If ambiguous, the design is wrong.
- Can a novice recover from an accidental layout or chart edit?

### Phase C — Financial transaction ingestion and fraud-ring analytics

Objective: turn the synthetic mule-ring workflow into a reusable transaction-analysis module.

Validation basis: Phase B competitor/user-value review found import templates,
preview/mapping/validation, rejected-row feedback, and broad data access to be
repeatedly emphasized by current graph investigation competitors and user-facing
materials.

Deliverables:

- CSV/JSON transaction import template with field mapping, validation, currency handling, timezone handling, and rejected-row report.
- Fraud-ring detector service consuming imported transaction data.
- Mule/ring role explanations, transaction-flow motifs, and sensitivity to missing infrastructure fields.
- Synthetic larger benchmark with legitimate processors, refunds, shared devices, batch posting, and hard negatives.

Done conditions:

- Unit tests cover field mapping, invalid rows, timezone normalization, and currency consistency.
- Integration tests import a transaction file and produce a graph projection/report.
- Black-box tests BB-FRAUD-001–006 pass.
- Metrics report precision@review-budget, abstention rate, false-positive scenarios, and explanation coverage on synthetic benchmark.

Retrospective questions:

- Are legitimate payment patterns creating false mule flags?
- Does the score change predictably when device/IP data is unavailable?
- Are analysts shown enough contrary evidence to avoid overclaiming?

### Phase D — Crime organization detection and prediction

Objective: support organization/ring detection beyond financial accounts while preserving evidentiary neutrality.

Deliverables:

- Role hypothesis engine: organizer, broker, bridge, courier, facilitator, cash-out, infrastructure, unknown.
- Temporal motifs: sudden broker emergence, bridge concentration, new subgroup birth, split/merge, recurring rendezvous, shared device/vehicle/location patterns.
- Group evolution warnings based on deterministic features first.
- Optional predictive evaluation harness for temporal GNN/GNN candidates.

Done conditions:

- Role outputs are relationship/group hypotheses, not person criminality labels.
- Every role hypothesis exposes evidence dependencies, contrary evidence, and uncertainty.
- Deterministic baselines beat or match naive recency/frequency before any neural model is enabled.
- Neural models remain disabled unless they beat deterministic baselines on hard negatives with calibration and acceptable latency.

Retrospective questions:

- Is the model predicting observed data collection artifacts instead of behavior?
- Are protected proxies excluded?
- Does temporal smoothing hide real abrupt changes?

### Phase E — AI analyst assistant

Objective: add cognitive/adaptive intelligence without allowing unsupported conclusions.

Deliverables:

- Source-grounded assistant for explaining controls, writing neutral report drafts, generating Cypher/SQL-like query suggestions, and listing next lawful corroboration steps.
- Prompt/output audit trail.
- Guardrails against guilt claims, identity merges, protected-attribute inference, and unsupported dissemination.
- “Why this answer?” evidence dependency view.

Done conditions:

- Assistant answers cite exact local evidence/report dependencies.
- Red-team tests reject accusation, protected-inference, and unsupported operational-action prompts.
- User tests show the assistant reduces task time without increasing unsupported conclusions.
- All assistant content remains excluded from evidence unless explicitly saved as analyst note.

Retrospective questions:

- Did the assistant sound more certain than the evidence supports?
- Did it hide uncertainty behind fluent prose?

### Phase F — Production readiness

Objective: move from synthetic training to controlled pilot readiness.

Deliverables:

- PKCE/OIDC browser session transport.
- External policy adapter.
- PostgreSQL-backed performance benchmark for projections, provenance, jobs, reports, and browser interaction.
- Backup/restore, retention, audit anchoring, incident-response, and deployment runbooks.
- Representative analyst, novice, accessibility, and overreliance evaluations.

Done conditions:

- Full `make test-all` passes.
- Live PostgreSQL migration/rollback tests pass.
- Remote Pages training deployment passes.
- Pilot runbook documents legal/privacy/security prerequisites.
- Gate L human-factor tests pass or block release with specific failures.

Retrospective questions:

- Is any synthetic claim being treated as operational validation?
- Are policy, retention, and audit controls independently testable?

## 3. Overall success conditions

The application can be called “feature-complete i2-class but better with AI” only when:

- an analyst can import or select data, build and manipulate charts, search, expand, annotate, compare time periods, inspect evidence, run community/fraud/ring analytics, and export a reconstructable report;
- a novice can complete both the crime-organization and financial-fraud journeys with hand-held explanations;
- dynamic community lineage and temporal reconstruction are more explicit and testable than conventional chart/timeline workflows;
- AI features are source-grounded, audited, uncertainty-aware, and demonstrably improve analyst outcomes without increasing unsupported conclusions;
- every claim is backed by tests, documentation, and deployment evidence.
