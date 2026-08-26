"""Feasibility rules — *rules decide*, the model only recommends.

Pure functions (no ORM/framework) so they are unit-tested in-sandbox. The
service layer builds ``SlotLoad`` objects from the DB and calls these.
"""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class SlotLoad:
    slot_id: int
    slot_code: str
    start_minutes: int
    end_minutes: int
    confirmed_count: int   # parcels already confirmed for this slot/PO/day
    capacity: int          # max parcels this slot can absorb for the PO/day


def within_any_window(start: int, end: int, agent_windows: list[tuple[int, int]]) -> bool:
    """True if some agent's working window fully covers [start, end]."""
    return any(ws <= start and end <= we for ws, we in agent_windows)


def is_feasible(load: SlotLoad, agent_windows: list[tuple[int, int]]) -> bool:
    if load.capacity <= 0:
        return False
    if not within_any_window(load.start_minutes, load.end_minutes, agent_windows):
        return False
    return load.confirmed_count < load.capacity


def feasible_slot_ids(
    loads: list[SlotLoad], agent_windows: list[tuple[int, int]]
) -> list[int]:
    return [ld.slot_id for ld in loads if is_feasible(ld, agent_windows)]
