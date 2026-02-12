"""Dashboard service for metrics and analytics"""
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
from decimal import Decimal

from app.models.opportunity import Opportunity
from app.models.proposal import Proposal
from app.models.account import Account
from app.models.activity import Activity


async def get_pipeline_metrics(
    db: AsyncSession,
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
) -> Dict[str, Any]:
    """Calculate pipeline metrics"""
    # Base query for tenant
    base_query = select(Opportunity).where(Opportunity.tenant_id == tenant_id)
    
    # Active opportunities
    active_query = base_query.where(Opportunity.status == "active")
    result = await db.execute(active_query)
    active_opps = result.scalars().all()
    
    # Calculate pipeline value (sum of opportunity values)
    pipeline_value = sum(
        float(opp.value or 0) for opp in active_opps if opp.value
    )
    
    # Count active opportunities
    active_count = len(active_opps)
    
    # Calculate win rate (won / (won + lost))
    won_query = base_query.where(Opportunity.status == "won")
    lost_query = base_query.where(Opportunity.status == "lost")
    
    won_result = await db.execute(won_query)
    lost_result = await db.execute(lost_query)
    won_count = len(won_result.scalars().all())
    lost_count = len(lost_result.scalars().all())
    
    win_rate = 0.0
    if won_count + lost_count > 0:
        win_rate = (won_count / (won_count + lost_count)) * 100
    
    # Upcoming deadlines (next 30 days)
    deadline_cutoff = datetime.utcnow() + timedelta(days=30)
    upcoming_query = base_query.where(
        and_(
            Opportunity.due_date.isnot(None),
            Opportunity.due_date <= deadline_cutoff,
            Opportunity.due_date >= datetime.utcnow(),
        )
    )
    upcoming_result = await db.execute(upcoming_query)
    upcoming_count = len(upcoming_result.scalars().all())
    
    # Probability-weighted pipeline value
    weighted_value = sum(
        float(opp.value or 0) * (float(opp.pwin or 0) / 100)
        for opp in active_opps
        if opp.value and opp.pwin
    )
    
    # Proposal metrics
    proposal_query = select(Proposal).where(Proposal.tenant_id == tenant_id)
    proposal_result = await db.execute(proposal_query)
    all_proposals = proposal_result.scalars().all()
    
    # Active proposals (not won/lost)
    active_proposals = [
        p for p in all_proposals 
        if p.current_phase not in ["won", "lost"]
    ]
    active_proposals_count = len(active_proposals)
    
    # Proposals by phase
    proposals_by_phase = {}
    for phase in ["pink_team", "red_team", "gold_team", "submitted", "won", "lost"]:
        proposals_by_phase[phase] = len([
            p for p in all_proposals if p.current_phase == phase
        ])
    
    return {
        "pipeline_value": pipeline_value,
        "weighted_pipeline_value": weighted_value,
        "active_opportunities": active_count,
        "win_rate": round(win_rate, 2),
        "upcoming_deadlines": upcoming_count,
        "won_count": won_count,
        "lost_count": lost_count,
        "active_proposals": active_proposals_count,
        "proposals_by_phase": proposals_by_phase,
    }


async def get_funnel_data(
    db: AsyncSession,
    tenant_id: str,
) -> List[Dict[str, Any]]:
    """Get funnel data by stage"""
    stages = ["qualification", "pursuit", "proposal", "negotiation", "won", "lost"]
    
    funnel_data = []
    for stage in stages:
        query = select(func.count(Opportunity.id)).where(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.stage == stage,
            )
        )
        result = await db.execute(query)
        count = result.scalar() or 0
        
        # Calculate value for this stage
        value_query = select(func.sum(Opportunity.value)).where(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.stage == stage,
            )
        )
        value_result = await db.execute(value_query)
        value = float(value_result.scalar() or 0)
        
        funnel_data.append({
            "stage": stage,
            "count": count,
            "value": value,
        })
    
    return funnel_data


