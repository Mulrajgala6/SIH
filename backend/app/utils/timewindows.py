"""Time-window helpers (pure Python).

Delivery slots are stored as minutes-from-midnight so they double as OR-Tools
time windows. These helpers render them as human labels ("5 PM – 7 PM").
"""

from __future__ import annotations


def format_minute(minute: int) -> str:
    """Render minutes-from-midnight as a 12-hour clock label, e.g. 1020 -> '5 PM'."""
    minute %= 24 * 60
    hour, mm = divmod(minute, 60)
    suffix = "AM" if hour < 12 else "PM"
    hour12 = hour % 12 or 12
    if mm:
        return f"{hour12}:{mm:02d} {suffix}"
    return f"{hour12} {suffix}"


def format_window(start_minutes: int, end_minutes: int) -> str:
    """e.g. (1020, 1140) -> '5 PM – 7 PM'."""
    return f"{format_minute(start_minutes)} – {format_minute(end_minutes)}"


def minutes_to_hhmm(minute: int) -> str:
    """24-hour 'HH:MM' rendering (useful for ETAs)."""
    minute %= 24 * 60
    hour, mm = divmod(minute, 60)
    return f"{hour:02d}:{mm:02d}"
