"""Tests for feasibility rules + the slot recommender (stdlib-only)."""

from app.ml.feasibility import SlotLoad, feasible_slot_ids, is_feasible, within_any_window
from app.ml.features import global_slot_rates, slot_success_counts
from app.ml.recommender import recommend, score_slots


# ---------------------------------------------------------------- feasibility
def test_within_any_window():
    windows = [(540, 1170)]  # 09:00–19:30 (covers every offered slot)
    assert within_any_window(600, 720, windows)        # morning inside
    assert within_any_window(1020, 1140, windows)      # evening 17:00–19:00 inside
    assert not within_any_window(1170, 1290, windows)  # 19:30–21:30 not covered


def test_is_feasible_capacity_and_window():
    load = SlotLoad(1, "MORNING", 600, 720, confirmed_count=5, capacity=10)
    assert is_feasible(load, [(540, 1080)])
    full = SlotLoad(2, "MIDDAY", 720, 840, confirmed_count=10, capacity=10)
    assert not is_feasible(full, [(540, 1080)])           # at capacity
    outside = SlotLoad(3, "LATE", 1140, 1260, 0, 10)
    assert not is_feasible(outside, [(540, 1080)])        # outside working hours


def test_feasible_slot_ids_filters():
    loads = [
        SlotLoad(1, "MORNING", 600, 720, 0, 10),
        SlotLoad(2, "EVENING", 1020, 1140, 10, 10),   # full
        SlotLoad(3, "AFTERNOON", 840, 960, 3, 10),
    ]
    assert feasible_slot_ids(loads, [(540, 1140)]) == [1, 3]


# ---------------------------------------------------------------- features
def test_slot_success_counts():
    hist = [("MORNING", True), ("MORNING", False), ("EVENING", True)]
    counts = slot_success_counts(hist)
    assert counts["MORNING"] == (1, 2)
    assert counts["EVENING"] == (1, 1)


def test_global_slot_rates():
    rates = global_slot_rates({
        1: [("MORNING", True), ("MORNING", True)],
        2: [("MORNING", False), ("EVENING", True)],
    })
    assert rates["MORNING"] == 2 / 3
    assert rates["EVENING"] == 1.0


# ---------------------------------------------------------------- recommender
def test_recommender_learns_personal_pattern():
    # This recipient always succeeds in the evening, fails elsewhere.
    hist = [("EVENING", True)] * 4 + [("MORNING", False), ("AFTERNOON", False)]
    rec = recommend(hist, ["MORNING", "MIDDAY", "AFTERNOON", "EVENING"])
    assert rec.slot_code == "EVENING"
    assert "evening" in rec.reason_en.lower()
    # never leaks raw probabilities into the reason text
    assert "%" not in rec.reason_en


def test_recommender_cold_start_uses_prior_reason():
    rec = recommend([], ["MORNING", "MIDDAY", "AFTERNOON", "EVENING"])
    assert rec.slot_code is not None                    # still recommends something
    assert "popular" in rec.reason_en.lower()           # cold-start reason


def test_recommender_respects_feasible_candidates_only():
    hist = [("EVENING", True)] * 5
    # Evening not offered → must pick among the feasible ones.
    rec = recommend(hist, ["MORNING", "AFTERNOON"])
    assert rec.slot_code in {"MORNING", "AFTERNOON"}


def test_recommender_no_candidates():
    rec = recommend([("EVENING", True)], [])
    assert rec.slot_code is None


def test_score_slots_smoothing_orders_by_evidence():
    hist = [("MORNING", True), ("MORNING", True), ("MORNING", True)]
    scores = {s.slot_code: s.score for s in score_slots(hist, ["MORNING", "EVENING"])}
    assert scores["MORNING"] > scores["EVENING"]
