"""SQLAlchemy ORM models for DAKSYNC (modular monolith, one database).

Design notes
------------
* **DB-agnostic on purpose.** Runs identically on SQLite (zero-config demo) and
  PostgreSQL (docker-compose). We therefore avoid Postgres-only types:
  ``Float`` for coordinates, the generic ``JSON`` type for flexible blobs, and
  ``Enum(..., native_enum=False)`` so enums become ``VARCHAR + CHECK`` instead of
  a native PG enum.
* **Time windows as integers.** Delivery slots / working hours are stored as
  minutes-from-midnight so they feed straight into OR-Tools (Phase 6) and are
  easy to reason about.
* **SQLAlchemy 2.0 typed style** (``Mapped`` / ``mapped_column``). A ``Mapped[X]``
  is NOT NULL; ``Mapped[X | None]`` is nullable.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    DateTime,
    Enum as SAEnum,
    Float,
    ForeignKey,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
from app.models.enums import (
    AttemptOutcome,
    ConsignmentStatus,
    FailureReason,
    NotificationChannel,
    NotificationType,
    PreferenceType,
    Priority,
    Role,
    RouteStatus,
    SlotCode,
    StopStatus,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def enum_col(py_enum, length: int = 32):
    """Portable enum column: stored as VARCHAR + CHECK (works on SQLite & PG)."""
    return SAEnum(py_enum, native_enum=False, length=length, validate_strings=True)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), default=_utcnow, onupdate=_utcnow, nullable=False
    )


# --------------------------------------------------------------------------- #
# Identity & people
# --------------------------------------------------------------------------- #
class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255))
    full_name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    role: Mapped[Role] = mapped_column(enum_col(Role), index=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    agent: Mapped["DeliveryAgent | None"] = relationship(back_populates="user")


class Sender(TimestampMixin, Base):
    __tablename__ = "senders"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    organization: Mapped[str | None] = mapped_column(String(160))

    consignments: Mapped[list["Consignment"]] = relationship(back_populates="sender")


class Recipient(TimestampMixin, Base):
    __tablename__ = "recipients"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    preferred_language: Mapped[str] = mapped_column(String(5), default="en")  # "en" | "hi"
    # Not customer-visible. Seeds a behaviour pattern for the recommender.
    behaviour_note: Mapped[str | None] = mapped_column(String(60))

    addresses: Mapped[list["Address"]] = relationship(
        back_populates="recipient", cascade="all, delete-orphan"
    )
    consignments: Mapped[list["Consignment"]] = relationship(back_populates="recipient")


class Address(TimestampMixin, Base):
    __tablename__ = "addresses"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("recipients.id"), index=True)
    line1: Mapped[str] = mapped_column(String(200))
    line2: Mapped[str | None] = mapped_column(String(200))
    locality: Mapped[str] = mapped_column(String(120), index=True)
    city: Mapped[str] = mapped_column(String(80), default="Nashik")
    state: Mapped[str] = mapped_column(String(80), default="Maharashtra")
    pincode: Mapped[str] = mapped_column(String(10), index=True)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    is_geocoded: Mapped[bool] = mapped_column(Boolean, default=False)

    recipient: Mapped["Recipient"] = relationship(back_populates="addresses")


class PostOffice(TimestampMixin, Base):
    __tablename__ = "post_offices"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[str] = mapped_column(String(20), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(160))
    pincode: Mapped[str] = mapped_column(String(10), index=True)
    latitude: Mapped[float] = mapped_column(Float)
    longitude: Mapped[float] = mapped_column(Float)

    agents: Mapped[list["DeliveryAgent"]] = relationship(back_populates="post_office")


class DeliveryAgent(TimestampMixin, Base):
    """A postman/delivery agent working out of a post office."""

    __tablename__ = "delivery_agents"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"))
    post_office_id: Mapped[int] = mapped_column(ForeignKey("post_offices.id"), index=True)
    name: Mapped[str] = mapped_column(String(120))
    phone: Mapped[str | None] = mapped_column(String(20))
    vehicle: Mapped[str] = mapped_column(String(40), default="TWO_WHEELER")
    work_start_minutes: Mapped[int] = mapped_column(Integer, default=540)   # 09:00
    work_end_minutes: Mapped[int] = mapped_column(Integer, default=1170)    # 19:30 (covers all slots)
    daily_capacity: Mapped[int] = mapped_column(Integer, default=40)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    user: Mapped["User | None"] = relationship(back_populates="agent")
    post_office: Mapped["PostOffice"] = relationship(back_populates="agents")
    routes: Mapped[list["Route"]] = relationship(back_populates="agent")


# --------------------------------------------------------------------------- #
# Delivery slots
# --------------------------------------------------------------------------- #
class DeliverySlot(TimestampMixin, Base):
    __tablename__ = "delivery_slots"

    id: Mapped[int] = mapped_column(primary_key=True)
    code: Mapped[SlotCode] = mapped_column(enum_col(SlotCode), unique=True, index=True)
    label_en: Mapped[str] = mapped_column(String(60))
    label_hi: Mapped[str] = mapped_column(String(60))
    start_minutes: Mapped[int] = mapped_column(Integer)
    end_minutes: Mapped[int] = mapped_column(Integer)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        CheckConstraint("start_minutes < end_minutes", name="ck_slot_window_order"),
    )


# --------------------------------------------------------------------------- #
# Consignments
# --------------------------------------------------------------------------- #
class Consignment(TimestampMixin, Base):
    __tablename__ = "consignments"

    id: Mapped[int] = mapped_column(primary_key=True)
    tracking_number: Mapped[str] = mapped_column(String(20), unique=True, index=True)

    sender_id: Mapped[int] = mapped_column(ForeignKey("senders.id"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("recipients.id"), index=True)
    address_id: Mapped[int] = mapped_column(ForeignKey("addresses.id"), index=True)
    post_office_id: Mapped[int] = mapped_column(ForeignKey("post_offices.id"), index=True)

    status: Mapped[ConsignmentStatus] = mapped_column(
        enum_col(ConsignmentStatus), default=ConsignmentStatus.BOOKED, index=True
    )
    priority: Mapped[Priority] = mapped_column(enum_col(Priority), default=Priority.NORMAL)
    description: Mapped[str | None] = mapped_column(String(200))
    weight_grams: Mapped[int | None] = mapped_column(Integer)

    # Three references to delivery_slots — disambiguated on each relationship.
    requested_slot_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_slots.id"))
    recommended_slot_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_slots.id"))
    confirmed_slot_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_slots.id"))

    delivery_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), index=True)

    sender: Mapped["Sender"] = relationship(back_populates="consignments")
    recipient: Mapped["Recipient"] = relationship(back_populates="consignments")
    address: Mapped["Address"] = relationship()
    post_office: Mapped["PostOffice"] = relationship()

    requested_slot: Mapped["DeliverySlot | None"] = relationship(
        foreign_keys=[requested_slot_id]
    )
    recommended_slot: Mapped["DeliverySlot | None"] = relationship(
        foreign_keys=[recommended_slot_id]
    )
    confirmed_slot: Mapped["DeliverySlot | None"] = relationship(
        foreign_keys=[confirmed_slot_id]
    )

    slot_preferences: Mapped[list["SlotPreference"]] = relationship(
        back_populates="consignment", cascade="all, delete-orphan"
    )
    attempts: Mapped[list["DeliveryAttempt"]] = relationship(
        back_populates="consignment", cascade="all, delete-orphan"
    )
    otps: Mapped[list["OTPVerification"]] = relationship(
        back_populates="consignment", cascade="all, delete-orphan"
    )
    predictions: Mapped[list["ModelPrediction"]] = relationship(
        back_populates="consignment", cascade="all, delete-orphan"
    )


class SlotPreference(TimestampMixin, Base):
    """Audit trail of every slot choice (sender requested / recommended / confirmed / changed)."""

    __tablename__ = "slot_preferences"

    id: Mapped[int] = mapped_column(primary_key=True)
    consignment_id: Mapped[int] = mapped_column(ForeignKey("consignments.id"), index=True)
    slot_id: Mapped[int] = mapped_column(ForeignKey("delivery_slots.id"))
    preference_type: Mapped[PreferenceType] = mapped_column(enum_col(PreferenceType))
    source: Mapped[str | None] = mapped_column(String(40))  # e.g. "recipient", "recommender"

    consignment: Mapped["Consignment"] = relationship(back_populates="slot_preferences")
    slot: Mapped["DeliverySlot"] = relationship()


# --------------------------------------------------------------------------- #
# Routes & delivery execution
# --------------------------------------------------------------------------- #
class Route(TimestampMixin, Base):
    __tablename__ = "routes"

    id: Mapped[int] = mapped_column(primary_key=True)
    post_office_id: Mapped[int] = mapped_column(ForeignKey("post_offices.id"), index=True)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_agents.id"), index=True)
    route_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    status: Mapped[RouteStatus] = mapped_column(
        enum_col(RouteStatus), default=RouteStatus.PLANNED, index=True
    )
    planned_start_minutes: Mapped[int] = mapped_column(Integer, default=600)  # 10:00
    total_distance_m: Mapped[float] = mapped_column(Float, default=0.0)
    total_stops: Mapped[int] = mapped_column(Integer, default=0)
    optimizer: Mapped[str | None] = mapped_column(String(40))  # "ortools" | "nearest_neighbor"
    optimization_meta: Mapped[dict | None] = mapped_column(JSON)

    agent: Mapped["DeliveryAgent | None"] = relationship(back_populates="routes")
    post_office: Mapped["PostOffice"] = relationship()
    stops: Mapped[list["RouteStop"]] = relationship(
        back_populates="route",
        cascade="all, delete-orphan",
        order_by="RouteStop.sequence",
    )


class RouteStop(TimestampMixin, Base):
    __tablename__ = "route_stops"

    id: Mapped[int] = mapped_column(primary_key=True)
    route_id: Mapped[int] = mapped_column(ForeignKey("routes.id"), index=True)
    consignment_id: Mapped[int] = mapped_column(ForeignKey("consignments.id"), index=True)
    sequence: Mapped[int] = mapped_column(Integer)
    status: Mapped[StopStatus] = mapped_column(enum_col(StopStatus), default=StopStatus.PENDING)
    eta_minutes: Mapped[int | None] = mapped_column(Integer)
    distance_from_prev_m: Mapped[float] = mapped_column(Float, default=0.0)
    arrived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    route: Mapped["Route"] = relationship(back_populates="stops")
    consignment: Mapped["Consignment"] = relationship()

    __table_args__ = (
        UniqueConstraint("route_id", "sequence", name="uq_route_stop_sequence"),
    )


class DeliveryAttempt(TimestampMixin, Base):
    __tablename__ = "delivery_attempts"

    id: Mapped[int] = mapped_column(primary_key=True)
    consignment_id: Mapped[int] = mapped_column(ForeignKey("consignments.id"), index=True)
    agent_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_agents.id"))
    route_stop_id: Mapped[int | None] = mapped_column(ForeignKey("route_stops.id"))
    outcome: Mapped[AttemptOutcome] = mapped_column(enum_col(AttemptOutcome))
    failure_reason: Mapped[FailureReason | None] = mapped_column(enum_col(FailureReason))
    notes: Mapped[str | None] = mapped_column(Text)
    attempted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_utcnow)

    consignment: Mapped["Consignment"] = relationship(back_populates="attempts")


class OTPVerification(TimestampMixin, Base):
    __tablename__ = "otp_verifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    consignment_id: Mapped[int] = mapped_column(ForeignKey("consignments.id"), index=True)
    code: Mapped[str] = mapped_column(String(10))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_used: Mapped[bool] = mapped_column(Boolean, default=False)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    consignment: Mapped["Consignment"] = relationship(back_populates="otps")


# --------------------------------------------------------------------------- #
# Notifications & ML audit
# --------------------------------------------------------------------------- #
class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    recipient_id: Mapped[int | None] = mapped_column(ForeignKey("recipients.id"), index=True)
    consignment_id: Mapped[int | None] = mapped_column(ForeignKey("consignments.id"), index=True)
    type: Mapped[NotificationType] = mapped_column(enum_col(NotificationType))
    channel: Mapped[NotificationChannel] = mapped_column(
        enum_col(NotificationChannel), default=NotificationChannel.IN_APP
    )
    title_en: Mapped[str] = mapped_column(String(160))
    title_hi: Mapped[str] = mapped_column(String(160))
    body_en: Mapped[str] = mapped_column(Text)
    body_hi: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False)


class ModelPrediction(TimestampMixin, Base):
    """Audit record of a recommender run — features in, scores out. Never
    surfaced verbatim to customers (raw probabilities stay internal)."""

    __tablename__ = "model_predictions"

    id: Mapped[int] = mapped_column(primary_key=True)
    consignment_id: Mapped[int] = mapped_column(ForeignKey("consignments.id"), index=True)
    recommended_slot_id: Mapped[int | None] = mapped_column(ForeignKey("delivery_slots.id"))
    model_version: Mapped[str] = mapped_column(String(40), default="heuristic-v0")
    features: Mapped[dict | None] = mapped_column(JSON)
    scores: Mapped[dict | None] = mapped_column(JSON)

    consignment: Mapped["Consignment"] = relationship(back_populates="predictions")
    recommended_slot: Mapped["DeliverySlot | None"] = relationship()
