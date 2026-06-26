"""Deterministic JSON helpers shared by service contracts."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timezone
from enum import Enum
from types import MappingProxyType
from typing import Any, Mapping


def freeze_value(value: Any) -> Any:
    """Recursively copy containers into immutable equivalents."""

    if isinstance(value, Mapping):
        return MappingProxyType(
            {str(key): freeze_value(item) for key, item in value.items()}
        )
    if isinstance(value, (tuple, list)):
        return tuple(freeze_value(item) for item in value)
    if isinstance(value, (set, frozenset)):
        return frozenset(freeze_value(item) for item in value)
    return value


def freeze_mapping(value: Mapping[str, Any]) -> Mapping[str, Any]:
    """Copy a mapping so callers cannot mutate an immutable contract."""

    frozen = freeze_value(value)
    assert isinstance(frozen, Mapping)
    return frozen


def json_value(value: Any) -> Any:
    """Return a recursively JSON-compatible value with stable collection order."""

    if hasattr(value, "to_dict"):
        return json_value(value.to_dict())
    if isinstance(value, datetime):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("datetimes must be timezone-aware")
        return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    if isinstance(value, Enum):
        return json_value(value.value)
    if isinstance(value, Mapping):
        return {
            str(key): json_value(item)
            for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))
        }
    if isinstance(value, (set, frozenset)):
        converted = [json_value(item) for item in value]
        return sorted(converted, key=canonical_json)
    if isinstance(value, (tuple, list)):
        return [json_value(item) for item in value]
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    return str(value)


def canonical_json(value: Any) -> str:
    """Serialize without whitespace or insertion-order dependence."""

    return json.dumps(
        json_value(value),
        ensure_ascii=False,
        allow_nan=False,
        separators=(",", ":"),
        sort_keys=True,
    )


def stable_digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode("utf-8")).hexdigest()
