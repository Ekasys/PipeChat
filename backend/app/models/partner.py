"""Partner/Teaming models"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Partner(Base):
    """Teaming partner"""
    __tablename__ = "partners"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Basic info
    name = Column(String(255), nullable=False)
    company_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    website = Column(String(500), nullable=True)
    contact_email = Column(String(255), nullable=True)
    contact_phone = Column(String(50), nullable=True)
    
    # Capabilities
    capabilities = Column(JSON, nullable=True)  # Array of capability areas
    naics_codes = Column(JSON, nullable=True)
    contract_vehicles = Column(JSON, nullable=True)  # Array of vehicles they hold
    
    # Past performance
    past_performance = Column(JSON, nullable=True)  # Array of past performance records
    win_rate = Column(Numeric(5, 2), nullable=True)
    total_contract_value = Column(Numeric(15, 2), nullable=True)
    
    # Scoring
    fit_score = Column(Numeric(5, 2), nullable=True)  # Overall fit score
    scoring_factors = Column(JSON, nullable=True)  # Breakdown of scoring
    
    # Status
    status = Column(String(50), default="active", nullable=False)  # active, inactive, pending
    onboarding_status = Column(String(50), nullable=True)  # not_started, in_progress, completed
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    
    def __repr__(self):
        return f"<Partner(id={self.id}, name={self.name})>"

