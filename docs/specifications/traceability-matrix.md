# Requirements and Decisions Traceability Matrix

Version: 0.1

## 1. Core traceability

| Requirement group | Architecture decisions | Primary black-box tests | User tests | Gates |
|---|---|---|---|---|
| REQ-FR-001 purpose/scope | DEC-006, DEC-012, DEC-026, DEC-029 | BB-AUTH-001 | UAT-NOV-002, governance tests | K |
| REQ-FR-002–003 temporal model | DEC-001, DEC-004 | BB-TIME-001–005 | UAT-NOV-006 | A |
| REQ-FR-004 provenance | DEC-001, DEC-005, DEC-010, DEC-025, DEC-027 | BB-PROV-001–005 | UAT-NOV-005, UAT-REV-001 | B, H |
| REQ-FR-005 evidence classes | DEC-013, DEC-014 | BB-REPORT-003, BB-VIS-005 | UAT-NOV-004–005 | H, J |
| REQ-FR-006 graph exploration | DEC-003, DEC-004, DEC-005 | BB-VIS-001–004 | UAT-EXP-002 | I, J, L |
| REQ-FR-007 comparison | DEC-003, DEC-004 | BB-VIS-002–003 | UAT-NOV-007 | I, J |
| REQ-FR-008–010 communities | DEC-007, DEC-008 | BB-COMM-001–007 | UAT-NOV-008–009 | C, D, H |
| REQ-FR-011 guided flow | DEC-013 | BB-GUIDE-001–005 | UAT-NOV-001–013 | J, L |
| REQ-FR-012 defaults | DEC-013, DEC-014 | BB-VIS-005–007, BB-GUIDE-002 | UAT-NOV-010 | J, L |
| REQ-FR-013–014 visualization | DEC-003, DEC-004, DEC-014 | BB-VIS-001–007, BB-A11Y-001–004 | customization/accessibility tests | I, J, L |
| REQ-FR-015 reports | DEC-010, DEC-011, DEC-027, DEC-030 | BB-REPORT-001–005 | UAT-NOV-011–012, reviewer tests | A, B, H, K, L |
| REQ-FR-016 audit | DEC-001, DEC-002, DEC-015, DEC-027, DEC-030 | BB-AUDIT-001–004 | governance tests | K |
| REQ-FR-017 correction | DEC-001, DEC-005 | BB-PROV-004–005 | UAT-EXP-005 | A, B, K |
| REQ-FR-018 versions | DEC-002, DEC-013 | BB-VERSION-001–002 | UAT-NOV-010, UAT-EXP-004 | A, B |
| REQ-FR-019 recovery | DEC-002, DEC-013 | BB-JOB-001–003 | error-recovery tests | I, J, L |
| REQ-FR-020 identity | DEC-001, DEC-005 | future identity tests | P1 | A, B, K |
| REQ-FR-021 hypotheses | DEC-011 | future hypothesis tests | P1 | H, J |
| REQ-FR-022–024 review/governance | DEC-006, DEC-010–012 | BB-AUTH/REPORT/AUDIT | reviewer/governance tests | K |
| REQ-FR-025–027 predictive | DEC-016 | predictive black-box suite | overreliance tests | E, F, G, H, K |
| REQ-FR-025 evidence-priority baseline | DEC-016, DEC-024 | BB-PRIORITY-001–008 | overreliance and explanation tests | E, F, G, H, K |

## 2. Non-functional traceability

| Requirement | Tests | Gate |
|---|---|---|
| REQ-NFR-001 determinism | BB-TIME, BB-VERSION, BB-COMM | A, C |
| REQ-NFR-002 CPU | BB-PERF-001, `benchmarks/core_cpu.py` | I |
| REQ-NFR-003 accessibility | BB-A11Y, automated zoom/reflow, representative accessibility UAT | L |
| REQ-NFR-004 reliability | BB-JOB-001–003 | I, K |
| REQ-NFR-005 reproducibility | BB-VERSION-002, BB-REPORT-002 | A, B |
| REQ-NFR-006 neutrality | BB-VIS-005–006 | J, L |
| REQ-NFR-007 explanation | BB-PROV, BB-COMM, BB-REPORT | H |
| REQ-NFR-008 telemetry | BB-TELEM-001–002 | K |

## 3. Required implementation evidence

For every completed requirement, record:

- source files;
- migration/schema files;
- API contracts;
- automated tests;
- manual/user-test evidence;
- performance result;
- unresolved risks;
- release-gate result.

This matrix must be updated as code and tests are added.

## 4. Phase 4 vertical-slice evidence

