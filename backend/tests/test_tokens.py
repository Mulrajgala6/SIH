"""Tests for signed bearer tokens (stdlib-only, sandbox-runnable)."""

from app.core.tokens import create_token, decode_token

SECRET = "unit-test-secret"


def test_token_roundtrip():
    tok = create_token(7, "SUPERVISOR", SECRET, 3600, now=1000)
    payload = decode_token(tok, SECRET, now=1001)
    assert payload is not None
    assert payload["sub"] == 7
    assert payload["role"] == "SUPERVISOR"


def test_token_expired():
    tok = create_token(1, "POSTMAN", SECRET, 10, now=1000)
    assert decode_token(tok, SECRET, now=1009) is not None
    assert decode_token(tok, SECRET, now=1011) is None  # past expiry


def test_token_bad_signature():
    tok = create_token(1, "ADMIN", SECRET, 3600, now=1000)
    assert decode_token(tok, "wrong-secret", now=1001) is None


def test_token_tampered_payload():
    tok = create_token(1, "RECIPIENT", SECRET, 3600, now=1000)
    payload_b64, sig = tok.split(".", 1)
    tampered = "YWJj" + "." + sig
    assert decode_token(tampered, SECRET, now=1001) is None


def test_token_malformed():
    assert decode_token("not-a-token", SECRET) is None
    assert decode_token("", SECRET) is None
