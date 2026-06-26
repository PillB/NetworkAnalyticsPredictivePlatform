# Black-Box System Test Specification

Version: 0.1  
Scope: observable system behavior independent of implementation details

## 1. Test environments

- Synthetic data only.
- Fixed Harbor Lantern dataset version.
- Deterministic clocks and seeds.
- Analyst, reviewer, restricted analyst, auditor, and administrator roles.
- CPU-only reference environment.
- Browser tests in Chromium, Firefox, and WebKit where supported.

## 2. Temporal correctness

### BB-TIME-001 — Late evidence exclusion

Given an event on March 1 ingested March 20, when querying `valid_at=March 1` and `known_at=March 10`, the event is absent. With `known_at=March 21`, it is present.

Pass: exact expected result and no hidden dependency after cutoff.

### BB-TIME-002 — Correction preserves historical belief

Given assertion revision A corrected by B on March 25:

- a March 20 known-at query returns A;
- a March 26 query returns B;
- revision A remains inspectable as superseded.

### BB-TIME-003 — Validity and event distinction

A point communication event does not appear as a persistent relationship unless a separate persistent assertion supports it.

### BB-TIME-004 — Same timestamp atomicity

When event order is unknown, simultaneous events are processed as one atomic batch and no result relies on fabricated order.

### BB-TIME-005 — Future-leakage rejection

Any projection or analysis containing a dependency after the known-at cutoff is rejected and not published.

## 3. Provenance and correction

### BB-PROV-001 — “Why is this here?”

From every displayed node or edge, the user reaches source assertions within two interactions.

### BB-PROV-002 — Complete export dependency

Every exported chart element, finding claim, and report claim resolves to exact source assertion revisions.

### BB-PROV-003 — Contrary evidence

When sources disagree, both supporting and contradictory assertions are visible and classified.

### BB-PROV-004 — Correction impact

Changing a source assertion identifies all planted affected:

- graph elements;
- community observations;
- lineage events;
- analysis versions;
- findings;
- reports.

No unaffected artifact is incorrectly marked.

### BB-PROV-005 — Stale artifact behavior

After correction, old analyses remain reconstructable but are clearly marked stale and are not silently recomputed.

## 4. Authorization and privacy

### BB-AUTH-001 — Purpose required

An authenticated user without an active purpose-bound case session receives no case records or metadata.

### BB-AUTH-002 — Restricted-neighbor non-disclosure

Graph expansion does not reveal restricted entities through labels, counts, timing, placeholders, or layout gaps.

### BB-AUTH-003 — Authorized analytics

Community and path outputs are computed from the authorized subgraph. A restricted node has no hidden effect on visible membership, score, or layout.

### BB-AUTH-004 — Cache isolation

Results created under one actor/purpose/policy digest are never served under an incompatible context.

### BB-AUTH-005 — Export reauthorization

An export blocked by current policy cannot be produced from a previously visible analysis.

### BB-AUTH-006 — Derived restriction inheritance

A report or finding depending on restricted evidence inherits its restrictions.

## 5. Graph and synchronized views

### BB-VIS-001 — Bounded initial graph

The tutorial opens with at most 25 nodes and a complete legend.

### BB-VIS-002 — Stable comparison

Entities present in both periods use identical coordinates in side-by-side comparison.

### BB-VIS-003 — Change semantics

The interface distinguishes:

- appeared;
- no longer observed;
- corrected;
- attribute changed;
- community changed;
- uncertain.

It does not label “no longer observed” as “ended.”

### BB-VIS-004 — Shared selection

Selecting an event, entity, edge, table row, or map item updates all relevant views and inspector consistently.

### BB-VIS-005 — Safe defaults

Default node size is fixed; red does not indicate suspicion; evidence class and uncertainty remain visible.

### BB-VIS-006 — Customization safety

An unsafe or inaccessible preset is rejected with a specific reason. Reset restores the deterministic recommended preset.

### BB-VIS-007 — Visual/analysis version separation

Changing color or label density does not create a new analysis. Changing time, evidence inclusion, identity handling, or community parameters does.

## 6. Community and lineage

### BB-COMM-001 — Versioned detection run

Every community run records projection, algorithm, objective, parameters, seed, and memberships.

### BB-COMM-002 — Label independence

Persistent lineage does not depend on arbitrary community numeric labels.

### BB-COMM-003 — Lifecycle events

Planted birth, continuation, split, merge, death, and resurgence are represented explicitly.

### BB-COMM-004 — Competing interpretation

