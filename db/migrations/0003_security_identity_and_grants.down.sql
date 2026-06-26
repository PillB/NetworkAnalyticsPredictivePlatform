BEGIN;

DROP FUNCTION IF EXISTS
    napp.consume_oidc_replay(bytea, bytea, bytea, bytea, timestamptz);
DROP FUNCTION IF EXISTS
    napp.resolve_current_case_grant(uuid, uuid, text, text, timestamptz);
DROP FUNCTION IF EXISTS napp.resolve_security_actor(bytea, bytea);
DROP TRIGGER IF EXISTS case_access_grant_revocations_append_only
    ON napp.case_access_grant_revocations;
DROP TRIGGER IF EXISTS case_access_grants_append_only
    ON napp.case_access_grants;
DROP FUNCTION IF EXISTS napp.reject_security_record_mutation();
DROP TABLE IF EXISTS napp.oidc_replay_consumptions;
DROP TABLE IF EXISTS napp.case_access_grant_revocations;
DROP TABLE IF EXISTS napp.case_access_grants;
DROP TABLE IF EXISTS napp.security_actors;

COMMIT;
