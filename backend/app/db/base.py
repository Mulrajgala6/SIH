"""SQLAlchemy declarative base.

All ORM models inherit from ``Base`` so that a single ``Base.metadata`` knows
about every table (used by ``create_all`` and Alembic autogenerate).
"""

from sqlalchemy.orm import DeclarativeBase


class Base(DeclarativeBase):
    pass
