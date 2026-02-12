"""Price-to-Win models"""
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class PTWModel(Base):
    """Price-to-Win model/scenario"""
    __tablename__ = "ptw_models"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True, index=True)
    
    # Basic info
    name = Column(String(255), nullable=False)
    scenario_type = Column(String(100), nullable=True)  # base, aggressive, conservative
    description = Column(Text, nullable=True)
    
    # Labor costs
    labor_categories = Column(JSON, nullable=True)  # Array of {category, rate, hours, total}
    total_labor_cost = Column(Numeric(15, 2), nullable=True)
    
    # Indirect rates
    overhead_rate = Column(Numeric(5, 2), nullable=True)  # Percentage
    gaa_rate = Column(Numeric(5, 2), nullable=True)  # G&A percentage
    fee_rate = Column(Numeric(5, 2), nullable=True)  # Fee percentage
    
    # Totals
    direct_costs = Column(Numeric(15, 2), nullable=True)
    indirect_costs = Column(Numeric(15, 2), nullable=True)
    total_cost = Column(Numeric(15, 2), nullable=True)
    total_price = Column(Numeric(15, 2), nullable=True)
    
    # Competitive analysis
    competitive_position = Column(String(100), nullable=True)  # low, medium, high
    igce_prediction = Column(Numeric(15, 2), nullable=True)  # AI-predicted IGCE
    recommendations = Column(JSON, nullable=True)  # Array of recommendations
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    opportunity = relationship("Opportunity", back_populates="ptw_models")
    
    def __repr__(self):
        return f"<PTWModel(id={self.id}, name={self.name}, total_price={self.total_price})>"

