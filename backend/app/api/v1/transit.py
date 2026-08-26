"""Transit & Bagging API endpoints (Supervisor/Admin)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.api.deps import call_service, get_db, require_roles
from app.models.entities import User
from app.models.enums import Role
from app.schemas.transit import (
    DispatchBagRequest,
    DispatchBagResponse,
    IncomingBagGroup,
    OutgoingGroup,
    ReceiveBagRequest,
    ReceiveBagResponse,
)
from app.services import consignment_service

router = APIRouter(prefix="/transit", tags=["transit"])

_OPS = require_roles(Role.SUPERVISOR, Role.ADMIN)


@router.get("/outgoing-groups", response_model=list[OutgoingGroup])
def list_outgoing_groups(
    origin_post_office_id: int = Query(..., description="Origin Post Office ID"),
    db: Session = Depends(get_db),
    _user: User = Depends(_OPS),
) -> list[OutgoingGroup]:
    """List booked parcels at an origin office clubbed by destination post office."""
    return call_service(consignment_service.get_outgoing_groups, db, origin_post_office_id)


@router.get("/incoming-bags", response_model=list[IncomingBagGroup])
def list_incoming_bags(
    destination_post_office_id: int = Query(..., description="Destination Post Office ID"),
    db: Session = Depends(get_db),
    _user: User = Depends(_OPS),
) -> list[IncomingBagGroup]:
    """List in-transit bags heading to this destination post office."""
    return call_service(consignment_service.get_incoming_bags, db, destination_post_office_id)


@router.post("/dispatch-bag", response_model=DispatchBagResponse)
def dispatch_bag_endpoint(
    payload: DispatchBagRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(_OPS),
) -> DispatchBagResponse:
    """Club parcels and dispatch a transit bag from origin to destination post office."""
    return call_service(
        consignment_service.dispatch_transit_bag,
        db,
        payload.origin_post_office_id,
        payload.destination_post_office_id,
        payload.consignment_ids,
        payload.custom_bag_number,
    )


@router.post("/receive-bag", response_model=ReceiveBagResponse)
def receive_bag_endpoint(
    payload: ReceiveBagRequest,
    db: Session = Depends(get_db),
    _user: User = Depends(_OPS),
) -> ReceiveBagResponse:
    """Receive and unbag incoming transit bag at destination regional office."""
    return call_service(
        consignment_service.receive_transit_bag,
        db,
        payload.destination_post_office_id,
        payload.bag_number,
    )
