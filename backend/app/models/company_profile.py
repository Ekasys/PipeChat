"""Company Profile model for proposal generation"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Integer
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class CompanyProfile(Base):
    """Company profile for proposal generation"""
    __tablename__ = "company_profiles"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True, unique=True)
    
    # Basic Company Information
    company_name = Column(String(255), nullable=False)
    legal_name = Column(String(255), nullable=True)
    duns_number = Column(String(50), nullable=True)
    cage_code = Column(String(10), nullable=True)
    uei = Column(String(50), nullable=True)  # Unique Entity Identifier
    website = Column(String(500), nullable=True)
    email = Column(String(255), nullable=True)
    phone = Column(String(50), nullable=True)
    address = Column(Text, nullable=True)
    city = Column(String(100), nullable=True)
    state = Column(String(50), nullable=True)
    zip_code = Column(String(20), nullable=True)
    country = Column(String(100), default="United States", nullable=False)
    
    # Company Description
    mission_statement = Column(Text, nullable=True)
    vision_statement = Column(Text, nullable=True)
    company_overview = Column(Text, nullable=True)
    core_values = Column(JSON, nullable=True)  # Array of core values
    differentiators = Column(JSON, nullable=True)  # Array of key differentiators
    
    # Business Information
    business_type = Column(String(100), nullable=True)  # Small Business, 8(a), WOSB, etc.
    size_standard = Column(String(50), nullable=True)  # Small, Large
    naics_codes = Column(JSON, nullable=True)  # Array of NAICS codes
    sic_codes = Column(JSON, nullable=True)  # Array of SIC codes
    contract_vehicles = Column(JSON, nullable=True)  # Array of contract vehicles (GSA, OASIS, etc.)
    
    # Certifications & Compliance
    certifications = Column(JSON, nullable=True)  # Array of certifications (ISO 9001, CMMC, etc.)
    security_clearances = Column(JSON, nullable=True)  # Array of clearance levels
    compliance_frameworks = Column(JSON, nullable=True)  # FedRAMP, NIST 800-53, etc.
    
    # Capabilities & Expertise
    core_capabilities = Column(JSON, nullable=True)  # Array of capability areas
    technical_expertise = Column(JSON, nullable=True)  # Array of technical skills
    service_offerings = Column(JSON, nullable=True)  # Array of service offerings
    industry_experience = Column(JSON, nullable=True)  # Array of industries served
    
    # Past Performance
    past_performance_highlights = Column(JSON, nullable=True)  # Array of past performance records
    key_contracts = Column(JSON, nullable=True)  # Array of key contracts
    awards_recognition = Column(JSON, nullable=True)  # Array of awards
    
    # Key Personnel
    key_personnel = Column(JSON, nullable=True)  # Array of key personnel with roles
    executive_team = Column(JSON, nullable=True)  # Array of executives
    
    # Proposal Content
    standard_boilerplate = Column(JSON, nullable=True)  # Standard proposal language by section
    win_themes = Column(JSON, nullable=True)  # Common win themes
    proposal_templates = Column(JSON, nullable=True)  # Template content
    
    # Financial Information (optional, for certain proposals)
    annual_revenue = Column(String(100), nullable=True)
    number_of_employees = Column(String(50), nullable=True)
    years_in_business = Column(Integer, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant", back_populates="company_profile")
    
    def __repr__(self):
        return f"<CompanyProfile(id={self.id}, company_name={self.company_name})>"

