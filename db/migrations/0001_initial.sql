-- Network Analytics Predictive Platform
-- PostgreSQL 18 initial canonical schema.
--
-- Application transactions must set these LOCAL settings before touching
-- case-scoped data:
--   SET LOCAL app.actor_id = '<uuid>';
--   SET LOCAL app.purpose_id = '<uuid>';
--   SET LOCAL app.authorized_case_ids = '{<uuid>,...}';
-- The application remains responsible for source-, field-, and policy-level
-- authorization. RLS is a mandatory case/purpose fail-closed backstop.

BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE SCHEMA IF NOT EXISTS napp;
REVOKE ALL ON SCHEMA napp FROM PUBLIC;

CREATE FUNCTION napp.current_actor_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT nullif(current_setting('app.actor_id', true), '')::uuid
$$;

CREATE FUNCTION napp.current_purpose_id()
RETURNS uuid
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT nullif(current_setting('app.purpose_id', true), '')::uuid
$$;

CREATE FUNCTION napp.authorized_case_ids()
RETURNS uuid[]
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT COALESCE(
        nullif(current_setting('app.authorized_case_ids', true), '')::uuid[],
        ARRAY[]::uuid[]
    )
$$;

CREATE FUNCTION napp.case_is_authorized(target_case_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
PARALLEL SAFE
AS $$
    SELECT napp.current_actor_id() IS NOT NULL
       AND napp.current_purpose_id() IS NOT NULL
       AND target_case_id = ANY (napp.authorized_case_ids())
$$;

COMMENT ON FUNCTION napp.case_is_authorized(uuid) IS
'Fail-closed RLS backstop. The policy service must populate transaction-local actor, purpose, and authorized case settings.';

CREATE TABLE napp.cases (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_key text NOT NULL UNIQUE,
    name text NOT NULL,
    jurisdiction text NOT NULL,
    permissible_purpose text NOT NULL,
    owner_actor_id uuid NOT NULL,
    handling_policy jsonb NOT NULL DEFAULT '{}'::jsonb,
    valid_scope tstzrange NOT NULL,
    opened_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    closed_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    CHECK (case_key <> ''),
    CHECK (name <> ''),
    CHECK (jurisdiction <> ''),
    CHECK (permissible_purpose <> ''),
    CHECK (NOT isempty(valid_scope)),
    CHECK (closed_at IS NULL OR closed_at >= opened_at),
    CHECK (jsonb_typeof(handling_policy) = 'object')
);

COMMENT ON TABLE napp.cases IS
'Purpose-bound investigative case metadata. RLS denies even metadata unless the active transaction is authorized for the case.';
COMMENT ON COLUMN napp.cases.valid_scope IS
'Authorized event/valid-time scope for the case; this is not the assertion validity period.';
COMMENT ON COLUMN napp.cases.handling_policy IS
'Versioned policy references, dissemination markings, retention controls, and jurisdiction-specific handling metadata.';

CREATE TABLE napp.case_purpose_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    actor_id uuid NOT NULL,
    purpose_id uuid NOT NULL,
    purpose_text text NOT NULL,
    policy_digest bytea NOT NULL,
    authorized_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    expires_at timestamptz NOT NULL,
    revoked_at timestamptz,
    CHECK (purpose_text <> ''),
    CHECK (octet_length(policy_digest) = 32),
    CHECK (expires_at > authorized_at),
    CHECK (revoked_at IS NULL OR revoked_at >= authorized_at),
    UNIQUE (id, case_id)
);

COMMENT ON TABLE napp.case_purpose_sessions IS
'Auditable application authorization decision. RLS settings must come from a currently valid session; the database does not validate the external policy decision.';

CREATE INDEX case_purpose_sessions_active_lookup_idx
    ON napp.case_purpose_sessions (actor_id, case_id, purpose_id, expires_at)
    WHERE revoked_at IS NULL;

CREATE TABLE napp.entities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    entity_key text NOT NULL,
    entity_type text NOT NULL,
    display_label text NOT NULL,
    attributes jsonb NOT NULL DEFAULT '{}'::jsonb,
    sensitivity text NOT NULL DEFAULT 'standard',
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, entity_key),
    UNIQUE (case_id, id),
    CHECK (entity_key <> ''),
    CHECK (entity_type <> ''),
    CHECK (display_label <> ''),
    CHECK (sensitivity IN ('standard', 'sensitive', 'restricted')),
    CHECK (jsonb_typeof(attributes) = 'object')
);

