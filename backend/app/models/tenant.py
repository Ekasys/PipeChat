"""Tenant model for multi-tenancy"""
from sqlalchemy import Column, String, Boolean, DateTime, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Tenant(Base):
    """Tenant model for multi-tenant isolation"""
    __tablename__ = "tenants"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False, unique=True)
    subdomain = Column(String(100), unique=True, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    settings = Column(Text, nullable=True)  # JSON string for tenant-specific settings
    
    # Compliance settings
    data_residency = Column(String(50), default="US", nullable=False)
    compliance_level = Column(String(50), default="FedRAMP Moderate", nullable=False)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    users = relationship("User", back_populates="tenant", cascade="all, delete-orphan")
    accounts = relationship("Account", back_populates="tenant", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="tenant", cascade="all, delete-orphan")
    company_profile = relationship("CompanyProfile", back_populates="tenant", uselist=False, cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Tenant(id={self.id}, name={self.name})>"


