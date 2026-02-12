"""Teaming & Partners service"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from decimal import Decimal

from app.models.partner import Partner


async def create_partner(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> Partner:
    """Create a partner"""
    partner = Partner(
        tenant_id=tenant_id,
        name=data["name"],
        company_name=data.get("company_name"),
        description=data.get("description"),
        website=data.get("website"),
        contact_email=data.get("contact_email"),
        contact_phone=data.get("contact_phone"),
        capabilities=data.get("capabilities"),
        naics_codes=data.get("naics_codes"),
        contract_vehicles=data.get("contract_vehicles"),
        past_performance=data.get("past_performance"),
        win_rate=data.get("win_rate"),
        total_contract_value=data.get("total_contract_value"),
        fit_score=data.get("fit_score"),
        scoring_factors=data.get("scoring_factors"),
        status=data.get("status", "active"),
        onboarding_status=data.get("onboarding_status", "not_started"),
    )
    
    db.add(partner)
    await db.commit()
    await db.refresh(partner)
    return partner


async def calculate_partner_fit_score(
    partner: Partner,
    opportunity_requirements: Dict[str, Any],
) -> float:
    """Calculate partner fit score"""
    score = 0.0
    factors = []
    
    # Check NAICS match
    partner_naics = set(partner.naics_codes or [])
    opp_naics = set(opportunity_requirements.get("naics_codes", []))
    if partner_naics & opp_naics:
        score += 25
        factors.append("NAICS match")
    
    # Check contract vehicles
    partner_vehicles = set(partner.contract_vehicles or [])
    opp_vehicle = opportunity_requirements.get("contract_vehicle")
    if opp_vehicle and opp_vehicle in partner_vehicles:
        score += 25
        factors.append("Contract vehicle match")
    
    # Check capabilities
    partner_caps = set(partner.capabilities or [])
    required_caps = set(opportunity_requirements.get("required_capabilities", []))
    if required_caps:
        match_ratio = len(partner_caps & required_caps) / len(required_caps)
        score += match_ratio * 30
        factors.append(f"Capability match: {match_ratio * 100:.0f}%")
    
    # Past performance
    if partner.win_rate:
        score += min(float(partner.win_rate), 20)
        factors.append(f"Win rate: {partner.win_rate}%")
    
    return min(score, 100.0)


async def list_partners(
    db: AsyncSession,
    tenant_id: str,
    filters: Optional[Dict[str, Any]] = None,
) -> List[Partner]:
    """List partners with optional filtering"""
    query = select(Partner).where(Partner.tenant_id == tenant_id)
    
    if filters:
        if filters.get("status"):
            query = query.where(Partner.status == filters["status"])
        if filters.get("naics_code"):
            # Filter by NAICS code in array
            # This is simplified - in production, use proper array query
            pass
    
    result = await db.execute(query)
    return list(result.scalars().all())

