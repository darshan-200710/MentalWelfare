from functools import lru_cache
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-only application configuration. Never put secrets in client code."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "MentalWelfare API"
    environment: Literal["development", "test", "staging", "production"] = "development"
    database_url: str = Field("sqlite:///./sentinel.db", validation_alias=AliasChoices("BACKEND_DATABASE_URL", "DATABASE_URL"))
    redis_url: str | None = None
    jwt_secret: str = Field("change-this-development-secret", min_length=16)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 20
    refresh_token_days: int = 7
    cors_origins: str = "http://127.0.0.1:3000"
    ai_provider: Literal["mock", "openai", "mental_welfare"] = "mental_welfare"
    ai_api_key: str | None = None
    ai_base_url: str = "https://api.openai.com/v1"
    ai_model: str = "gpt-4o-mini"
    max_voice_upload_bytes: int = 10 * 1024 * 1024
    support_emergency_url: str | None = None

    # ML Service Config
    ml_service_url: str = "http://127.0.0.1:8001"
    ml_service_timeout: int = 30
    
    # SMTP Config
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "noreply@mentalwelfare.in"
    
    # Frontend Config
    base_url: str = "http://127.0.0.1:3000"
    
    # Security / Auth Config
    csrf_secret: str = Field("change-this-csrf-secret", min_length=16)
    mfa_issuer: str = "MentalWelfare"

    @property
    def origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
