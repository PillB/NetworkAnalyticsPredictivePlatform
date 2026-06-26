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

## 2A. Expanded nine-step implementation plan

This expansion is the execution contract for the remaining Phase 4 work. Each
step is implemented as a vertical slice: design, code, unit tests, black-box
tests, browser checks where relevant, retrospective, state update, and deployment
validation for coherent public-training increments.

Global constraints for every step:

- provenance first: evidence, analyst notes, visual state, and AI drafts remain
  separate;
- analyst decision-support only: no guilt, criminality, dangerousness, or
  enforcement determinations;
- CPU-first deterministic baselines before neural or adaptive models;
- leakage-safe evaluation, calibration checks, explainability, accessibility,
  and overreliance testing;
- GitHub Pages remains synthetic training-only and cannot imply production
  authorization, persistence, retention, or audit controls.

Per-step delivery checklist:

- define data contracts and UI states before implementation;
- implement minimal useful behavior against existing app patterns;
- add unit tests for reducer/parser/model logic;
- add integration or browser tests for cross-module flows;
- add black-box safety tests for evidence mutation, authorization leakage,
  unsupported claims, and report/export behavior;
- update this checklist and `AGENT_STATE.md` with the retrospective;
- deploy only after local tests pass, then verify CI/CD and the live Pages URL.

### Step 1 — Graph manipulation quality and custom node identity

Goal: make graph interaction feel professional and allow analyst-grade visual
customization.

Done conditions:

- Node drag is smooth, non-jittery, and does not full-rerender the SVG on every
  pointermove.
- Drag, rotate, spin, reset, undo, redo, save layout, and restore layout work
  independently from analysis versions.
- Users can assign built-in icons and safe uploaded images to nodes.
- Custom visuals are stored as presentation metadata, not evidence.

Tests:

- Unit: projection/unprojection math round-trips under spacing and rotation.
- Unit: one drag creates one undo checkpoint.
- Unit: image validator accepts PNG/JPEG/WebP and rejects SVG, oversized, and
  malformed files.
- Black-box: visual edits do not mutate evidence, reports, or analysis version.
- Playwright: drag node through many mouse steps, rotate then drag, set icon,
  upload image, reset icon, undo/redo layout, complete fraud workflow.

Retrospective questions:

- Did renderer state become authoritative, or is it still presentation-only?
- Did drag or custom visuals change evidence dependencies, report output, or
  analysis version?
- Does the semantic mirror still expose the graph without relying on custom
  icons or images?

Current implementation evidence:

- Added a presentation-only boardroom graph style for financial-institution
  demos alongside the more colorful analyst style.
- Corrected workflow-specific period and scope labels so the Harbor Lantern
  Feb 16 comparison boundary is not shown as the cuentas-mulas split. The fraud
  workflow now labels its April collection/fan-out phases explicitly.

### Step 2 — i2-class visual charting parity

Goal: close the core link-analysis charting gap.

Done conditions:

- Users can manually add chart entities, links, labels, notes, edge styling, and
  briefing annotations.
- Users can create redacted chart views.
- Users can export a briefing-ready chart with provenance metadata.
- Visual edits are clearly separated from factual evidence assertions.

Tests:

- Unit: chart reducer covers add/edit/remove entity, add/edit/remove edge,
  annotation, redaction, undo/redo.
- Black-box: a report export blocks factual claims lacking evidence.
- Black-box: redacted chart hides restricted fields without leaking counts or
  layout gaps.
- Playwright: create chart, add entity/link, style node, annotate, redact,
  export, restore.

Retrospective questions:

- Are manual chart edits clearly marked as analyst-authored presentation or
  notes rather than evidence?
- Can redaction be verified without comparing hidden counts or layout holes?

Current implementation evidence:

- Implemented manual chart entities, manual chart links, link styling,
  briefing annotations, redacted chart rows, briefing JSON export metadata, and
  unsupported-claim blocking for manual items.
