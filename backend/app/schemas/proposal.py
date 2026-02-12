"""Proposal schemas"""
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime
from app.models.proposal import VolumeType, VolumeStatus, StructureSource


class RFPReference(BaseModel):
    """RFP reference information"""
    section_number: Optional[str] = None
    page_range: Optional[str] = None
    clause_text_snippet: Optional[str] = None


class ProposalVolumeBase(BaseModel):
    """Base schema for proposal volume"""
    name: str  # Custom name (exact label from RFP or user)
    volume_type: Optional[VolumeType] = None  # Optional helper classification
    status: Optional[VolumeStatus] = VolumeStatus.DRAFT
    source: Optional[StructureSource] = StructureSource.USER
    order_index: Optional[int] = 0
    rfp_reference: Optional[RFPReference] = None
    description: Optional[str] = None
    content: Optional[str] = None
    compliance_notes: Optional[str] = None
    page_count: Optional[str] = None
    word_count: Optional[int] = None
    owner_id: Optional[str] = None
    page_limit: Optional[str] = None
    rfp_sections: Optional[List[str]] = None  # Legacy field
    executive_summary: Optional[str] = None
    technical_approach: Optional[str] = None


class ProposalVolumeCreate(ProposalVolumeBase):
    """Schema for creating a proposal volume"""
    pass


class ProposalVolumeUpdate(BaseModel):
    """Schema for updating a proposal volume"""
    name: Optional[str] = None
    volume_type: Optional[VolumeType] = None
    status: Optional[VolumeStatus] = None
    source: Optional[StructureSource] = None
    order_index: Optional[int] = None
    rfp_reference: Optional[RFPReference] = None
    description: Optional[str] = None
    content: Optional[str] = None
    compliance_notes: Optional[str] = None
    page_count: Optional[str] = None
    word_count: Optional[int] = None
    owner_id: Optional[str] = None
    page_limit: Optional[str] = None
    rfp_sections: Optional[List[str]] = None
    executive_summary: Optional[str] = None
    technical_approach: Optional[str] = None


class ProposalVolumeRead(ProposalVolumeBase):
    """Schema for reading a proposal volume"""
    id: str
    proposal_id: str
    tenant_id: str
    source: StructureSource
    order_index: int
    rfp_reference: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    sections: Optional[List['ProposalSectionRead']] = []
    
    class Config:
        from_attributes = True


class ProposalVolumeWithOwner(ProposalVolumeRead):
    """Schema for proposal volume with owner details"""
    owner: Optional[dict] = None  # Will be populated with user info if needed


class ProposalBase(BaseModel):
    """Base schema for proposal"""
    name: str
    opportunity_id: str
    version: Optional[str] = "1.0"
    executive_summary: Optional[str] = None
    technical_approach: Optional[str] = None
    management_approach: Optional[str] = None
    past_performance: Optional[str] = None
    win_themes: Optional[List[str]] = None
    status: Optional[str] = "draft"


class ProposalCreate(ProposalBase):
    """Schema for creating a proposal"""
    volumes: Optional[List[ProposalVolumeCreate]] = None


class ProposalUpdate(BaseModel):
    """Schema for updating a proposal"""
    name: Optional[str] = None
    version: Optional[str] = None
    executive_summary: Optional[str] = None
    technical_approach: Optional[str] = None
    management_approach: Optional[str] = None
    past_performance: Optional[str] = None
    win_themes: Optional[List[str]] = None
    status: Optional[str] = None


class ProposalSectionBase(BaseModel):
    """Base schema for proposal section"""
    heading: str
    order_index: Optional[int] = 0
    source: Optional[StructureSource] = StructureSource.USER
    rfp_reference: Optional[RFPReference] = None
    parent_section_id: Optional[str] = None
    content: Optional[str] = None


class ProposalSectionCreate(ProposalSectionBase):
    """Schema for creating a proposal section"""
    pass


class ProposalSectionUpdate(BaseModel):
    """Schema for updating a proposal section"""
    heading: Optional[str] = None
    order_index: Optional[int] = None
    source: Optional[StructureSource] = None
    rfp_reference: Optional[RFPReference] = None
    parent_section_id: Optional[str] = None
    content: Optional[str] = None


class ProposalSectionRead(ProposalSectionBase):
    """Schema for reading a proposal section"""
    id: str
    volume_id: str
    source: StructureSource
    order_index: int
    rfp_reference: Optional[Dict[str, Any]] = None
    created_at: datetime
    updated_at: datetime
    children: Optional[List['ProposalSectionRead']] = []
    
    class Config:
        from_attributes = True


class ProposalRead(ProposalBase):
    """Schema for reading a proposal"""
    id: str
    tenant_id: str
    current_phase: str
    compliance_matrix: Optional[dict] = None
    submission_date: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime
    volumes: Optional[List[ProposalVolumeRead]] = []
    
    class Config:
        from_attributes = True



