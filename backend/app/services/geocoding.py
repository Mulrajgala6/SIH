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

# Seeded Nashik locality centroids and pincodes
LOCALITY_DATA: dict[str, dict[str, any]] = {
    "Panchavati": {"lat": 20.0110, "lng": 73.7929, "pincode": "422003"},
    "College Road": {"lat": 19.9975, "lng": 73.7570, "pincode": "422005"},
    "Gangapur Road": {"lat": 20.0050, "lng": 73.7500, "pincode": "422005"},
    "Indira Nagar": {"lat": 19.9720, "lng": 73.7680, "pincode": "422009"},
    "CIDCO": {"lat": 19.9640, "lng": 73.7480, "pincode": "422009"},
    "Mahatma Nagar": {"lat": 19.9880, "lng": 73.7420, "pincode": "422007"},
    "Govind Nagar": {"lat": 19.9790, "lng": 73.7620, "pincode": "422009"},
    "Adgaon": {"lat": 20.0430, "lng": 73.8290, "pincode": "422003"},
    "Satpur": {"lat": 19.9990, "lng": 73.7150, "pincode": "422007"},
    "Deolali": {"lat": 19.9440, "lng": 73.8300, "pincode": "422401"},
    "Nashik Road": {"lat": 19.9450, "lng": 73.8380, "pincode": "422101"},
    "Old Nashik": {"lat": 19.9930, "lng": 73.7960, "pincode": "422001"},
    "Nashik": {"lat": 19.9975, "lng": 73.7898, "pincode": "422001"},
}

LOCALITY_COORDS: dict[str, tuple[float, float]] = {
    k: (v["lat"], v["lng"]) for k, v in LOCALITY_DATA.items()
}

_cache: dict[str, tuple[float, float]] = {}


@dataclass
class GeocodeResult:
    latitude: float
    longitude: float
    source: str  # "seed" | "nominatim"


@dataclass
class ReverseGeocodeResult:
    locality: str
    city: str
    state: str
    pincode: str
    display_name: str
    latitude: float
    longitude: float
    source: str


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


def get_locality_presets() -> list[dict[str, any]]:
    """Return all available locality presets for rapid map navigation and selection."""
    return [
        {
            "locality": k,
            "city": "Nashik",
            "state": "Maharashtra",
            "pincode": v["pincode"],
            "latitude": v["lat"],
            "longitude": v["lng"],
        }
        for k, v in LOCALITY_DATA.items()
        if k != "Nashik"  # exclude generic city fallback from locality list
    ]


def reverse_geocode(lat: float, lng: float) -> ReverseGeocodeResult:
    """Reverse geocode coordinates to locality, city, state, and pincode."""
    from app.utils.geo import haversine_m

    # 1. Check nearest seeded locality first (instant, deterministic)
    closest_loc = None
    min_dist = float("inf")
    for loc_name, info in LOCALITY_DATA.items():
        if loc_name == "Nashik":
            continue
        dist = haversine_m(lat, lng, info["lat"], info["lng"])
        if dist < min_dist:
            min_dist = dist
            closest_loc = (loc_name, info)

    if closest_loc is not None and min_dist <= 2500:
        loc_name, info = closest_loc
        return ReverseGeocodeResult(
            locality=loc_name,
            city="Nashik",
            state="Maharashtra",
            pincode=info["pincode"],
            display_name=f"{loc_name}, Nashik, Maharashtra {info['pincode']}",
            latitude=lat,
            longitude=lng,
            source="seed",
        )

    # 2. Try Nominatim if httpx is available
    try:
        import httpx

        resp = httpx.get(
            f"{settings.nominatim_url}/reverse",
            params={"lat": lat, "lon": lng, "format": "json"},
            headers={"User-Agent": settings.nominatim_user_agent},
            timeout=4.0,
        )
        if resp.status_code == 200:
            data = resp.json()
            address = data.get("address", {})
            locality = (
                address.get("suburb")
                or address.get("neighbourhood")
                or address.get("residential")
                or (closest_loc[0] if closest_loc else "Nashik")
            )
            city = address.get("city") or address.get("town") or "Nashik"
            state = address.get("state") or "Maharashtra"
            pincode = address.get("postcode") or (closest_loc[1]["pincode"] if closest_loc else "422001")
            display = data.get("display_name", f"{locality}, {city}")
            return ReverseGeocodeResult(
                locality=locality,
                city=city,
                state=state,
                pincode=pincode,
                display_name=display,
                latitude=lat,
                longitude=lng,
                source="nominatim",
            )
    except Exception:
        pass

    # 3. Fallback to closest seeded locality or default
    if closest_loc is not None:
        loc_name, info = closest_loc
        return ReverseGeocodeResult(
            locality=loc_name,
            city="Nashik",
            state="Maharashtra",
            pincode=info["pincode"],
            display_name=f"{loc_name}, Nashik, Maharashtra {info['pincode']}",
            latitude=lat,
            longitude=lng,
            source="seed",
        )

    return ReverseGeocodeResult(
        locality="Nashik",
        city="Nashik",
        state="Maharashtra",
        pincode="422001",
        display_name="Nashik, Maharashtra",
        latitude=lat,
        longitude=lng,
        source="default",
    )
