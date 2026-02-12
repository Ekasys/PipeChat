"""Administration service"""
from typing import List, Optional, Dict, Any, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, delete
from datetime import datetime, timedelta
import secrets
import string

from app.models.tenant import Tenant
from app.models.user import User
from app.models.audit_log import AuditLog
from app.core.security import hash_password
from app.core.compliance import generate_compliance_report
from app.config import settings


async def get_tenant_settings(
    db: AsyncSession,
    tenant_id: str,
) -> Optional[Dict[str, Any]]:
    """Get tenant settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        return None
    
    import json
    settings_data = json.loads(tenant.settings) if tenant.settings else {}
    
    return {
        "tenant_id": tenant.id,
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "data_residency": tenant.data_residency,
        "compliance_level": tenant.compliance_level,
        "settings": settings_data,
    }


async def update_tenant_settings(
    db: AsyncSession,
    tenant_id: str,
    settings_data: Dict[str, Any],
) -> Optional[Tenant]:
    """Update tenant settings"""
    result = await db.execute(
        select(Tenant).where(Tenant.id == tenant_id)
    )
    tenant = result.scalar_one_or_none()
    
    if not tenant:
        return None
    
    import json
    # Split known tenant fields from arbitrary settings payload
    data = dict(settings_data or {})
    if "data_residency" in data:
        tenant.data_residency = data.pop("data_residency")
    if "compliance_level" in data:
        tenant.compliance_level = data.pop("compliance_level")
    if "name" in data:
        tenant.name = data.pop("name")
    if "subdomain" in data:
        tenant.subdomain = data.pop("subdomain")

    tenant.settings = json.dumps(data)
    tenant.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(tenant)
    return tenant


def _generate_temp_password(length: int = 12) -> str:
    alphabet = string.ascii_letters + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(length))


async def create_user(
    db: AsyncSession,
    tenant_id: str,
    data: Dict[str, Any],
) -> Tuple[User, Optional[str]]:
    """Create a new user; return temp password if generated"""
    raw_password = data.get("password")
    temp_password = None
    if not raw_password:
        temp_password = _generate_temp_password()
        raw_password = temp_password

    user = User(
        tenant_id=tenant_id,
        email=data["email"],
        username=data["username"],
        hashed_password=hash_password(raw_password),
        first_name=data.get("first_name"),
        last_name=data.get("last_name"),
        role=data.get("role", "analyst"),
        is_active=data.get("is_active", True),
    )
    
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user, temp_password


async def list_users(
    db: AsyncSession,
    tenant_id: str,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort_by: str = 'created_at',
    sort_order: str = 'desc',
    skip: int = 0,
    limit: int = 100,
) -> tuple[List[User], int]:
    """List users for a tenant with filtering, sorting, and pagination"""
    from sqlalchemy import or_, func
    
    query = select(User).where(User.tenant_id == tenant_id)
    
    # Apply search filter
    if search:
        search_filter = or_(
            User.email.ilike(f'%{search}%'),
            User.username.ilike(f'%{search}%'),
            User.first_name.ilike(f'%{search}%'),
            User.last_name.ilike(f'%{search}%'),
        )
        query = query.where(search_filter)
    
    # Apply role filter
    if role:
        query = query.where(User.role == role)
    
    # Apply status filter
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    
    # Get total count before pagination
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply sorting
    if sort_by == 'email':
        order_col = User.email
    elif sort_by == 'username':
        order_col = User.username
    elif sort_by == 'role':
        order_col = User.role
    elif sort_by == 'last_login':
        order_col = User.last_login
    else:
        order_col = User.created_at
    
    if sort_order == 'asc':
        query = query.order_by(order_col.asc())
    else:
        query = query.order_by(order_col.desc())
    
    # Apply pagination
    query = query.offset(skip).limit(limit)
    
    result = await db.execute(query)
    users = list(result.scalars().all())
    
    return users, total


async def update_user(
    db: AsyncSession,
    user_id: str,
    tenant_id: str,
    data: Dict[str, Any],
) -> Optional[User]:
    """Update a user"""
    result = await db.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.tenant_id == tenant_id,
            )
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    # Update fields
    if "email" in data:
        user.email = data["email"]
    if "username" in data:
        user.username = data["username"]
    if "first_name" in data:
        user.first_name = data.get("first_name")
    if "last_name" in data:
        user.last_name = data.get("last_name")
    if "role" in data:
        user.role = data["role"]
    if "is_active" in data:
        user.is_active = data["is_active"]
    if "password" in data:
        user.hashed_password = hash_password(data["password"])
    
    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    return user


async def reset_user_password(
    db: AsyncSession,
    user_id: str,
    tenant_id: str,
) -> Optional[str]:
    """Reset a user's password and return the temporary password"""
    result = await db.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.tenant_id == tenant_id,
            )
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        return None

    temp_password = _generate_temp_password()
    user.hashed_password = hash_password(temp_password)
    user.updated_at = datetime.utcnow()
    await db.commit()
    await db.refresh(user)
    return temp_password


