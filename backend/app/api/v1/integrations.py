"""Integration endpoints"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant
from app.models.user import User
from app.models.tenant import Tenant

router = APIRouter()


@router.get("/integrations")
async def list_integrations(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
):
    """List available integrations"""
    return {
        "integrations": [
            {"name": "Deltek", "status": "stub", "enabled": False},
            {"name": "Unanet", "status": "stub", "enabled": False},
            {"name": "QuickBooks", "status": "stub", "enabled": False},
            {"name": "Microsoft 365", "status": "stub", "enabled": False},
            {"name": "Teams/Slack", "status": "stub", "enabled": False},
            {"name": "SharePoint/OneDrive", "status": "stub", "enabled": False},
        ]
    }


@router.post("/integrations/{integration_name}/connect")
async def connect_integration(
    integration_name: str,
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
):
    """Connect an integration (stub)"""
    return {
        "message": f"Integration {integration_name} connection not yet implemented",
        "status": "stub",
    }
