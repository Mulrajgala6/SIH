"""Geocoding (Phase 5).

Strategy tuned for a reliable **offline demo** with a real online path:

1. Seeded locality centroids (instant, deterministic) — covers the demo area.
2. Nominatim / OpenStreetMap via httpx — for anything not in the seed.
3. Give up gracefully (``is_geocoded = False``) so the flow never crashes.

Results are cached in-process. Swapping in a paid geocoder or PostGIS later is
a change confined to this module.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.core.config import settings

# Seeded Nashik locality centroids (lat, lng) — keeps the demo fully offline.
LOCALITY_COORDS: dict[str, tuple[float, float]] = {
    "Panchavati": (20.0110, 73.7929),
    "College Road": (19.9975, 73.7570),
    "Gangapur Road": (20.0050, 73.7500),
    "Indira Nagar": (19.9720, 73.7680),
    "CIDCO": (19.9640, 73.7480),
    "Mahatma Nagar": (19.9880, 73.7420),
    "Govind Nagar": (19.9790, 73.7620),
    "Adgaon": (20.0430, 73.8290),
    "Satpur": (19.9990, 73.7150),
    "Deolali": (19.9440, 73.8300),
    "Nashik Road": (19.9450, 73.8380),
    "Old Nashik": (19.9930, 73.7960),
    "Nashik": (19.9975, 73.7898),  # city centroid fallback
}

_cache: dict[str, tuple[float, float]] = {}


@dataclass
class GeocodeResult:
    latitude: float
    longitude: float
    source: str  # "seed" | "nominatim"


def _from_seed(locality: str, city: str) -> GeocodeResult | None:
    for key in (locality, city):
        if key and key in LOCALITY_COORDS:
            lat, lng = LOCALITY_COORDS[key]
            return GeocodeResult(lat, lng, "seed")
    return None


def _from_nominatim(query: str) -> GeocodeResult | None:
    try:
        import httpx  # optional; absent → skip online path
    except Exception:
        return None
    try:
        resp = httpx.get(
            f"{settings.nominatim_url}/search",
            params={"q": query, "format": "json", "limit": 1, "countrycodes": "in"},
            headers={"User-Agent": settings.nominatim_user_agent},
            timeout=5.0,
        )
        resp.raise_for_status()
        data = resp.json()
        if data:
            return GeocodeResult(float(data[0]["lat"]), float(data[0]["lon"]), "nominatim")
    except Exception:
        return None
    return None


def geocode(locality: str, city: str = "Nashik", pincode: str = "") -> GeocodeResult | None:
    key = f"{locality}|{city}|{pincode}".lower()
    if key in _cache:
        lat, lng = _cache[key]
        return GeocodeResult(lat, lng, "cache")

    result = _from_seed(locality, city)
    if result is None:
        query = ", ".join(p for p in (locality, city, pincode, "India") if p)
        result = _from_nominatim(query)

    if result is not None:
        _cache[key] = (result.latitude, result.longitude)
    return result
