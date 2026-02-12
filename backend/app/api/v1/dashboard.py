"""Dashboard endpoints"""
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from datetime import datetime

from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant
from app.services.dashboard_service import (
    get_pipeline_metrics,
    get_funnel_data,
    get_win_loss_trends,
    get_drill_down_data,
    get_forecast,
)
from app.utils.export import export_to_pdf, export_to_excel, export_to_powerpoint

router = APIRouter()


@router.get("/metrics")
async def get_metrics(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get dashboard metrics"""
    metrics = await get_pipeline_metrics(
        db=db,
        tenant_id=tenant.id,
        start_date=start_date,
        end_date=end_date,
    )
    return metrics


@router.get("/funnel")
async def get_funnel(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get funnel data by stage"""
    funnel = await get_funnel_data(db=db, tenant_id=tenant.id)
    return {"funnel": funnel}


@router.get("/trends")
async def get_trends(
    months: int = Query(12, ge=1, le=24),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get win/loss trends"""
    trends = await get_win_loss_trends(db=db, tenant_id=tenant.id, months=months)
    return {"trends": trends}


@router.get("/drill-down")
async def drill_down(
    group_by: str = Query(..., regex="^(agency|naics|vehicle|owner)$"),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get drill-down data"""
    data = await get_drill_down_data(db=db, tenant_id=tenant.id, group_by=group_by)
    return {"data": data}


@router.get("/forecast")
async def get_forecast_data(
    months: int = Query(12, ge=1, le=24),
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get forecast data"""
    forecast = await get_forecast(db=db, tenant_id=tenant.id, months=months)
    return forecast


@router.get("/export/pdf")
async def export_pdf(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Export dashboard as PDF"""
    metrics = await get_pipeline_metrics(db=db, tenant_id=tenant.id)
    pdf_buffer = await export_to_pdf(metrics, template="dashboard")
    
    return StreamingResponse(
        pdf_buffer,
        media_type="application/pdf",
        headers={"Content-Disposition": "attachment; filename=dashboard.pdf"},
    )


@router.get("/export/excel")
async def export_excel(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Export dashboard as Excel"""
    funnel = await get_funnel_data(db=db, tenant_id=tenant.id)
    excel_buffer = await export_to_excel(funnel, filename="dashboard")
    
    return StreamingResponse(
        excel_buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=dashboard.xlsx"},
    )


@router.get("/export/powerpoint")
async def export_powerpoint(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Export dashboard as PowerPoint"""
    metrics = await get_pipeline_metrics(db=db, tenant_id=tenant.id)
    metrics["generated_at"] = datetime.utcnow().isoformat()
    ppt_buffer = await export_to_powerpoint(metrics, template="dashboard")
    
    return StreamingResponse(
        ppt_buffer,
        media_type="application/vnd.openxmlformats-officedocument.presentationml.presentation",
        headers={"Content-Disposition": "attachment; filename=dashboard.pptx"},
    )
