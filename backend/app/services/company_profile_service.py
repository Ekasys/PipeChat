"""Company Profile service"""
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from app.models.company_profile import CompanyProfile


async def get_company_profile(
    db: AsyncSession,
    tenant_id: str,
) -> Optional[CompanyProfile]:
    """Get company profile for tenant"""
    result = await db.execute(
        select(CompanyProfile).where(CompanyProfile.tenant_id == tenant_id)
    )
    return result.scalar_one_or_none()


async def create_company_profile(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> CompanyProfile:
    """Create company profile"""
    profile = CompanyProfile(
        tenant_id=tenant_id,
        **data
    )
    db.add(profile)
    await db.commit()
    await db.refresh(profile)
    return profile


async def update_company_profile(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> Optional[CompanyProfile]:
    """Update company profile"""
    profile = await get_company_profile(db, tenant_id)
    if not profile:
        return None
    
    # Update fields
    for key, value in data.items():
        if value is not None:
            setattr(profile, key, value)
    
    await db.commit()
    await db.refresh(profile)
    return profile


async def get_company_context_for_proposals(
    db: AsyncSession,
    tenant_id: str,
) -> Dict[str, Any]:
    """Get company profile formatted for proposal generation"""
    profile = await get_company_profile(db, tenant_id)
    if not profile:
        return {}
    
    return {
        "company_name": profile.company_name,
        "legal_name": profile.legal_name,
        "company_overview": profile.company_overview,
        "mission_statement": profile.mission_statement,
        "core_values": profile.core_values or [],
        "differentiators": profile.differentiators or [],
        "core_capabilities": profile.core_capabilities or [],
        "technical_expertise": profile.technical_expertise or [],
        "service_offerings": profile.service_offerings or [],
        "certifications": profile.certifications or [],
        "contract_vehicles": profile.contract_vehicles or [],
        "past_performance_highlights": profile.past_performance_highlights or [],
        "key_personnel": profile.key_personnel or [],
        "win_themes": profile.win_themes or [],
        "standard_boilerplate": profile.standard_boilerplate or {},
    }

