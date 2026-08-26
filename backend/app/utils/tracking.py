"""Consignment tracking-number helpers (pure Python).

India Post-style article numbers: two letters, nine digits, two letters
(e.g. ``DA000000123IN``). Deterministic when a sequence number is supplied,
which keeps seeded demo data stable and readable.
"""

from __future__ import annotations

import random
import string

PREFIX = "DA"
SUFFIX = "IN"


def generate_tracking_number(seq: int | None = None) -> str:
    if seq is not None:
        digits = f"{seq % 1_000_000_000:09d}"
    else:
        digits = "".join(random.choices(string.digits, k=9))
    return f"{PREFIX}{digits}{SUFFIX}"


def is_valid_tracking_number(value: str) -> bool:
    return (
        len(value) == 13
        and value[:2].isalpha()
        and value[2:11].isdigit()
        and value[11:].isalpha()
    )
