"""Delivery-execution + OTP schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from app.models.enums import ConsignmentStatus, FailureReason


class StartDeliveryResponse(BaseModel):
    consignment_id: int
    status: ConsignmentStatus
    otp_sent: bool = True
    # Demo convenience only — the app surfaces this so presenters can read the
    # OTP without a real SMS gateway. Guarded by settings.demo_mode.
    demo_otp: str | None = None


class VerifyOtpRequest(BaseModel):
    consignment_id: int
    code: str


class VerifyOtpResponse(BaseModel):
    verified: bool
    status: ConsignmentStatus
    attempts_remaining: int | None = None
    detail: str | None = None


class CompleteDeliveryRequest(BaseModel):
    consignment_id: int


class FailDeliveryRequest(BaseModel):
    consignment_id: int
    reason: FailureReason
    notes: str | None = None


class DeliveryResultOut(BaseModel):
    consignment_id: int
    status: ConsignmentStatus
    delivered_at: datetime | None = None
