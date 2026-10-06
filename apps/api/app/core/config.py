"""
QuadStack API — Core Configuration

Reads all app settings from environment variables via Pydantic BaseSettings.
"""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # App
    CLIENT_NAME: str = "QuadStack"
    APP_ENV: str = "development"
    SECRET_KEY: str = "change-me"

    # Database
    POSTGRES_USER: str = "quadstack"
    POSTGRES_PASSWORD: str = "quadstack_dev"
    POSTGRES_DB: str = "quadstack"
    POSTGRES_HOST: str = "localhost"
    POSTGRES_PORT: int = 5432

    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    @property
    def DATABASE_URL_SYNC(self) -> str:
        """Sync URL for Alembic migrations."""
        return (
            f"postgresql+psycopg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    # JWT
    JWT_SECRET_KEY: str = "change-me-jwt"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    # Staff leave the task dashboard open on a shop-floor screen all shift, so their
    # sign-in lasts longer (default 12 hours) — otherwise alerts stop after an hour.
    STAFF_ACCESS_TOKEN_EXPIRE_MINUTES: int = 720

    # Public URL of the web app — used for links inside notification emails
    APP_BASE_URL: str = "http://localhost:5173"

    # -------------------------------------------------------
    # Email notifications (SMTP)
    # Leave SMTP_HOST empty to switch email off (in-app and browser
    # notifications keep working).
    # -------------------------------------------------------
    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USERNAME: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = "QuadStack <no-reply@quadstack.local>"
    SMTP_USE_TLS: bool = True   # STARTTLS (typical for port 587)
    SMTP_USE_SSL: bool = False  # implicit TLS (typical for port 465)

    # Seed admin (used by app/seed.py on first startup)
    ADMIN_USERNAME: str = "admin"
    ADMIN_PASSWORD: str = "admin123"
    ADMIN_EMAIL: str = "admin@quadstack.local"
    ADMIN_FULL_NAME: str = "System Administrator"

    # -------------------------------------------------------
    # Copilot — LangGraph Agent
    # -------------------------------------------------------
    GROQ_API_KEY: str = ""
    GROQ_BASE_URL: str = "https://api.groq.com/openai/v1"
    COPILOT_AGENT_MODEL: str = "qwen/qwen3-32b"
    # COPILOT_AGENT_TEMPERATURE: float = 0.0

    # Read-only Postgres role for the copilot agent
    # (created by rls_setup.sql — SELECT only, no DML)
    COPILOT_DB_USER: str = "copilot_reader"
    COPILOT_DB_PASSWORD: str = "copilot_reader_pass"

    @property
    def COPILOT_DATABASE_URL(self) -> str:
        """Sync psycopg (v3) DSN — SQLDatabaseToolkit uses a sync engine."""
        return (
            f"postgresql+psycopg://{self.COPILOT_DB_USER}:{self.COPILOT_DB_PASSWORD}"
            f"@{self.POSTGRES_HOST}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Directory where agent-generated Plotly JSON files are saved
    COPILOT_CHARTS_DIR: str = "/tmp/copilot_charts"


settings = Settings()
