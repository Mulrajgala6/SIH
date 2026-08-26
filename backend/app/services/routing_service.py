"""Routing service (Phase 6).

Builds a delivery Route (+ ordered RouteStops with ETAs) from the parcels
confirmed for a post office on a given day. Delegates the hard optimization to
``app.services.routing`` (OR-Tools when available, pure fallback otherwise) and
presents stops in slot order so the timeline reads morning → evening.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.models.entities import (
    Consignment,
    DeliveryAgent,
    PostOffice,
    Route,
    RouteStop,
)
from app.models.enums import ConsignmentStatus, RouteStatus, StopStatus
from app.schemas.route import RouteOptimizeRequest, RouteOptimizeResponse
from app.services import routing

DEFAULT_SPEED_KMPH = 20.0
SERVICE_MINUTES = 4


def _day_bounds(dt: datetime) -> tuple[datetime, datetime]:
    start = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _confirmed_for_office(db: Session, po_id: int, day: datetime) -> list[Consignment]:
    start, end = _day_bounds(day)
    return (
        db.query(Consignment)
        .filter(
            Consignment.post_office_id == po_id,
            Consignment.status == ConsignmentStatus.SLOT_CONFIRMED,
            Consignment.confirmed_slot_id.isnot(None),
            Consignment.delivery_date >= start,
            Consignment.delivery_date < end,
        )
        .all()
    )


def _pick_agent(db: Session, po_id: int, explicit_id: int | None) -> DeliveryAgent | None:
    if explicit_id is not None:
        return db.get(DeliveryAgent, explicit_id)
    return (
        db.query(DeliveryAgent)
        .filter(DeliveryAgent.post_office_id == po_id, DeliveryAgent.is_active.is_(True))
        .order_by(DeliveryAgent.id)
        .first()
    )


def _build_route_for_office(
    db: Session, po: PostOffice, day: datetime,
    agent_id: int | None, start_minutes: int | None,
) -> tuple[Route | None, list[int]]:
    consignments = _confirmed_for_office(db, po.id, day)
    # Only route parcels we can actually place on the map.
    routable = [c for c in consignments if c.address and c.address.latitude is not None]
    unassigned = [c.id for c in consignments if c not in routable]
    if not routable:
        return None, unassigned

    # Remove any prior PLANNED route for this PO/day so re-optimizing is idempotent.
    day_start, day_end = _day_bounds(day)
    stale = (
        db.query(Route)
        .filter(Route.post_office_id == po.id, Route.status == RouteStatus.PLANNED,
                Route.route_date >= day_start, Route.route_date < day_end)
        .all()
    )
    for r in stale:
        db.delete(r)
    db.flush()

    points = [(po.latitude, po.longitude)] + [
        (c.address.latitude, c.address.longitude) for c in routable
    ]
    windows = [(0, 24 * 60)] + [
        (c.confirmed_slot.start_minutes, c.confirmed_slot.end_minutes) for c in routable
    ]
    slot_start_by_point = {i + 1: routable[i].confirmed_slot.start_minutes for i in range(len(routable))}

    sol = routing.optimize(points, 0, time_windows=windows,
                           avg_speed_kmph=DEFAULT_SPEED_KMPH, service_minutes=SERVICE_MINUTES)

    order = sol.order
    if sol.optimizer != "ortools":
        # Present stops in slot order; stable sort keeps the distance-optimized
        # sequence within each slot.
        rest = [i for i in order if i != 0]
        rest.sort(key=lambda i: slot_start_by_point.get(i, 0))
        order = [0] + rest

    # Recompute legs for the final order.
    from app.utils.geo import haversine_m
    legs = [0.0]
    for k in range(1, len(order)):
        a, b = points[order[k - 1]], points[order[k]]
        legs.append(haversine_m(*a, *b))
    total = sum(legs)

    planned_start = start_minutes if start_minutes is not None else min(
        (routable[i - 1].confirmed_slot.start_minutes for i in order if i != 0),
        default=600,
    )

    agent = _pick_agent(db, po.id, agent_id)
    route = Route(
        post_office_id=po.id, agent_id=agent.id if agent else None,
        route_date=day_start, status=RouteStatus.PLANNED,
        planned_start_minutes=planned_start, total_distance_m=round(total, 1),
        total_stops=len(routable), optimizer=sol.optimizer,
        optimization_meta={"speed_kmph": DEFAULT_SPEED_KMPH, "service_minutes": SERVICE_MINUTES},
    )
    db.add(route)
    db.flush()

    speed_m_per_min = (DEFAULT_SPEED_KMPH * 1000.0) / 60.0
    clock = float(planned_start)
    seq = 1
    for k in range(1, len(order)):
        cons = routable[order[k] - 1]
        clock += legs[k] / max(speed_m_per_min, 1e-6) + SERVICE_MINUTES
        # Don't show an ETA before the slot opens.
        eta = max(int(round(clock)), cons.confirmed_slot.start_minutes)
        clock = float(eta)
        db.add(RouteStop(
            route_id=route.id, consignment_id=cons.id, sequence=seq,
            status=StopStatus.PENDING, eta_minutes=eta,
            distance_from_prev_m=round(legs[k], 1),
        ))
        seq += 1

    return route, unassigned


def optimize_routes(db: Session, req: RouteOptimizeRequest) -> RouteOptimizeResponse:
    day = req.route_date or datetime.now(timezone.utc)

    if req.post_office_code:
        po = db.query(PostOffice).filter_by(code=req.post_office_code).first()
        offices = [po] if po else []
    else:
        # Every office that has confirmed parcels for the day.
        start, end = _day_bounds(day)
        po_ids = [
            row[0] for row in db.query(Consignment.post_office_id)
            .filter(Consignment.status == ConsignmentStatus.SLOT_CONFIRMED,
                    Consignment.delivery_date >= start, Consignment.delivery_date < end)
            .distinct().all()
        ]
        offices = [db.get(PostOffice, pid) for pid in po_ids]

    routes = []
    unassigned: list[int] = []
    for po in offices:
        if po is None:
            continue
        route, un = _build_route_for_office(db, po, day, req.agent_id, req.start_minutes)
        unassigned.extend(un)
        if route is not None:
            routes.append(route)

    db.commit()
    for r in routes:
        db.refresh(r)

    from app.schemas.route import RouteOut
    return RouteOptimizeResponse(
        routes=[RouteOut.model_validate(r) for r in routes],
        unassigned_consignment_ids=unassigned,
    )


def get_route(db: Session, route_id: int) -> Route | None:
    return db.get(Route, route_id)


def list_routes(db: Session, day: datetime | None = None, post_office_id: int | None = None) -> list[Route]:
    query = db.query(Route)
    if day is not None:
        start, end = _day_bounds(day)
        query = query.filter(Route.route_date >= start, Route.route_date < end)
    if post_office_id is not None:
        query = query.filter(Route.post_office_id == post_office_id)
    return query.order_by(Route.id.desc()).all()
