"""Delivery-execution routes: start, verify OTP, complete, fail.

These are field operations performed by the postman (supervisor/admin may act on
their behalf). Starting a delivery mints a fresh single-use OTP; in demo mode the
code is returned in the response so presenters can read it without an SMS gateway.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import call_service, get_db, require_roles
from app.models.enums import Role
from app.schemas.delivery import (
    CompleteDeliveryRequest,
    DeliveryResultOut,
    FailDeliveryRequest,
    StartDeliveryResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services import delivery_service

router = APIRouter(prefix="/deliveries", tags=["deliveries"])

_FIELD = require_roles(Role.POSTMAN, Role.SUPERVISOR, Role.ADMIN)


@router.post("/start/{consignment_id}", response_model=StartDeliveryResponse)
def start(consignment_id: int, db: Session = Depends(get_db), _user=Depends(_FIELD)) -> StartDeliveryResponse:
    return call_service(delivery_service.start_delivery, db, consignment_id)


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp(payload: VerifyOtpRequest, db: Session = Depends(get_db), _user=Depends(_FIELD)) -> VerifyOtpResponse:
    return call_service(delivery_service.verify_otp, db, payload.consignment_id, payload.code)


@router.post("/complete", response_model=DeliveryResultOut)
def complete(payload: CompleteDeliveryRequest, db: Session = Depends(get_db), _user=Depends(_FIELD)) -> DeliveryResultOut:
    return call_service(delivery_service.complete_delivery, db, payload.consignment_id)


@router.post("/fail", response_model=DeliveryResultOut)
def fail(payload: FailDeliveryRequest, db: Session = Depends(get_db), _user=Depends(_FIELD)) -> DeliveryResultOut:
    return call_service(delivery_service.fail_delivery, db, payload.consignment_id, payload.reason, payload.notes)
