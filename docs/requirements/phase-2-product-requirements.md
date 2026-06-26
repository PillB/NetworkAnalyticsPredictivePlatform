# Phase 2: Product and System Requirements

Date: June 25, 2026  
Status: approved requirements baseline for Phase 3 architecture

## 1. Product definition

Build a governed temporal investigation website that helps analysts:

- reconstruct what happened and what was known at a selected time;
- explore evidence-supported entities, relationships, paths, and events;
- compare network states without losing visual orientation;
- understand community birth, continuation, split, merge, disappearance, and resurgence;
- test alternative explanations and understand uncertainty;
- correct evidence and identify downstream effects;
- create reproducible findings and reports; and
- optionally prioritize specific relationships, events, anomalies, or hypotheses after predictive gates pass.

The product must never present association, graph position, centrality, community membership, anomaly, or model output as proof of criminal conduct.

## 2. Product principles

1. Evidence before inference.
2. Time is explicit and multidimensional.
3. Every conclusion is traceable, versioned, and challengeable.
4. Missing information is unknown, not negative evidence.
5. Uncertainty and contradictory evidence remain visible.
6. Smart defaults produce a useful first result.
7. Consequential defaults are explained, editable, and resettable.
8. Novices receive guidance; experts retain efficient control.
9. Core investigation works on CPU.
10. Models suggest; humans decide.
11. Governance applies to derived outputs as well as source records.
12. Visual prominence must not imply guilt or certainty.

## 3. Priority definitions

- **P0:** required for the first differentiated vertical slice.
- **P1:** required before a production pilot.
- **P2:** gated research or later enhancement.
- **OUT:** explicitly excluded from the current scope.

## 4. Product decisions

### Replicate

- Entity search and bounded graph expansion.
- Evidence-supported path and intermediary discovery.
- Timeline filtering and event/interval display.
- Coordinated graph, timeline, table, map, and inspector views.
- Case workspaces, notes, saved views, and reports.
- Collaboration, review, comments, and version history.
- Saved searches and reproducible analysis recipes.
- Browser-based investigation.
- Flexible visualization styling.
- Controlled report generation and export.

### Improve

- Replace simple date filtering with event/valid time plus knowledge-time reconstruction.
- Anchor before/after graph layouts and synchronize comparison views.
- Make every node, edge, community membership, change, score, and report claim traceable to evidence.
- Separate community detection from persistent lineage.
- Expose community confidence, alternatives, and parameter sensitivity.
- Trace corrections to affected analyses, reports, and disseminations.
- Record complete reproducibility manifests.
- Replace feature tours with a real synthetic investigation.
- Explain outputs using evidence, assumptions, missingness, contradictions, and uncertainty.
- Make smart defaults question-aware and transparent.
- Permit customization without silently invalidating comparability.

### Innovate

- Dual historical reconstruction: what was valid and what was known.
- Versioned community-lineage DAG.
- Gap-aware community resurgence.
- Downstream impact graph for corrections and entity-resolution decisions.
- Analysis validity inspector for future leakage, stale results, inaccessible dependencies, and incompatible temporal semantics.
- Uncertainty-aware visualizations and competing lineage hypotheses.
- Guided reasoning workspace with ELI5 explanations.
- Question-aware visualization recommendations.
- Reversible analytical decisions and side-by-side version comparison.
- Evidence-constrained lead prioritization after evaluation gates pass.

### Defer

- Person-level criminality or guilt scores.
- Autonomous accusation, enforcement, or dissemination.
- Temporal GNN deployment before evaluation gates pass.
- Hard real-time community tracking.
- GPU-required core workflows.
- Automatic insertion of predicted facts into the evidence graph.
- Fully automatic entity merging.
- Causal-explanation or courtroom-admissibility claims.
- Unbounded full-graph browser rendering.
- Broad plugin marketplace.
- Native mobile investigation.
- Every jurisdiction's policy implementation.
- Large-scale streaming guarantees.
- Advanced overlapping-community production workflows.
- Unreviewed automated report release.
- Facial recognition or protected-characteristic inference.

