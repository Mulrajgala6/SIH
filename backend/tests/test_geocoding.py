"""Geocoding API unit tests (reverse, forward, presets)."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_locality_presets():
    r = client.get("/api/v1/geocoding/localities")
    assert r.status_code == 200
    presets = r.json()
    assert len(presets) >= 5
    names = {p["locality"] for p in presets}
    assert "Panchavati" in names
    assert "College Road" in names
    assert "CIDCO" in names
    for p in presets:
        assert "latitude" in p and "longitude" in p
        assert "pincode" in p


def test_reverse_geocode_seed():
    # Coordinates near Panchavati (20.0110, 73.7929)
    r = client.get("/api/v1/geocoding/reverse?lat=20.0115&lng=73.7930")
    assert r.status_code == 200
    body = r.json()
    assert body["locality"] == "Panchavati"
    assert body["city"] == "Nashik"
    assert body["pincode"] == "422003"


def test_forward_geocode():
    r = client.get("/api/v1/geocoding/forward?locality=CIDCO&city=Nashik")
    assert r.status_code == 200
    body = r.json()
    assert body["is_geocoded"] is True
    assert round(body["latitude"], 2) == 19.96
    assert round(body["longitude"], 2) == 73.75
