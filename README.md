# DAKSYNC

**AI-Based Customized Time-Slot Delivery of Articles/Parcels — India Post**
SIH 2026 · Problem `DJS_26_SW_14` · Team Byte Bears

DAKSYNC lets a recipient choose when they're available, recommends a suitable
delivery slot from history, plans a feasible route with Google OR-Tools, and
lets the Postman complete the delivery with OTP — updating live analytics.

> **Core proposition:** Customized slot → Smart recommendation → Optimized route → Successful first attempt.

---

## Status

Built **phase by phase** (working product first). See `docs/` and the section
below for what's live.

- ✅ **Phase 0 — Foundation:** frontend + backend + database wired together.
- ⏳ Phase 1 — Database + core models
- ⏳ Phase 2 — Consignment flow
- ⏳ Phase 3 — Recipient slot flow + bilingual UI
- ⏳ Phase 4 — AI slot recommendation
- ⏳ Phase 5 — Address + geocoding
- ⏳ Phase 6 — Route optimization (OR-Tools)
- ⏳ Phase 7 — Supervisor dashboard
- ⏳ Phase 8 — Postman app (Flutter)
- ⏳ Phase 9 — OTP · Phase 10 — Analytics · Phase 11 — UI polish

---

## Tech stack

| Layer        | Technology                                   |
| ------------ | -------------------------------------------- |
| Frontend     | Next.js 14 (App Router), React, TypeScript, Tailwind |
| Backend      | FastAPI, Pydantic, SQLAlchemy 2 (modular monolith) |
| Database     | PostgreSQL (recommended) · SQLite fallback   |
| ML           | scikit-learn / XGBoost (slot recommendation) |
| Optimization | Google OR-Tools (VRPTW)                      |
| Geocoding    | Nominatim (OpenStreetMap)                    |
| Maps         | Leaflet / OpenStreetMap                      |
| Postman app  | Flutter                                      |

---

## Prerequisites

- **Python** 3.10+
- **Node.js** 18+ (20+ recommended)
- *(Optional)* **Docker** — only if you want PostgreSQL instead of the SQLite fallback

---

## Quick start (zero-config, SQLite)

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:  .venv\Scripts\activate
# macOS/Linux:  source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env          # SQLite is the default — no editing needed
uvicorn app.main:app --reload --port 8000
```

Backend runs at <http://localhost:8000> — check <http://localhost:8000/health>
and interactive docs at <http://localhost:8000/docs>.

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
```

Frontend runs at <http://localhost:3000>. The landing page shows a live
backend-connection check.

---

## Optional: PostgreSQL (recommended target)

```bash
docker compose up -d db      # starts Postgres 16 on localhost:5432
```

Then set in `backend/.env`:

```
DATABASE_URL=postgresql+psycopg2://daksync:daksync@localhost:5432/daksync
```

Restart the backend. Everything else is identical — the models are
database-agnostic.

---

## Repository structure

```
SIH/
├── backend/            # FastAPI modular monolith
│   ├── app/
│   │   ├── main.py
│   │   ├── core/       # config
│   │   ├── api/        # routers (per phase)
│   │   ├── models/     # SQLAlchemy models
│   │   ├── schemas/    # Pydantic schemas
│   │   ├── services/   # slot / route / geocoding / notification
│   │   ├── ml/         # slot recommendation
│   │   ├── optimization/  # OR-Tools VRPTW
│   │   └── db/         # engine + session
│   └── tests/
├── frontend/           # Next.js + TypeScript + Tailwind
├── mobile/             # Flutter Postman app (Phase 8)
├── data/               # seed / demo datasets
├── scripts/            # seed & utility scripts
├── docs/               # phase notes, API docs, demo walkthrough
└── docker-compose.yml  # optional PostgreSQL
```

---

## License

Prototype for SIH 2026. Not for production use as-is.
