"""AI Provider model."""
from datetime import datetime
import uuid

from sqlalchemy import JSON, Boolean, Column, DateTime, ForeignKey, String
from sqlalchemy.orm import relationship

from app.database import Base


class AIProvider(Base):
    """AI Provider configuration model."""

    __tablename__ = "ai_providers"

    id = Column(String, primary_key=True, default=lambda: str(uuid.uuid4()))
    tenant_id = Column(String, ForeignKey("tenants.id"), nullable=False, index=True)

    # Provider info
    provider_name = Column(
        String(100),
        nullable=False,
    )  # azure-openai, chatgpt, gemini, grok, ollama, ollama-cloud
    display_name = Column(String(200), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_default = Column(Boolean, default=False, nullable=False)

    # Connection info (stored as JSON for flexibility)
    # Azure OpenAI example:
    # {
    #   "api_key": "...",
    #   "azure_endpoint": "https://<resource>.openai.azure.com",
    #   "api_version": "2024-06-01",
    #   "chat_deployment": "balanced-mid",
    #   "embedding_deployment": "embedding-small",
    #   "auth_mode": "api-key",
    #   "default_model": "balanced-mid",
    #   "temperature": 0.3,
    #   "max_tokens": 1200
    # }
    connection_config = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    tenant = relationship("Tenant")

    def __repr__(self):
        return f"<AIProvider(id={self.id}, provider={self.provider_name}, active={self.is_active})>"
