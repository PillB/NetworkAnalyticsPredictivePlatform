from __future__ import annotations

import unittest
from uuid import UUID

from apps.api.persistence.identifiers import (
    assertion_uuid,
    case_uuid,
    entity_uuid,
    revision_uuid,
    source_uuid,
)


class IdentifierTests(unittest.TestCase):
    def test_uuid_mapping_is_deterministic_and_type_scoped(self) -> None:
        first = case_uuid("harbor-lantern")

        self.assertEqual(first, case_uuid("harbor-lantern"))
        self.assertIsInstance(first, UUID)
        self.assertEqual(5, first.version)
        self.assertNotEqual(
            entity_uuid("harbor-lantern", "northstar"),
            source_uuid("harbor-lantern", "northstar"),
        )
        self.assertNotEqual(
            assertion_uuid("harbor-lantern", "claim"),
            revision_uuid("harbor-lantern", "claim", "claim-r1"),
        )

    def test_uuid_mapping_rejects_empty_keys(self) -> None:
        with self.assertRaises(ValueError):
            entity_uuid("harbor-lantern", "")
