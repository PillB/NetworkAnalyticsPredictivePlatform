"""In-memory reference implementation of historical assertion queries."""

from __future__ import annotations

from collections import defaultdict
from collections.abc import Iterable

from .models import AssertionRevision, HistoricalQuery, TemporalWindowQuery
from .provenance import TemporalSnapshot, TemporalWindowSnapshot


class TemporalIntegrityError(ValueError):
    """Raised when revision history cannot represent one historical belief."""


class InMemoryAssertionRepository:
    """Read-only, deterministic repository suitable for fixtures and tests."""

    def __init__(self, revisions: Iterable[AssertionRevision] = ()) -> None:
        ordered = tuple(
            sorted(
                revisions,
                key=lambda revision: (
                    revision.assertion_id,
                    revision.recorded_during.start,
                    revision.revision_id,
                ),
            )
        )
        self._validate(ordered)
        self._revisions = ordered
        self._by_revision_id = {revision.revision_id: revision for revision in ordered}

    @staticmethod
    def _validate(revisions: tuple[AssertionRevision, ...]) -> None:
        revision_ids: set[str] = set()
        by_assertion: dict[str, list[AssertionRevision]] = defaultdict(list)
        for revision in revisions:
            if revision.revision_id in revision_ids:
                raise TemporalIntegrityError(
                    f"duplicate revision_id: {revision.revision_id}"
                )
            revision_ids.add(revision.revision_id)
            by_assertion[revision.assertion_id].append(revision)

        for assertion_id, history in by_assertion.items():
            case_ids = {revision.case_id for revision in history}
            if len(case_ids) != 1:
                raise TemporalIntegrityError(
                    f"assertion {assertion_id} crosses case boundaries"
                )
            for previous, current in zip(history, history[1:]):
                if previous.recorded_during.overlaps(current.recorded_during):
                    raise TemporalIntegrityError(
                        f"recorded-time overlap for assertion {assertion_id}"
                    )
                if (
                    current.supersedes_revision_id is not None
                    and current.supersedes_revision_id != previous.revision_id
                ):
                    raise TemporalIntegrityError(
                        f"revision {current.revision_id} does not supersede "
                        f"the preceding revision"
                    )

    def all_revisions(self) -> tuple[AssertionRevision, ...]:
        return self._revisions

    def get_revision(self, revision_id: str) -> AssertionRevision:
        try:
            return self._by_revision_id[revision_id]
        except KeyError as exc:
            raise KeyError(f"unknown revision_id: {revision_id}") from exc

    def history(self, assertion_id: str) -> tuple[AssertionRevision, ...]:
        return tuple(
            revision
            for revision in self._revisions
            if revision.assertion_id == assertion_id
        )

    def reconstruct(self, query: HistoricalQuery) -> tuple[AssertionRevision, ...]:
        matches = [
            revision
            for revision in self._revisions
            if (query.case_id is None or revision.case_id == query.case_id)
            and revision.applies_at(query.valid_at)
            and revision.visible_at(query.known_at)
        ]
        return tuple(sorted(matches, key=lambda revision: revision.revision_id))

    def snapshot(self, query: HistoricalQuery) -> TemporalSnapshot:
        return TemporalSnapshot(query=query, dependencies=self.reconstruct(query))

    def reconstruct_window(
        self, query: TemporalWindowQuery
    ) -> tuple[AssertionRevision, ...]:
        matches = [
            revision
            for revision in self._revisions
            if (query.case_id is None or revision.case_id == query.case_id)
            and revision.applies_during(query.valid_during)
            and revision.visible_at(query.known_at)
        ]
        return tuple(sorted(matches, key=lambda revision: revision.revision_id))

    def window_snapshot(self, query: TemporalWindowQuery) -> TemporalWindowSnapshot:
        return TemporalWindowSnapshot(
            query=query,
            dependencies=self.reconstruct_window(query),
        )
