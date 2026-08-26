# DAKSYNC — API Contract (v1)

Single source of truth for the HTTP API. The web frontend and the postman app
are built against this. Base URL in development: `http://localhost:8000`.
All feature endpoints are mounted under the prefix **`/api/v1`**.

- **Auth:** Bearer token (stdlib HMAC-signed). Send `Authorization: Bearer <token>`.
- **Roles:** `ADMIN`, `SUPERVISOR`, `POSTMAN`, `SENDER`, `RECIPIENT`.
- **Content type:** `application/json` for all request bodies.
- **Errors:** `{"detail": "message"}` with an appropriate 4xx status.
  Service-level problems return `404` when the message contains "not found", else `400`.

> **Privacy rule (enforced):** recipient-facing responses never contain raw model
> scores, probabilities, or confidence — only a friendly bilingual reason string.

---

## Demo logins (created by the seed)

| Role       | Email                    | Password   |
|------------|--------------------------|------------|
| Admin      | `admin@daksync.in`       | `admin123` |
| Supervisor | `supervisor@daksync.in`  | `super123` |
| Postman    | `postman1@daksync.in` … `postman4@daksync.in` | `post123` |

---

## Meta (no prefix)

### `GET /` → service banner
### `GET /health`
```json
{ "status": "ok", "service": "DAKSYNC", "version": "0.1.0",
  "database": { "connected": true, "engine": "sqlite", "error": null } }
```

---

## Auth — `/api/v1/auth`

### `POST /auth/login`  *(public)*
Request:
```json
{ "email": "supervisor@daksync.in", "password": "super123" }
```
Response `200`:
```json
{ "access_token": "…", "token_type": "bearer",
  "user": { "id": 2, "email": "supervisor@daksync.in", "full_name": "…", "role": "SUPERVISOR", "phone": null } }
```
`401` on bad credentials, `403` if the account is disabled.

### `GET /auth/me`  *(any authenticated user)* → `UserOut`

---

## Consignments — `/api/v1/consignments`

### `POST /consignments`  *(SENDER, SUPERVISOR, ADMIN)* → `201 ConsignmentOut`
Request (`ConsignmentCreate`):
```json
{
  "sender_id": null,
  "sender_name": "Amazon Fulfilment",
  "recipient": { "name": "Asha Patil", "phone": "9812345678", "preferred_language": "en" },
  "address": {
    "line1": "12 Gangapur Rd", "line2": null, "locality": "Gangapur",
    "city": "Nashik", "state": "Maharashtra", "pincode": "422005",
    "latitude": null, "longitude": null
  },
  "description": "Documents", "weight_grams": 300,
  "priority": "NORMAL", "requested_slot_code": null
}
```
- Provide **either** `sender_id` (existing) **or** `sender_name` (free text).
- If `latitude`/`longitude` are omitted, the address is geocoded (offline Nashik
  centroids, then Nominatim fallback).
- `priority`: `NORMAL | HIGH | URGENT`. `requested_slot_code`: `MORNING | MIDDAY | AFTERNOON | EVENING` (optional).
- New consignment starts at status **`SLOT_PENDING`**.

### `GET /consignments`  *(SUPERVISOR, ADMIN)* → `ConsignmentBrief[]`
Query params: `status`, `post_office_id`, `q` (free-text tracking/name), `limit` (1–1000, default 200).

### `GET /consignments/track/{tracking_number}`  *(public)* → `ConsignmentOut`
Recipient tracking by number (e.g. `DA000000512IN`).

### `GET /consignments/{id}`  *(SUPERVISOR, ADMIN)* → `ConsignmentOut`

### `PATCH /consignments/{id}`  *(SUPERVISOR, ADMIN)* → `ConsignmentOut`
```json
{ "status": "SORTED", "priority": "HIGH" }
```

### Shapes
`ConsignmentOut`:
```json
{
  "id": 1, "tracking_number": "DA000000512IN", "status": "SLOT_PENDING",
  "priority": "NORMAL", "description": "Documents", "weight_grams": 300,
  "sender": { "id": 1, "name": "…", "organization": null },
  "recipient": { "id": 1, "name": "Asha Patil", "phone": "9812345678", "preferred_language": "en" },
  "address": { "id": 1, "line1": "…", "line2": null, "locality": "Gangapur",
               "city": "Nashik", "state": "Maharashtra", "pincode": "422005",
               "latitude": 20.01, "longitude": 73.75, "is_geocoded": true },
  "post_office_id": 1,
  "requested_slot": null, "recommended_slot": null, "confirmed_slot": null,
  "delivery_date": null, "created_at": "2026-08-26T…Z"
}
```
`ConsignmentBrief`: `{ id, tracking_number, status, priority, recipient, address, confirmed_slot }`.
`SlotOut`: `{ id, code, label_en, label_hi, start_minutes, end_minutes, sort_order }`.

---

## Slots — `/api/v1/slots`  *(recipient-facing, public)*

### `GET /slots` → `SlotOut[]`  — all active slots.

### `GET /slots/recommend/{consignment_id}` → `SlotRecommendResponse`
```json
{
  "consignment_id": 1,
  "recommended_slot_id": 4,
  "options": [
    { "slot": { "id": 1, "code": "MORNING", "label_en": "Morning", "label_hi": "सुबह",
                "start_minutes": 600, "end_minutes": 720, "sort_order": 1 },
      "is_recommended": false, "is_feasible": true, "reason_en": null, "reason_hi": null },
    { "slot": { "id": 4, "code": "EVENING", "label_en": "Evening", "label_hi": "शाम", … },
      "is_recommended": true, "is_feasible": true,
      "reason_en": "Most reliable time based on past deliveries.",
      "reason_hi": "पिछली डिलीवरी के आधार पर सबसे भरोसेमंद समय।" }
  ]
}
```
Render `reason_en`/`reason_hi` per the selected language. **No numeric scores are ever returned.**
Non-feasible slots come back with `is_feasible: false` (disable them in the UI).

