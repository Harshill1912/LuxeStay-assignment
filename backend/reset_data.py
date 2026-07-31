"""
One-off migration for the LuxeStay AI refresh:
  1. Converts existing room tariffs to Indian Rupees (₹).
  2. Rebuilds the RAG knowledge base with the expanded Indian hotel policies.

Safe to re-run (idempotent). Usage:  python reset_data.py
"""
from app.database import SessionLocal, init_db
from app.models import Room, KnowledgeDocument
from app.rag import ingest_document
from seed import KNOWLEDGE_DOCS

# Realistic INR tariffs keyed by room number.
INR_PRICES = {
    "101": 29000.0,   # Deluxe Ocean Suite
    "102": 75000.0,   # Presidential Sky Villa
    "201": 18000.0,   # Executive Garden Room
    "202": 52000.0,   # Royal Sunset Penthouse
}


def reset():
    init_db()
    db = SessionLocal()
    try:
        # 1. Update room tariffs to INR
        updated = 0
        for room in db.query(Room).all():
            if room.room_number in INR_PRICES:
                room.price_per_night = INR_PRICES[room.room_number]
                updated += 1
        db.commit()
        print(f"Updated {updated} room tariffs to INR.")

        # 2. Rebuild the knowledge base with fresh embeddings
        db.query(KnowledgeDocument).delete()
        db.commit()
        for title, content in KNOWLEDGE_DOCS:
            ingest_document(db, title, content)
        print(f"Re-ingested {len(KNOWLEDGE_DOCS)} knowledge documents.")

        print("Reset complete.")
    finally:
        db.close()


if __name__ == "__main__":
    reset()