| Requirement/test group | Implementation evidence | Automated evidence | Current result / remaining boundary |
|---|---|---|---|
| REQ-FR-002–004, 017; BB-TIME-001–005; BB-PROV-001, 004–005 | `apps/api/temporal/`, `apps/api/persistence/`, `data/fixtures/harbor-lantern.v1.json`, `db/migrations/0001_initial.sql` | `tests/backend/`, `tests/persistence/`, `tests/database/live_postgres_integration.py` | Point and window reconstruction, immutable revisions, late evidence, corrections, provenance, future-leakage rejection, idempotent fixture import, and exact serialized in-memory/PostgreSQL projection equivalence pass on PostgreSQL 18. |
| REQ-FR-001, 003–010, 014–016, 019, 023; BB-AUTH-001–006 | `apps/api/contracts/`, `apps/api/service/`, `apps/api/security/`, `apps/api/persistence/rls.py`, `db/migrations/0003_security_identity_and_grants.sql`, `apps/api/demo_bundle.py`, `apps/api/optional_api.py` | `tests/api/`, `tests/security/`, `tests/persistence/test_rls.py`, live PostgreSQL 18 | Authorization occurs before repository access; OIDC/policy contracts reject invalid, replayed, expired, revoked, stale, and non-current inputs. Shared PostgreSQL stores map digest-only identities, resolve immutable current grants, atomically reject replay, and drive full transaction-local RLS context. A production cryptographic verifier, browser callback/session transport, and external policy adapter remain deployment work. |
| REQ-FR-008–010; BB-COMM-002–004; REQ-NFR-001 | `analytics/lineage/` | `tests/analytics/test_lineage.py` | 7 tests pass: detector-label independence, deterministic repeatability, birth, continuation, death, split, merge, resurgence, and uncertainty flags. Production detector and version persistence remain pending. |
| REQ-FR-006–015, 018; BB-VIS-001–007; BB-GUIDE; BB-REPORT; accessibility baseline | `apps/web/`, `packages/api-client/`, `packages/design-system/`, `packages/graph-renderer/`, `packages/guided-workflow/` | `tests/frontend/`, `tests/browser/playwright.e2e.mjs` | Module tests plus static and API-backed Playwright desktop/mobile journeys pass: seven-step novice flow, authorized bootstrap, stable comparison, semantic mirror, defaults, version separation, keyboard/focus, report export, no-overflow, and safeguards. Formal screen-reader and representative-user sessions remain pending. |
| Integrated executable baseline | `Makefile`, `uv.lock`, `pyproject.toml`, `scripts/serve-web.mjs`, `apps/api/optional_api.py` | `make test-all` | Locked Python 3.11 FastAPI/psycopg runtime, static fallback, authorized API browser journey, live isolated PostgreSQL 18 migrations/rollback, frontend modules, and downloaded report are verified. Production OIDC transport, external policy service, cloud object adapter, and deployment configuration remain pending. |
| REQ-FR-015–016, 019; BB-JOB-001–003; BB-PROV-004–005; BB-REPORT; BB-AUDIT | `apps/api/jobs/`, `apps/api/storage/`, `db/migrations/0002_jobs_and_staleness.sql` | `tests/jobs/`, `tests/storage/`, `tests/database/live_postgres_integration.py` | Bounded jobs and live publication pass. Filesystem and SDK-neutral S3-compatible adapters verify SHA-256 content, conditional no-overwrite publication, exact report reconstruction, append-only retention evidence, traversal resistance, and content-free chained audit receipts. Provider wrapper configuration, bucket controls, and independently operated anchoring remain deployment work. |
| REQ-FR-011–014; REQ-NFR-003; Gate L | `apps/web/`, `tests/browser/accessibility.e2e.mjs`, `docs/evaluation/accessibility-automation.md`, `docs/evaluation/novice-overreliance-and-accessibility-protocol.md` | Playwright keyboard/semantic-table checks pass at 200%, 300%, and 400% zoom-equivalent widths | Automated reflow is prerequisite evidence. Native zoom, representative novice/overreliance, forced-colors, and screen-reader sessions remain required before Gate L passes. |
| REQ-FR-025; BB-PRIORITY-001–008 | `analytics/prioritization/`, `apps/api/demo_bundle.py`, evidence-priority UI | `tests/prioritization/`, API tests, API-backed Playwright | Deterministic relationship/gap review ordering, protected-input rejection, cutoff enforcement, abstention, explanations, sensitivity, exact dependencies, restricted-topology behavior, and neutral UI pass. Calibration, operational labels, and human-factor release gates remain open. |
| REQ-NFR-002, 011; BB-PERF-001 | `benchmarks/core_cpu.py`, `docs/evaluation/cpu-feasibility-baseline.md` | `tests/benchmarks/test_core_cpu.py`, `make benchmark` | On the recorded 8-CPU environment, the 1k-entity/10k-assertion in-memory feasibility workload is far below provisional latency budgets. This is not database, HTTP, browser-rendering, concurrency, or production-scale evidence. |
| Training MVP web deployment; guided-flow availability | `scripts/build-pages.mjs`, `.github/workflows/pages.yml`, `docs/deployment/github-pages.md` | `tests/browser/pages.e2e.mjs`, `make test-browser-pages` | Generated artifact passes under `/NetworkAnalyticsPredictivePlatform/`: assets, JSON modules, static-training mode, seven-step journey, and report preflight work without browser errors. Public HTTPS deployment remains blocked on repository creation/authentication. |
