from pydantic import BaseModel, EmailStr
from typing import List, Optional, Any
from datetime import datetime

# --- Auth Schemas ---
class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: Optional[str] = "user" # "user" or "admin"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str
    user_name: str
    email: str

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Room Schemas ---
class RoomOut(BaseModel):
    id: int
    room_number: str
    title: str
    type: str
    price_per_night: float
    capacity: int
    description: Optional[str] = None
    image_url: Optional[str] = None
    status: str

    class Config:
        from_attributes = True

class RoomStatusUpdate(BaseModel):
    status: str

# --- Booking Schemas ---
class BookingOut(BaseModel):
    id: int
    room_id: int
    user_id: int
    status: str
    check_in_date: Optional[str] = None
    check_out_date: Optional[str] = None
    num_guests: Optional[int] = 2
    add_on_airport_transfer: Optional[bool] = False
    add_on_spa_package: Optional[bool] = False
    add_on_private_chef: Optional[bool] = False
    add_on_extra_bed: Optional[bool] = False
    total_price: Optional[float] = None
    transaction_id: Optional[str] = None
    created_at: datetime
    room: Optional[RoomOut] = None
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    class Config:
        from_attributes = True

# --- Knowledge RAG Schemas ---
class KnowledgeCreate(BaseModel):
    title: str
    content: str

class KnowledgeOut(BaseModel):
    id: int
    title: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True

# --- Structured JSON Chat Contract ---
class ChatHistoryItem(BaseModel):
    role: str # "user" or "assistant"
    content: str

class ChatRequest(BaseModel):
    message: str
    history: Optional[List[ChatHistoryItem]] = None

class ChatActionRequest(BaseModel):
    action: str # "approve", "reject", "approve_all", "reject_all", "confirm_booking"
    booking_id: Optional[int] = None
    room_number: Optional[str] = None
    check_in_date: Optional[str] = None
    check_out_date: Optional[str] = None
    num_guests: Optional[int] = None
    add_on_airport_transfer: Optional[bool] = False
    add_on_spa_package: Optional[bool] = False
    add_on_private_chef: Optional[bool] = False
    add_on_extra_bed: Optional[bool] = False

class ChatResponse(BaseModel):
    type: str # "text", "room_cards", "action_card", "error"
    message: str
    data: Optional[List[Any]] = None
    actions: Optional[List[Any]] = None
