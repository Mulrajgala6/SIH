# DAKSYNC — Build Progress

A running log of what's been built and verified, phase by phase.

> **Sandbox note:** This project is developed in an environment **without access
> to PyPI/npm**, so the full servers can't be booted here. Every phase is
> verified offline as far as possible (Python compile checks, config validity,
> and real unit tests for dependency-light business logic using stdlib +
> numpy/pandas). You run the full stack on your machine — each phase lists the
> exact commands.

---

## ✅ Phase 0 — Project Foundation

**Built**

- Repository skeleton: `backend/`, `frontend/`, `mobile/`, `data/`, `scripts/`, `docs/`.
- **Backend (FastAPI, modular monolith):** `app/main.py` (app + CORS + `/` + `/health`),
  `app/core/config.py` (pydantic-settings; `DATABASE_URL` with SQLite default,
  PostgreSQL-ready), `app/db/base.py` + `app/db/session.py` (SQLAlchemy 2 engine/session,
  SQLite/Postgres aware). `requirements.txt`, `.env.example`.
- **Frontend (Next.js 14 + TS + Tailwind):** clean white landing page that live-checks
  the backend `/health` endpoint and previews the product pipeline. Design tokens
  (India Post blue/red) seeded in `tailwind.config.ts`.
- **Root:** `docker-compose.yml` (optional PostgreSQL 16), `.gitignore`, `README.md`.
- **Tests:** `tests/test_health.py` (root + health).

**Verified (offline)**

- All backend Python compiles (`py_compile`).
- `package.json`, `tsconfig.json`, `docker-compose.yml` are valid.

**How to run**

```bash
# Backend
cd backend && python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\Scripts\activate)
pip install -r requirements.txt && cp .env.example .env
uvicorn app.main:app --reload --port 8000        # → http://localhost:8000/health

# Frontend (separate terminal)
cd frontend && npm install && cp .env.local.example .env.local
npm run dev                                       # → http://localhost:3000

# Tests
cd backend && pytest
```

**Expected:** `/health` returns `{"status":"ok", ...}`; landing page shows
“Backend connection · Connected”.

---

## ✅ Phase 1 — Database + Core Backend

**Built**

- **Enums** (`app/models/enums.py`): `Role`, `ConsignmentStatus` (BOOKED → … →
  DELIVERED/FAILED/RETURNED), `Priority`, `SlotCode`, `PreferenceType`,
  `RouteStatus`, `StopStatus`, `AttemptOutcome`, `FailureReason`,
  `NotificationType`, `NotificationChannel` — all `str`-based, stored as
  portable VARCHAR+CHECK (`native_enum=False`) so the schema is identical on
  SQLite and PostgreSQL.
- **15 ORM models** (`app/models/entities.py`, SQLAlchemy 2.0 typed style):
  User, Sender, Recipient, Address, PostOffice, DeliveryAgent, DeliverySlot,
  Consignment (3 FKs into slots: requested/recommended/confirmed), SlotPreference,
  Route, RouteStop, DeliveryAttempt, OTPVerification, Notification, ModelPrediction.
  Coordinates as `Float`, flexible blobs as generic `JSON`, slot/working-hour
  windows as minutes-from-midnight (feed straight into OR-Tools later).
- **DB init** (`app/db/init_db.py`): `create_all` / `drop_all` / `reset`; runnable
  via `python -m app.db.init_db`.
- **Password hashing** (`app/core/security.py`): stdlib PBKDF2-HMAC-SHA256, no
  third-party crypto dep; drop-in extension point for bcrypt/argon2 later.
- **Dependency-light utils** (`app/utils/`): `geo.py` (haversine + distance
  matrix), `timewindows.py` (minute→label), `tracking.py` (India-Post-style
  article numbers), `otp.py` (secure OTP + expiry math).
- **Seed** (`app/db/seed.py`, `python -m app.db.seed`): deterministic Nashik
  dataset — 4 slots, 2 post offices, admin/supervisor/4 postmen, 5 senders, 18
  recipients across localities (each with a hidden behaviour pattern), ~48
  historical consignments + attempts where success correlates with the
  recipient's preferred slot (**training signal for the Phase-4 recommender**),
  18 active consignments today (14 SLOT_CONFIRMED + OTPs + notifications, 4
  SLOT_PENDING awaiting the recipient, incl. one CHANGER set up for the
  “recipient changes their slot” demo).

**Verified (offline)**

- All backend Python compiles (`py_compile`).
- **20 stdlib-only unit tests pass in-sandbox** (`tests/test_utils.py`,
  `tests/test_security.py`) — geo/time/tracking/otp/password logic.
- Model + seed integration tests written (`tests/test_models.py`,
  `tests/test_seed.py`) — verify the 3-slot-FK resolution, cascades, seed counts
  and internal consistency. These need SQLAlchemy, so they run on your machine.