async def deactivate_user(
    db: AsyncSession,
    user_id: str,
    tenant_id: str,
) -> Optional[User]:
    """Deactivate a user"""
    result = await db.execute(
        select(User).where(
            and_(
                User.id == user_id,
                User.tenant_id == tenant_id,
            )
        )
    )
    user = result.scalar_one_or_none()
    
    if not user:
        return None
    
    user.is_active = False
    await db.commit()
    await db.refresh(user)
    return user


async def get_audit_logs(
    db: AsyncSession,
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
    resource_type: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> tuple[List[Dict[str, Any]], int]:
    """Get audit logs with filtering, including user information"""
    from sqlalchemy import select, and_, func, or_
    from app.models.audit_log import AuditLog
    
    query = select(AuditLog, User).join(User, AuditLog.user_id == User.id).where(
        AuditLog.tenant_id == tenant_id
    )
    
    conditions = [AuditLog.tenant_id == tenant_id]
    
    if start_date:
        conditions.append(AuditLog.created_at >= start_date)
    if end_date:
        conditions.append(AuditLog.created_at <= end_date)
    if user_id:
        conditions.append(AuditLog.user_id == user_id)
    if action:
        conditions.append(AuditLog.action == action)
    if resource_type:
        conditions.append(AuditLog.resource_type == resource_type)
    
    query = query.where(and_(*conditions))
    
    # Get total count
    count_query = select(func.count()).select_from(
        select(AuditLog).where(and_(*conditions)).subquery()
    )
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0
    
    # Apply sorting and pagination
    query = query.order_by(AuditLog.created_at.desc()).offset(skip).limit(limit)
    
    result = await db.execute(query)
    rows = result.all()
    
    logs = []
    for log, user in rows:
        logs.append({
            "id": log.id,
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "created_at": log.created_at.isoformat() if log.created_at else None,
            "user_id": log.user_id,
            "user_email": user.email if user else None,
            "user_name": f"{user.first_name or ''} {user.last_name or ''}".strip() if user else None,
            "user_username": user.username if user else None,
            "ip_address": log.ip_address,
            "details": log.details,
        })
    
    return logs, total


async def get_compliance_report(
    db: AsyncSession,
    tenant_id: str,
) -> Dict[str, Any]:
    """Generate compliance report"""
    report = generate_compliance_report()
    report["tenant_id"] = tenant_id
    report["generated_at"] = datetime.utcnow().isoformat()
    return report


async def cleanup_old_data(
    db: AsyncSession,
    tenant_id: str,
) -> Dict[str, int]:
    """Clean up old data based on retention policies"""
    from app.core.audit import cleanup_old_audit_logs
    
    cutoff_date = datetime.utcnow() - timedelta(days=settings.AUDIT_LOG_RETENTION_DAYS)
    
    # Clean up audit logs
    audit_logs_deleted = await cleanup_old_audit_logs(db)
    
    return {
        "audit_logs_deleted": audit_logs_deleted,
        "cutoff_date": cutoff_date.isoformat(),
    }