COMMENT ON TABLE napp.entities IS
'Case-local graph entities. Identity resolution remains explicit and reversible; this table does not imply that similarly labeled records are the same real-world entity.';

CREATE INDEX entities_case_type_idx ON napp.entities (case_id, entity_type);
CREATE INDEX entities_attributes_gin_idx ON napp.entities USING gin (attributes);

CREATE TABLE napp.sources (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    source_key text NOT NULL,
    source_type text NOT NULL,
    title text NOT NULL,
    object_uri text,
    content_digest bytea,
    collected_at timestamptz,
    received_at timestamptz NOT NULL,
    restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, source_key),
    UNIQUE (case_id, id),
    CHECK (source_key <> ''),
    CHECK (source_type <> ''),
    CHECK (title <> ''),
    CHECK (content_digest IS NULL OR octet_length(content_digest) = 32),
    CHECK (collected_at IS NULL OR received_at >= collected_at),
    CHECK (jsonb_typeof(restrictions) = 'object'),
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE napp.sources IS
'Source-level provenance and immutable-object reference. Raw source content belongs in versioned object storage, not generic telemetry or audit payloads.';

CREATE INDEX sources_case_received_idx ON napp.sources (case_id, received_at);
CREATE INDEX sources_restrictions_gin_idx ON napp.sources USING gin (restrictions);

CREATE TABLE napp.assertions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    assertion_key text NOT NULL,
    subject_entity_id uuid NOT NULL,
    predicate text NOT NULL,
    object_entity_id uuid,
    object_value jsonb,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, assertion_key),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, subject_entity_id)
        REFERENCES napp.entities(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, object_entity_id)
        REFERENCES napp.entities(case_id, id) ON DELETE RESTRICT,
    CHECK (assertion_key <> ''),
    CHECK (predicate <> ''),
    CHECK ((object_entity_id IS NOT NULL) <> (object_value IS NOT NULL))
);

COMMENT ON TABLE napp.assertions IS
'Stable subject-predicate-object identity. Evidence changes are appended to assertion_revisions rather than overwriting this identity.';
COMMENT ON COLUMN napp.assertions.object_value IS
'Typed JSON scalar/object for literal assertions; exactly one of object_entity_id and object_value is required.';

CREATE INDEX assertions_subject_idx
    ON napp.assertions (case_id, subject_entity_id, predicate);
CREATE INDEX assertions_object_entity_idx
    ON napp.assertions (case_id, object_entity_id, predicate)
    WHERE object_entity_id IS NOT NULL;

CREATE TABLE napp.assertion_revisions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    assertion_id uuid NOT NULL,
    revision_number integer NOT NULL,
    source_id uuid NOT NULL,
    supersedes_revision_id uuid,
    assertion_class text NOT NULL,
    evidence_status text NOT NULL,
    confidence numeric(5,4),
    validity_kind text NOT NULL DEFAULT 'interval',
    valid_period tstzrange NOT NULL,
    recorded_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    recorded_period tstzrange GENERATED ALWAYS AS
        (tstzrange(recorded_at, NULL, '[)')) STORED,
    restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
    payload jsonb NOT NULL DEFAULT '{}'::jsonb,
    rationale text,
    created_by_actor_id uuid NOT NULL,
    UNIQUE (case_id, id),
    UNIQUE (assertion_id, revision_number),
    UNIQUE (supersedes_revision_id),
    FOREIGN KEY (case_id, assertion_id)
        REFERENCES napp.assertions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, source_id)
        REFERENCES napp.sources(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, supersedes_revision_id)
        REFERENCES napp.assertion_revisions(case_id, id)
        DEFERRABLE INITIALLY IMMEDIATE,
    CHECK (revision_number > 0),
    CHECK (supersedes_revision_id IS NULL OR supersedes_revision_id <> id),
    CHECK (assertion_class IN (
        'source_report', 'allegation', 'analyst_judgment',
        'observed_event', 'persistent_state',
        'deterministic_result', 'model_output',
        'evidentiary_finding', 'judicial_finding'
    )),
    CHECK (evidence_status IN (
        'asserted', 'corroborated', 'contradicted', 'withdrawn', 'unknown'
    )),
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CHECK (validity_kind IN ('interval', 'point')),
    CHECK (
        (validity_kind = 'interval' AND NOT isempty(valid_period))
        OR
        (validity_kind = 'point'
         AND lower(valid_period) = upper(valid_period)
         AND lower_inc(valid_period)
         AND upper_inc(valid_period))
    ),
    CHECK (lower(recorded_period) = recorded_at),
    CHECK (upper_inf(recorded_period)),
    CHECK (jsonb_typeof(restrictions) = 'object'),
    CHECK (jsonb_typeof(payload) = 'object')
);

