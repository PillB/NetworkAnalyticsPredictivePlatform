"""Deterministic dynamic-community lineage reconstruction."""

from .model import (
    CandidateLink,
    CommunityInput,
    CommunityObservation,
    CommunitySnapshot,
    EventType,
    LineageEvent,
    LineageIdentity,
    LineageResult,
    MatchConfig,
)
from .tracker import build_lineage, jaccard_score, overlap_score, snapshot_observations

__all__ = [
    "CandidateLink",
    "CommunityInput",
    "CommunityObservation",
    "CommunitySnapshot",
    "EventType",
    "LineageEvent",
    "LineageIdentity",
    "LineageResult",
    "MatchConfig",
    "build_lineage",
    "jaccard_score",
    "overlap_score",
    "snapshot_observations",
]

