"""Immutable interchange types for detector-independent community lineage."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Hashable, Mapping


Member = Hashable


class EventType(str, Enum):
    BIRTH = "birth"
    CONTINUATION = "continuation"
    DEATH = "death"
    SPLIT = "split"
    MERGE = "merge"
    RESURGENCE = "resurgence"


@dataclass(frozen=True)
class CommunityInput:
    """One detector-produced community, before lineage identity is assigned."""

    label: Hashable
    members: frozenset[Member]
    confidence: float = 1.0
    metadata: Mapping[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "members", frozenset(self.members))
        object.__setattr__(self, "metadata", dict(self.metadata))
        if not self.members:
            raise ValueError("a community must contain at least one member")
        if not 0.0 <= self.confidence <= 1.0:
            raise ValueError("community confidence must be between 0 and 1")


@dataclass(frozen=True)
class CommunitySnapshot:
    """Communities observed at one ordered point or interval."""

    snapshot_id: Hashable
    communities: tuple[CommunityInput, ...]
    metadata: Mapping[str, object] = field(default_factory=dict)

    def __post_init__(self) -> None:
        object.__setattr__(self, "communities", tuple(self.communities))
        object.__setattr__(self, "metadata", dict(self.metadata))
        labels = [community.label for community in self.communities]
        if len(labels) != len(set(labels)):
            raise ValueError("community labels must be unique within a snapshot")


@dataclass(frozen=True)
class CommunityObservation:
    """Canonical, immutable snapshot input consumed by the matcher."""

    observation_id: str
    snapshot_id: Hashable
    snapshot_index: int
    local_label: Hashable
    members: frozenset[Member]
    confidence: float
    uncertain: bool
    metadata: Mapping[str, object]


@dataclass(frozen=True)
class MatchConfig:
    """Thresholds for deterministic material-link and uncertainty decisions."""

    minimum_jaccard: float = 0.30
    minimum_overlap: float = 0.60
    resurgence_jaccard: float = 0.70
    resurgence_overlap: float = 0.85
    maximum_resurgence_gap: int = 3
    low_confidence_margin: float = 0.08
    input_confidence_threshold: float = 0.70
    jaccard_weight: float = 0.50

    def __post_init__(self) -> None:
        unit_fields = (
            self.minimum_jaccard,
            self.minimum_overlap,
            self.resurgence_jaccard,
            self.resurgence_overlap,
            self.low_confidence_margin,
            self.input_confidence_threshold,
            self.jaccard_weight,
        )
        if any(not 0.0 <= value <= 1.0 for value in unit_fields):
            raise ValueError("score thresholds and weights must be between 0 and 1")
        if self.maximum_resurgence_gap < 1:
            raise ValueError("maximum_resurgence_gap must be at least 1")


@dataclass(frozen=True)
class CandidateLink:
    """A scored possible parent-child relationship."""

    parent_observation_id: str
    child_observation_id: str
    gap: int
    jaccard: float
    overlap: float
    score: float
    accepted: bool
    low_confidence: bool
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class LineageEvent:
    """An explicit lifecycle event in the lineage DAG."""

    event_type: EventType
    snapshot_id: Hashable
    snapshot_index: int
    parent_observation_ids: tuple[str, ...] = ()
    child_observation_ids: tuple[str, ...] = ()
    parent_lineage_ids: tuple[str, ...] = ()
    child_lineage_ids: tuple[str, ...] = ()
    score: float | None = None
    low_confidence: bool = False
    reasons: tuple[str, ...] = ()


@dataclass(frozen=True)
class LineageIdentity:
    """Persistent identity and its ordered observations."""

    lineage_id: str
    observation_ids: tuple[str, ...]


@dataclass(frozen=True)
class LineageResult:
    """Complete deterministic output of one lineage reconstruction."""

    observations: tuple[CommunityObservation, ...]
    candidates: tuple[CandidateLink, ...]
    events: tuple[LineageEvent, ...]
    identities: tuple[LineageIdentity, ...]
    observation_lineages: Mapping[str, str]

