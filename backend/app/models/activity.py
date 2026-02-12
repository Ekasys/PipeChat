"""Activity/Timeline model"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Activity(Base):
    """Activity/Timeline entry"""
    __tablename__ = "activities"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    opportunity_id = Column(String, ForeignKey("opportunities.id"), nullable=True, index=True)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True, index=True)
    contact_id = Column(String, ForeignKey("contacts.id"), nullable=True, index=True)
    
    # Activity details
    activity_type = Column(String(100), nullable=False)  # email, call, meeting, note, document, etc.
    subject = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    
    # Metadata
    activity_metadata = Column(JSON, nullable=True)  # Additional context (email thread, call duration, etc.)
    
    # Timestamps
    activity_date = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    user = relationship("User", back_populates="activities")
    opportunity = relationship("Opportunity", back_populates="activities")
    account = relationship("Account")
    contact = relationship("Contact")
    
    def __repr__(self):
        return f"<Activity(id={self.id}, type={self.activity_type}, date={self.activity_date})>"

