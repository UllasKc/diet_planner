import json
from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

APP_DIR = Path(__file__).resolve().parent
BACKEND_DIR = APP_DIR.parent
PROJECT_ROOT = BACKEND_DIR.parent
DATA_DIR = APP_DIR / "data"
SEED_USERS_FILE = DATA_DIR / "seed_users.yaml"
SEED_FOOD_DATABASE_FILE = DATA_DIR / "seed_food_database.yaml"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(PROJECT_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    jwt_secret_key: str = "insecure-dev-secret-change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    database_url: str = f"sqlite:///{DATA_DIR / 'local.db'}"

    llm_api_key: str | None = None
    llm_base_url: str = "https://integrate.api.nvidia.com/v1"
    llm_model: str = "nvidia/nemotron-3-super-120b-a12b"
    llm_extra_body: str = "{}"

    frontend_origin: str = "http://localhost:5173"

    @property
    def llm_extra_body_dict(self) -> dict:
        try:
            parsed = json.loads(self.llm_extra_body)
            return parsed if isinstance(parsed, dict) else {}
        except (json.JSONDecodeError, TypeError):
            return {}


@lru_cache
def get_settings() -> Settings:
    return Settings()
