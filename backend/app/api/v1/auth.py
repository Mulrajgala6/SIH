"""Authentication routes: login (issue bearer token) and current-user lookup."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.security import hash_password, verify_password
from app.core.tokens import create_token
from app.models.entities import Recipient, Sender, User
from app.models.enums import Role
from app.schemas.auth import LoginRequest, TokenResponse, UserOut, UserRegisterRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(payload: UserRegisterRequest, db: Session = Depends(get_db)) -> TokenResponse:
    existing = db.query(User).filter(User.email == payload.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email already exists",
        )

    # Customer roles only for open registration
    allowed_roles = [Role.SENDER, Role.RECIPIENT]
    assigned_role = payload.role if payload.role in allowed_roles else Role.SENDER

    user = User(
        email=payload.email.lower(),
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name.strip(),
        phone=payload.phone.strip() if payload.phone else None,
        role=assigned_role,
        is_active=True,
    )
    db.add(user)
    db.flush()

    # Link sender or recipient record
    if assigned_role == Role.SENDER:
        db.add(Sender(user_id=user.id, name=user.full_name, phone=user.phone))
    elif assigned_role == Role.RECIPIENT:
        db.add(Recipient(user_id=user.id, name=user.full_name, phone=user.phone or "0000000000"))

    db.commit()
    db.refresh(user)

    token = create_token(
        user_id=user.id,
        role=user.role.value,
        secret=settings.secret_key,
        ttl_seconds=settings.token_ttl_seconds,
    )
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    user = db.query(User).filter(User.email == payload.email.lower()).first()
    if user is None or not verify_password(payload.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )
    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account disabled")

    token = create_token(
        user_id=user.id,
        role=user.role.value,
        secret=settings.secret_key,
        ttl_seconds=settings.token_ttl_seconds,
    )
    return TokenResponse(access_token=token, user=UserOut.model_validate(user))


@router.get("/me", response_model=UserOut)
def me(user: User = Depends(get_current_user)) -> UserOut:
    return UserOut.model_validate(user)
