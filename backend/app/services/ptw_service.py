"""Price-to-Win service"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from decimal import Decimal

from app.models.ptw import PTWModel


async def create_ptw_model(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> PTWModel:
    """Create a PTW model"""
    # Calculate totals
    labor_categories = data.get("labor_categories", [])
    total_labor_cost = sum(
        float(cat.get("rate", 0)) * float(cat.get("hours", 0))
        for cat in labor_categories
    )
    
    direct_costs = total_labor_cost + float(data.get("other_direct_costs", 0) or 0)
    
    # Calculate indirects
    overhead_rate = float(data.get("overhead_rate", 0) or 0) / 100
    gaa_rate = float(data.get("gaa_rate", 0) or 0) / 100
    fee_rate = float(data.get("fee_rate", 0) or 0) / 100
    
    overhead_cost = direct_costs * overhead_rate
    gaa_base = direct_costs + overhead_cost
    gaa_cost = gaa_base * gaa_rate
    cost_base = gaa_base + gaa_cost
    fee = cost_base * fee_rate
    
    total_cost = cost_base + fee
    total_price = total_cost  # Could add profit margin
    
    ptw = PTWModel(
        tenant_id=tenant_id,
        opportunity_id=data.get("opportunity_id"),
        name=data["name"],
        scenario_type=data.get("scenario_type", "base"),
        description=data.get("description"),
        labor_categories=labor_categories,
        total_labor_cost=Decimal(str(total_labor_cost)),
        overhead_rate=Decimal(str(data.get("overhead_rate", 0) or 0)),
        gaa_rate=Decimal(str(data.get("gaa_rate", 0) or 0)),
        fee_rate=Decimal(str(data.get("fee_rate", 0) or 0)),
        direct_costs=Decimal(str(direct_costs)),
        indirect_costs=Decimal(str(overhead_cost + gaa_cost)),
        total_cost=Decimal(str(total_cost)),
        total_price=Decimal(str(total_price)),
        competitive_position=data.get("competitive_position"),
        igce_prediction=data.get("igce_prediction"),
        recommendations=data.get("recommendations"),
    )
    
    db.add(ptw)
    await db.commit()
    await db.refresh(ptw)
    return ptw


async def compare_scenarios(
    db: AsyncSession,
    opportunity_id: str,
    tenant_id: str,
) -> List[Dict[str, Any]]:
    """Compare PTW scenarios for an opportunity"""
    result = await db.execute(
        select(PTWModel).where(
            and_(
                PTWModel.opportunity_id == opportunity_id,
                PTWModel.tenant_id == tenant_id,
            )
        )
    )
    scenarios = result.scalars().all()
    
    return [
        {
            "id": s.id,
            "name": s.name,
            "scenario_type": s.scenario_type,
            "total_price": float(s.total_price or 0),
            "total_cost": float(s.total_cost or 0),
            "competitive_position": s.competitive_position,
        }
        for s in scenarios
    ]

