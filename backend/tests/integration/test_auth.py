"""Integration tests for authentication"""
import pytest
from fastapi import status


@pytest.mark.asyncio
async def test_login_invalid_credentials(client):
    """Test login with invalid credentials"""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "nonexistent", "password": "wrong"},
    )
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_login_valid_credentials(client, test_user):
    """Test login with valid credentials"""
    response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "access_token" in data
    assert "refresh_token" in data
    assert data["user"]["email"] == "test@example.com"


@pytest.mark.asyncio
async def test_refresh_token(client, test_user):
    """Test token refresh"""
    # First login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    refresh_token = login_response.json()["refresh_token"]
    
    # Refresh
    refresh_response = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": refresh_token},
    )
    assert refresh_response.status_code == status.HTTP_200_OK
    assert "access_token" in refresh_response.json()


@pytest.mark.asyncio
async def test_protected_endpoint_without_token(client):
    """Test accessing protected endpoint without token"""
    response = client.get("/api/v1/dashboard/metrics")
    assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.asyncio
async def test_protected_endpoint_with_token(client, test_user):
    """Test accessing protected endpoint with valid token"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Access protected endpoint
    response = client.get(
        "/api/v1/dashboard/metrics",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK

