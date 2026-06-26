-- Durable bounded jobs, atomic result publication, and correction staleness.

BEGIN;

CREATE TABLE napp.jobs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    job_kind text NOT NULL,
    idempotency_key text NOT NULL,
    input_digest bytea NOT NULL,
    parameters jsonb NOT NULL DEFAULT '{}'::jsonb,
    state text NOT NULL DEFAULT 'queued',
    max_attempts integer NOT NULL DEFAULT 3,
    attempt_count integer NOT NULL DEFAULT 0,
    available_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    deadline_at timestamptz,
    cancellation_requested_at timestamptz,
    terminal_reason text,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    updated_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, idempotency_key),
    UNIQUE (case_id, id),
    CHECK (job_kind <> ''),
    CHECK (idempotency_key <> ''),
    CHECK (octet_length(input_digest) = 32),
    CHECK (jsonb_typeof(parameters) = 'object'),
    CHECK (state IN (
        'queued', 'running', 'retry_wait', 'succeeded', 'failed', 'cancelled'
    )),
    CHECK (max_attempts > 0),
    CHECK (attempt_count >= 0 AND attempt_count <= max_attempts),
    CHECK (deadline_at IS NULL OR deadline_at > created_at),
    CHECK (
        (state IN ('succeeded', 'failed', 'cancelled'))
        OR terminal_reason IS NULL
    )
);

COMMENT ON TABLE napp.jobs IS
'Bounded durable work. A case-scoped idempotency key identifies one immutable input contract; retries consume the fixed max_attempts budget.';
COMMENT ON COLUMN napp.jobs.available_at IS
'Earliest claim time for queued or retry_wait work. Workers claim with row locking and SKIP LOCKED.';
COMMENT ON COLUMN napp.jobs.cancellation_requested_at IS
'Cooperative cancellation fence. A running worker must stop and may not publish after this becomes non-null.';

CREATE INDEX jobs_claim_idx
    ON napp.jobs (available_at, created_at, id)
    WHERE state IN ('queued', 'retry_wait');
CREATE INDEX jobs_case_state_idx ON napp.jobs (case_id, state, updated_at);

CREATE TABLE napp.job_attempts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    job_id uuid NOT NULL,
    attempt_number integer NOT NULL,
    worker_id text NOT NULL,
    lease_token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    heartbeat_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    leased_until timestamptz NOT NULL,
    finished_at timestamptz,
    outcome text,
    failure_detail jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (job_id, attempt_number),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, job_id)
        REFERENCES napp.jobs(case_id, id) ON DELETE RESTRICT,
    CHECK (attempt_number > 0),
    CHECK (worker_id <> ''),
    CHECK (leased_until > started_at),
    CHECK (heartbeat_at >= started_at),
    CHECK (finished_at IS NULL OR finished_at >= started_at),
    CHECK (outcome IS NULL OR outcome IN (
        'succeeded', 'retry_wait', 'failed', 'cancelled', 'lease_expired'
    )),
    CHECK (
        (finished_at IS NULL AND outcome IS NULL)
        OR (finished_at IS NOT NULL AND outcome IS NOT NULL)
    ),
    CHECK (jsonb_typeof(failure_detail) = 'object')
);

COMMENT ON TABLE napp.job_attempts IS
'One lease-fenced execution attempt. Only the holder of the unexpired opaque lease_token may heartbeat, stage, fail, cancel, or publish.';

CREATE UNIQUE INDEX job_attempts_one_active_idx
    ON napp.job_attempts (job_id)
    WHERE finished_at IS NULL;
CREATE INDEX job_attempts_expired_lease_idx
    ON napp.job_attempts (leased_until)
    WHERE finished_at IS NULL;

CREATE TABLE napp.job_staged_outputs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    job_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    output_name text NOT NULL,
    object_uri text NOT NULL,
    content_digest bytea NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    staged_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (attempt_id, output_name),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, job_id)
        REFERENCES napp.jobs(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, attempt_id)
        REFERENCES napp.job_attempts(case_id, id) ON DELETE RESTRICT,
    CHECK (output_name <> ''),
    CHECK (object_uri <> ''),
    CHECK (octet_length(content_digest) = 32),
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE napp.job_staged_outputs IS
'Attempt-local immutable output manifests. Staging never makes an object visible as the current valid result.';

CREATE TABLE napp.job_publications (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    result_key text NOT NULL,
    generation integer NOT NULL,
    job_id uuid NOT NULL,
    attempt_id uuid NOT NULL,
    completion_key text NOT NULL,
    published_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    stale_at timestamptz,
    stale_reason text,
    supersedes_publication_id uuid,
    UNIQUE (case_id, id),
    UNIQUE (case_id, result_key, generation),
    UNIQUE (job_id, completion_key),
    FOREIGN KEY (case_id, job_id)
        REFERENCES napp.jobs(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, attempt_id)
        REFERENCES napp.job_attempts(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, supersedes_publication_id)
        REFERENCES napp.job_publications(case_id, id) ON DELETE RESTRICT,
    CHECK (result_key <> ''),
    CHECK (generation > 0),
    CHECK (completion_key <> ''),
    CHECK (
        (stale_at IS NULL AND stale_reason IS NULL)
        OR (stale_at IS NOT NULL AND stale_reason IS NOT NULL)
    )
);

COMMENT ON TABLE napp.job_publications IS
'Committed immutable result generations. Staleness is advisory lineage state; the publication and its object manifest remain available as the last valid result.';

CREATE TABLE napp.job_publication_outputs (
    case_id uuid NOT NULL,
    publication_id uuid NOT NULL,
    staged_output_id uuid NOT NULL,
    output_ordinal integer NOT NULL,
    PRIMARY KEY (publication_id, staged_output_id),
    UNIQUE (publication_id, output_ordinal),
    FOREIGN KEY (case_id, publication_id)
        REFERENCES napp.job_publications(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, staged_output_id)
        REFERENCES napp.job_staged_outputs(case_id, id) ON DELETE RESTRICT,
    CHECK (output_ordinal > 0)
);

CREATE TABLE napp.job_result_heads (
    case_id uuid NOT NULL,
    result_key text NOT NULL,
    publication_id uuid NOT NULL,
    advanced_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    PRIMARY KEY (case_id, result_key),
    FOREIGN KEY (case_id, publication_id)
        REFERENCES napp.job_publications(case_id, id) ON DELETE RESTRICT,
    CHECK (result_key <> '')
);

COMMENT ON TABLE napp.job_result_heads IS
'Single mutable pointer per logical result. Only successful publication advances it; failed and cancelled attempts leave the prior publication untouched.';

CREATE TABLE napp.job_dependencies (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    publication_id uuid NOT NULL,
    dependency_kind text NOT NULL,
    dependency_id uuid NOT NULL,
    dependency_version text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (
        publication_id, dependency_kind, dependency_id, dependency_version
    ),
    FOREIGN KEY (case_id, publication_id)
        REFERENCES napp.job_publications(case_id, id) ON DELETE RESTRICT,
    CHECK (dependency_kind IN (
        'assertion_revision', 'projection', 'analysis_version',
        'community_run', 'lineage_event', 'report_version', 'publication'
    )),
    CHECK (dependency_version <> '')
);

COMMENT ON TABLE napp.job_dependencies IS
'Exact versioned inputs for a publication. Publication dependencies permit transitive stale propagation without replacing the retained result.';

CREATE INDEX job_dependencies_reverse_idx
    ON napp.job_dependencies (
        case_id, dependency_kind, dependency_id, dependency_version
    );

CREATE TABLE napp.correction_impacts (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    correction_id uuid NOT NULL,
    dependency_kind text NOT NULL,
    dependency_id uuid NOT NULL,
    dependency_version text NOT NULL,
    publication_id uuid NOT NULL,
    propagation_depth integer NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, correction_id, publication_id),
    FOREIGN KEY (case_id, publication_id)
        REFERENCES napp.job_publications(case_id, id) ON DELETE RESTRICT,
    CHECK (dependency_kind IN (
        'assertion_revision', 'projection', 'analysis_version',
        'community_run', 'lineage_event', 'report_version', 'publication'
    )),
    CHECK (dependency_version <> ''),
    CHECK (propagation_depth >= 0)
);

COMMENT ON TABLE napp.correction_impacts IS
'Idempotent direct and transitive impact ledger connecting one correction to every publication marked stale.';

CREATE TABLE napp.audit_outbox (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    aggregate_type text NOT NULL,
    aggregate_id uuid NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    occurred_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    dispatched_at timestamptz,
    dispatch_attempts integer NOT NULL DEFAULT 0,
    UNIQUE (case_id, id),
    CHECK (aggregate_type <> ''),
    CHECK (event_type <> ''),
    CHECK (jsonb_typeof(payload) = 'object'),
    CHECK (dispatched_at IS NULL OR dispatched_at >= occurred_at),
    CHECK (dispatch_attempts >= 0)
);

