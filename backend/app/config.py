import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL", "postgresql://luxestay_user:luxestay_password@localhost:5432/luxestay_db"
    )
    SECRET_KEY: str = os.getenv("SECRET_KEY", "luxestay_secret_key_super_secure_jwt_token_change_in_production_12345")
    ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))
    
    # Swappable LLM Provider: "gemini", "openai", "claude", or "auto"
    LLM_PROVIDER: str = os.getenv("LLM_PROVIDER", "gemini")
    
    # API Keys
    GEMINI_API_KEY: str = os.getenv("GEMINI_API_KEY", os.getenv("OPENAI_API_KEY", ""))
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    ANTHROPIC_API_KEY: str = os.getenv("ANTHROPIC_API_KEY", "")
    
    LLM_MODEL: str = os.getenv("LLM_MODEL", "gemini-1.5-flash")
    EMBEDDING_MODEL: str = os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
