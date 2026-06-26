from __future__ import annotations

from contextlib import contextmanager
from types import SimpleNamespace
from typing import Any

from psycopg.pq import TransactionStatus


class FakeCursor:
    def __init__(self, connection: "FakeConnection") -> None:
        self.connection = connection
        self.statement = ""
        self.parameters: tuple[Any, ...] = ()

    def __enter__(self) -> "FakeCursor":
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def execute(self, statement: str, parameters: tuple[Any, ...]) -> None:
        self.statement = statement
        self.parameters = parameters
        self.connection.cursor_calls.append((statement, parameters))

    def fetchall(self) -> list[dict[str, Any]]:
        return list(self.connection.rows)


class FakeConnection:
    def __init__(
        self,
        *,
        rows: list[dict[str, Any]] | None = None,
        leave_non_idle: bool = False,
    ) -> None:
        self.calls: list[tuple[str, tuple[Any, ...]]] = []
        self.cursor_calls: list[tuple[str, tuple[Any, ...]]] = []
        self.rows = rows or []
        self.info = SimpleNamespace(transaction_status=TransactionStatus.IDLE)
        self.rollback_count = 0
        self.leave_non_idle = leave_non_idle

    @contextmanager
    def transaction(self):
        self.info.transaction_status = TransactionStatus.INTRANS
        try:
            yield
        finally:
            self.info.transaction_status = (
                TransactionStatus.INTRANS
                if self.leave_non_idle
                else TransactionStatus.IDLE
            )

    def execute(
        self, statement: str, parameters: tuple[Any, ...] = ()
    ) -> None:
        self.calls.append((statement, parameters))

    def cursor(self, *, row_factory: Any = None) -> FakeCursor:
        return FakeCursor(self)

    def rollback(self) -> None:
        self.rollback_count += 1
        self.info.transaction_status = TransactionStatus.IDLE


class FakePool:
    def __init__(self, connection: FakeConnection | None = None) -> None:
        self.connection_value = connection or FakeConnection()
        self.checkout_count = 0

    @contextmanager
    def connection(self):
        self.checkout_count += 1
        yield self.connection_value
