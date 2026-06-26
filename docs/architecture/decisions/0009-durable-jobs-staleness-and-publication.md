# ADR 0009: Durable Jobs, Staleness, and Atomic Publication

## Status

Accepted.

## Decision

Long-running work uses bounded, case-scoped durable jobs with an immutable input
digest, a case-local idempotency key, a fixed attempt budget, and an optional
deadline. Workers claim eligible jobs with `FOR UPDATE SKIP LOCKED`. Every
attempt receives an opaque, expiring lease token; heartbeat, staging, failure,
cancellation acknowledgement, and publication require that exact live token.
Security-definer worker functions also explicitly require transaction-local
case authorization because function ownership can bypass table RLS; lease
secrecy is not treated as authorization.
Claiming and expired-lease reaping require an explicit target case. A worker
cannot use maintenance side effects in one authorized case to transition jobs
in another case.

Workers stage immutable output manifests under an attempt. Staging has no
reader-visible effect. A successful completion transaction validates the lease
and cancellation fence, creates a publication generation, binds all staged
outputs and exact dependencies, advances the logical result head, marks the
attempt and job successful, and writes an audit outbox event. Failed,
cancelled, expired, and partially staged attempts never advance the result
head, preserving the last valid result.

Publications record exact versioned dependencies, including dependencies on
other publications. A correction creates idempotent impact records and marks
direct and transitive dependents stale. Staleness does not delete or replace a
publication; it tells readers that recomputation is required while retaining
the prior result and provenance.

Job and publication state changes write transactional audit intents to an
outbox. A separate dispatcher appends those intents to the existing
hash-chained audit ledger. Idempotent checkpoint requests identify the outbox
event through which the audit chain should be externally anchored.

## Rationale

Lease fencing prevents a slow or partitioned worker from overwriting a newer
attempt. Per-attempt staging plus a single transactional result-head update
prevents partial publication. Fixed attempt and time bounds avoid immortal
work. Exact dependencies make correction impact explainable and permit
deterministic, transitive stale propagation.

Separating durable publication from object production also keeps valid results
available during retries and operational failures. The outbox makes audit
intent atomic with domain state without coupling job transactions to an
external anchoring service.

## Consequences

- Submission retries return the original job only when the complete immutable
  specification matches; conflicting reuse of an idempotency key is rejected.
- Lease expiry consumes an attempt. Retry is allowed only while both the
  attempt budget and deadline permit it.
- Cancellation is immediate before claim and cooperative while running.
  Publication is fenced as soon as cancellation is requested.
- Output names are idempotent within an attempt and cannot be changed once
  attached to a publication.
- A stale publication may remain the result head until a replacement is
  atomically published; readers must expose its stale status.
- Correction impact rows are append-only evidence of why and how far stale
  state propagated.
- Outbox dispatch and checkpoint fulfillment are independently retryable and
  idempotent.

## Reference implementation

`apps/api/jobs` provides dependency-light immutable contracts and a
thread-safe in-memory repository that defines the expected state transitions,
lease isolation, staging, publication, staleness, and idempotency semantics.
The PostgreSQL migration is the durable concurrency contract.
