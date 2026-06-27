# Full Flow Validation Audit

Date: 2026-06-26

## Objective

Validate that implemented user flows are functional, interactive, integrated
across modules, and not silently backed by stubs or disconnected placeholder
logic. This audit covers the current synthetic training application, API-backed
bootstrap mode, GitHub Pages training build, browser flows, accessibility,
competitor-parity audits, and live PostgreSQL integration.

## Phase Checklist And Results

### Phase 0 - Baseline and scope

- Worktree started clean on `main...origin/main`.
- `AGENT_STATE.md` was read before action.
- Current harness includes Python unit/integration tests, frontend module tests,
  static and API-backed Playwright journeys, Pages preview/remote validation,
  accessibility checks, parity audits, and live PostgreSQL 18 integration.

Retrospective:

- The existing browser Pages test is already the broadest integrated user-flow
  check. It covers use-case switching, import, graph controls, workspace,
  manual charting, Bloom-style phrases, AI tools, and report preflight.
- No immediate test-harness gap required a new regression test before running
  the full validation pass.

### Phase 1 - Stub and placeholder audit

Search terms:

- `TODO`
- `stub`
- `placeholder`
- `not implemented`
- `fake`
- `mock`
- `demo-only`
- `training-only`
- `return null`
- `throw new Error`

Findings:

- Fail-closed `throw new Error` paths are contract validation and server/test
  readiness checks, not user-facing stubs.
- `return null` in transaction import is explicit invalid input handling for
  missing timezone or unsupported boolean parsing.
- `return null` in workspace snapshot restore is fail-closed handling for empty
  or malformed `localStorage`.
- `fake` and `mock` hits are test fixtures or comments describing test doubles.
- HTML `placeholder` hits are input hints only.
- `training-only` references are intentional deployment boundaries for GitHub
  Pages and synthetic data.
- The only product gap surfaced by the scan is already documented:
  geospatial map/timeline functionality is designed but not implemented.

Retrospective:

- No hidden implementation stub was found in active user-flow logic.
- The current app still has explicit production boundaries: GitHub Pages is
  static training-only, AI is deterministic/local, and predictive display stays
  disabled.

### Phase 2 - Module and contract validation

Passed commands:

- `npm test`
  - 78 frontend tests passed.
- `make test-python`
  - Backend, analytics, API, database, jobs, prioritization, benchmark,
    persistence, security, and storage tests passed.
  - Two DSN-dependent persistence tests were skipped as designed when
    `NAPP_TEST_DSN` is unset.

Coverage confirmed:

- Harbor Lantern guided workflow.
- Financial fraud/cuentas mulas workflow.
- CSV/JSON transaction import and validation.
- Graph projection/layout/image metadata.
- i2-style chart workspace and redaction/export contracts.
- Linkurious-style search/pin/expand/comment/task/review workspace.
- Neo4j Bloom-style phrase parsing and scene presets.
- Step 8 predictive model gates and production-readiness contracts.
- Step 9 AI assistant, refusal, citations, red-team, and production-readiness
  contracts.
- API client static fallback and authorized API bootstrap.

Retrospective:

- Module tests exercise state transitions independently from browser rendering,
  which reduces the chance that a UI-only status message masks broken logic.
- These are still synthetic fixtures; representative human-factor validation is
  not replaced by module tests.

### Phase 3 - Browser user-flow validation

Passed commands:

- `npm run test:browser`
- `PLAYWRIGHT_SERVER=api npm run test:browser`
- `npm run test:pages`
- `npm run audit:i2`
- `npm run audit:workspace`
- `npm run audit:bloom`

Flow evidence:

- Static browser journey completed guided analysis, keyboard selection, visual
  controls, analysis versioning, report preflight, report export, and mobile
  layout without console/page errors.
- API-backed browser journey loaded the authorized service projection and
  evidence-priority queue, including abstention behavior.
