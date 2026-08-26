"""Consignment service (Phase 2 core + wiring for later phases).

Turns a create request into a fully-formed parcel: resolves/creates the sender
and recipient, stores + geocodes the address, assigns the serving post office,
mints an India-Post-style tracking number, and puts the parcel into
SLOT_PENDING so the recipient can choose a time.
"""

from __future__ import annotations

from datetime import datetime, timezone
import random

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
def create_consignment(
    db: Session,
    payload: ConsignmentCreate,
    current_user_id: int | None = None,
) -> Consignment:
    sender = _resolve_sender(db, payload)
    recipient = _resolve_recipient(db, payload)
    address = _create_address(db, recipient.id, payload)
    dest_po = pick_post_office(db, address.pincode, address.latitude, address.longitude)

    # Origin post office: drop-off counter chosen by sender or closest to sender
    origin_po_id = payload.origin_post_office_id or dest_po.id

    requested_slot: DeliverySlot | None = None
    if payload.requested_slot_code:
        try:
            code = SlotCode(payload.requested_slot_code)
            requested_slot = db.query(DeliverySlot).filter_by(code=code).first()
        except ValueError:
            requested_slot = None

    # Status: If inter-region (e.g. Nashik to Mumbai), start at BOOKED;
    # if local intra-hub, start at SLOT_PENDING for immediate recipient slot selection.
    initial_status = (
        ConsignmentStatus.BOOKED
        if origin_po_id != dest_po.id
        else ConsignmentStatus.SLOT_PENDING
    )

    cons = Consignment(
        tracking_number=_next_tracking_number(db),
        sender_id=sender.id,
        recipient_id=recipient.id,
        address_id=address.id,
        post_office_id=dest_po.id,
        origin_post_office_id=origin_po_id,
        status=initial_status,
        priority=payload.priority or Priority.NORMAL,
        description=payload.description,
        weight_grams=payload.weight_grams,
        requested_slot_id=requested_slot.id if requested_slot else None,
    )
    db.add(cons)
    db.flush()

    if requested_slot is not None:
        db.add(
            SlotPreference(
                consignment_id=cons.id,
                slot_id=requested_slot.id,
                preference_type=PreferenceType.SENDER_REQUESTED,
                source="sender",
            )
        )

    notification_service.notify_slot_request(
        db, recipient.id, cons.id, cons.tracking_number
    )

    db.commit()
    db.refresh(cons)
    return cons


def get_outgoing_groups(db: Session, origin_post_office_id: int) -> list[dict[str, any]]:
    """Group booked parcels at an origin office by their destination post office for clubbing."""
    # Parcels currently at this origin post office needing inter-region transit
    consignments = (
        db.query(Consignment)
        .filter(
            Consignment.origin_post_office_id == origin_post_office_id,
            Consignment.post_office_id != origin_post_office_id,
            Consignment.status.in_([ConsignmentStatus.BOOKED, ConsignmentStatus.RECEIVED_AT_ORIGIN]),
        )
        .all()
    )

    # Group by destination post office
    groups_by_dest: dict[int, list[Consignment]] = {}
    for c in consignments:
        groups_by_dest.setdefault(c.post_office_id, []).append(c)

    results = []
    for dest_id, items in groups_by_dest.items():
        dest_po = db.get(PostOffice, dest_id)
        if dest_po:
            total_weight = sum((item.weight_grams or 0) for item in items)
            results.append(
                {
                    "destination_post_office": dest_po,
                    "consignment_count": len(items),
                    "total_weight_grams": total_weight,
                    "consignments": items,
                }
            )
    return results


def dispatch_transit_bag(
    db: Session,
    origin_post_office_id: int,
    destination_post_office_id: int,
    consignment_ids: list[int],
    custom_bag_number: str | None = None,
) -> dict[str, any]:
    """Club selected parcels into a sealed transit bag and dispatch to destination regional hub."""
    origin_po = db.get(PostOffice, origin_post_office_id)
    dest_po = db.get(PostOffice, destination_post_office_id)
    if not origin_po or not dest_po:
        raise ValueError("Invalid origin or destination post office.")

    clean_orig = origin_po.code.replace("-", "")[:3].upper()
    clean_dest = dest_po.code.replace("-", "")[:3].upper()
    bag_number = custom_bag_number or f"BAG-{clean_orig}-{clean_dest}-{random.randint(100, 999)}"

    consignments = (
        db.query(Consignment)
        .filter(
            Consignment.id.in_(consignment_ids),
            Consignment.origin_post_office_id == origin_post_office_id,
            Consignment.post_office_id == destination_post_office_id,
        )
        .all()
    )

    if not consignments:
        raise ValueError("No matching consignments found to dispatch.")

    updated_ids = []
    for c in consignments:
        c.bag_number = bag_number
        c.status = ConsignmentStatus.IN_TRANSIT
        updated_ids.append(c.id)

    db.commit()

    return {
        "bag_number": bag_number,
        "origin_post_office": origin_po,
        "destination_post_office": dest_po,
        "dispatched_count": len(updated_ids),
        "consignment_ids": updated_ids,
        "status": "IN_TRANSIT",
    }


