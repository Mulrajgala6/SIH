"""Route-planning routes: optimize routes, list, and fetch a single route.

Optimization and the office-wide view are ops-only. A postman may fetch a single
route (their run sheet) once dispatched.
"""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import call_service, get_db, require_roles
from app.models.enums import Role
from app.schemas.route import RouteOptimizeRequest, RouteOptimizeResponse, RouteOut
from app.services import routing_service

router = APIRouter(prefix="/routes", tags=["routes"])

_OPS = require_roles(Role.SUPERVISOR, Role.ADMIN)
_FIELD = require_roles(Role.SUPERVISOR, Role.ADMIN, Role.POSTMAN)


@router.post("/optimize", response_model=RouteOptimizeResponse)
def optimize(
    req: RouteOptimizeRequest, db: Session = Depends(get_db), _user=Depends(_OPS)
) -> RouteOptimizeResponse:
    return call_service(routing_service.optimize_routes, db, req)


@router.get("", response_model=list[RouteOut])
def list_routes(
    route_date: datetime | None = None,
    post_office_id: int | None = None,
    db: Session = Depends(get_db),
    _user=Depends(_FIELD),
) -> list[RouteOut]:
    rows = routing_service.list_routes(db, day=route_date, post_office_id=post_office_id)
    return [RouteOut.model_validate(r) for r in rows]


@router.get("/{route_id}", response_model=RouteOut)
def get_route(route_id: int, db: Session = Depends(get_db), _user=Depends(_FIELD)) -> RouteOut:
    route = routing_service.get_route(db, route_id)
    if route is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Route not found")
    return RouteOut.model_validate(route)
