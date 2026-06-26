from __future__ import annotations

import hashlib
import json
import os
import tempfile
import unittest
from datetime import datetime, timedelta, timezone
from pathlib import Path
from unittest.mock import patch

from apps.api.storage import (
    AuditCheckpoint,
    DigestMismatch,
    FilesystemAuditAnchor,
    FilesystemStorage,
    ImmutableConflict,
    IntegrityError,
    ReportDependency,
    UnsafeKey,
)


UTC = timezone.utc


class Clock:
    def __init__(self) -> None:
        self.value = datetime(2026, 6, 25, 12, tzinfo=UTC)

    def __call__(self) -> datetime:
        current = self.value
        self.value += timedelta(seconds=1)
        return current


def digest(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


class FilesystemStorageTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.clock = Clock()
        self.storage = FilesystemStorage(self.root, clock=self.clock)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def test_put_verifies_digest_and_is_idempotent_without_overwrite(self) -> None:
        content = b"immutable source"
        first = self.storage.put(
            content,
            expected_digest=digest(content),
            media_type="text/plain",
            metadata={"classification": "restricted"},
        )
        repeated = self.storage.put(
            content,
            expected_digest=digest(content),
            media_type="text/plain",
            metadata={"classification": "restricted"},
        )

        self.assertEqual(first, repeated)
        self.assertEqual(content, self.storage.get(first.ref.digest))
        with self.assertRaises(DigestMismatch):
            self.storage.put(content, expected_digest="0" * 64)
        with self.assertRaises(ImmutableConflict):
            self.storage.put(content, media_type="application/json")

    def test_read_detects_content_and_manifest_tampering(self) -> None:
        stored = self.storage.put(b"sensitive bytes")
        directory = (
            self.root
            / "objects"
            / "sha256"
            / stored.ref.digest[:2]
            / stored.ref.digest[2:4]
            / stored.ref.digest
        )
        (directory / "content").write_bytes(b"tampered")
        with self.assertRaises(IntegrityError):
            self.storage.get(stored.ref.digest)

        other = self.storage.put(b"another object")
        other_directory = (
            self.root
            / "objects"
            / "sha256"
            / other.ref.digest[:2]
            / other.ref.digest[2:4]
            / other.ref.digest
        )
        manifest = json.loads((other_directory / "manifest.json").read_text())
        manifest["size"] += 1
        (other_directory / "manifest.json").write_text(json.dumps(manifest))
        with self.assertRaises(IntegrityError):
            self.storage.get(other.ref.digest)

    def test_failed_atomic_rename_leaves_no_visible_object_or_temp_directory(
        self,
    ) -> None:
        content = b"never partially visible"
        object_digest = digest(content)
        with patch("apps.api.storage.filesystem.os.rename", side_effect=OSError("boom")):
            with self.assertRaises(OSError):
                self.storage.put(content)

        target = (
            self.root
            / "objects"
            / "sha256"
            / object_digest[:2]
            / object_digest[2:4]
            / object_digest
        )
        self.assertFalse(target.exists())
        self.assertEqual([], list(target.parent.glob(".*.tmp-*")))

    def test_traversal_and_unsafe_keys_are_rejected(self) -> None:
        source = self.storage.put(b"dependency")
        dependency = ReportDependency("source", source.ref)
        for key in ("../escape", "/absolute", "a//b", "a/./b", r"a\..\b"):
            with self.subTest(key=key):
                with self.assertRaises(UnsafeKey):
                    self.storage.put_report(
                        key, b"report", dependencies=(dependency,)
                    )
        with self.assertRaises(UnsafeKey):
            self.storage.record_retention(
                source.ref,
                marker_id="../../marker",
                disposition="retain",
            )

    def test_symlinked_key_parent_cannot_escape_configured_root(self) -> None:
        outside = self.root / "outside"
        outside.mkdir()
        os.symlink(outside, self.root / "reports" / "linked")
        source = self.storage.put(b"dependency")

        with self.assertRaises(UnsafeKey):
            self.storage.put_report(
                "linked/escape",
                b"report",
                dependencies=(ReportDependency("source", source.ref),),
            )
        self.assertEqual([], list(outside.iterdir()))

    def test_report_reconstructs_exact_content_and_dependencies(self) -> None:
        graph = self.storage.put(b'{"nodes":[1,2]}', media_type="application/json")
        method = self.storage.put(b"recipe-v4", media_type="text/plain")
        dependencies = (
            ReportDependency("authorized-graph", graph.ref, "evidence"),
            ReportDependency("analysis-recipe", method.ref, "method"),
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
                "analysis-recipe": b"recipe-v4",
            },
            dict(reconstructed.dependencies),
        )

    def test_report_manifest_or_dependency_tampering_is_detected(self) -> None:
        source = self.storage.put(b"source")
        manifest = self.storage.put_report(
            "reports/one",
            b"report",
            dependencies=(ReportDependency("source", source.ref),),
        )
        report_path = (
            self.root
            / "reports"
            / "reports"
            / "one"
            / manifest.manifest_digest
            / "manifest.json"
        )
        payload = json.loads(report_path.read_text())
        payload["metadata"]["altered"] = True
        report_path.write_text(json.dumps(payload))
        with self.assertRaises(IntegrityError):
            self.storage.get_report(
                manifest.report_key, manifest.manifest_digest
            )

    def test_retention_markers_are_append_only_and_do_not_delete_content(
        self,
    ) -> None:
        stored = self.storage.put(b"must remain available")
        retain_until = datetime(2031, 1, 1, tzinfo=UTC)
        first = self.storage.record_retention(
            stored.ref,
            marker_id="review-2030",
            disposition="retain",
            retain_until=retain_until,
            reason_code="policy",
        )
        repeated = self.storage.record_retention(
            stored.ref,
            marker_id="review-2030",
            disposition="retain",
            retain_until=retain_until,
            reason_code="policy",
        )

        self.assertEqual(first, repeated)
        self.assertEqual((first,), self.storage.retention_markers(stored.ref.digest))
        self.assertEqual(b"must remain available", self.storage.get(stored.ref.digest))
        with self.assertRaises(ImmutableConflict):
            self.storage.record_retention(
                stored.ref,
                marker_id="review-2030",
                disposition="eligible_for_review",
            )


class FilesystemAuditAnchorTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.clock = Clock()
        self.anchor = FilesystemAuditAnchor(self.root, clock=self.clock)

    def tearDown(self) -> None:
        self.temporary.cleanup()

    def checkpoint(
        self, checkpoint_id: str, sequence: int, chain_hash: str
    ) -> AuditCheckpoint:
        return AuditCheckpoint(
            checkpoint_id=checkpoint_id,
            stream_key="case-opaque-7",
            through_sequence=sequence,
            chain_hash=chain_hash,
            created_at=datetime(2026, 6, 25, 11, tzinfo=UTC),
        )

    def test_receipts_are_idempotent_chained_and_verifiable(self) -> None:
        first_checkpoint = self.checkpoint("cp-1", 10, digest(b"audit-10"))
        first = self.anchor.anchor(first_checkpoint)
        repeated = self.anchor.anchor(first_checkpoint)
        second = self.anchor.anchor(
            self.checkpoint("cp-2", 20, digest(b"audit-20"))
        )

        self.assertEqual(first, repeated)
        self.assertEqual(first.receipt_hash, second.previous_receipt_hash)
        self.assertTrue(
            self.anchor.verify(first, expected_chain_hash=digest(b"audit-10"))
        )
        self.assertTrue(
            self.anchor.verify(second, expected_chain_hash=digest(b"audit-20"))
        )

    def test_receipt_tampering_wrong_chain_hash_and_regression_are_rejected(
        self,
    ) -> None:
        first = self.anchor.anchor(
            self.checkpoint("cp-1", 10, digest(b"audit-10"))
        )
        with self.assertRaises(IntegrityError):
            self.anchor.verify(first, expected_chain_hash=digest(b"wrong"))
        with self.assertRaises(ImmutableConflict):
            self.anchor.anchor(
                self.checkpoint("cp-old", 9, digest(b"audit-9"))
            )

        receipt_path = Path(first.uri.removeprefix("file://")) / "receipt.json"
        payload = json.loads(receipt_path.read_text())
        payload["through_sequence"] = 11
        receipt_path.write_text(json.dumps(payload))
        with self.assertRaises(IntegrityError):
            self.anchor.verify(first)

    def test_receipt_contains_no_raw_case_content_or_freeform_metadata(self) -> None:
        receipt = self.anchor.anchor(
            self.checkpoint("cp-safe", 3, digest(b"ledger state"))
        )
        receipt_path = Path(receipt.uri.removeprefix("file://")) / "receipt.json"
        payload = json.loads(receipt_path.read_text())

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

    def test_anchor_keys_reject_traversal(self) -> None:
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
        with self.assertRaises(UnsafeKey):
            self.anchor.anchor(
                AuditCheckpoint(
                    checkpoint_id="cp",
                    stream_key="../../case",
                    through_sequence=1,
                    chain_hash=digest(b"one"),
                    created_at=datetime(2026, 6, 25, tzinfo=UTC),
                )
            )


if __name__ == "__main__":
    unittest.main()
