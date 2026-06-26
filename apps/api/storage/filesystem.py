"""Filesystem reference adapters for immutable objects, reports, and anchors."""

from __future__ import annotations

import hashlib
import json
import os
import re
import shutil
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Mapping
from uuid import uuid4

from .models import (
    AnchorReceipt,
    AuditCheckpoint,
    ObjectRef,
    ReconstructedReport,
    ReportDependency,
    ReportManifest,
    RetentionMarker,
    StoredObject,
    validate_digest,
)


class StorageError(ValueError):
    """Base error for invalid or unverifiable storage operations."""


class DigestMismatch(StorageError):
    pass


class IntegrityError(StorageError):
    pass


class UnsafeKey(StorageError):
    pass


class ImmutableConflict(StorageError):
    pass


_KEY_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$")


def _safe_segments(key: str) -> tuple[str, ...]:
    if not isinstance(key, str) or not key or "\\" in key or "\x00" in key:
        raise UnsafeKey("storage key is empty or contains an unsafe character")
    if key.startswith("/") or key.endswith("/"):
        raise UnsafeKey("storage key must be relative and cannot end with '/'")
    segments = tuple(key.split("/"))
    if any(
        segment in ("", ".", "..") or _KEY_SEGMENT.fullmatch(segment) is None
        for segment in segments
    ):
        raise UnsafeKey("storage key contains an unsafe path segment")
    return segments


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


def _safe_join(base: Path, segments: tuple[str, ...]) -> Path:
    target = base.joinpath(*segments)
    resolved_base = base.resolve()
    try:
        target.resolve(strict=False).relative_to(resolved_base)
    except ValueError as exc:
        raise UnsafeKey("storage key escapes the configured root") from exc
    return target


