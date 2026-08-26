"""Aggregate API v1 router — mounts every feature router under ``/api/v1``."""

from __future__ import annotations

from fastapi import APIRouter

from app.api.v1 import analytics, auth, consignments, deliveries, routes, slots

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(consignments.router)
api_router.include_router(slots.router)
api_router.include_router(routes.router)
api_router.include_router(deliveries.router)
api_router.include_router(analytics.router)
