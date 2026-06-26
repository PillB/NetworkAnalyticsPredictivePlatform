"""Deterministic lineage reconstruction over independent community snapshots."""

from __future__ import annotations

from collections import defaultdict
from dataclasses import replace
from typing import Hashable, Iterable

from .model import (
    CandidateLink,
    CommunityObservation,
    CommunitySnapshot,
    EventType,
    LineageEvent,
    LineageIdentity,
    LineageResult,
    MatchConfig,
)


def _stable_key(value: Hashable) -> tuple[str, str]:
    return (type(value).__qualname__, repr(value))


def _member_key(members: frozenset[Hashable]) -> tuple[tuple[str, str], ...]:
    return tuple(sorted((_stable_key(member) for member in members)))


def jaccard_score(left: Iterable[Hashable], right: Iterable[Hashable]) -> float:
    """Return intersection over union, with two empty inputs treated as equal."""

    left_set = frozenset(left)
    right_set = frozenset(right)
    union = left_set | right_set
    return 1.0 if not union else len(left_set & right_set) / len(union)


def overlap_score(left: Iterable[Hashable], right: Iterable[Hashable]) -> float:
    """Return intersection over the smaller input size."""

    left_set = frozenset(left)
    right_set = frozenset(right)
    smaller = min(len(left_set), len(right_set))
    return 1.0 if smaller == 0 and left_set == right_set else (
        0.0 if smaller == 0 else len(left_set & right_set) / smaller
    )


def snapshot_observations(
    snapshots: Iterable[CommunitySnapshot],
    *,
    input_confidence_threshold: float = 0.70,
) -> tuple[CommunityObservation, ...]:
    """Canonicalize arbitrary detector labels into repeatable observations."""

    snapshots_tuple = tuple(snapshots)
    snapshot_ids = [snapshot.snapshot_id for snapshot in snapshots_tuple]
    if len(snapshot_ids) != len(set(snapshot_ids)):
        raise ValueError("snapshot identifiers must be unique")

    observations: list[CommunityObservation] = []
    for snapshot_index, snapshot in enumerate(snapshots_tuple):
        ordered = sorted(
            snapshot.communities,
            key=lambda community: (
                _member_key(community.members),
                _stable_key(community.label),
            ),
        )
        for rank, community in enumerate(ordered, start=1):
            observations.append(
                CommunityObservation(
                    observation_id=f"s{snapshot_index:04d}:c{rank:04d}",
                    snapshot_id=snapshot.snapshot_id,
                    snapshot_index=snapshot_index,
                    local_label=community.label,
                    members=community.members,
                    confidence=community.confidence,
                    uncertain=community.confidence < input_confidence_threshold,
                    metadata=community.metadata,
                )
            )
    return tuple(observations)


def _score(
    parent: CommunityObservation,
    child: CommunityObservation,
    config: MatchConfig,
    *,
    gap: int,
    resurgence: bool,
) -> CandidateLink:
    jaccard = jaccard_score(parent.members, child.members)
    overlap = overlap_score(parent.members, child.members)
    score = config.jaccard_weight * jaccard + (1.0 - config.jaccard_weight) * overlap
    jaccard_threshold = (
        config.resurgence_jaccard if resurgence else config.minimum_jaccard
    )
    overlap_threshold = (
        config.resurgence_overlap if resurgence else config.minimum_overlap
    )
    accepted = jaccard >= jaccard_threshold or overlap >= overlap_threshold
    distance = max(jaccard - jaccard_threshold, overlap - overlap_threshold)
    reasons: list[str] = []
    if parent.uncertain or child.uncertain:
        reasons.append("uncertain_input")
    if accepted and distance < config.low_confidence_margin:
        reasons.append("near_threshold")
    if resurgence:
        reasons.append("observation_gap")
    return CandidateLink(
        parent_observation_id=parent.observation_id,
        child_observation_id=child.observation_id,
        gap=gap,
        jaccard=jaccard,
        overlap=overlap,
        score=score,
        accepted=accepted,
        low_confidence=bool(reasons),
        reasons=tuple(reasons),
    )


def _candidate_sort_key(candidate: CandidateLink) -> tuple[object, ...]:
    return (
        candidate.parent_observation_id,
        candidate.child_observation_id,
        candidate.gap,
    )


def _event_sort_key(event: LineageEvent) -> tuple[object, ...]:
    event_order = {
        EventType.DEATH: 0,
        EventType.BIRTH: 1,
        EventType.RESURGENCE: 2,
        EventType.CONTINUATION: 3,
        EventType.SPLIT: 4,
        EventType.MERGE: 5,
    }
    return (
        event.snapshot_index,
        event_order[event.event_type],
        event.parent_observation_ids,
        event.child_observation_ids,
    )