COMMENT ON TABLE napp.assertion_revisions IS
'Append-only evidence revisions. recorded_period means known-from, not an exclusive system-time slice; the latest lineage revision at a known-at cutoff is authoritative.';
COMMENT ON COLUMN napp.assertion_revisions.valid_period IS
'Real-world/event validity. Point events use a closed zero-width range and validity_kind=point so they never become persistent intervals.';
COMMENT ON COLUMN napp.assertion_revisions.recorded_period IS
'Generated [recorded_at,infinity) knowledge-availability range. It remains open to preserve row immutability.';
COMMENT ON COLUMN napp.assertion_revisions.supersedes_revision_id IS
'Direct correction predecessor. UNIQUE permits at most one accepted successor per revision; alternatives require separate assertions.';

CREATE INDEX assertion_revisions_bitemporal_gist_idx
    ON napp.assertion_revisions
    USING gist (case_id, assertion_id, valid_period, recorded_period);
CREATE INDEX assertion_revisions_known_at_idx
    ON napp.assertion_revisions (case_id, assertion_id, recorded_at DESC);
CREATE INDEX assertion_revisions_source_idx
    ON napp.assertion_revisions (case_id, source_id);
CREATE INDEX assertion_revisions_restrictions_gin_idx
    ON napp.assertion_revisions USING gin (restrictions);

CREATE FUNCTION napp.enforce_assertion_revision_insert()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    predecessor napp.assertion_revisions%ROWTYPE;
BEGIN
    IF NEW.supersedes_revision_id IS NULL THEN
        IF NEW.revision_number <> 1 THEN
            RAISE EXCEPTION 'first assertion revision must have revision_number 1';
        END IF;
    ELSE
        SELECT *
          INTO predecessor
          FROM napp.assertion_revisions
         WHERE id = NEW.supersedes_revision_id
         FOR KEY SHARE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'superseded assertion revision does not exist';
        END IF;
        IF predecessor.case_id <> NEW.case_id
           OR predecessor.assertion_id <> NEW.assertion_id THEN
            RAISE EXCEPTION 'correction predecessor must belong to the same case and assertion';
        END IF;
        IF NEW.revision_number <> predecessor.revision_number + 1 THEN
            RAISE EXCEPTION 'correction revision_number must immediately follow predecessor';
        END IF;
        IF NEW.recorded_at < predecessor.recorded_at THEN
            RAISE EXCEPTION 'correction cannot be recorded before its predecessor';
        END IF;
    END IF;
    RETURN NEW;
END
$$;

CREATE TRIGGER assertion_revisions_validate_insert
BEFORE INSERT ON napp.assertion_revisions
FOR EACH ROW EXECUTE FUNCTION napp.enforce_assertion_revision_insert();

CREATE FUNCTION napp.reject_row_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION '% is append-only: % is not permitted',
        TG_TABLE_SCHEMA || '.' || TG_TABLE_NAME, TG_OP;
END
$$;

CREATE TRIGGER assertion_revisions_append_only
BEFORE UPDATE OR DELETE ON napp.assertion_revisions
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();

CREATE TABLE napp.authorized_projections (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    projection_key text NOT NULL,
    authorization_session_id uuid NOT NULL,
    actor_id uuid NOT NULL,
    purpose_id uuid NOT NULL,
    policy_digest bytea NOT NULL,
    authorization_digest bytea NOT NULL,
    valid_at tstzrange NOT NULL,
    known_at timestamptz NOT NULL,
    relation_spec jsonb NOT NULL,
    field_release_spec jsonb NOT NULL DEFAULT '{}'::jsonb,
    manifest_digest bytea NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    expires_at timestamptz,
    UNIQUE (case_id, projection_key),
    UNIQUE (case_id, id),
    FOREIGN KEY (authorization_session_id, case_id)
        REFERENCES napp.case_purpose_sessions(id, case_id) ON DELETE RESTRICT,
    CHECK (projection_key <> ''),
    CHECK (octet_length(policy_digest) = 32),
    CHECK (octet_length(authorization_digest) = 32),
    CHECK (octet_length(manifest_digest) = 32),
    CHECK (NOT isempty(valid_at)),
    CHECK (known_at <= created_at),
    CHECK (expires_at IS NULL OR expires_at > created_at),
    CHECK (jsonb_typeof(relation_spec) = 'object'),
    CHECK (jsonb_typeof(field_release_spec) = 'object')
);

