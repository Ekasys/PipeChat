"""Integration tests for proposal volumes"""
import pytest
from fastapi import status


@pytest.mark.asyncio
async def test_create_proposal_volume(client, test_user, test_tenant):
    """Test creating a proposal volume"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity first
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume
    response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "draft",
            "source": "user",
            "description": "Technical approach volume",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Volume I: Technical"
    assert data["volume_type"] == "technical"
    assert data["status"] == "draft"
    assert data["source"] == "user"
    assert "order_index" in data


@pytest.mark.asyncio
async def test_list_proposal_volumes(client, test_user, test_tenant):
    """Test listing proposal volumes"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create volumes
    client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume II: Management",
            "volume_type": "management",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    
    # List volumes
    response = client.get(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "volumes" in data
    assert len(data["volumes"]) == 2


@pytest.mark.asyncio
async def test_update_proposal_volume(client, test_user, test_tenant):
    """Test updating a proposal volume"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume
    volume_response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    volume_id = volume_response.json()["id"]
    
    # Update the volume
    response = client.put(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes/{volume_id}",
        json={
            "status": "in_review",
            "description": "Updated description",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["status"] == "in_review"
    assert data["description"] == "Updated description"


@pytest.mark.asyncio
async def test_delete_proposal_volume(client, test_user, test_tenant):
    """Test deleting a proposal volume"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume
    volume_response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    volume_id = volume_response.json()["id"]
    
    # Delete the volume
    response = client.delete(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes/{volume_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    
    # Verify it's deleted
    get_response = client.get(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes/{volume_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert get_response.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.asyncio
async def test_cannot_delete_locked_volume(client, test_user, test_tenant):
    """Test that locked volumes cannot be deleted"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume with locked status
    volume_response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "locked",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    volume_id = volume_response.json()["id"]
    
    # Try to delete the locked volume
    response = client.delete(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes/{volume_id}",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "locked" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_unique_volume_name_per_proposal(client, test_user, test_tenant):
    """Test that volume names must be unique per proposal"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create first volume
    client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    
    # Try to create another volume with the same name
    response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "management",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert "already exists" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_create_volume_with_rfp_reference(client, test_user, test_tenant):
    """Test creating a volume with RFP reference"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume with RFP reference
    response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical Approach",
            "source": "rfp",
            "rfp_reference": {
                "section_number": "L.3.1",
                "page_range": "pp. 12-18",
                "clause_text_snippet": "The contractor shall provide a detailed technical approach..."
            },
            "status": "draft",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Volume I: Technical Approach"
    assert data["source"] == "rfp"
    assert data["rfp_reference"]["section_number"] == "L.3.1"
    assert data["rfp_reference"]["page_range"] == "pp. 12-18"


@pytest.mark.asyncio
async def test_create_proposal_section(client, test_user, test_tenant):
    """Test creating a proposal section"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume
    volume_response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    volume_id = volume_response.json()["id"]
    
    # Create a section
    response = client.post(
        f"/api/v1/proposals/{proposal_id}/volumes/{volume_id}/sections",
        json={
            "heading": "Solution Overview",
            "source": "user",
            "content": "This section describes our solution...",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["heading"] == "Solution Overview"
    assert data["source"] == "user"
    assert "order_index" in data


@pytest.mark.asyncio
async def test_list_proposal_sections(client, test_user, test_tenant):
    """Test listing proposal sections"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume
    volume_response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Volume I: Technical",
            "volume_type": "technical",
            "status": "draft",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    volume_id = volume_response.json()["id"]
    
    # Create sections
    client.post(
        f"/api/v1/proposals/{proposal_id}/volumes/{volume_id}/sections",
        json={
            "heading": "Section 1",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    client.post(
        f"/api/v1/proposals/{proposal_id}/volumes/{volume_id}/sections",
        json={
            "heading": "Section 2",
            "source": "user",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    
    # List sections
    response = client.get(
        f"/api/v1/proposals/{proposal_id}/volumes/{volume_id}/sections",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert "sections" in data
    assert len(data["sections"]) == 2


@pytest.mark.asyncio
async def test_volume_type_optional(client, test_user, test_tenant):
    """Test that volume_type is optional"""
    # Login
    login_response = client.post(
        "/api/v1/auth/login",
        json={"username": "testuser", "password": "testpassword"},
    )
    access_token = login_response.json()["access_token"]
    
    # Create an opportunity
    opp_response = client.post(
        "/api/v1/opportunities/opportunities",
        json={
            "name": "Test Opportunity",
            "agency": "Test Agency",
            "stage": "qualification",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    opportunity_id = opp_response.json()["id"]
    
    # Create a proposal
    proposal_response = client.post(
        "/api/v1/proposals/proposals",
        json={
            "name": "Test Proposal",
            "opportunity_id": opportunity_id,
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    proposal_id = proposal_response.json()["id"]
    
    # Create a volume without volume_type
    response = client.post(
        f"/api/v1/proposals/proposals/{proposal_id}/volumes",
        json={
            "name": "Custom Volume Name",
            "source": "user",
            "status": "draft",
        },
        headers={"Authorization": f"Bearer {access_token}"},
    )
    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["name"] == "Custom Volume Name"
    assert data.get("volume_type") is None or data["volume_type"] is None



