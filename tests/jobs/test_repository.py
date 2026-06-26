from __future__ import annotations

import unittest
from datetime import datetime, timedelta, timezone

from apps.api.jobs import (
    DependencyKind,
    DependencyRef,
    IdempotencyConflict,
    InMemoryJobRepository,
    InvalidTransition,
    JobSpec,
    JobState,
    LeaseConflict,
    PublicationState,
)

UTC = timezone.utc


class Clock:
    def __init__(self) -> None:
        self.now = datetime(2026, 6, 25, 12, tzinfo=UTC)

    def __call__(self) -> datetime:
        return self.now

    def advance(self, **kwargs: int) -> None:
        self.now += timedelta(**kwargs)


class Ids:
    def __init__(self) -> None:
        self.value = 0

    def __call__(self) -> str:
        self.value += 1
        return f"id-{self.value}"


def spec(key: str, *, max_attempts: int = 3) -> JobSpec:
    return JobSpec(
        case_id="case-1",
        kind="analysis",
        idempotency_key=key,
        input_digest=f"digest-{key}",
        parameters={"recipe": "v1"},
        max_attempts=max_attempts,
    )


class DurableJobRepositoryTests(unittest.TestCase):
    def setUp(self) -> None:
        self.clock = Clock()
        self.repository = InMemoryJobRepository(
            clock=self.clock, id_factory=Ids()
        )

    def claim(self, worker: str = "worker-a"):
        lease = self.repository.claim(
            worker_id=worker, lease_for=timedelta(minutes=5)
        )
        self.assertIsNotNone(lease)
        assert lease is not None
        return lease

    def stage(self, lease, name: str = "result.json") -> None:
        self.repository.stage_output(
            lease.job_id,
            lease.token,
            name=name,
            object_uri=f"s3://staging/{lease.attempt_id}/{name}",
            content_digest=f"digest-{name}",
        )

    def publish(
        self,
        lease,
        *,
        result_key: str = "network/current",
        dependencies: tuple[DependencyRef, ...] = (),
        completion_key: str = "complete-1",
    ):
        self.stage(lease)
        return self.repository.complete_and_publish(
            lease.job_id,
            lease.token,
            result_key=result_key,
            dependencies=dependencies,
            completion_key=completion_key,
        )

    def test_submission_is_idempotent_but_rejects_conflicting_reuse(self) -> None:
        first = self.repository.submit(spec("same"))
        repeated = self.repository.submit(spec("same"))

        self.assertEqual(first, repeated)
        with self.assertRaises(IdempotencyConflict):
            self.repository.submit(
                JobSpec(
                    case_id="case-1",
                    kind="analysis",
                    idempotency_key="same",
                    input_digest="different",
                )
            )

    def test_happy_path_is_queued_running_succeeded_and_completion_is_idempotent(
        self,
    ) -> None:
        job = self.repository.submit(spec("happy"))
        self.assertEqual(JobState.QUEUED, job.state)

        lease = self.claim()
        self.assertEqual(JobState.RUNNING, self.repository.get_job(job.job_id).state)
        publication = self.publish(lease)
        repeated = self.repository.complete_and_publish(
            lease.job_id,
            "already-consumed-token",
            result_key="network/current",
            dependencies=(),
            completion_key="complete-1",
        )

        self.assertEqual(publication, repeated)
        completed = self.repository.get_job(job.job_id)
        self.assertEqual(JobState.SUCCEEDED, completed.state)
        self.assertEqual(publication.publication_id, completed.publication_id)
        self.assertEqual(1, publication.generation)

    def test_lease_token_isolated_and_heartbeat_extends_only_the_owner(self) -> None:
        job = self.repository.submit(spec("lease"))
        lease = self.claim()

        with self.assertRaises(LeaseConflict):
            self.repository.heartbeat(
                job.job_id,
                "foreign-token",
                lease_for=timedelta(minutes=5),
            )
        self.clock.advance(minutes=4)
        renewed = self.repository.heartbeat(
            job.job_id,
            lease.token,
            lease_for=timedelta(minutes=5),
        )
        self.assertEqual(self.clock.now + timedelta(minutes=5), renewed.leased_until)

    def test_expired_worker_cannot_stage_after_another_worker_reclaims(self) -> None:
        job = self.repository.submit(spec("expired"))
        stale_lease = self.claim("slow-worker")
        self.clock.advance(minutes=6)
        fresh_lease = self.claim("replacement-worker")

        self.assertEqual(job.job_id, fresh_lease.job_id)
        self.assertEqual(2, fresh_lease.attempt_number)
        with self.assertRaises(LeaseConflict):
            self.stage(stale_lease)
        self.stage(fresh_lease)

    def test_retry_wait_respects_availability_and_attempt_bound(self) -> None:
        job = self.repository.submit(spec("retry", max_attempts=2))
        first = self.claim()
        waiting = self.repository.fail(
            job.job_id,
            first.token,
            reason="temporary",
            retry_delay=timedelta(minutes=2),
        )
        self.assertEqual(JobState.RETRY_WAIT, waiting.state)
        self.assertIsNone(
            self.repository.claim(
                worker_id="early", lease_for=timedelta(minutes=5)
            )
        )

        self.clock.advance(minutes=2)
        second = self.claim()
        failed = self.repository.fail(
            job.job_id, second.token, reason="permanent"
        )
        self.assertEqual(JobState.FAILED, failed.state)
        self.assertEqual(2, failed.attempt_count)

    def test_running_cancellation_fences_staging_and_publication(self) -> None:
        job = self.repository.submit(spec("cancel"))
        lease = self.claim()
        self.stage(lease)
        requested = self.repository.request_cancel(job.job_id, reason="operator")

        self.assertEqual(JobState.RUNNING, requested.state)
        with self.assertRaises(InvalidTransition):
            self.repository.stage_output(
                job.job_id,
                lease.token,
                name="late",
                object_uri="s3://late",
                content_digest="late",
            )
        with self.assertRaises(InvalidTransition):
            self.repository.complete_and_publish(
                job.job_id,
                lease.token,
                result_key="network/current",
                dependencies=(),
                completion_key="forbidden",
            )
        cancelled = self.repository.acknowledge_cancel(job.job_id, lease.token)
        self.assertEqual(JobState.CANCELLED, cancelled.state)

    def test_cancel_before_claim_is_terminal_and_never_claimable(self) -> None:
        job = self.repository.submit(spec("cancel-queued"))
        cancelled = self.repository.request_cancel(job.job_id, reason="obsolete")

        self.assertEqual(JobState.CANCELLED, cancelled.state)
        self.assertIsNone(
            self.repository.claim(
                worker_id="worker", lease_for=timedelta(minutes=5)
            )
        )

    def test_staging_is_idempotent_within_attempt(self) -> None:
        self.repository.submit(spec("stage"))
        lease = self.claim()
        first = self.repository.stage_output(
            lease.job_id,
            lease.token,
            name="result",
            object_uri="s3://one",
            content_digest="digest",
            metadata={"rows": 3},
        )
        repeated = self.repository.stage_output(
            lease.job_id,
            lease.token,
            name="result",
            object_uri="s3://one",
            content_digest="digest",
            metadata={"rows": 3},
        )
        self.assertEqual(first, repeated)
        with self.assertRaises(IdempotencyConflict):
            self.repository.stage_output(
                lease.job_id,
                lease.token,
                name="result",
                object_uri="s3://two",
                content_digest="different",
            )

    def test_failed_and_cancelled_jobs_preserve_last_valid_publication(self) -> None:
        self.repository.submit(spec("published"))
        first = self.publish(self.claim())

        failed_job = self.repository.submit(spec("failed"))
        failed_lease = self.claim()
        self.stage(failed_lease)
        self.repository.fail(failed_job.job_id, failed_lease.token, reason="bad")

        cancelled_job = self.repository.submit(spec("cancelled"))
        cancelled_lease = self.claim()
        self.stage(cancelled_lease)
        self.repository.request_cancel(cancelled_job.job_id, reason="stop")
        self.repository.acknowledge_cancel(
            cancelled_job.job_id, cancelled_lease.token
        )

        self.assertEqual(
            first,
            self.repository.current_publication("case-1", "network/current"),
        )

    def test_successful_republication_atomically_advances_generation(self) -> None:
        self.repository.submit(spec("generation-1"))
        first = self.publish(self.claim(), completion_key="first")
        self.repository.submit(spec("generation-2"))
        second = self.publish(self.claim(), completion_key="second")

        self.assertEqual(2, second.generation)
        self.assertEqual(first.publication_id, second.supersedes_publication_id)
        self.assertEqual(
            second,
            self.repository.current_publication("case-1", "network/current"),
        )

    def test_correction_marks_direct_and_transitive_dependents_stale(self) -> None:
        corrected = DependencyRef(
            DependencyKind.ASSERTION_REVISION, "assertion-r1", "1"
        )
        self.repository.submit(spec("base"))
        base = self.publish(
            self.claim(),
            result_key="analysis/base",
            dependencies=(corrected,),
            completion_key="base",
        )

        self.repository.submit(spec("derived"))
        derived = self.publish(
            self.claim(),
            result_key="report/derived",
            dependencies=(
                DependencyRef(
                    DependencyKind.PUBLICATION,
                    base.publication_id,
                    str(base.generation),
                ),
            ),
            completion_key="derived",
        )
        impacts = self.repository.record_correction(
            case_id="case-1",
            correction_id="correction-1",
            dependency=corrected,
        )

        self.assertEqual(
            {base.publication_id, derived.publication_id},
            {impact.publication_id for impact in impacts},
        )
        self.assertEqual(
            {0, 1}, {impact.propagation_depth for impact in impacts}
        )
        self.assertEqual(
            PublicationState.STALE,
            self.repository.get_publication(base.publication_id).state,
        )
        self.assertEqual(
            PublicationState.STALE,
            self.repository.get_publication(derived.publication_id).state,
        )
        self.assertEqual(
            impacts,
            self.repository.record_correction(
                case_id="case-1",
                correction_id="correction-1",
                dependency=corrected,
            ),
        )

    def test_outbox_and_checkpoint_requests_are_idempotent(self) -> None:
        self.repository.submit(spec("audit"))
        lease = self.claim()
        publication = self.publish(lease)
        events = self.repository.outbox_events(undispatched_only=True)
        committed = next(
            event
            for event in events
            if event.aggregate_id == publication.publication_id
        )

        dispatched = self.repository.mark_outbox_dispatched(committed.event_id)
        repeated_dispatch = self.repository.mark_outbox_dispatched(
            committed.event_id
        )
        self.assertEqual(dispatched, repeated_dispatch)
        request = self.repository.request_audit_checkpoint(
            case_id="case-1",
            through_event_id=committed.event_id,
            requested_by="actor-1",
        )
        repeated = self.repository.request_audit_checkpoint(
            case_id="case-1",
            through_event_id=committed.event_id,
            requested_by="actor-2",
        )
        self.assertEqual(request, repeated)


if __name__ == "__main__":
    unittest.main()
