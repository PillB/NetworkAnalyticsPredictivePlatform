"""Transaction-local PostgreSQL RLS context with pool-safe cleanup."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from psycopg.pq import TransactionStatus


@dataclass(frozen=True)
class RLSContext:
    actor_id: UUID
    purpose_id: UUID
    case_ids: tuple[UUID, ...]
    authorization_session_id: str | None
    policy_version: str | None

    def __init__(
        self,
        *,
        actor_id: UUID | str,
        purpose_id: UUID | str,
        case_ids: Sequence[UUID | str],
        authorization_session_id: str | None = None,
        policy_version: str | None = None,
    ) -> None:
        object.__setattr__(self, "actor_id", UUID(str(actor_id)))
        object.__setattr__(self, "purpose_id", UUID(str(purpose_id)))
        object.__setattr__(
            self,
            "case_ids",
            tuple(UUID(str(case_id)) for case_id in case_ids),
        )
        object.__setattr__(
            self, "authorization_session_id", authorization_session_id
        )
        object.__setattr__(self, "policy_version", policy_version)

    @classmethod
    def from_authorization_session(cls, session: Any) -> "RLSContext":
        from .identifiers import case_uuid

        try:
            mapped_case_id = UUID(str(session.case_id))
        except ValueError:
            mapped_case_id = case_uuid(str(session.case_id))
        return cls(
            actor_id=session.actor_id,
            purpose_id=session.purpose_id,
            case_ids=(mapped_case_id,),
            authorization_session_id=session.session_id,
            policy_version=session.policy_version,
        )


class TransactionScopedRLS:
    """Acquire a pooled connection and set only transaction-local settings."""

    def __init__(self, pool: Any) -> None:
        self._pool = pool

    @contextmanager
    def transaction(self, context: RLSContext) -> Iterator[Any]:
        with self._pool.connection() as connection:
            try:
                with connection.transaction():
                    connection.execute(
                        "SELECT set_config('app.actor_id', %s, true)",
                        (str(context.actor_id),),
                    )
                    connection.execute(
                        "SELECT set_config('app.purpose_id', %s, true)",
                        (str(context.purpose_id),),
                    )
                    case_array = "{" + ",".join(map(str, context.case_ids)) + "}"
                    connection.execute(
                        "SELECT set_config('app.authorized_case_ids', %s, true)",
                        (case_array,),
                    )
                    if context.authorization_session_id is not None:
                        connection.execute(
                            "SELECT set_config("
                            "'app.authorization_session_id', %s, true)",
                            (context.authorization_session_id,),
                        )
                    if context.policy_version is not None:
                        connection.execute(
                            "SELECT set_config('app.policy_version', %s, true)",
                            (context.policy_version,),
                        )
                    yield connection
            finally:
                # Psycopg transaction contexts normally leave IDLE. This defensive
                # rollback prevents an aborted or custom/fake transaction from
                # carrying LOCAL settings or locks back into a pool.
                info = getattr(connection, "info", None)
                status = getattr(info, "transaction_status", TransactionStatus.IDLE)
                if status != TransactionStatus.IDLE:
                    connection.rollback()