### `POST /slots/confirm` → `SlotConfirmResponse`
```json
{ "consignment_id": 1, "slot_id": 4, "changed": false }
```
Set `changed: true` when the recipient overrides the recommendation.
Response: `{ "consignment_id": 1, "confirmed_slot_id": 4, "status": "SLOT_CONFIRMED" }`.
`400` if the slot is no longer feasible (capacity/hours).

---

## Routes — `/api/v1/routes`

### `POST /routes/optimize`  *(SUPERVISOR, ADMIN)* → `RouteOptimizeResponse`
```json
{ "post_office_code": "NSK-HO", "agent_id": null, "route_date": null, "start_minutes": null }
```
- `post_office_code` omitted → optimize every office with confirmed parcels today.
- `route_date` omitted → today. Response:
```json
{ "routes": [ RouteOut, … ], "unassigned_consignment_ids": [7, 9] }
```

### `GET /routes`  *(SUPERVISOR, ADMIN, POSTMAN)* → `RouteOut[]`
Query params: `route_date`, `post_office_id`.

### `GET /routes/{id}`  *(SUPERVISOR, ADMIN, POSTMAN)* → `RouteOut`

`RouteOut`:
```json
{
  "id": 1, "post_office_id": 1,
  "agent": { "id": 1, "name": "Ravi K", "phone": "…" },
  "route_date": "2026-08-26T00:00:00Z", "status": "PLANNED",
  "planned_start_minutes": 600, "total_distance_m": 18234.5,
  "total_stops": 6, "optimizer": "nearest_neighbor_2opt",
  "stops": [
    { "id": 1, "sequence": 1, "status": "PENDING", "eta_minutes": 615,
      "distance_from_prev_m": 1200.0,
      "consignment": ConsignmentBrief }
  ]
}
```
`eta_minutes` are minutes-from-midnight (e.g. `615` = 10:15). `status`: `PLANNED | DISPATCHED | IN_PROGRESS | COMPLETED`.
Stop `status`: `PENDING | ARRIVED | COMPLETED | FAILED | SKIPPED`.

---

## Deliveries — `/api/v1/deliveries`  *(POSTMAN, SUPERVISOR, ADMIN)*

### `POST /deliveries/start/{consignment_id}` → `StartDeliveryResponse`
Mints a fresh **single-use** OTP (invalidating any prior one) and sets the parcel
`OUT_FOR_DELIVERY`.
```json
{ "consignment_id": 1, "status": "OUT_FOR_DELIVERY", "otp_sent": true, "demo_otp": "4821" }
```
`demo_otp` is present **only in demo mode** — surface it in the app so presenters
can read the code without an SMS gateway. In production it is `null`.

### `POST /deliveries/verify-otp` → `VerifyOtpResponse`
```json
{ "consignment_id": 1, "code": "4821" }
```
Response:
```json
{ "verified": true, "status": "OUT_FOR_DELIVERY", "attempts_remaining": 4, "detail": "OTP verified" }
```
Enforces single-use, 1-hour expiry, and a 5-attempt lock. `verified:false` with a
`detail` on mismatch/expiry/lock.

### `POST /deliveries/complete` → `DeliveryResultOut`
```json
{ "consignment_id": 1 }
```
Requires a previously **verified** OTP (else `400`). Sets `DELIVERED`.
`{ "consignment_id": 1, "status": "DELIVERED", "delivered_at": "…Z" }`.

### `POST /deliveries/fail` → `DeliveryResultOut`
```json
{ "consignment_id": 1, "reason": "RECIPIENT_UNAVAILABLE", "notes": "Nobody home" }
```
`reason`: `RECIPIENT_UNAVAILABLE | WRONG_ADDRESS | REFUSED | OTHER`. Sets `DELIVERY_FAILED`.

---

## Analytics — `/api/v1/analytics`  *(SUPERVISOR, ADMIN)*

### `GET /analytics/dashboard` → `DashboardOut`
Query param: `day` (ISO date-time; default today).
```json
{
  "total_active": 18, "delivered_today": 3, "out_for_delivery": 2,
  "pending_slot": 4, "failed_today": 1,
  "first_attempt_success_rate": 78.5,
  "routes_planned": 2, "total_route_distance_km": 41.9,
  "status_breakdown": [ { "status": "DELIVERED", "count": 3 }, … ],
  "slot_distribution": [ { "slot_code": "EVENING", "label_en": "Evening", "label_hi": "शाम", "count": 6 }, … ]
}
```

---

## Status vocabulary

**Consignment:** `BOOKED → COLLECTED → SORTED → SLOT_PENDING → SLOT_CONFIRMED → OUT_FOR_DELIVERY → DELIVERED`
with branches `DELIVERY_FAILED`, `RESCHEDULED`, `RETURNED`.

**Slot codes & windows:** `MORNING` 10:00–12:00, `MIDDAY` 12:00–14:00,
`AFTERNOON` 14:00–16:00, `EVENING` 17:00–19:00 (minutes-from-midnight in the API).

**Languages:** `en` (English), `hi` (हिन्दी). Every recipient-facing string ships in both.
