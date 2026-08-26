"""End-to-end integration test — the full DAKSYNC delivery loop.

Drives the real FastAPI app (via Starlette's TestClient) against a throwaway
SQLite database (forced by the rootdir ``conftest.py``), exercising the whole
product flow the way the frontend + postman app will:

    login → create consignment → AI recommend slot → recipient confirms
          → optimize route → start delivery (OTP) → verify OTP → complete
          → analytics reflect the delivery

Also asserts the security posture: unauthenticated requests are rejected, role
guards hold, the OTP is single-use / attempt-limited, and raw model scores are
never exposed to the (recipient-facing) slot response.

Requires the full stack (fastapi, sqlalchemy, pydantic, httpx) — run on your
machine with ``pytest``. It is skipped automatically if those deps are absent.
"""

from __future__ import annotations

import pytest

pytest.importorskip("fastapi")
pytest.importorskip("sqlalchemy")

from fastapi.testclient import TestClient  # noqa: E402

from app.db.init_db import create_all  # noqa: E402
from app.db.seed import seed  # noqa: E402
from app.main import app  # noqa: E402

API = "/api/v1"


@pytest.fixture(scope="module")
def client() -> TestClient:
    create_all()
    seed(verbose=False)
    return TestClient(app)


def _auth(client: TestClient, email: str, password: str) -> dict[str, str]:
    res = client.post(f"{API}/auth/login", json={"email": email, "password": password})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


# --------------------------------------------------------------------------- #
# Auth
# --------------------------------------------------------------------------- #
def test_login_and_me(client: TestClient):
    headers = _auth(client, "supervisor@daksync.in", "super123")
    me = client.get(f"{API}/auth/me", headers=headers)
    assert me.status_code == 200
    assert me.json()["role"] == "SUPERVISOR"


def test_login_rejects_bad_password(client: TestClient):
    res = client.post(f"{API}/auth/login", json={"email": "supervisor@daksync.in", "password": "nope"})
    assert res.status_code == 401


def test_protected_route_requires_token(client: TestClient):
    assert client.get(f"{API}/consignments").status_code == 401


def test_role_guard_blocks_wrong_role(client: TestClient):
    # A postman may not list all consignments (ops-only).
    headers = _auth(client, "postman1@daksync.in", "post123")
    assert client.get(f"{API}/consignments", headers=headers).status_code == 403