COMMENT ON TABLE napp.audit_outbox IS
'Transactional audit intents. A dispatcher appends these to the hash-chained audit_events ledger and marks delivery idempotently.';

CREATE INDEX audit_outbox_dispatch_idx
    ON napp.audit_outbox (occurred_at, id)
    WHERE dispatched_at IS NULL;

CREATE TABLE napp.audit_checkpoint_requests (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    through_outbox_event_id uuid NOT NULL,
    requested_by_actor_id uuid NOT NULL,
    requested_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    fulfilled_checkpoint_id bigint REFERENCES napp.audit_checkpoints(id)
        ON DELETE RESTRICT,
    fulfilled_at timestamptz,
    UNIQUE (case_id, through_outbox_event_id),
    FOREIGN KEY (case_id, through_outbox_event_id)
        REFERENCES napp.audit_outbox(case_id, id) ON DELETE RESTRICT,
    CHECK (
        (fulfilled_checkpoint_id IS NULL AND fulfilled_at IS NULL)
        OR (fulfilled_checkpoint_id IS NOT NULL AND fulfilled_at IS NOT NULL)
    ),
    CHECK (fulfilled_at IS NULL OR fulfilled_at >= requested_at)
);

COMMENT ON TABLE napp.audit_checkpoint_requests IS
'Idempotent request to anchor the audit chain after all audit outbox events through a chosen event have been appended.';

