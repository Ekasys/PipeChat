"""Integration tests for document endpoints"""
import pytest
from fastapi import status
import io


@pytest.mark.asyncio
async def test_upload_document_empty_file(client, test_user):
    """Test uploading an empty file"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try to upload empty file
    files = {"file": ("empty.txt", io.BytesIO(b""), "text/plain")}
    response = client.post(
        "/api/v1/documents/documents",
        files=files,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_upload_document_invalid_type(client, test_user):
    """Test uploading a file with invalid type"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try to upload invalid file type
    files = {"file": ("test.exe", io.BytesIO(b"binary content"), "application/x-msdownload")}
    response = client.post(
        "/api/v1/documents/documents",
        files=files,
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.asyncio
async def test_list_documents(client, test_user):
    """Test listing documents"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # List documents
    response = client.get(
        "/api/v1/documents/documents",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    assert "documents" in response.json()


@pytest.mark.asyncio
async def test_get_document_not_found(client, test_user):
    """Test getting a non-existent document"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try to get non-existent document
    response = client.get(
        "/api/v1/documents/documents/non-existent-id",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_delete_document_not_found(client, test_user):
    """Test deleting a non-existent document"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Try to delete non-existent document
    response = client.delete(
        "/api/v1/documents/documents/non-existent-id",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_404_NOT_FOUND















