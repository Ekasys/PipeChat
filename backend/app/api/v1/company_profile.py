"""Company Profile API endpoints"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Dict, Any

from app.dependencies import get_db, get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.company_profile import (
    CompanyProfileCreate,
    CompanyProfileUpdate,
    CompanyProfileResponse,
)
from app.services.company_profile_service import (
    get_company_profile,
    create_company_profile,
    update_company_profile,
    get_company_context_for_proposals,
)

router = APIRouter()


@router.get("/company-profile", response_model=CompanyProfileResponse)
async def get_profile(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get company profile"""
    profile = await get_company_profile(db, tenant.id)
    if not profile:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Company profile not found. Please create one first."
        )
    return profile


@router.post("/company-profile", response_model=CompanyProfileResponse, status_code=status.HTTP_201_CREATED)
async def create_profile(
    data: CompanyProfileCreate,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create company profile"""
    # Check if profile already exists
    existing = await get_company_profile(db, tenant.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Company profile already exists. Use PUT to update."
        )
    
    profile_data = data.model_dump() if hasattr(data, 'model_dump') else data.dict()
    profile = await create_company_profile(db, tenant.id, profile_data)
    return profile


@router.put("/company-profile", response_model=CompanyProfileResponse)
async def update_profile(
    data: CompanyProfileUpdate,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update company profile"""
    profile_data = data.model_dump(exclude_unset=True) if hasattr(data, 'model_dump') else data.dict(exclude_unset=True)
    
    profile = await update_company_profile(db, tenant.id, profile_data)
    if not profile:
        # Create if doesn't exist
        create_data = CompanyProfileCreate(company_name=tenant.name, **profile_data)
        create_dict = create_data.model_dump() if hasattr(create_data, 'model_dump') else create_data.dict()
        profile = await create_company_profile(db, tenant.id, create_dict)
    
    return profile


@router.get("/company-profile/context")
async def get_context(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get company context for proposal generation"""
    context = await get_company_context_for_proposals(db, tenant.id)
    return context

