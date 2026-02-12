"""Audit log model for compliance"""
from sqlalchemy import Column, String, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class AuditLog(Base):
    """Audit log for compliance tracking"""
    __tablename__ = "audit_logs"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    
    # Action details
    action = Column(String(100), nullable=False, index=True)  # create, read, update, delete, login, etc.
    resource_type = Column(String(100), nullable=False, index=True)  # user, opportunity, proposal, etc.
    resource_id = Column(String, nullable=True, index=True)
    details = Column(JSON, nullable=True)  # Additional context
    
    # Request metadata
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(Text, nullable=True)
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    
    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User", back_populates="audit_logs")
    
    def __repr__(self):
        return f"<AuditLog(id={self.id}, action={self.action}, resource_type={self.resource_type})>"


