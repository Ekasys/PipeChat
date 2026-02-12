"""Security helpers for strict JWT validation."""
from dataclasses import dataclass
from jose import jwt, JWTError
from fastapi import Header, HTTPException, status
from typing import Optional, Dict, Any

from app.config import settings


REQUIRED_CLAIMS = ("sub", "tenant_id", "role", "email")


@dataclass
class AuthenticatedUser:
    user_id: str
    tenant_id: str
    role: str
    email: str


class AuthError(HTTPException):
    def __init__(self, detail: str):
        super().__init__(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )


def _decode_token(token: str) -> Dict[str, Any]:
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise AuthError(f"Invalid or expired token: {exc}")

    missing = [claim for claim in REQUIRED_CLAIMS if not payload.get(claim)]
    if missing:
        raise AuthError(f"Token missing required claims: {', '.join(missing)}")

    return payload


def parse_authorization_header(authorization: Optional[str]) -> str:
    if not authorization:
        raise AuthError("Authorization header missing")

    try:
        scheme, token = authorization.split()
    except ValueError:
        raise AuthError("Invalid authorization header")

    if scheme.lower() != "bearer":
        raise AuthError("Invalid authentication scheme")

    if not token.strip():
        raise AuthError("Bearer token is empty")

    return token


async def get_current_user(authorization: Optional[str] = Header(None)) -> AuthenticatedUser:
    token = parse_authorization_header(authorization)
    payload = _decode_token(token)
    return AuthenticatedUser(
        user_id=str(payload["sub"]),
        tenant_id=str(payload["tenant_id"]),
        role=str(payload["role"]),
        email=str(payload["email"]),
    )
