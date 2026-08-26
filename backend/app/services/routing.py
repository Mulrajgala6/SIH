"""Route optimization.

Primary solver is Google OR-Tools (VRPTW-style, single vehicle per agent). To
keep the product **robust and testable with zero external dependencies**, a pure
-Python nearest-neighbor + 2-opt TSP fallback is always available and is used
automatically when OR-Tools isn't installed or can't find a solution.

Everything here is framework-free; the service layer feeds it plain coordinate
lists and reads back an ordering.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from app.utils.geo import Point, distance_matrix_m


@dataclass
class RouteSolution:
    order: list[int]                       # visiting order of point indices (starts at depot)
    total_distance_m: float
    optimizer: str
    leg_distances_m: list[float] = field(default_factory=list)  # dist from previous stop


# --------------------------------------------------------------------------- #
# Pure-Python fallback (always available)
# --------------------------------------------------------------------------- #
def path_length(order: list[int], matrix: list[list[float]]) -> float:
    return sum(matrix[order[k]][order[k + 1]] for k in range(len(order) - 1))


def nearest_neighbor(matrix: list[list[float]], start: int = 0) -> list[int]:
    n = len(matrix)
    unvisited = set(range(n))
    unvisited.discard(start)
    order = [start]
    current = start
    while unvisited:
        nxt = min(unvisited, key=lambda j: matrix[current][j])
        order.append(nxt)
        unvisited.discard(nxt)
        current = nxt
    return order


def two_opt(order: list[int], matrix: list[list[float]], max_passes: int = 30) -> list[int]:
    """Improve an open path (index 0 pinned as the depot). Never lengthens it."""
    best = order[:]
    n = len(best)
    if n < 4:
        return best
    improved = True
    passes = 0
    while improved and passes < max_passes:
        improved = False
        passes += 1
        for i in range(1, n - 1):
            for j in range(i + 1, n):
                if j - i == 1:
                    continue
                candidate = best[:i] + best[i:j][::-1] + best[j:]
                if path_length(candidate, matrix) + 1e-9 < path_length(best, matrix):
                    best = candidate
                    improved = True
    return best


def solve_tsp_fallback(matrix: list[list[float]], start: int = 0) -> tuple[list[int], float]:
    order = two_opt(nearest_neighbor(matrix, start), matrix)
    return order, path_length(order, matrix)


# --------------------------------------------------------------------------- #
# OR-Tools path (optional)
# --------------------------------------------------------------------------- #
def _solve_with_ortools(
    matrix: list[list[float]],
    time_windows: list[tuple[int, int]] | None,
    depot: int,
    speed_m_per_min: float,
    service_minutes: int,
) -> tuple[list[int], float] | None:
    try:
        from ortools.constraint_solver import pywrapcp, routing_enums_pb2
    except Exception:
        return None

    n = len(matrix)
    try:
        manager = pywrapcp.RoutingIndexManager(n, 1, depot)
        routing = pywrapcp.RoutingModel(manager)

        def dist_cb(from_index, to_index):
            i, j = manager.IndexToNode(from_index), manager.IndexToNode(to_index)
            return int(round(matrix[i][j]))

        transit = routing.RegisterTransitCallback(dist_cb)
        routing.SetArcCostEvaluatorOfAllVehicles(transit)

        if time_windows:
            def time_cb(from_index, to_index):
                i, j = manager.IndexToNode(from_index), manager.IndexToNode(to_index)
                travel = matrix[i][j] / max(speed_m_per_min, 1e-6)
                return int(round(travel + service_minutes))

            time_idx = routing.RegisterTransitCallback(time_cb)
            horizon = max(e for _, e in time_windows) + 1
            routing.AddDimension(time_idx, horizon, horizon, False, "Time")
            time_dim = routing.GetDimensionOrDie("Time")
            for node, (start, end) in enumerate(time_windows):
                if node == depot:
                    continue
                time_dim.CumulVar(manager.NodeToIndex(node)).SetRange(int(start), int(end))

        params = pywrapcp.DefaultRoutingSearchParameters()
        params.first_solution_strategy = (
            routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
        )
        params.local_search_metaheuristic = (
            routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
        )
        params.time_limit.FromSeconds(3)

        solution = routing.SolveWithParameters(params)
        if solution is None:
            return None

        order: list[int] = []
        index = routing.Start(0)
        while not routing.IsEnd(index):
            order.append(manager.IndexToNode(index))
            index = solution.Value(routing.NextVar(index))
        total = path_length(order, matrix)
        return order, total
    except Exception:
        return None


# --------------------------------------------------------------------------- #
# Public entry point
# --------------------------------------------------------------------------- #
def optimize(
    points: list[Point],
    start_index: int = 0,
    time_windows: list[tuple[int, int]] | None = None,
    avg_speed_kmph: float = 20.0,
    service_minutes: int = 4,
) -> RouteSolution:
    """Order ``points`` (index 0 = depot) into an efficient visiting sequence."""
    if len(points) <= 1:
        return RouteSolution(order=list(range(len(points))), total_distance_m=0.0,
                             optimizer="trivial", leg_distances_m=[0.0] * len(points))

    matrix = distance_matrix_m(points)
    speed_m_per_min = (avg_speed_kmph * 1000.0) / 60.0

    optimizer = "nearest_neighbor_2opt"
    result = _solve_with_ortools(matrix, time_windows, start_index, speed_m_per_min, service_minutes)
    if result is not None:
        order, total = result
        optimizer = "ortools"
    else:
        order, total = solve_tsp_fallback(matrix, start_index)

    legs = [0.0] + [matrix[order[k - 1]][order[k]] for k in range(1, len(order))]
    return RouteSolution(order=order, total_distance_m=total, optimizer=optimizer,
                         leg_distances_m=legs)