## 5. Personas and jobs

### Novice analyst

Needs a guided process, terminology explanations, safe defaults, examples, recovery, and interpretation warnings.

### Experienced analyst

Needs rapid search, expansion, temporal comparison, custom projections, recipes, shortcuts, and direct evidence access.

### Investigator

Needs paths, event sequences, intermediaries, information gaps, and evidence-supported leads.

### Reviewer

Needs source checking, contrary evidence, methods, confidence, policy checks, version differences, and approval controls.

### Governance roles

Privacy/legal reviewers, records custodians, auditors, and security administrators need purpose, restrictions, retention, correction, audit, and dissemination controls.

### Core jobs to be done

- Define a lawful, bounded investigative question.
- Explain why an entity or relationship appears.
- Preserve ambiguous identities instead of silently merging.
- Find evidence-supported temporal paths.
- Compare network states and community evolution.
- Inspect uncertainty, missingness, and alternative explanations.
- Test the effects of changing assumptions or parameters.
- Produce a report separating evidence from interpretation.
- Identify every downstream artifact affected by a correction.
- Learn the complete workflow without graph-science expertise.

## 6. P0 differentiated vertical slice

The first release candidate must prove these connected capabilities:

1. Bitemporal evidence and assertion-level provenance.
2. Anchored temporal graph comparison.
3. Explainable community lineage.
4. Correction impact analysis.
5. Complete guided novice investigation.
6. Smart defaults and customizable synchronized visualizations.
7. Reproducible finding and report generation.
8. Tamper-evident audit history.

### Synthetic case requirements

The training/evaluation case must contain:

- people, organizations, accounts, devices, locations, communications, transactions, and events;
- source reliability and information credibility variation;
- a possible alias;
- contradictory evidence;
- missing observation periods;
- late-arriving and corrected evidence;
- at least one community split or merge;
- at least one dormant/resurgent community;
- source and dissemination restrictions; and
- known synthetic ground truth.

## 7. Functional requirements

