"""Database initialization helpers.

For the prototype we create tables directly from the ORM metadata (no Alembic
migration step needed to get running). Alembic remains available as a clean
extension point for schema evolution later.
"""

from __future__ import annotations

from app.db.base import Base
from app.db.session import engine

# Importing the models package registers all tables on Base.metadata.
import app.models  # noqa: F401


def create_all() -> None:
    """Create every table that does not yet exist."""
    Base.metadata.create_all(bind=engine)


def drop_all() -> None:
    """Drop every known table. Destructive — used by reset()/tests."""
    Base.metadata.drop_all(bind=engine)


def reset() -> None:
    """Drop then recreate all tables (clean slate for seeding/demo)."""
    drop_all()
    create_all()


if __name__ == "__main__":  # `python -m app.db.init_db`
    create_all()
    print("Created all tables on", engine.url)
