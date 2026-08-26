"""Transit & Parcel Bagging schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from app.schemas.consignment import ConsignmentBrief
from app.schemas.post_office import PostOfficeBrief


class OutgoingGroup(BaseModel):
    destination_post_office: PostOfficeBrief
    consignment_count: int
    total_weight_grams: int
    consignments: list[ConsignmentBrief]


class DispatchBagRequest(BaseModel):
    origin_post_office_id: int
    destination_post_office_id: int
    consignment_ids: list[int]
    custom_bag_number: str | None = None


class DispatchBagResponse(BaseModel):
    bag_number: str
    origin_post_office: PostOfficeBrief
    destination_post_office: PostOfficeBrief
    dispatched_count: int
    consignment_ids: list[int]
    status: str


class ReceiveBagRequest(BaseModel):
    destination_post_office_id: int
    bag_number: str


class ReceiveBagResponse(BaseModel):
    bag_number: str
    destination_post_office: PostOfficeBrief
    unbagged_count: int
    consignment_ids: list[int]
    status: str


class TransitBagBrief(BaseModel):
    bag_number: str
    origin_post_office: PostOfficeBrief
    destination_post_office: PostOfficeBrief
    item_count: int
    status: str


class IncomingBagGroup(BaseModel):
    bag_number: str
    origin_post_office: PostOfficeBrief
    destination_post_office: PostOfficeBrief
    item_count: int
    total_weight_grams: int
    consignments: list[ConsignmentBrief]
    status: str
