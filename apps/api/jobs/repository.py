"""Thread-safe in-memory reference repository for the durable-job contract."""

from __future__ import annotations

from collections import defaultdict, deque
from dataclasses import dataclass, replace
from datetime import datetime, timedelta, timezone
from threading import RLock
from typing import Callable, Iterable
from uuid import uuid4

from .models import (
    CheckpointRequest,
    CorrectionImpact,
    DependencyKind,
    DependencyRef,
    JobSnapshot,
    JobSpec,
    JobState,
    Lease,
    OutboxEvent,
    Publication,
    PublicationState,
    StagedOutput,
    require_aware,
)


class JobError(ValueError):
    """Base error for invalid durable-job operations."""


class IdempotencyConflict(JobError):
    pass


class InvalidTransition(JobError):
    pass


class LeaseConflict(JobError):
    pass


class DeadlineExceeded(JobError):
    pass


@dataclass(frozen=True)
class _Attempt:
    attempt_id: str
    job_id: str
    number: int
    worker_id: str
    token: str
    started_at: datetime
    leased_until: datetime
    finished_at: datetime | None = None
    outcome: str | None = None


class InMemoryJobRepository:
    """Executable semantics for a transactional PostgreSQL implementation."""

    def __init__(
        self,
        *,
        clock: Callable[[], datetime] | None = None,
        id_factory: Callable[[], str] | None = None,
    ) -> None:
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._id = id_factory or (lambda: str(uuid4()))
        self._lock = RLock()
        self._jobs: dict[str, JobSnapshot] = {}
        self._idempotency: dict[tuple[str, str], str] = {}
        self._attempts: dict[str, _Attempt] = {}
        self._staged: dict[str, dict[str, StagedOutput]] = defaultdict(dict)
        self._publications: dict[str, Publication] = {}
        self._current_publication: dict[tuple[str, str], str] = {}
        self._impacts: list[CorrectionImpact] = []
        self._outbox: list[OutboxEvent] = []
        self._checkpoints: list[CheckpointRequest] = []
        self._completion_receipts: dict[tuple[str, str], Publication] = {}

    def _now(self, value: datetime | None = None) -> datetime:
        instant = self._clock() if value is None else value
        require_aware(instant, "now")
        return instant

    def _emit(
        self,
        *,
        case_id: str,
        aggregate_type: str,
        aggregate_id: str,
        event_type: str,
        payload: dict[str, object],
        now: datetime,
    ) -> None:
        self._outbox.append(
            OutboxEvent(
                event_id=self._id(),
                case_id=case_id,
                aggregate_type=aggregate_type,
                aggregate_id=aggregate_id,
                event_type=event_type,
                payload=payload,
                occurred_at=now,
            )
        )

    def submit(self, spec: JobSpec, *, now: datetime | None = None) -> JobSnapshot:
        instant = self._now(now)
        with self._lock:
            key = (spec.case_id, spec.idempotency_key)
            existing_id = self._idempotency.get(key)
            if existing_id is not None:
                existing = self._jobs[existing_id]
                if existing.spec != spec:
                    raise IdempotencyConflict(
                        "idempotency key was already used with a different job spec"
                    )
                return existing
            if spec.deadline_at is not None and spec.deadline_at <= instant:
                raise DeadlineExceeded("job deadline must be in the future")
            job = JobSnapshot(
                job_id=self._id(),
                spec=spec,
                state=JobState.QUEUED,
                attempt_count=0,
                available_at=instant,
                created_at=instant,
                updated_at=instant,
            )
            self._jobs[job.job_id] = job
            self._idempotency[key] = job.job_id
            self._emit(
                case_id=spec.case_id,
                aggregate_type="job",
                aggregate_id=job.job_id,
                event_type="job.submitted",
                payload={"kind": spec.kind, "input_digest": spec.input_digest},
                now=instant,
            )
            return job

    def get_job(self, job_id: str) -> JobSnapshot:
        with self._lock:
            try:
                return self._jobs[job_id]
            except KeyError as exc:
                raise KeyError(f"unknown job_id: {job_id}") from exc

    def _expire_lease(self, job: JobSnapshot, now: datetime) -> JobSnapshot:
        lease = job.active_lease
        if job.state is not JobState.RUNNING or lease is None:
            return job
        if lease.leased_until > now:
            return job
        attempt = self._attempts[lease.attempt_id]
        self._attempts[attempt.attempt_id] = replace(
            attempt, finished_at=now, outcome="lease_expired"
        )
        if job.cancellation_requested_at is not None:
            state = JobState.CANCELLED
            reason = "cancelled after worker lease expired"
        elif job.attempt_count >= job.spec.max_attempts:
            state = JobState.FAILED
            reason = "worker lease expired and retry budget was exhausted"
        else:
            state = JobState.RETRY_WAIT
            reason = None
        updated = replace(
            job,
            state=state,
            active_lease=None,
            available_at=now,
            updated_at=now,
            terminal_reason=reason,
        )
        self._jobs[job.job_id] = updated
        self._emit(
            case_id=job.spec.case_id,
            aggregate_type="job",
            aggregate_id=job.job_id,
            event_type=f"job.{state.value}",
            payload={"attempt_id": attempt.attempt_id, "reason": "lease_expired"},
            now=now,
        )
        return updated

    def claim(
        self,
        *,
        worker_id: str,
        lease_for: timedelta,
        kinds: Iterable[str] | None = None,
        now: datetime | None = None,
    ) -> Lease | None:
        if not worker_id:
            raise ValueError("worker_id is required")
        if lease_for <= timedelta(0):
            raise ValueError("lease_for must be positive")
        instant = self._now(now)
        accepted_kinds = None if kinds is None else set(kinds)
        with self._lock:
            for candidate in tuple(self._jobs.values()):
                self._expire_lease(candidate, instant)
            eligible = sorted(
                (
                    job
                    for job in self._jobs.values()
                    if job.state in (JobState.QUEUED, JobState.RETRY_WAIT)
                    and job.available_at <= instant
                    and (
                        accepted_kinds is None or job.spec.kind in accepted_kinds
                    )
                ),
                key=lambda item: (item.available_at, item.created_at, item.job_id),
            )
            for job in eligible:
                if job.spec.deadline_at is not None and job.spec.deadline_at <= instant:
                    self._jobs[job.job_id] = replace(
                        job,
                        state=JobState.FAILED,
                        terminal_reason="job deadline elapsed before claim",
                        updated_at=instant,
                    )
                    continue
                attempt_number = job.attempt_count + 1
                attempt_id = self._id()
                lease = Lease(
                    job_id=job.job_id,
                    attempt_id=attempt_id,
                    attempt_number=attempt_number,
                    worker_id=worker_id,
                    token=self._id(),
                    leased_until=instant + lease_for,
                )
                self._attempts[attempt_id] = _Attempt(
                    attempt_id=attempt_id,
                    job_id=job.job_id,
                    number=attempt_number,
                    worker_id=worker_id,
                    token=lease.token,
                    started_at=instant,
                    leased_until=lease.leased_until,
                )
                self._jobs[job.job_id] = replace(
                    job,
                    state=JobState.RUNNING,
                    attempt_count=attempt_number,
                    active_lease=lease,
                    updated_at=instant,
                )
                self._emit(
                    case_id=job.spec.case_id,
                    aggregate_type="job",
                    aggregate_id=job.job_id,
                    event_type="job.claimed",
                    payload={
                        "attempt_id": attempt_id,
                        "attempt_number": attempt_number,
                        "worker_id": worker_id,
                    },
                    now=instant,
                )
                return lease
            return None

    def _require_lease(
        self, job_id: str, token: str, now: datetime
    ) -> tuple[JobSnapshot, _Attempt]:
        job = self._expire_lease(self.get_job(job_id), now)
        lease = job.active_lease
        if job.state is not JobState.RUNNING or lease is None:
            raise LeaseConflict("job has no active worker lease")
        if lease.token != token:
            raise LeaseConflict("lease token does not own this job")
        return job, self._attempts[lease.attempt_id]

    def heartbeat(
        self,
        job_id: str,
        token: str,
        *,
        lease_for: timedelta,
        now: datetime | None = None,
    ) -> Lease:
        if lease_for <= timedelta(0):
            raise ValueError("lease_for must be positive")
        instant = self._now(now)
        with self._lock:
            job, attempt = self._require_lease(job_id, token, instant)
            assert job.active_lease is not None
            renewed = replace(job.active_lease, leased_until=instant + lease_for)
            self._attempts[attempt.attempt_id] = replace(
                attempt, leased_until=renewed.leased_until
            )
            self._jobs[job_id] = replace(
                job, active_lease=renewed, updated_at=instant
            )
            return renewed

    def request_cancel(
        self, job_id: str, *, reason: str, now: datetime | None = None
    ) -> JobSnapshot:
        instant = self._now(now)
        with self._lock:
            job = self._expire_lease(self.get_job(job_id), instant)
            if job.state in (JobState.SUCCEEDED, JobState.FAILED, JobState.CANCELLED):
                return job
            if job.state in (JobState.QUEUED, JobState.RETRY_WAIT):
                updated = replace(
                    job,
                    state=JobState.CANCELLED,
                    cancellation_requested_at=instant,
                    terminal_reason=reason,
                    updated_at=instant,
                )
            else:
                updated = replace(
                    job,
                    cancellation_requested_at=job.cancellation_requested_at or instant,
                    terminal_reason=reason,
                    updated_at=instant,
                )
            self._jobs[job_id] = updated
            self._emit(
                case_id=job.spec.case_id,
                aggregate_type="job",
                aggregate_id=job_id,
                event_type="job.cancellation_requested",
                payload={"reason": reason},
                now=instant,
            )
            return updated

    def acknowledge_cancel(
        self, job_id: str, token: str, *, now: datetime | None = None
    ) -> JobSnapshot:
        instant = self._now(now)
        with self._lock:
            job, attempt = self._require_lease(job_id, token, instant)
            if job.cancellation_requested_at is None:
                raise InvalidTransition("cancellation was not requested")
            self._attempts[attempt.attempt_id] = replace(
                attempt, finished_at=instant, outcome="cancelled"
            )
            updated = replace(
                job,
                state=JobState.CANCELLED,
                active_lease=None,
                updated_at=instant,
            )
            self._jobs[job_id] = updated
            return updated

    def stage_output(
        self,
        job_id: str,
        token: str,
        *,
        name: str,
        object_uri: str,
        content_digest: str,
        metadata: dict[str, object] | None = None,
        now: datetime | None = None,
    ) -> StagedOutput:
        if not name or not object_uri or not content_digest:
            raise ValueError("name, object_uri, and content_digest are required")
        instant = self._now(now)
        with self._lock:
            job, attempt = self._require_lease(job_id, token, instant)
            if job.cancellation_requested_at is not None:
                raise InvalidTransition("cannot stage output after cancellation request")
            existing = self._staged[attempt.attempt_id].get(name)
            candidate_values = (object_uri, content_digest, metadata or {})
            if existing is not None:
                if (
                    existing.object_uri,
                    existing.content_digest,
                    dict(existing.metadata),
                ) != candidate_values:
                    raise IdempotencyConflict(
                        "output name was already staged with different content"
                    )
                return existing
            output = StagedOutput(
                output_id=self._id(),
                job_id=job_id,
                attempt_id=attempt.attempt_id,
                name=name,
                object_uri=object_uri,
                content_digest=content_digest,
                metadata=metadata or {},
                staged_at=instant,
            )
            self._staged[attempt.attempt_id][name] = output
            return output

    def fail(
        self,
        job_id: str,
        token: str,
        *,
        reason: str,
        retry_delay: timedelta = timedelta(0),
        now: datetime | None = None,
    ) -> JobSnapshot:
        if retry_delay < timedelta(0):
            raise ValueError("retry_delay cannot be negative")
        instant = self._now(now)
        with self._lock:
            job, attempt = self._require_lease(job_id, token, instant)
            if job.cancellation_requested_at is not None:
                state = JobState.CANCELLED
            elif job.attempt_count < job.spec.max_attempts and (
                job.spec.deadline_at is None
                or instant + retry_delay < job.spec.deadline_at
            ):
                state = JobState.RETRY_WAIT
            else:
                state = JobState.FAILED
            self._attempts[attempt.attempt_id] = replace(
                attempt, finished_at=instant, outcome=state.value
            )
            updated = replace(
                job,
                state=state,
                active_lease=None,
                available_at=instant + retry_delay,
                terminal_reason=reason if state is not JobState.RETRY_WAIT else None,
                updated_at=instant,
            )
            self._jobs[job_id] = updated
            self._emit(
                case_id=job.spec.case_id,
                aggregate_type="job",
                aggregate_id=job_id,
                event_type=f"job.{state.value}",
                payload={"attempt_id": attempt.attempt_id, "reason": reason},
                now=instant,
            )
            return updated

    def complete_and_publish(
        self,
        job_id: str,
        token: str,
        *,
        result_key: str,
        dependencies: Iterable[DependencyRef],
        completion_key: str,
        now: datetime | None = None,
    ) -> Publication:
        if not result_key or not completion_key:
            raise ValueError("result_key and completion_key are required")
        instant = self._now(now)
        with self._lock:
            receipt_key = (job_id, completion_key)
            receipt = self._completion_receipts.get(receipt_key)
            if receipt is not None:
                return receipt
            job, attempt = self._require_lease(job_id, token, instant)
            if job.cancellation_requested_at is not None:
                raise InvalidTransition("cancelled jobs cannot publish")
            outputs = tuple(
                sorted(
                    self._staged[attempt.attempt_id].values(),
                    key=lambda item: item.name,
                )
            )
            if not outputs:
                raise InvalidTransition("successful publication requires staged output")
            dependency_tuple = tuple(
                sorted(
                    set(dependencies),
                    key=lambda item: (
                        item.kind.value,
                        item.target_id,
                        item.target_version,
                    ),
                )
            )
            current_key = (job.spec.case_id, result_key)
            previous_id = self._current_publication.get(current_key)
            generation = (
                1
                if previous_id is None
                else self._publications[previous_id].generation + 1
            )
            publication = Publication(
                publication_id=self._id(),
                case_id=job.spec.case_id,
                result_key=result_key,
                generation=generation,
                job_id=job_id,
                attempt_id=attempt.attempt_id,
                outputs=outputs,
                dependencies=dependency_tuple,
                state=PublicationState.CURRENT,
                published_at=instant,
                supersedes_publication_id=previous_id,
            )
            self._publications[publication.publication_id] = publication
            self._current_publication[current_key] = publication.publication_id
            self._attempts[attempt.attempt_id] = replace(
                attempt, finished_at=instant, outcome="succeeded"
            )
            self._jobs[job_id] = replace(
                job,
                state=JobState.SUCCEEDED,
                active_lease=None,
                publication_id=publication.publication_id,
                updated_at=instant,
            )
            self._completion_receipts[receipt_key] = publication
            self._emit(
                case_id=job.spec.case_id,
                aggregate_type="publication",
                aggregate_id=publication.publication_id,
                event_type="publication.committed",
                payload={
                    "job_id": job_id,
                    "result_key": result_key,
                    "generation": generation,
                },
                now=instant,
            )
            return publication

    def current_publication(
        self, case_id: str, result_key: str
    ) -> Publication | None:
        with self._lock:
            publication_id = self._current_publication.get((case_id, result_key))
            return (
                None
                if publication_id is None
                else self._publications[publication_id]
            )

    def get_publication(self, publication_id: str) -> Publication:
        with self._lock:
            try:
                return self._publications[publication_id]
            except KeyError as exc:
                raise KeyError(f"unknown publication_id: {publication_id}") from exc

    def record_correction(
        self,
        *,
        case_id: str,
        correction_id: str,
        dependency: DependencyRef,
        now: datetime | None = None,
    ) -> tuple[CorrectionImpact, ...]:
        instant = self._now(now)
        with self._lock:
            existing = tuple(
                impact
                for impact in self._impacts
                if impact.case_id == case_id
                and impact.correction_id == correction_id
            )
            if existing:
                return existing
            reverse: dict[tuple[DependencyKind, str, str], set[str]] = defaultdict(set)
            for publication in self._publications.values():
                if publication.case_id != case_id:
                    continue
                for item in publication.dependencies:
                    reverse[(item.kind, item.target_id, item.target_version)].add(
                        publication.publication_id
                    )
            queue = deque([(dependency, 0)])
            seen_publications: set[str] = set()
            impacts: list[CorrectionImpact] = []
            while queue:
                changed, depth = queue.popleft()
                for publication_id in sorted(
                    reverse.get(
                        (changed.kind, changed.target_id, changed.target_version), ()
                    )
                ):
                    if publication_id in seen_publications:
                        continue
                    seen_publications.add(publication_id)
                    publication = self._publications[publication_id]
                    self._publications[publication_id] = replace(
                        publication,
                        state=PublicationState.STALE,
                        stale_at=publication.stale_at or instant,
                        stale_reason=publication.stale_reason
                        or f"correction:{correction_id}",
                    )
                    impact = CorrectionImpact(
                        impact_id=self._id(),
                        case_id=case_id,
                        correction_id=correction_id,
                        dependency=changed,
                        publication_id=publication_id,
                        propagation_depth=depth,
                        recorded_at=instant,
                    )
                    self._impacts.append(impact)
                    impacts.append(impact)
                    queue.append(
                        (
                            DependencyRef(
                                kind=DependencyKind.PUBLICATION,
                                target_id=publication_id,
                                target_version=str(publication.generation),
                            ),
                            depth + 1,
                        )
                    )
            self._emit(
                case_id=case_id,
                aggregate_type="correction",
                aggregate_id=correction_id,
                event_type="correction.impact_recorded",
                payload={
                    "dependency_kind": dependency.kind.value,
                    "dependency_id": dependency.target_id,
                    "impacted_publication_ids": [
                        item.publication_id for item in impacts
                    ],
                },
                now=instant,
            )
            return tuple(impacts)

    def correction_impacts(self) -> tuple[CorrectionImpact, ...]:
        with self._lock:
            return tuple(self._impacts)

    def outbox_events(self, *, undispatched_only: bool = False) -> tuple[OutboxEvent, ...]:
        with self._lock:
            return tuple(
                event
                for event in self._outbox
                if not undispatched_only or event.dispatched_at is None
            )

    def mark_outbox_dispatched(
        self, event_id: str, *, now: datetime | None = None
    ) -> OutboxEvent:
        instant = self._now(now)
        with self._lock:
            for index, event in enumerate(self._outbox):
                if event.event_id != event_id:
                    continue
                updated = (
                    event
                    if event.dispatched_at is not None
                    else replace(event, dispatched_at=instant)
                )
                self._outbox[index] = updated
                return updated
            raise KeyError(f"unknown outbox event_id: {event_id}")

    def request_audit_checkpoint(
        self,
        *,
        case_id: str,
        through_event_id: str,
        requested_by: str,
        now: datetime | None = None,
    ) -> CheckpointRequest:
        instant = self._now(now)
        with self._lock:
            for request in self._checkpoints:
                if (
                    request.case_id == case_id
                    and request.through_event_id == through_event_id
                ):
                    return request
            request = CheckpointRequest(
                request_id=self._id(),
                case_id=case_id,
                through_event_id=through_event_id,
                requested_at=instant,
                requested_by=requested_by,
            )
            self._checkpoints.append(request)
            return request

    def checkpoint_requests(self) -> tuple[CheckpointRequest, ...]:
        with self._lock:
            return tuple(self._checkpoints)
