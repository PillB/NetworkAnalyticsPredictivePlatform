"""SDK-neutral adapters for immutable S3-compatible object storage."""

from __future__ import annotations

import base64
import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from types import MappingProxyType
from typing import Any, Callable, Mapping, Protocol

from .filesystem import (
    DigestMismatch,
    ImmutableConflict,
    IntegrityError,
    StorageError,
    UnsafeKey,
)
from .models import (
    AnchorReceipt,
    AuditCheckpoint,
    ObjectRef,
    ReconstructedReport,
    ReportDependency,
    ReportManifest,
    StoredObject,
    validate_digest,
)


class ConditionalWriteUnsupported(StorageError):
    """The provider cannot prove create-only publication semantics."""


class ObjectNotFound(StorageError):
    """The injected client could not find the requested object."""


@dataclass(frozen=True)
class RemoteObjectHead:
    """Provider-neutral subset of an S3 HEAD response."""

    size: int
    checksum_sha256: str | None
    metadata: Mapping[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.size < 0:
            raise ValueError("size cannot be negative")
        object.__setattr__(self, "metadata", MappingProxyType(dict(self.metadata)))


class ConditionalObjectClient(Protocol):
    """Small boundary implemented by a provider-specific SDK wrapper."""

    @property
    def conditional_create_supported(self) -> bool: ...

    def create_if_absent(
        self,
        key: str,
        content: bytes,
        *,
        checksum_sha256: str,
        metadata: Mapping[str, str],
    ) -> bool:
        """Create once, returning False only when the key already exists."""

    def get(self, key: str) -> bytes: ...

    def head(self, key: str) -> RemoteObjectHead: ...


_KEY_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")
_OBJECT_CONTRACT = "ContentAddressedObjectV1"
_REPORT_CONTRACT = "ReportManifestV1"
_RECEIPT_CONTRACT = "AuditAnchorReceiptV1"


def _sha256(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


def _canonical_json(value: Mapping[str, Any]) -> bytes:
    try:
        return json.dumps(
            value,
            sort_keys=True,
            separators=(",", ":"),
            ensure_ascii=False,
            allow_nan=False,
        ).encode("utf-8")
    except (TypeError, ValueError) as exc:
        raise StorageError("metadata must be canonical JSON data") from exc


def _parse_json(content: bytes, description: str) -> dict[str, Any]:
    try:
        value = json.loads(content)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise IntegrityError(f"{description} is not valid JSON") from exc
    if not isinstance(value, dict):
        raise IntegrityError(f"{description} must be a JSON object")
    return value


def _parse_time(value: Any, field_name: str) -> datetime:
    if not isinstance(value, str):
        raise IntegrityError(f"{field_name} is invalid")
    try:
        parsed = datetime.fromisoformat(value)
    except ValueError as exc:
        raise IntegrityError(f"{field_name} is invalid") from exc
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise IntegrityError(f"{field_name} must be timezone-aware")
    return parsed


def _safe_key(value: str, field_name: str) -> str:
    if (
        not isinstance(value, str)
        or not value
        or value.startswith("/")
        or value.endswith("/")
        or "\\" in value
        or "\x00" in value
    ):
        raise UnsafeKey(f"{field_name} is not a safe relative object key")
    segments = value.split("/")
    if any(
        segment in ("", ".", "..") or _KEY_SEGMENT.fullmatch(segment) is None
        for segment in segments
    ):
        raise UnsafeKey(f"{field_name} contains an unsafe key segment")
    return "/".join(segments)


def _encode_metadata(value: Mapping[str, Any]) -> str:
    return base64.urlsafe_b64encode(_canonical_json(value)).decode("ascii")


def _decode_metadata(value: str) -> dict[str, Any]:
    try:
        raw = base64.b64decode(value.encode("ascii"), altchars=b"-_", validate=True)
    except (ValueError, UnicodeEncodeError) as exc:
        raise IntegrityError("stored application metadata encoding is invalid") from exc
    return _parse_json(raw, "stored application metadata")


def _ref_payload(ref: ObjectRef) -> dict[str, Any]:
    return {
        "digest": ref.digest,
        "size": ref.size,
        "media_type": ref.media_type,
    }


def _ref_from_payload(value: Any) -> ObjectRef:
    if not isinstance(value, dict):
        raise IntegrityError("stored object reference is invalid")
    try:
        return ObjectRef(
            digest=value["digest"],
            size=value["size"],
            media_type=value["media_type"],
        )
    except (KeyError, TypeError, ValueError) as exc:
        raise IntegrityError("stored object reference is invalid") from exc


class _ConditionalPublisher:
    def __init__(
        self,
        client: ConditionalObjectClient,
        *,
        prefix: str,
    ) -> None:
        self._client = client
        self._prefix = _safe_key(prefix, "prefix") if prefix else ""

    def _key(self, suffix: str) -> str:
        suffix = _safe_key(suffix, "object key")
        return f"{self._prefix}/{suffix}" if self._prefix else suffix

    def _require_conditional_create(self) -> None:
        if not bool(
            getattr(self._client, "conditional_create_supported", False)
        ):
            raise ConditionalWriteUnsupported(
                "provider does not support conditional create/no-overwrite"
            )

    def _create(
        self,
        key: str,
        content: bytes,
        *,
        metadata: Mapping[str, str],
    ) -> bool:
        self._require_conditional_create()
        digest = _sha256(content)
        try:
            created = self._client.create_if_absent(
                key,
                content,
                checksum_sha256=digest,
                metadata=metadata,
            )
        except ConditionalWriteUnsupported:
            raise
        if not isinstance(created, bool):
            raise ConditionalWriteUnsupported(
                "provider did not return a definitive conditional-create result"
            )
        return created

    def _verified_bytes(
        self,
        key: str,
        *,
        expected_digest: str,
        expected_metadata: Mapping[str, str] | None = None,
    ) -> tuple[bytes, RemoteObjectHead]:
        validate_digest(expected_digest, "expected_digest")
        try:
            head = self._client.head(key)
            content = self._client.get(key)
        except ObjectNotFound as exc:
            raise IntegrityError("required remote object is missing") from exc
        if not isinstance(head, RemoteObjectHead):
            raise IntegrityError("provider returned an invalid HEAD contract")
        if head.checksum_sha256 is None:
            raise IntegrityError("provider did not return a SHA-256 checksum")
        try:
            validate_digest(head.checksum_sha256, "provider checksum")
        except ValueError as exc:
            raise IntegrityError("provider returned an invalid SHA-256 checksum") from exc
        if (
            head.size != len(content)
            or head.checksum_sha256 != expected_digest
            or _sha256(content) != expected_digest
        ):
            raise IntegrityError("remote object failed size or checksum verification")
        if expected_metadata is not None:
            for name, value in expected_metadata.items():
                if head.metadata.get(name) != value:
                    raise IntegrityError(
                        f"remote object metadata field {name!r} failed verification"
                    )
        return content, head


class S3CompatibleStorage(_ConditionalPublisher):
    """Content-addressed objects and immutable report manifests."""

    def __init__(
        self,
        client: ConditionalObjectClient,
        *,
        prefix: str = "",
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        super().__init__(client, prefix=prefix)
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def _now(self) -> datetime:
        value = self._clock()
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("clock must return a timezone-aware datetime")
        return value

    def _object_key(self, digest: str) -> str:
        validate_digest(digest)
        return self._key(f"objects/sha256/{digest[:2]}/{digest[2:4]}/{digest}")

    @staticmethod
    def _object_metadata(
        *,
        digest: str,
        size: int,
        media_type: str,
        created_at: datetime,
        metadata: Mapping[str, Any],
    ) -> dict[str, str]:
        return {
            "napp-contract": _OBJECT_CONTRACT,
            "napp-digest": digest,
            "napp-size": str(size),
            "napp-media-type": media_type,
            "napp-created-at": created_at.isoformat(),
            "napp-metadata": _encode_metadata(metadata),
        }

    def put(
        self,
        content: bytes,
        *,
        expected_digest: str | None = None,
        media_type: str = "application/octet-stream",
        metadata: Mapping[str, Any] | None = None,
    ) -> StoredObject:
        if not isinstance(content, bytes):
            raise TypeError("content must be bytes")
        if not media_type:
            raise ValueError("media_type is required")
        digest = _sha256(content)
        if expected_digest is not None:
            validate_digest(expected_digest, "expected_digest")
            if digest != expected_digest:
                raise DigestMismatch("content does not match expected SHA-256 digest")
        created_at = self._now()
        application_metadata = dict(metadata or {})
        remote_metadata = self._object_metadata(
            digest=digest,
            size=len(content),
            media_type=media_type,
            created_at=created_at,
            metadata=application_metadata,
        )
        key = self._object_key(digest)
        created = self._create(key, content, metadata=remote_metadata)
        stored = self.inspect(digest)
        persisted = self.get(digest)
        if persisted != content:
            raise IntegrityError("stored content does not match submitted content")
        requested_ref = ObjectRef(digest, len(content), media_type)
        if not created and (
            stored.ref != requested_ref
            or dict(stored.metadata) != application_metadata
        ):
            raise ImmutableConflict(
                "digest already exists with a different immutable manifest"
            )
        return stored

    def inspect(self, digest: str) -> StoredObject:
        key = self._object_key(digest)
        content, head = self._verified_bytes(
            key,
            expected_digest=digest,
            expected_metadata={
                "napp-contract": _OBJECT_CONTRACT,
                "napp-digest": digest,
            },
        )
        try:
            declared_size = int(head.metadata["napp-size"])
            media_type = head.metadata["napp-media-type"]
            created_at = _parse_time(
                head.metadata["napp-created-at"], "stored object created_at"
            )
            metadata = _decode_metadata(head.metadata["napp-metadata"])
        except (KeyError, TypeError, ValueError) as exc:
            raise IntegrityError("stored object metadata is invalid") from exc
        if declared_size != len(content):
            raise IntegrityError("stored object declared size is invalid")
        return StoredObject(
            ref=ObjectRef(digest, declared_size, media_type),
            created_at=created_at,
            metadata=metadata,
        )

    def get(self, digest: str) -> bytes:
        content, _ = self._verified_bytes(
            self._object_key(digest),
            expected_digest=digest,
            expected_metadata={
                "napp-contract": _OBJECT_CONTRACT,
                "napp-digest": digest,
            },
        )
        return content

    def put_report(
        self,
        report_key: str,
        content: bytes,
        *,
        dependencies: tuple[ReportDependency, ...],
        expected_digest: str | None = None,
        media_type: str = "application/octet-stream",
        metadata: Mapping[str, Any] | None = None,
    ) -> ReportManifest:
        report_key = _safe_key(report_key, "report_key")
        dependencies = tuple(dependencies)
        names = [dependency.name for dependency in dependencies]
        if len(names) != len(set(names)):
            raise StorageError("report dependency names must be unique")
        for dependency in dependencies:
            stored = self.inspect(dependency.object_ref.digest)
            if stored.ref != dependency.object_ref:
                raise IntegrityError("dependency reference does not match stored object")
        report_object = self.put(
            content,
            expected_digest=expected_digest,
            media_type=media_type,
            metadata={},
        ).ref
        identity = {
            "contract": _REPORT_CONTRACT,
            "report_key": report_key,
            "report_object": _ref_payload(report_object),
            "dependencies": [
                {
                    "name": dependency.name,
                    "role": dependency.role,
                    "object_ref": _ref_payload(dependency.object_ref),
                }
                for dependency in sorted(dependencies)
            ],
            "metadata": dict(metadata or {}),
        }
        manifest_digest = _sha256(_canonical_json(identity))
        payload = {
            **identity,
            "created_at": self._now().isoformat(),
            "manifest_digest": manifest_digest,
        }
        manifest_content = _canonical_json(payload)
        key = self._report_manifest_key(report_key, manifest_digest)
        remote_metadata = {
            "napp-contract": _REPORT_CONTRACT,
            "napp-manifest-digest": manifest_digest,
            "napp-report-key": report_key,
        }
        created = self._create(key, manifest_content, metadata=remote_metadata)
        existing = self._read_report_manifest(report_key, manifest_digest)
        if not created and self._report_identity(existing) != identity:
            raise ImmutableConflict("report manifest cannot be overwritten")
        return existing

    def _report_manifest_key(self, report_key: str, manifest_digest: str) -> str:
        validate_digest(manifest_digest, "manifest_digest")
        return self._key(
            f"reports/{_safe_key(report_key, 'report_key')}/{manifest_digest}.json"
        )

    def _read_report_manifest(
        self, report_key: str, manifest_digest: str
    ) -> ReportManifest:
        key = self._report_manifest_key(report_key, manifest_digest)
        try:
            initial = self._client.get(key)
        except ObjectNotFound as exc:
            raise IntegrityError("report manifest is missing") from exc
        content, _ = self._verified_bytes(
            key,
            expected_digest=_sha256(initial),
            expected_metadata={
                "napp-contract": _REPORT_CONTRACT,
                "napp-manifest-digest": manifest_digest,
                "napp-report-key": report_key,
            },
        )
        payload = _parse_json(content, "report manifest")
        try:
            supplied_digest = payload.pop("manifest_digest")
            created_at = payload.pop("created_at")
            if (
                payload.get("contract") != _REPORT_CONTRACT
                or payload.get("report_key") != report_key
                or supplied_digest != manifest_digest
                or _sha256(_canonical_json(payload)) != manifest_digest
            ):
                raise IntegrityError("report manifest identity failed verification")
            dependencies = tuple(
                ReportDependency(
                    name=value["name"],
                    role=value["role"],
                    object_ref=_ref_from_payload(value["object_ref"]),
                )
                for value in payload["dependencies"]
            )
            metadata = payload["metadata"]
            if not isinstance(metadata, dict):
                raise TypeError
            return ReportManifest(
                report_key=report_key,
                report_object=_ref_from_payload(payload["report_object"]),
                dependencies=dependencies,
                created_at=_parse_time(created_at, "report manifest created_at"),
                manifest_digest=manifest_digest,
                metadata=metadata,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise IntegrityError("report manifest fields are invalid") from exc

    @staticmethod
    def _report_identity(manifest: ReportManifest) -> dict[str, Any]:
        return {
            "contract": _REPORT_CONTRACT,
            "report_key": manifest.report_key,
            "report_object": _ref_payload(manifest.report_object),
            "dependencies": [
                {
                    "name": dependency.name,
                    "role": dependency.role,
                    "object_ref": _ref_payload(dependency.object_ref),
                }
                for dependency in sorted(manifest.dependencies)
            ],
            "metadata": dict(manifest.metadata),
        }

    def get_report(
        self, report_key: str, manifest_digest: str
    ) -> ReconstructedReport:
        manifest = self._read_report_manifest(report_key, manifest_digest)
        report_content = self.get(manifest.report_object.digest)
        if self.inspect(manifest.report_object.digest).ref != manifest.report_object:
            raise IntegrityError("report object reference failed verification")
        dependencies: dict[str, bytes] = {}
        for dependency in manifest.dependencies:
            content = self.get(dependency.object_ref.digest)
            if self.inspect(dependency.object_ref.digest).ref != dependency.object_ref:
                raise IntegrityError("report dependency reference failed verification")
            dependencies[dependency.name] = content
        return ReconstructedReport(manifest, report_content, dependencies)


class S3CompatibleAuditAnchor(_ConditionalPublisher):
    """Immutable, content-free audit receipts stored outside the audit ledger."""

    def __init__(
        self,
        client: ConditionalObjectClient,
        *,
        uri_base: str,
        prefix: str = "",
        clock: Callable[[], datetime] | None = None,
        predecessor: Callable[[AuditCheckpoint], AnchorReceipt | None] | None = None,
    ) -> None:
        super().__init__(client, prefix=prefix)
        self._uri_base = uri_base.rstrip("/")
        if not self._uri_base:
            raise ValueError("uri_base is required")
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._predecessor = predecessor

    def _now(self) -> datetime:
        value = self._clock()
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("clock must return a timezone-aware datetime")
        return value

    def _receipt_key(self, checkpoint: AuditCheckpoint) -> str:
        stream = _safe_key(checkpoint.stream_key, "stream_key")
        checkpoint_id = _safe_key(checkpoint.checkpoint_id, "checkpoint_id")
        if "/" in checkpoint_id:
            raise UnsafeKey("checkpoint_id must be one safe key segment")
        return self._key(
            f"audit-anchors/{stream}/"
            f"{checkpoint.through_sequence:020d}-{checkpoint_id}.json"
        )

    def _read_receipt(self, key: str) -> AnchorReceipt:
        try:
            initial = self._client.get(key)
        except ObjectNotFound as exc:
            raise IntegrityError("audit receipt is missing") from exc
        content, head = self._verified_bytes(
            key,
            expected_digest=_sha256(initial),
            expected_metadata={"napp-contract": _RECEIPT_CONTRACT},
        )
        payload = _parse_json(content, "audit receipt")
        try:
            supplied_hash = payload.pop("receipt_hash")
            if (
                payload.get("contract") != _RECEIPT_CONTRACT
                or _sha256(_canonical_json(payload)) != supplied_hash
                or head.metadata.get("napp-receipt-hash") != supplied_hash
            ):
                raise IntegrityError("audit receipt hash failed verification")
            checkpoint = AuditCheckpoint(
                checkpoint_id=payload["checkpoint_id"],
                stream_key=payload["stream_key"],
                through_sequence=payload["through_sequence"],
                chain_hash=payload["chain_hash"],
                created_at=_parse_time(
                    payload["checkpoint_created_at"],
                    "audit checkpoint created_at",
                ),
            )
            return AnchorReceipt(
                checkpoint=checkpoint,
                anchored_at=_parse_time(payload["anchored_at"], "anchored_at"),
                previous_receipt_hash=payload["previous_receipt_hash"],
                receipt_hash=supplied_hash,
                uri=f"{self._uri_base}/{key}",
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise IntegrityError("audit receipt fields are invalid") from exc

    def anchor(self, checkpoint: AuditCheckpoint) -> AnchorReceipt:
        key = self._receipt_key(checkpoint)
        try:
            existing = self._read_receipt(key)
        except IntegrityError as exc:
            try:
                self._client.head(key)
            except ObjectNotFound:
                existing = None
            else:
                raise exc
        if existing is not None:
            if existing.checkpoint != checkpoint:
                raise ImmutableConflict(
                    "checkpoint id and sequence already anchor different values"
                )
            return existing

        previous = self._predecessor(checkpoint) if self._predecessor else None
        if previous is not None and (
            previous.checkpoint.stream_key != checkpoint.stream_key
            or previous.checkpoint.through_sequence >= checkpoint.through_sequence
        ):
            raise ImmutableConflict("audit receipt predecessor is invalid")
        anchored_at = self._now()
        unsigned = {
            "contract": _RECEIPT_CONTRACT,
            "checkpoint_id": checkpoint.checkpoint_id,
            "stream_key": checkpoint.stream_key,
            "through_sequence": checkpoint.through_sequence,
            "chain_hash": checkpoint.chain_hash,
            "checkpoint_created_at": checkpoint.created_at.isoformat(),
            "anchored_at": anchored_at.isoformat(),
            "previous_receipt_hash": (
                previous.receipt_hash if previous is not None else None
            ),
        }
        receipt_hash = _sha256(_canonical_json(unsigned))
        payload = {**unsigned, "receipt_hash": receipt_hash}
        content = _canonical_json(payload)
        created = self._create(
            key,
            content,
            metadata={
                "napp-contract": _RECEIPT_CONTRACT,
                "napp-receipt-hash": receipt_hash,
            },
        )
        receipt = self._read_receipt(key)
        if not created and receipt.checkpoint != checkpoint:
            raise ImmutableConflict("audit receipt cannot be overwritten")
        return receipt

    def verify(
        self,
        receipt: AnchorReceipt,
        *,
        expected_chain_hash: str | None = None,
    ) -> bool:
        if expected_chain_hash is not None:
            validate_digest(expected_chain_hash, "expected_chain_hash")
            if receipt.checkpoint.chain_hash != expected_chain_hash:
                raise IntegrityError("anchored audit chain hash does not match expected")
        stored = self._read_receipt(self._receipt_key(receipt.checkpoint))
        if stored != receipt:
            raise IntegrityError("provided receipt differs from stored receipt")
        return True
