from __future__ import annotations

import hashlib
import json
import unittest
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Mapping

from apps.api.storage import (
    AuditCheckpoint,
    ConditionalWriteUnsupported,
    DigestMismatch,
    ImmutableConflict,
    IntegrityError,
    ObjectNotFound,
    RemoteObjectHead,
    ReportDependency,
    S3CompatibleAuditAnchor,
    S3CompatibleStorage,
    StorageError,
    UnsafeKey,
)


UTC = timezone.utc


def digest(content: bytes) -> str:
    return hashlib.sha256(content).hexdigest()


class Clock:
    def __init__(self) -> None:
        self.value = datetime(2026, 6, 25, 12, tzinfo=UTC)

    def __call__(self) -> datetime:
        current = self.value
        self.value += timedelta(seconds=1)
        return current


@dataclass
class RemoteValue:
    content: bytes
    checksum: str | None
    metadata: dict[str, str]


class MemoryObjectClient:
    def __init__(self, *, conditional: bool = True) -> None:
        self.conditional_create_supported = conditional
        self.objects: dict[str, RemoteValue] = {}
        self.create_result_override: object | None = None

    def create_if_absent(
        self,
        key: str,
        content: bytes,
        *,
        checksum_sha256: str,
        metadata: Mapping[str, str],
    ) -> bool:
        if not self.conditional_create_supported:
            raise ConditionalWriteUnsupported("unsupported")
        if self.create_result_override is not None:
            return self.create_result_override  # type: ignore[return-value]
        if key in self.objects:
            return False
        self.objects[key] = RemoteValue(
            bytes(content), checksum_sha256, dict(metadata)
        )
        return True

    def get(self, key: str) -> bytes:
        try:
            return self.objects[key].content
        except KeyError as exc:
            raise ObjectNotFound(key) from exc

    def head(self, key: str) -> RemoteObjectHead:
        try:
            value = self.objects[key]
        except KeyError as exc:
            raise ObjectNotFound(key) from exc
        return RemoteObjectHead(
            size=len(value.content),
            checksum_sha256=value.checksum,
            metadata=value.metadata,
        )


class S3CompatibleStorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = MemoryObjectClient()
        self.clock = Clock()
        self.storage = S3CompatibleStorage(
            self.client, prefix="tenant-a", clock=self.clock
        )

    def object_key(self, content: bytes) -> str:
        value = digest(content)
        return (
            f"tenant-a/objects/sha256/{value[:2]}/{value[2:4]}/{value}"
        )

    def test_requires_unambiguous_conditional_create_support(self) -> None:
        unsupported = S3CompatibleStorage(
            MemoryObjectClient(conditional=False), clock=self.clock
        )
        with self.assertRaises(ConditionalWriteUnsupported):
            unsupported.put(b"never published")

        self.client.create_result_override = "created"
        with self.assertRaises(ConditionalWriteUnsupported):
            self.storage.put(b"ambiguous result")

    def test_put_is_verified_idempotent_and_never_overwrites(self) -> None:
        content = b"immutable evidence"
        first = self.storage.put(
            content,
            expected_digest=digest(content),
            media_type="application/evidence",
            metadata={"classification": "restricted", "schema": 3},
        )
        repeated = self.storage.put(
            content,
            expected_digest=digest(content),
            media_type="application/evidence",
            metadata={"classification": "restricted", "schema": 3},
        )

        self.assertEqual(first, repeated)
        self.assertEqual(content, self.storage.get(first.ref.digest))
        self.assertEqual(1, len(self.client.objects))
        with self.assertRaises(DigestMismatch):
            self.storage.put(content, expected_digest="0" * 64)
        with self.assertRaises(ImmutableConflict):
            self.storage.put(content, media_type="application/json")

    def test_reads_fail_closed_on_checksum_content_or_metadata_mismatch(self) -> None:
        stored = self.storage.put(b"verified")
        key = self.object_key(b"verified")

        self.client.objects[key].checksum = None
        with self.assertRaises(IntegrityError):
            self.storage.get(stored.ref.digest)

        self.client.objects[key].checksum = stored.ref.digest
        self.client.objects[key].content = b"tampered"
        with self.assertRaises(IntegrityError):
            self.storage.get(stored.ref.digest)

        self.client.objects[key].content = b"verified"
        self.client.objects[key].metadata["napp-contract"] = "WrongContract"
        with self.assertRaises(IntegrityError):
            self.storage.inspect(stored.ref.digest)

    def test_invalid_application_metadata_is_rejected_before_publication(self) -> None:
        with self.assertRaises(StorageError):
            self.storage.put(b"value", metadata={"invalid": {1, 2}})
        self.assertEqual({}, self.client.objects)

    def test_report_manifest_is_immutable_and_reconstructs_exact_dependencies(
        self,
    ) -> None:
        graph = self.storage.put(b'{"nodes":[1,2]}', media_type="application/json")
        method = self.storage.put(b"method-v4", media_type="text/plain")
        dependencies = (
            ReportDependency("authorized-graph", graph.ref, "evidence"),
            ReportDependency("analysis-method", method.ref, "method"),
        )
        manifest = self.storage.put_report(
            "case-opaque-7/reports/briefing",
            b"<html>report</html>",
            dependencies=dependencies,
            media_type="text/html",
            metadata={"schema": "ReportV1"},
        )
        repeated = self.storage.put_report(
            "case-opaque-7/reports/briefing",
            b"<html>report</html>",
            dependencies=dependencies,
            media_type="text/html",
            metadata={"schema": "ReportV1"},
        )
        reconstructed = self.storage.get_report(
            manifest.report_key, manifest.manifest_digest
        )

        self.assertEqual(manifest, repeated)
        self.assertEqual(b"<html>report</html>", reconstructed.content)
        self.assertEqual(
            {
                "authorized-graph": b'{"nodes":[1,2]}',
                "analysis-method": b"method-v4",
            },
            dict(reconstructed.dependencies),
        )
        manifest_keys = [
            key for key in self.client.objects if key.startswith("tenant-a/reports/")
        ]
        self.assertEqual(1, len(manifest_keys))

    def test_report_tampering_missing_dependencies_and_unsafe_keys_fail_closed(
        self,
    ) -> None:
        source = self.storage.put(b"source")
        with self.assertRaises(UnsafeKey):
            self.storage.put_report(
                "../escape",
                b"report",
                dependencies=(ReportDependency("source", source.ref),),
            )

        unknown_ref = type(source.ref)(
            digest=digest(b"missing"),
            size=7,
            media_type="application/octet-stream",
        )
        with self.assertRaises(IntegrityError):
            self.storage.put_report(
                "reports/missing",
                b"report",
                dependencies=(ReportDependency("source", unknown_ref),),
            )

        manifest = self.storage.put_report(
            "reports/one",
            b"report",
            dependencies=(ReportDependency("source", source.ref),),
        )
        key = next(
            key
            for key in self.client.objects
            if key.startswith("tenant-a/reports/reports/one/")
        )
        self.client.objects[key].content = b'{"tampered":true}'
        with self.assertRaises(IntegrityError):
            self.storage.get_report(
                manifest.report_key, manifest.manifest_digest
            )


