"""Delivery execution + OTP verification (Phase 9).

Lifecycle:  start → (verify OTP) → complete | fail

* Starting a delivery mints a **fresh, single-use** OTP and invalidates any
  previous unused OTP for the parcel.
* Verification is delegated to the pure ``app.utils.otp.check_otp`` (single-use,
  expiry, attempt-limit) — this service only persists the outcome.
* Completion requires a successfully verified OTP.
"""

from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.entities import Consignment, DeliveryAttempt, OTPVerification, RouteStop
from app.models.enums import (
    AttemptOutcome,
    ConsignmentStatus,
    FailureReason,
    StopStatus,
)
from app.schemas.delivery import (
    DeliveryResultOut,
    StartDeliveryResponse,
    VerifyOtpResponse,
)
from app.services import notification_service
from app.utils.otp import check_otp, expiry_from, generate_otp


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _latest_otp(db: Session, consignment_id: int) -> OTPVerification | None:
    return (
        db.query(OTPVerification)
        .filter(OTPVerification.consignment_id == consignment_id)
        .order_by(OTPVerification.id.desc())
        .first()
    )


def _latest_stop(db: Session, consignment_id: int) -> RouteStop | None:
    return (
        db.query(RouteStop)
        .filter(RouteStop.consignment_id == consignment_id)
        .order_by(RouteStop.id.desc())
        .first()
    )


def start_delivery(db: Session, consignment_id: int) -> StartDeliveryResponse:
    cons = db.get(Consignment, consignment_id)
    if cons is None:
        raise ValueError("Consignment not found")
    if cons.status not in (ConsignmentStatus.SLOT_CONFIRMED, ConsignmentStatus.OUT_FOR_DELIVERY):
        raise ValueError(f"Cannot start delivery from status {cons.status.value}")

    # Invalidate any previous unused OTP, then mint a fresh single-use code.
    for old in db.query(OTPVerification).filter_by(consignment_id=cons.id, is_used=False).all():
        old.is_used = True
    code = generate_otp(settings.otp_length)
    otp = OTPVerification(
        consignment_id=cons.id, code=code,
        expires_at=expiry_from(_now(), settings.otp_ttl_seconds),
    )
    db.add(otp)

    cons.status = ConsignmentStatus.OUT_FOR_DELIVERY
    stop = _latest_stop(db, cons.id)
    if stop is not None:
        stop.status = StopStatus.ARRIVED
        stop.arrived_at = _now()

    notification_service.notify_out_for_delivery(db, cons.recipient_id, cons.id, cons.tracking_number)
    db.commit()

    return StartDeliveryResponse(
        consignment_id=cons.id, status=cons.status, otp_sent=True,
        demo_otp=code if settings.demo_mode else None,
    )


def verify_otp(db: Session, consignment_id: int, code: str) -> VerifyOtpResponse:
    cons = db.get(Consignment, consignment_id)
    if cons is None:
        raise ValueError("Consignment not found")
    otp = _latest_otp(db, consignment_id)

    decision = check_otp(
        stored_code=otp.code if otp else None,
        given_code=code,
        attempts_before=otp.attempts if otp else 0,
        max_attempts=settings.otp_max_attempts,
        expires_at=otp.expires_at if otp else None,
        is_used=otp.is_used if otp else True,
        now=_now(),
    )

    if otp is not None and decision.reason in ("mismatch", "expired", "ok"):
        otp.attempts += 1
    if decision.verified and otp is not None:
        otp.is_used = True
        otp.verified_at = _now()

    db.commit()
    detail = {
        "ok": "OTP verified", "mismatch": "Incorrect OTP", "expired": "OTP expired",
        "used": "OTP already used", "locked": "Too many attempts", "missing": "No active OTP",
    }.get(decision.reason)
    return VerifyOtpResponse(
        verified=decision.verified, status=cons.status,
        attempts_remaining=decision.attempts_remaining, detail=detail,
    )


def complete_delivery(db: Session, consignment_id: int) -> DeliveryResultOut:
    cons = db.get(Consignment, consignment_id)
    if cons is None:
        raise ValueError("Consignment not found")

    verified = (
        db.query(OTPVerification)
        .filter_by(consignment_id=cons.id, is_used=True)
        .filter(OTPVerification.verified_at.isnot(None))
        .first()
    )
    if verified is None:
        raise ValueError("OTP not verified — cannot complete delivery")

    now = _now()
    cons.status = ConsignmentStatus.DELIVERED
    db.add(DeliveryAttempt(
        consignment_id=cons.id, outcome=AttemptOutcome.SUCCESS, attempted_at=now,
    ))
    stop = _latest_stop(db, cons.id)
    if stop is not None:
        stop.status = StopStatus.COMPLETED
        stop.completed_at = now

    notification_service.notify_delivered(db, cons.recipient_id, cons.id, cons.tracking_number)
    db.commit()
    return DeliveryResultOut(consignment_id=cons.id, status=cons.status, delivered_at=now)


def fail_delivery(
    db: Session, consignment_id: int, reason: FailureReason, notes: str | None = None
) -> DeliveryResultOut:
    cons = db.get(Consignment, consignment_id)
    if cons is None:
        raise ValueError("Consignment not found")

    now = _now()
    cons.status = ConsignmentStatus.DELIVERY_FAILED
    db.add(DeliveryAttempt(
        consignment_id=cons.id, outcome=AttemptOutcome.FAILED,
        failure_reason=reason, notes=notes, attempted_at=now,
    ))
    stop = _latest_stop(db, cons.id)
    if stop is not None:
        stop.status = StopStatus.FAILED

    db.commit()
    return DeliveryResultOut(consignment_id=cons.id, status=cons.status, delivered_at=None)
