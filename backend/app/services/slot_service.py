"""Slot service (Phases 3 & 4): list, recommend, confirm/change.

Ties the *learned* recommender (``app.ml.recommender``) to the *rule-based*
feasibility gate (``app.ml.feasibility``). The model only ranks feasible slots;
capacity and working-hours rules decide what may be offered at all.
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from app.ml import feasibility, recommender
from app.ml.features import global_slot_rates
from app.models.entities import (
    Consignment,
    DeliveryAgent,
    DeliverySlot,
    ModelPrediction,
    SlotPreference,
)
from app.models.enums import ConsignmentStatus, PreferenceType
from app.schemas.slot import SlotConfirmResponse, SlotOption, SlotOut, SlotRecommendResponse
from app.services import notification_service

_TERMINAL = (ConsignmentStatus.DELIVERED, ConsignmentStatus.DELIVERY_FAILED)
_OCCUPYING = (ConsignmentStatus.SLOT_CONFIRMED, ConsignmentStatus.OUT_FOR_DELIVERY)


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def _day_bounds(dt: datetime) -> tuple[datetime, datetime]:
    start = datetime(dt.year, dt.month, dt.day, tzinfo=timezone.utc)
    return start, start + timedelta(days=1)


def active_slots(db: Session) -> list[DeliverySlot]:
    return (
        db.query(DeliverySlot)
        .filter(DeliverySlot.is_active.is_(True))
        .order_by(DeliverySlot.sort_order)
        .all()
    )


def _recipient_history(db: Session, recipient_id: int) -> list[tuple[str, bool]]:
    """Past terminal deliveries for this recipient -> [(slot_code, success)]."""
    rows = (
        db.query(Consignment)
        .filter(
            Consignment.recipient_id == recipient_id,
            Consignment.confirmed_slot_id.isnot(None),
            Consignment.status.in_(_TERMINAL),
        )
        .all()
    )
    history: list[tuple[str, bool]] = []
    for c in rows:
        if c.confirmed_slot is not None:
            history.append((c.confirmed_slot.code.value, c.status == ConsignmentStatus.DELIVERED))
    return history


def _global_prior(db: Session) -> dict[str, float]:
    rows = (
        db.query(Consignment)
        .filter(Consignment.confirmed_slot_id.isnot(None), Consignment.status.in_(_TERMINAL))
        .all()
    )
    all_history: dict[int, list[tuple[str, bool]]] = {}
    for c in rows:
        if c.confirmed_slot is not None:
            all_history.setdefault(c.recipient_id, []).append(
                (c.confirmed_slot.code.value, c.status == ConsignmentStatus.DELIVERED)
            )
    rates = global_slot_rates(all_history)
    return rates or recommender.DEFAULT_PRIOR


def _slot_loads(db: Session, cons: Consignment, target_day: datetime) -> tuple[list, list]:
    """Build feasibility SlotLoads + agent working windows for the parcel's PO."""
    slots = active_slots(db)
    agents = (
        db.query(DeliveryAgent)
        .filter(DeliveryAgent.post_office_id == cons.post_office_id,
                DeliveryAgent.is_active.is_(True))
        .all()
    )
    agent_windows = [(a.work_start_minutes, a.work_end_minutes) for a in agents]
    total_capacity = sum(a.daily_capacity for a in agents) or 40
    per_slot_cap = max(1, total_capacity // max(1, len(slots)))

    start, end = _day_bounds(target_day)
    loads = []
    for s in slots:
        confirmed = (
            db.query(Consignment)
            .filter(
                Consignment.post_office_id == cons.post_office_id,
                Consignment.confirmed_slot_id == s.id,
                Consignment.status.in_(_OCCUPYING),
                Consignment.delivery_date >= start,
                Consignment.delivery_date < end,
            )
            .count()
        )
        loads.append(
            feasibility.SlotLoad(
                slot_id=s.id, slot_code=s.code.value,
                start_minutes=s.start_minutes, end_minutes=s.end_minutes,
                confirmed_count=confirmed, capacity=per_slot_cap,
            )
        )
    return slots, (loads, agent_windows)


# --------------------------------------------------------------------------- #
# Public API
# --------------------------------------------------------------------------- #
def recommend(db: Session, consignment_id: int) -> SlotRecommendResponse:
    cons = db.get(Consignment, consignment_id)
    if cons is None:
        raise ValueError("Consignment not found")

    target_day = cons.delivery_date or datetime.now(timezone.utc)
    slots, (loads, agent_windows) = _slot_loads(db, cons, target_day)
    feasible_ids = set(feasibility.feasible_slot_ids(loads, agent_windows))

    id_by_code = {s.code.value: s.id for s in slots}
    candidate_codes = [s.code.value for s in slots if s.id in feasible_ids]

    history = _recipient_history(db, cons.recipient_id)
    rec = recommender.recommend(history, candidate_codes, prior=_global_prior(db))
    recommended_id = id_by_code.get(rec.slot_code) if rec.slot_code else None

    options: list[SlotOption] = []
    for s in slots:
        is_rec = s.id == recommended_id
        options.append(SlotOption(
            slot=SlotOut.model_validate(s),
            is_recommended=is_rec,
            is_feasible=s.id in feasible_ids,
            reason_en=rec.reason_en if is_rec else None,
            reason_hi=rec.reason_hi if is_rec else None,
        ))

    # Persist the recommendation (audit) — raw scores stay internal.
    if recommended_id is not None:
        cons.recommended_slot_id = recommended_id
        db.add(ModelPrediction(
            consignment_id=cons.id, recommended_slot_id=recommended_id,
            model_version=rec.model_version,
            features={"history_len": len(history), "candidates": candidate_codes},
            scores=rec.scores,
        ))
        db.add(SlotPreference(
            consignment_id=cons.id, slot_id=recommended_id,
            preference_type=PreferenceType.RECOMMENDED, source="recommender",
        ))
        db.commit()

    return SlotRecommendResponse(
        consignment_id=cons.id, recommended_slot_id=recommended_id, options=options
    )


def confirm(db: Session, consignment_id: int, slot_id: int, changed: bool = False) -> SlotConfirmResponse:
    cons = db.get(Consignment, consignment_id)
    if cons is None:
        raise ValueError("Consignment not found")
    slot = db.get(DeliverySlot, slot_id)
    if slot is None or not slot.is_active:
        raise ValueError("Slot not available")

    target_day = cons.delivery_date or datetime.now(timezone.utc)
    _, (loads, agent_windows) = _slot_loads(db, cons, target_day)
    feasible_ids = set(feasibility.feasible_slot_ids(loads, agent_windows))
    if slot_id not in feasible_ids:
        raise ValueError("Selected slot is no longer available")

    cons.confirmed_slot_id = slot_id
    cons.status = ConsignmentStatus.SLOT_CONFIRMED
    if cons.delivery_date is None:
        start, _ = _day_bounds(datetime.now(timezone.utc))
        cons.delivery_date = start

    db.add(SlotPreference(
        consignment_id=cons.id, slot_id=slot_id,
        preference_type=PreferenceType.CHANGED if changed else PreferenceType.RECIPIENT_CONFIRMED,
        source="recipient",
    ))
    notification_service.notify_scheduled(
        db, cons.recipient_id, cons.id, cons.tracking_number, slot.label_en, slot.label_hi
    )
    db.commit()
    db.refresh(cons)
    return SlotConfirmResponse(
        consignment_id=cons.id, confirmed_slot_id=slot_id, status=cons.status.value
    )
