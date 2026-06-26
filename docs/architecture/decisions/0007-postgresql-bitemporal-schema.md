# ADR 0007: PostgreSQL Bitemporal Canonical Schema

## Status

Accepted for the initial PostgreSQL 18 migration.

## Decision

Store case-scoped evidence and derived artifacts in the `napp` PostgreSQL
schema. Use stable assertions plus append-only assertion revisions. Every
revision has:

- a `tstzrange` valid period describing when the assertion applies in the
  represented world;
- a generated open-ended `tstzrange` recorded period describing when that
  revision became available to the platform;
- an exact source;
- an evidence class, evidence status, confidence, restrictions, and payload;
- a monotonically numbered, one-successor correction link.

A correction inserts a new revision and never updates or deletes its
predecessor. Historical reconstruction selects revisions whose valid period
matches the event-time question and whose recorded start is no later than the
knowledge cutoff, then chooses the latest reachable correction revision.

Authorized projections are immutable manifests with actor, purpose, policy,
authorization, and manifest digests plus the exact assertion revision
population. Analysis versions, community runs, lineage versions, report
versions, and their typed dependencies reference immutable inputs.

Community detector observations and local labels are separate from persistent
lineage identities and lifecycle events. Split and merge cardinality is
represented with parent/child endpoint rows. Analyst overrides create child
lineage versions and retain the algorithmic parent.

Audit events are append-only and serialized through a chain-head row. Each
event hash covers its predecessor hash and canonical PostgreSQL `jsonb` text.
Checkpoint rows refer to independently stored anchors. The narrowly scoped
audit trigger is owner-executed so runtime roles do not need direct chain-head
write privileges.

All case-scoped tables enable and force RLS. Runtime transactions must provide
an actor, purpose, and authorized case set through transaction-local settings.
Public schema, table, sequence, and function privileges are revoked.

## Rationale

The platform must reconstruct what was asserted about a real-world period
using only evidence known at a chosen cutoff. Append-only revisions preserve
prior belief, make corrections inspectable, and avoid hidden evidence
rewrites. Composite case foreign keys prevent cross-case dependency edges.
Exact reverse indexes on assertion dependencies support correction-impact
queries across projections, analyses, and reports.

Open-ended recorded ranges are intentional. Closing the predecessor's range
when a correction arrives would mutate an evidence revision. The schema
instead treats `recorded_period` as “known from” and resolves supersession
through correction lineage. A no-overlap exclusion constraint is therefore
not valid for recorded periods: revisions of one assertion necessarily
overlap after a correction. Revision-number uniqueness, one-successor
uniqueness, same-assertion checks, and monotone recorded timestamps provide
the defensible integrity constraints.

The generated range uses a SQL `NULL` upper bound, not the timestamp value
`infinity`. This distinction keeps `upper_inf(recorded_period)` true and makes
the unbounded semantics mechanically testable.

Valid periods also may overlap because contradictory sources and corrections
can describe the same real-world interval. They are indexed with GiST rather
than prohibited. Point events use an explicitly closed zero-width range and a
`validity_kind` discriminator so a momentary observation is not interpreted
as a persistent relation.

Forced RLS is defense in depth for case and purpose isolation. Keeping detailed
policy evaluation in the application policy service avoids embedding changing
jurisdiction, source, field, dissemination, and sensitivity rules in a static
initial migration.

## Consequences

- Evidence revisions and exact dependency populations cannot be updated or
  deleted through normal table operations.
- Corrections, analytical changes, lineage overrides, and report changes
  create new versions.
- Correction impact can be found by reverse lookup from an assertion revision
  into projection, analysis, and report dependency tables.
- Runtime roles must not own tables or have `BYPASSRLS`.
- Migration and maintenance roles require separately controlled privileges.
- The application must set RLS context with `SET LOCAL` inside every
  transaction and reject connection-pool reuse without resetting context.
- Audit insertion is serialized per chain. Additional named chains may be
  introduced only with explicit ordering and checkpoint semantics.

## Limits and follow-up work

- Static contract tests inspect SQL structure because no PostgreSQL server is
  available. Deployment must add PostgreSQL 18 integration tests for migration
  apply/rollback, generated ranges, point-range behavior, triggers, concurrent
  corrections, RLS owner/bypass behavior, and query plans.
- The database cannot prove that transaction-local RLS settings came from a
  currently valid external policy decision. The API must validate the
  `case_purpose_sessions` record before setting them.
- RLS only supplies case/purpose scaffolding. Source-, field-, sensitivity-,
  recipient-, retention-, and dissemination-level authorization remains
  mandatory in the policy service and projection builder.
- The append-only trigger protects SQL mutation but privileged owners and
  `BYPASSRLS` roles can bypass controls. Production requires restricted role
  ownership, migration audit, backups, WAL protection, and database activity
  monitoring.
- The hash chain is tamper-evident only when checkpoints are exported and
  verified independently. Database superusers can rewrite both events and
  chain heads.
- PostgreSQL `jsonb` text is deterministic within a PostgreSQL version but is
  not a cross-engine canonical JSON standard. External checkpoint tooling
  should verify the exact stored bytes or define a versioned canonicalization
  contract.
- Community event endpoint cardinalities, report preflight completeness, and
  stale propagation are workflow invariants that need transactional service
  functions or deferred constraint triggers once write APIs are implemented.
- Stale markers and publication states are operational fields. Their allowed
  transitions need service-level stored procedures or a later migration before
  untrusted roles receive direct table write privileges.
- The rollback drops the whole `napp` schema and is destructive. It retains
  shared extensions.

## Traceability

REQ-FR-001–005, REQ-FR-008–010, REQ-FR-015–018; REQ-NFR-004–005;
DEC-001, DEC-005–006, DEC-008, DEC-011; GATE-A, B, C, H, I, K.
