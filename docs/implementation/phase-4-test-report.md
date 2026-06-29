# Phase 4 Implementation Test Report

Date: 2026-06-25  
Result: API-backed vertical slice passed; production data/identity gates remain open

## 1. Executed baseline

The reproducible runtime is Python 3.11.15 with locked FastAPI/Uvicorn/httpx
dependencies plus Node.js 24.13.1. `make setup` creates the environment.

`make test` currently covers:

- temporal point and window reconstruction;
- immutable revisions, corrections, provenance, and leakage rejection;
- canonical cross-layer fixture/schema validation;
- deterministic community lifecycle and uncertainty behavior;
- authorization-first service contracts and cache isolation;
- field/handling restrictions before topology and analytics;
- lineage member/projection consistency;
- report dependency reconstruction;
- FastAPI header, denial, static-serving, and workbench endpoints;
- PostgreSQL migration structural contracts;
- psycopg fixture import, point/window reconstruction, and pooled RLS context;
- OIDC/purpose/grant/policy session contracts and replay rejection;
- immutable object/report storage and external audit-anchor receipts;
- durable job lease, cancellation, publication, staleness, and audit contracts;
- explainable evidence-priority ordering, abstention, protected-input rejection,
  temporal leakage prevention, deterministic ties, and evaluation plumbing;
- frontend workflow, visualization, report, and fallback contracts.

`make test-browser` passes the static training fallback journey.

`make test-browser-api` passes the same desktop/mobile journey against Uvicorn
and the real FastAPI `WorkbenchBootstrapV1` endpoint. The browser confirms the
authorized-service status rather than silently accepting fallback data. It
also verifies the relationship/evidence-gap review queue, uncalibrated warning,
neutral language, and visible abstention.

`make test-browser-accessibility` passes keyboard and semantic-table checks at
200%, 300%, and 400% zoom-equivalent widths without horizontal page overflow.

`make test-browser-pages` builds the exact static artifact used by GitHub
Pages, serves it beneath `/NetworkAnalyticsPredictivePlatform/`, and passes the
seven-step journey and report preflight without asset, module, fixture, console,
or API-probing errors. It also verifies imported transaction state remains
coherent across graph, semantic table, Bloom-style path explanation, workspace
reload, AI citations, report preview, and report preflight without falling back
to stale Harbor Lantern or built-in fraud-case source IDs.

`make test-browser-postgres-required` builds the same GitHub Pages artifact,
preconfigures a demo API bridge in browser storage, mocks a PostgreSQL-required
503 bootstrap failure, and verifies the UI fails closed instead of treating the
static fallback as a successful PostgreSQL validation.

`make test-postgres-live` creates an isolated PostgreSQL 18.4 cluster under
`/tmp`, applies migrations 0001, 0002, and 0003, and verifies:

- idempotent canonical fixture import and exact serialized equivalence with the
  in-memory point/window repository;
- valid/recorded-time correction reconstruction;
- append-only mutation rejection;
- monotone and concurrent correction integrity;
- forced RLS allow/deny behavior;
- digest-only actor mapping, current immutable grant resolution, append-only
  revocation, atomic replay rejection, and live PostgreSQL security adapters;
- case-scoped security-definer job claims;
- staged output and atomic result-head publication;
- retained publications marked stale after correction;
- hash-chain advancement;
- 0002 and 0001 rollback.

## 2. Implemented contracts

- `HarborLanternInterchangeV1@1.0.0`
- `HistoricalQueryV1`
- `TemporalWindowQueryV1`
- `TemporalSnapshotV1`
- `TemporalWindowSnapshotV1`
- `AuthorizationContextV1`
- `CaseManifestV1`
- `AuthorizedTemporalProjectionV1`
- `ComparisonResultV1`
- `LineageResultV1`
- `ReportDraftV1`
- `WorkbenchBootstrapV1`
- `StructuredErrorV1`
- `EvidencePriorityAssessmentV1`
- durable job/publication/correction-impact contracts
- `AuthorizationSessionV1`
- `ContentAddressedObjectV1`
- `ExternalAuditAnchorReceiptV1`

The workbench report records its canonical fixture version. Backend temporal
fixtures, lineage scenarios, and frontend data all consume one JSON source.

## 3. Browser evidence

Playwright verifies:

- complete seven-step ELI5 desktop journey;
- 390 × 844 responsive journey without horizontal page overflow;
- skip navigation and dialog focus restoration;
- keyboard selection of semantic evidence rows;
- evidence/reasoning/options inspection;
- visual customization without analytical version mutation;
- analytical assumptions creating reversible versions;
- preflight-gated HTML report download and required report content;
- zero browser console or uncaught page errors;
- both authorized API and explicit static-fallback startup modes.
- configured PostgreSQL-required demo bridge failure is visible and is not
  reported as an authorized-service or successful fallback state.