COMMENT ON TABLE napp.authorized_projections IS
'Immutable, authorization-first graph projection metadata. Cache identity must include actor/purpose plus policy and authorization digests.';

CREATE INDEX authorized_projections_cache_idx
    ON napp.authorized_projections
    (case_id, actor_id, purpose_id, policy_digest, authorization_digest, manifest_digest);

CREATE TABLE napp.authorized_projection_revisions (
    case_id uuid NOT NULL,
    projection_id uuid NOT NULL,
    assertion_revision_id uuid NOT NULL,
    ordinal bigint NOT NULL,
    PRIMARY KEY (projection_id, assertion_revision_id),
    UNIQUE (projection_id, ordinal),
    FOREIGN KEY (case_id, projection_id)
        REFERENCES napp.authorized_projections(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, assertion_revision_id)
        REFERENCES napp.assertion_revisions(case_id, id) ON DELETE RESTRICT,
    CHECK (ordinal >= 0)
);

COMMENT ON TABLE napp.authorized_projection_revisions IS
'Exact assertion revision population of an authorized projection; no mutable “current assertion” dependency is permitted.';

CREATE INDEX projection_revisions_reverse_idx
    ON napp.authorized_projection_revisions (case_id, assertion_revision_id);

CREATE TABLE napp.analysis_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    analysis_key text NOT NULL,
    version_number integer NOT NULL,
    parent_version_id uuid,
    projection_id uuid NOT NULL,
    question text NOT NULL,
    recipe jsonb NOT NULL,
    recipe_digest bytea NOT NULL,
    state text NOT NULL DEFAULT 'draft',
    stale_at timestamptz,
    stale_reason text,
    created_by_actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    published_at timestamptz,
    UNIQUE (case_id, analysis_key, version_number),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, parent_version_id)
        REFERENCES napp.analysis_versions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, projection_id)
        REFERENCES napp.authorized_projections(case_id, id) ON DELETE RESTRICT,
    CHECK (analysis_key <> ''),
    CHECK (version_number > 0),
    CHECK (parent_version_id IS NULL OR parent_version_id <> id),
    CHECK (question <> ''),
    CHECK (jsonb_typeof(recipe) = 'object'),
    CHECK (octet_length(recipe_digest) = 32),
    CHECK (state IN ('draft', 'running', 'published', 'failed', 'cancelled')),
    CHECK ((state = 'published') = (published_at IS NOT NULL)),
    CHECK ((stale_at IS NULL) = (stale_reason IS NULL))
);

COMMENT ON TABLE napp.analysis_versions IS
'Consequential analytical choices create immutable numbered versions. Visual-only presets are deliberately outside this table.';

CREATE INDEX analysis_versions_projection_idx
    ON napp.analysis_versions (case_id, projection_id);
CREATE INDEX analysis_versions_stale_idx
    ON napp.analysis_versions (case_id, stale_at)
    WHERE stale_at IS NOT NULL;

CREATE TABLE napp.analysis_dependencies (
    case_id uuid NOT NULL,
    analysis_version_id uuid NOT NULL,
    assertion_revision_id uuid NOT NULL,
    dependency_role text NOT NULL DEFAULT 'input',
    PRIMARY KEY (analysis_version_id, assertion_revision_id, dependency_role),
    FOREIGN KEY (case_id, analysis_version_id)
        REFERENCES napp.analysis_versions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, assertion_revision_id)
        REFERENCES napp.assertion_revisions(case_id, id) ON DELETE RESTRICT,
    CHECK (dependency_role IN ('input', 'supporting', 'contrary', 'excluded'))
);

CREATE INDEX analysis_dependencies_reverse_idx
    ON napp.analysis_dependencies (case_id, assertion_revision_id);

CREATE TABLE napp.community_runs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    analysis_version_id uuid NOT NULL,
    projection_id uuid NOT NULL,
    algorithm text NOT NULL,
    algorithm_version text NOT NULL,
    objective text NOT NULL,
    parameters jsonb NOT NULL,
    random_seed bigint NOT NULL,
    period tstzrange NOT NULL,
    status text NOT NULL DEFAULT 'staged',
    input_digest bytea NOT NULL,
    output_digest bytea,
    started_at timestamptz,
    completed_at timestamptz,
    published_at timestamptz,
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, analysis_version_id)
        REFERENCES napp.analysis_versions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, projection_id)
        REFERENCES napp.authorized_projections(case_id, id) ON DELETE RESTRICT,
    CHECK (algorithm <> ''),
    CHECK (algorithm_version <> ''),
    CHECK (objective <> ''),
    CHECK (jsonb_typeof(parameters) = 'object'),
    CHECK (NOT isempty(period)),
    CHECK (status IN ('staged', 'running', 'succeeded', 'published', 'failed', 'cancelled')),
    CHECK (octet_length(input_digest) = 32),
    CHECK (output_digest IS NULL OR octet_length(output_digest) = 32),
    CHECK (completed_at IS NULL OR started_at IS NOT NULL),
    CHECK (published_at IS NULL OR (status = 'published' AND completed_at IS NOT NULL))
);

