"""Stable identifiers for importing external keys into PostgreSQL."""

from __future__ import annotations

from uuid import UUID, uuid5


# A permanent, project-owned namespace. Changing it would change every imported ID.
NAPP_NAMESPACE = UUID("4f550f9a-7980-5b5d-9d4b-7c18b3d64246")


def _mapped_uuid(kind: str, *keys: str) -> UUID:
    if not keys or any(not key for key in keys):
        raise ValueError(f"{kind} keys must be non-empty")
    escaped = "\x1f".join(key.replace("\x1f", "\x1f\x1f") for key in keys)
    return uuid5(NAPP_NAMESPACE, f"{kind}\x1e{escaped}")


def case_uuid(case_key: str) -> UUID:
    return _mapped_uuid("case", case_key)


def entity_uuid(case_key: str, entity_key: str) -> UUID:
    return _mapped_uuid("entity", case_key, entity_key)


def source_uuid(case_key: str, source_key: str) -> UUID:
    return _mapped_uuid("source", case_key, source_key)


def assertion_uuid(case_key: str, assertion_key: str) -> UUID:
    return _mapped_uuid("assertion", case_key, assertion_key)


def revision_uuid(case_key: str, assertion_key: str, revision_key: str) -> UUID:
    return _mapped_uuid("revision", case_key, assertion_key, revision_key)
