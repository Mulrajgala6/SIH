# DAKSYNC

**AI-Based Customized Time-Slot Delivery of Articles/Parcels — India Post**
SIH 2026 · Problem `DJS_26_SW_14` · Team Byte Bears

DAKSYNC lets a recipient choose when they're available, recommends a suitable
delivery slot from history, plans a feasible route, and lets the postman complete
the delivery with an OTP — updating live analytics.

> **Core loop:** Customized slot → smart recommendation → optimized route →
> OTP-verified first-attempt delivery → live analytics.

---

## Status — all phases built ✅

| Phase | | Phase | |
| --- | --- | --- | --- |
| 0 — Foundation | ✅ | 6 — Route optimization | ✅ |
| 1 — Database + core | ✅ | 7 — Supervisor dashboard | ✅ |
| 2 — Consignment flow | ✅ | 8 — Postman app (Flutter) | ✅ |
| 3 — Recipient slot flow + bilingual UI | ✅ | 9 — OTP system | ✅ |
| 4 — AI slot recommendation | ✅ | 10 — Analytics | ✅ |
| 5 — Address + geocoding | ✅ | 11 — UI polish | ✅ |

See **`docs/PROGRESS.md`** for what each phase built and how it was verified,
**`docs/API_CONTRACT.md`** for the full endpoint reference, and
**`docs/DEMO_SCRIPT.md`** for a 5-minute walkthrough.

**Verification:** 47 dependency-light unit tests pass offline; the frontend
type-checks clean (`tsc --noEmit`); the full suite is **61 tests**
(`cd backend && pytest`).

---

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Next.js 14 (App Router), React 18, TypeScript, Tailwind — bilingual EN / हिन्दी |
| Backend | FastAPI, Pydantic v2, SQLAlchemy 2 (modular monolith) |
| Auth | Stdlib HMAC bearer tokens + PBKDF2 password hashing (no heavy crypto deps) |
| Database | SQLite (zero-config default) · PostgreSQL (recommended, `docker-compose`) |
| Recommendation | History-based, Laplace-smoothed **Bayesian** slot scorer (pure Python); optional `model.joblib` artifact hook |
| Optimization | Google OR-Tools VRPTW when installed; pure-Python nearest-neighbour + 2-opt fallback |
| Geocoding | Seeded offline Nashik centroids · Nominatim (OpenStreetMap) online fallback |
| Postman app | Flutter (Material 3), `http` + `provider` |

Everything runs on the **core** dependencies alone; OR-Tools, PostgreSQL, online
geocoding and a trained model artifact are all optional upgrades with graceful
fallbacks (see `backend/requirements-optional.txt`).

---

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+ (20+ recommended)
- *(Optional)* **Flutter** 3.x — only for the postman app
- *(Optional)* **Docker** — only if you want PostgreSQL instead of SQLite

---

## Quick start (zero-config, SQLite)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:      .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env            # SQLite is the default — no editing needed

python -m app.db.seed           # create tables + load the demo dataset
uvicorn app.main:app --reload --port 8000
```

Backend runs at <http://localhost:8000> — health at `/health`, interactive API
docs at `/docs`.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend runs at <http://localhost:3000>.

### 3. Postman app *(optional)*

```bash
cd mobile
flutter pub get
flutter run -d chrome           # simplest for a laptop demo (backend on same host)
# Android emulator:  flutter run --dart-define=API_BASE=http://10.0.2.2:8000
```

---

## Demo logins

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@daksync.in` | `admin123` |
| Supervisor | `supervisor@daksync.in` | `super123` |
| Postman | `postman1@daksync.in` … `postman4@daksync.in` | `post123` |

Recipients don't log in — the confirm/track links use the consignment's
tracking number as a capability token.

## The 90-second happy path

1. **Seed** loads active consignments awaiting delivery.
2. Sign in as **supervisor** → **optimize today's routes** (`POST /routes/optimize`).
3. Open the **postman app**, sign in as `postman1`, open the route.
4. **Start** a stop → the demo OTP is shown on-screen → **verify** → **complete**.
5. Back in the web **dashboard**, the KPIs (first-attempt success, delivered
   today) update.

Full script with talking points: **`docs/DEMO_SCRIPT.md`**.

---

## Optional: PostgreSQL

```bash
docker compose up -d db          # Postgres 16 on localhost:5432
pip install -r backend/requirements-optional.txt   # installs psycopg2-binary
```

Then set in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://daksync:daksync@localhost:5432/daksync
```

Re-run `python -m app.db.seed` and restart the backend. The models are
database-agnostic — nothing else changes.

---

## Tests

```bash
cd backend && pytest             # 61 tests (uses an isolated throwaway DB)
```

Dependency-light business logic (utils, tokens, security, recommender, routing —
47 tests) also runs without the web/ORM stack installed.

---

## Repository structure

```
SIH/
├── backend/                # FastAPI modular monolith
│   ├── app/
│   │   ├── main.py
│   │   ├── core/           # config, security, tokens
│   │   ├── api/v1/         # auth, consignments, slots, routes, deliveries, analytics
│   │   ├── models/         # SQLAlchemy models + enums
│   │   ├── schemas/        # Pydantic v2 schemas
│   │   ├── services/       # slot, consignment, routing, geocoding, delivery, analytics
│   │   ├── ml/             # feasibility rules + Bayesian slot recommender
│   │   ├── utils/          # geo, time windows, OTP, tracking numbers
│   │   └── db/             # engine, session, init_db, seed
│   ├── tests/              # 61 tests
│   ├── requirements.txt            # core (everything runs on this)
│   └── requirements-optional.txt   # optional accelerators (graceful fallbacks)
├── frontend/               # Next.js + TypeScript + Tailwind (bilingual)
├── mobile/                 # Flutter postman app (Phase 8)
├── docs/                   # PROGRESS · API_CONTRACT · DEMO_SCRIPT
└── docker-compose.yml      # optional PostgreSQL
```

---

## License

Prototype for SIH 2026. Not for production use as-is.
