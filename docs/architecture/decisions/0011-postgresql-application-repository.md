# ADR 0011: PostgreSQL application repository and canonical fixture import

Status: Accepted

The application uses psycopg 3 and the schema established by migrations 0001
and 0002. External case, entity, source, assertion, and revision keys map to
UUIDv5 identifiers under one permanent application namespace. Imports can
therefore use `ON CONFLICT DO NOTHING` and remain idempotent without database
sequences or lookup-dependent identities.

Every repository operation acquires a pooled connection, opens a transaction,
and sets `app.actor_id`, `app.purpose_id`, and `app.authorized_case_ids` with
transaction-local `set_config(..., true)`. No session-global setting is used.
Purpose-bound sessions additionally set `app.authorization_session_id` and
`app.policy_version` in that transaction. External case keys map to their
deterministic database UUID before entering RLS context.
The transaction is completed before the connection returns to the pool, with a
defensive rollback if a connection is not idle.

Assertion revisions remain append-only. Their generated recorded ranges stay
open as required by migration 0001. Historical reads select rows recorded by
the requested `known_at` and exclude a row only when its direct successor was
also known by that cutoff. This yields the latest accepted correction as of the
cutoff and prevents future evidence from leaking into snapshots.

PostgreSQL stores observed events as closed, zero-width point ranges. The
fixture's display interval and complete UI record remain in revision JSON so
the API can reconstruct the existing domain contract exactly. Source metadata,
source restrictions, revision restrictions, provenance references, and the
correction predecessor are retained explicitly.

Migration 0001 fixes subject, predicate, and object on the assertion identity.
Harbor Lantern includes one correction that changes the claimed object while
retaining its assertion key. The importer keeps the original object on the
assertion row to satisfy that schema and stores each revision's exact object in
the immutable revision payload. Repository results use the revision-scoped
object.

The live PostgreSQL gate imports the complete canonical fixture twice and
compares serialized point and window snapshots with the in-memory reference.
This exact comparison is the adapter compatibility contract; matching only
revision identifiers is insufficient.
