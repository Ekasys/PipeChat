"""Unit tests for JWT claim validation."""
from app.security import parse_authorization_header, _decode_token
from app.config import settings
from jose import jwt
import pytest


def _token(payload):
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def test_parse_authorization_header_success():
    assert parse_authorization_header("Bearer abc") == "abc"


def test_parse_authorization_header_missing():
    with pytest.raises(Exception):
        parse_authorization_header(None)


def test_decode_token_requires_claims():
    token = _token({"sub": "u1", "tenant_id": "t1"})
    with pytest.raises(Exception):
        _decode_token(token)


def test_decode_token_accepts_required_claims():
    token = _token(
        {
            "sub": "user-1",
            "tenant_id": "tenant-1",
            "role": "admin",
            "email": "user@example.com",
        }
    )
    payload = _decode_token(token)
    assert payload["tenant_id"] == "tenant-1"
