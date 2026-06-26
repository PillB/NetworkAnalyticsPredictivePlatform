"""Harbor Lantern lineage scenarios loaded from the canonical interchange."""

from __future__ import annotations

from typing import Any, Mapping

from apps.api.fixture_loader import load_harbor_lantern_fixture

from .model import CommunityInput, CommunitySnapshot


def _scenario(name: str) -> tuple[CommunitySnapshot, ...]:
    fixture = load_harbor_lantern_fixture()
    snapshots: list[CommunitySnapshot] = []
    for snapshot in fixture["lineageScenarios"][name]:
        communities = tuple(
            CommunityInput(
                community["label"],
                frozenset(community["members"]),
                confidence=float(community.get("confidence", 1.0)),
                metadata=community.get("metadata", {}),
            )
            for community in snapshot["communities"]
        )
        snapshots.append(
            CommunitySnapshot(
                snapshot["snapshotId"],
                communities,
                metadata=snapshot.get("metadata", {}),
            )
        )
    return tuple(snapshots)


def harbor_lantern_split() -> tuple[CommunitySnapshot, ...]:
    return _scenario("split")


def harbor_lantern_merge() -> tuple[CommunitySnapshot, ...]:
    return _scenario("merge")


def harbor_lantern_resurgence_and_birth() -> tuple[CommunitySnapshot, ...]:
    return _scenario("resurgenceAndBirth")

