# ADR 0014: SDK-Neutral S3-Compatible Storage Adapters

## Status

Accepted.

## Decision

Cloud object and audit storage uses an injected, provider-neutral client with
four capabilities: an explicit conditional-create capability signal,
create-if-absent, `GET`, and `HEAD`. The application adapter has no dependency
on AWS, MinIO, Google Cloud, Azure, or another provider SDK. Deployment code
must translate one selected SDK into this narrow protocol.

Publication fails closed unless the provider can guarantee create-only
semantics. A provider response that is ambiguous, does not return a Boolean
created/existing result, or reports conditional writes as unsupported is not
treated as success. Existing keys are verified and may only satisfy an
idempotent retry; immutable identity conflicts are rejected.

Content objects use SHA-256 keys. Every read verifies the bytes against both
the application digest and the checksum returned by `HEAD`, verifies size, and
checks required contract metadata. Provider checksums are mandatory rather
than inferred from ETags. Application metadata is canonical JSON encoded into
provider string metadata and is included in immutable retry comparison.

Report content and dependencies are verified before publication of one
immutable, content-addressed report manifest. A failed manifest publication
can leave only unreferenced immutable objects, never a visible report manifest
that references missing or unverified content. Reconstruction revalidates the
manifest, rendered report, and every dependency.

Audit receipts contain only opaque stream/checkpoint identifiers, sequence,
the audit chain hash, timestamps, and an optional predecessor receipt hash.
They exclude case content and free-form metadata. A deployment may inject a
predecessor resolver backed by its audit checkpoint registry. Per-stream
serialization and predecessor selection remain an orchestration concern; the
object adapter guarantees immutable receipt publication and verification.

## Rationale

SDK independence keeps domain and service code portable while retaining the
specific primitive required for immutability. Requiring provider-reported
SHA-256 checksums avoids incorrect assumptions about multipart or encrypted
object ETags. Publishing manifests last provides a simple commit boundary
without pretending that a multi-object cloud write is transactional.

## Consequences

- Provider wrappers must map precondition failures to `False`, missing objects
  to `ObjectNotFound`, and unsupported conditional writes to
  `ConditionalWriteUnsupported`.
- Bucket policies, encryption, credentials, versioning, retention locks,
  replication, lifecycle execution, and authorization remain deployment
  responsibilities.
- The adapter deliberately has no delete or overwrite operation.
- This narrow client cannot enumerate retention markers. Governed retention
  execution requires a separate indexed registry rather than bucket listing.
- Audit predecessor resolution must be serialized per stream if receipt-chain
  continuity is required under concurrent writers.

## Verification

`tests/storage/test_s3_compatible.py` uses an in-memory protocol implementation
to test conditional-create rejection, idempotency, conflict detection,
checksum and metadata tampering, immutable report reconstruction, unsafe keys,
content-free audit receipts, predecessor chaining, and receipt tampering.
