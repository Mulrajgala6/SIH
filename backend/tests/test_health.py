"""Phase 0 smoke tests — app boots and health/root endpoints respond.

Run from the backend/ directory:  pytest
(Requires `pip install -r requirements.txt`.)
"""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    r = client.get("/")
    assert r.status_code == 200
    body = r.json()
    assert body["name"] == "DAKSYNC"
    assert body["status"] == "running"


def test_health_reports_database():
    r = client.get("/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] in {"ok", "degraded"}
    assert body["service"] == "DAKSYNC"
    assert "database" in body
    assert "connected" in body["database"]