- Tests cover reducer add/edit/remove entity, add/edit/remove edge, annotation,
  redaction, undo/redo, briefing export provenance, local Pages preview, and
  main browser journey.

Remaining gaps:

- Redacted chart views are still browser-session training artifacts, not
  persisted server-side review packets.
- Manual chart entities are listed in the semantic workspace, but not yet drawn
  as a separate editable chart canvas with independent coordinates.
- Redaction needs production authorization, dissemination policy, and export
  retention controls before operational use.

### Step 3 — Linkurious-style investigation workspace parity

Goal: make investigations collaborative, searchable, and case-oriented.

Done conditions:

- Workspace supports saved searches, shared layouts, comments, case notes, task
  states, and review status.
- Search and expansion are bounded and explainable.
- Workspace actions are audit-ready and reversible.
- Case packets can be prepared for review without implying guilt.

Tests:

- Unit: workspace state transitions for search, pin, expand, comment, task
  status, save/restore.
- Black-box: expansion uses only authorized graph projection.
- Black-box: comments are analyst notes, not evidence.
- Playwright: search, pin result, expand neighbors, comment, assign review
  status, save workspace, reload/restore.

Retrospective questions:

- Did collaboration metadata become confused with evidence?
- Are saved searches replayable against the same authorized projection contract?

### Step 4 — Maltego-style transform workflow

Goal: add one-click investigative expansion with source/provenance clarity.

Done conditions:

- User can run safe synthetic transforms from an entity.
- Each transform shows source, cost, timestamp, input, output, confidence, and
  limitations.
- Transform outputs are staged for review before becoming chart items.
- Transform history is inspectable and undoable.

Tests:

- Unit: transform registry validates input/output contracts.
- Unit: transform result staging does not mutate evidence automatically.
- Black-box: transform outputs remain visibly distinct from source evidence.
- Playwright: select node, run transform, preview results, add selected results,
  inspect transform history, undo.

Retrospective questions:

- Did transforms create unsupported certainty or hidden enrichment?
- Can analysts reject transform output without side effects?

### Step 5 — Neo4j/Bloom-style graph exploration

Goal: make graph exploration natural and fast for non-experts.

Done conditions:

- Search phrases support common analyst queries such as "show accounts connected
  to Acct 777" and "paths between A and B."
- Scene presets apply saved graph filters/styles.
- Rule-based styling supports evidence class, entity type, community,
  uncertainty, and time window.
- Path/community explanations are plain-language and evidence-linked.

Tests:

- Unit: phrase parser maps supported queries to deterministic operations.
- Unit: scene preset validation rejects unsafe or inaccessible presets.
- Black-box: path results include source dependencies and cutoff.
- Playwright: enter phrase, graph updates, apply scene preset, inspect path
  explanation, reset.

Retrospective questions:

- Did natural-language query support execute anything without preview?
- Are unsupported phrases refused clearly instead of guessed?

### Step 6 — Financial crime / cuentas mulas escalation

Goal: turn the fraud-ring workflow into a reusable transaction-analysis
capability.

Done conditions:

- CSV and JSON imports support explicit field mapping.
- Timezone, currency, amount, direction, entity identity, and transaction type
  are validated.
- Rejected rows show specific reasons.
- Mule/ring detection handles hard negatives like payroll hubs, legitimate
  payment processors, refunds, batch transfers, and shared infrastructure.

Tests:

- Unit: CSV/JSON parsing, mapping, validation, rejected-row reasons.
- Unit: timezone and currency normalization.
- Integration: imported transactions produce graph, detector output, and report
  dependencies.
- Black-box: fraud outputs remain review recommendations, not criminality
  claims.
- Playwright: import sample, map fields, preview rejects, apply, detect ring,
  inspect top account, export report.

Retrospective questions:

- Which legitimate high-degree flows still produce false positives?
- Does the UI make uncalibrated status impossible to miss?

