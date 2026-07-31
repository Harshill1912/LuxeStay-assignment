import os
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Attempt PostgreSQL connection, fallback to SQLite if PostgreSQL is unavailable
def get_engine():
    db_url = settings.DATABASE_URL
    try:
        if "postgresql" in db_url:
            eng = create_engine(db_url, pool_pre_ping=True)
            with eng.connect() as conn:
                conn.execute(text("SELECT 1"))
            return eng
    except Exception as e:
        print(f"[DB Notice] PostgreSQL unavailable ({e}). Falling back to SQLite for local execution.")
    
    sqlite_url = "sqlite:///./luxestay.db"
    return create_engine(sqlite_url, connect_args={"check_same_thread": False})

engine = get_engine()
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def init_db():
    if "postgresql" in str(engine.url):
        with engine.connect() as conn:
            try:
                conn.execute(text("CREATE EXTENSION IF NOT EXISTS vector;"))
                conn.commit()
            except Exception as e:
                print(f"[DB Warning] Could not create pgvector extension directly: {e}")
    
    Base.metadata.create_all(bind=engine)

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
