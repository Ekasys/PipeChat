"""Unit tests for security functions"""
import pytest
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    verify_token,
    generate_mfa_secret,
    verify_mfa_token,
)


def test_hash_password():
    """Test password hashing"""
    password = "testpassword123"
    hashed = hash_password(password)
    assert hashed != password
    assert len(hashed) > 0


def test_verify_password():
    """Test password verification"""
    password = "testpassword123"
    hashed = hash_password(password)
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False


def test_create_and_verify_token():
    """Test JWT token creation and verification"""
    data = {"sub": "user123", "tenant_id": "tenant123"}
    token = create_access_token(data)
    assert token is not None
    
    payload = verify_token(token)
    assert payload is not None
    assert payload["sub"] == "user123"
    assert payload["tenant_id"] == "tenant123"


def test_mfa_secret_generation():
    """Test MFA secret generation"""
    secret = generate_mfa_secret()
    assert secret is not None
    assert len(secret) > 0


def test_mfa_token_verification():
    """Test MFA token verification"""
    import pyotp
    
    secret = generate_mfa_secret()
    totp = pyotp.TOTP(secret)
    token = totp.now()
    
    assert verify_mfa_token(secret, token) is True
    assert verify_mfa_token(secret, "000000") is False

