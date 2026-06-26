# GitHub Pages MVP Deployment

Status: implementation and local deployed-mode browser test passed; remote
publication requires an authenticated GitHub repository.

## Deployment boundary

GitHub Pages hosts only the synthetic Harbor Lantern training MVP. It has no
FastAPI, PostgreSQL, OIDC, policy service, worker, cloud object store, or
operational case data. The generated page is explicitly marked as a static
training deployment and does not probe a nonexistent API.

Do not use Pages for operational evidence or authenticated investigations.

## Artifact

Run:

```bash
make pages-build
```

The generated `dist-pages/` directory contains:

- a repository-root redirect;
- the workbench under `apps/web/`;
- the shared frontend packages and canonical synthetic fixture;
- `.nojekyll`;
- a static 404 redirect.

Repository-relative imports remain intact, so the application works beneath a
project path such as:

```text
https://OWNER.github.io/NetworkAnalyticsPredictivePlatform/
```

## Local deployed-mode verification

Run:

```bash
make test-browser-pages
```

The Playwright test serves the artifact under
`/NetworkAnalyticsPredictivePlatform/` and verifies:

- root redirect to the application;
- JavaScript, CSS, and JSON fixture loading from the project subpath;
- explicit static-training status;
- seven-step guided journey completion;
- safe absence of API-only evidence-priority ordering;
- finding creation and report preflight;
- no browser console or page errors.

## GitHub Actions

`.github/workflows/pages.yml` follows GitHub's custom Pages workflow:

- checkout and Node setup;
- frontend contract tests;
- deterministic Pages artifact build;
- `actions/configure-pages`;
- `actions/upload-pages-artifact`;
- `actions/deploy-pages` with `pages: write` and `id-token: write`.

Before the first deployment, configure the repository's Pages source as
**GitHub Actions** under **Settings → Pages**. Pushes to `main` then deploy the
artifact; `workflow_dispatch` supports a manual retry.

## Promotion evidence

After publication, record:

- repository and commit SHA;
- Pages workflow run URL and conclusion;
- deployed Pages URL;
- remote Playwright result against the HTTPS URL;
- any differences from the local subpath preview.

The deployment is not complete until the public HTTPS URL passes the same
guided journey and report-preflight assertions.
