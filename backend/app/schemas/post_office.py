"""Post Office schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class PostOfficeBrief(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    pincode: str
    latitude: float
    longitude: float


class PostOfficeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    code: str
    name: str
    pincode: str
    latitude: float
    longitude: float
