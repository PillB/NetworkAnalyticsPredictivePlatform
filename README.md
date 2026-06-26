# Network Analytics Predictive Platform

An evidence-first criminal-network analysis workbench focused on temporal
reconstruction, provenance, dynamic community lineage, and understandable
analyst workflows.

The current Phase 4 vertical slice implements and verifies the highest-risk
product semantics through FastAPI, psycopg, PostgreSQL 18, browser automation,
and dependency-light analytical modules:

- bitemporal assertion reconstruction without future-information leakage;
- source-level provenance and correction history;
- deterministic CPU-only community lineage;
- explainable relationship/evidence-gap review prioritization with abstention;
- durable bounded jobs, atomic publication, and correction staleness contracts;
- purpose-bound OIDC/policy session contracts and transaction-local RLS;
- shared PostgreSQL actor/grant/replay state using digest-only identifiers;
- immutable filesystem and S3-compatible object/report storage and audit receipts;
- a complete Harbor Lantern guided analysis for first-time users;
- a selectable synthetic financial transaction workflow for cuentas mulas and
  fraud-ring review-priority detection;
- smart visualization defaults with inspectable customization;
- direct graph manipulation: drag nodes, rotate/spin, undo/redo layout edits,
  and reset to the recommended layout;
- semantic alternatives to visual graph content.

Analytical output is decision support. It is not a determination of guilt.

## Run the checks

```bash
make setup
make test
```

Setup creates the locked Python 3.11 environment. The test command runs
temporal, analytics, authorization/API, migration-contract, and
browser-independent frontend tests.

For the real-browser journey, responsive layout, keyboard interaction, and
report export checks:

```bash
make test-browser
make test-browser-accessibility
```

`make test-all` runs unit/contract checks plus both static-fallback and real
FastAPI-backed browser journeys and an isolated PostgreSQL 18 integration
cluster. It also validates the generated GitHub Pages artifact under a project
subpath. The browser tests use an existing Playwright installation and matching
cached Chromium binary.

## GitHub Pages training MVP

```bash
make pages-build
make test-browser-pages
PAGES_REMOTE_URL=https://pillb.github.io/NetworkAnalyticsPredictivePlatform node tests/browser/pages.e2e.mjs
```

The Pages artifact is a synthetic, unauthenticated training deployment only.
It includes both the Harbor Lantern temporal-community tutorial and the
financial transaction mule-account/fraud-ring training case.
The deployment workflow is in `.github/workflows/pages.yml`; see
[GitHub Pages deployment](docs/deployment/github-pages.md).

For the reproducible CPU-only feasibility workload:

```bash
make benchmark
```

The result is written to `test-results/benchmarks/core-cpu.json`; it is an
in-memory feasibility baseline, not a production service benchmark.

## Run the API-backed application

```bash
make api
```

Then open `http://127.0.0.1:4173`. The browser requests an authorized,
versioned `WorkbenchBootstrapV1` from FastAPI. If the API is unavailable, the
training-only static server uses an explicitly labeled canonical fallback.

## Run the guided demonstration

```bash
make demo
```

Then open `http://127.0.0.1:4173`. The guided path explains each choice,
provides safe defaults, shows temporal changes and provenance, and produces a
reviewable report preview.

## Authoritative documentation

- [Master specification](MASTER_SPECIFICATION.md)
- [i2-class AI-enhanced execution checklist](docs/implementation/i2-better-ai-execution-checklist.md)
- [Financial fraud-ring use case](docs/requirements/financial-fraud-ring-use-case.md)
- [System architecture](docs/architecture/system-architecture.md)
- [Black-box tests](docs/specifications/black-box-tests.md)
- [User acceptance tests](docs/specifications/user-acceptance-tests.md)
- [Traceability matrix](docs/specifications/traceability-matrix.md)
- [Guided analysis journey](docs/ux/guided-analysis-journey.md)

## Repository boundaries

```text
apps/api/                 temporal domain and service boundary
apps/web/                 analyst workbench
analytics/                replaceable analytical engines
packages/                 reusable frontend workflow/rendering modules
tests/                    executable acceptance evidence
docs/                     research, requirements, architecture, UX, tests
scripts/                  local development entry points
```

PostgreSQL and FastAPI adapters are executable. React/Cytoscape production
packaging, real OIDC/policy providers, cloud object storage, independent audit
anchoring, and deployment infrastructure remain promotion work.
