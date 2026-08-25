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