COMMENT ON TABLE napp.community_runs IS
'Detector run over one immutable authorized projection and explicit period. Publication occurs only after complete staged output exists.';

CREATE INDEX community_runs_analysis_idx
    ON napp.community_runs (case_id, analysis_version_id, period);

CREATE TABLE napp.community_observations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    community_run_id uuid NOT NULL,
    local_label text NOT NULL,
    member_count integer NOT NULL,
    quality numeric,
    confidence numeric(5,4),
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    UNIQUE (community_run_id, local_label),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, community_run_id)
        REFERENCES napp.community_runs(case_id, id) ON DELETE RESTRICT,
    CHECK (local_label <> ''),
    CHECK (member_count >= 0),
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CHECK (jsonb_typeof(metadata) = 'object')
);

COMMENT ON TABLE napp.community_observations IS
'Detector-local communities. local_label is explicitly not a persistent identity.';

CREATE TABLE napp.community_memberships (
    case_id uuid NOT NULL,
    community_observation_id uuid NOT NULL,
    entity_id uuid NOT NULL,
    membership_weight numeric(8,7) NOT NULL DEFAULT 1,
    membership_role text NOT NULL DEFAULT 'member',
    PRIMARY KEY (community_observation_id, entity_id),
    FOREIGN KEY (case_id, community_observation_id)
        REFERENCES napp.community_observations(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, entity_id)
        REFERENCES napp.entities(case_id, id) ON DELETE RESTRICT,
    CHECK (membership_weight > 0 AND membership_weight <= 1),
    CHECK (membership_role <> '')
);

CREATE INDEX community_memberships_entity_idx
    ON napp.community_memberships (case_id, entity_id);

CREATE TABLE napp.community_lineage_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    analysis_version_id uuid NOT NULL,
    version_number integer NOT NULL,
    parent_version_id uuid,
    method text NOT NULL,
    parameters jsonb NOT NULL,
    created_by_actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    is_analyst_override boolean NOT NULL DEFAULT false,
    rationale text,
    UNIQUE (analysis_version_id, version_number),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, analysis_version_id)
        REFERENCES napp.analysis_versions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, parent_version_id)
        REFERENCES napp.community_lineage_versions(case_id, id) ON DELETE RESTRICT,
    CHECK (version_number > 0),
    CHECK (parent_version_id IS NULL OR parent_version_id <> id),
    CHECK (method <> ''),
    CHECK (jsonb_typeof(parameters) = 'object'),
    CHECK (NOT is_analyst_override OR (parent_version_id IS NOT NULL AND rationale IS NOT NULL))
);

COMMENT ON TABLE napp.community_lineage_versions IS
'Versioned interpretation layer separate from detector output. Analyst overrides preserve and parent the prior version.';

CREATE TABLE napp.community_lineage_identities (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    lineage_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, lineage_key),
    UNIQUE (case_id, id),
    CHECK (lineage_key <> '')
);

CREATE TABLE napp.community_lineage_events (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    lineage_version_id uuid NOT NULL,
    event_type text NOT NULL,
    event_period tstzrange NOT NULL,
    confidence numeric(5,4),
    status text NOT NULL DEFAULT 'accepted',
    explanation jsonb NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, lineage_version_id)
        REFERENCES napp.community_lineage_versions(case_id, id) ON DELETE RESTRICT,
    CHECK (event_type IN (
        'birth', 'continuation', 'split', 'merge', 'death', 'resurgence'
    )),
    CHECK (NOT isempty(event_period)),
    CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1)),
    CHECK (status IN ('candidate', 'accepted', 'rejected', 'unresolved')),
    CHECK (jsonb_typeof(explanation) = 'object')
);

COMMENT ON TABLE napp.community_lineage_events IS
'Candidate or accepted lifecycle interpretation. Split/merge cardinality is represented by endpoint rows, not detector labels.';

