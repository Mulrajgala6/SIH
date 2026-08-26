"""Post Offices API endpoints (public/ops)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_db
from app.models.entities import PostOffice
from app.schemas.post_office import PostOfficeOut

router = APIRouter(prefix="/post-offices", tags=["post-offices"])


@router.get("", response_model=list[PostOfficeOut])
def list_post_offices(db: Session = Depends(get_db)) -> list[PostOfficeOut]:
    """List all available post offices and regional hubs."""
    offices = db.query(PostOffice).order_by(PostOffice.id.asc()).all()
    return offices
