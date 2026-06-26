"""Fail-closed PostgreSQL adapters for shared security state.

The adapters call the hardened functions defined by migration 0003. Raw
credentials, subjects, token IDs, nonces, and complete claim payloads are never
persisted or passed as SQL parameters.
"""

from __future__ import annotations

from datetime import datetime
from hashlib import sha256
from typing import Any

from psycopg.rows import dict_row

from .models import Actor, CaseGrant, VerifiedIdentityClaims, require_aware


_SELECT_ACTOR = """
SELECT actor_id::text AS actor_id, roles
FROM napp.resolve_security_actor(%s, %s)
"""

_SELECT_ACTIVE_GRANT = """
SELECT
    grant_id::text AS grant_id,
    expires_at,
    policy_version,
    allowed_handling_labels,
    allowed_fields
FROM napp.resolve_current_case_grant(
    %s::uuid,
    %s::uuid,
    %s,
    %s,
    %s
)
"""

_CONSUME_REPLAY = """
SELECT napp.consume_oidc_replay(%s, %s, %s, %s, %s) AS consumed
"""


def _digest(value: str) -> bytes:
    return sha256(value.encode("utf-8")).digest()


def _issuer_key(issuer: str) -> bytes:
    return _digest(issuer)


class PostgreSQLActorMapper:
    """Map verified issuer/subject pairs through shared PostgreSQL state."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    def map_actor(self, claims: VerifiedIdentityClaims) -> Actor | None:
        try:
            with self._pool.connection() as connection:
                with connection.transaction():
                    with connection.cursor(row_factory=dict_row) as cursor:
                        cursor.execute(
                            _SELECT_ACTOR,
                            (_issuer_key(claims.issuer), _digest(claims.subject)),
                        )
                        rows = cursor.fetchall()
            if len(rows) != 1:
                return None
            row = rows[0]
            return Actor(
                actor_id=row["actor_id"],
                identity_issuer=claims.issuer,
                identity_subject=claims.subject,
                roles=tuple(row["roles"] or ()),
                active=True,
            )
        except Exception:
            return None


class PostgreSQLCaseGrantStore:
    """Resolve exactly one current grant; ambiguity and storage errors deny."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    def find_active_grant(
        self,
        *,
        actor_id: str,
        case_id: str,
        purpose: str,
        policy_version: str,
        now: datetime,
    ) -> CaseGrant | None:
        require_aware(now, "now")
        try:
            with self._pool.connection() as connection:
                with connection.transaction():
                    with connection.cursor(row_factory=dict_row) as cursor:
                        cursor.execute(
                            _SELECT_ACTIVE_GRANT,
                            (
                                actor_id,
                                case_id,
                                purpose,
                                policy_version,
                                now,
                            ),
                        )
                        rows = cursor.fetchall()
            if len(rows) != 1:
                return None
            row = rows[0]
            return CaseGrant(
                grant_id=row["grant_id"],
                actor_id=actor_id,
                case_id=case_id,
                purposes=(purpose,),
                expires_at=row["expires_at"],
                policy_version=row["policy_version"],
                allowed_handling_labels=tuple(
                    row["allowed_handling_labels"] or ()
                ),
                allowed_fields=tuple(row["allowed_fields"] or ()),
                revoked_at=None,
            )
        except Exception:
            return None


class PostgreSQLReplayProtector:
    """Atomically consume a digest until its verified credential expiry."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    def consume(self, claims: VerifiedIdentityClaims, *, now: datetime) -> bool:
        require_aware(now, "now")
        if claims.expires_at <= now:
            return False
        try:
            with self._pool.connection() as connection:
                with connection.transaction():
                    with connection.cursor(row_factory=dict_row) as cursor:
                        cursor.execute(
                            _CONSUME_REPLAY,
                            (
                                _issuer_key(claims.issuer),
                                _digest(claims.subject),
                                _digest(claims.token_id),
                                _digest(claims.nonce or ""),
                                claims.expires_at,
                            ),
                        )
                        rows = cursor.fetchall()
            return len(rows) == 1 and rows[0].get("consumed") is True
        except Exception:
            return False
