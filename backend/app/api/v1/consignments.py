"""Consignment routes.

Staff (front desk / supervisor) create and manage parcels. The tracking lookup
is public so a recipient can view their parcel from a notification link without
needing an account — the tracking number acts as the capability.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.deps import call_service, get_db, require_roles
from app.models.enums import ConsignmentStatus, Role
from app.schemas.consignment import (
    ConsignmentBrief,
    ConsignmentCreate,
    ConsignmentOut,
    ConsignmentUpdate,
)
from app.services import consignment_service

router = APIRouter(prefix="/consignments", tags=["consignments"])

_STAFF = require_roles(Role.SENDER, Role.SUPERVISOR, Role.ADMIN)
_OPS = require_roles(Role.SUPERVISOR, Role.ADMIN)


@router.post("", response_model=ConsignmentOut, status_code=status.HTTP_201_CREATED)
def create_consignment(
    payload: ConsignmentCreate,
    db: Session = Depends(get_db),
    _user=Depends(_STAFF),
) -> ConsignmentOut:
    cons = call_service(consignment_service.create_consignment, db, payload)
    return ConsignmentOut.model_validate(cons)


@router.get("", response_model=list[ConsignmentBrief])
def list_consignments(
    status_filter: ConsignmentStatus | None = Query(default=None, alias="status"),
    post_office_id: int | None = None,
    q: str | None = None,
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    _user=Depends(_OPS),
) -> list[ConsignmentBrief]:
    rows = consignment_service.list_consignments(
        db, status=status_filter, post_office_id=post_office_id, q=q, limit=limit
    )
    return [ConsignmentBrief.model_validate(c) for c in rows]


@router.get("/track/{tracking_number}", response_model=ConsignmentOut)
def track(tracking_number: str, db: Session = Depends(get_db)) -> ConsignmentOut:
    cons = consignment_service.get_by_tracking(db, tracking_number)
    if cons is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consignment not found")
    return ConsignmentOut.model_validate(cons)


@router.get("/{consignment_id}", response_model=ConsignmentOut)
def get_consignment(
    consignment_id: int, db: Session = Depends(get_db), _user=Depends(_OPS)
) -> ConsignmentOut:
    cons = consignment_service.get_consignment(db, consignment_id)
    if cons is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consignment not found")
    return ConsignmentOut.model_validate(cons)


@router.patch("/{consignment_id}", response_model=ConsignmentOut)
def update_consignment(
    consignment_id: int,
    payload: ConsignmentUpdate,
    db: Session = Depends(get_db),
    _user=Depends(_OPS),
) -> ConsignmentOut:
    cons = consignment_service.update_consignment(
        db, consignment_id, status=payload.status, priority=payload.priority
    )
    if cons is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Consignment not found")
    return ConsignmentOut.model_validate(cons)
