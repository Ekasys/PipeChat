"""Unit tests for tenant resolution policy."""
import pytest
from starlette.requests import Request

from app.core.security import create_access_token
from app.core.tenant import get_tenant_id


def _request(headers: dict[str, str]) -> Request:
    scope = {
        "type": "http",
        "method": "GET",
        "path": "/",
        "headers": [
            (key.lower().encode("latin-1"), value.encode("latin-1"))
            for key, value in headers.items()
        ],
    }
    return Request(scope)


@pytest.mark.asyncio
async def test_get_tenant_id_uses_jwt_bearer_token():
    token = create_access_token(
        {
            "sub": "user-1",
            "tenant_id": "tenant-from-token",
            "role": "admin",
            "email": "admin@example.com",
        }
    )
    request = _request(
        {
            "Authorization": f"Bearer {token}",
            "X-Tenant-ID": "tenant-from-header",
            "Host": "tenant-from-subdomain.example.com",
        }
    )

    assert await get_tenant_id(request) == "tenant-from-token"


@pytest.mark.asyncio
async def test_get_tenant_id_ignores_header_and_subdomain_without_jwt():
    request = _request(
        {
            "X-Tenant-ID": "tenant-from-header",
            "Host": "tenant-from-subdomain.example.com",
        }
    )

    assert await get_tenant_id(request) is None