def receive_transit_bag(
    db: Session,
    destination_post_office_id: int,
    bag_number: str,
) -> dict[str, any]:
    """Receive and unbag incoming transit batch at destination regional hub, preparing parcels for local delivery."""
    dest_po = db.get(PostOffice, destination_post_office_id)
    if not dest_po:
        raise ValueError("Invalid destination post office.")

    clean_bag = bag_number.strip().upper()

    consignments = (
        db.query(Consignment)
        .filter(
            func.upper(Consignment.bag_number) == clean_bag,
            Consignment.post_office_id == destination_post_office_id,
            Consignment.status == ConsignmentStatus.IN_TRANSIT,
        )
        .all()
    )

    if not consignments:
        # Check if bag was already received
        already = (
            db.query(Consignment)
            .filter(
                func.upper(Consignment.bag_number) == clean_bag,
                Consignment.post_office_id == destination_post_office_id,
            )
            .all()
        )
        if already:
            raise ValueError(f"Bag {bag_number} has already been received & unbagged.")
        raise ValueError(
            f"No in-transit parcels found with bag number {bag_number} bound for {dest_po.name}."
        )

    # Find a default slot to ensure parcels can be routed today
    default_slot = db.query(DeliverySlot).order_by(DeliverySlot.sort_order.asc()).first()
    today_dt = datetime.now(timezone.utc)

    updated_ids = []
    for c in consignments:
        # Mark as SLOT_CONFIRMED and set delivery_date to today so it appears in the regional route optimizer
        c.status = ConsignmentStatus.SLOT_CONFIRMED
        c.delivery_date = today_dt
        if c.confirmed_slot_id is None:
            assigned_slot = (
                c.recommended_slot_id
                or c.requested_slot_id
                or (default_slot.id if default_slot else None)
            )
            c.confirmed_slot_id = assigned_slot
            if assigned_slot:
                db.add(
                    SlotPreference(
                        consignment_id=c.id,
                        slot_id=assigned_slot,
                        preference_type=PreferenceType.RECIPIENT_CONFIRMED,
                        source="transit_unbagging",
                    )
                )
        updated_ids.append(c.id)

    db.commit()

    return {
        "bag_number": clean_bag,
        "destination_post_office": dest_po,
        "unbagged_count": len(updated_ids),
        "consignment_ids": updated_ids,
        "status": "RECEIVED_AT_DESTINATION",
    }


def get_incoming_bags(db: Session, destination_post_office_id: int) -> list[dict[str, any]]:
    """List all in-transit bags currently on their way to this destination post office."""
    consignments = (
        db.query(Consignment)
        .filter(
            Consignment.post_office_id == destination_post_office_id,
            Consignment.status == ConsignmentStatus.IN_TRANSIT,
            Consignment.bag_number.isnot(None),
        )
        .all()
    )

    bags_map: dict[str, list[Consignment]] = {}
    for c in consignments:
        if c.bag_number:
            bags_map.setdefault(c.bag_number, []).append(c)

    results = []
    for bag_no, items in bags_map.items():
        origin_po = (
            items[0].origin_post_office
            or (db.get(PostOffice, items[0].origin_post_office_id) if items[0].origin_post_office_id else None)
            or db.get(PostOffice, destination_post_office_id)
        )
        results.append(
            {
                "bag_number": bag_no,
                "origin_post_office": origin_po,
                "destination_post_office": db.get(PostOffice, destination_post_office_id),
                "item_count": len(items),
                "total_weight_grams": sum((item.weight_grams or 0) for item in items),
                "consignments": items,
                "status": "IN_TRANSIT",
            }
        )
    return results


def get_consignment(db: Session, consignment_id: int) -> Consignment | None:
    return db.get(Consignment, consignment_id)


def get_by_tracking(db: Session, tracking_number: str) -> Consignment | None:
    return db.query(Consignment).filter_by(tracking_number=tracking_number).first()


def list_consignments(
    db: Session,
    status: ConsignmentStatus | None = None,
    post_office_id: int | None = None,
    origin_post_office_id: int | None = None,
    q: str | None = None,
    limit: int = 200,
) -> list[Consignment]:
    query = db.query(Consignment)
    if status is not None:
        query = query.filter(Consignment.status == status)
    if post_office_id is not None:
        query = query.filter(Consignment.post_office_id == post_office_id)
    if origin_post_office_id is not None:
        query = query.filter(Consignment.origin_post_office_id == origin_post_office_id)
    if q:
        like = f"%{q}%"
        query = query.join(Recipient, Consignment.recipient_id == Recipient.id).filter(
            or_(
                Consignment.tracking_number.ilike(like),
                Recipient.name.ilike(like),
                Consignment.bag_number.ilike(like),
            )
        )
    return query.order_by(Consignment.created_at.desc()).limit(limit).all()


def list_my_sent(
    db: Session,
    sender_name: str | None = None,
    phone: str | None = None,
    user_id: int | None = None,
) -> list[Consignment]:
    """Find all consignments booked by this sender."""
    query = db.query(Consignment).join(Sender, Consignment.sender_id == Sender.id)
    filters = []
    if sender_name:
        filters.append(Sender.name.ilike(f"%{sender_name}%"))
    if phone:
        filters.append(Sender.phone == phone)
    if user_id:
        filters.append(Sender.user_id == user_id)

    if filters:
        query = query.filter(or_(*filters))
    return query.order_by(Consignment.created_at.desc()).limit(100).all()


def list_my_received(
    db: Session,
    phone: str | None = None,
    user_id: int | None = None,
) -> list[Consignment]:
    """Find all consignments addressed to this recipient."""
    query = db.query(Consignment).join(Recipient, Consignment.recipient_id == Recipient.id)
    filters = []
    if phone:
        filters.append(Recipient.phone == phone)
    if user_id:
        filters.append(Recipient.user_id == user_id)

    if filters:
        query = query.filter(or_(*filters))
    return query.order_by(Consignment.created_at.desc()).limit(100).all()


def update_consignment(
    db: Session,
    consignment_id: int,
    status: ConsignmentStatus | None = None,
    priority: Priority | None = None,
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
