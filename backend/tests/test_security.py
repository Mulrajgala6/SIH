"""Tests for password hashing (stdlib-only, sandbox-runnable)."""

from app.core.security import hash_password, verify_password


def test_hash_is_not_plaintext():
    h = hash_password("admin123")
    assert h != "admin123"
    assert h.startswith("pbkdf2_sha256$")


def test_verify_roundtrip():
    h = hash_password("super-secret")
    assert verify_password("super-secret", h)
    assert not verify_password("wrong", h)


def test_unique_salts_produce_different_hashes():
    a = hash_password("same")
    b = hash_password("same")
    assert a != b
    assert verify_password("same", a)
    assert verify_password("same", b)


def test_verify_rejects_malformed():
    assert not verify_password("x", "not-a-valid-hash")
    assert not verify_password("x", "")
