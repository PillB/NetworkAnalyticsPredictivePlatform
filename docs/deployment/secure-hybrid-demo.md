# Secure Hybrid Demo: GitHub Pages to Local PostgreSQL

Date: 2026-06-26

## Architecture

Do not connect GitHub Pages directly to PostgreSQL from browser JavaScript.
The browser is an untrusted public client and cannot safely hold database
credentials, client certificates, or RLS context. The supported demo path is:

`GitHub Pages browser -> HTTPS demo API bridge -> PostgreSQL`

The API bridge is responsible for:

- demo login and short-lived bearer token issuance;
- CORS origin allow-listing;
- server-side PostgreSQL credentials and TLS configuration;
- transaction-local RLS context;
- live PostgreSQL security probe for TLS, runtime role, forced RLS, and
  transaction-local context;
- provenance-safe workbench responses.

## Source-Backed Security Baseline

- PostgreSQL documents that TLS can encrypt client/server communication and
  recommends `sslmode=verify-full` in security-sensitive environments because
  it verifies both the certificate chain and host identity:
  https://www.postgresql.org/docs/current/libpq-ssl.html
- PostgreSQL row security is default-deny when enabled without policies;
  superusers and `BYPASSRLS` roles bypass RLS, and owners normally bypass RLS
  unless `FORCE ROW LEVEL SECURITY` is used:
  https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- OWASP REST guidance says non-public REST services need HTTPS and endpoint
  access control:
  https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html
- OWASP API Security Top 10 2023 identifies broken object-level authorization,
  broken authentication, property-level authorization, resource consumption,
  and security misconfiguration as core API risks:
  https://owasp.org/API-Security/editions/2023/en/0x11-t10/
- MDN CORS guidance explains that cross-origin access is controlled by server
  response headers and must not be treated as authentication:
  https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS

## Local Demo Accounts

The ignored local file `local-demo-accounts.txt` contains two test accounts:

- `analyst@example.test` / `demo-pass-1`
- `reviewer@example.test` / `demo-pass-2`

The file format is:

```text
username:password:actor_id:purpose:allowed_fields_csv
```

The file is intentionally ignored by git. Rotate or replace these credentials
for any shared demo environment.

## API Bridge Environment

Set these variables before starting the API bridge:

```bash
export NAPP_DEMO_AUTH_REQUIRED=1
export NAPP_DEMO_TOKEN_SECRET="$(openssl rand -hex 32)"
export NAPP_DEMO_ACCOUNTS_FILE=local-demo-accounts.txt
export NAPP_DEMO_ALLOWED_ORIGINS=https://pillb.github.io
export NAPP_DEMO_REQUIRE_POSTGRES_TLS=1
export NAPP_POSTGRES_DSN='postgresql://demo_app:REDACTED@localhost:5432/napp?sslmode=verify-full&sslrootcert=/absolute/path/to/root.crt'
```

Then start the API:

```bash
.venv/bin/uvicorn apps.api.optional_api:app --host 127.0.0.1 --port 4173
```

For GitHub Pages to reach a local machine, expose the API through a trusted
HTTPS tunnel or reverse proxy. The public browser must use an `https://` API
URL unless it is loopback-only local testing. Do not expose PostgreSQL itself
to the public internet.

## PostgreSQL Requirements

- Use a dedicated non-owner runtime role.
- Runtime role must not be superuser and must not have `BYPASSRLS`.
- Case-scoped tables must keep `ENABLE ROW LEVEL SECURITY` and
  `FORCE ROW LEVEL SECURITY`.
- API transactions must set RLS context with transaction-local settings:
  `app.actor_id`, `app.purpose_id`, and `app.authorized_case_ids`.
- PostgreSQL TCP connections for the demo must use `sslmode=verify-full` and
  `sslrootcert`.
- If using a purely local Unix socket for development, document that it is a
  local-only exception and not the GitHub Pages hybrid demo path.

## Browser Demo Steps

1. Open the GitHub Pages app.
2. In **Hybrid demo bridge**, enter the HTTPS demo API URL.
3. Login with one of the local demo accounts.
4. The app stores only:
   - `nappDemoApiBaseUrl`,
   - `nappDemoToken`,
   - `nappDemoActorId`.
5. The page reloads and requests the workbench through the API bridge.
6. Use **Logout** to clear the bearer token and return to static training mode.

## Validation Commands

```bash
npm test
make test-python
npm run test:browser
PLAYWRIGHT_SERVER=api npm run test:browser
npm run test:pages
make test-all
```

Additional checks:

```bash
curl https://YOUR-DEMO-API/v1/demo/security
TOKEN="$(curl -s https://YOUR-DEMO-API/v1/demo/login \
  -H 'Origin: https://pillb.github.io' \
  -H 'Content-Type: application/json' \
  --data '{"username":"analyst@example.test","password":"demo-pass-1"}' \
  | python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])')"
curl https://YOUR-DEMO-API/v1/demo/postgres-probe \
  -H "Origin: https://pillb.github.io" \
  -H "Authorization: Bearer ${TOKEN}"
```

The security status should show:

- `browserToDatabase: "prohibited"`;
- `authRequired: true`;
- `postgresTls.passed: true`;
- no failures.

The live PostgreSQL probe should show:

- `transport.passed: true`;
- `details.tlsActive: true`;
- `details.roleSuperuser: false`;
- `details.roleBypassRls: false`;
- `details.rlsEnabledTableCount` equal to `details.nappTableCount`;
- `details.forcedRlsTableCount` equal to `details.nappTableCount`;
- `details.transactionLocalContextSet: true`.

## Current Limits

- Demo credentials are file-backed and intended only for local demonstration.
- The API bridge does not replace production OIDC/PKCE.
- The current workbench endpoint still returns the synthetic Harbor Lantern
  training projection. The repository already contains PostgreSQL
  import/reconstruction and RLS helpers; promoting the workbench endpoint to
  read operational cases from PostgreSQL remains a separate controlled slice.
- Real deployments need managed secrets, certificate rotation, monitoring,
  rate limits, audit retention, and incident-response controls.