def build_lineage(
    snapshots: Iterable[CommunitySnapshot],
    config: MatchConfig | None = None,
) -> LineageResult:
    """Build an explicit lineage DAG without invoking community detection."""

    config = config or MatchConfig()
    snapshots_tuple = tuple(snapshots)
    observations = snapshot_observations(
        snapshots_tuple,
        input_confidence_threshold=config.input_confidence_threshold,
    )
    by_snapshot: dict[int, list[CommunityObservation]] = defaultdict(list)
    by_id = {observation.observation_id: observation for observation in observations}
    for observation in observations:
        by_snapshot[observation.snapshot_index].append(observation)

    candidates: list[CandidateLink] = []
    accepted_by_parent: dict[str, list[CandidateLink]] = defaultdict(list)
    accepted_by_child: dict[str, list[CandidateLink]] = defaultdict(list)

    snapshot_count = len(snapshots_tuple)
    for snapshot_index in range(1, snapshot_count):
        for parent in by_snapshot[snapshot_index - 1]:
            for child in by_snapshot[snapshot_index]:
                candidate = _score(parent, child, config, gap=0, resurgence=False)
                candidates.append(candidate)
                if candidate.accepted:
                    accepted_by_parent[parent.observation_id].append(candidate)
                    accepted_by_child[child.observation_id].append(candidate)

    observation_lineages: dict[str, str] = {}
    identity_observations: dict[str, list[str]] = {}
    next_lineage_number = 1

    def new_lineage(observation_id: str) -> str:
        nonlocal next_lineage_number
        lineage_id = f"L{next_lineage_number:04d}"
        next_lineage_number += 1
        observation_lineages[observation_id] = lineage_id
        identity_observations[lineage_id] = [observation_id]
        return lineage_id

    events: list[LineageEvent] = []
    if snapshot_count:
        for observation in by_snapshot[0]:
            lineage_id = new_lineage(observation.observation_id)
            events.append(
                LineageEvent(
                    event_type=EventType.BIRTH,
                    snapshot_id=observation.snapshot_id,
                    snapshot_index=0,
                    child_observation_ids=(observation.observation_id,),
                    child_lineage_ids=(lineage_id,),
                    low_confidence=observation.uncertain,
                    reasons=("uncertain_input",) if observation.uncertain else (),
                )
            )

    terminated_by_branch: set[str] = set()
    dormant_lineages: dict[str, str] = {}

    for snapshot_index in range(1, snapshot_count):
        previous = by_snapshot[snapshot_index - 1]
        current = by_snapshot[snapshot_index]

        for parent in previous:
            children = accepted_by_parent[parent.observation_id]
            if not children:
                lineage_id = observation_lineages[parent.observation_id]
                dormant_lineages[lineage_id] = parent.observation_id
                events.append(
                    LineageEvent(
                        event_type=EventType.DEATH,
                        snapshot_id=snapshots_tuple[snapshot_index].snapshot_id,
                        snapshot_index=snapshot_index,
                        parent_observation_ids=(parent.observation_id,),
                        parent_lineage_ids=(lineage_id,),
                        low_confidence=parent.uncertain,
                        reasons=("uncertain_input",) if parent.uncertain else (),
                    )
                )

        assigned: set[str] = set()
        for child in current:
            parent_links = accepted_by_child[child.observation_id]
            if len(parent_links) == 1:
                parent_link = parent_links[0]
                parent_children = accepted_by_parent[parent_link.parent_observation_id]
                if len(parent_children) == 1:
                    parent_lineage = observation_lineages[
                        parent_link.parent_observation_id
                    ]
                    observation_lineages[child.observation_id] = parent_lineage
                    identity_observations[parent_lineage].append(child.observation_id)
                    dormant_lineages.pop(parent_lineage, None)
                    assigned.add(child.observation_id)
                    events.append(
                        LineageEvent(
                            event_type=EventType.CONTINUATION,
                            snapshot_id=child.snapshot_id,
                            snapshot_index=snapshot_index,
                            parent_observation_ids=(
                                parent_link.parent_observation_id,
                            ),
                            child_observation_ids=(child.observation_id,),
                            parent_lineage_ids=(parent_lineage,),
                            child_lineage_ids=(parent_lineage,),
                            score=parent_link.score,
                            low_confidence=parent_link.low_confidence,
                            reasons=parent_link.reasons,
                        )
                    )

        for parent in previous:
            child_links = accepted_by_parent[parent.observation_id]
            if len(child_links) > 1:
                parent_lineage = observation_lineages[parent.observation_id]
                terminated_by_branch.add(parent_lineage)
                child_ids = tuple(
                    sorted(link.child_observation_id for link in child_links)
                )
                child_lineages: list[str] = []
                for child_id in child_ids:
                    if child_id not in assigned:
                        child_lineages.append(new_lineage(child_id))
                        assigned.add(child_id)
                    else:
                        child_lineages.append(observation_lineages[child_id])
                events.append(
                    LineageEvent(
                        event_type=EventType.SPLIT,
                        snapshot_id=by_id[child_ids[0]].snapshot_id,
                        snapshot_index=snapshot_index,
                        parent_observation_ids=(parent.observation_id,),
                        child_observation_ids=child_ids,
                        parent_lineage_ids=(parent_lineage,),
                        child_lineage_ids=tuple(child_lineages),
                        score=min(link.score for link in child_links),
                        low_confidence=any(link.low_confidence for link in child_links),
                        reasons=tuple(
                            sorted(
                                {
                                    reason
                                    for link in child_links
                                    for reason in link.reasons
                                }
                            )
                        ),
                    )
                )

        for child in current:
            parent_links = accepted_by_child[child.observation_id]
            if len(parent_links) > 1:
                parent_ids = tuple(
                    sorted(link.parent_observation_id for link in parent_links)
                )
                parent_lineages = tuple(
                    observation_lineages[parent_id] for parent_id in parent_ids
                )
                terminated_by_branch.update(parent_lineages)
                if child.observation_id not in assigned:
                    child_lineage = new_lineage(child.observation_id)
                    assigned.add(child.observation_id)
                else:
                    child_lineage = observation_lineages[child.observation_id]
                events.append(
                    LineageEvent(
                        event_type=EventType.MERGE,
                        snapshot_id=child.snapshot_id,
                        snapshot_index=snapshot_index,
                        parent_observation_ids=parent_ids,
                        child_observation_ids=(child.observation_id,),
                        parent_lineage_ids=parent_lineages,
                        child_lineage_ids=(child_lineage,),
                        score=min(link.score for link in parent_links),
                        low_confidence=any(link.low_confidence for link in parent_links),
                        reasons=tuple(
                            sorted(
                                {
                                    reason
                                    for link in parent_links
                                    for reason in link.reasons
                                }
                            )
                        ),
                    )
                )

        unassigned = [
            child for child in current if child.observation_id not in assigned
        ]
        resurgence_options: list[tuple[CandidateLink, str]] = []
        for child in unassigned:
            for lineage_id, prior_id in dormant_lineages.items():
                if lineage_id in terminated_by_branch:
                    continue
                prior = by_id[prior_id]
                gap = snapshot_index - prior.snapshot_index - 1
                if not 1 <= gap <= config.maximum_resurgence_gap:
                    continue
                candidate = _score(
                    prior, child, config, gap=gap, resurgence=True
                )
                candidates.append(candidate)
                if candidate.accepted:
                    resurgence_options.append((candidate, lineage_id))

        resurgence_options.sort(
            key=lambda item: (
                -item[0].score,
                -item[0].jaccard,
                -item[0].overlap,
                item[1],
                item[0].child_observation_id,
            )
        )
        used_lineages: set[str] = set()
        used_children: set[str] = set()
        for candidate, lineage_id in resurgence_options:
            child_id = candidate.child_observation_id
            if lineage_id in used_lineages or child_id in used_children:
                continue
            competing = [
                option
                for option, option_lineage in resurgence_options
                if option.child_observation_id == child_id
                and option_lineage != lineage_id
                and option_lineage not in used_lineages
            ]
            tied = bool(
                competing
                and candidate.score - competing[0].score
                < config.low_confidence_margin
            )
            reasons = candidate.reasons + (("competing_match",) if tied else ())
            observation_lineages[child_id] = lineage_id
            identity_observations[lineage_id].append(child_id)
            dormant_lineages.pop(lineage_id, None)
            used_lineages.add(lineage_id)
            used_children.add(child_id)
            assigned.add(child_id)
            child = by_id[child_id]
            events.append(
                LineageEvent(
                    event_type=EventType.RESURGENCE,
                    snapshot_id=child.snapshot_id,
                    snapshot_index=snapshot_index,
                    parent_observation_ids=(candidate.parent_observation_id,),
                    child_observation_ids=(child_id,),
                    parent_lineage_ids=(lineage_id,),
                    child_lineage_ids=(lineage_id,),
                    score=candidate.score,
                    low_confidence=candidate.low_confidence or tied,
                    reasons=reasons,
                )
            )

        for child in current:
            if child.observation_id in assigned:
                continue
            lineage_id = new_lineage(child.observation_id)
            events.append(
                LineageEvent(
                    event_type=EventType.BIRTH,
                    snapshot_id=child.snapshot_id,
                    snapshot_index=snapshot_index,
                    child_observation_ids=(child.observation_id,),
                    child_lineage_ids=(lineage_id,),
                    low_confidence=child.uncertain,
                    reasons=("uncertain_input",) if child.uncertain else (),
                )
            )

    # Mark accepted resurgence alternatives in the final candidate record.
    accepted_pairs = {
        (event.parent_observation_ids[0], event.child_observation_ids[0])
        for event in events
        if event.event_type is EventType.RESURGENCE
    }
    candidates = [
        replace(
            candidate,
            accepted=(
                candidate.accepted
                if candidate.gap == 0
                else (
                    candidate.parent_observation_id,
                    candidate.child_observation_id,
                )
                in accepted_pairs
            ),
        )
        for candidate in candidates
    ]
    identities = tuple(
        LineageIdentity(lineage_id, tuple(observation_ids))
        for lineage_id, observation_ids in sorted(identity_observations.items())
    )
    return LineageResult(
        observations=observations,
        candidates=tuple(sorted(candidates, key=_candidate_sort_key)),
        events=tuple(sorted(events, key=_event_sort_key)),
        identities=identities,
        observation_lineages=dict(sorted(observation_lineages.items())),
    )