- imported financial transaction evidence survives the browser-local training
  reload path and continues to drive downstream graph, workspace, AI, and report
  views using `imp-*` dependencies rather than stale `tx-*` or Harbor Lantern
  dependencies.

Screenshots and the exported report are written under
`test-results/playwright/`.

## 4. Defects found through evaluation

1. Root static serving initially broke repository-relative shared imports.
   Routing now redirects to `/apps/web/`.
2. `.mjs` assets initially used an invalid binary MIME type. Chromium refused
   to execute them; both servers now provide JavaScript MIME.
3. The original backend, analytics, and frontend fixtures represented different
   Harbor Lantern worlds. They now consume one versioned interchange.
4. The first PostgreSQL migration represented an explicit timestamp value
   `infinity` while asserting an unbounded range. It now uses a SQL `NULL`
   upper bound so `upper_inf()` is true.
5. The migration omitted domain assertion classes `observed_event` and
   `persistent_state`; both are now included.
6. Global audit reads were not fail-closed without actor/purpose context. The
   RLS policy now requires both.
7. Projection caching regressed when window support initially materialized a
   snapshot before cache lookup. Snapshot creation is now lazy and cached
   requests do not touch the repository.
8. Lineage initially accepted arbitrary community members unrelated to the
   authorized projection. Such inputs now fail with
   `lineage_projection_mismatch`.
9. Security-definer job functions initially relied on lease secrecy and a
   global lease reaper. Claim, heartbeat, publication, correction impact, and
   reaping now require explicit case authorization; claim/reaping are scoped to
   one target case.
10. Persistence tests initially depended on undeclared pytest and skipped their
    live database paths. They now run under the locked unittest gate, while the
    permanent PostgreSQL harness proves exact repository equivalence.
11. Database/source rehydration initially drifted in status, source metadata,
    and correction-reason semantics. Exact snapshot comparison exposed and
    corrected all three.
12. Adding canonical fixture data to the live cluster exposed a global-count
    assertion in an older migration test. The check is now scoped to its own
    assertion identity.
13. The first shared-security integration stored raw issuer values while the
    adapter supplied an issuer digest. Fake tests passed on both sides; a live
    adapter/schema test exposed the mismatch and both now use 32-byte SHA-256
    issuer digests.
14. Reflow automation found the visualization popover obscuring its own toggle,
    the skip link using a substandard focus indicator, and the Relations select
    causing 21 pixels of overflow at 400%. CSS corrections now pass all three
    zoom-equivalent widths.

## 5. Reviewer retrospective — what could make this wrong?

- Live PostgreSQL proves the tested paths, but not all query plans, high
  concurrency patterns, backup/restore behavior, or production role topology.
- The FastAPI training authorization is still header-based demonstration
  plumbing. Production-oriented OIDC/policy contracts exist, but a real issuer
  callback/session transport and external policy adapter are not configured.
  PyJWT HTTPS-JWKS signature verification and shared actor, grant, revocation,
  and replay stores are tested.
- Static fallback is appropriate only for synthetic training. It must be
  disabled for operational deployments.
- Browser automation strengthens functional accessibility evidence but does
  not prove WCAG 2.2 AA, screen-reader compatibility, or novice comprehension.
- The current community input is a deterministic planted fixture, not a
  production detector benchmark.
- Durable job and correction-impact semantics are implemented and live-tested.
  Immutable filesystem and S3-compatible object/report and audit-anchor
  adapters are tested; a continuously running worker, configured provider,
  independent external anchor operation, backup, and restore are not running.
- Predictive lead scoring remains intentionally disabled until its evaluation
  and governance gates pass.

## 6. Next promotion tests

1. Integrate OIDC authorization-code/PKCE callback and secure session transport
   plus an external policy adapter around the verified-token and shared-store
   contracts.
2. Benchmark PostgreSQL/service/concurrent temporal windows, reverse
   dependencies, jobs, and lineage at approved scale tiers; retain the current
   in-memory CPU feasibility result only as a baseline.
3. Execute screen-reader, native-browser zoom, contrast/forced-colors, and
   moderated novice/overreliance studies; automated 200–400% reflow now passes.
4. Integrate cloud object persistence, worker runtime, independent audit
   dispatch/anchoring, backup, and restore.
5. Run temporal calibration, robustness, overreliance, and governance studies
   before operationally enabling evidence-priority ordering.
