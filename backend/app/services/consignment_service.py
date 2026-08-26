"""Consignment service (Phase 2 core + wiring for later phases).

Turns a create request into a fully-formed parcel: resolves/creates the sender
and recipient, stores + geocodes the address, assigns the serving post office,
mints an India-Post-style tracking number, and puts the parcel into
SLOT_PENDING so the recipient can choose a time.
"""

from __future__ import annotations

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.models.entities import (
    Address,
    Consignment,
    DeliverySlot,
    PostOffice,
    Recipient,
    Sender,
    SlotPreference,
)
from app.models.enums import ConsignmentStatus, PreferenceType, Priority, SlotCode
from app.schemas.consignment import ConsignmentCreate
from app.services import geocoding, notification_service
from app.utils.geo import haversine_m
from app.utils.tracking import generate_tracking_number

_TRACKING_BASE = 500_000


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _next_tracking_number(db: Session) -> str:
    seq = _TRACKING_BASE + (db.query(func.count(Consignment.id)).scalar() or 0)
    # Guard against collisions with seeded/historical numbers.
    while db.query(Consignment.id).filter_by(
        tracking_number=generate_tracking_number(seq)
    ).first():
        seq += 1
    return generate_tracking_number(seq)


def pick_post_office(db: Session, pincode: str, lat: float | None, lng: float | None) -> PostOffice:
    exact = db.query(PostOffice).filter_by(pincode=pincode).first()
    if exact:
        return exact
    offices = db.query(PostOffice).all()
    if not offices:
        raise ValueError("No post offices configured — run the seed script.")
    if lat is not None and lng is not None:
        return min(offices, key=lambda o: haversine_m(lat, lng, o.latitude, o.longitude))
    return offices[0]


def _resolve_sender(db: Session, payload: ConsignmentCreate) -> Sender:
    if payload.sender_id is not None:
        sender = db.get(Sender, payload.sender_id)
        if sender:
            return sender
    name = (payload.sender_name or "Walk-in Sender").strip()
    existing = db.query(Sender).filter(Sender.name == name).first()
    if existing:
        return existing
    sender = Sender(name=name)
    db.add(sender)
    db.flush()
    return sender


def _resolve_recipient(db: Session, payload: ConsignmentCreate) -> Recipient:
    r = payload.recipient
    existing = db.query(Recipient).filter(Recipient.phone == r.phone).first()
    if existing:
        # keep the profile fresh but preserve history linkage via phone
        existing.name = r.name or existing.name
        existing.preferred_language = r.preferred_language or existing.preferred_language
        return existing
    recipient = Recipient(name=r.name, phone=r.phone, preferred_language=r.preferred_language)
    db.add(recipient)
    db.flush()
    return recipient


def _create_address(db: Session, recipient_id: int, payload: ConsignmentCreate) -> Address:
    a = payload.address
    lat, lng = a.latitude, a.longitude
    geocoded = lat is not None and lng is not None
    if not geocoded:
        result = geocoding.geocode(a.locality, a.city, a.pincode)
        if result is not None:
            lat, lng, geocoded = result.latitude, result.longitude, True
    address = Address(
        recipient_id=recipient_id, line1=a.line1, line2=a.line2, locality=a.locality,
        city=a.city, state=a.state, pincode=a.pincode,
        latitude=lat, longitude=lng, is_geocoded=geocoded,
    )
    db.add(address)
    db.flush()
    return address


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def create_consignment(db: Session, payload: ConsignmentCreate) -> Consignment:
    sender = _resolve_sender(db, payload)
    recipient = _resolve_recipient(db, payload)
    address = _create_address(db, recipient.id, payload)
    po = pick_post_office(db, address.pincode, address.latitude, address.longitude)

    requested_slot: DeliverySlot | None = None
    if payload.requested_slot_code:
        try:
            code = SlotCode(payload.requested_slot_code)
            requested_slot = db.query(DeliverySlot).filter_by(code=code).first()
        except ValueError:
            requested_slot = None

    cons = Consignment(
        tracking_number=_next_tracking_number(db),
        sender_id=sender.id, recipient_id=recipient.id, address_id=address.id,
        post_office_id=po.id, status=ConsignmentStatus.SLOT_PENDING,
        priority=payload.priority or Priority.NORMAL,
        description=payload.description, weight_grams=payload.weight_grams,
        requested_slot_id=requested_slot.id if requested_slot else None,
    )
    db.add(cons)
    db.flush()

    if requested_slot is not None:
        db.add(SlotPreference(
            consignment_id=cons.id, slot_id=requested_slot.id,
            preference_type=PreferenceType.SENDER_REQUESTED, source="sender",
        ))

    notification_service.notify_slot_request(db, recipient.id, cons.id, cons.tracking_number)

    db.commit()
    db.refresh(cons)
    return cons


def get_consignment(db: Session, consignment_id: int) -> Consignment | None:
    return db.get(Consignment, consignment_id)


def get_by_tracking(db: Session, tracking_number: str) -> Consignment | None:
    return db.query(Consignment).filter_by(tracking_number=tracking_number).first()


def list_consignments(
    db: Session,
    status: ConsignmentStatus | None = None,
    post_office_id: int | None = None,
    q: str | None = None,
    limit: int = 200,
) -> list[Consignment]:
    query = db.query(Consignment)
    if status is not None:
        query = query.filter(Consignment.status == status)
    if post_office_id is not None:
        query = query.filter(Consignment.post_office_id == post_office_id)
    if q:
        like = f"%{q}%"
        query = query.join(Recipient, Consignment.recipient_id == Recipient.id).filter(
            or_(Consignment.tracking_number.ilike(like), Recipient.name.ilike(like))
        )
    return query.order_by(Consignment.created_at.desc()).limit(limit).all()


def update_consignment(
    db: Session, consignment_id: int,
    status: ConsignmentStatus | None = None, priority: Priority | None = None,
) -> Consignment | None:
    cons = db.get(Consignment, consignment_id)
    if cons is None:
        return None
    if status is not None:
        cons.status = status
    if priority is not None:
        cons.priority = priority
    db.commit()
    db.refresh(cons)
    return cons
