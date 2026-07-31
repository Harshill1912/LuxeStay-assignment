from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User
from app.schemas import ChatRequest, ChatResponse, ChatActionRequest
from app.auth import get_current_user, require_current_user
from app.chat import process_chat_message, handle_chat_action

router = APIRouter(prefix="/api/chat", tags=["AI Chat Assistant"])

@router.post("", response_model=ChatResponse)
def chat_endpoint(
    request: ChatRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    return process_chat_message(db, current_user, request.message, request.history)

@router.post("/action", response_model=ChatResponse)
def chat_action_endpoint(
    payload: ChatActionRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user)
):
    # SERVER-SIDE ROLE VERIFICATION GUARANTEED INSIDE handle_chat_action
    return handle_chat_action(
        db, current_user, payload.action, payload.booking_id,
        payload.room_number, payload.check_in_date, payload.check_out_date,
        payload.num_guests,
        payload.add_on_airport_transfer,
        payload.add_on_spa_package,
        payload.add_on_private_chef,
        payload.add_on_extra_bed
    )
