"""Document model"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Document(Base):
    """Document model for file storage"""
    __tablename__ = "documents"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True, index=True)
    proposal_id = Column(String, ForeignKey("proposals.id"), nullable=True, index=True)
    proposal_volume_id = Column(String, ForeignKey("proposal_volumes.id"), nullable=True, index=True)
    
    # File info
    filename = Column(String(500), nullable=False)
    original_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)  # Storage path
    file_size = Column(Integer, nullable=True)  # Size in bytes
    mime_type = Column(String(255), nullable=True)
    file_hash = Column(String(64), nullable=True)  # SHA-256 hash for integrity
    
    # Document metadata
    document_type = Column(String(100), nullable=True)  # rfp, amendment, proposal, resume, etc.
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    version = Column(String(50), nullable=True)
    
    # RFP-specific (if applicable)
    rfp_sections = Column(Text, nullable=True)  # Parsed sections (L, M, C)
    requirements = Column(Text, nullable=True)  # Extracted requirements
    
    # Timestamps
    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    opportunity = relationship("Opportunity", back_populates="documents")
    proposal = relationship("Proposal", back_populates="documents")
    proposal_volume = relationship("ProposalVolume", back_populates="documents")
    
    def __repr__(self):
        return f"<Document(id={self.id}, filename={self.filename}, type={self.document_type})>"

