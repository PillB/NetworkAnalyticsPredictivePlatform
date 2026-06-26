from __future__ import annotations

import json
import unittest

from apps.api.demo_bundle import (
    build_harbor_lantern_workbench,
    harbor_lantern_training_authorization,
)


class DemoBundleTests(unittest.TestCase):
    def authorization(self, fields=("device_signature", "precise_location")):
        return harbor_lantern_training_authorization(
            actor_id="analyst-training-1",
            purpose="training",
            authorization_id="grant-training-1",
            allowed_fields=fields,
        )

    def test_full_workbench_is_authorized_versioned_and_reconstructable(self) -> None:
        payload = build_harbor_lantern_workbench(self.authorization()).to_dict()

        json.dumps(payload)
        self.assertEqual(payload["contract"], "WorkbenchBootstrapV1")
        self.assertEqual(payload["fixture_schema"], "HarborLanternInterchangeV1")
        self.assertEqual(payload["fixture_version"], "1.0.0")
        self.assertEqual(len(payload["relationships"]), 6)
        self.assertEqual(payload["excluded_relationship_count"], 0)
        self.assertEqual(len(payload["prioritization"]), 7)
        self.assertTrue(
            all(
                item["item_type"] in {"relationship_review", "evidence_gap"}
                for item in payload["prioritization"]
            )
        )
        self.assertTrue(
            all(
                item["assessment"]["is_guilt_or_criminality_score"] is False
                for item in payload["prioritization"]
            )
        )
        self.assertTrue(
            any(
                item["assessment"]["status"] == "abstained"
                for item in payload["prioritization"]
            )
        )
        self.assertEqual(
            payload["authorization_digest"],
            payload["after_projection"]["authorization_digest"],
        )
        self.assertEqual(
            set(payload["report"]["assertion_revision_ids"]),
            set(payload["report"]["provenance"]["assertion_revision_ids"]),
        )

    def test_field_restrictions_change_topology_before_analytics(self) -> None:
        payload = build_harbor_lantern_workbench(
            self.authorization(fields=())
        ).to_dict()
        ids = {relationship["id"] for relationship in payload["relationships"]}
        node_ids = {node["id"] for node in payload["nodes"]}

        self.assertEqual(ids, {"r1", "r2", "r3", "r4"})
        self.assertNotIn("device", node_ids)
        self.assertEqual(payload["excluded_relationship_count"], 2)
        self.assertEqual(len(payload["prioritization"]), 5)
        self.assertTrue(
            all(
                "hl-device-association-r1"
                not in item["assessment"]["dependencies"]
                for item in payload["prioritization"]
            )
        )
        self.assertNotIn(
            "hl-device-association-r1",
            payload["lineage"]["assertion_revision_ids"],
        )
        self.assertNotIn(
            "hl-device-location-r1",
            payload["lineage"]["assertion_revision_ids"],
        )

    def test_bundle_is_byte_deterministic_for_same_context(self) -> None:
        first = build_harbor_lantern_workbench(self.authorization()).to_dict()
        second = build_harbor_lantern_workbench(self.authorization()).to_dict()

        self.assertEqual(
            json.dumps(first, sort_keys=True, separators=(",", ":")),
            json.dumps(second, sort_keys=True, separators=(",", ":")),
        )


if __name__ == "__main__":
    unittest.main()
