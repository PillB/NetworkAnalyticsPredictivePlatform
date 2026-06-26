from __future__ import annotations

import unittest
from dataclasses import asdict

from analytics.lineage import (
    CommunityInput,
    CommunitySnapshot,
    EventType,
    MatchConfig,
    build_lineage,
    jaccard_score,
    overlap_score,
)
from analytics.lineage.fixtures import (
    harbor_lantern_merge,
    harbor_lantern_resurgence_and_birth,
    harbor_lantern_split,
)


class ScoreTests(unittest.TestCase):
    def test_jaccard_and_overlap_scores(self) -> None:
        self.assertEqual(jaccard_score({"a", "b"}, {"b", "c"}), 1 / 3)
        self.assertEqual(overlap_score({"a", "b"}, {"b", "c", "d"}), 1 / 2)
        self.assertEqual(jaccard_score(set(), set()), 1.0)


class LineageEventTests(unittest.TestCase):
    def test_birth_continuation_and_death_are_explicit(self) -> None:
        snapshots = (
            CommunitySnapshot(
                "one", (CommunityInput("alpha", frozenset({"a", "b"})),)
            ),
            CommunitySnapshot(
                "two", (CommunityInput("renamed", frozenset({"a", "b", "c"})),)
            ),
            CommunitySnapshot("three", ()),
        )
        result = build_lineage(snapshots)

        self.assertEqual(
            [event.event_type for event in result.events],
            [EventType.BIRTH, EventType.CONTINUATION, EventType.DEATH],
        )
        birth, continuation, death = result.events
        self.assertEqual(birth.child_lineage_ids, continuation.parent_lineage_ids)
        self.assertEqual(continuation.child_lineage_ids, death.parent_lineage_ids)
        self.assertEqual(death.snapshot_id, "three")

    def test_split_creates_new_child_identities(self) -> None:
        result = build_lineage(harbor_lantern_split())
        split = next(event for event in result.events if event.event_type is EventType.SPLIT)

        self.assertEqual(len(split.parent_lineage_ids), 1)
        self.assertEqual(len(split.child_lineage_ids), 2)
        self.assertNotIn(split.parent_lineage_ids[0], split.child_lineage_ids)
        self.assertEqual(len(set(split.child_lineage_ids)), 2)

    def test_merge_creates_identity_distinct_from_all_parents(self) -> None:
        result = build_lineage(harbor_lantern_merge())
        merge = next(event for event in result.events if event.event_type is EventType.MERGE)

        self.assertEqual(len(merge.parent_lineage_ids), 2)
        self.assertEqual(len(merge.child_lineage_ids), 1)
        self.assertNotIn(merge.child_lineage_ids[0], merge.parent_lineage_ids)

    def test_resurgence_reuses_dormant_identity_but_birth_does_not(self) -> None:
        result = build_lineage(harbor_lantern_resurgence_and_birth())
        resurgence = next(
            event for event in result.events if event.event_type is EventType.RESURGENCE
        )
        late_birth = next(
            event
            for event in result.events
            if event.event_type is EventType.BIRTH and event.snapshot_index == 2
        )

        self.assertEqual(resurgence.parent_lineage_ids, resurgence.child_lineage_ids)
        self.assertNotEqual(
            resurgence.child_lineage_ids[0], late_birth.child_lineage_ids[0]
        )
        self.assertIn("observation_gap", resurgence.reasons)

    def test_near_threshold_and_uncertain_input_are_flagged(self) -> None:
        snapshots = (
            CommunitySnapshot(
                "one",
                (CommunityInput("a", frozenset({"a", "b", "c"}), confidence=0.5),),
            ),
            CommunitySnapshot(
                "two",
                (CommunityInput("b", frozenset({"a", "b", "x", "y"})),),
            ),
        )
        result = build_lineage(
            snapshots,
            MatchConfig(minimum_jaccard=0.4, minimum_overlap=0.6),
        )
        continuation = next(
            event
            for event in result.events
            if event.event_type is EventType.CONTINUATION
        )

        self.assertTrue(continuation.low_confidence)
        self.assertIn("uncertain_input", continuation.reasons)
        self.assertIn("near_threshold", continuation.reasons)

    def test_repeatability_and_detector_label_independence(self) -> None:
        original = harbor_lantern_split()
        relabeled = tuple(
            CommunitySnapshot(
                snapshot.snapshot_id,
                tuple(
                    CommunityInput(
                        f"replacement-{index}",
                        community.members,
                        confidence=community.confidence,
                        metadata=community.metadata,
                    )
                    for index, community in enumerate(
                        reversed(snapshot.communities), start=1
                    )
                ),
                metadata=snapshot.metadata,
            )
            for snapshot in original
        )

        first = build_lineage(original)
        second = build_lineage(original)
        relabeled_result = build_lineage(relabeled)

        self.assertEqual(asdict(first), asdict(second))
        self.assertEqual(first.candidates, relabeled_result.candidates)
        self.assertEqual(first.events, relabeled_result.events)
        self.assertEqual(first.identities, relabeled_result.identities)


if __name__ == "__main__":
    unittest.main()