def _parse_time(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None or parsed.utcoffset() is None:
        raise IntegrityError("stored timestamp is not timezone-aware")
    return parsed


def _fsync_file(path: Path) -> None:
    with path.open("rb") as handle:
        os.fsync(handle.fileno())


def _fsync_directory(path: Path) -> None:
    descriptor = os.open(path, os.O_RDONLY)
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


class FilesystemStorage:
    """Immutable content-addressed object and reconstructable report storage."""

    def __init__(
        self,
        root: str | Path,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.root = Path(root)
        self._clock = clock or (lambda: datetime.now(timezone.utc))
        self._objects = self.root / "objects" / "sha256"
        self._reports = self.root / "reports"
        self._retention = self.root / "retention"
        for directory in (self._objects, self._reports, self._retention):
            directory.mkdir(parents=True, exist_ok=True)

    def _now(self) -> datetime:
        value = self._clock()
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("clock must return a timezone-aware datetime")
        return value

    def _object_dir(self, digest: str) -> Path:
        validate_digest(digest)
        return self._objects / digest[:2] / digest[2:4] / digest

    def _publish_directory(self, target: Path, files: Mapping[str, bytes]) -> bool:
        target.parent.mkdir(parents=True, exist_ok=True)
        temporary = target.parent / f".{target.name}.tmp-{uuid4().hex}"
        temporary.mkdir()
        try:
            for name, content in files.items():
                path = temporary / name
                path.write_bytes(content)
                _fsync_file(path)
            _fsync_directory(temporary)
            try:
                os.rename(temporary, target)
            except OSError:
                if not target.is_dir():
                    raise
                return False
            _fsync_directory(target.parent)
            return True
        finally:
            if temporary.exists():
                shutil.rmtree(temporary)

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
        digest = _sha256(content)
        if expected_digest is not None:
            validate_digest(expected_digest, "expected_digest")
            if digest != expected_digest:
                raise DigestMismatch("content does not match expected SHA-256 digest")
        created_at = self._now()
        unsigned_manifest = {
            "contract": "ContentAddressedObjectV1",
            "digest": digest,
            "size": len(content),
            "media_type": media_type,
            "created_at": created_at.isoformat(),
            "metadata": dict(metadata or {}),
        }
        manifest = {
            **unsigned_manifest,
            "manifest_hash": _sha256(_canonical_json(unsigned_manifest)),
        }
        target = self._object_dir(digest)
        created = self._publish_directory(
            target, {"content": content, "manifest.json": _canonical_json(manifest)}
        )
        stored = self.inspect(digest)
        persisted_content = self.get(digest)
        if persisted_content != content:
            raise IntegrityError("stored content does not match the submitted object")
        requested = StoredObject(
            ref=ObjectRef(digest, len(content), media_type),
            created_at=created_at,
            metadata=metadata or {},
        )
        if not created and (
            stored.ref != requested.ref or dict(stored.metadata) != dict(requested.metadata)
        ):
            raise ImmutableConflict(
                "digest already exists with a different immutable manifest"
            )
        return stored

    def _load_object_manifest(self, digest: str) -> dict[str, Any]:
        target = self._object_dir(digest)
        try:
            raw = (target / "manifest.json").read_bytes()
            manifest = json.loads(raw)
        except (OSError, json.JSONDecodeError) as exc:
            raise IntegrityError("object manifest is missing or invalid") from exc
        if not isinstance(manifest, dict):
            raise IntegrityError("object manifest must be a JSON object")
        try:
            supplied_hash = manifest.pop("manifest_hash")
        except KeyError as exc:
            raise IntegrityError("object manifest hash is missing") from exc
        if (
            manifest.get("contract") != "ContentAddressedObjectV1"
            or _sha256(_canonical_json(manifest)) != supplied_hash
        ):
            raise IntegrityError("object manifest contract is invalid")
        if manifest.get("digest") != digest:
            raise IntegrityError("object manifest digest does not match its path")
        return manifest

    def inspect(self, digest: str) -> StoredObject:
        manifest = self._load_object_manifest(digest)
        try:
            ref = ObjectRef(
                digest=manifest["digest"],
                size=manifest["size"],
                media_type=manifest["media_type"],
            )
            metadata = manifest["metadata"]
            if not isinstance(metadata, dict):
                raise TypeError
            return StoredObject(
                ref=ref,
                created_at=_parse_time(manifest["created_at"]),
                metadata=metadata,
            )
        except (KeyError, TypeError, ValueError) as exc:
            raise IntegrityError("object manifest fields are invalid") from exc

    def get(self, digest: str) -> bytes:
        stored = self.inspect(digest)
        try:
            content = (self._object_dir(digest) / "content").read_bytes()
        except OSError as exc:
            raise IntegrityError("object content is missing") from exc
        if len(content) != stored.ref.size or _sha256(content) != stored.ref.digest:
            raise IntegrityError("object content failed size or digest verification")
        return content

    def record_retention(
        self,
        object_ref: ObjectRef,
        *,
        marker_id: str,
        disposition: str,
        retain_until: datetime | None = None,
        reason_code: str | None = None,
    ) -> RetentionMarker:
        segments = _safe_segments(marker_id)
        self.get(object_ref.digest)
        marker = RetentionMarker(
            marker_id=marker_id,
            object_digest=object_ref.digest,
            disposition=disposition,
            recorded_at=self._now(),
            retain_until=retain_until,
            reason_code=reason_code,
        )
        payload = self._retention_payload(marker)
        target = _safe_join(self._retention / object_ref.digest, segments)
        created = self._publish_directory(
            target, {"marker.json": _canonical_json(payload)}
        )
        existing = self._read_retention_marker(target)
        if not created and self._retention_identity(existing) != self._retention_identity(
            marker
        ):
            raise ImmutableConflict(
                "retention marker id already exists with different values"
            )
        return existing

    @staticmethod
    def _retention_payload(marker: RetentionMarker) -> dict[str, Any]:
        return {
            "contract": "RetentionMarkerV1",
            "marker_id": marker.marker_id,
            "object_digest": marker.object_digest,
            "disposition": marker.disposition,
            "recorded_at": marker.recorded_at.isoformat(),
            "retain_until": (
                marker.retain_until.isoformat()
                if marker.retain_until is not None
                else None
            ),
            "reason_code": marker.reason_code,
        }

    @staticmethod
    def _retention_identity(marker: RetentionMarker) -> tuple[Any, ...]:
        return (
            marker.marker_id,
            marker.object_digest,
            marker.disposition,
            marker.retain_until,
            marker.reason_code,
        )

    def _read_retention_marker(self, directory: Path) -> RetentionMarker:
        try:
            value = json.loads((directory / "marker.json").read_bytes())
            if value.get("contract") != "RetentionMarkerV1":
                raise ValueError
            retain_until = value["retain_until"]
            return RetentionMarker(
                marker_id=value["marker_id"],
                object_digest=value["object_digest"],
                disposition=value["disposition"],
                recorded_at=_parse_time(value["recorded_at"]),
                retain_until=(
                    _parse_time(retain_until) if retain_until is not None else None
                ),
                reason_code=value["reason_code"],
            )
        except (OSError, json.JSONDecodeError, KeyError, TypeError, ValueError) as exc:
            raise IntegrityError("retention marker is invalid") from exc

    def retention_markers(self, digest: str) -> tuple[RetentionMarker, ...]:
        validate_digest(digest)
        base = self._retention / digest
        if not base.exists():
            return ()
        markers = [
            self._read_retention_marker(path.parent)
            for path in base.rglob("marker.json")
        ]
        return tuple(sorted(markers, key=lambda marker: marker.marker_id))

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
        key_segments = _safe_segments(report_key)
        dependencies = tuple(dependencies)
        names = [dependency.name for dependency in dependencies]
        if len(names) != len(set(names)):
            raise StorageError("report dependency names must be unique")
        for dependency in dependencies:
            self.get(dependency.object_ref.digest)
            if self.inspect(dependency.object_ref.digest).ref != dependency.object_ref:
                raise IntegrityError("dependency reference does not match stored object")
        report_object = self.put(
            content,
            expected_digest=expected_digest,
            media_type=media_type,
            metadata={},
        ).ref
        created_at = self._now()
        identity = {
            "contract": "ReportManifestV1",
            "report_key": report_key,
            "report_object": self._ref_payload(report_object),
            "dependencies": [
                {
                    "name": dependency.name,
                    "role": dependency.role,
                    "object_ref": self._ref_payload(dependency.object_ref),
                }
                for dependency in sorted(dependencies)
            ],
            "metadata": dict(metadata or {}),
        }
        manifest_digest = _sha256(_canonical_json(identity))
        payload = {
            **identity,
            "created_at": created_at.isoformat(),
            "manifest_digest": manifest_digest,
        }
        target = _safe_join(self._reports, key_segments) / manifest_digest
        created = self._publish_directory(
            target, {"manifest.json": _canonical_json(payload)}
        )
        existing = self._read_report_manifest(target, report_key, manifest_digest)
        if not created and self._report_identity(existing) != identity:
            raise ImmutableConflict("report manifest cannot be overwritten")
        return existing

    @staticmethod
    def _ref_payload(ref: ObjectRef) -> dict[str, Any]:
        return {
            "digest": ref.digest,
            "size": ref.size,
            "media_type": ref.media_type,
        }

    def _report_payload(self, manifest: ReportManifest) -> dict[str, Any]:
        return {
            **self._report_identity(manifest),
            "created_at": manifest.created_at.isoformat(),
            "manifest_digest": manifest.manifest_digest,
        }

    def _report_identity(self, manifest: ReportManifest) -> dict[str, Any]:
        return {
            "contract": "ReportManifestV1",
            "report_key": manifest.report_key,
            "report_object": self._ref_payload(manifest.report_object),
            "dependencies": [
                {
                    "name": dependency.name,
                    "role": dependency.role,
                    "object_ref": self._ref_payload(dependency.object_ref),
                }
                for dependency in sorted(manifest.dependencies)
            ],
            "metadata": dict(manifest.metadata),
        }

    @staticmethod
    def _ref_from_payload(value: Mapping[str, Any]) -> ObjectRef:
        return ObjectRef(
            digest=value["digest"],
            size=value["size"],
            media_type=value["media_type"],
        )

    def _read_report_manifest(
        self, directory: Path, report_key: str, manifest_digest: str
    ) -> ReportManifest:
        validate_digest(manifest_digest, "manifest_digest")
        try:
            payload = json.loads((directory / "manifest.json").read_bytes())
            supplied_digest = payload.pop("manifest_digest")
            created_at = payload.pop("created_at")
            if (
                payload.get("contract") != "ReportManifestV1"
                or payload.get("report_key") != report_key
                or supplied_digest != manifest_digest
                or _sha256(_canonical_json(payload)) != manifest_digest
            ):
                raise ValueError
            dependencies = tuple(
                ReportDependency(
                    name=value["name"],
                    role=value["role"],
                    object_ref=self._ref_from_payload(value["object_ref"]),
                )
                for value in payload["dependencies"]
            )
            return ReportManifest(
                report_key=report_key,
                report_object=self._ref_from_payload(payload["report_object"]),
                dependencies=dependencies,
                created_at=_parse_time(created_at),
                manifest_digest=manifest_digest,
                metadata=payload["metadata"],
            )
        except (
            OSError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            raise IntegrityError("report manifest failed verification") from exc

    def get_report(
        self, report_key: str, manifest_digest: str
    ) -> ReconstructedReport:
        directory = (
            _safe_join(self._reports, _safe_segments(report_key)) / manifest_digest
        )
        manifest = self._read_report_manifest(
            directory, report_key, manifest_digest
        )
        content = self.get(manifest.report_object.digest)
        if self.inspect(manifest.report_object.digest).ref != manifest.report_object:
            raise IntegrityError("report object reference failed verification")
        dependency_content: dict[str, bytes] = {}
        for dependency in manifest.dependencies:
            value = self.get(dependency.object_ref.digest)
            if self.inspect(dependency.object_ref.digest).ref != dependency.object_ref:
                raise IntegrityError("report dependency reference failed verification")
            dependency_content[dependency.name] = value
        return ReconstructedReport(manifest, content, dependency_content)


class FilesystemAuditAnchor:
    """Append-only filesystem receipts that chain external audit checkpoints."""

    def __init__(
        self,
        root: str | Path,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self.root = Path(root) / "audit-anchors"
        self.root.mkdir(parents=True, exist_ok=True)
        self._clock = clock or (lambda: datetime.now(timezone.utc))

    def _now(self) -> datetime:
        value = self._clock()
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("clock must return a timezone-aware datetime")
        return value

    def _stream_dir(self, stream_key: str) -> Path:
        return _safe_join(self.root, _safe_segments(stream_key))

    @staticmethod
    def _receipt_hash(payload: Mapping[str, Any]) -> str:
        return _sha256(_canonical_json(payload))

    def _receipt_payload(
        self,
        checkpoint: AuditCheckpoint,
        anchored_at: datetime,
        previous_receipt_hash: str | None,
    ) -> dict[str, Any]:
        return {
            "contract": "AuditAnchorReceiptV1",
            "checkpoint_id": checkpoint.checkpoint_id,
            "stream_key": checkpoint.stream_key,
            "through_sequence": checkpoint.through_sequence,
            "chain_hash": checkpoint.chain_hash,
            "checkpoint_created_at": checkpoint.created_at.isoformat(),
            "anchored_at": anchored_at.isoformat(),
            "previous_receipt_hash": previous_receipt_hash,
        }

    def _receipt_dirs(self, stream_key: str) -> list[Path]:
        stream = self._stream_dir(stream_key)
        if not stream.exists():
            return []
        return sorted(
            (
                path
                for path in stream.iterdir()
                if path.is_dir() and not path.name.startswith(".")
            ),
            key=lambda path: int(path.name.split("-", 1)[0]),
        )

    def anchor(self, checkpoint: AuditCheckpoint) -> AnchorReceipt:
        stream = self._stream_dir(checkpoint.stream_key)
        checkpoint_segment = _safe_segments(checkpoint.checkpoint_id)
        if len(checkpoint_segment) != 1:
            raise UnsafeKey("checkpoint_id must be a single safe path segment")
        for directory in self._receipt_dirs(checkpoint.stream_key):
            existing = self._read_receipt(directory)
            if existing.checkpoint.checkpoint_id == checkpoint.checkpoint_id:
                if existing.checkpoint != checkpoint:
                    raise ImmutableConflict(
                        "checkpoint id already anchored with different values"
                    )
                return existing
        receipts = self._receipt_dirs(checkpoint.stream_key)
        previous = self._read_receipt(receipts[-1]) if receipts else None
        if (
            previous is not None
            and checkpoint.through_sequence <= previous.checkpoint.through_sequence
        ):
            raise ImmutableConflict("audit checkpoint sequence must advance")
        anchored_at = self._now()
        unsigned = self._receipt_payload(
            checkpoint,
            anchored_at,
            previous.receipt_hash if previous is not None else None,
        )
        receipt_hash = self._receipt_hash(unsigned)
        payload = {**unsigned, "receipt_hash": receipt_hash}
        name = f"{checkpoint.through_sequence:020d}-{checkpoint.checkpoint_id}"
        target = stream / name
        storage = FilesystemStorage.__new__(FilesystemStorage)
        created = storage._publish_directory(
            target, {"receipt.json": _canonical_json(payload)}
        )
        receipt = self._read_receipt(target)
        if not created and receipt.checkpoint != checkpoint:
            raise ImmutableConflict("audit receipt cannot be overwritten")
        return receipt

    def _read_receipt(self, directory: Path) -> AnchorReceipt:
        try:
            payload = json.loads((directory / "receipt.json").read_bytes())
            supplied_hash = payload.pop("receipt_hash")
            if (
                payload.get("contract") != "AuditAnchorReceiptV1"
                or self._receipt_hash(payload) != supplied_hash
            ):
                raise ValueError
            checkpoint = AuditCheckpoint(
                checkpoint_id=payload["checkpoint_id"],
                stream_key=payload["stream_key"],
                through_sequence=payload["through_sequence"],
                chain_hash=payload["chain_hash"],
                created_at=_parse_time(payload["checkpoint_created_at"]),
            )
            return AnchorReceipt(
                checkpoint=checkpoint,
                anchored_at=_parse_time(payload["anchored_at"]),
                previous_receipt_hash=payload["previous_receipt_hash"],
                receipt_hash=supplied_hash,
                uri=directory.resolve().as_uri(),
            )
        except (
            OSError,
            json.JSONDecodeError,
            KeyError,
            TypeError,
            ValueError,
        ) as exc:
            raise IntegrityError("audit anchor receipt failed verification") from exc

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
        receipts = self._receipt_dirs(receipt.checkpoint.stream_key)
        previous_hash: str | None = None
        found = False
        last_sequence = -1
        for directory in receipts:
            current = self._read_receipt(directory)
            if current.checkpoint.through_sequence <= last_sequence:
                raise IntegrityError("audit anchor sequence did not advance")
            if current.previous_receipt_hash != previous_hash:
                raise IntegrityError("audit anchor receipt chain is broken")
            if current.receipt_hash == receipt.receipt_hash:
                if current != receipt:
                    raise IntegrityError("provided receipt differs from stored receipt")
                found = True
            previous_hash = current.receipt_hash
            last_sequence = current.checkpoint.through_sequence
        if not found:
            raise IntegrityError("audit anchor receipt is not present")
        return True
