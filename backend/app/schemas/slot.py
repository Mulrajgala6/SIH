"""Delivery-slot schemas (list, recommend, confirm/change).

Note: we intentionally never expose raw model probabilities/scores to
customers — only a friendly, bilingual reason string.
"""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict

from app.models.enums import SlotCode


class SlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: SlotCode
    label_en: str
    label_hi: str
    start_minutes: int
    end_minutes: int
    sort_order: int


class SlotOption(BaseModel):
    """A slot offered to the recipient, with feasibility + a friendly reason."""

    slot: SlotOut
    is_recommended: bool = False
    is_feasible: bool = True
    reason_en: str | None = None
    reason_hi: str | None = None


class SlotRecommendResponse(BaseModel):
    consignment_id: int
    recommended_slot_id: int | None
    options: list[SlotOption]


class SlotConfirmRequest(BaseModel):
    consignment_id: int
    slot_id: int
    changed: bool = False  # true when the recipient overrides the recommendation


class SlotConfirmResponse(BaseModel):
    consignment_id: int
    confirmed_slot_id: int
    status: str
