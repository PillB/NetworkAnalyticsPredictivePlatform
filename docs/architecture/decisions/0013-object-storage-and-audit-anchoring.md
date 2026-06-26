# ADR 0013: Immutable Object Storage and External Audit Anchoring

## Status

Accepted.

## Decision

Source artifacts, derived objects, and rendered reports are stored by lowercase
SHA-256 digest. Writers calculate and optionally verify the expected digest,
write content and its canonical JSON manifest into a temporary sibling
directory, flush the files, and atomically rename the complete directory into
its final digest path. Existing entries are never replaced. An identical retry
returns the existing entry; a conflicting immutable manifest is rejected.
Reads verify the manifest, declared size, and content digest.

Storage keys are relative sequences of conservative path segments. Absolute
paths, empty segments, dot segments, traversal, backslashes, and control
characters are rejected before filesystem access. The filesystem adapter is a
reference implementation under a caller-provided root; the interfaces do not
depend on a cloud SDK and can be implemented by versioned S3-compatible
storage.

Every report has an immutable, content-addressed manifest binding the rendered
report object to exact named dependency object references. Reconstruction
loads and verifies the report and every dependency. Report identity excludes
creation time so an identical publication retry is idempotent, while the first
persisted timestamp remains part of the stored receipt.

Retention actions create append-only markers. The object API intentionally has
no deletion operation: expiry or eligibility is a reviewable disposition, not
authorization for silent removal. Legal-hold and purge workflows must produce
additional durable evidence before a separate, explicitly governed deletion
facility can be introduced.

External audit checkpoints are exported through an anchor interface. The
filesystem reference anchor writes immutable receipts containing only opaque
checkpoint and stream identifiers, sequence and chain hashes, and timestamps.
Receipts form their own SHA-256 chain and verification checks receipt hashes,
ordering, predecessor links, stored identity, and an optional expected audit
chain hash. Raw case content and free-form audit metadata are excluded from
anchor receipts and diagnostic output.

## Rationale

Content addressing makes corruption and accidental substitution detectable.
Publishing a complete directory with one rename prevents readers from
observing a content file without its manifest. Exact report dependencies make
historical reconstruction independent of mutable current state. Append-only
retention markers and externally chained audit receipts preserve evidence of
governance actions without coupling the domain to a particular object-store
vendor or anchoring service.

## Consequences

- SHA-256 is an integrity identifier, not an authorization mechanism; callers
  must still enforce case and purpose access before resolving an object.
- Metadata must be canonical JSON data and should contain identifiers,
  classifications, schema versions, and digests rather than case payloads.
- Concurrent conforming writers converge on one immutable directory. A failed
  pre-publication write leaves no reader-visible object and temporary
  directories are cleaned on the failure path.
- Object replacement and silent deletion are unsupported.
- Report reconstruction fails closed if any manifest, report, or dependency
  is missing or altered.
- The filesystem anchor demonstrates receipt semantics but production anchors
  should place receipts outside the audit database and its administrative
  trust boundary.

## Reference implementation

`apps/api/storage` defines dependency-light protocols, immutable contracts,
and filesystem adapters. `tests/storage` exercises digest verification,
tamper detection, traversal rejection, retry idempotency, atomic publication,
report reconstruction, retention evidence, and audit-anchor chain
verification.