class S3CompatibleAuditAnchorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = MemoryObjectClient()
        self.clock = Clock()
        self.receipts = []

        def predecessor(checkpoint: AuditCheckpoint):
            candidates = [
                receipt
                for receipt in self.receipts
                if receipt.checkpoint.stream_key == checkpoint.stream_key
            ]
            return candidates[-1] if candidates else None

        self.anchor = S3CompatibleAuditAnchor(
            self.client,
            uri_base="s3://audit-bucket",
            prefix="production",
            clock=self.clock,
            predecessor=predecessor,
        )

    @staticmethod
    def checkpoint(
        checkpoint_id: str, sequence: int, chain_hash: str
    ) -> AuditCheckpoint:
        return AuditCheckpoint(
            checkpoint_id=checkpoint_id,
            stream_key="case-opaque-7",
            through_sequence=sequence,
            chain_hash=chain_hash,
            created_at=datetime(2026, 6, 25, 11, tzinfo=UTC),
        )

    def test_receipts_are_content_free_idempotent_chained_and_verifiable(
        self,
    ) -> None:
        first_checkpoint = self.checkpoint("cp-1", 10, digest(b"audit-10"))
        first = self.anchor.anchor(first_checkpoint)
        self.receipts.append(first)
        repeated = self.anchor.anchor(first_checkpoint)
        second = self.anchor.anchor(
            self.checkpoint("cp-2", 20, digest(b"audit-20"))
        )
        self.receipts.append(second)

        self.assertEqual(first, repeated)
        self.assertEqual(first.receipt_hash, second.previous_receipt_hash)
        self.assertTrue(
            self.anchor.verify(first, expected_chain_hash=digest(b"audit-10"))
        )
        self.assertTrue(self.anchor.verify(second))
        second_key = next(
            key for key in self.client.objects if key.endswith("-cp-2.json")
        )
        payload = json.loads(self.client.objects[second_key].content)
        self.assertEqual(
            {
                "anchored_at",
                "chain_hash",
                "checkpoint_created_at",
                "checkpoint_id",
                "contract",
                "previous_receipt_hash",
                "receipt_hash",
                "stream_key",
                "through_sequence",
            },
            set(payload),
        )
        self.assertNotIn("content", payload)
        self.assertNotIn("metadata", payload)

    def test_receipt_tampering_wrong_chain_and_bad_predecessor_fail_closed(
        self,
    ) -> None:
        receipt = self.anchor.anchor(
            self.checkpoint("cp-1", 10, digest(b"audit-10"))
        )
        self.receipts.append(receipt)
        with self.assertRaises(IntegrityError):
            self.anchor.verify(receipt, expected_chain_hash=digest(b"wrong"))

        key = next(key for key in self.client.objects if key.endswith("-cp-1.json"))
        self.client.objects[key].content = b'{"tampered":true}'
        with self.assertRaises(IntegrityError):
            self.anchor.verify(receipt)

        invalid = S3CompatibleAuditAnchor(
            MemoryObjectClient(),
            uri_base="s3://audit-bucket",
            clock=self.clock,
            predecessor=lambda checkpoint: receipt,
        )
        with self.assertRaises(ImmutableConflict):
            invalid.anchor(
                self.checkpoint("cp-old", 9, digest(b"audit-9"))
            )

    def test_anchor_rejects_unsafe_keys_and_unsupported_conditional_writes(
        self,
    ) -> None:
        with self.assertRaises(UnsafeKey):
            self.anchor.anchor(
                AuditCheckpoint(
                    checkpoint_id="../escape",
                    stream_key="case",
                    through_sequence=1,
                    chain_hash=digest(b"one"),
                    created_at=datetime(2026, 6, 25, tzinfo=UTC),
                )
            )
        unsupported = S3CompatibleAuditAnchor(
            MemoryObjectClient(conditional=False),
            uri_base="s3://audit-bucket",
            clock=self.clock,
        )
        with self.assertRaises(ConditionalWriteUnsupported):
            unsupported.anchor(
                self.checkpoint("cp-unsupported", 1, digest(b"one"))
            )


if __name__ == "__main__":
    unittest.main()