CREATE TABLE napp.community_lineage_event_endpoints (
    case_id uuid NOT NULL,
    lineage_event_id uuid NOT NULL,
    endpoint_role text NOT NULL,
    lineage_identity_id uuid NOT NULL,
    community_observation_id uuid,
    match_score numeric(8,7),
    rank integer,
    PRIMARY KEY (lineage_event_id, endpoint_role, lineage_identity_id),
    FOREIGN KEY (case_id, lineage_event_id)
        REFERENCES napp.community_lineage_events(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, lineage_identity_id)
        REFERENCES napp.community_lineage_identities(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, community_observation_id)
        REFERENCES napp.community_observations(case_id, id) ON DELETE RESTRICT,
    CHECK (endpoint_role IN ('parent', 'child')),
    CHECK (match_score IS NULL OR (match_score >= 0 AND match_score <= 1)),
    CHECK (rank IS NULL OR rank > 0)
);

CREATE INDEX lineage_endpoints_identity_idx
    ON napp.community_lineage_event_endpoints (case_id, lineage_identity_id);
CREATE INDEX lineage_endpoints_observation_idx
    ON napp.community_lineage_event_endpoints (case_id, community_observation_id)
    WHERE community_observation_id IS NOT NULL;

CREATE TABLE napp.reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL REFERENCES napp.cases(id) ON DELETE RESTRICT,
    report_key text NOT NULL,
    title text NOT NULL,
    created_by_actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    UNIQUE (case_id, report_key),
    UNIQUE (case_id, id),
    CHECK (report_key <> ''),
    CHECK (title <> '')
);

CREATE TABLE napp.report_versions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    case_id uuid NOT NULL,
    report_id uuid NOT NULL,
    version_number integer NOT NULL,
    analysis_version_id uuid NOT NULL,
    parent_version_id uuid,
    status text NOT NULL DEFAULT 'draft',
    content_uri text,
    content_digest bytea,
    manifest jsonb NOT NULL,
    manifest_digest bytea NOT NULL,
    restrictions jsonb NOT NULL DEFAULT '{}'::jsonb,
    stale_at timestamptz,
    stale_reason text,
    created_by_actor_id uuid NOT NULL,
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    released_at timestamptz,
    UNIQUE (report_id, version_number),
    UNIQUE (case_id, id),
    FOREIGN KEY (case_id, report_id)
        REFERENCES napp.reports(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, analysis_version_id)
        REFERENCES napp.analysis_versions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, parent_version_id)
        REFERENCES napp.report_versions(case_id, id) ON DELETE RESTRICT,
    CHECK (version_number > 0),
    CHECK (parent_version_id IS NULL OR parent_version_id <> id),
    CHECK (status IN ('draft', 'review', 'approved', 'released', 'withdrawn')),
    CHECK ((status = 'released') = (released_at IS NOT NULL)),
    CHECK (content_digest IS NULL OR octet_length(content_digest) = 32),
    CHECK (jsonb_typeof(manifest) = 'object'),
    CHECK (octet_length(manifest_digest) = 32),
    CHECK (jsonb_typeof(restrictions) = 'object'),
    CHECK ((stale_at IS NULL) = (stale_reason IS NULL))
);

COMMENT ON TABLE napp.report_versions IS
'Structured, reconstructable report versions. Released content references immutable object storage and exact dependencies.';

CREATE INDEX report_versions_analysis_idx
    ON napp.report_versions (case_id, analysis_version_id);
CREATE INDEX report_versions_stale_idx
    ON napp.report_versions (case_id, stale_at)
    WHERE stale_at IS NOT NULL;

CREATE TABLE napp.report_dependencies (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    case_id uuid NOT NULL,
    report_version_id uuid NOT NULL,
    dependency_role text NOT NULL,
    assertion_revision_id uuid,
    projection_id uuid,
    analysis_version_id uuid,
    community_run_id uuid,
    lineage_event_id uuid,
    FOREIGN KEY (case_id, report_version_id)
        REFERENCES napp.report_versions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, assertion_revision_id)
        REFERENCES napp.assertion_revisions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, projection_id)
        REFERENCES napp.authorized_projections(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, analysis_version_id)
        REFERENCES napp.analysis_versions(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, community_run_id)
        REFERENCES napp.community_runs(case_id, id) ON DELETE RESTRICT,
    FOREIGN KEY (case_id, lineage_event_id)
        REFERENCES napp.community_lineage_events(case_id, id) ON DELETE RESTRICT,
    CHECK (dependency_role IN (
        'input', 'supporting', 'contrary', 'method', 'visualization'
    )),
    CHECK (num_nonnulls(
        assertion_revision_id, projection_id, analysis_version_id,
        community_run_id, lineage_event_id
    ) = 1)
);