Current implementation evidence:

- Implemented CSV and JSON transaction import with inferred and explicit field
  mapping, timezone and supported-currency validation, rejected-row reasons, and
  imported graph/report contracts.
- Added validation for transaction direction, entity identity syntax, duplicate
  transaction IDs, non-zero self-transfers, negative amounts, and zero-amount
  context rows that use a money currency.
- Added an extended synthetic hard-negative benchmark fixture with complaint
  consolidation, payroll hub, legitimate processor refund, and shared
  infrastructure rows.
- Added uncalibrated benchmark metrics for precision at review budget,
  false-positive accounts, flagged hard negatives, abstention rate, explanation
  coverage, and overreliance warnings.
- Tests cover parser/mapping behavior, rejected-row reasons, hard negatives,
  imported workflow graph/detection/report/preflight contracts, local Pages
  preview, and full repository regression gates.

Remaining gaps:

- Import remains browser-local training behavior on GitHub Pages; server-side
  authorized upload, persistence, malware/content scanning, actor/purpose audit,
  retention, and schema-versioned operational import are still required.
- The benchmark is synthetic and explicitly uncalibrated; it does not establish
  operational precision, fairness, robustness, or analyst overreliance safety.
- Direction semantics are validated and normalized, but not yet used for a
  full debit/credit accounting model or jurisdiction-specific transaction
  policy.

### Step 7 — Crime-organization detection and prediction

Goal: support non-financial group/ring detection with evidence-neutral
hypotheses.

Done conditions:

- Role hypothesis engine supports organizer, broker, bridge, courier,
  facilitator, infrastructure, cash-out, and unknown.
- Temporal motifs include sudden broker emergence, bridge concentration,
  subgroup birth, split/merge, recurring rendezvous, and shared
  device/location/vehicle.
- Every role/group output includes evidence, uncertainty, contrary evidence, and
  sensitivity.
- No output labels a person or group as criminal.

Tests:

- Unit: role and motif detectors on deterministic fixtures.
- Unit: removing key evidence changes or explains unchanged role confidence.
- Black-box: role hypotheses are neutral and evidence-linked.
- Playwright: open crime workflow, run role hypotheses, inspect bridge warning,
  remove/toggle evidence, compare explanation, export report.

Retrospective questions:

- Are role words too loaded for the evidence?
- Are data collection artifacts driving the warning instead of behavior?

### Step 8 — SOTA cognitive/adaptive predictive graph intelligence layer

Goal: add predictive graph capability gated by serious evaluation.

Done conditions:

- Evaluation harness compares deterministic baselines, classical ML, and
  TGNN/GNN candidates.
- Candidate methods include recency/frequency/EdgeBank-style baselines,
  temporal motifs, calibrated logistic/GBM, TGAT, TGN, GraphMixer/DyGFormer,
  CAWN, JODIE, EvolveGCN, transaction-specific GNNs, and dynamic community
  methods.
- Models predict relationships, events, subgraphs, communities, or review
  hypotheses; never person-level guilt.
- Models stay disabled unless they beat baselines on hard negatives with
  calibration, robustness, latency, explainability, and overreliance gates.

Tests:

- Unit: leakage detector rejects future labels/features/scalers/events.
- Unit: temporal folds replay memory models deterministically.
- Integration: model harness runs baseline vs candidate on synthetic benchmark.
- Black-box: uncalibrated models cannot display production predictions.
- Red-team: evasion patterns, legitimate high-degree actors, missing data,
  delayed reports, duplicated entities, smurfing, circular flows.
- Playwright: open model comparison panel, see baseline/candidate/gate status,
  attempt to enable failed model, blocked with reasons, inspect model card.

Retrospective questions:

- Did any candidate win on easy random negatives but fail hard negatives?
- Did calibration or explanation fail even when ranking metrics improved?

Current implementation evidence:

