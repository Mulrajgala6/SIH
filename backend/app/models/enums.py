"""Domain enumerations for DAKSYNC.

All enums are ``str``-based so they serialize cleanly in JSON/APIs and are
stored as portable VARCHAR + CHECK columns (``native_enum=False``) — which keeps
the schema identical on SQLite and PostgreSQL.
"""

import enum


class Role(str, enum.Enum):
    ADMIN = "ADMIN"
    SUPERVISOR = "SUPERVISOR"
    POSTMAN = "POSTMAN"
    SENDER = "SENDER"
    RECIPIENT = "RECIPIENT"


class ConsignmentStatus(str, enum.Enum):
    """Delivery status vocabulary (matches the UI/UX spec, §11)."""

    BOOKED = "BOOKED"
    COLLECTED = "COLLECTED"
    SORTED = "SORTED"
    SLOT_PENDING = "SLOT_PENDING"
    SLOT_CONFIRMED = "SLOT_CONFIRMED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"
    DELIVERY_FAILED = "DELIVERY_FAILED"
    RESCHEDULED = "RESCHEDULED"
    RETURNED = "RETURNED"


class Priority(str, enum.Enum):
    NORMAL = "NORMAL"
    HIGH = "HIGH"
    URGENT = "URGENT"


class SlotCode(str, enum.Enum):
    """Stable codes for the seeded delivery windows."""

    MORNING = "MORNING"
    MIDDAY = "MIDDAY"
    AFTERNOON = "AFTERNOON"
    EVENING = "EVENING"


class PreferenceType(str, enum.Enum):
    SENDER_REQUESTED = "SENDER_REQUESTED"
    RECOMMENDED = "RECOMMENDED"
    RECIPIENT_CONFIRMED = "RECIPIENT_CONFIRMED"
    CHANGED = "CHANGED"


class RouteStatus(str, enum.Enum):
    PLANNED = "PLANNED"
    DISPATCHED = "DISPATCHED"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"


class StopStatus(str, enum.Enum):
    PENDING = "PENDING"
    ARRIVED = "ARRIVED"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"
    SKIPPED = "SKIPPED"


class AttemptOutcome(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"


class FailureReason(str, enum.Enum):
    RECIPIENT_UNAVAILABLE = "RECIPIENT_UNAVAILABLE"
    WRONG_ADDRESS = "WRONG_ADDRESS"
    REFUSED = "REFUSED"
    OTHER = "OTHER"


class NotificationType(str, enum.Enum):
    SCHEDULED = "SCHEDULED"
    SLOT_REQUEST = "SLOT_REQUEST"
    SLOT_CHANGED = "SLOT_CHANGED"
    OUT_FOR_DELIVERY = "OUT_FOR_DELIVERY"
    DELIVERED = "DELIVERED"


class NotificationChannel(str, enum.Enum):
    IN_APP = "IN_APP"
    MOCK_SMS = "MOCK_SMS"
    MOCK_WHATSAPP = "MOCK_WHATSAPP"
