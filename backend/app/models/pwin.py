"""PWin Calculator models"""
from sqlalchemy import Column, String, Numeric, DateTime, ForeignKey, JSON, Text
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class PWinScore(Base):
    """PWin (Probability to Win) score"""
    __tablename__ = "pwin_scores"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True, index=True)
    
    # Scoring components (0-100 scale)
    customer_score = Column(Numeric(5, 2), nullable=True)
    technical_score = Column(Numeric(5, 2), nullable=True)
    performance_score = Column(Numeric(5, 2), nullable=True)
    price_score = Column(Numeric(5, 2), nullable=True)
    
    # Weights (0-1, should sum to 1.0)
    customer_weight = Column(Numeric(3, 2), default=0.25, nullable=False)
    technical_weight = Column(Numeric(3, 2), default=0.30, nullable=False)
    performance_weight = Column(Numeric(3, 2), default=0.25, nullable=False)
    price_weight = Column(Numeric(3, 2), default=0.20, nullable=False)
    
    # Calculated PWin
    calculated_pwin = Column(Numeric(5, 2), nullable=True)  # Weighted average
    
    # AI adjustments
    ai_adjustment = Column(Numeric(5, 2), nullable=True)  # AI-predicted adjustment
    ai_reasoning = Column(Text, nullable=True)
    similar_pursuits = Column(JSON, nullable=True)  # Array of similar opportunity IDs
    
    # Notes
    notes = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    opportunity = relationship("Opportunity", back_populates="pwin_scores")
    
    def __repr__(self):
        return f"<PWinScore(id={self.id}, calculated_pwin={self.calculated_pwin})>"

