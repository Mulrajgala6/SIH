"""Application configuration.

Settings are loaded from environment variables (and an optional ``.env`` file).
The database defaults to a zero-config SQLite file so the app runs anywhere,
while PostgreSQL is the recommended target (see ``docker-compose.yml`` and
``.env.example``). Just set ``DATABASE_URL`` to switch — the models are
deliberately database-agnostic.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # --- App ---
    app_name: str = "DAKSYNC"
    app_version: str = "0.1.0"
    api_v1_prefix: str = "/api/v1"
    debug: bool = True

    # --- Database ---
    # Default: zero-config SQLite (runs with no external services).
    # Recommended: PostgreSQL, e.g.
    #   postgresql+psycopg2://daksync:daksync@localhost:5432/daksync
    database_url: str = "sqlite:///./daksync.db"

    # --- CORS / frontend ---
    frontend_origin: str = "http://localhost:3000"

    # --- Geocoding (Phase 5) ---
    nominatim_url: str = "https://nominatim.openstreetmap.org"
    nominatim_user_agent: str = "daksync-prototype/0.1 (SIH2026)"

    # --- OTP (Phase 9) ---
    otp_ttl_seconds: int = 600  # 10 minutes
    otp_length: int = 4


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
