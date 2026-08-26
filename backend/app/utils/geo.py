"""Great-circle geographic helpers (pure Python, dependency-free).

Used for seed coordinates, distance matrices, and as the fallback distance
metric for route optimization (Phase 6). Kept free of ORM/framework imports so
it is trivially unit-testable.
"""

from __future__ import annotations

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000.0

Point = tuple[float, float]  # (latitude, longitude)


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points in **metres**."""
    rlat1, rlat2 = radians(lat1), radians(lat2)
    dlat = radians(lat2 - lat1)
    dlon = radians(lon2 - lon1)
    a = sin(dlat / 2) ** 2 + cos(rlat1) * cos(rlat2) * sin(dlon / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def distance_matrix_m(points: list[Point]) -> list[list[float]]:
    """Symmetric N×N great-circle distance matrix in metres."""
    n = len(points)
    matrix = [[0.0] * n for _ in range(n)]
    for i in range(n):
        lat_i, lon_i = points[i]
        for j in range(i + 1, n):
            lat_j, lon_j = points[j]
            d = haversine_m(lat_i, lon_i, lat_j, lon_j)
            matrix[i][j] = d
            matrix[j][i] = d
    return matrix


def route_length_m(points: list[Point], order: list[int]) -> float:
    """Total length of visiting ``points`` in the given index ``order``."""
    total = 0.0
    for a, b in zip(order, order[1:]):
        total += haversine_m(*points[a], *points[b])
    return total
