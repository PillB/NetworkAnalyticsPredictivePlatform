from __future__ import annotations

import unittest
from pathlib import Path
import json

from analytics.lineage.fixtures import harbor_lantern_split
from apps.api.fixture_loader import EXPECTED_SCHEMA, load_harbor_lantern_fixture
from apps.api.temporal.fixtures import harbor_lantern_repository


class SharedFixtureTests(unittest.TestCase):
    def test_fixture_is_versioned_synthetic_and_referentially_valid(self) -> None:
        fixture = load_harbor_lantern_fixture()

        self.assertEqual(EXPECTED_SCHEMA, fixture["schema"])
        self.assertEqual("1.0.0", fixture["fixtureVersion"])
        self.assertTrue(fixture["case"]["synthetic"])
        self.assertEqual(6, len(fixture["nodes"]))
        self.assertEqual(6, len(fixture["relationships"]))

    def test_interchange_schema_declares_closed_versioned_contract(self) -> None:
        schema_path = (
            Path(__file__).resolve().parents[2]
            / "data"
            / "contracts"
            / "harbor-lantern-interchange-v1.schema.json"
        )
        schema = json.loads(schema_path.read_text(encoding="utf-8"))

        self.assertEqual("https://json-schema.org/draft/2020-12/schema", schema["$schema"])
        self.assertFalse(schema["additionalProperties"])
        self.assertEqual(
            "HarborLanternInterchangeV1",
            schema["properties"]["schema"]["const"],
        )

    def test_temporal_repository_consumes_canonical_relationships(self) -> None:
        fixture = load_harbor_lantern_fixture()
        repository = harbor_lantern_repository()
        revision_ids = {revision.revision_id for revision in repository.all_revisions()}

        for relationship in fixture["relationships"]:
            self.assertIn(relationship["revisionId"], revision_ids)
        for revision in fixture["temporalCorrections"]:
            self.assertIn(revision["revisionId"], revision_ids)

    def test_lineage_fixture_consumes_canonical_members(self) -> None:
        fixture = load_harbor_lantern_fixture()
        expected = fixture["lineageScenarios"]["split"]
        snapshots = harbor_lantern_split()

        self.assertEqual(
            [item["snapshotId"] for item in expected],
            [snapshot.snapshot_id for snapshot in snapshots],
        )
        self.assertEqual(
            {
                member
                for item in expected
                for community in item["communities"]
                for member in community["members"]
            },
            {
                member
                for snapshot in snapshots
                for community in snapshot.communities
                for member in community.members
            },
        )


if __name__ == "__main__":
    unittest.main()