CREATE FUNCTION napp.reap_expired_job_leases(target_case_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
DECLARE
    reaped_count integer;
BEGIN
    IF NOT napp.case_is_authorized(target_case_id) THEN
        RAISE EXCEPTION 'case authorization required';
    END IF;

    WITH expired AS (
        UPDATE napp.job_attempts AS attempt
           SET finished_at = statement_timestamp(),
               outcome = 'lease_expired',
               failure_detail = jsonb_build_object('reason', 'lease_expired')
          FROM napp.jobs AS job
         WHERE attempt.job_id = job.id
           AND attempt.finished_at IS NULL
           AND attempt.leased_until <= statement_timestamp()
           AND job.state = 'running'
           AND job.case_id = target_case_id
        RETURNING
            attempt.job_id,
            job.case_id,
            job.cancellation_requested_at,
            job.attempt_count,
            job.max_attempts,
            job.deadline_at
    ),
    transitioned AS (
        UPDATE napp.jobs AS job
           SET state = CASE
                   WHEN expired.cancellation_requested_at IS NOT NULL
                       THEN 'cancelled'
                   WHEN expired.attempt_count >= expired.max_attempts
                       OR (
                           expired.deadline_at IS NOT NULL
                           AND expired.deadline_at <= statement_timestamp()
                       )
                       THEN 'failed'
                   ELSE 'retry_wait'
               END,
               available_at = statement_timestamp(),
               terminal_reason = CASE
                   WHEN expired.cancellation_requested_at IS NOT NULL
                       THEN 'cancelled after worker lease expired'
                   WHEN expired.attempt_count >= expired.max_attempts
                       OR (
                           expired.deadline_at IS NOT NULL
                           AND expired.deadline_at <= statement_timestamp()
                       )
                       THEN 'worker lease expired and retry bound was exhausted'
                   ELSE NULL
               END,
               updated_at = statement_timestamp()
          FROM expired
         WHERE job.id = expired.job_id
        RETURNING job.id, job.case_id, job.state
    ),
    emitted AS (
        INSERT INTO napp.audit_outbox (
            case_id, aggregate_type, aggregate_id, event_type, payload
        )
        SELECT
            case_id, 'job', id, 'job.' || state,
            jsonb_build_object('reason', 'lease_expired')
          FROM transitioned
        RETURNING id
    )
    SELECT count(*) INTO reaped_count FROM emitted;

    RETURN reaped_count;
END
$$;

CREATE FUNCTION napp.claim_job(
    target_case_id uuid,
    target_worker_id text,
    target_lease interval,
    accepted_kinds text[] DEFAULT NULL
)
RETURNS TABLE (
    job_id uuid,
    attempt_id uuid,
    lease_token uuid,
    attempt_number integer,
    leased_until timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
DECLARE
    claimed napp.jobs%ROWTYPE;
    created_attempt napp.job_attempts%ROWTYPE;
BEGIN
    IF target_worker_id = '' OR target_lease <= interval '0 seconds' THEN
        RAISE EXCEPTION 'worker_id and a positive lease are required';
    END IF;

    IF NOT napp.case_is_authorized(target_case_id) THEN
        RAISE EXCEPTION 'case authorization required';
    END IF;

    PERFORM napp.reap_expired_job_leases(target_case_id);

    SELECT *
      INTO claimed
     FROM napp.jobs
     WHERE state IN ('queued', 'retry_wait')
       AND case_id = target_case_id
       AND available_at <= statement_timestamp()
       AND attempt_count < max_attempts
       AND (deadline_at IS NULL OR deadline_at > statement_timestamp())
       AND (accepted_kinds IS NULL OR job_kind = ANY (accepted_kinds))
     ORDER BY available_at, created_at, id
     FOR UPDATE SKIP LOCKED
     LIMIT 1;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    UPDATE napp.jobs
       SET state = 'running',
           attempt_count = attempt_count + 1,
           updated_at = statement_timestamp()
     WHERE id = claimed.id;

    INSERT INTO napp.job_attempts (
        case_id, job_id, attempt_number, worker_id, leased_until
    )
    VALUES (
        claimed.case_id, claimed.id, claimed.attempt_count + 1,
        target_worker_id, statement_timestamp() + target_lease
    )
    RETURNING * INTO created_attempt;

    INSERT INTO napp.audit_outbox (
        case_id, aggregate_type, aggregate_id, event_type, payload
    )
    VALUES (
        claimed.case_id, 'job', claimed.id, 'job.claimed',
        jsonb_build_object(
            'attempt_id', created_attempt.id,
            'attempt_number', created_attempt.attempt_number,
            'worker_id', target_worker_id
        )
    );

    RETURN QUERY SELECT
        claimed.id,
        created_attempt.id,
        created_attempt.lease_token,
        created_attempt.attempt_number,
        created_attempt.leased_until;
END
$$;

COMMENT ON FUNCTION napp.claim_job(uuid, text, interval, text[]) IS
'Atomically claims at most one eligible job using FOR UPDATE SKIP LOCKED and creates an opaque lease-fenced attempt.';

CREATE FUNCTION napp.heartbeat_job(
    target_job_id uuid,
    target_lease_token uuid,
    target_lease interval
)
RETURNS timestamptz
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
DECLARE
    renewed_until timestamptz;
BEGIN
    IF target_lease <= interval '0 seconds' THEN
        RAISE EXCEPTION 'lease must be positive';
    END IF;

    UPDATE napp.job_attempts AS attempt
       SET heartbeat_at = statement_timestamp(),
           leased_until = statement_timestamp() + target_lease
      FROM napp.jobs AS job
     WHERE attempt.job_id = target_job_id
       AND attempt.lease_token = target_lease_token
       AND attempt.finished_at IS NULL
       AND attempt.leased_until > statement_timestamp()
       AND job.id = attempt.job_id
       AND napp.case_is_authorized(job.case_id)
       AND job.state = 'running'
    RETURNING attempt.leased_until INTO renewed_until;

    IF renewed_until IS NULL THEN
        RAISE EXCEPTION 'active lease not found';
    END IF;
    RETURN renewed_until;
END
$$;

CREATE FUNCTION napp.publish_job(
    target_job_id uuid,
    target_lease_token uuid,
    target_result_key text,
    target_completion_key text,
    target_dependencies jsonb DEFAULT '[]'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
DECLARE
    target_job napp.jobs%ROWTYPE;
    target_attempt napp.job_attempts%ROWTYPE;
    prior_publication_id uuid;
    next_generation integer;
    new_publication_id uuid;
BEGIN
    IF jsonb_typeof(target_dependencies) <> 'array' THEN
        RAISE EXCEPTION 'dependencies must be a JSON array';
    END IF;

    SELECT *
      INTO target_job
     FROM napp.jobs AS job
     WHERE job.id = target_job_id
       AND napp.case_is_authorized(job.case_id)
       AND job.state = 'running'
       AND job.cancellation_requested_at IS NULL
     FOR UPDATE;

    IF NOT FOUND THEN
        SELECT id INTO new_publication_id
          FROM napp.job_publications
         WHERE job_id = target_job_id
           AND completion_key = target_completion_key;
        IF new_publication_id IS NOT NULL THEN
            RETURN new_publication_id;
        END IF;
        RAISE EXCEPTION 'active publication lease not found';
    END IF;

    SELECT *
      INTO target_attempt
      FROM napp.job_attempts
     WHERE job_id = target_job_id
       AND lease_token = target_lease_token
       AND finished_at IS NULL
       AND leased_until > statement_timestamp()
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'active publication lease not found';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM napp.job_staged_outputs
         WHERE attempt_id = target_attempt.id
    ) THEN
        RAISE EXCEPTION 'successful publication requires staged output';
    END IF;

    PERFORM pg_advisory_xact_lock(
        hashtextextended(
            target_job.case_id::text || ':' || target_result_key,
            0
        )
    );

    SELECT publication_id
      INTO prior_publication_id
      FROM napp.job_result_heads
     WHERE case_id = target_job.case_id
       AND result_key = target_result_key
     FOR UPDATE;

    SELECT COALESCE(MAX(generation), 0) + 1
      INTO next_generation
      FROM napp.job_publications
     WHERE case_id = target_job.case_id
       AND result_key = target_result_key;

    INSERT INTO napp.job_publications (
        case_id, result_key, generation, job_id, attempt_id,
        completion_key, supersedes_publication_id
    )
    VALUES (
        target_job.case_id, target_result_key, next_generation, target_job.id,
        target_attempt.id, target_completion_key, prior_publication_id
    )
    RETURNING id INTO new_publication_id;

    INSERT INTO napp.job_dependencies (
        case_id, publication_id, dependency_kind,
        dependency_id, dependency_version
    )
    SELECT
        target_job.case_id,
        new_publication_id,
        dependency.dependency_kind,
        dependency.dependency_id,
        dependency.dependency_version
      FROM jsonb_to_recordset(target_dependencies) AS dependency(
          dependency_kind text,
          dependency_id uuid,
          dependency_version text
      );

    INSERT INTO napp.job_publication_outputs (
        case_id, publication_id, staged_output_id, output_ordinal
    )
    SELECT
        target_job.case_id, new_publication_id, staged.id,
        row_number() OVER (ORDER BY staged.output_name, staged.id)::integer
      FROM napp.job_staged_outputs AS staged
     WHERE staged.attempt_id = target_attempt.id;

    INSERT INTO napp.job_result_heads (
        case_id, result_key, publication_id, advanced_at
    )
    VALUES (
        target_job.case_id, target_result_key, new_publication_id,
        statement_timestamp()
    )
    ON CONFLICT (case_id, result_key) DO UPDATE
        SET publication_id = EXCLUDED.publication_id,
            advanced_at = EXCLUDED.advanced_at;

    UPDATE napp.job_attempts
       SET finished_at = statement_timestamp(), outcome = 'succeeded'
     WHERE id = target_attempt.id;
    UPDATE napp.jobs
       SET state = 'succeeded', updated_at = statement_timestamp()
     WHERE id = target_job.id;

    INSERT INTO napp.audit_outbox (
        case_id, aggregate_type, aggregate_id, event_type, payload
    )
    VALUES (
        target_job.case_id, 'publication', new_publication_id,
        'publication.committed',
        jsonb_build_object(
            'job_id', target_job.id,
            'result_key', target_result_key,
            'generation', next_generation
        )
    );

    RETURN new_publication_id;
END
$$;

COMMENT ON FUNCTION napp.publish_job(uuid, uuid, text, text, jsonb) IS
'In one transaction validates the live lease and cancellation fence, commits staged outputs, advances the result head, succeeds the attempt/job, and emits audit intent.';

CREATE FUNCTION napp.record_correction_impact(
    target_case_id uuid,
    target_correction_id uuid,
    target_dependency_kind text,
    target_dependency_id uuid,
    target_dependency_version text
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
DECLARE
    impacted_count integer;
BEGIN
    IF NOT napp.case_is_authorized(target_case_id) THEN
        RAISE EXCEPTION 'case authorization required';
    END IF;

    WITH RECURSIVE impacted AS (
        SELECT
            dependency.publication_id,
            0 AS propagation_depth,
            dependency.dependency_kind,
            dependency.dependency_id,
            dependency.dependency_version,
            ARRAY[dependency.publication_id]::uuid[] AS path
          FROM napp.job_dependencies AS dependency
         WHERE dependency.case_id = target_case_id
           AND dependency.dependency_kind = target_dependency_kind
           AND dependency.dependency_id = target_dependency_id
           AND dependency.dependency_version = target_dependency_version

        UNION ALL

        SELECT
            dependency.publication_id,
            parent.propagation_depth + 1,
            dependency.dependency_kind,
            dependency.dependency_id,
            dependency.dependency_version,
            parent.path || dependency.publication_id
          FROM impacted AS parent
          JOIN napp.job_publications AS parent_publication
            ON parent_publication.id = parent.publication_id
          JOIN napp.job_dependencies AS dependency
            ON dependency.case_id = target_case_id
           AND dependency.dependency_kind = 'publication'
           AND dependency.dependency_id = parent.publication_id
           AND dependency.dependency_version =
               parent_publication.generation::text
         WHERE NOT dependency.publication_id = ANY (parent.path)
    ),
    deduplicated AS (
        SELECT DISTINCT ON (publication_id)
            publication_id,
            propagation_depth,
            dependency_kind,
            dependency_id,
            dependency_version
          FROM impacted
         ORDER BY publication_id, propagation_depth
    ),
    inserted AS (
        INSERT INTO napp.correction_impacts (
            case_id, correction_id, dependency_kind, dependency_id,
            dependency_version, publication_id, propagation_depth
        )
        SELECT
            target_case_id, target_correction_id, dependency_kind,
            dependency_id, dependency_version, publication_id,
            propagation_depth
          FROM deduplicated
        ON CONFLICT (case_id, correction_id, publication_id) DO NOTHING
        RETURNING publication_id
    ),
    marked AS (
        UPDATE napp.job_publications AS publication
           SET stale_at = COALESCE(publication.stale_at, statement_timestamp()),
               stale_reason = COALESCE(
                   publication.stale_reason,
                   'correction:' || target_correction_id::text
               )
         WHERE publication.id IN (SELECT publication_id FROM inserted)
        RETURNING publication.id
    )
    SELECT count(*) INTO impacted_count FROM marked;

    INSERT INTO napp.audit_outbox (
        case_id, aggregate_type, aggregate_id, event_type, payload
    )
    SELECT
        target_case_id, 'correction', target_correction_id,
        'correction.impact_recorded',
        jsonb_build_object(
            'dependency_kind', target_dependency_kind,
            'dependency_id', target_dependency_id,
            'dependency_version', target_dependency_version,
            'newly_impacted_count', impacted_count
        )
    WHERE impacted_count > 0;

    RETURN impacted_count;
END
$$;

COMMENT ON FUNCTION napp.record_correction_impact(uuid, uuid, text, uuid, text) IS
'Idempotently records direct and transitive publication impacts and marks each newly impacted retained publication stale.';

CREATE FUNCTION napp.reject_published_output_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF EXISTS (
        SELECT 1
          FROM napp.job_publication_outputs
         WHERE staged_output_id = OLD.id
    ) THEN
        RAISE EXCEPTION 'published staged output is immutable';
    END IF;
    RETURN OLD;
END
$$;

CREATE TRIGGER job_staged_outputs_published_immutable
BEFORE UPDATE OR DELETE ON napp.job_staged_outputs
FOR EACH ROW EXECUTE FUNCTION napp.reject_published_output_mutation();

DO $$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'jobs', 'job_attempts', 'job_staged_outputs', 'job_publications',
        'job_publication_outputs', 'job_result_heads', 'job_dependencies',
        'correction_impacts', 'audit_outbox', 'audit_checkpoint_requests'
    ]
    LOOP
        EXECUTE format('ALTER TABLE napp.%I ENABLE ROW LEVEL SECURITY', table_name);
        EXECUTE format('ALTER TABLE napp.%I FORCE ROW LEVEL SECURITY', table_name);
        EXECUTE format(
            'CREATE POLICY %I ON napp.%I USING (napp.case_is_authorized(case_id)) WITH CHECK (napp.case_is_authorized(case_id))',
            table_name || '_case_scope',
            table_name
        );
    END LOOP;
END
$$;

REVOKE ALL ON napp.jobs, napp.job_attempts, napp.job_staged_outputs,
    napp.job_publications, napp.job_publication_outputs, napp.job_result_heads,
    napp.job_dependencies, napp.correction_impacts, napp.audit_outbox,
    napp.audit_checkpoint_requests FROM PUBLIC;
REVOKE ALL ON FUNCTION napp.claim_job(uuid, text, interval, text[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION napp.reap_expired_job_leases(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION napp.heartbeat_job(uuid, uuid, interval) FROM PUBLIC;
REVOKE ALL ON FUNCTION napp.publish_job(uuid, uuid, text, text, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION napp.record_correction_impact(
    uuid, uuid, text, uuid, text
) FROM PUBLIC;

COMMIT;