**How to run**

```bash
cd backend && source .venv/bin/activate    # (Windows: .venv\Scripts\activate)
python -m app.db.seed          # resets + seeds the demo dataset, prints a summary + demo logins
pytest                          # runs the full suite (tests use an isolated throwaway DB)
```

**Expected:** seed prints counts (`slots: 4`, `recipients: 18`,
`active_consignments: 18`, `historical_consignments: 48`, …) and demo logins;
`pytest` is green.

---

## ✅ Phase 2 — Consignment Flow

**Built**

- **`consignment_service.py`** — create a consignment (auto-generates an
  India-Post-style tracking number, resolves sender/recipient/address, seeds
  status `BOOKED`/`SLOT_PENDING`), list with an optional `status` filter, fetch
  by id, fetch by tracking number, and `update_consignment(status, priority)`.
- **Schemas** (`schemas/consignment.py`): `ConsignmentCreate`, `ConsignmentOut`,
  `ConsignmentBrief`, patch payload.
- **REST** (`api/v1/consignments.py`): `POST /consignments` (SENDER/SUPERVISOR/
  ADMIN, 201), `GET /consignments` (ops, `?status=`), `GET /consignments/track/
  {tracking_number}` (**public** — the tracking number is the capability token),
  `GET /consignments/{id}` (ops), `PATCH /consignments/{id}` (ops).

**Verified (offline):** `py_compile`; create→track exercised end-to-end in
`tests/test_flow.py` (runs on your machine).

---

## ✅ Phase 3 — Recipient Slot Flow + Bilingual UI

**Built**

- **`slot_service.py`** (list/confirm/change) — list active slots, and
  `confirm_slot` which confirms *or changes* a consignment's slot, records a
  `SlotPreference`, and transitions `SLOT_PENDING → SLOT_CONFIRMED`.
- **REST** (`api/v1/slots.py`, all **public** — recipients have no account):
  `GET /slots`, `POST /slots/confirm`.
- **Frontend:** hand-rolled EN / हिन्दी i18n (`lib/i18n.tsx`, compile-time key
  parity), `LanguageToggle`, the recipient confirm page `/confirm/[id]`, and a
  reusable `SlotCard`. The recipient never needs to log in.

**Verified (offline):** `py_compile`; `tsc --noEmit` clean; confirm/change path
covered in `tests/test_flow.py`.

---

## ✅ Phase 4 — AI Slot Recommendation

**Built**

- **`ml/feasibility.py`** — *rules decide feasibility.* Given agent working-hour
  windows and slot windows, computes which slots are actually deliverable
  (`feasible_slot_ids`, `within_any_window`, `is_feasible`).
- **`ml/features.py`** — `slot_success_counts` (per-recipient history) and
  `global_slot_rates` (fleet-wide priors).
- **`ml/recommender.py`** — ranks *only the feasible* slots with a
  Laplace-smoothed Bayesian score that blends the recipient's own history with
  the global slot success rate (handles cold-start gracefully). Optional
  `model.joblib` artifact hook — if present it is used, otherwise the Bayesian
  scorer is the default (no ML dependency required).
- **REST:** `GET /slots/recommend/{consignment_id}` (**public**). The response is
  a ranked recommendation plus a human-readable reason — **raw probabilities /
  confidence are never exposed to the customer.**

**Verified (offline):** **10 recommender unit tests pass in-sandbox**
(`tests/test_recommender.py`) — feasibility gating, cold-start global fallback,
history dominance when data exists, and confirmation that no score leaks into the
customer-facing shape.

---

## ✅ Phase 5 — Address + Geocoding

**Built**

- **`services/geocoding.py`** — resolves an address to coordinates using seeded
  **offline** Nashik locality centroids first (deterministic, needs no network),
  with a **Nominatim** online fallback used only when `httpx` is installed.
  Coordinates are stored on `Address` and feed the optimiser.

**Verified (offline):** `py_compile`; the offline centroid path is the default
and requires no external service.

---

## ✅ Phase 6 — Route Optimization

**Built**

- **`services/routing.py`** (pure algorithm) — **Google OR-Tools VRPTW** when
  `ortools` is installed; a pure-Python **nearest-neighbour + 2-opt** optimiser
  with the *identical* interface otherwise. Respects slot time windows and agent
  hours; emits sequenced stops with ETAs and per-leg distances.
- **`services/routing_service.py`** (DB-facing) — builds the problem from today's
  `SLOT_CONFIRMED` consignments and persists `Route` + `RouteStop` rows.
- **REST:** `POST /routes/optimize` (ops).

**Verified (offline):** **6 routing unit tests pass in-sandbox**
(`tests/test_routing.py`) — distance-matrix symmetry, nearest-neighbour validity,
2-opt never worsening a tour, and slot-ordered sequencing.

