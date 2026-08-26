"""Shared/common response schemas."""

from __future__ import annotations

from pydantic import BaseModel


class Message(BaseModel):
    detail: str


class OkResponse(BaseModel):
    ok: bool = True