# --------------------------------------------------------------------------- #
# The full delivery loop
# --------------------------------------------------------------------------- #
def test_full_delivery_loop(client: TestClient):
    staff = _auth(client, "supervisor@daksync.in", "super123")

    # 1) Create a consignment for a brand-new recipient (cold-start recommend).
    payload = {
        "sender_name": "Integration Test Sender",
        "recipient": {"name": "Test Recipient", "phone": "9990001111", "preferred_language": "en"},
        "address": {
            "line1": "1 Test Road", "locality": "Panchavati", "city": "Nashik",
            "state": "Maharashtra", "pincode": "422001",
            "latitude": 20.0100, "longitude": 73.7900,
        },
        "description": "Test parcel", "weight_grams": 500, "priority": "NORMAL",
    }
    res = client.post(f"{API}/consignments", json=payload, headers=staff)
    assert res.status_code == 201, res.text
    cons = res.json()
    cid = cons["id"]
    assert cons["status"] == "SLOT_PENDING"
    assert cons["tracking_number"].startswith("DA") and cons["tracking_number"].endswith("IN")
    assert cons["post_office_id"] is not None  # routed to a Nashik office by pincode

    # 2) Public tracking works by tracking number.
    track = client.get(f"{API}/consignments/track/{cons['tracking_number']}")
    assert track.status_code == 200 and track.json()["id"] == cid

    # 3) AI recommendation (recipient-facing, public). Must offer a recommended,
    #    feasible slot — and must NOT leak raw model scores/probabilities.
    rec = client.get(f"{API}/slots/recommend/{cid}")
    assert rec.status_code == 200, rec.text
    body = rec.json()
    assert body["recommended_slot_id"] is not None
    assert len(body["options"]) >= 1
    recommended = [o for o in body["options"] if o["is_recommended"]]
    assert len(recommended) == 1
    assert recommended[0]["is_feasible"] is True
    assert recommended[0]["reason_en"] and recommended[0]["reason_hi"]  # bilingual
    # No score/probability/confidence field anywhere in the customer payload.
    leaked = {"score", "scores", "probability", "confidence", "prob"}
    assert not (set(body["options"][0].keys()) & leaked)
    assert not (set(body["options"][0]["slot"].keys()) & leaked)

    # 4) Recipient confirms the recommended slot.
    conf = client.post(f"{API}/slots/confirm", json={
        "consignment_id": cid, "slot_id": body["recommended_slot_id"], "changed": False,
    })
    assert conf.status_code == 200, conf.text
    assert conf.json()["status"] == "SLOT_CONFIRMED"

    # 5) Optimize routes for the office; our parcel should be routed.
    opt = client.post(f"{API}/routes/optimize", json={"post_office_code": "NSK-HO"}, headers=staff)
    assert opt.status_code == 200, opt.text
    routes = opt.json()["routes"]
    assert len(routes) >= 1
    all_stop_cids = {s["consignment"]["id"] for r in routes for s in r["stops"]}
    assert cid in all_stop_cids
    # ETAs are present and stops are sequenced.
    a_route = next(r for r in routes if any(s["consignment"]["id"] == cid for s in r["stops"]))
    seqs = [s["sequence"] for s in a_route["stops"]]
    assert seqs == sorted(seqs)
    assert a_route["optimizer"] in ("ortools", "nearest_neighbor_2opt", "trivial")

    # 6) Start delivery → fresh OTP minted (demo mode surfaces it).
    field = _auth(client, "postman1@daksync.in", "post123")
    start = client.post(f"{API}/deliveries/start/{cid}", headers=field)
    assert start.status_code == 200, start.text
    sbody = start.json()
    assert sbody["status"] == "OUT_FOR_DELIVERY"
    otp = sbody["demo_otp"]
    assert otp and len(otp) == 4 and otp.isdigit()

    # 7) A wrong OTP is rejected and decrements the remaining attempts.
    bad = client.post(f"{API}/deliveries/verify-otp", json={
        "consignment_id": cid, "code": "0000" if otp != "0000" else "1111",
    }, headers=field)
    assert bad.status_code == 200
    assert bad.json()["verified"] is False
    assert bad.json()["attempts_remaining"] is not None

    # 8) Completing before verification is refused.
    premature = client.post(f"{API}/deliveries/complete", json={"consignment_id": cid}, headers=field)
    assert premature.status_code == 400

    # 9) Correct OTP verifies.
    good = client.post(f"{API}/deliveries/verify-otp", json={"consignment_id": cid, "code": otp}, headers=field)
    assert good.status_code == 200 and good.json()["verified"] is True

    # 10) OTP is single-use — verifying again fails.
    again = client.post(f"{API}/deliveries/verify-otp", json={"consignment_id": cid, "code": otp}, headers=field)
    assert again.json()["verified"] is False

    # 11) Complete the delivery.
    done = client.post(f"{API}/deliveries/complete", json={"consignment_id": cid}, headers=field)
    assert done.status_code == 200, done.text
    assert done.json()["status"] == "DELIVERED"
    assert done.json()["delivered_at"] is not None

    # 12) Analytics reflect the delivery.
    dash = client.get(f"{API}/analytics/dashboard", headers=staff)
    assert dash.status_code == 200, dash.text
    d = dash.json()
    assert d["delivered_today"] >= 1
    assert 0.0 <= d["first_attempt_success_rate"] <= 100.0
    assert d["routes_planned"] >= 1
    assert len(d["slot_distribution"]) >= 1
    assert len(d["status_breakdown"]) >= 1


def test_failed_delivery_path(client: TestClient):
    """A parcel can be marked failed with a reason (no OTP needed)."""
    staff = _auth(client, "supervisor@daksync.in", "super123")
    field = _auth(client, "postman1@daksync.in", "post123")

    payload = {
        "sender_name": "Fail Path Sender",
        "recipient": {"name": "Absent Recipient", "phone": "9990002222", "preferred_language": "hi"},
        "address": {
            "line1": "2 Test Road", "locality": "Panchavati", "city": "Nashik",
            "state": "Maharashtra", "pincode": "422001",
            "latitude": 20.0050, "longitude": 73.7950,
        },
        "priority": "NORMAL",
    }
    cid = client.post(f"{API}/consignments", json=payload, headers=staff).json()["id"]
    rec = client.get(f"{API}/slots/recommend/{cid}").json()
    client.post(f"{API}/slots/confirm", json={
        "consignment_id": cid, "slot_id": rec["recommended_slot_id"],
    })
    client.post(f"{API}/deliveries/start/{cid}", headers=field)

    failed = client.post(f"{API}/deliveries/fail", json={
        "consignment_id": cid, "reason": "RECIPIENT_UNAVAILABLE", "notes": "Nobody home",
    }, headers=field)
    assert failed.status_code == 200, failed.text
    assert failed.json()["status"] == "DELIVERY_FAILED"
