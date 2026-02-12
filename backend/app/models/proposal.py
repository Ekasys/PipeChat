"""Proposal models"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON, Integer, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid
import enum


class ProposalPhase(str, enum.Enum):
    """Proposal phases (Shipley workflow)"""
    PINK_TEAM = "pink_team"
    RED_TEAM = "red_team"
    GOLD_TEAM = "gold_team"
    SUBMITTED = "submitted"
    WON = "won"
    LOST = "lost"


class Proposal(Base):
    """Proposal model"""
    __tablename__ = "proposals"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=False, index=True)
    
    # Basic info
    name = Column(String(500), nullable=False)
    version = Column(String(50), default="1.0", nullable=False)
    current_phase = Column(SQLEnum(ProposalPhase), default=ProposalPhase.PINK_TEAM, nullable=False)
    
    # Content
    executive_summary = Column(Text, nullable=True)
    technical_approach = Column(Text, nullable=True)
    management_approach = Column(Text, nullable=True)
    past_performance = Column(Text, nullable=True)
    win_themes = Column(JSON, nullable=True)  # Array of win themes
    compliance_matrix = Column(JSON, nullable=True)  # Compliance matrix data
    
    # Status
    status = Column(String(50), default="draft", nullable=False)  # draft, in_review, approved, submitted
    submission_date = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    opportunity = relationship("Opportunity", back_populates="proposals")
    phases = relationship("ProposalPhaseRecord", back_populates="proposal", cascade="all, delete-orphan")
    tasks = relationship("ProposalTask", back_populates="proposal", cascade="all, delete-orphan")
    comments = relationship("ProposalComment", back_populates="proposal", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="proposal", cascade="all, delete-orphan")
    volumes = relationship("ProposalVolume", back_populates="proposal", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Proposal(id={self.id}, name={self.name}, phase={self.current_phase})>"


class ProposalPhaseRecord(Base):
    """Proposal phase tracking (Shipley workflow)"""
    __tablename__ = "proposal_phases"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String, ForeignKey("proposals.id"), nullable=False, index=True)
    
    phase = Column(SQLEnum(ProposalPhase), nullable=False)
    status = Column(String(50), default="not_started", nullable=False)  # not_started, in_progress, completed
    start_date = Column(DateTime, nullable=True)
    end_date = Column(DateTime, nullable=True)
    artifacts = Column(JSON, nullable=True)  # Array of artifact references
    outputs = Column(JSON, nullable=True)  # Array of outputs
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    proposal = relationship("Proposal", back_populates="phases")
    
    def __repr__(self):
        return f"<ProposalPhaseRecord(id={self.id}, phase={self.phase}, status={self.status})>"


class ProposalTask(Base):
    """Proposal task assignments"""
    __tablename__ = "proposal_tasks"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String, ForeignKey("proposals.id"), nullable=False, index=True)
    assigned_to_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    
    title = Column(String(500), nullable=False)
    description = Column(Text, nullable=True)
    status = Column(String(50), default="pending", nullable=False)  # pending, in_progress, completed
    priority = Column(String(20), default="medium", nullable=False)  # low, medium, high
    due_date = Column(DateTime, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    
    # Relationships
    proposal = relationship("Proposal", back_populates="tasks")
    assigned_to = relationship("User")
    
    def __repr__(self):
        return f"<ProposalTask(id={self.id}, title={self.title}, status={self.status})>"


class ProposalComment(Base):
    """Proposal comments for collaboration"""
    __tablename__ = "proposal_comments"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String, ForeignKey("proposals.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    parent_comment_id = Column(String, ForeignKey("proposal_comments.id"), nullable=True)
    
    content = Column(Text, nullable=False)
    section = Column(String(255), nullable=True)  # Section of proposal being commented on
    resolved = Column(String(10), default="false", nullable=False)  # false, true
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    proposal = relationship("Proposal", back_populates="comments")
    user = relationship("User")
    parent = relationship("ProposalComment", remote_side=[id], backref="replies")
    
    def __repr__(self):
        return f"<ProposalComment(id={self.id}, user_id={self.user_id})>"


class VolumeType(str, enum.Enum):
    """Proposal volume types"""
    TECHNICAL = "technical"
    MANAGEMENT = "management"
    PAST_PERFORMANCE = "past_performance"
    PRICING = "pricing"
    EXECUTIVE_SUMMARY = "executive_summary"
    OTHER = "other"


class VolumeStatus(str, enum.Enum):
    """Proposal volume status"""
    DRAFT = "draft"
    IN_REVIEW = "in_review"
    APPROVED = "approved"
    FINAL = "final"
    LOCKED = "locked"


class StructureSource(str, enum.Enum):
    """Source of proposal structure"""
    RFP = "rfp"
    USER = "user"
    TEMPLATE = "template"


class ProposalVolume(Base):
    """Proposal volume model - multiple volumes per proposal"""
    __tablename__ = "proposal_volumes"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    proposal_id = Column(String, ForeignKey("proposals.id"), nullable=False, index=True)
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    owner_id = Column(String, ForeignKey("users.id"), nullable=True, index=True)
    
    # Basic info - data-driven (name kept for backward compatibility, represents custom_name)
    name = Column(String(500), nullable=False)  # Exact label from RFP or user (custom_name)
    volume_type = Column(SQLEnum(VolumeType), nullable=True)  # Optional helper classification
    status = Column(SQLEnum(VolumeStatus), default=VolumeStatus.DRAFT, nullable=False)
    
    # Structure source tracking
    source = Column(SQLEnum(StructureSource), default=StructureSource.USER, nullable=False)
    order_index = Column(Integer, nullable=False, default=0)  # Order within proposal
    
    # RFP reference (for source="rfp")
    rfp_reference = Column(JSON, nullable=True)  # {sectionNumber, pageRange, clauseTextSnippet}
    
    # Content
    description = Column(Text, nullable=True)
    content = Column(Text, nullable=True)  # Main content/text
    compliance_notes = Column(Text, nullable=True)  # Compliance-related notes
    
    # Metadata
    page_count = Column(String(50), nullable=True)
    word_count = Column(Integer, nullable=True)
    page_limit = Column(String(50), nullable=True)
    rfp_sections = Column(JSON, nullable=True)  # Legacy field, kept for backward compatibility
    executive_summary = Column(Text, nullable=True)
    technical_approach = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    proposal = relationship("Proposal", back_populates="volumes")
    tenant = relationship("Tenant")
    owner = relationship("User")
    documents = relationship("Document", back_populates="proposal_volume", cascade="all, delete-orphan")
    sections = relationship("ProposalSection", back_populates="volume", cascade="all, delete-orphan", order_by="ProposalSection.order_index")
    
    def __repr__(self):
        return f"<ProposalVolume(id={self.id}, name={self.name}, source={self.source}, status={self.status})>"


class ProposalSection(Base):
    """Proposal section model - sections within a volume"""
    __tablename__ = "proposal_sections"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    volume_id = Column(String, ForeignKey("proposal_volumes.id"), nullable=False, index=True)
    
    # Basic info
    heading = Column(String(500), nullable=False)  # Exact heading from RFP or user
    order_index = Column(Integer, nullable=False, default=0)  # Order within volume
    
    # Structure source tracking
    source = Column(SQLEnum(StructureSource), default=StructureSource.USER, nullable=False)
    
    # RFP reference (for source="rfp")
    rfp_reference = Column(JSON, nullable=True)  # {sectionNumber, pageRange}
    
    # Nesting support
    parent_section_id = Column(String, ForeignKey("proposal_sections.id"), nullable=True, index=True)
    
    # Content
    content = Column(Text, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    volume = relationship("ProposalVolume", back_populates="sections")
    parent = relationship("ProposalSection", remote_side=[id], backref="children")
    
    def __repr__(self):
        return f"<ProposalSection(id={self.id}, heading={self.heading}, source={self.source}, order_index={self.order_index})>"
