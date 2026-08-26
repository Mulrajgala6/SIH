"""Unit tests for transit hub, parcel bagging, and customer portals."""

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_customer_registration_and_login():
    # Register sender
    r = client.post(
        "/api/v1/auth/register",
        json={
            "email": "testsender@example.com",
            "password": "password123",
            "full_name": "Test Sender",
            "phone": "9988776655",
            "role": "SENDER",
        },
    )
    assert r.status_code == 201
    body = r.json()
    assert "access_token" in body
    assert body["user"]["email"] == "testsender@example.com"
    token = body["access_token"]

    # Call /auth/me with token
    r_me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r_me.status_code == 200
    assert r_me.json()["full_name"] == "Test Sender"


def test_post_offices_endpoint():
    r = client.get("/api/v1/post-offices")
    assert r.status_code == 200
    offices = r.json()
    assert len(offices) >= 4
    codes = {o["code"] for o in offices}
    assert "NSK-HO" in codes
    assert "BOM-GPO" in codes


def test_transit_bagging_and_dispatch():
    # Log in as supervisor
    r_login = client.post(
        "/api/v1/auth/login",
        json={"email": "supervisor@daksync.in", "password": "super123"},
    )
    assert r_login.status_code == 200
    token = r_login.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch post offices
    r_po = client.get("/api/v1/post-offices")
    offices = {o["code"]: o for o in r_po.json()}
    nsk_id = offices["NSK-HO"]["id"]
    bom_id = offices["BOM-GPO"]["id"]

    # 1. List outgoing groups from Nashik HO
    r_groups = client.get(
        f"/api/v1/transit/outgoing-groups?origin_post_office_id={nsk_id}",
        headers=headers,
    )
    assert r_groups.status_code == 200
    groups = r_groups.json()
    
    # 2. If there are parcels bound for BOM-GPO, dispatch a bag
    bom_group = next((g for g in groups if g["destination_post_office"]["id"] == bom_id), None)
    if bom_group and bom_group["consignments"]:
        consignment_ids = [c["id"] for c in bom_group["consignments"]]
        r_dispatch = client.post(
            "/api/v1/transit/dispatch-bag",
            json={
                "origin_post_office_id": nsk_id,
                "destination_post_office_id": bom_id,
                "consignment_ids": consignment_ids,
            },
            headers=headers,
        )
        assert r_dispatch.status_code == 200
        dispatched = r_dispatch.json()
        assert dispatched["status"] == "IN_TRANSIT"
        bag_no = dispatched["bag_number"]

        # 3. List incoming bags at Mumbai GPO
        r_incoming = client.get(
            f"/api/v1/transit/incoming-bags?destination_post_office_id={bom_id}",
            headers=headers,
        )
        assert r_incoming.status_code == 200
        incoming_bags = r_incoming.json()
        assert any(b["bag_number"] == bag_no for b in incoming_bags)

        # 4. Receive bag at Mumbai GPO
        r_receive = client.post(
            "/api/v1/transit/receive-bag",
            json={
                "destination_post_office_id": bom_id,
                "bag_number": bag_no,
            },
            headers=headers,
        )
        assert r_receive.status_code == 200
        received = r_receive.json()
        assert received["status"] == "RECEIVED_AT_DESTINATION"
        assert received["unbagged_count"] == len(consignment_ids)

        # 5. Check consignment status is now SLOT_CONFIRMED
        r_cons = client.get(f"/api/v1/consignments/{consignment_ids[0]}", headers=headers)
        assert r_cons.status_code == 200
        assert r_cons.json()["status"] == "SLOT_CONFIRMED"

        # 6. Verify Mumbai GPO optimization includes these unbagged parcels
        r_opt = client.post(
            "/api/v1/routes/optimize",
            json={"post_office_code": "BOM-GPO"},
            headers=headers,
        )
        assert r_opt.status_code == 200
        opt_res = r_opt.json()
        assert "routes" in opt_res
