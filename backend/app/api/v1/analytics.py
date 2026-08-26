"""Analytics routes: the supervisor dashboard snapshot."""

from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db, require_roles
from app.models.entities import User
from app.models.enums import Role
from app.schemas.analytics import DashboardOut
from app.services import analytics_service

router = APIRouter(prefix="/analytics", tags=["analytics"])

_OPS = require_roles(Role.SUPERVISOR, Role.ADMIN)


@router.get("/dashboard", response_model=DashboardOut)
def dashboard(
    day: datetime | None = None,
    post_office_id: int | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(_OPS),
) -> DashboardOut:
    # Auto-scope supervisor to their assigned post office
    if user.role == Role.SUPERVISOR and user.post_office_id is not None:
        post_office_id = user.post_office_id
    return analytics_service.dashboard(db, day=day, post_office_id=post_office_id)
