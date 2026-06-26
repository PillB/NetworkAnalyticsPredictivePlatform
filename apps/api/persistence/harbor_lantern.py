"""Idempotent importer for the canonical Harbor Lantern interchange fixture."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Mapping
from uuid import UUID

from psycopg.types.json import Jsonb

from apps.api.fixture_loader import load_harbor_lantern_fixture

from .identifiers import (
    assertion_uuid,
    case_uuid,
    entity_uuid,
    revision_uuid,
    source_uuid,
)
from .rls import RLSContext, TransactionScopedRLS


def _instant(value: str | None) -> datetime | None:
    if value is None:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


@dataclass(frozen=True)
class ImportResult:
    case_id: UUID
    entity_ids: tuple[UUID, ...]
    source_ids: tuple[UUID, ...]
    assertion_ids: tuple[UUID, ...]
    revision_ids: tuple[UUID, ...]


class HarborLanternImporter:
    """Import the shared fixture without generating database-local identities."""

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

    def import_fixture(
        self, fixture: Mapping[str, Any] | None = None
    ) -> ImportResult:
        payload = fixture or load_harbor_lantern_fixture()
        case = payload["case"]
        case_key = case["id"]
        mapped_case_id = case_uuid(case_key)
        records = tuple(payload["relationships"]) + tuple(
            payload["temporalCorrections"]
        )
        revisions_by_key = {record["revisionId"]: record for record in records}
        revision_numbers = self._revision_numbers(revisions_by_key)

        context = RLSContext(
            actor_id=self._actor_id,
            purpose_id=self._purpose_id,
            case_ids=(mapped_case_id,),
        )
        with self._transactions.transaction(context) as connection:
            self._insert_case(connection, payload, mapped_case_id)
            for node in payload["nodes"]:
                self._insert_entity(connection, case_key, mapped_case_id, node)

            for record in records:
                self._insert_source(connection, case_key, mapped_case_id, record)

            first_by_assertion: dict[str, Mapping[str, Any]] = {}
            for record in records:
                first_by_assertion.setdefault(record["assertionId"], record)
            for record in first_by_assertion.values():
                self._insert_assertion(connection, case_key, mapped_case_id, record)

            ordered = sorted(
                records,
                key=lambda record: (
                    record["assertionId"],
                    revision_numbers[record["revisionId"]],
                ),
            )
            for record in ordered:
                self._insert_revision(
                    connection,
                    case_key,
                    mapped_case_id,
                    record,
                    revision_numbers[record["revisionId"]],
                )

        return ImportResult(
            case_id=mapped_case_id,
            entity_ids=tuple(
                entity_uuid(case_key, node["id"]) for node in payload["nodes"]
            ),
            source_ids=tuple(
                sorted(
                    {
                        source_uuid(case_key, record["sourceId"])
                        for record in records
                    },
                    key=str,
                )
            ),
            assertion_ids=tuple(
                sorted(
                    {
                        assertion_uuid(case_key, record["assertionId"])
                        for record in records
                    },
                    key=str,
                )
            ),
            revision_ids=tuple(
                revision_uuid(
                    case_key, record["assertionId"], record["revisionId"]
                )
                for record in records
            ),
        )

    @staticmethod
    def _revision_numbers(
        revisions: Mapping[str, Mapping[str, Any]]
    ) -> dict[str, int]:
        numbers: dict[str, int] = {}
        visiting: set[str] = set()

        def number(revision_key: str) -> int:
            if revision_key in numbers:
                return numbers[revision_key]
            if revision_key in visiting:
                raise ValueError(f"cyclic correction chain at {revision_key}")
            visiting.add(revision_key)
            record = revisions[revision_key]
            predecessor = record.get("supersedesRevisionId")
            if predecessor is None:
                result = 1
            else:
                if predecessor not in revisions:
                    raise ValueError(
                        f"unknown superseded revision: {predecessor}"
                    )
                if (
                    revisions[predecessor]["assertionId"]
                    != record["assertionId"]
                ):
                    raise ValueError("correction chain crosses assertions")
                result = number(predecessor) + 1
            visiting.remove(revision_key)
            numbers[revision_key] = result
            return result

        for key in revisions:
            number(key)
        return numbers

    def _insert_case(
        self, connection: Any, fixture: Mapping[str, Any], mapped_case_id: UUID
    ) -> None:
        case = fixture["case"]
        scope = case["scope"]
        policy = {
            "fixture": {
                "schema": fixture["schema"],
                "version": fixture["fixtureVersion"],
                "synthetic": case["synthetic"],
            },
            "handlingLabel": case["handlingLabel"],
            "question": case["question"],
            "ui": {
                "guidedSteps": fixture["guidedSteps"],
                "lineageScenarios": fixture["lineageScenarios"],
                "defaults": fixture["defaults"],
                "scope": scope,
            },
        }
        connection.execute(
            """
            INSERT INTO napp.cases (
                id, case_key, name, jurisdiction, permissible_purpose,
                owner_actor_id, handling_policy, valid_scope
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s,
                tstzrange(%s, %s, '[)')
            )
            ON CONFLICT (id) DO NOTHING
            """,
            (
                mapped_case_id,
                case["id"],
                case["title"],
                "training",
                case["purpose"],
                self._actor_id,
                Jsonb(policy),
                _instant(scope["permittedStart"]),
                _instant(scope["permittedEnd"]),
            ),
        )

    @staticmethod
    def _insert_entity(
        connection: Any,
        case_key: str,
        mapped_case_id: UUID,
        node: Mapping[str, Any],
    ) -> None:
        connection.execute(
            """
            INSERT INTO napp.entities (
                id, case_id, entity_key, entity_type, display_label, attributes
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                entity_uuid(case_key, node["id"]),
                mapped_case_id,
                node["id"],
                node["type"],
                node["label"],
                Jsonb({"ui": dict(node), "synthetic": True}),
            ),
        )

    @staticmethod
    def _insert_source(
        connection: Any,
        case_key: str,
        mapped_case_id: UUID,
        record: Mapping[str, Any],
    ) -> None:
        metadata = {
            "source_name": record["source"],
            "original_reference": record["originalReference"],
            "source_reliability": record["reliability"],
            "information_credibility": record["credibility"],
            "fixture_schema": "HarborLanternInterchangeV1",
            "fixture_relationship_id": record.get("id"),
            "synthetic": True,
        }
        connection.execute(
            """
            INSERT INTO napp.sources (
                id, case_id, source_key, source_type, title, object_uri,
                received_at, restrictions, metadata
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                source_uuid(case_key, record["sourceId"]),
                mapped_case_id,
                record["sourceId"],
                "synthetic_fixture",
                record["source"],
                record["originalReference"],
                _instant(record["recordedStart"]),
                Jsonb({"handling_label": record["handlingLabel"]}),
                Jsonb(metadata),
            ),
        )

    @staticmethod
    def _insert_assertion(
        connection: Any,
        case_key: str,
        mapped_case_id: UUID,
        record: Mapping[str, Any],
    ) -> None:
        # The fixture includes a correction that changes the asserted object.
        # Migration 0001 fixes object identity on the assertion row, so the
        # initial object remains there and each revision's exact object is kept
        # in assertion_revisions.payload.
        connection.execute(
            """
            INSERT INTO napp.assertions (
                id, case_id, assertion_key, subject_entity_id, predicate,
                object_entity_id
            )
            VALUES (%s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO NOTHING
            """,
            (
                assertion_uuid(case_key, record["assertionId"]),
                mapped_case_id,
                record["assertionId"],
                entity_uuid(case_key, record["subject"]),
                record["predicateCode"],
                entity_uuid(case_key, record["object"]),
            ),
        )

    def _insert_revision(
        self,
        connection: Any,
        case_key: str,
        mapped_case_id: UUID,
        record: Mapping[str, Any],
        revision_number: int,
    ) -> None:
        predecessor = record.get("supersedesRevisionId")
        event_at = _instant(record.get("eventAt"))
        validity_kind = "point" if event_at is not None else "interval"
        valid_start = event_at or _instant(record["validStart"])
        valid_end = event_at if event_at is not None else _instant(
            record.get("validEnd")
        )
        bounds = "[]" if event_at is not None else "[)"
        restrictions = {
            "handling_label": record["handlingLabel"],
            "field_restrictions": list(record["fieldRestrictions"]),
        }
        revision_payload = {
            "schema": "HarborLanternAssertionRevisionV1",
            "case_key": case_key,
            "assertion_key": record["assertionId"],
            "revision_key": record["revisionId"],
            "subject_ref": record["subject"],
            "object_ref": record["object"],
            "event_at": record.get("eventAt"),
            "event_precision": record.get("eventPrecision"),
            "valid_start": record["validStart"],
            "valid_end": record.get("validEnd"),
            "recorded_end": record.get("recordedEnd"),
            "status": record.get("status", "active"),
            "created_by": "fixture",
            "ui": dict(record),
        }
        evidence_status = (
            "unknown" if record.get("status") == "uncertain" else "asserted"
        )
        connection.execute(
            """
            INSERT INTO napp.assertion_revisions (
                id, case_id, assertion_id, revision_number, source_id,
                supersedes_revision_id, assertion_class, evidence_status,
                confidence, validity_kind, valid_period, recorded_at,
                restrictions, payload, rationale, created_by_actor_id
            )
            VALUES (
                %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                tstzrange(%s, %s, %s), %s, %s, %s, %s, %s
            )
            ON CONFLICT (id) DO NOTHING
            """,
            (
                revision_uuid(
                    case_key, record["assertionId"], record["revisionId"]
                ),
                mapped_case_id,
                assertion_uuid(case_key, record["assertionId"]),
                revision_number,
                source_uuid(case_key, record["sourceId"]),
                (
                    revision_uuid(
                        case_key, record["assertionId"], predecessor
                    )
                    if predecessor
                    else None
                ),
                record["assertionClass"],
                evidence_status,
                record["confidenceValue"],
                validity_kind,
                valid_start,
                valid_end,
                bounds,
                _instant(record["recordedStart"]),
                Jsonb(restrictions),
                Jsonb(revision_payload),
                record.get("correctionReason") or record.get("reasoning"),
                self._actor_id,
            ),
        )
