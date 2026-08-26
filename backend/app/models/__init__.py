"""Model package.

Importing this package registers every ORM class on ``Base.metadata`` so that
``create_all`` / Alembic autogenerate see the full schema.
"""

from app.models.entities import (
    Address,
    Consignment,
    DeliveryAgent,
    DeliveryAttempt,
    DeliverySlot,
    ModelPrediction,
    Notification,
    OTPVerification,
    PostOffice,
    Recipient,
    Route,
    RouteStop,
    Sender,
    SlotPreference,
    User,
)
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

__all__ = [
    # entities
    "Address",
    "Consignment",
    "DeliveryAgent",
    "DeliveryAttempt",
    "DeliverySlot",
    "ModelPrediction",
    "Notification",
    "OTPVerification",
    "PostOffice",
    "Recipient",
    "Route",
    "RouteStop",
    "Sender",
    "SlotPreference",
    "User",
    # enums
    "AttemptOutcome",
    "ConsignmentStatus",
    "FailureReason",
    "NotificationChannel",
    "NotificationType",
    "PreferenceType",
    "Priority",
    "Role",
    "RouteStatus",
    "SlotCode",
    "StopStatus",
]
