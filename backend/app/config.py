"""Configuration management for PipelinePro"""
from pydantic_settings import BaseSettings
from pydantic import field_validator, model_validator
from typing import Optional
import json


class Settings(BaseSettings):
    """Application settings"""
    
    # Application
    APP_NAME: str = "PipelinePro"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pipelinepro"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20
    
    # Security
    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    
    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3000", "http://localhost:5173"]
    CORS_ALLOW_CREDENTIALS: bool = True
    CORS_ALLOW_METHODS: list[str] = ["*"]
    CORS_ALLOW_HEADERS: list[str] = ["*"]
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"
    REDIS_CACHE_TTL: int = 3600
    
    # File Storage
    UPLOAD_DIR: str = "./uploads"
    MAX_UPLOAD_SIZE: int = 50 * 1024 * 1024  # 50MB
    
    # OpenAI
    OPENAI_API_KEY: Optional[str] = None
    OPENAI_MODEL: str = "gpt-5-mini"  # Default GPT-5 model (cost-optimized)
    
    # SSO
    AZURE_AD_CLIENT_ID: Optional[str] = None
    AZURE_AD_CLIENT_SECRET: Optional[str] = None
    AZURE_AD_TENANT_ID: Optional[str] = None
    OKTA_CLIENT_ID: Optional[str] = None
    OKTA_CLIENT_SECRET: Optional[str] = None
    OKTA_DOMAIN: Optional[str] = None
    GOOGLE_CLIENT_ID: Optional[str] = None
    GOOGLE_CLIENT_SECRET: Optional[str] = None
    
    # SAM.gov
    SAM_GOV_API_KEY: Optional[str] = None
    
    # Microsoft Graph
    MS_GRAPH_CLIENT_ID: Optional[str] = None
    MS_GRAPH_CLIENT_SECRET: Optional[str] = None
    MS_GRAPH_TENANT_ID: Optional[str] = None
    
    # Rate Limiting
    RATE_LIMIT_ENABLED: bool = True
    RATE_LIMIT_PER_MINUTE: int = 60
    
    # Audit
    AUDIT_LOG_RETENTION_DAYS: int = 2555  # 7 years

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, value):
        if isinstance(value, list):
            return [str(item).strip() for item in value if str(item).strip()]
        if isinstance(value, str):
            raw = value.strip()
            if not raw:
                return []
            if raw.startswith("["):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        return [str(item).strip() for item in parsed if str(item).strip()]
                except json.JSONDecodeError:
                    pass
            return [item.strip() for item in raw.split(",") if item.strip()]
        return ["http://localhost:3000", "http://localhost:5173"]

    @model_validator(mode="after")
    def _validate_production_cors(self):
        env = (self.ENVIRONMENT or "").strip().lower()
        is_non_dev = env not in {"", "dev", "development", "local", "test", "testing"}
        if is_non_dev and any(origin.strip() == "*" for origin in self.CORS_ORIGINS):
            raise ValueError(
                "CORS wildcard '*' is not allowed outside development/test environments"
            )
        return self
    
    class Config:
        env_file = ".env"
        case_sensitive = True


settings = Settings()