When two lineage matches are plausible, the output exposes both or marks the result unresolved.

### BB-COMM-005 — Evidence removal sensitivity

Removing material supporting evidence changes confidence or produces an explicit explanation for stability.

### BB-COMM-006 — Override preservation

An analyst override creates a new lineage version and does not erase the original algorithm result.

### BB-COMM-007 — Neutral language

No community output states or implies that a detected cluster is a criminal organization.

## 7. Analysis versions and jobs

### BB-JOB-001 — Atomic publication

A failed community job leaves the last valid result unchanged and never exposes partial output as complete.

### BB-JOB-002 — Cancellation

A running job can be cancelled; its state and retained valid results are explained.

### BB-JOB-003 — Progress

Long jobs expose named stages and reconnect through polling if the progress stream is interrupted.

### BB-VERSION-001 — Consequential change

Changing an analytical parameter previews the effect and creates a new immutable version.

### BB-VERSION-002 — Reproduction

Reopening an analysis version reproduces the same graph population, cutoffs, projection, community output, and manifest.

## 8. Guided workflow

### BB-GUIDE-001 — Complete journey

A new user can progress from landing to a reconstructable report through the required 16 screens.

### BB-GUIDE-002 — Explanations

Every consequential option answers what, why, current value, default rationale, risk, effect, and recovery.

### BB-GUIDE-003 — Guard enforcement

The workflow prevents skipping purpose, evidence inspection, uncertainty review, and report preflight.

### BB-GUIDE-004 — Resume

An interrupted tutorial resumes from the last valid checkpoint without corrupting analysis state.

### BB-GUIDE-005 — Knowledge check

Completion requires correct understanding of community limits, time semantics, missingness, and contrary evidence.

## 9. Reporting

### BB-REPORT-001 — Preflight

The report is blocked when a factual claim lacks evidence, a chart lacks cutoffs, contrary evidence is omitted, or restrictions are violated.

### BB-REPORT-002 — Reconstructable report

A released report reproduces its exact graph, evidence, analysis version, method, parameters, and layout.

### BB-REPORT-003 — Structured classes

Evidence, allegation, analyst judgment, assumption, unknown, and model output are visibly distinct.

### BB-REPORT-004 — Redaction preview

The preview and released sanitized report contain no restricted field or source leakage.

### BB-REPORT-005 — Stale dependency

A report whose dependency changes is marked stale and linked to the correction.

## 10. Audit

### BB-AUDIT-001 — Required actions

Access, denied access, searches, views, changes, analytical runs, exports, reports, and approvals create audit events.

### BB-AUDIT-002 — Integrity

Mutation, deletion, reordering, or insertion in the audit chain is detected.

### BB-AUDIT-003 — Content minimization

Audit records contain required identifiers and purpose but do not copy unnecessary source content.

### BB-AUDIT-004 — External checkpoint

The audit chain verifies against an independently stored checkpoint.

## 11. Accessibility

### BB-A11Y-001 — Keyboard journey

The complete critical workflow is usable without a pointer.

### BB-A11Y-002 — Graph equivalent

Every graph state has a relationship navigator, summary, and evidence table equivalent.

### BB-A11Y-003 — Non-color meaning

Removing color does not remove any required evidence, change, or uncertainty meaning.

### BB-A11Y-004 — Reduced motion

Reduced-motion mode disables nonessential animation while preserving state changes.

### BB-A11Y-005 — Report accessibility

Released reports have structured headings, table headers, alt text, and reading order.

## 12. Performance

### BB-PERF-001 — Reference budgets

All P0 operation budgets in the master specification pass on reference CPU hardware.

### BB-PERF-002 — Interaction responsiveness

Ordinary pan, zoom, and selection produce P95 feedback within 100 ms and no unexpected long main-thread task above 200 ms.

### BB-PERF-003 — Resource cleanup

Closing a case releases renderer and case-scoped cache resources near baseline.

## 13. Telemetry

### BB-TELEM-001 — No case content

Canary names, account numbers, evidence text, and query text never appear in logs, metrics, traces, or URLs.

### BB-TELEM-002 — Correctness indicators

Provenance coverage, stale analyses, missing dependencies, and leakage failures are observable without case content.

## 14. Predictive module tests

These are inactive until P1/P2.

- No person-level target.
- Explicit target, population, horizon, and decision.
- Baseline comparison.
- Rolling-origin and hard-negative evaluation.
- Calibration and abstention.
- Perturbation and entity-error robustness.
- Evidence-constrained explanation.
- Human acceptance/rejection record.
- No mutation of evidence or identity.

