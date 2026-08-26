"""Unit tests for the dependency-light helper modules.

These run in any Python environment (stdlib + no third-party deps), so they are
the sandbox-verifiable core of Phase 1.
"""

from datetime import datetime, timedelta

from app.utils.geo import distance_matrix_m, haversine_m, route_length_m
from app.utils.otp import check_otp, expiry_from, generate_otp, is_expired
from app.utils.timewindows import format_minute, format_window, minutes_to_hhmm
from app.utils.tracking import (
    generate_tracking_number,
    is_valid_tracking_number,
)


# ---------------------------------------------------------------- geo
def test_haversine_zero_distance():
    assert haversine_m(19.9975, 73.7898, 19.9975, 73.7898) == 0.0


def test_haversine_known_distance_nashik_offices():
    # Nashik City HO -> Nashik Road, roughly 7-8 km apart.
    d = haversine_m(19.9975, 73.7898, 19.9450, 73.8380)
    assert 6_000 < d < 9_000


def test_haversine_symmetric():
    a = haversine_m(19.99, 73.78, 19.94, 73.83)
    b = haversine_m(19.94, 73.83, 19.99, 73.78)
    assert abs(a - b) < 1e-6


def test_distance_matrix_shape_and_diagonal():
    pts = [(19.99, 73.78), (19.94, 73.83), (20.01, 73.79)]
    m = distance_matrix_m(pts)
    assert len(m) == 3 and all(len(row) == 3 for row in m)
    for i in range(3):
        assert m[i][i] == 0.0
    # symmetric
    assert abs(m[0][1] - m[1][0]) < 1e-6


def test_route_length_sums_legs():
    pts = [(19.99, 73.78), (19.94, 73.83), (20.01, 73.79)]
    order = [0, 1, 2]
    expected = haversine_m(*pts[0], *pts[1]) + haversine_m(*pts[1], *pts[2])
    assert abs(route_length_m(pts, order) - expected) < 1e-6


# ---------------------------------------------------------------- timewindows
def test_format_minute_on_the_hour():
    assert format_minute(600) == "10 AM"
    assert format_minute(720) == "12 PM"
    assert format_minute(0) == "12 AM"
    assert format_minute(1020) == "5 PM"


def test_format_minute_with_minutes():
    assert format_minute(630) == "10:30 AM"
    assert format_minute(1035) == "5:15 PM"


def test_format_window():
    assert format_window(600, 720) == "10 AM – 12 PM"
    assert format_window(1020, 1140) == "5 PM – 7 PM"


def test_minutes_to_hhmm():
    assert minutes_to_hhmm(600) == "10:00"
    assert minutes_to_hhmm(1035) == "17:15"


# ---------------------------------------------------------------- tracking
def test_generate_tracking_number_deterministic():
    assert generate_tracking_number(123) == "DA000000123IN"
    assert generate_tracking_number(0) == "DA000000000IN"


def test_generate_tracking_number_format_and_validity():
    tn = generate_tracking_number(42)
    assert is_valid_tracking_number(tn)
    assert len(tn) == 13


def test_generate_tracking_number_random_is_valid():
    assert is_valid_tracking_number(generate_tracking_number())


def test_is_valid_tracking_number_rejects_bad():
    assert not is_valid_tracking_number("DA123IN")
    assert not is_valid_tracking_number("1234567890123")
    assert not is_valid_tracking_number("DAxxxxxxxxxIN")


# ---------------------------------------------------------------- otp
def test_generate_otp_length_and_digits():
    for length in (4, 6):
        code = generate_otp(length)
        assert len(code) == length
        assert code.isdigit()


def test_generate_otp_rejects_bad_length():
    try:
        generate_otp(0)
    except ValueError:
        pass
    else:  # pragma: no cover
        raise AssertionError("expected ValueError for length 0")


def test_otp_expiry_math():
    now = datetime(2026, 8, 26, 10, 0, 0)
    exp = expiry_from(now, 600)
    assert exp == now + timedelta(seconds=600)
    assert not is_expired(exp, now)
    assert not is_expired(exp, now + timedelta(seconds=599))
    assert is_expired(exp, now + timedelta(seconds=600))
    assert is_expired(exp, now + timedelta(seconds=601))


def test_check_otp_success():
    now = datetime(2026, 8, 26, 10, 0, 0)
    exp = now + timedelta(minutes=30)
    d = check_otp("1234", "1234", attempts_before=0, max_attempts=5,
                  expires_at=exp, is_used=False, now=now)
    assert d.verified and d.reason == "ok"
    assert d.attempts_remaining == 4


def test_check_otp_mismatch_decrements_attempts():
    now = datetime(2026, 8, 26, 10, 0, 0)
    exp = now + timedelta(minutes=30)
    d = check_otp("1234", "0000", attempts_before=2, max_attempts=5,
                  expires_at=exp, is_used=False, now=now)
    assert not d.verified and d.reason == "mismatch"
    assert d.attempts_remaining == 2


def test_check_otp_single_use():
    now = datetime(2026, 8, 26, 10, 0, 0)
    exp = now + timedelta(minutes=30)
    d = check_otp("1234", "1234", 0, 5, exp, is_used=True, now=now)
    assert not d.verified and d.reason == "used"


def test_check_otp_expired():
    now = datetime(2026, 8, 26, 10, 0, 0)
    exp = now - timedelta(seconds=1)
    d = check_otp("1234", "1234", 0, 5, exp, is_used=False, now=now)
    assert not d.verified and d.reason == "expired"


def test_check_otp_locked_after_max_attempts():
    now = datetime(2026, 8, 26, 10, 0, 0)
    exp = now + timedelta(minutes=30)
    d = check_otp("1234", "1234", attempts_before=5, max_attempts=5,
                  expires_at=exp, is_used=False, now=now)
    assert not d.verified and d.reason == "locked"
    assert d.attempts_remaining == 0


def test_check_otp_missing():
    now = datetime(2026, 8, 26, 10, 0, 0)
    d = check_otp(None, "1234", 0, 5, None, is_used=False, now=now)
    assert not d.verified and d.reason == "missing"
