"""Analytics routes: the supervisor dashboard snapshot."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.enums import Role
from app.schemas.analytics import DashboardOut
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])

_OPS = require_roles(Role.SUPERVISOR, Role.ADMIN)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    day: datetime | None = None, db: Session = Depends(get_db), _user=Depends(_OPS)
) -> DashboardOut:
    return analytics_service.dashboard(db, day=day)
