"""Configuration for the backend application."""

from functools import lru_cache
from typing import List

from pydantic import AnyHttpUrl, BaseSettings, Field, validator
from pydantic import AnyHttpUrl, BaseSettings, Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    openai_api_key: str | None = Field(default=None, env="OPENAI_API_KEY")
    anki_url: AnyHttpUrl = Field(default="http://127.0.0.1:8765", env="ANKI_URL")
    backend_host: str = Field(default="127.0.0.1", env="BACKEND_HOST")
    backend_port: int = Field(default=8000, env="BACKEND_PORT")
    api_token: str | None = Field(default=None, env="API_TOKEN")
    allow_origins: List[str] = Field(default_factory=list, env="ALLOW_ORIGINS")
    allow_origins: List[AnyHttpUrl] = Field(default_factory=list, env="ALLOW_ORIGINS")

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"

    @validator("allow_origins", pre=True)
    def _parse_allow_origins(cls, value: str | List[str] | None) -> List[str]:
        if value is None or value == "":
            return []
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value


@lru_cache()
def get_settings() -> Settings:
    """Return cached application settings."""
    return Settings()


settings = get_settings()
