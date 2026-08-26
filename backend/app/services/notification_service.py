"""Notifications (in-app; mock SMS/WhatsApp are just other channels).

Bilingual by construction — every notification carries EN + HI text so the UI
can render either without a translation round-trip.
"""

from __future__ import annotations

from sqlalchemy.orm import Session

from app.models.entities import Notification
from app.models.enums import NotificationChannel, NotificationType


def notify(
    db: Session,
    *,
    recipient_id: int | None,
    consignment_id: int | None,
    type: NotificationType,
    title_en: str,
    title_hi: str,
    body_en: str,
    body_hi: str,
    channel: NotificationChannel = NotificationChannel.IN_APP,
    commit: bool = False,
) -> Notification:
    n = Notification(
        recipient_id=recipient_id, consignment_id=consignment_id, type=type,
        channel=channel, title_en=title_en, title_hi=title_hi,
        body_en=body_en, body_hi=body_hi,
    )
    db.add(n)
    if commit:
        db.commit()
        db.refresh(n)
    return n


def notify_slot_request(db: Session, recipient_id: int, consignment_id: int, tracking: str):
    return notify(
        db, recipient_id=recipient_id, consignment_id=consignment_id,
        type=NotificationType.SLOT_REQUEST,
        title_en="Choose your delivery time", title_hi="अपना डिलीवरी समय चुनें",
        body_en=f"Parcel {tracking} is ready. Please pick a convenient slot.",
        body_hi=f"पार्सल {tracking} तैयार है। कृपया एक सुविधाजनक समय चुनें।",
    )


def notify_scheduled(db: Session, recipient_id: int, consignment_id: int, tracking: str,
                     slot_label_en: str, slot_label_hi: str):
    return notify(
        db, recipient_id=recipient_id, consignment_id=consignment_id,
        type=NotificationType.SCHEDULED,
        title_en="Delivery scheduled", title_hi="डिलीवरी निर्धारित",
        body_en=f"Parcel {tracking} will arrive in the {slot_label_en}.",
        body_hi=f"पार्सल {tracking} {slot_label_hi} में आएगा।",
    )


def notify_out_for_delivery(db: Session, recipient_id: int, consignment_id: int, tracking: str):
    return notify(
        db, recipient_id=recipient_id, consignment_id=consignment_id,
        type=NotificationType.OUT_FOR_DELIVERY,
        title_en="Out for delivery", title_hi="डिलीवरी के लिए निकला",
        body_en=f"Parcel {tracking} is out for delivery. Please keep your OTP ready.",
        body_hi=f"पार्सल {tracking} डिलीवरी के लिए निकल चुका है। कृपया अपना OTP तैयार रखें।",
    )


def notify_delivered(db: Session, recipient_id: int, consignment_id: int, tracking: str):
    return notify(
        db, recipient_id=recipient_id, consignment_id=consignment_id,
        type=NotificationType.DELIVERED,
        title_en="Delivered", title_hi="वितरित",
        body_en=f"Parcel {tracking} has been delivered. Thank you!",
        body_hi=f"पार्सल {tracking} वितरित कर दिया गया है। धन्यवाद!",
    )
