"""Audit logging for compliance"""
from datetime import datetime
from typing import Optional, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import insert
from app.models.audit_log import AuditLog
from app.config import settings


async def log_audit_event(
    db: AsyncSession,
    tenant_id: str,
    user_id: str,
    action: str,
    resource_type: str,
    resource_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
) -> None:
    """Log an audit event"""
    audit_entry = AuditLog(
        tenant_id=tenant_id,
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        details=details or {},
        ip_address=ip_address,
        user_agent=user_agent,
        created_at=datetime.utcnow(),
    )
    
    db.add(audit_entry)
    await db.commit()


async def export_audit_logs(
    db: AsyncSession,
    tenant_id: str,
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    user_id: Optional[str] = None,
    action: Optional[str] = None,
) -> list[AuditLog]:
    """Export audit logs for compliance reporting"""
    from sqlalchemy import select, and_
    
    conditions = [AuditLog.tenant_id == tenant_id]
    
    if start_date:
        conditions.append(AuditLog.created_at >= start_date)
    if end_date:
        conditions.append(AuditLog.created_at <= end_date)
    if user_id:
        conditions.append(AuditLog.user_id == user_id)
    if action:
        conditions.append(AuditLog.action == action)
    
    result = await db.execute(
        select(AuditLog).where(and_(*conditions)).order_by(AuditLog.created_at.desc())
    )
    return list(result.scalars().all())


async def cleanup_old_audit_logs(db: AsyncSession) -> int:
    """Clean up audit logs older than retention period"""
    from sqlalchemy import delete
    from datetime import timedelta
    
    cutoff_date = datetime.utcnow() - timedelta(days=settings.AUDIT_LOG_RETENTION_DAYS)
    
    result = await db.execute(
        delete(AuditLog).where(AuditLog.created_at < cutoff_date)
    )
    await db.commit()
    return result.rowcount


