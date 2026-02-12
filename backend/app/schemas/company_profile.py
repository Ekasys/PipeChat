"""Company Profile schemas"""
from typing import Optional, List, Dict, Any
from pydantic import BaseModel, Field
from datetime import datetime


class CompanyProfileBase(BaseModel):
    """Base company profile schema"""
    company_name: str = Field(..., description="Company name")
    legal_name: Optional[str] = None
    duns_number: Optional[str] = None
    cage_code: Optional[str] = None
    uei: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: str = "United States"
    
    # Company Description
    mission_statement: Optional[str] = None
    vision_statement: Optional[str] = None
    company_overview: Optional[str] = None
    core_values: Optional[List[str]] = None
    differentiators: Optional[List[str]] = None
    
    # Business Information
    business_type: Optional[str] = None
    size_standard: Optional[str] = None
    naics_codes: Optional[List[str]] = None
    sic_codes: Optional[List[str]] = None
    contract_vehicles: Optional[List[str]] = None
    
    # Certifications & Compliance
    certifications: Optional[List[str]] = None
    security_clearances: Optional[List[str]] = None
    compliance_frameworks: Optional[List[str]] = None
    
    # Capabilities & Expertise
    core_capabilities: Optional[List[str]] = None
    technical_expertise: Optional[List[str]] = None
    service_offerings: Optional[List[str]] = None
    industry_experience: Optional[List[str]] = None
    
    # Past Performance
    past_performance_highlights: Optional[List[Dict[str, Any]]] = None
    key_contracts: Optional[List[Dict[str, Any]]] = None
    awards_recognition: Optional[List[Dict[str, Any]]] = None
    
    # Key Personnel
    key_personnel: Optional[List[Dict[str, Any]]] = None
    executive_team: Optional[List[Dict[str, Any]]] = None
    
    # Proposal Content
    standard_boilerplate: Optional[Dict[str, str]] = None
    win_themes: Optional[List[str]] = None
    proposal_templates: Optional[Dict[str, Any]] = None
    
    # Financial Information
    annual_revenue: Optional[str] = None
    number_of_employees: Optional[str] = None
    years_in_business: Optional[int] = None


class CompanyProfileCreate(CompanyProfileBase):
    """Schema for creating company profile"""
    pass


class CompanyProfileUpdate(BaseModel):
    """Schema for updating company profile"""
    company_name: Optional[str] = None
    legal_name: Optional[str] = None
    duns_number: Optional[str] = None
    cage_code: Optional[str] = None
    uei: Optional[str] = None
    website: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None
    mission_statement: Optional[str] = None
    vision_statement: Optional[str] = None
    company_overview: Optional[str] = None
    core_values: Optional[List[str]] = None
    differentiators: Optional[List[str]] = None
    business_type: Optional[str] = None
    size_standard: Optional[str] = None
    naics_codes: Optional[List[str]] = None
    sic_codes: Optional[List[str]] = None
    contract_vehicles: Optional[List[str]] = None
    certifications: Optional[List[str]] = None
    security_clearances: Optional[List[str]] = None
    compliance_frameworks: Optional[List[str]] = None
    core_capabilities: Optional[List[str]] = None
    technical_expertise: Optional[List[str]] = None
    service_offerings: Optional[List[str]] = None
    industry_experience: Optional[List[str]] = None
    past_performance_highlights: Optional[List[Dict[str, Any]]] = None
    key_contracts: Optional[List[Dict[str, Any]]] = None
    awards_recognition: Optional[List[Dict[str, Any]]] = None
    key_personnel: Optional[List[Dict[str, Any]]] = None
    executive_team: Optional[List[Dict[str, Any]]] = None
    standard_boilerplate: Optional[Dict[str, str]] = None
    win_themes: Optional[List[str]] = None
    proposal_templates: Optional[Dict[str, Any]] = None
    annual_revenue: Optional[str] = None
    number_of_employees: Optional[str] = None
    years_in_business: Optional[int] = None


class CompanyProfileResponse(CompanyProfileBase):
    """Schema for company profile response"""
    id: str
    tenant_id: str
    created_at: datetime
    updated_at: datetime
    
    class Config:
        from_attributes = True