| ID | Pri. | Requirement | Acceptance |
|---|---:|---|---|
| REQ-FR-001 | P0 | Case and permissible-purpose scope | No case data are exposed before purpose and authorization are established; case, jurisdiction, time scope, owner, and handling policy are recorded. |
| REQ-FR-002 | P0 | Assertion-level temporal model | Every assertion records stable identity, subject, predicate, object, source, assertion class, valid/event time, knowledge/transaction time, status, confidence, and restrictions. |
| REQ-FR-003 | P0 | Historical reconstruction | Queries using `valid_at` and `known_at` reproduce expected late-arrival, correction, expiration, and supersession fixtures with zero future leakage. |
| REQ-FR-004 | P0 | Provenance drill-down | Every exportable graph element and derived result has a retrievable dependency chain to source assertions. |
| REQ-FR-005 | P0 | Evidence-class separation | Source reports, allegations, analyst judgments, deterministic results, model outputs, evidentiary findings, and judicial findings are structurally and visually distinct. |
| REQ-FR-006 | P0 | Temporal graph exploration | Search, bounded expansion, filters, paths, pin/hide, annotations, active-filter summary, and undo/redo are supported. |
| REQ-FR-007 | P0 | Anchored comparison | Users compare at least two periods with synchronized selection and stable positions; additions, no-longer-observed items, corrections, and uncertainty are distinguishable. |
| REQ-FR-008 | P0 | Community observations | At least one CPU detector runs over an explicit projection; algorithm, objective, projection, parameters, seed, input version, and memberships are retained. |
| REQ-FR-009 | P0 | Community-lineage DAG | Candidate and accepted links represent birth, continuation, split, merge, death, and resurgence independently from detection. |
| REQ-FR-010 | P0 | Lineage explanation | Lifecycle events expose overlap, membership changes, interactions, observation gaps, competing links, sensitivity, confidence, and provenance. |
| REQ-FR-011 | P0 | Guided analysis | A novice completes the prescribed synthetic investigation with step-by-step plain-language guidance, rationale, options, warnings, and recovery. |
| REQ-FR-012 | P0 | Transparent smart defaults | Time windows, relation projections, layouts, labels, and community settings have visible rationales, editable values, versioning, and reset-to-recommended. |
| REQ-FR-013 | P0 | Customizable visualization | Graph, timeline, table, and available map settings are customizable without removing mandatory evidence-status and uncertainty distinctions. |
| REQ-FR-014 | P0 | Synchronized views | Selection, filters, time range, knowledge cutoff, evidence threshold, permissions, and version are shared consistently across views. |
| REQ-FR-015 | P0 | Finding and report | Reports preserve question, scope, graph state, comparison, lineage, evidence, contrary evidence, assumptions, uncertainty, methods, and analyst notes. |
| REQ-FR-016 | P0 | Audit trail | Access, queries, views, edits, analyses, exports, report actions, and approvals create tamper-evident events. |
| REQ-FR-017 | P0 | Correction impact preview | Before recomputation, correction identifies affected graph elements, communities, lineage, saved analyses, findings, and reports. |
| REQ-FR-018 | P0 | Analysis versioning | Consequential parameter changes create a new version; prior results remain reproducible and comparable. |
| REQ-FR-019 | P0 | Error and recovery states | Empty, partial, failed, stale, permission-denied, interrupted, and long-running states explain what happened, what remains valid, and available recovery. |
| REQ-FR-020 | P1 | Reversible identity resolution | Candidate identities remain distinct until accepted; merge/split and reversal preserve rationale and downstream impact. |
| REQ-FR-021 | P1 | Alternative hypotheses | Analysts attach supporting, contradictory, and unresolved evidence to competing explanations. |
| REQ-FR-022 | P1 | Collaborative review | Findings and reports support comments, assignments, approval, rejection, and requested changes. |
| REQ-FR-023 | P1 | Controlled dissemination | Exports enforce restrictions, redaction, recipient authorization, purpose, released fields, and released version. |
| REQ-FR-024 | P1 | Retention and revalidation | Review dates, legal holds, expiry, revalidation, purge approval, and downstream effects are supported. |
| REQ-FR-025 | P1 | Evidence-constrained lead prioritization | Scores target relationships, events, anomalies, hypotheses, or gaps; include evidence, baseline, uncertainty, calibration, limitations, and abstention. |
| REQ-FR-026 | P2 | Temporal learned models | Learned models remain optional, cannot alter evidence or identity, and activate only after all model gates pass. |
| REQ-FR-027 | P2 | Incremental analytics | Incremental community/model updates require deterministic replay within documented tolerances. |

## 8. UX and visualization requirements

### Progressive disclosure

- Guided level: question, scope, time, evidence threshold, recommended graph and community view, uncertainty, finding, and report.
- Standard level: custom projections, multiple periods, relation weighting, lineage alternatives, recipes, styling, and table operations.
- Advanced level: algorithm, resolution, coupling, seeds, ensemble size, match features, thresholds, calibration, and reproducibility manifest.

Users may change levels without losing work.

### Required explanation contract

Every consequential control must answer:

1. What is this?
2. Why use it?
3. What is the current value?
4. Why is it the default?
5. What can go wrong?
6. What changes if adjusted?
7. Can it be undone?

### Graph defaults

- Bounded initial visible graph.
- Stable layout.
- Fixed node size.
- Shape and color encode entity type.
- Border/edge style encode evidence class.
- Evidence confidence or observation completeness may affect opacity.
- Centrality sizing is opt-in and warned.
- Communities are introduced only when the user requests the analysis.

### Customization

- Layout, spacing, labels, icons, grouping, edge routing, aggregation, annotations, comparison mode, and accessible themes.
- Customizations cannot suppress mandatory legends, evidence classes, restrictions, or uncertainty.
- Analytical settings and visual styling are stored separately.

### Accessibility

The core journey targets WCAG 2.2 AA:

