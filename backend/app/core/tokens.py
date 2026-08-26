"""Signed bearer tokens (stdlib HMAC — no external JWT dependency).

Format:  base64url(payload_json) + "." + base64url(hmac_sha256_sig)
Payload: {"sub": <user_id>, "role": <role>, "exp": <unix_ts>}

This is deliberately simple and dependency-free for the prototype. Swapping in
PyJWT / RS256 later is a drop-in change behind ``create_token`` / ``decode_token``.
The functions here are pure (no framework), so they are unit-tested in-sandbox.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import time


def _b64u_encode(raw: bytes) -> str:
    return base64.urlsafe_b64encode(raw).rstrip(b"=").decode("ascii")


def _b64u_decode(data: str) -> bytes:
    pad = "=" * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + pad)


def _sign(payload_b64: str, secret: str) -> str:
    sig = hmac.new(secret.encode("utf-8"), payload_b64.encode("ascii"), hashlib.sha256).digest()
    return _b64u_encode(sig)


def create_token(user_id: int, role: str, secret: str, ttl_seconds: int, *, now: float | None = None) -> str:
    issued = int(now if now is not None else time.time())
    payload = {"sub": user_id, "role": role, "exp": issued + ttl_seconds}
    payload_b64 = _b64u_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    return f"{payload_b64}.{_sign(payload_b64, secret)}"


def decode_token(token: str, secret: str, *, now: float | None = None) -> dict | None:
    """Return the payload dict if the signature is valid and unexpired, else None."""
    try:
        payload_b64, sig = token.split(".", 1)
    except ValueError:
        return None
    expected = _sign(payload_b64, secret)
    if not hmac.compare_digest(expected, sig):
        return None
    try:
        payload = json.loads(_b64u_decode(payload_b64))
    except (ValueError, json.JSONDecodeError):
        return None
    current = now if now is not None else time.time()
    if float(payload.get("exp", 0)) < current:
        return None
    return payload