## 15. Evidence-priority baseline

These tests are active for the deterministic review-ordering baseline:

### BB-PRIORITY-001 — Neutral target

The target is a relationship, event, hypothesis, anomaly, or evidence gap.
Person-level guilt, criminality, dangerousness, and future-conduct targets are
rejected.

### BB-PRIORITY-002 — Temporal integrity

Evidence observed or recorded after the explicit cutoff cannot affect an
assessment or its ordering.

### BB-PRIORITY-003 — Exact explanation

Every output exposes factor contributions, missingness penalty, sensitivity
range, exact evidence versions, removal sensitivity, limitations, and baseline
version.

### BB-PRIORITY-004 — Abstention

Insufficient evidence or factor coverage produces no numeric index and an
explicit reason.

### BB-PRIORITY-005 — Authorization

Only evidence present in the authorized projection can affect a priority
assessment. Field restrictions change the queue before scoring.

### BB-PRIORITY-006 — No calibration claim

The baseline is labeled uncalibrated. Empirical evaluation bins remain marked
uncalibrated until an approved temporal calibration study passes.

### BB-PRIORITY-007 — Protected attributes

Protected attributes are unavailable as factors, proxies, evaluation fields,
or tie breakers.

### BB-PRIORITY-008 — Determinism

Identical versioned inputs produce byte-equivalent assessments and deterministic
competition ranks, including ties.

## 16. Financial fraud-ring and cuentas mulas workflow

### BB-FRAUD-001 — Required transaction fields

The workflow accepts records with transaction date/time, origin account/person,
destination account/person, identifiers, amount, currency, and transaction
type/description. Missing optional device/IP/KYC fields lower evidence coverage
instead of inventing certainty.

### BB-FRAUD-002 — Mule indicators are explainable

Every review-priority account exposes exact contributing indicators, exact
transaction dependencies, and contrary explanations.

### BB-FRAUD-003 — Temporal leakage is blocked

Transactions or infrastructure events after the known-at cutoff cannot affect
the before/after graph, mule score, report, or community roles.

### BB-FRAUD-004 — Neutral output language

The system labels accounts as review-priority or watch/background only. It does
not output guilt, criminality, dangerousness, or enforcement recommendations.

### BB-FRAUD-005 — Advanced model gates

Temporal GNN, heterogeneous GNN, sequence, and adaptive models remain disabled
unless leakage-safe benchmarks, hard negatives, calibration, robustness,
explanation, authorization, and human-factor gates pass.

### BB-FRAUD-006 — Graph manipulation safety

Dragging nodes, rotating/spinning the graph, undo/redo, and layout reset change
only visualization state. They do not create analytical versions or alter
evidence dependencies.

### BB-FRAUD-007 — Import preview and mapping

CSV/JSON transaction import shows mapped columns, accepted row counts, rejected
row counts, and required-field gaps before analysis is updated.

### BB-FRAUD-008 — Rejected-row reporting

Invalid timestamps, missing origin/destination, invalid amounts, missing
currency, and missing transaction type are rejected with row numbers and
human-readable reasons.

### BB-FRAUD-009 — Imported graph and report provenance

Accepted imported rows create a visible transaction graph and report dependency
set that records source file, parser version, row numbers, and normalized fields.

## 17. i2-class chart workspace

### BB-CHART-001 — Search and pin

Searching the visible authorized graph returns matching entities and
relationships without querying unauthorized data. Pinning a result creates a
workspace reference, not an evidence assertion.

### BB-CHART-002 — Bounded expansion

Expanding from the selected item adds visible authorized neighbors only and
records the expansion as reversible workspace state.

### BB-CHART-003 — Path finding

Path finding operates over the currently visible authorized graph. The path is
displayed as an exploratory chart aid, not proof of relationship strength or
criminal association. Every displayed path exposes exact visible relationship
dependencies, source labels, event time, known-at time, confidence, and caveats.

### BB-CHART-004 — Analyst annotations

Annotations are stored and labeled as analyst commentary. They do not become
source evidence or model output.

### BB-CHART-005 — Saved layouts

Saved and restored layouts preserve visual positions/rotation separately from
analytical versions and evidence dependencies.

### BB-CHART-006 — Workspace undo and redo

Workspace authoring actions, including pins, expansion, paths, annotations, and
saved-layout metadata, can be undone and redone without changing evidence
assertions, analytical versions, or report dependencies.
