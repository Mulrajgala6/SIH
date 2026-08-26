"""Password hashing for the prototype.

Uses PBKDF2-HMAC-SHA256 from the standard library — no third-party crypto
dependency, portable across environments, and adequate for a prototype's
role-based auth. The stored format is self-describing so parameters can evolve:

    pbkdf2_sha256$<iterations>$<salt_b64>$<hash_b64>

Swapping in bcrypt/argon2 later is a drop-in change behind these two functions.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import secrets

_ALGO = "pbkdf2_sha256"
_ITERATIONS = 120_000
_SALT_BYTES = 16


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(_SALT_BYTES)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _ITERATIONS)
    return "$".join(
        [
            _ALGO,
            str(_ITERATIONS),
            base64.b64encode(salt).decode("ascii"),
            base64.b64encode(dk).decode("ascii"),
        ]
    )


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_b64, hash_b64 = stored.split("$")
        if algo != _ALGO:
            return False
        salt = base64.b64decode(salt_b64)
        expected = base64.b64decode(hash_b64)
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), salt, int(iters)
        )
    except (ValueError, TypeError):
        return False
    return hmac.compare_digest(dk, expected)
