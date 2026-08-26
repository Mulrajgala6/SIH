"""OTP helpers (pure Python).

Cryptographically-random numeric OTPs plus expiry math. The verification
lifecycle (single-use, attempt limits, persistence) lives in the delivery
service (Phase 9); this module only produces and time-bounds codes.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import datetime, timedelta


def generate_otp(length: int = 4) -> str:
    """Return a zero-padded numeric OTP of the requested length."""
    if length < 1:
        raise ValueError("OTP length must be >= 1")
    upper = 10 ** length
    return f"{secrets.randbelow(upper):0{length}d}"


def expiry_from(now: datetime, ttl_seconds: int) -> datetime:
    return now + timedelta(seconds=ttl_seconds)


def is_expired(expires_at: datetime, now: datetime) -> bool:
    return now >= expires_at


@dataclass
class OtpDecision:
    verified: bool
    reason: str  # ok | missing | used | locked | expired | mismatch
    attempts_remaining: int


def check_otp(
    stored_code: str | None,
    given_code: str,
    attempts_before: int,
    max_attempts: int,
    expires_at: datetime | None,
    is_used: bool,
    now: datetime,
) -> OtpDecision:
    """Pure OTP verification decision (no DB). Enforces single-use, expiry, and
    an attempt limit. The caller persists the resulting state."""
    if stored_code is None or expires_at is None:
        return OtpDecision(False, "missing", 0)
    if is_used:
        return OtpDecision(False, "used", 0)
    if attempts_before >= max_attempts:
        return OtpDecision(False, "locked", 0)
    remaining = max_attempts - (attempts_before + 1)
    if is_expired(expires_at, now):
        return OtpDecision(False, "expired", max(remaining, 0))
    if secrets.compare_digest(str(stored_code), str(given_code)):
        return OtpDecision(True, "ok", max(remaining, 0))
    return OtpDecision(False, "mismatch", max(remaining, 0))
