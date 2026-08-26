"""Delivery-slot routes: list slots, get an AI recommendation, confirm/change.

The recommend + confirm endpoints are recipient-facing and intentionally public
(reached from a notification link, keyed by consignment id). They never expose
raw model scores — only friendly bilingual reasons (enforced by the schema).
"""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import call_service, get_db
from app.schemas.slot import (
    SlotConfirmRequest,
    SlotConfirmResponse,
    SlotOut,
    SlotRecommendResponse,
)
from app.services import slot_service

router = APIRouter(prefix="/slots", tags=["slots"])


@router.get("", response_model=list[SlotOut])
def list_slots(db: Session = Depends(get_db)) -> list[SlotOut]:
    return [SlotOut.model_validate(s) for s in slot_service.active_slots(db)]


@router.get("/recommend/{consignment_id}", response_model=SlotRecommendResponse)
def recommend(consignment_id: int, db: Session = Depends(get_db)) -> SlotRecommendResponse:
    return call_service(slot_service.recommend, db, consignment_id)


@router.post("/confirm", response_model=SlotConfirmResponse)
def confirm(payload: SlotConfirmRequest, db: Session = Depends(get_db)) -> SlotConfirmResponse:
    return call_service(
        slot_service.confirm, db, payload.consignment_id, payload.slot_id, payload.changed
    )
