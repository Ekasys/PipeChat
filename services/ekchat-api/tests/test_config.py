"""Unit tests for ekchat config parsing and safeguards."""
import pytest

from app.config import Settings


def test_parse_cors_origins_from_csv():
    settings = Settings(CORS_ORIGINS="https://app.example.com, https://www.example.com")
    assert settings.CORS_ORIGINS == ["https://app.example.com", "https://www.example.com"]


def test_parse_cors_origins_from_json_list():
    settings = Settings(CORS_ORIGINS='["https://app.example.com","https://admin.example.com"]')
    assert settings.CORS_ORIGINS == ["https://app.example.com", "https://admin.example.com"]


def test_reject_wildcard_cors_in_production():
    with pytest.raises(ValueError):
        Settings(ENVIRONMENT="production", CORS_ORIGINS="*")


def test_allow_wildcard_cors_in_development():
    settings = Settings(ENVIRONMENT="development", CORS_ORIGINS="*")
    assert settings.CORS_ORIGINS == ["*"]