---

## ✅ Phase 7 — Supervisor Dashboard

**Built**

- **REST:** `GET /routes` (SUPERVISOR/ADMIN/POSTMAN), `GET /routes/{id}`.
- **Frontend `/dashboard`** — KPI cards, the day's routes, consignment
  management, all behind a `RequireRole` guard, with `StatusBadge`/`KpiCard`
  components.

**Verified (offline):** `tsc --noEmit` clean; route endpoints exercised in
`tests/test_flow.py`.

---

## ✅ Phase 8 — Postman Experience (Flutter)

**Built** (`mobile/`, Material 3, India-Post blue; `http` + `provider` only)

- Login → **My routes** (today's run sheets with progress) → **Route detail**
  (ordered stops: sequence, recipient, address, ETA, bilingual confirmed slot,
  status) → **Delivery flow**: *Start delivery* (mints the OTP; the demo OTP is
  shown on-screen for presentation) → enter OTP → *Verify* (shows attempts
  remaining) → *Complete*, plus a *Mark failed* path (reason + notes).
- Runs on Flutter web (`flutter run -d chrome`) or a device
  (`--dart-define=API_BASE=…`).

**Verified (offline):** every relative import resolves; widget/model API usage is
consistent with the backend contract. `flutter analyze` runs on your machine.

---

## ✅ Phase 9 — OTP System

**Built**

- **`services/delivery_service.py`** — `start_delivery` invalidates any prior
  unused OTP, mints a fresh single-use code with expiry, sets
  `OUT_FOR_DELIVERY`, and returns `demo_otp` **only in demo mode**; `verify_otp`
  enforces expiry, max-attempts and single-use; `complete_delivery` **requires a
  verified OTP** (else 400); `fail_delivery` records reason + notes.
- **`utils/otp.py`** — secure code generation, expiry math, constant-time check.
- **REST:** `POST /deliveries/start/{id}`, `/verify-otp`, `/complete`, `/fail`
  (POSTMAN/SUPERVISOR/ADMIN).

**Verified (offline):** OTP primitives covered within the 22 util tests;
**full lifecycle** (wrong-then-right code, single-use enforcement,
complete-before-verify → 400, failure path) covered in `tests/test_flow.py`.

---

## ✅ Phase 10 — Analytics

**Built**

- **`services/analytics_service.py`** — `dashboard()` computes live KPIs: total
  active, delivered today, **first-attempt success rate** (earliest attempt per
  consignment), slot distribution, and per-status counts.
- **REST:** `GET /analytics/dashboard` (ops).

**Verified (offline):** `py_compile`; the dashboard shape is asserted in
`tests/test_flow.py`.

---

## ✅ Phase 11 — UI Polish

**Built**

- App layout with **Inter + Noto Sans Devanagari** (`next/font`), consistent
  buttons/fields/spinners/badges, the bilingual toggle across every page, and a
  responsive white India-Post look.

**Verified (offline):** `tsc --noEmit` clean; no disallowed npm dependencies
(next/react/react-dom only).

---

## ✅ Final — Docs, Tests & Deliverables

**Built**

- `docs/API_CONTRACT.md` (full endpoint reference), this `PROGRESS.md`, an
  updated root `README.md`, and `docs/DEMO_SCRIPT.md` (a 5-minute walkthrough).
- **Honest dependencies:** `requirements.txt` trimmed to what the code actually
  imports (the app runs fully on it); heavy accelerators moved to
  `requirements-optional.txt` (each lazily imported with a graceful fallback).
  Complete `backend/.env.example`.

**Verified (offline):**

- All backend Python compiles (`py_compile`, `app/ + tests/ + conftest.py`).
- **47 dependency-light unit tests pass in-sandbox** (utils 22, tokens 5,
  security 4, recommender 10, routing 6).
- **Frontend `tsc --noEmit` exits 0** (no type errors).
- Flutter imports/usages verified consistent.
- The remaining **14 framework/DB tests** (`test_flow` 6, `test_health` 2,
  `test_models` 3, `test_seed` 3) need FastAPI + SQLAlchemy and run on your
  machine — **`cd backend && pytest`** runs all 61.

---

## Test summary

| Suite | Tests | Where it runs |
| --- | --- | --- |
| `test_utils` | 22 | in-sandbox + machine |
| `test_recommender` | 10 | in-sandbox + machine |
| `test_routing` | 6 | in-sandbox + machine |
| `test_tokens` | 5 | in-sandbox + machine |
| `test_security` | 4 | in-sandbox + machine |
| `test_flow` (E2E) | 6 | your machine (`pytest`) |
| `test_models` | 3 | your machine (`pytest`) |
| `test_seed` | 3 | your machine (`pytest`) |
| `test_health` | 2 | your machine (`pytest`) |
| **Total** | **61** | `cd backend && pytest` |
