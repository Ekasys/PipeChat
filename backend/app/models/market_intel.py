"""Market Intelligence model"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Numeric, Boolean, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class MarketIntel(Base):
    """Market Intelligence record"""
    __tablename__ = "market_intel"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Basic info
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    stage = Column(String(50), nullable=False, default="rumor")  # rumor, confirmed, rfi, qualified
    source = Column(String(255), nullable=True)
    
    # Opportunity details
    agency = Column(String(255), nullable=True)
    estimated_value = Column(Numeric(15, 2), nullable=True)
    expected_rfp_date = Column(DateTime, nullable=True)
    naics_codes = Column(JSON, nullable=True)
    contract_vehicle = Column(String(255), nullable=True)
    place_of_performance = Column(String(500), nullable=True)
    contract_type = Column(String(100), nullable=True)  # FFP, T&M, Cost-Plus, etc.
    period_of_performance = Column(String(255), nullable=True)
    
    # Intelligence
    competitor_info = Column(JSON, nullable=True)  # Array of competitor details
    market_notes = Column(Text, nullable=True)
    similarity_score = Column(Numeric(5, 2), nullable=True)  # For AI similarity matching
    
    # SAM.gov integration
    sam_gov_id = Column(String(255), nullable=True, unique=True)
    sam_gov_data = Column(JSON, nullable=True)  # Full SAM.gov response
    sam_gov_url = Column(String(500), nullable=True)  # Direct link to SAM.gov listing
    
    # Attachments (fetched from SAM.gov)
    attachments = Column(JSON, nullable=True)  # [{name, url, local_path, size, type, fetched_at}]
    attachments_fetched = Column(Boolean, default=False)
    
    # Background processing status
    processing_status = Column(String(20), default="idle")  # idle, processing, completed, error
    processing_error = Column(Text, nullable=True)
    
    # Compliance Matrix (stored as JSON, linked via relationship too)
    compliance_summary = Column(JSON, nullable=True)  # {total, compliant, partial, non_compliant, score}
    
    # Bid/No-Bid Decision
    bid_decision = Column(String(20), nullable=True)  # bid, no-bid, pending
    bid_decision_date = Column(DateTime, nullable=True)
    bid_decision_rationale = Column(Text, nullable=True)
    bid_score = Column(Numeric(5, 2), nullable=True)  # 0-100 score
    bid_criteria_scores = Column(JSON, nullable=True)  # Individual criteria scores
    
    # Conversion tracking
    converted_to_opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True)
    converted_at = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    compliance_requirements = relationship("ComplianceRequirement", back_populates="market_intel", cascade="all, delete-orphan", lazy="dynamic")
    # Use string reference and lazy loading to avoid circular import issues
    converted_opportunity = relationship("Opportunity", foreign_keys=[converted_to_opportunity_id], lazy="select")
    
    def __repr__(self):
        return f"<MarketIntel(id={self.id}, title={self.title}, stage={self.stage})>"


class ComplianceRequirement(Base):
    """Individual requirement for compliance matrix"""
    __tablename__ = "compliance_requirements"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    market_intel_id = Column(String, ForeignKey("market_intel.id"), nullable=False, index=True)
    
    # Requirement details
    requirement_number = Column(String(50), nullable=True)  # e.g., "3.1.2", "L-1"
    section = Column(String(255), nullable=True)  # Section of RFP (e.g., "Section L", "PWS 3.1")
    requirement_text = Column(Text, nullable=False)
    requirement_type = Column(String(50), nullable=True)  # mandatory, optional, evaluation
    
    # Compliance assessment
    compliance_status = Column(String(20), default="pending")  # compliant, partial, non_compliant, not_applicable, pending
    compliance_notes = Column(Text, nullable=True)
    gap_description = Column(Text, nullable=True)  # What's missing if not compliant
    mitigation_plan = Column(Text, nullable=True)  # How to address the gap
    
    # Evidence/Response
    response_approach = Column(Text, nullable=True)  # How we'll address this requirement
    evidence_references = Column(JSON, nullable=True)  # Links to past performance, certifications, etc.
    
    # Scoring (for evaluation criteria)
    weight = Column(Numeric(5, 2), nullable=True)  # Importance weight
    confidence_score = Column(Numeric(5, 2), nullable=True)  # 0-100 confidence we can meet it
    
    # Source tracking
    source_document = Column(String(255), nullable=True)  # Which attachment this came from
    page_reference = Column(String(50), nullable=True)  # Page number in source doc
    extracted_by_ai = Column(Boolean, default=False)  # Was this auto-extracted?
    
    # Order for display
    sort_order = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    market_intel = relationship("MarketIntel", back_populates="compliance_requirements")
    
    def __repr__(self):
        return f"<ComplianceRequirement(id={self.id}, status={self.compliance_status})>"


class BidNoBidCriteria(Base):
    """Bid/No-Bid evaluation criteria template"""
    __tablename__ = "bid_nobid_criteria"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    # Criteria definition
    name = Column(String(255), nullable=False)  # e.g., "Strategic Alignment", "Technical Capability"
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=True)  # strategic, technical, financial, risk
    
    # Scoring
    weight = Column(Numeric(5, 2), default=1.0)  # Weight in overall score
    max_score = Column(Integer, default=10)  # Maximum score for this criterion
    
    # Thresholds
    minimum_threshold = Column(Integer, nullable=True)  # Min score to proceed
    
    # Guidance
    scoring_guidance = Column(JSON, nullable=True)  # {1: "Poor", 5: "Average", 10: "Excellent"}
    evaluation_questions = Column(JSON, nullable=True)  # Questions to consider when scoring
    
    # Template settings
    is_default = Column(Boolean, default=False)  # Include in new evaluations by default
    sort_order = Column(Integer, default=0)
    is_active = Column(Boolean, default=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    
    def __repr__(self):
        return f"<BidNoBidCriteria(id={self.id}, name={self.name})>"


class CompetitorProfile(Base):
    """Competitor profile"""
    __tablename__ = "competitor_profiles"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    win_rate = Column(Numeric(5, 2), nullable=True)  # Historical win rate
    pricing_history = Column(JSON, nullable=True)  # Array of past pricing data
    contract_vehicles = Column(JSON, nullable=True)  # Array of vehicles
    strengths = Column(JSON, nullable=True)
    weaknesses = Column(JSON, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    
    def __repr__(self):
        return f"<CompetitorProfile(id={self.id}, name={self.name})>"

