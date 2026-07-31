import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Text, JSON, Boolean
from sqlalchemy.orm import relationship
from app.database import Base, engine

# Graceful Vector column detection
if "postgresql" in str(engine.url):
    try:
        from pgvector.sqlalchemy import Vector
        VectorType = Vector(1536)
    except Exception:
        VectorType = JSON
else:
    VectorType = JSON

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="user", nullable=False) # "user" or "admin"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    bookings = relationship("Booking", back_populates="user")

class Room(Base):
    __tablename__ = "rooms"

    id = Column(Integer, primary_key=True, index=True)
    room_number = Column(String, unique=True, nullable=False)
    title = Column(String, nullable=False)
    type = Column(String, nullable=False) # e.g., Suite, Executive, Deluxe, Villa
    price_per_night = Column(Float, nullable=False)
    capacity = Column(Integer, nullable=False)
    description = Column(Text, nullable=True)
    image_url = Column(String, nullable=True)
    status = Column(String, default="available", nullable=False) # "available", "pending_approval", "booked"

    bookings = relationship("Booking", back_populates="room")

class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    room_id = Column(Integer, ForeignKey("rooms.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    status = Column(String, default="pending_approval", nullable=False) # "pending_approval", "approved", "rejected"
    check_in_date = Column(String, nullable=True) # e.g., "2026-08-01"
    check_out_date = Column(String, nullable=True) # e.g., "2026-08-04"
    num_guests = Column(Integer, default=2, nullable=True)
    add_on_airport_transfer = Column(Boolean, default=False, nullable=True)
    add_on_spa_package = Column(Boolean, default=False, nullable=True)
    add_on_private_chef = Column(Boolean, default=False, nullable=True)
    add_on_extra_bed = Column(Boolean, default=False, nullable=True)
    total_price = Column(Float, nullable=True)
    transaction_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    room = relationship("Room", back_populates="bookings")
    user = relationship("User", back_populates="bookings")

class KnowledgeDocument(Base):
    __tablename__ = "knowledge_documents"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    embedding = Column(VectorType, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
