"""Configuration for Ekchat API service."""
from pydantic_settings import BaseSettings
from pydantic import field_validator
from typing import Optional
import json


class Settings(BaseSettings):
    APP_NAME: str = "Ekchat API"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/pipelinepro"
    DATABASE_POOL_SIZE: int = 10
    DATABASE_MAX_OVERFLOW: int = 20

    SECRET_KEY: str = "change-this-secret-key-in-production"
    ALGORITHM: str = "HS256"

    CORS_ORIGINS: list[str] = ["http://localhost:5173"]

    EKCHAT_SCHEMA: str = "ekchat"
    EKCHAT_DEFAULT_MODEL: str = "balanced-mid"
    EKCHAT_LIGHT_TASK_MODEL: str = "cost-mini"
    EKCHAT_CHAT_MAX_TOKENS: int = 1200
    EKCHAT_MAX_CONTEXT_MESSAGES: int = 24
    EKCHAT_WEBSEARCH_MAX_RESULTS: int = 5
    EKCHAT_WEBSEARCH_TIMEOUT_SECONDS: int = 20
    OLLAMA_URL: str = "http://host.docker.internal:11434"
    OLLAMA_DEFAULT_MODEL: str = "llama3.1:8b"
    OLLAMA_EMBED_MODEL: str = "nomic-embed-text"
    OLLAMA_TIMEOUT_SECONDS: int = 120

    AZURE_STORAGE_CONNECTION_STRING: Optional[str] = None
    EKCHAT_BLOB_CONTAINER: str = "ekchat"
    LOCAL_STORAGE_ROOT: str = "./uploads"

    REDIS_URL: Optional[str] = None

    class Config:
        env_file = ".env"
        case_sensitive = True

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def _parse_cors_origins(cls, v):
        if isinstance(v, list):
            return v
        if isinstance(v, str):
            raw = v.strip()
            if not raw:
                return []
            if raw.startswith("["):
                try:
                    return json.loads(raw)
                except json.JSONDecodeError:
                    return [raw]
            return [item.strip() for item in raw.split(",") if item.strip()]
        return ["http://localhost:5173"]


settings = Settings()
