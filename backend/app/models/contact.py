"""Contact model for CRM"""
from sqlalchemy import Column, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.orm import relationship
from datetime import datetime
from app.database import Base
import uuid


class Contact(Base):
    """Contact model"""
    __tablename__ = "contacts"
    
    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)
    account_id = Column(String, ForeignKey("accounts.id"), nullable=True, index=True)
    
    # Basic info
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    title = Column(String(200), nullable=True)
    department = Column(String(200), nullable=True)
    
    # Influence and relationship
    influence_level = Column(String(50), nullable=True)  # Champion, Blocker, Neutral, Influencer
    relationship_strength = Column(String(50), nullable=True)  # Strong, Moderate, Weak
    notes = Column(Text, nullable=True)
    
    # Org chart
    manager_id = Column(String, ForeignKey("contacts.id"), nullable=True)
    direct_reports = relationship("Contact", remote_side=[id], backref="manager")
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    tenant = relationship("Tenant")
    account = relationship("Account", back_populates="contacts")
    opportunity_contacts = relationship("OpportunityContact", back_populates="contact", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<Contact(id={self.id}, name={self.first_name} {self.last_name})>"

