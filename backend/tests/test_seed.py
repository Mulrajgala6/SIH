"""Seed-script tests (require SQLAlchemy — run on the full-stack machine).

Verifies the demo dataset is internally consistent and has the shape the later
phases (routing, recommender, OTP delivery) depend on.
"""

from app.db.seed import seed
from app.db.session import SessionLocal
from app.models.entities import Consignment, DeliverySlot, OTPVerification
from app.models.enums import ConsignmentStatus, SlotCode


def test_seed_counts():
    counts = seed(verbose=False)
    assert counts["slots"] == 4
    assert counts["post_offices"] == 2
    assert counts["agents"] == 4
    assert counts["recipients"] == 18
    assert counts["addresses"] == 18
    assert counts["active_consignments"] == 18
    assert counts["historical_consignments"] >= 20
    # every confirmed active parcel gets exactly one OTP
    assert counts["otps"] >= 1


def test_seed_integrity():
    seed(verbose=False)
    with SessionLocal() as db:
        # slots are the four canonical windows, correctly ordered
        slots = db.query(DeliverySlot).order_by(DeliverySlot.sort_order).all()
        assert [s.code for s in slots] == [
            SlotCode.MORNING, SlotCode.MIDDAY, SlotCode.AFTERNOON, SlotCode.EVENING
        ]
        for s in slots:
            assert s.start_minutes < s.end_minutes

        # tracking numbers are unique
        tns = [c.tracking_number for c in db.query(Consignment).all()]
        assert len(tns) == len(set(tns))

        # confirmed active consignments have a confirmed slot + at least one OTP
        confirmed = db.query(Consignment).filter_by(
            status=ConsignmentStatus.SLOT_CONFIRMED
        ).all()
        assert confirmed, "expected some SLOT_CONFIRMED consignments to route"
        for c in confirmed:
            assert c.confirmed_slot_id is not None
            otps = db.query(OTPVerification).filter_by(consignment_id=c.id).all()
            assert len(otps) == 1
            assert otps[0].is_used is False

        # pending consignments are genuinely un-confirmed
        pending = db.query(Consignment).filter_by(
            status=ConsignmentStatus.SLOT_PENDING
        ).all()
        assert pending, "expected some SLOT_PENDING consignments awaiting the recipient"
        for c in pending:
            assert c.confirmed_slot_id is None


def test_seed_is_deterministic_and_idempotent():
    first = seed(verbose=False)
    second = seed(verbose=False)  # reset() wipes; fixed RNG seed → identical shape
    assert first == second
