"""ORM model tests (require SQLAlchemy — run on the full-stack machine).

Focus: the schema builds, tables create, and the tricky bits resolve —
especially ``Consignment``'s three separate foreign keys into ``delivery_slots``
(requested / recommended / confirmed).
"""

from datetime import datetime, timezone

from app.db.init_db import reset
from app.db.session import SessionLocal
from app.models.entities import (
    Address,
    Consignment,
    DeliverySlot,
    PostOffice,
    Recipient,
    Sender,
)
from app.models.enums import ConsignmentStatus, SlotCode


def _fresh_db():
    reset()
    return SessionLocal()


def test_metadata_creates_all_tables():
    reset()
    from app.db.base import Base

    expected = {
        "users", "senders", "recipients", "addresses", "post_offices",
        "delivery_agents", "delivery_slots", "consignments", "slot_preferences",
        "routes", "route_stops", "delivery_attempts", "otp_verifications",
        "notifications", "model_predictions",
    }
    assert expected.issubset(set(Base.metadata.tables.keys()))


def test_consignment_three_slot_fks_resolve():
    with _fresh_db() as db:
        morning = DeliverySlot(code=SlotCode.MORNING, label_en="Morning", label_hi="सुबह",
                               start_minutes=600, end_minutes=720, sort_order=1)
        evening = DeliverySlot(code=SlotCode.EVENING, label_en="Evening", label_hi="शाम",
                               start_minutes=1020, end_minutes=1140, sort_order=4)
        po = PostOffice(code="NSK-HO", name="HO", pincode="422001",
                        latitude=19.99, longitude=73.78)
        sender = Sender(name="Test Sender")
        db.add_all([morning, evening, po, sender])
        db.flush()

        recipient = Recipient(name="Test User", phone="9990001111", preferred_language="en")
        db.add(recipient)
        db.flush()
        addr = Address(recipient_id=recipient.id, line1="1, CIDCO", locality="CIDCO",
                       pincode="422001", latitude=19.96, longitude=73.75, is_geocoded=True)
        db.add(addr)
        db.flush()

        cons = Consignment(
            tracking_number="DA000000001IN",
            sender_id=sender.id, recipient_id=recipient.id, address_id=addr.id,
            post_office_id=po.id, status=ConsignmentStatus.SLOT_CONFIRMED,
            requested_slot_id=morning.id, recommended_slot_id=evening.id,
            confirmed_slot_id=evening.id, delivery_date=datetime.now(timezone.utc),
        )
        db.add(cons)
        db.commit()

        loaded = db.query(Consignment).filter_by(tracking_number="DA000000001IN").one()
        assert loaded.requested_slot.code == SlotCode.MORNING
        assert loaded.recommended_slot.code == SlotCode.EVENING
        assert loaded.confirmed_slot.code == SlotCode.EVENING
        # Enum round-trips as the Python enum, not a raw string.
        assert loaded.status == ConsignmentStatus.SLOT_CONFIRMED


def test_relationship_backrefs_and_cascade():
    with _fresh_db() as db:
        recipient = Recipient(name="Casc User", phone="9992223333", preferred_language="hi")
        db.add(recipient)
        db.flush()
        addr = Address(recipient_id=recipient.id, line1="9, Panchavati", locality="Panchavati",
                       pincode="422003", latitude=20.01, longitude=73.79, is_geocoded=True)
        db.add(addr)
        db.commit()

        # back_populates works both directions
        assert recipient.addresses[0].locality == "Panchavati"
        assert addr.recipient.name == "Casc User"

        # delete-orphan cascade removes the child address
        db.delete(recipient)
        db.commit()
        assert db.query(Address).count() == 0
