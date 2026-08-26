"""Auth request/response schemas."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict, EmailStr

from app.models.enums import Role
from app.schemas.post_office import PostOfficeBrief


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: str
    full_name: str
    role: Role
    phone: str | None = None
    post_office_id: int | None = None
    post_office: PostOfficeBrief | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class UserRegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: str | None = None
    role: Role = Role.SENDER  # Defaults to customer/sender


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
