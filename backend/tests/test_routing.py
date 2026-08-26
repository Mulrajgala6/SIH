"""Tests for the routing solver's pure fallback (stdlib-only)."""

from app.services.routing import (
    nearest_neighbor,
    optimize,
    path_length,
    solve_tsp_fallback,
    two_opt,
)
from app.utils.geo import distance_matrix_m

# A small Nashik-ish cluster (depot first).
POINTS = [
    (19.9975, 73.7898),  # 0 depot (Nashik City HO)
    (20.0110, 73.7929),  # Panchavati
    (19.9640, 73.7480),  # CIDCO
    (20.0050, 73.7500),  # Gangapur Road
    (19.9720, 73.7680),  # Indira Nagar
    (19.9880, 73.7420),  # Mahatma Nagar
]


def test_nearest_neighbor_visits_all_once_from_depot():
    m = distance_matrix_m(POINTS)
    order = nearest_neighbor(m, start=0)
    assert order[0] == 0
    assert sorted(order) == list(range(len(POINTS)))


def test_two_opt_never_increases_length():
    m = distance_matrix_m(POINTS)
    nn = nearest_neighbor(m, 0)
    improved = two_opt(nn, m)
    assert improved[0] == 0                                  # depot stays pinned
    assert sorted(improved) == list(range(len(POINTS)))      # still a permutation
    assert path_length(improved, m) <= path_length(nn, m) + 1e-9


def test_solve_tsp_fallback_returns_valid_tour():
    m = distance_matrix_m(POINTS)
    order, total = solve_tsp_fallback(m, 0)
    assert sorted(order) == list(range(len(POINTS)))
    assert total > 0
    assert abs(total - path_length(order, m)) < 1e-6


def test_optimize_public_entry():
    sol = optimize(POINTS, start_index=0)
    assert sol.order[0] == 0
    assert sorted(sol.order) == list(range(len(POINTS)))
    assert sol.optimizer in {"ortools", "nearest_neighbor_2opt"}
    assert len(sol.leg_distances_m) == len(sol.order)
    assert sol.leg_distances_m[0] == 0.0
    # total equals sum of legs
    assert abs(sum(sol.leg_distances_m) - sol.total_distance_m) < 1e-6


def test_optimize_trivial_cases():
    assert optimize([], 0).total_distance_m == 0.0
    one = optimize([(19.99, 73.78)], 0)
    assert one.order == [0]
    assert one.total_distance_m == 0.0


def test_two_opt_improves_a_bad_ordering():
    # Points on a line; a deliberately crossed order should be fixed.
    line = [(0.0, 0.0), (0.0, 0.001), (0.0, 0.002), (0.0, 0.003)]
    m = distance_matrix_m(line)
    bad = [0, 2, 1, 3]
    fixed = two_opt(bad, m)
    assert path_length(fixed, m) <= path_length(bad, m) + 1e-9
