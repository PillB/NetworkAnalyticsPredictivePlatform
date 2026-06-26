# Database migrations

`migrations/0001_initial.sql` creates the PostgreSQL 18 canonical schema in the
`napp` schema. `0001_initial.down.sql` is the destructive rollback.
`0002_jobs_and_staleness.sql` adds case-scoped durable jobs, lease-fenced
attempts, staged outputs, atomic publications, correction impact, stale-result
retention, audit outbox, and checkpoint requests. Roll back in reverse order.

Apply migrations with a dedicated owner/migration role. Runtime roles should
not own tables and should not have `BYPASSRLS`. Every runtime transaction that
touches case data must set:

```sql
SET LOCAL app.actor_id = '<uuid>';
SET LOCAL app.purpose_id = '<uuid>';
SET LOCAL app.authorized_case_ids = '{<uuid>,...}';
```

The application policy service must still enforce source-, field-,
sensitivity-, dissemination-, and current-session rules. Database RLS is a
fail-closed case/purpose backstop, not a complete policy engine.

The audit trigger is an owner-executed function so runtime roles can insert
events without receiving direct write access to `audit_chain_heads`. Do not
transfer ownership of that function to an application role.

The initial migration requires PostgreSQL extensions `btree_gist` and
`pgcrypto`. The rollback intentionally leaves installed extensions in place.

Run the isolated live integration:

```bash
make test-postgres-live
```

It creates a temporary PostgreSQL 18 cluster under `/tmp`, applies both
migrations, checks correction concurrency, RLS, atomic publication, staleness,
audit chaining, and both rollbacks, then removes the cluster.
