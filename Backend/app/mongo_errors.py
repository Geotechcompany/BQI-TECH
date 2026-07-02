"""Lazy pymongo error types so routers do not trigger a slow pymongo import at load time."""

from typing import Tuple, Type

_MONGO_CONNECTION_ERRORS: Tuple[Type[BaseException], ...] | None = None


def mongo_connection_errors() -> Tuple[Type[BaseException], ...]:
    global _MONGO_CONNECTION_ERRORS
    if _MONGO_CONNECTION_ERRORS is None:
        from pymongo.errors import (
            AutoReconnect,
            ConnectionFailure,
            NetworkTimeout,
            ServerSelectionTimeoutError,
        )

        _MONGO_CONNECTION_ERRORS = (
            ServerSelectionTimeoutError,
            ConnectionFailure,
            NetworkTimeout,
            AutoReconnect,
        )
    return _MONGO_CONNECTION_ERRORS


def is_mongo_connection_error(exc: BaseException) -> bool:
    return isinstance(exc, mongo_connection_errors())
