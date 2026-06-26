"""psycopg3 repository for bitemporal assertion reconstruction."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Mapping
from uuid import UUID

from psycopg.rows import dict_row

from apps.api.temporal.models import (
    AssertionClass,
    AssertionRevision,
    HistoricalQuery,
    SourceRecord,
    TemporalInterval,
    TemporalWindowQuery,
)
from apps.api.temporal.provenance import TemporalSnapshot, TemporalWindowSnapshot

from .identifiers import assertion_uuid, case_uuid
from .rls import RLSContext, TransactionScopedRLS


_SELECT_REVISION = """
SELECT
    r.id,
    r.revision_number,
    r.recorded_at,
    successor.recorded_at AS recorded_end,
    r.assertion_class,
    r.evidence_status,
    r.confidence,
    r.validity_kind,
    lower(r.valid_period) AS valid_start,
    upper(r.valid_period) AS valid_end,
    r.restrictions,
    r.payload,
    r.rationale,
    r.supersedes_revision_id,
    a.assertion_key,
    a.predicate,
    subject.entity_key AS subject_ref,
    c.case_key,
    s.source_key,
    s.title AS source_name,
    s.object_uri,
    s.received_at,
    s.restrictions AS source_restrictions,
    s.metadata AS source_metadata
FROM napp.assertion_revisions AS r
JOIN napp.assertions AS a
  ON a.case_id = r.case_id AND a.id = r.assertion_id
JOIN napp.entities AS subject
  ON subject.case_id = a.case_id AND subject.id = a.subject_entity_id
JOIN napp.cases AS c ON c.id = r.case_id
JOIN napp.sources AS s
  ON s.case_id = r.case_id AND s.id = r.source_id
LEFT JOIN napp.assertion_revisions AS successor
  ON successor.case_id = r.case_id
 AND successor.supersedes_revision_id = r.id