CREATE UNIQUE INDEX report_dependencies_exact_unique_idx
    ON napp.report_dependencies (
        report_version_id,
        dependency_role,
        COALESCE(assertion_revision_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(projection_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(analysis_version_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(community_run_id, '00000000-0000-0000-0000-000000000000'::uuid),
        COALESCE(lineage_event_id, '00000000-0000-0000-0000-000000000000'::uuid)
    );
CREATE INDEX report_dependencies_assertion_reverse_idx
    ON napp.report_dependencies (case_id, assertion_revision_id)
    WHERE assertion_revision_id IS NOT NULL;

COMMENT ON TABLE napp.report_dependencies IS
'Exact typed dependency edges used for reconstruction and correction impact. Exactly one target is required per row.';

CREATE TABLE napp.audit_chain_heads (
    chain_name text PRIMARY KEY,
    last_sequence bigint NOT NULL DEFAULT 0,
    last_hash bytea NOT NULL,
    CHECK (chain_name <> ''),
    CHECK (last_sequence >= 0),
    CHECK (octet_length(last_hash) = 32)
);

INSERT INTO napp.audit_chain_heads (chain_name, last_hash)
VALUES ('primary', public.digest('napp-audit-genesis-v1', 'sha256'));

CREATE TABLE napp.audit_events (
    sequence bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    event_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    chain_name text NOT NULL DEFAULT 'primary',
    occurred_at timestamptz NOT NULL DEFAULT clock_timestamp(),
    actor_id uuid NOT NULL,
    purpose_id uuid NOT NULL,
    case_id uuid,
    event_type text NOT NULL,
    target_type text,
    target_id text,
    outcome text NOT NULL,
    metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
    previous_hash bytea NOT NULL,
    event_hash bytea NOT NULL,
    FOREIGN KEY (chain_name) REFERENCES napp.audit_chain_heads(chain_name),
    FOREIGN KEY (case_id) REFERENCES napp.cases(id) ON DELETE RESTRICT,
    CHECK (event_type <> ''),
    CHECK (outcome IN ('allowed', 'denied', 'succeeded', 'failed')),
    CHECK (jsonb_typeof(metadata) = 'object'),
    CHECK (octet_length(previous_hash) = 32),
    CHECK (octet_length(event_hash) = 32)
);

COMMENT ON TABLE napp.audit_events IS
'Append-only tamper-evident audit chain. metadata must contain identifiers and allowlisted context, never copied source content.';

CREATE FUNCTION napp.prepare_audit_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, napp
AS $$
DECLARE
    head napp.audit_chain_heads%ROWTYPE;
BEGIN
    SELECT *
      INTO head
      FROM napp.audit_chain_heads
     WHERE chain_name = NEW.chain_name
     FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'unknown audit chain %', NEW.chain_name;
    END IF;

    NEW.previous_hash := head.last_hash;
    NEW.event_hash := public.digest(
        concat_ws('|',
            NEW.event_id::text,
            NEW.chain_name,
            NEW.occurred_at::text,
            NEW.actor_id::text,
            NEW.purpose_id::text,
            COALESCE(NEW.case_id::text, ''),
            NEW.event_type,
            COALESCE(NEW.target_type, ''),
            COALESCE(NEW.target_id, ''),
            NEW.outcome,
            NEW.metadata::text,
            encode(NEW.previous_hash, 'hex')
        ),
        'sha256'
    );

    UPDATE napp.audit_chain_heads
       SET last_sequence = NEW.sequence,
           last_hash = NEW.event_hash
     WHERE chain_name = NEW.chain_name;
    RETURN NEW;
END
$$;

COMMENT ON FUNCTION napp.prepare_audit_event() IS
'Owner-executed audit serializer. Runtime roles need INSERT on audit_events but must not receive direct UPDATE on audit_chain_heads.';

CREATE TRIGGER audit_events_hash_before_insert
BEFORE INSERT ON napp.audit_events
FOR EACH ROW EXECUTE FUNCTION napp.prepare_audit_event();

CREATE TRIGGER audit_events_append_only
BEFORE UPDATE OR DELETE ON napp.audit_events
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();

CREATE TABLE napp.audit_checkpoints (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    chain_name text NOT NULL,
    through_sequence bigint NOT NULL,
    event_hash bytea NOT NULL,
    anchored_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    external_anchor_uri text NOT NULL,
    external_receipt jsonb NOT NULL DEFAULT '{}'::jsonb,
    FOREIGN KEY (chain_name) REFERENCES napp.audit_chain_heads(chain_name),
    UNIQUE (chain_name, through_sequence),
    CHECK (through_sequence > 0),
    CHECK (octet_length(event_hash) = 32),
    CHECK (external_anchor_uri <> ''),
    CHECK (jsonb_typeof(external_receipt) = 'object')
);

CREATE TRIGGER audit_checkpoints_append_only
BEFORE UPDATE OR DELETE ON napp.audit_checkpoints
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();

COMMENT ON TABLE napp.audit_checkpoints IS
'References independently stored audit-chain checkpoints. The database cannot itself prove that an external anchor is independent.';

-- Immutable analytical and report artifacts: mutation creates a new version.
CREATE TRIGGER authorized_projections_append_only
BEFORE UPDATE OR DELETE ON napp.authorized_projections
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();
CREATE TRIGGER authorized_projection_revisions_append_only
BEFORE UPDATE OR DELETE ON napp.authorized_projection_revisions
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();
CREATE TRIGGER analysis_dependencies_append_only
BEFORE UPDATE OR DELETE ON napp.analysis_dependencies
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();
CREATE TRIGGER community_observations_append_only
BEFORE UPDATE OR DELETE ON napp.community_observations
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();
CREATE TRIGGER community_memberships_append_only
BEFORE UPDATE OR DELETE ON napp.community_memberships
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();
CREATE TRIGGER community_lineage_events_append_only
BEFORE UPDATE OR DELETE ON napp.community_lineage_events
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();
CREATE TRIGGER community_lineage_event_endpoints_append_only
BEFORE UPDATE OR DELETE ON napp.community_lineage_event_endpoints
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();
CREATE TRIGGER report_dependencies_append_only
BEFORE UPDATE OR DELETE ON napp.report_dependencies
FOR EACH ROW EXECUTE FUNCTION napp.reject_row_mutation();

-- RLS scaffolding. FORCE prevents table owners from accidentally bypassing
-- policies in normal application roles; migrations and maintenance use a
-- separately controlled BYPASSRLS role.
ALTER TABLE napp.cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE napp.cases FORCE ROW LEVEL SECURITY;
CREATE POLICY cases_case_scope ON napp.cases
    USING (napp.case_is_authorized(id))
    WITH CHECK (napp.case_is_authorized(id));

ALTER TABLE napp.case_purpose_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE napp.case_purpose_sessions FORCE ROW LEVEL SECURITY;
CREATE POLICY case_purpose_sessions_case_scope ON napp.case_purpose_sessions
    USING (napp.case_is_authorized(case_id))
    WITH CHECK (
        napp.case_is_authorized(case_id)
        AND actor_id = napp.current_actor_id()
        AND purpose_id = napp.current_purpose_id()
    );

DO $rls$
DECLARE
    table_name text;
BEGIN
    FOREACH table_name IN ARRAY ARRAY[
        'entities', 'sources', 'assertions', 'assertion_revisions',
        'authorized_projections', 'authorized_projection_revisions',
        'analysis_versions', 'analysis_dependencies',
        'community_runs', 'community_observations', 'community_memberships',
        'community_lineage_versions', 'community_lineage_identities',
        'community_lineage_events', 'community_lineage_event_endpoints',
        'reports', 'report_versions', 'report_dependencies'
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
$rls$;

ALTER TABLE napp.audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE napp.audit_events FORCE ROW LEVEL SECURITY;
CREATE POLICY audit_events_insert_scope ON napp.audit_events
    FOR INSERT
    WITH CHECK (
        actor_id = napp.current_actor_id()
        AND purpose_id = napp.current_purpose_id()
        AND (case_id IS NULL OR napp.case_is_authorized(case_id))
    );
CREATE POLICY audit_events_read_scope ON napp.audit_events
    FOR SELECT
    USING (
        napp.current_actor_id() IS NOT NULL
        AND napp.current_purpose_id() IS NOT NULL
        AND (case_id IS NULL OR napp.case_is_authorized(case_id))
    );

-- No PUBLIC table privileges. Deployment grants least-privilege access to
-- dedicated application, worker, auditor, and migration roles.
REVOKE ALL ON ALL TABLES IN SCHEMA napp FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA napp FROM PUBLIC;
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA napp FROM PUBLIC;

COMMIT;
