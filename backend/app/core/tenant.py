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
    """Extract tenant from subdomain (e.g., tenant1.pipelinepro.com)"""
    host = request.headers.get("host", "")
    if "." in host:
        subdomain = host.split(".")[0]
        # Validate subdomain format
        if subdomain and subdomain != "www" and subdomain != "api":
            return subdomain
    return None


def get_tenant_from_header(request: Request) -> Optional[str]:
    """Extract tenant from custom header"""
    return request.headers.get("X-Tenant-ID")


async def get_tenant_id(request: Request) -> Optional[str]:
    """Get tenant ID from various sources (token, subdomain, header)"""
    # Try token first
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
    
    # Try subdomain
    tenant_id = get_tenant_from_subdomain(request)
    if tenant_id:
        return tenant_id
    
    # Try header
    tenant_id = get_tenant_from_header(request)
    if tenant_id:
        return tenant_id
    
    return None


