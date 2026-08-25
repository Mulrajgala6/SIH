"""DAKSYNC FastAPI application entry point.

Phase 0 wires up the app, CORS and health checks. Feature routers
(consignments, slots, routes, deliveries, analytics) are added in later phases.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from app.core.config import settings
from app.db.session import engine

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="AI-assisted delivery scheduling & route planning for India Post.",
)

# CORS — allow the local Next.js frontend during development.
app.add_middleware(
    CORSMiddleware,
    allow_origins=list(
        {
            settings.frontend_origin,
            "http://localhost:3000",
            "http://127.0.0.1:3000",
        }
    ),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
        "docs": "/docs",
        "health": "/health",
    }


@app.get("/health", tags=["meta"])
def health() -> dict:
    """Liveness + database connectivity check."""
    db_connected = True
    db_error: str | None = None
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
    except Exception as exc:  # pragma: no cover - defensive
        db_connected = False
        db_error = str(exc)

    return {
        "status": "ok" if db_connected else "degraded",
        "service": settings.app_name,
        "version": settings.app_version,
        "database": {
            "connected": db_connected,
            "engine": settings.database_url.split(":", 1)[0],
            "error": db_error,
        },
    }
