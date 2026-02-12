"""Account model for CRM"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Account(Base):
    """Account model (agencies/organizations)"""
    __tablename__ = "accounts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    agency = Column(String(255), nullable=True)
    organization_type = Column(String(100), nullable=True)
    account_type = Column(String(50), nullable=True)  # 'customer' or 'teaming_partner'
    naics_codes = Column(JSON, nullable=True)
    contract_vehicles = Column(JSON, nullable=True)
    website = Column(String(500), nullable=True)
    address = Column(Text, nullable=True)
    phone = Column(String(50), nullable=True)
    relationship_health_score = Column(String(20), nullable=True)
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    tenant = relationship("Tenant")
    contacts = relationship("Contact", back_populates="account", cascade="all, delete-orphan")
    opportunities = relationship("Opportunity", back_populates="account", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="account", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Account(id={self.id}, name={self.name})>"