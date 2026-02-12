"""Administration endpoints"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, Dict, Any
from datetime import datetime
from app.database import get_db
from app.dependencies import get_current_user_dependency, get_current_tenant, require_role
from app.models.user import User
from app.models.tenant import Tenant
from app.services.admin_service import (
    get_tenant_settings,
    update_tenant_settings,
    create_user,
    list_users,
    deactivate_user,
    get_audit_logs,
    get_compliance_report,
    cleanup_old_data,
)

router = APIRouter()


# AI Provider endpoints
@router.get("/ai-providers")
async def list_ai_providers(
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List all AI providers for the tenant"""
    from app.models.ai_provider import AIProvider
    from sqlalchemy import select
    
    result = await db.execute(
        select(AIProvider).where(AIProvider.tenant_id == tenant.id)
    )
    providers = result.scalars().all()

    def sanitize_connection_config(config: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        if not config:
            return {}
        safe_config = dict(config)
        for key in (
            "api_key",
            "client_secret",
            "access_token",
            "refresh_token",
            "secret",
            "token",
        ):
            if key in safe_config:
                safe_config[key] = "******"
        return safe_config

    return {"providers": [{
        "id": p.id,
        "provider_name": p.provider_name,
        "display_name": p.display_name,
        "is_active": p.is_active,
        "is_default": p.is_default,
        "connection_config": sanitize_connection_config(p.connection_config),
        "created_at": p.created_at.isoformat() if p.created_at else None,
        "updated_at": p.updated_at.isoformat() if p.updated_at else None,
    } for p in providers]}


@router.post("/ai-providers")
async def create_ai_provider(
    data: dict,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a new AI provider configuration"""
    from app.models.ai_provider import AIProvider
    from sqlalchemy import select
    
    # If this is set as default, unset other defaults
    if data.get("is_default", False):
        result = await db.execute(
            select(AIProvider).where(
                AIProvider.tenant_id == tenant.id,
                AIProvider.is_default == True
            )
        )
        existing_defaults = result.scalars().all()
        for provider in existing_defaults:
            provider.is_default = False
    
    provider = AIProvider(
        tenant_id=tenant.id,
        provider_name=data["provider_name"],
        display_name=data["display_name"],
        is_active=data.get("is_active", True),
        is_default=data.get("is_default", False),
        connection_config=data.get("connection_config", {}),
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    
    return {
        "id": provider.id,
        "provider_name": provider.provider_name,
        "display_name": provider.display_name,
        "is_active": provider.is_active,
        "is_default": provider.is_default,
        "connection_config": provider.connection_config,
        "created_at": provider.created_at.isoformat() if provider.created_at else None,
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
    }


@router.put("/ai-providers/{provider_id}")
async def update_ai_provider(
    provider_id: str,
    data: dict,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update an AI provider configuration"""
    from app.models.ai_provider import AIProvider
    from sqlalchemy import select
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(AIProvider).where(
            AIProvider.id == provider_id,
            AIProvider.tenant_id == tenant.id
        )
    )
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI Provider not found")
    
    # If setting as default, unset other defaults
    if data.get("is_default", False) and not provider.is_default:
        result = await db.execute(
            select(AIProvider).where(
                AIProvider.tenant_id == tenant.id,
                AIProvider.is_default == True,
                AIProvider.id != provider_id
            )
        )
        existing_defaults = result.scalars().all()
        for p in existing_defaults:
            p.is_default = False
    
    # Update fields
    if "provider_name" in data:
        provider.provider_name = data["provider_name"]
    if "display_name" in data:
        provider.display_name = data["display_name"]
    if "is_active" in data:
        provider.is_active = data["is_active"]
    if "is_default" in data:
        provider.is_default = data["is_default"]
    if "connection_config" in data:
        provider.connection_config = data["connection_config"]
    
    await db.commit()
    await db.refresh(provider)
    
    return {
        "id": provider.id,
        "provider_name": provider.provider_name,
        "display_name": provider.display_name,
        "is_active": provider.is_active,
        "is_default": provider.is_default,
        "connection_config": provider.connection_config,
        "created_at": provider.created_at.isoformat() if provider.created_at else None,
        "updated_at": provider.updated_at.isoformat() if provider.updated_at else None,
    }


@router.delete("/ai-providers/{provider_id}")
async def delete_ai_provider(
    provider_id: str,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Delete an AI provider configuration"""
    from app.models.ai_provider import AIProvider
    from sqlalchemy import select
    from fastapi import HTTPException, status
    
    result = await db.execute(
        select(AIProvider).where(
            AIProvider.id == provider_id,
            AIProvider.tenant_id == tenant.id
        )
    )
    provider = result.scalar_one_or_none()
    
    if not provider:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="AI Provider not found")
    
    await db.delete(provider)
    await db.commit()
    
    return {"message": "AI Provider deleted successfully"}


@router.get("/settings")
async def get_settings(
    user: User = Depends(get_current_user_dependency),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get tenant settings"""
    settings = await get_tenant_settings(db, tenant.id)
    return settings


@router.put("/settings")
async def update_settings(
    settings_data: dict,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update tenant settings"""
    tenant = await update_tenant_settings(db, tenant.id, settings_data)
    return tenant


def _serialize_user(user: User) -> dict:
    return {
        "id": user.id,
        "email": user.email,
        "username": user.username,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "role": user.role,
        "is_active": user.is_active,
        "last_login": user.last_login.isoformat() if user.last_login else None,
        "created_at": user.created_at.isoformat() if user.created_at else None,
    }


@router.post("/users")
async def create_usr(
    data: dict,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user"""
    new_user, temp_password = await create_user(db, tenant.id, data)
    return {
        "user": _serialize_user(new_user),
        "temp_password": temp_password,
    }


@router.get("/users")
async def list_usr(
    q: Optional[str] = Query(None, description="Search query"),
    role: Optional[str] = Query(None, description="Filter by role"),
    is_active: Optional[bool] = Query(None, description="Filter by active status"),
    sort_by: str = Query("created_at", description="Sort field"),
    sort_order: str = Query("desc", description="Sort order (asc/desc)"),
    skip: int = Query(0, ge=0, description="Skip records"),
    limit: int = Query(100, ge=1, le=1000, description="Limit records"),
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """List all users with filtering, sorting, and pagination"""
    users, total = await list_users(
        db,
        tenant.id,
        search=q,
        role=role,
        is_active=is_active,
        sort_by=sort_by,
        sort_order=sort_order,
        skip=skip,
        limit=limit,
    )
    return {
        "users": [{
            "id": u.id,
            "email": u.email,
            "username": u.username,
            "first_name": u.first_name,
            "last_name": u.last_name,
            "role": u.role,
            "is_active": u.is_active,
            "last_login": u.last_login.isoformat() if u.last_login else None,
            "created_at": u.created_at.isoformat() if u.created_at else None,
        } for u in users],
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.put("/users/{user_id}")
async def update_usr(
    user_id: str,
    data: dict,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Update a user"""
    from app.services.admin_service import update_user
    updated = await update_user(db, user_id, tenant.id, data)
    if not updated:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return updated


@router.post("/users/{user_id}/reset-password")
async def reset_usr_password(
    user_id: str,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Reset a user's password and return a temporary password"""
    from app.services.admin_service import reset_user_password
    temp_password = await reset_user_password(db, user_id, tenant.id)
    if not temp_password:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"temp_password": temp_password}


@router.delete("/users/{user_id}")
async def deactivate_usr(
    user_id: str,
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Deactivate a user"""
    deactivated = await deactivate_user(db, user_id, tenant.id)
    if not deactivated:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return deactivated


@router.get("/audit-logs")
async def get_logs(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    user_id: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Get audit logs with filtering and pagination"""
    logs, total = await get_audit_logs(
        db, tenant.id, start_date, end_date, user_id, action, resource_type, skip, limit
    )
    return {
        "logs": logs,
        "total": total,
        "skip": skip,
        "limit": limit,
    }


@router.get("/compliance-report")
async def get_report(
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Generate compliance report"""
    report = await get_compliance_report(db, tenant.id)
    return report


@router.post("/cleanup")
async def cleanup(
    user: User = Depends(require_role("admin")),
    tenant: Tenant = Depends(get_current_tenant),
    db: AsyncSession = Depends(get_db),
):
    """Clean up old data"""
    result = await cleanup_old_data(db, tenant.id)
    return result
