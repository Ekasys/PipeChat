"""Authentication schemas"""
from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime


class LoginRequest(BaseModel):
    """Login request schema"""
    username: str
    password: str
    mfa_token: Optional[str] = None


class LoginResponse(BaseModel):
    """Login response schema"""
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    user: dict


class RefreshTokenRequest(BaseModel):
    """Refresh token request schema"""
    refresh_token: str


class RefreshTokenResponse(BaseModel):
    """Refresh token response schema"""
    access_token: str
    token_type: str = "bearer"
    expires_in: int


class MFASetupRequest(BaseModel):
    """MFA setup request"""
    password: str


class MFASetupResponse(BaseModel):
    """MFA setup response"""
    secret: str
    qr_code_uri: str


class MFAVerifyRequest(BaseModel):
    """MFA verification request"""
    token: str


class SSORequest(BaseModel):
    """SSO login request"""
    provider: str  # azure_ad, okta, google
    code: str
    state: Optional[str] = None

