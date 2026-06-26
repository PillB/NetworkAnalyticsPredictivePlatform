-- Shared OIDC actor mapping, immutable case grants, and replay protection.

BEGIN;

CREATE TABLE napp.security_actors (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    issuer_digest bytea NOT NULL,
    subject_digest bytea NOT NULL,
    roles text[] NOT NULL DEFAULT '{}'::text[],
    active boolean NOT NULL DEFAULT true,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    deactivated_at timestamptz,
    UNIQUE (issuer_digest, subject_digest),
    CHECK (octet_length(issuer_digest) = 32),
    CHECK (octet_length(subject_digest) = 32),
    CHECK (
        (active AND deactivated_at IS NULL)
        OR (NOT active AND deactivated_at IS NOT NULL)
    )
);

COMMENT ON TABLE napp.security_actors IS
'Internal actor mapping keyed by SHA-256 issuer and subject digests. Raw issuer, subject, claims, and credentials are never persisted.';

CREATE TABLE napp.case_access_grants (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    actor_id uuid NOT NULL REFERENCES napp.security_actors(id) ON DELETE RESTRICT,
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    purposes text[] NOT NULL,
    expires_at timestamptz NOT NULL,
    policy_version text NOT NULL,
    allowed_handling_labels text[] NOT NULL DEFAULT '{}'::text[],
    allowed_fields text[] NOT NULL DEFAULT '{}'::text[],
    issued_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    issued_by_actor_id uuid REFERENCES napp.security_actors(id) ON DELETE RESTRICT,
    UNIQUE (case_id, id),
    CHECK (cardinality(purposes) > 0),
    CHECK (expires_at > issued_at),
    CHECK (policy_version <> '')
);

COMMENT ON TABLE napp.case_access_grants IS
'Immutable purpose-bound grant. Revocation is represented by a separate append-only record; grant rows are never overwritten.';

CREATE INDEX case_access_grants_lookup_idx
    ON napp.case_access_grants (actor_id, case_id, expires_at);

CREATE TABLE napp.case_access_grant_revocations (
    grant_id uuid PRIMARY KEY
        REFERENCES napp.case_access_grants(id) ON DELETE RESTRICT,
    revoked_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    revoked_by_actor_id uuid
        REFERENCES napp.security_actors(id) ON DELETE RESTRICT,
    reason_code text NOT NULL,
    CHECK (reason_code <> '')
);

COMMENT ON TABLE napp.case_access_grant_revocations IS
'Append-only revocation evidence. Revocation never deletes or mutates the original grant.';

CREATE TABLE napp.oidc_replay_consumptions (
    issuer_digest bytea NOT NULL,
    subject_digest bytea NOT NULL,
    token_digest bytea NOT NULL,
    nonce_digest bytea NOT NULL,
    expires_at timestamptz NOT NULL,
    consumed_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    PRIMARY KEY (issuer_digest, token_digest, nonce_digest),
    CHECK (octet_length(issuer_digest) = 32),
    CHECK (octet_length(subject_digest) = 32),
    CHECK (octet_length(token_digest) = 32),
    CHECK (octet_length(nonce_digest) = 32),
    CHECK (expires_at > consumed_at)
);

COMMENT ON TABLE napp.oidc_replay_consumptions IS
'Atomic replay fence containing only SHA-256 claim identifiers. Raw tokens, token IDs, nonces, and claim payloads are prohibited.';

CREATE INDEX oidc_replay_expiry_idx
    ON napp.oidc_replay_consumptions (expires_at);

CREATE FUNCTION napp.resolve_security_actor(
    target_issuer_digest bytea,
    target_subject_digest bytea
)
RETURNS TABLE (
    actor_id uuid,
    roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
    SELECT actor.id, actor.roles
      FROM napp.security_actors AS actor
     WHERE actor.issuer_digest = target_issuer_digest
       AND actor.subject_digest = target_subject_digest
       AND actor.active
       AND actor.deactivated_at IS NULL
$$;

CREATE FUNCTION napp.resolve_current_case_grant(
    target_actor_id uuid,
    target_case_id uuid,
    target_purpose text,
    target_policy_version text,
    evaluated_at timestamptz
)
RETURNS TABLE (
    grant_id uuid,
    expires_at timestamptz,
    policy_version text,
    allowed_handling_labels text[],
    allowed_fields text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
    SELECT
        grant_record.id,
        grant_record.expires_at,
        grant_record.policy_version,
        grant_record.allowed_handling_labels,
        grant_record.allowed_fields
      FROM napp.case_access_grants AS grant_record
     WHERE grant_record.actor_id = target_actor_id
       AND grant_record.case_id = target_case_id
       AND target_purpose = ANY (grant_record.purposes)
       AND grant_record.policy_version = target_policy_version
       AND grant_record.issued_at <= evaluated_at
       AND grant_record.expires_at > evaluated_at
       AND NOT EXISTS (
           SELECT 1
             FROM napp.case_access_grant_revocations AS revocation
            WHERE revocation.grant_id = grant_record.id
              AND revocation.revoked_at <= evaluated_at
       )
     ORDER BY grant_record.expires_at, grant_record.id
     LIMIT 1
$$;

CREATE FUNCTION napp.consume_oidc_replay(
    target_issuer_digest bytea,
    target_subject_digest bytea,
    target_token_digest bytea,
    target_nonce_digest bytea,
    target_expires_at timestamptz
)
RETURNS boolean
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
BEGIN
    IF octet_length(target_issuer_digest) <> 32
       OR octet_length(target_subject_digest) <> 32
       OR octet_length(target_token_digest) <> 32
       OR octet_length(target_nonce_digest) <> 32
       OR target_expires_at <= statement_timestamp()
    THEN
        RETURN false;
    END IF;

    INSERT INTO napp.oidc_replay_consumptions (
        issuer_digest,
        subject_digest,
        token_digest,
        nonce_digest,
        expires_at
    )
    VALUES (
        target_issuer_digest,
        target_subject_digest,
        target_token_digest,
        target_nonce_digest,
        target_expires_at
    )
    ON CONFLICT (issuer_digest, token_digest, nonce_digest) DO NOTHING;

    RETURN FOUND;
END;
$$;

CREATE FUNCTION napp.reject_security_record_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only', TG_TABLE_NAME;
END;
$$;

CREATE TRIGGER case_access_grants_append_only
BEFORE UPDATE OR DELETE ON napp.case_access_grants
FOR EACH ROW EXECUTE FUNCTION napp.reject_security_record_mutation();

CREATE TRIGGER case_access_grant_revocations_append_only
BEFORE UPDATE OR DELETE ON napp.case_access_grant_revocations
FOR EACH ROW EXECUTE FUNCTION napp.reject_security_record_mutation();

REVOKE ALL ON napp.security_actors FROM PUBLIC;
REVOKE ALL ON napp.case_access_grants FROM PUBLIC;
REVOKE ALL ON napp.case_access_grant_revocations FROM PUBLIC;
REVOKE ALL ON napp.oidc_replay_consumptions FROM PUBLIC;
REVOKE ALL ON FUNCTION napp.resolve_security_actor(bytea, bytea) FROM PUBLIC;
REVOKE ALL ON FUNCTION
    napp.resolve_current_case_grant(uuid, uuid, text, text, timestamptz)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION
    napp.consume_oidc_replay(bytea, bytea, bytea, bytea, timestamptz)
    FROM PUBLIC;
REVOKE ALL ON FUNCTION napp.reject_security_record_mutation() FROM PUBLIC;

COMMIT;
