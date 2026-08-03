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

    # ===== KNOWLEDGE-BASE-ONLY (CLOSED-BOOK) GROUNDING =====
    # When True the concierge may ONLY answer from retrieved knowledge documents
    # and live hotel data. Anything else gets the refusal message below.
    KB_ONLY_MODE: bool = os.getenv("KB_ONLY_MODE", "true").lower() in ("1", "true", "yes")

    # Minimum hybrid retrieval score a document must reach to enter the prompt.
    RAG_MIN_SCORE: float = float(os.getenv("RAG_MIN_SCORE", "0.15"))

    # Higher bar for serving a KB snippet DIRECTLY to the guest (no-LLM fallback).
    # Between the two thresholds a document may still inform the LLM, but a weak
    # tangential match (one shared word) is never quoted as the answer itself.
    RAG_ANSWER_MIN_SCORE: float = float(os.getenv("RAG_ANSWER_MIN_SCORE", "0.35"))

    # Shown whenever the knowledge base does not cover the question.
    KB_NO_ANSWER_MESSAGE: str = os.getenv(
        "KB_NO_ANSWER_MESSAGE",
        "I don't have that information in LuxeStay's hotel records. "
        "I can help with our rooms, tariffs, reservations, amenities and hotel policies — "
        "or our front desk team can assist you further."
    )

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
