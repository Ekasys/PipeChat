"""Integration tests for opportunities"""
import pytest
from fastapi import status


@pytest.mark.asyncio
async def test_create_opportunity(client, test_user, test_tenant):
    """Test creating an opportunity"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create opportunity
    response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
            "value": 1000000,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Test Opportunity"
    assert data["agency"] == "Test Agency"


@pytest.mark.asyncio
async def test_list_opportunities(client, test_user):
    """Test listing opportunities"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # List opportunities
    response = client.get(
        "/api/v1/opportunities/opportunities",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert "opportunities" in response.json()