"""


class PostgreSQLAssertionRepository:
    def __init__(
        self,
        pool: Any,
        *,
        actor_id: UUID | str,
        purpose_id: UUID | str,
    ) -> None:
        self._transactions = TransactionScopedRLS(pool)
        self._actor_id = UUID(str(actor_id))
        self._purpose_id = UUID(str(purpose_id))
        self._authorization_session_id: str | None = None
        self._policy_version: str | None = None

    @classmethod
    def from_authorization_session(
        cls, pool: Any, session: Any
    ) -> "PostgreSQLAssertionRepository":
        repository = cls(
            pool,
            actor_id=session.actor_id,
            purpose_id=session.purpose_id,
        )
        repository._authorization_session_id = session.session_id
        repository._policy_version = session.policy_version
        return repository

    def _context(self, case_key: str) -> RLSContext:
        return RLSContext(
            actor_id=self._actor_id,
            purpose_id=self._purpose_id,
            case_ids=(case_uuid(case_key),),
            authorization_session_id=self._authorization_session_id,
            policy_version=self._policy_version,
        )

    def _fetch(
        self, case_key: str, statement: str, parameters: tuple[Any, ...]
    ) -> tuple[AssertionRevision, ...]:
        with self._transactions.transaction(self._context(case_key)) as connection:
            with connection.cursor(row_factory=dict_row) as cursor:
                cursor.execute(statement, parameters)
                return tuple(self._from_row(row) for row in cursor.fetchall())

    def get_revision(
        self, revision_id: str, *, case_id: str = "harbor-lantern"
    ) -> AssertionRevision:
        # Revision IDs are deterministic from both the assertion and revision
        # keys, so resolve the assertion key first without bypassing case RLS.
        statement = (
            _SELECT_REVISION
            + """
            WHERE r.case_id = %s AND r.payload->>'revision_key' = %s
            ORDER BY r.recorded_at, r.id
            """
        )
        matches = self._fetch(
            case_id, statement, (case_uuid(case_id), revision_id)
        )
        if not matches:
            raise KeyError(f"unknown revision_id: {revision_id}")
        return matches[0]

    def history(
        self, assertion_id: str, *, case_id: str = "harbor-lantern"
    ) -> tuple[AssertionRevision, ...]:
        statement = (
            _SELECT_REVISION
            + """
            WHERE r.case_id = %s AND r.assertion_id = %s
            ORDER BY r.revision_number, r.recorded_at, r.id
            """
        )
        return self._fetch(
            case_id,
            statement,
            (case_uuid(case_id), assertion_uuid(case_id, assertion_id)),
        )

    def reconstruct(
        self, query: HistoricalQuery
    ) -> tuple[AssertionRevision, ...]:
        case_key = self._required_case(query.case_id)
        statement = (
            _SELECT_REVISION
            + """
            WHERE r.case_id = %s
              AND r.recorded_at <= %s
              AND NOT EXISTS (
                  SELECT 1
                  FROM napp.assertion_revisions AS known_successor
                  WHERE known_successor.case_id = r.case_id
                    AND known_successor.supersedes_revision_id = r.id
                    AND known_successor.recorded_at <= %s
              )
              AND (
                  (r.validity_kind = 'point'
                   AND lower(r.valid_period) = %s)
                  OR
                  (r.validity_kind = 'interval'
                   AND r.valid_period @> %s::timestamptz)
              )
            ORDER BY r.payload->>'revision_key', r.id
            """
        )
        return self._fetch(
            case_key,
            statement,
            (
                case_uuid(case_key),
                query.known_at,
                query.known_at,
                query.valid_at,
                query.valid_at,
            ),
        )

    def snapshot(self, query: HistoricalQuery) -> TemporalSnapshot:
        return TemporalSnapshot(query=query, dependencies=self.reconstruct(query))

    def reconstruct_window(
        self, query: TemporalWindowQuery
    ) -> tuple[AssertionRevision, ...]:
        case_key = self._required_case(query.case_id)
        statement = (
            _SELECT_REVISION
            + """
            WHERE r.case_id = %s
              AND r.recorded_at <= %s
              AND NOT EXISTS (
                  SELECT 1
                  FROM napp.assertion_revisions AS known_successor
                  WHERE known_successor.case_id = r.case_id
                    AND known_successor.supersedes_revision_id = r.id
                    AND known_successor.recorded_at <= %s
              )
              AND (
                  (r.validity_kind = 'point'
                   AND lower(r.valid_period) >= %s
                   AND lower(r.valid_period) <
                       COALESCE(%s::timestamptz, 'infinity'::timestamptz))
                  OR
                  (r.validity_kind = 'interval'
                   AND r.valid_period && tstzrange(%s, %s, '[)'))
              )
            ORDER BY r.payload->>'revision_key', r.id
            """
        )
        start = query.valid_during.start
        end = query.valid_during.end
        return self._fetch(
            case_key,
            statement,
            (
                case_uuid(case_key),
                query.known_at,
                query.known_at,
                start,
                end,
                start,
                end,
            ),
        )

    def window_snapshot(
        self, query: TemporalWindowQuery
    ) -> TemporalWindowSnapshot:
        return TemporalWindowSnapshot(
            query=query,
            dependencies=self.reconstruct_window(query),
        )

    @staticmethod
    def _required_case(case_id: str | None) -> str:
        if not case_id:
            raise ValueError(
                "PostgreSQL queries require a case_id for fail-closed RLS"
            )
        return case_id

    @staticmethod
    def _from_row(row: Mapping[str, Any]) -> AssertionRevision:
        payload = dict(row["payload"])
        ui = dict(payload.get("ui", {}))
        restrictions = dict(row["restrictions"])
        source_metadata = dict(row["source_metadata"])
        canonical_source_metadata = {
            key: source_metadata[key]
            for key in (
                "synthetic",
                "fixture_schema",
                "fixture_relationship_id",
            )
            if key in source_metadata
        }
        source = SourceRecord(
            source_record_id=row["source_key"],
            source_name=source_metadata.get("source_name", row["source_name"]),
            original_reference=source_metadata.get(
                "original_reference", row["object_uri"] or ""
            ),
            source_reliability=source_metadata.get("source_reliability", ""),
            information_credibility=source_metadata.get(
                "information_credibility", ""
            ),
            acquired_at=row["received_at"],
            metadata=canonical_source_metadata,
        )
        valid_start = _payload_instant(payload.get("valid_start")) or row[
            "valid_start"
        ]
        valid_end = _payload_instant(payload.get("valid_end"))
        if valid_end is None and row["validity_kind"] != "point":
            valid_end = row["valid_end"]
        recorded_end = row["recorded_end"]
        event_at = _payload_instant(payload.get("event_at"))
        predecessor = ui.get("supersedesRevisionId")
        return AssertionRevision(
            assertion_id=row["assertion_key"],
            revision_id=payload["revision_key"],
            case_id=row["case_key"],
            subject_ref=payload.get("subject_ref", row["subject_ref"]),
            predicate=row["predicate"],
            object_value=payload.get("object_ref", ""),
            assertion_class=AssertionClass(row["assertion_class"]),
            valid_during=TemporalInterval(valid_start, valid_end),
            recorded_during=TemporalInterval(row["recorded_at"], recorded_end),
            source=source,
            status=payload.get("status", row["evidence_status"]),
            analytical_confidence=float(row["confidence"] or 0),
            handling_label=restrictions.get("handling_label", "training"),
            field_restrictions=tuple(
                restrictions.get("field_restrictions", ())
            ),
            created_by=payload.get("created_by", "fixture"),
            event_at=event_at,
            event_precision=payload.get("event_precision"),
            supersedes_revision_id=predecessor,
            correction_reason=ui.get("correctionReason"),
        )


def _payload_instant(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value
    return datetime.fromisoformat(str(value).replace("Z", "+00:00"))
