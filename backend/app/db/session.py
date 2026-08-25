"""Database engine and session management.

A single engine/sessionmaker is created from ``settings.database_url``.
SQLite needs ``check_same_thread=False`` when used with FastAPI's threadpool;
PostgreSQL needs no special connect args. ``get_db`` is the FastAPI dependency
that yields a session and always closes it.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings

_is_sqlite = settings.database_url.startswith("sqlite")
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(
    settings.database_url,
    connect_args=_connect_args,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine, autoflush=False, autocommit=False, future=True
)


def get_db() -> Generator[Session, None, None]:
    """FastAPI dependency that provides a scoped database session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
