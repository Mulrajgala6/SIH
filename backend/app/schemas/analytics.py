"""Analytics dashboard schemas."""

from __future__ import annotations

from pydantic import BaseModel


class SlotDistribution(BaseModel):
    slot_code: str
    label_en: str
    label_hi: str
    count: int


class StatusCount(BaseModel):
    status: str
    count: int


class DashboardOut(BaseModel):
    # headline KPIs
    total_active: int
    delivered_today: int
    out_for_delivery: int
    pending_slot: int
    failed_today: int

    # first-attempt success rate over historical attempts (0-100)
    first_attempt_success_rate: float

    # routing snapshot
    routes_planned: int
    total_route_distance_km: float

    # breakdowns
    status_breakdown: list[StatusCount]
    slot_distribution: list[SlotDistribution]
