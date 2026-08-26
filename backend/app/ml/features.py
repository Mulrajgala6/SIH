"""Feature helpers for the slot recommender (pure Python).

The recommender learns from each recipient's delivery history: which slots did
past parcels actually succeed in? These helpers reduce raw history into the
per-slot success/attempt counts the scorer consumes.
"""

from __future__ import annotations

from collections import defaultdict


def slot_success_counts(history: list[tuple[str, bool]]) -> dict[str, tuple[int, int]]:
    """history: list of (slot_code, was_successful). -> {slot_code: (successes, attempts)}."""
    counts: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for slot_code, success in history:
        counts[slot_code][1] += 1
        if success:
            counts[slot_code][0] += 1
    return {code: (s, a) for code, (s, a) in counts.items()}


def global_slot_rates(
    all_history: dict[int, list[tuple[str, bool]]]
) -> dict[str, float]:
    """Global success rate per slot code across every recipient (a prior)."""
    agg: dict[str, list[int]] = defaultdict(lambda: [0, 0])
    for history in all_history.values():
        for slot_code, success in history:
            agg[slot_code][1] += 1
            if success:
                agg[slot_code][0] += 1
    return {code: (s / a if a else 0.5) for code, (s, a) in agg.items()}
