-- Destructive rollback for db/migrations/0002_jobs_and_staleness.sql.

BEGIN;

DROP TRIGGER IF EXISTS job_staged_outputs_published_immutable
    ON napp.job_staged_outputs;
DROP FUNCTION IF EXISTS napp.reject_published_output_mutation();
DROP FUNCTION IF EXISTS napp.record_correction_impact(
    uuid, uuid, text, uuid, text
);
DROP FUNCTION IF EXISTS napp.publish_job(uuid, uuid, text, text, jsonb);
DROP FUNCTION IF EXISTS napp.heartbeat_job(uuid, uuid, interval);
DROP FUNCTION IF EXISTS napp.claim_job(uuid, text, interval, text[]);
DROP FUNCTION IF EXISTS napp.reap_expired_job_leases(uuid);

DROP TABLE IF EXISTS napp.audit_checkpoint_requests;
DROP TABLE IF EXISTS napp.audit_outbox;
DROP TABLE IF EXISTS napp.correction_impacts;
DROP TABLE IF EXISTS napp.job_dependencies;
DROP TABLE IF EXISTS napp.job_result_heads;
DROP TABLE IF EXISTS napp.job_publication_outputs;
DROP TABLE IF EXISTS napp.job_publications;
DROP TABLE IF EXISTS napp.job_staged_outputs;
DROP TABLE IF EXISTS napp.job_attempts;
DROP TABLE IF EXISTS napp.jobs;

COMMIT;