- Added a deterministic model-gate panel comparing recency/frequency,
  EdgeBank-style, calibrated GBM, and TGN/TGAT-style candidates.
- Candidate outputs remain disabled by default and expose gate failures for
  baseline lift, calibration, hard-negative false positives, explanation
  coverage, robustness, latency, and analyst-overreliance evidence.
- Browser coverage verifies the panel displays blocked candidates before report
  export.

Remaining gaps:

- This is an executable gate scaffold, not a trained neural model. Full TGNN/GNN
  training, temporal folds, leakage detectors, calibration curves, and
  representative analyst-overreliance studies remain required before any
  predictive display can be enabled.

### Step 9 — Further AI functionality research and implementation

Goal: add high-value AI assistance that improves analyst work without replacing
evidence discipline.

Candidate AI features:

- GraphRAG analyst assistant: answers graph/report/evidence questions, supports
  multi-hop questions, and cites exact local dependencies.
- AI report copilot: drafts neutral summaries, briefing bullets, uncertainty
  sections, and redaction-aware exports without inventing claims.
- AI query/copilot: translates plain English into safe graph searches, filters,
  path queries, import mappings, and visualization presets with preview before
  execution.
- AI entity-resolution assistant: suggests possible duplicates with reasons and
  contrary evidence, requiring analyst confirmation and keeping suggestions
  separate from identity truth.
- AI contradiction and gap finder: finds missing corroboration, inconsistent
  dates, unsupported claims, stale analysis, and overconfident findings.
- AI tutorial coach: explains workflow steps, defaults, failure modes, and next
  choices in novice/expert modes.
- AI red-team reviewer: checks report language for overclaiming, criminality
  implication, unsupported inference, privacy/security leakage, and automation
  bias.
- AI active-learning feedback loop: suggests the next useful analyst review
  action and tracks whether feedback improves evaluation metrics.

Done conditions:

- AI answers cite exact evidence/report/graph dependencies.
- AI refuses unsupported accusation, protected-attribute inference, and
  operational enforcement prompts.
- AI-generated text is saved only as analyst note or draft, never as evidence.
- Every AI action has audit metadata: prompt, retrieved sources, output,
  model/config version, user decision.
- AI features measurably reduce task time or error without increasing
  unsupported conclusions.

Tests:

- Unit: prompt policy rejects prohibited request classes.
- Unit: citation checker rejects uncited factual claims.
- Unit: GraphRAG retriever returns authorized-only evidence.
- Integration: assistant answer includes dependencies and uncertainty.
- Black-box: AI cannot access restricted graph nodes through summaries, counts,
  or hidden relationships.
- Red-team: hallucination, prompt injection, protected inference, unsupported
  accusation, stale evidence, misleading source, overconfident draft.
- Playwright: ask assistant for explanation, inspect citations, request
  unsupported accusation and receive refusal, generate report draft, red-team
  review flags risky language, save as analyst note.

Retrospective questions:

- Did fluent text reduce analyst skepticism?
- Are citations exact enough to reconstruct every factual claim?

Current implementation evidence:

- Added a deterministic GraphRAG-style analyst assistant that answers from the
  visible graph/report evidence only and returns exact local source citations.
- Added AI report-copilot draft generation, citation checking, red-team review,
  and prompt-policy refusal for unsupported accusations, protected-attribute
  inference, and operational enforcement prompts.
- AI output is displayed as draft/analyst-assistance content only, never
  evidence, and includes audit metadata in the assistant contracts.
- Unit tests cover prompt policy, citation checking, assistant dependencies,
  red-team flags, and model-gate blocking. Browser tests cover ask, refusal,
  draft, red-team review, and report preflight.

Remaining gaps:

- No external LLM is wired yet. Production AI still needs model/provider
  configuration, prompt-injection isolation, persisted audit records,
  authorized retrieval services, human usability measurements, and live
  red-team evaluation before release.

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
