"""Price-to-Win endpoints"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.ptw_service import create_ptw_model, compare_scenarios

router = APIRouter()


@router.post("/scenarios")
async def create_scenario(
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a PTW scenario"""
    scenario = await create_ptw_model(db=db, tenant_id=tenant.id, data=data)
    return scenario


@router.get("/scenarios")
async def list_scenarios(
    opportunity_id: Optional[str] = Query(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List all PTW scenarios for the tenant, optionally filtered by opportunity"""
    from app.models.ptw import PTWModel
    from sqlalchemy import select
    from fastapi import HTTPException, status
    import logging
    
    logger = logging.getLogger(__name__)
    
    try:
        if opportunity_id:
            scenarios = await compare_scenarios(db, opportunity_id, tenant.id)
        else:
            result = await db.execute(
                select(PTWModel).where(PTWModel.tenant_id == tenant.id)
            )
            all_scenarios = result.scalars().all()
            scenarios = [
                {
                    "id": s.id,
                    "name": s.name,
                    "opportunity_id": s.opportunity_id,
                    "scenario_type": s.scenario_type,
                    "description": s.description,
                    "labor_categories": s.labor_categories or [],
                    "overhead_rate": float(s.overhead_rate or 0),
                    "gaa_rate": float(s.gaa_rate or 0),
                    "fee_rate": float(s.fee_rate or 0),
                    "total_labor_cost": float(s.total_labor_cost or 0),
                    "direct_costs": float(s.direct_costs or 0),
                    "indirect_costs": float(s.indirect_costs or 0),
                    "total_cost": float(s.total_cost or 0),
                    "total_price": float(s.total_price or 0),
                    "competitive_position": s.competitive_position,
                    "created_at": s.created_at.isoformat() if s.created_at else None,
                }
                for s in all_scenarios
            ]
        return {"scenarios": scenarios}
    except Exception as e:
        error_msg = str(e)
        logger.error(f"Error listing PTW scenarios: {error_msg}", exc_info=True)
        
        # Check if it's a table doesn't exist error
        if "does not exist" in error_msg.lower() or "relation" in error_msg.lower():
            logger.warning("PTW table may not exist. Returning empty list. Run migrations if needed.")
            return {"scenarios": []}
        
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load scenarios: {error_msg}"
        )


@router.get("/scenarios/{scenario_id}")
async def get_scenario(
    scenario_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get a single PTW scenario by ID"""
    from app.models.ptw import PTWModel
    from sqlalchemy import select
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(PTWModel).where(
            PTWModel.id == scenario_id,
            PTWModel.tenant_id == tenant.id
        )
    )
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    
    return {
        "id": scenario.id,
        "name": scenario.name,
        "opportunity_id": scenario.opportunity_id,
        "scenario_type": scenario.scenario_type,
        "description": scenario.description,
        "labor_categories": scenario.labor_categories or [],
        "overhead_rate": float(scenario.overhead_rate or 0),
        "gaa_rate": float(scenario.gaa_rate or 0),
        "fee_rate": float(scenario.fee_rate or 0),
        "total_labor_cost": float(scenario.total_labor_cost or 0),
        "direct_costs": float(scenario.direct_costs or 0),
        "indirect_costs": float(scenario.indirect_costs or 0),
        "total_cost": float(scenario.total_cost or 0),
        "total_price": float(scenario.total_price or 0),
        "competitive_position": scenario.competitive_position,
        "created_at": scenario.created_at.isoformat() if scenario.created_at else None,
    }


@router.put("/scenarios/{scenario_id}")
async def update_scenario(
    scenario_id: str,
    data: dict,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a PTW scenario"""
    from app.models.ptw import PTWModel
    from sqlalchemy import select
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(PTWModel).where(
            PTWModel.id == scenario_id,
            PTWModel.tenant_id == tenant.id
        )
    )
    scenario = result.scalar_one_or_none()
    
    if not scenario:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scenario not found")
    
    # Recalculate totals if labor categories or rates changed
    labor_categories = data.get("labor_categories", scenario.labor_categories or [])
    total_labor_cost = sum(
        float(cat.get("rate", 0)) * float(cat.get("hours", 0))
        for cat in labor_categories
    )
    
    direct_costs = total_labor_cost + float(data.get("other_direct_costs", 0) or 0)
    
    overhead_rate = float(data.get("overhead_rate", scenario.overhead_rate or 0) or 0) / 100
    gaa_rate = float(data.get("gaa_rate", scenario.gaa_rate or 0) or 0) / 100
    fee_rate = float(data.get("fee_rate", scenario.fee_rate or 0) or 0) / 100
    
    overhead_cost = direct_costs * overhead_rate
    gaa_base = direct_costs + overhead_cost
    gaa_cost = gaa_base * gaa_rate
    cost_base = gaa_base + gaa_cost
    fee = cost_base * fee_rate
    
    total_cost = cost_base + fee
    total_price = total_cost
    
    # Update fields
    from decimal import Decimal
    scenario.name = data.get("name", scenario.name)
    scenario.opportunity_id = data.get("opportunity_id", scenario.opportunity_id)
    scenario.scenario_type = data.get("scenario_type", scenario.scenario_type)
    scenario.description = data.get("description", scenario.description)
    scenario.labor_categories = labor_categories
    scenario.overhead_rate = Decimal(str(data.get("overhead_rate", scenario.overhead_rate or 0) or 0))
    scenario.gaa_rate = Decimal(str(data.get("gaa_rate", scenario.gaa_rate or 0) or 0))
    scenario.fee_rate = Decimal(str(data.get("fee_rate", scenario.fee_rate or 0) or 0))
    scenario.total_labor_cost = Decimal(str(total_labor_cost))
    scenario.direct_costs = Decimal(str(direct_costs))
    scenario.indirect_costs = Decimal(str(overhead_cost + gaa_cost))
    scenario.total_cost = Decimal(str(total_cost))
    scenario.total_price = Decimal(str(total_price))
    scenario.competitive_position = data.get("competitive_position", scenario.competitive_position)
    
    await db.commit()
    await db.refresh(scenario)
    
    return {
        "id": scenario.id,
        "name": scenario.name,
        "opportunity_id": scenario.opportunity_id,
        "scenario_type": scenario.scenario_type,
        "description": scenario.description,
        "labor_categories": scenario.labor_categories or [],
        "overhead_rate": float(scenario.overhead_rate or 0),
        "gaa_rate": float(scenario.gaa_rate or 0),
        "fee_rate": float(scenario.fee_rate or 0),
        "total_labor_cost": float(scenario.total_labor_cost or 0),
        "direct_costs": float(scenario.direct_costs or 0),
        "indirect_costs": float(scenario.indirect_costs or 0),
        "total_cost": float(scenario.total_cost or 0),
        "total_price": float(scenario.total_price or 0),
        "competitive_position": scenario.competitive_position,
        "created_at": scenario.created_at.isoformat() if scenario.created_at else None,
    }


@router.get("/opportunities/{opportunity_id}/scenarios")
async def get_scenarios(
    opportunity_id: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get PTW scenarios for a specific opportunity"""
    scenarios = await compare_scenarios(db, opportunity_id, tenant.id)
    return {"scenarios": scenarios}
