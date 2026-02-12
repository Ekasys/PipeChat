"""Opportunity model"""
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, Text, JSON, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Opportunity(Base):
    """Opportunity model"""
    __tablename__ = "opportunities"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True, index=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    
    # Basic info
    name = Column(String(500), nullable=False)
    agency = Column(String(255), nullable=True)
    sub_agency = Column(String(255), nullable=True)
    stage = Column(String(100), nullable=False, default="qualification")  # qualification, pursuit, proposal, etc.
    bd_status = Column(String(100), nullable=True)
    value = Column(Numeric(15, 2), nullable=True)
    pwin = Column(Numeric(5, 2), nullable=True)  # Probability to win (0-100)
    ptw = Column(Numeric(15, 2), nullable=True)  # Price-to-Win
    due_date = Column(DateTime, nullable=True)
    rfp_submission_date = Column(DateTime, nullable=True)
    award_date = Column(DateTime, nullable=True)
    
    # Classification
    naics_code = Column(String(50), nullable=True)
    contract_vehicle = Column(String(255), nullable=True)
    opportunity_type = Column(String(100), nullable=True)  # New, Recompete, Follow-on
    
    # Details
    description = Column(Text, nullable=True)
    summary = Column(Text, nullable=True)
    requirements = Column(Text, nullable=True)
    history_notes = Column(Text, nullable=True)
    next_task_comments = Column(Text, nullable=True)
    next_task_due = Column(DateTime, nullable=True)
    capture_manager = Column(String(255), nullable=True)
    agency_pocs = Column(Text, nullable=True)
    business_sectors = Column(Text, nullable=True)
    role = Column(String(50), nullable=True)
    number_of_years = Column(Integer, nullable=True)
    win_themes = Column(JSON, nullable=True)  # Array of win themes
    risks = Column(JSON, nullable=True)  # Array of risks
    
    # Status
    status = Column(String(50), default="active", nullable=False)  # active, won, lost, withdrawn
    probability = Column(Integer, nullable=True)  # 0-100
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="opportunities")
    account = relationship("Account", back_populates="opportunities")
    owner = relationship("User")
    proposals = relationship("Proposal", back_populates="opportunity", cascade="all, delete-orphan")
    contacts = relationship("OpportunityContact", back_populates="opportunity", cascade="all, delete-orphan")
    activities = relationship("Activity", back_populates="opportunity", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="opportunity", cascade="all, delete-orphan")
    ptw_models = relationship("PTWModel", back_populates="opportunity", cascade="all, delete-orphan")
    pwin_scores = relationship("PWinScore", back_populates="opportunity", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Opportunity(id={self.id}, name={self.name}, stage={self.stage})>"


class OpportunityContact(Base):
    """Many-to-many relationship between opportunities and contacts with role"""
    __tablename__ = "opportunity_contacts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=False, index=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False)  # Champion, Blocker, Neutral, Influencer
    
    # Relationships
    opportunity = relationship("Opportunity", back_populates="contacts")
    contact = relationship("Contact", back_populates="opportunity_contacts")

