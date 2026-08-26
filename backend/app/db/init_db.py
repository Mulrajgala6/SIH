"""Database initialization helpers.

For the prototype we create tables directly from the ORM metadata (no Alembic
migration step needed to get running). Alembic remains available as a clean
extension point for schema evolution later.
"""

from __future__ import annotations

from sqlalchemy import text

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


def ensure_schema() -> None:
    """Safe schema check on startup: create tables and add new columns if SQLite DB already exists."""
    create_all()
    try:
        with engine.connect() as conn:
            # Check users table
            res_users = conn.execute(text("PRAGMA table_info(users)"))
            user_cols = {row[1] for row in res_users.fetchall()}
            if user_cols and "post_office_id" not in user_cols:
                conn.execute(text("ALTER TABLE users ADD COLUMN post_office_id INTEGER REFERENCES post_offices(id)"))
                conn.commit()

            # Check consignments table
            res_cons = conn.execute(text("PRAGMA table_info(consignments)"))
            cons_cols = {row[1] for row in res_cons.fetchall()}
            if cons_cols and "origin_post_office_id" not in cons_cols:
                conn.execute(text("ALTER TABLE consignments ADD COLUMN origin_post_office_id INTEGER REFERENCES post_offices(id)"))
                conn.commit()
            if cons_cols and "bag_number" not in cons_cols:
                conn.execute(text("ALTER TABLE consignments ADD COLUMN bag_number VARCHAR(64)"))
                conn.commit()
    except Exception:
        pass


if __name__ == "__main__":  # `python -m app.db.init_db`
    ensure_schema()
    print("Ensured all tables & columns on", engine.url)