- complete keyboard operation;
- visible focus and landmarks;
- no color-only meaning;
- color-blind-safe palettes;
- reduced-motion mode;
- adjustable contrast, type, labels, and density;
- screen-reader status announcements;
- equivalent table/text for every graph, timeline, and map;
- accessible exported reports.

## 9. Non-functional requirements

| ID | Pri. | Requirement |
|---|---:|---|
| REQ-NFR-001 | P0 | Deterministic historical reconstruction and recorded stochastic variation. |
| REQ-NFR-002 | P0 | Full P0 journey operates on 8 CPU cores, 16 GB RAM, and no GPU. |
| REQ-NFR-003 | P0 | Core journey conforms to WCAG 2.2 AA. |
| REQ-NFR-004 | P0 | No acknowledged write is lost; failed jobs do not publish partial analytical results. |
| REQ-NFR-005 | P0 | Every report has a complete reproducibility manifest. |
| REQ-NFR-006 | P0 | Default visual encodings are evidentially neutral. |
| REQ-NFR-007 | P0 | Every actionable derived output includes dependencies, temporal validity, uncertainty, and alternatives. |
| REQ-NFR-008 | P0 | Operational telemetry excludes sensitive case content. |
| REQ-NFR-009 | P1 | Production-pilot availability target is 99.5% monthly, excluding planned maintenance. |
| REQ-NFR-010 | P1 | UI, domain, analytics, adapters, evaluation, and policy interfaces are independently testable. |
| REQ-NFR-011 | P1 | Hardware and optional-acceleration requirements are reproducible and documented. |
| REQ-NFR-012 | P1 | Strings, dates, time zones, and policy text are localization-ready. |

## 10. Provisional CPU performance budgets

Reference fixture:

- 1,000 entities;
- 10,000 relationships/assertions;
- 12 or more periods;
- 25 or more sources;
- corrections, supersession, uncertain identities, and missing intervals;
- 8 CPU cores, 16 GB RAM, no GPU.

| Operation | P95 target |
|---|---:|
| Warm application shell and case summary | 2 s |
| Search or evidence drill-down | 1 s |
| Historical reconstruction | 2 s |
| Two-period change calculation | 3 s |
| Visible graph update up to 1,000 nodes / 5,000 edges | 2 s |
| Pan, zoom, and selection feedback | 100 ms |
| Community detection and lineage | 10 s |
| Correction impact preview | 5 s |
| Reproducible report generation | 10 s |

These are feasibility targets, not market-scale claims.

## 11. Security, privacy, and governance

- Enforce role, case, purpose, source, field, sensitivity, and handling restrictions.
- Apply authorization transitively to derived outputs and exports.
- Denied requests must not reveal restricted existence through counts, timing, autocomplete, or layout gaps.
- Encrypt data in transit and at rest.
- Keep sensitive values out of logs and generic telemetry.
- Preserve temporal history and audit through backup/restore.
- Require human review for sensitive identity, community, and lead-prioritization conclusions.
- Preserve uncertain identities.
- Do not use protected activity as a criminal predicate.
- Prohibit protected attributes and unjustified proxies from predictive features.
- Do not use real-person data in development fixtures without authorization.
- Mark reports stale when dependencies change.
- Make policy jurisdiction-configurable rather than claiming universal compliance.

## 12. Predictive model gates

Predictive scoring is P1/P2 and disabled by default until:

- the target, population, horizon, and operational decision are lawful and documented;
- training data pass provenance and availability-time checks;
- recency, frequency, EdgeBank, and calibrated classical baselines are evaluated;
- rolling-origin and realistic hard-negative evaluation is complete;
- calibration is reported by relation, horizon, novelty, source, period, and relevant subgroup;
- abstention and out-of-distribution handling exist;
- perturbation, missingness, and entity-error tests pass;
- explanations contain retrievable evidence and counterfactual sensitivity;
- human review and rollback are implemented; and
- person-level criminality scoring remains prohibited.

## 13. Release gates

