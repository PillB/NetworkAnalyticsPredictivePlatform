from __future__ import annotations

import unittest
from datetime import datetime

from analytics.lineage import build_lineage
from apps.api.contracts import AuthorizationContext, CaseManifest
from apps.api.service import AnalysisService
from apps.api.temporal import TemporalInterval, TemporalWindowQuery
from apps.api.temporal.fixtures import harbor_lantern_repository


def instant(value: str) -> datetime:
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


class HarborLanternWindowServiceTests(unittest.TestCase):
    def setUp(self) -> None:
        self.service = AnalysisService(harbor_lantern_repository(), build_lineage)
        self.manifest = CaseManifest(
            case_id="harbor-lantern",
            jurisdiction="training",
            owner="platform",
            permissible_purposes=("training",),
            handling_policy_version="policy-v1",
            source_high_water_marks={"fixture": "1.0.0"},
        )
        self.authorization = AuthorizationContext(
            actor_id="training-analyst",
            case_id="harbor-lantern",
            purpose="training",
            authorization_id="training-grant",
            allowed_handling_labels=("training",),
            allowed_fields=("device_signature", "precise_location"),
        )

    def window(self, start: str, end: str) -> TemporalWindowQuery:
        return TemporalWindowQuery(
            valid_during=TemporalInterval(instant(start), instant(end)),
            known_at=instant("2026-03-18T23:59:00Z"),
            case_id="harbor-lantern",
        )

    def test_authorized_before_after_window_projections_match_visible_graph(self) -> None:
        before = self.service.project_window(
            self.manifest,
            self.authorization,
            self.window("2026-01-18T00:00:00Z", "2026-02-17T00:00:00Z"),
        )
        after = self.service.project_window(
            self.manifest,
            self.authorization,
            self.window("2026-02-17T00:00:00Z", "2026-03-19T00:00:00Z"),
        )
        comparison = self.service.compare(before, after)

        self.assertIn("hl-transfer-r1", before.assertion_revision_ids)
        self.assertNotIn("hl-transfer-r1", after.assertion_revision_ids)
        self.assertIn("hl-dock-visit-r1", after.assertion_revision_ids)
        self.assertIn("hl-dock-visit-r1", comparison.added_revision_ids)
        self.assertIn("hl-transfer-r1", comparison.removed_revision_ids)

    def test_window_projection_cache_is_bound_to_temporal_window(self) -> None:
        before = self.service.project_window(
            self.manifest,
            self.authorization,
            self.window("2026-01-18T00:00:00Z", "2026-02-17T00:00:00Z"),
        )
        after = self.service.project_window(
            self.manifest,
            self.authorization,
            self.window("2026-02-17T00:00:00Z", "2026-03-19T00:00:00Z"),
        )

        self.assertNotEqual(before.cache_key, after.cache_key)
        self.assertEqual(before.query["contract"], "TemporalWindowQueryV1")


if __name__ == "__main__":
    unittest.main()
