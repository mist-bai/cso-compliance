from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # 若设置 DATABASE_URL（如 sqlite:///./cso.db）则优先使用
    database_url: str | None = Field(default=None, validation_alias="DATABASE_URL")
    mysql_host: str = "localhost"
    mysql_port: int = 3306
    mysql_user: str = "cso"
    mysql_password: str = "cso_pass"
    mysql_database: str = "cso_compliance"

    secret_key: str = "dev-secret"
    access_token_expire_minutes: int = 720
    algorithm: str = "HS256"

    def sqlalchemy_url(self) -> str:
        if self.database_url:
            return self.database_url
        return (
            f"mysql+pymysql://{self.mysql_user}:{self.mysql_password}"
            f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
            "?charset=utf8mb4"
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()
