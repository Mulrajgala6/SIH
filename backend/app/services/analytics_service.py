"""Analytics service (Phase 10).

Aggregates the operational picture for the supervisor dashboard: headline KPIs,
status breakdown, slot distribution, first-attempt success rate, and a routing
snapshot. All figures are computed live from the database — no pre-aggregation.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.entities import (
    Consignment,
    DeliveryAttempt,
    DeliverySlot,
    Route,
)
from app.models.enums import AttemptOutcome, ConsignmentStatus, RouteStatus
from app.schemas.analytics import DashboardOut, SlotDistribution, StatusCount

_ACTIVE = (
    ConsignmentStatus.BOOKED,
    ConsignmentStatus.COLLECTED,
    ConsignmentStatus.SORTED,
    ConsignmentStatus.SLOT_PENDING,
    ConsignmentStatus.SLOT_CONFIRMED,
    ConsignmentStatus.OUT_FOR_DELIVERY,
    ConsignmentStatus.RESCHEDULED,
)


def _day_bounds(dt: datetime) -> tuple[datetime, datetime]:
    start = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def _first_attempt_success_rate(db: Session) -> float:
    """Percentage of parcels whose *first* delivery attempt succeeded.

    A robust first-attempt metric: for each consignment with >=1 attempt, look at
    the earliest attempt and count how many were SUCCESS.
    """
    rows = (
        db.query(DeliveryAttempt.consignment_id, DeliveryAttempt.outcome, DeliveryAttempt.attempted_at)
        .order_by(DeliveryAttempt.consignment_id, DeliveryAttempt.attempted_at, DeliveryAttempt.id)
        .all()
    )
    first_by_cons: dict[int, AttemptOutcome] = {}
    for cons_id, outcome, _ in rows:
        if cons_id not in first_by_cons:
            first_by_cons[cons_id] = outcome
    if not first_by_cons:
        return 0.0
    successes = sum(1 for o in first_by_cons.values() if o == AttemptOutcome.SUCCESS)
    return round(100.0 * successes / len(first_by_cons), 1)


def dashboard(db: Session, day: datetime | None = None, post_office_id: int | None = None) -> DashboardOut:
    day = day or datetime.now(timezone.utc)
    start, end = _day_bounds(day)

    # Status breakdown
    query = db.query(Consignment.status, func.count(Consignment.id))
    if post_office_id is not None:
        query = query.filter(Consignment.post_office_id == post_office_id)
    status_rows = query.group_by(Consignment.status).all()
    status_counts = {s: c for s, c in status_rows}
    status_breakdown = [
        StatusCount(status=s.value if hasattr(s, "value") else str(s), count=c)
        for s, c in sorted(status_counts.items(), key=lambda kv: str(kv[0]))
    ]

    def _delivered_today() -> int:
        q = (
            db.query(func.count(Consignment.id))
            .filter(
                Consignment.status == ConsignmentStatus.DELIVERED,
                Consignment.delivery_date >= start,
                Consignment.delivery_date < end,
            )
        )
        if post_office_id is not None:
            q = q.filter(Consignment.post_office_id == post_office_id)
        return q.scalar() or 0

    def _failed_today() -> int:
        q = (
            db.query(func.count(Consignment.id))
            .filter(
                Consignment.status == ConsignmentStatus.DELIVERY_FAILED,
                Consignment.delivery_date >= start,
                Consignment.delivery_date < end,
            )
        )
        if post_office_id is not None:
            q = q.filter(Consignment.post_office_id == post_office_id)
        return q.scalar() or 0

    total_active = sum(status_counts.get(s, 0) for s in _ACTIVE)
    out_for_delivery = status_counts.get(ConsignmentStatus.OUT_FOR_DELIVERY, 0)
    pending_slot = status_counts.get(ConsignmentStatus.SLOT_PENDING, 0)

    # Slot distribution over parcels with a confirmed slot.
    slot_q = (
        db.query(DeliverySlot, func.count(Consignment.id))
        .outerjoin(
            Consignment,
            (Consignment.confirmed_slot_id == DeliverySlot.id)
            & ((Consignment.post_office_id == post_office_id) if post_office_id is not None else True)
        )
        .group_by(DeliverySlot.id)
        .order_by(DeliverySlot.sort_order)
    )
    slot_rows = slot_q.all()
    slot_distribution = [
        SlotDistribution(
            slot_code=slot.code.value if hasattr(slot.code, "value") else str(slot.code),
            label_en=slot.label_en, label_hi=slot.label_hi, count=cnt,
        )
        for slot, cnt in slot_rows
    ]

    # Routing snapshot.
    route_q = (
        db.query(func.count(Route.id))
        .filter(Route.status.in_((RouteStatus.PLANNED, RouteStatus.DISPATCHED, RouteStatus.IN_PROGRESS)),
                Route.route_date >= start, Route.route_date < end)
    )
    dist_q = (
        db.query(func.coalesce(func.sum(Route.total_distance_m), 0.0))
        .filter(Route.route_date >= start, Route.route_date < end)
    )
    if post_office_id is not None:
        route_q = route_q.filter(Route.post_office_id == post_office_id)
        dist_q = dist_q.filter(Route.post_office_id == post_office_id)

    routes_planned = route_q.scalar() or 0
    total_distance_m = dist_q.scalar() or 0.0

    return DashboardOut(
        total_active=total_active,
        delivered_today=_delivered_today(),
        out_for_delivery=out_for_delivery,
        pending_slot=pending_slot,
        failed_today=_failed_today(),
        first_attempt_success_rate=_first_attempt_success_rate(db),
        routes_planned=int(routes_planned),
        total_route_distance_km=round(float(total_distance_m) / 1000.0, 2),
        status_breakdown=status_breakdown,
        slot_distribution=slot_distribution,
    )
