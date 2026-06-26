"""Versioned fixture loader shared by backend, analytics, and browser contracts."""

from __future__ import annotations

import json
from pathlib import Path
from types import MappingProxyType
from typing import Any, Mapping


FIXTURE_PATH = (
    Path(__file__).resolve().parents[2]
    / "data"
    / "fixtures"
    / "harbor-lantern.v1.json"
)
EXPECTED_SCHEMA = "HarborLanternInterchangeV1"


def load_harbor_lantern_fixture() -> Mapping[str, Any]:
    """Load and minimally validate the canonical synthetic interchange fixture."""

    with FIXTURE_PATH.open(encoding="utf-8") as handle:
        payload = json.load(handle)

    if payload.get("schema") != EXPECTED_SCHEMA:
        raise ValueError(
            f"unsupported Harbor Lantern fixture schema: {payload.get('schema')!r}"
        )
    if payload.get("fixtureVersion") != "1.0.0":
        raise ValueError("unsupported Harbor Lantern fixture version")
    if payload.get("case", {}).get("synthetic") is not True:
        raise ValueError("Harbor Lantern fixture must remain explicitly synthetic")

    node_ids = {node["id"] for node in payload.get("nodes", ())}
    relationship_ids: set[str] = set()
    revision_ids: set[str] = set()
    for relationship in payload.get("relationships", ()):
        if relationship["id"] in relationship_ids:
            raise ValueError(f"duplicate relationship id: {relationship['id']}")
        relationship_ids.add(relationship["id"])
        if relationship["revisionId"] in revision_ids:
            raise ValueError(
                f"duplicate assertion revision id: {relationship['revisionId']}"
            )
        revision_ids.add(relationship["revisionId"])
        if relationship["subject"] not in node_ids:
            raise ValueError(f"unknown relationship subject: {relationship['subject']}")
        if relationship["object"] not in node_ids:
            raise ValueError(f"unknown relationship object: {relationship['object']}")

    return MappingProxyType(payload)