| Gate | Pass condition |
|---|---|
| GATE-A Temporal correctness | 100% valid/knowledge-time fixtures pass; zero post-cutoff dependency. |
| GATE-B Provenance | 100% exportable outputs have retrievable dependency chains. |
| GATE-C Community lineage | Link precision/recall at least 0.85, event macro-F1 at least 0.80, and at least 50% fewer ID switches than raw labels on planted fixtures. |
| GATE-D Uncertainty | Results expose sensitivity and unresolved states; confidence responds to material evidence removal. |
| GATE-E Baseline value | Complex models achieve preregistered operational improvement on the target subset. |
| GATE-F Calibration | No worse Brier score than strongest baseline; aggregate ECE at most 0.05 and monitored subgroup ECE at most 0.10, or abstain. |
| GATE-G Robustness | Missingness, bridge deletion, and entity errors are tested; silent high-confidence failure rejects release. |
| GATE-H Explanation | Actionable outputs pass temporal-validity and evidence-coverage checks. |
| GATE-I Performance | P0 CPU budgets pass. |
| GATE-J Human factors | Guided completion and interpretation targets pass without increased unsupported conclusions. |
| GATE-K Governance | No critical bypass of purpose, authorization, audit, correction, retention, or dissemination controls. |
| GATE-L Accessibility | Critical journeys pass keyboard, screen-reader, non-color, and equivalent-view testing. |

## 14. Requirements traceability

Stable identifiers:

```text
EVID-1A-###  Market/workflow evidence
EVID-1B-###  Temporal/community evidence
HYP-###      Product hypothesis
STORY-###    User story
REQ-FR-###   Functional requirement
REQ-NFR-###  Non-functional requirement
RISK-###     Risk
TEST-U-###   Semantic/unit test
TEST-I-###   Integration test
TEST-E-###   Evaluation experiment
TEST-UX-###  Usability test
GATE-###     Release gate
DEC-###      Architecture decision
```

Every requirement must record:

```yaml
id:
priority:
statement:
rationale:
evidence:
user_stories:
dependencies:
risks:
acceptance_tests:
evaluation_gate:
owner:
status:
architecture_decisions: []
```

Architecture decisions remain empty until Phase 3.

## 15. Key risks and contradiction review

- Bitemporal provenance may fail interactive latency budgets.
- Entity-resolution errors may dominate community and path quality.
- Community ground truth may be plural or nonexistent.
- Temporal smoothing may hide real changes.
- A lineage matcher may create a false appearance of persistent identity.
- Smart defaults may encode hidden collection or domain assumptions.
- Rich customization may recreate misleading visual prominence.
- Heavy warnings may cause alert fatigue.
- The guided case may teach one answer instead of transferable reasoning.
- Synthetic success does not establish field effectiveness.
- Analysts may prefer manual chart freedom over reproducibility.
- Report reproducibility may conflict with lawful deletion or source revocation.
- Jurisdictional rules may materially change workflow and retention.
- Simple baselines may eliminate the business case for predictive models.

## 16. Architect/Builder/Reviewer sign-off

### Architect

- Product remains decision support.
- Temporal evidence is independent of analytics.
- Detection, lineage, prediction, calibration, and explanation remain separable.
- No vendor or framework is selected in Phase 2.

### Builder

- Every P0 requirement has an executable acceptance path.
- Synthetic fixtures include time, ambiguity, correction, and missingness.
- CPU budgets are explicit.
- The guided journey uses real functionality rather than mocked screens.
- Failure, undo, and correction paths are specified.

### Reviewer

- No model output is evidence or criminality.
- Missing data are not negative evidence.
- Future leakage is testable.
- Default visualization is neutral.
- Community objective, instability, and alternatives are disclosed.
- Authorization and audit cover derived outputs.
- Human-factor tests include overreliance.
- P0 boundaries are enforced.

## 17. Phase 2 verdict

Phase 3 may proceed around the P0 vertical slice.

The principal engineering risk is maintaining correct bitemporal provenance and downstream dependency tracing while preserving interactive latency. Predictive scoring is required by the final product objective but is explicitly gated after the deterministic investigation workflow proves correct and usable.
