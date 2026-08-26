"""Route + route-stop schemas."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.models.enums import RouteStatus, StopStatus
from app.schemas.consignment import ConsignmentBrief


class AgentBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    phone: str | None = None


class PostOfficeBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    pincode: str
    latitude: float
    longitude: float


class RouteStopOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sequence: int
    status: StopStatus
    eta_minutes: int | None = None
    distance_from_prev_m: float
    consignment: ConsignmentBrief


class RouteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    post_office_id: int
    post_office: PostOfficeBrief | None = None
    agent: AgentBrief | None = None
    route_date: datetime
    status: RouteStatus
    planned_start_minutes: int
    total_distance_m: float
    total_stops: int
    optimizer: str | None = None
    stops: list[RouteStopOut] = []


class RouteOptimizeRequest(BaseModel):
    post_office_code: str | None = None      # default: all offices with confirmed parcels
    agent_id: int | None = None              # optional explicit assignment
    route_date: datetime | None = None       # default: today
    start_minutes: int | None = None         # default: earliest confirmed slot start


class RouteOptimizeResponse(BaseModel):
    routes: list[RouteOut]
    unassigned_consignment_ids: list[int] = []
