"""Multi-tenant isolation logic"""
from typing import Optional
from fastapi import Request
from app.core.security import verify_token


def get_tenant_from_token(token: str) -> Optional[str]:
    """Extract tenant_id from JWT token"""
    payload = verify_token(token)
    if payload:
        return payload.get("tenant_id")
    return None


def get_tenant_from_subdomain(request: Request) -> Optional[str]:
    """Deprecated: tenant must come from JWT claims only."""
    _ = request
    return None


def get_tenant_from_header(request: Request) -> Optional[str]:
    """Deprecated: tenant must come from JWT claims only."""
    _ = request
    return None


async def get_tenant_id(request: Request) -> Optional[str]:
    """Get tenant ID from JWT token only."""
    auth_header = request.headers.get("authorization")
    if auth_header:
        try:
            scheme, token = auth_header.split()
            if scheme.lower() == "bearer":
                tenant_id = get_tenant_from_token(token)
                if tenant_id:
                    return tenant_id
        except ValueError:
            pass

    return None

