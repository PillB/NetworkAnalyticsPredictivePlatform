from __future__ import annotations

import unittest
from uuid import UUID

from psycopg.types.json import Jsonb

from apps.api.persistence.harbor_lantern import HarborLanternImporter
from apps.api.persistence.identifiers import revision_uuid

from .fakes import FakeConnection, FakePool


ACTOR = UUID("20000000-0000-0000-0000-000000000001")
PURPOSE = UUID("70000000-0000-0000-0000-000000000001")


def _json_value(value: Jsonb) -> object:
    return value.obj


def _normalized(parameters: tuple[object, ...]) -> tuple[object, ...]:
    return tuple(
        ("jsonb", value.obj) if isinstance(value, Jsonb) else value
        for value in parameters
    )


class HarborLanternImporterTests(unittest.TestCase):
    def test_import_is_repeatable_and_uses_conflict_safe_inserts(self) -> None:
        connection = FakeConnection()
        importer = HarborLanternImporter(
            FakePool(connection), actor_id=ACTOR, purpose_id=PURPOSE
        )

        first = importer.import_fixture()
        first_calls = list(connection.calls)
        second = importer.import_fixture()
        second_calls = connection.calls[len(first_calls) :]

        self.assertEqual(first, second)
        self.assertEqual(10, len(first.revision_ids))
        self.assertEqual(len(first_calls), len(second_calls))
        self.assertTrue(
            all(
                "ON CONFLICT (id) DO NOTHING" in statement
                for statement, _ in first_calls[3:]
            )
        )
        self.assertEqual(
            [_normalized(parameters) for _, parameters in first_calls[3:]],
            [_normalized(parameters) for _, parameters in second_calls[3:]],
        )

    def test_import_preserves_ui_restrictions_provenance_and_correction_chain(
        self,
    ) -> None:
        connection = FakeConnection()
        importer = HarborLanternImporter(
            FakePool(connection), actor_id=ACTOR, purpose_id=PURPOSE
        )
        importer.import_fixture()

        revision_calls = [
            (statement, parameters)
            for statement, parameters in connection.calls
            if "INSERT INTO napp.assertion_revisions" in statement
        ]
        corrected = next(
            parameters
            for _, parameters in revision_calls
            if _json_value(parameters[15])["revision_key"]
            == "hl-berth-access-r2"
        )
        point = next(
            parameters
            for _, parameters in revision_calls
            if _json_value(parameters[15])["revision_key"]
            == "hl-radio-contact-r1"
        )
        restricted = next(
            parameters
            for _, parameters in revision_calls
            if _json_value(parameters[15])["revision_key"]
            == "hl-device-association-r1"
        )

        self.assertEqual(
            revision_uuid(
                "harbor-lantern",
                "hl-berth-access",
                "hl-berth-access-r1",
            ),
            corrected[5],
        )
        self.assertEqual(2, corrected[3])
        self.assertEqual("halcyon", _json_value(corrected[15])["object_ref"])
        self.assertEqual(
            "The original export decoded the berth column incorrectly.",
            _json_value(corrected[15])["ui"]["correctionReason"],
        )
        self.assertEqual("point", point[9])
        self.assertEqual(point[10], point[11])
        self.assertEqual("[]", point[12])
        self.assertEqual(
            ["device_signature"],
            _json_value(restricted[14])["field_restrictions"],
        )

        source_call = next(
            parameters
            for statement, parameters in connection.calls
            if "INSERT INTO napp.sources" in statement
            and parameters[2] == "hl-source-corrected-log"
        )
        self.assertEqual(
            "HL-ACCESS-2026-03-CORR.csv#row-184",
            _json_value(source_call[8])["original_reference"],
        )
