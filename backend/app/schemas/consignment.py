"""Consignment (parcel) schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import ConsignmentStatus, Priority
from app.schemas.post_office import PostOfficeBrief
from app.schemas.slot import SlotOut


class AddressIn(BaseModel):
    line1: str
    line2: str | None = None
    locality: str
    city: str = "Nashik"
    state: str = "Maharashtra"
    pincode: str
    latitude: float | None = None
    longitude: float | None = None


class AddressOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    line1: str
    line2: str | None = None
    locality: str
    city: str
    state: str
    pincode: str
    latitude: float | None = None
    longitude: float | None = None
    is_geocoded: bool


class RecipientIn(BaseModel):
    name: str
    phone: str
    preferred_language: str = "en"


class RecipientOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str
    preferred_language: str


class SenderOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    organization: str | None = None


class ConsignmentCreate(BaseModel):
    # Sender: either an existing seeded sender id, or a free-text name.
    sender_id: int | None = None
    sender_name: str | None = None

    # Origin drop-off post office where the sender submits the parcel
    origin_post_office_id: int | None = None

    recipient: RecipientIn
    address: AddressIn

    description: str | None = None
    weight_grams: int | None = Field(default=None, ge=0)
    priority: Priority = Priority.NORMAL
    # Optional slot the sender proposes on the recipient's behalf.
    requested_slot_code: str | None = None


class ConsignmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    tracking_number: str
    status: ConsignmentStatus
    priority: Priority
    description: str | None = None
    weight_grams: int | None = None

    sender: SenderOut
    recipient: RecipientOut
    address: AddressOut
    post_office_id: int
    origin_post_office_id: int | None = None
    bag_number: str | None = None

    post_office: PostOfficeBrief | None = None
    origin_post_office: PostOfficeBrief | None = None

    requested_slot: SlotOut | None = None
    recommended_slot: SlotOut | None = None
    confirmed_slot: SlotOut | None = None

    delivery_date: datetime | None = None
    created_at: datetime


class ConsignmentBrief(BaseModel):
    """Lightweight row for lists/route stops."""

    model_config = ConfigDict(from_attributes=True)

    id: int
    tracking_number: str
    status: ConsignmentStatus
    priority: Priority
    recipient: RecipientOut
    address: AddressOut
    post_office_id: int | None = None
    origin_post_office_id: int | None = None
    bag_number: str | None = None
    confirmed_slot: SlotOut | None = None


class ConsignmentUpdate(BaseModel):
    status: ConsignmentStatus | None = None
    priority: Priority | None = None
