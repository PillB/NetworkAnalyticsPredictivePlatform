-- Destructive rollback for db/migrations/0001_initial.sql.
-- Data export/retention approval is required before running in any shared
-- environment. Extensions are retained because they may be shared.

BEGIN;

DROP SCHEMA IF EXISTS napp CASCADE;

COMMIT;