- Pages journey validated subpath routing and exercised the integrated fraud
  flow:
  - switched to fraud/cuentas mulas;
  - ran Bloom-style graph queries and scene presets;
  - previewed JSON and CSV imports;
  - applied imported transactions;
  - changed boardroom graph style;
  - set/reset node icons and images;
  - rotated, dragged, undid, and reset graph layout;
  - saved search, pinned result, expanded neighbors, and found paths;
  - added comments, notes, tasks, review status, annotations, manual entities,
    manual links, redaction, chart export, and case packet export;
  - saved/restored workspace snapshots and layout presets;
  - opened model cards and confirmed production prediction blockers;
  - exercised AI query preview, gap finder, coach, active-learning suggestion,
    cited answer, unsupported-accusation refusal, report draft, save-as-note,
    and red-team review;
  - completed report preflight.
- Parity audits refreshed public-feature-class evidence for i2, Linkurious /
  Obsidian workspace behavior, and Neo4j Bloom-style graph exploration.

Retrospective:

- The Pages browser flow is currently the strongest black-box integration test
  because it validates many user actions in one session and checks downstream
  panels rather than only button clicks.
- Competitor-parity audits prove public feature-class parity only; they do not
  prove proprietary pixel-perfect replication or private product workflows.

### Phase 4 - Accessibility, build, and live persistence

Passed commands:

- `npm run build:pages`
- `node tests/browser/accessibility.e2e.mjs`
- `.venv/bin/python tests/database/live_postgres_integration.py`
- `make test-all`

Notes:

- The first unprivileged live PostgreSQL command failed while initializing the
  temporary cluster with `initdb`; rerunning with the required environment
  permissions passed. The aggregate `make test-all` also passed with the same
  permissions.
- Accessibility checks passed at 200%, 300%, and 400% zoom-equivalent reflow,
  including semantic table access and keyboard focus visibility.
- Live PostgreSQL 18 integration passed migrations, bitemporal correction,
  concurrency, forced RLS, shared identity/grants/replay, atomic publication,
  stale propagation, audit chain, and rollback.

Retrospective:

- Localhost browser servers and temporary PostgreSQL clusters require elevated
  sandbox permissions in this environment; that is an execution-environment
  constraint, not a product failure.
- Automated accessibility still does not replace screen-reader, forced-colors,
  or representative novice/analyst sessions.

## Integration Diagnosis

The active user-flow logic is connected through real modules rather than static
status-only UI:

- `apps/web/app.mjs` event handlers call package functions for workflow state,
  import preview/application, chart workspace reducers, graph rendering,
  Bloom-style exploration, predictive gates, and AI assistant contracts.
- Analysis state and visualization state remain separate: visual changes do not
  mutate evidence dependencies or analysis versions.
- Imported transactions replace the active fraud workflow source and update the
  graph heading, graph model, semantic table, detector output, report model, and
  preflight path.
- Workspace actions flow through reducer-style helpers and update chart rows,
  notes, exports, case packets, undo/redo history, snapshots, and localStorage
  restore behavior.
- AI assistant actions retrieve visible evidence, cite local dependencies,
  refuse prohibited prompts, save only analyst notes, and expose production
  blockers rather than enabling external AI.
- Predictive model panels display model cards and production blockers; no
  production prediction display is enabled.

## Remaining Gaps

- GitHub Pages remains synthetic training-only and cannot enforce operational
  OIDC, purpose grants, RLS, audit retention, malware scanning, or data
  retention.
- AI remains deterministic/local. Production still needs server-side authorized
  retrieval, persistent AI audit storage, provider isolation, prompt-injection
  sandboxing, privacy/security review, and representative overreliance studies.
- Step 8 remains simulation/gating, not trained neural deployment. Real
  TGNN/GNN artifacts, calibration curves, model-provider integration, and
  representative analyst-overreliance evidence remain required.
- Map/timeline/geospatial capability is still designed but not implemented.
- Manual chart/workspace persistence is browser-local in the training build;
  production shared persistence and multi-user concurrency remain open.
- Human-factor evidence remains unrun: novice comprehension, analyst value,
  screen-reader behavior, forced-colors behavior, and automation-bias studies
  are still required before production-pilot claims.

## Final Status

All automated validation phases passed after using the required sandbox
permissions for local browser servers and the temporary PostgreSQL cluster. No
hidden active-flow stub or disconnected placeholder logic was found. The
validated system remains a synthetic training MVP with explicit production
boundaries.