async def get_win_loss_trends(
    db: AsyncSession,
    tenant_id: str,
    months: int = 12,
) -> List[Dict[str, Any]]:
    """Get win/loss trends over time"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=months * 30)
    
    # Group by month
    trends = []
    current_date = start_date
    
    while current_date <= end_date:
        month_start = current_date.replace(day=1)
        if current_date.month == 12:
            month_end = current_date.replace(year=current_date.year + 1, month=1, day=1) - timedelta(days=1)
        else:
            month_end = current_date.replace(month=current_date.month + 1, day=1) - timedelta(days=1)
        
        # Won opportunities
        won_query = select(func.count(Opportunity.id)).where(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.status == "won",
                Opportunity.updated_at >= month_start,
                Opportunity.updated_at <= month_end,
            )
        )
        won_result = await db.execute(won_query)
        won_count = won_result.scalar() or 0
        
        # Lost opportunities
        lost_query = select(func.count(Opportunity.id)).where(
            and_(
                Opportunity.tenant_id == tenant_id,
                Opportunity.status == "lost",
                Opportunity.updated_at >= month_start,
                Opportunity.updated_at <= month_end,
            )
        )
        lost_result = await db.execute(lost_query)
        lost_count = lost_result.scalar() or 0
        
        trends.append({
            "month": month_start.strftime("%Y-%m"),
            "won": won_count,
            "lost": lost_count,
        })
        
        # Move to next month
        if current_date.month == 12:
            current_date = current_date.replace(year=current_date.year + 1, month=1)
        else:
            current_date = current_date.replace(month=current_date.month + 1)
    
    return trends


async def get_drill_down_data(
    db: AsyncSession,
    tenant_id: str,
    group_by: str,  # agency, naics, vehicle, owner
) -> List[Dict[str, Any]]:
    """Get drill-down data grouped by specified field"""
    query = select(Opportunity).where(Opportunity.tenant_id == tenant_id)
    result = await db.execute(query)
    opportunities = result.scalars().all()
    
    grouped_data = {}
    
    for opp in opportunities:
        if group_by == "agency":
            key = opp.agency or "Unknown"
        elif group_by == "naics":
            key = opp.naics_code or "Unknown"
        elif group_by == "vehicle":
            key = opp.contract_vehicle or "Unknown"
        elif group_by == "owner":
            key = opp.owner_id or "Unassigned"
        else:
            key = "Unknown"
        
        if key not in grouped_data:
            grouped_data[key] = {
                "name": key,
                "count": 0,
                "value": 0.0,
                "weighted_value": 0.0,
            }
        
        grouped_data[key]["count"] += 1
        if opp.value:
            grouped_data[key]["value"] += float(opp.value)
            if opp.pwin:
                grouped_data[key]["weighted_value"] += float(opp.value) * (float(opp.pwin) / 100)
    
    return list(grouped_data.values())


async def get_forecast(
    db: AsyncSession,
    tenant_id: str,
    months: int = 12,
) -> Dict[str, Any]:
    """Generate forecast with probability-weighted values"""
    end_date = datetime.utcnow() + timedelta(days=months * 30)
    
    query = select(Opportunity).where(
        and_(
            Opportunity.tenant_id == tenant_id,
            Opportunity.status == "active",
            Opportunity.due_date.isnot(None),
            Opportunity.due_date <= end_date,
        )
    )
    result = await db.execute(query)
    opportunities = result.scalars().all()
    
    forecast_by_month = {}
    
    for opp in opportunities:
        if opp.due_date:
            month_key = opp.due_date.strftime("%Y-%m")
            if month_key not in forecast_by_month:
                forecast_by_month[month_key] = {
                    "month": month_key,
                    "opportunities": [],
                    "total_value": 0.0,
                    "weighted_value": 0.0,
                }
            
            forecast_by_month[month_key]["opportunities"].append({
                "id": opp.id,
                "name": opp.name,
                "value": float(opp.value or 0),
                "pwin": float(opp.pwin or 0),
            })
            
            if opp.value:
                forecast_by_month[month_key]["total_value"] += float(opp.value)
                if opp.pwin:
                    forecast_by_month[month_key]["weighted_value"] += float(opp.value) * (float(opp.pwin) / 100)
    
    return {
        "forecast_months": list(forecast_by_month.values()),
        "total_forecast_value": sum(m["total_value"] for m in forecast_by_month.values()),
        "weighted_forecast_value": sum(m["weighted_value"] for m in forecast_by_month.values()),
    }

