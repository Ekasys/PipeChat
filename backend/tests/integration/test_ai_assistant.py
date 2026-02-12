"""Integration tests for AI Assistant endpoints"""
import pytest
from fastapi import status


@pytest.mark.asyncio
async def test_parse_rfp_missing_document(client, test_user, test_tenant):
    """Test parsing RFP with non-existent document"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try to parse non-existent document
    response = client.post(
        "/api/v1/ai/parse-rfp",
        json={"document_id": "non-existent-id"},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code in [status.HTTP_400_BAD_REQUEST, status.HTTP_404_NOT_FOUND]


@pytest.mark.asyncio
async def test_parse_rfp_invalid_request(client, test_user):
    """Test parsing RFP with invalid request"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try with empty document_id
    response = client.post(
        "/api/v1/ai/parse-rfp",
        json={"document_id": ""},
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_draft_proposal_invalid_section(client, test_user):
    """Test drafting proposal with invalid section type"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try with invalid section type
    response = client.post(
        "/api/v1/ai/draft-proposal",
        json={
            "opportunity_id": "test-opp-id",
            "section_type": "invalid_section",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_tailor_resume_validation(client, test_user):
    """Test resume tailoring with validation"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try with too short text
    response = client.post(
        "/api/v1/ai/tailor-resume",
        json={
            "resume_text": "short",
            "sow_text": "short",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_generate_company_field_invalid_url(client, test_user):
    """Test company field generation with invalid URL"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try with invalid URL
    response = client.post(
        "/api/v1/ai/generate-company-field",
        json={
            "website_url": "not-a-url",
            "field_name": "company_overview",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


@pytest.mark.asyncio
async def test_generate_company_field_invalid_field(client, test_user):
    """Test company field generation with invalid field name"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try with invalid field name
    response = client.post(
        "/api/v1/ai/generate-company-field",
        json={
            "website_url": "https://example.com",
            "field_name": "invalid_field",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY















