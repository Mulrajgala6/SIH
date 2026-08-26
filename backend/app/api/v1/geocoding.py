"""Geocoding API endpoints (public)."""

from __future__ import annotations

from fastapi import APIRouter, Query
from pydantic import BaseModel

from app.services import geocoding

router = APIRouter(prefix="/geocoding", tags=["geocoding"])


class LocalityPreset(BaseModel):
    locality: str
    city: str
    state: str
    pincode: str
    latitude: float
    longitude: float


class ReverseGeocodeOut(BaseModel):
    locality: str
    city: str
    state: str
    pincode: str
    display_name: str
    latitude: float
    longitude: float
    source: str


class ForwardGeocodeOut(BaseModel):
    latitude: float
    longitude: float
    source: str
    is_geocoded: bool


@router.get("/reverse", response_model=ReverseGeocodeOut)
def reverse_geocode_endpoint(
    lat: float = Query(..., ge=-90, le=90, description="Latitude"),
    lng: float = Query(..., ge=-180, le=180, description="Longitude"),
) -> ReverseGeocodeOut:
    """Convert coordinates (e.g. from map click/pin) into address components."""
    result = geocoding.reverse_geocode(lat, lng)
    return ReverseGeocodeOut(
        locality=result.locality,
        city=result.city,
        state=result.state,
        pincode=result.pincode,
        display_name=result.display_name,
        latitude=result.latitude,
        longitude=result.longitude,
        source=result.source,
    )


@router.get("/localities", response_model=list[LocalityPreset])
def list_localities_endpoint() -> list[LocalityPreset]:
    """List preset Nashik localities for rapid map positioning and selection."""
    return [LocalityPreset(**p) for p in geocoding.get_locality_presets()]


@router.get("/forward", response_model=ForwardGeocodeOut)
def forward_geocode_endpoint(
    locality: str = Query("", description="Locality or area name"),
    city: str = Query("Nashik", description="City name"),
    pincode: str = Query("", description="Postal PIN code"),
) -> ForwardGeocodeOut:
    """Convert address components into coordinates."""
    res = geocoding.geocode(locality=locality, city=city, pincode=pincode)
    if res is not None:
        return ForwardGeocodeOut(
            latitude=res.latitude,
            longitude=res.longitude,
            source=res.source,
            is_geocoded=True,
        )
    # Default city centroid fallback
    return ForwardGeocodeOut(
        latitude=19.9975,
        longitude=73.7898,
        source="default",
        is_geocoded=False,
    )
