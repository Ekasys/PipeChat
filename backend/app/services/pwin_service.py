"""PWin Calculator service"""
from typing import List, Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from decimal import Decimal

from app.models.pwin import PWinScore


async def calculate_pwin(
    customer_score: float,
    technical_score: float,
    performance_score: float,
    price_score: float,
    customer_weight: float = 0.25,
    technical_weight: float = 0.30,
    performance_weight: float = 0.25,
    price_weight: float = 0.20,
) -> float:
    """Calculate weighted PWin score"""
    # Normalize weights to sum to 1.0
    total_weight = customer_weight + technical_weight + performance_weight + price_weight
    if total_weight > 0:
        customer_weight /= total_weight
        technical_weight /= total_weight
        performance_weight /= total_weight
        price_weight /= total_weight
    
    pwin = (
        customer_score * customer_weight +
        technical_score * technical_weight +
        performance_score * performance_weight +
        price_score * price_weight
    )
    
    return round(pwin, 2)


async def create_pwin_score(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> PWinScore:
    """Create a PWin score"""
    # Calculate PWin
    calculated_pwin = await calculate_pwin(
        customer_score=float(data.get("customer_score", 0)),
        technical_score=float(data.get("technical_score", 0)),
        performance_score=float(data.get("performance_score", 0)),
        price_score=float(data.get("price_score", 0)),
        customer_weight=float(data.get("customer_weight", 0.25)),
        technical_weight=float(data.get("technical_weight", 0.30)),
        performance_weight=float(data.get("performance_weight", 0.25)),
        price_weight=float(data.get("price_weight", 0.20)),
    )
    
    pwin = PWinScore(
        tenant_id=tenant_id,
        opportunity_id=data.get("opportunity_id"),
        customer_score=Decimal(str(data.get("customer_score", 0))),
        technical_score=Decimal(str(data.get("technical_score", 0))),
        performance_score=Decimal(str(data.get("performance_score", 0))),
        price_score=Decimal(str(data.get("price_score", 0))),
        customer_weight=Decimal(str(data.get("customer_weight", 0.25))),
        technical_weight=Decimal(str(data.get("technical_weight", 0.30))),
        performance_weight=Decimal(str(data.get("performance_weight", 0.25))),
        price_weight=Decimal(str(data.get("price_weight", 0.20))),
        calculated_pwin=Decimal(str(calculated_pwin)),
        ai_adjustment=data.get("ai_adjustment"),
        ai_reasoning=data.get("ai_reasoning"),
        similar_pursuits=data.get("similar_pursuits"),
        notes=data.get("notes"),
    )
    
    db.add(pwin)
    await db.commit()
    await db.refresh(pwin)
    return pwin


async def get_pwin_history(
    db: AsyncSession,
    opportunity_id: str,
    tenant_id: str,
) -> List[PWinScore]:
    """Get PWin score history for an opportunity"""
    result = await db.execute(
        select(PWinScore).where(
            and_(
                PWinScore.opportunity_id == opportunity_id,
                PWinScore.tenant_id == tenant_id,
            )
        ).order_by(PWinScore.created_at.desc())
    )
    return list(result.scalars().all())

