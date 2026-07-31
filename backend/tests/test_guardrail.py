import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.models import User, Room, Booking
from app.auth import get_password_hash, create_access_token

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()

app.dependency_overrides[get_db] = override_get_db

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    
    # Create Normal User
    user = User(
        email="normal@test.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Normal User",
        role="user"
    )
    # Create Admin User
    admin = User(
        email="admin@test.com",
        hashed_password=get_password_hash("pass123"),
        full_name="Admin User",
        role="admin"
    )
    # Create Room & Booking
    room = Room(room_number="999", title="Test Suite", type="Suite", price_per_night=100.0, capacity=2, status="pending_approval")
    db.add_all([user, admin, room])
    db.commit()

    booking = Booking(room_id=room.id, user_id=user.id, status="pending_approval")
    db.add(booking)
    db.commit()

    yield
    Base.metadata.drop_all(bind=engine)

client = TestClient(app)

def test_security_guardrail_normal_user_chat_approval_rejected():
    """Verify that a Normal User sending an approval chat command is rejected server-side."""
    token = create_access_token({"sub": "normal@test.com", "role": "user", "name": "Normal User"})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.post(
        "/api/chat",
        json={"message": "Approve booking request for room 999"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "error"
    assert "unauthorized" in data["message"].lower() or "only administrators" in data["message"].lower()

def test_security_guardrail_normal_user_action_endpoint_rejected():
    """Verify that a Normal User directly calling /api/chat/action is blocked server-side."""
    token = create_access_token({"sub": "normal@test.com", "role": "user", "name": "Normal User"})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.post(
        "/api/chat/action",
        json={"action": "approve", "booking_id": 1},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "error"
    assert "unauthorized" in data["message"].lower()

def test_admin_user_chat_approval_action_succeeds():
    """Verify that an Admin User calling /api/chat/action successfully approves a booking."""
    token = create_access_token({"sub": "admin@test.com", "role": "admin", "name": "Admin User"})
    headers = {"Authorization": f"Bearer {token}"}
    
    response = client.post(
        "/api/chat/action",
        json={"action": "approve", "booking_id": 1},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["type"] == "text"
    assert "APPROVED" in data["message"]
