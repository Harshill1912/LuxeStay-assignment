from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Optional
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Room, User
from app.schemas import RoomOut, RoomStatusUpdate
from app.auth import require_admin

router = APIRouter(prefix="/api/rooms", tags=["Rooms"])

def date_ranges_overlap(check_in_1: str, check_out_1: str, check_in_2: str, check_out_2: str) -> bool:
    """Check if two YYYY-MM-DD date ranges overlap."""
    if not check_in_1 or not check_out_1 or not check_in_2 or not check_out_2:
        return False
    try:
        return (check_in_1 < check_out_2) and (check_in_2 < check_out_1)
    except Exception:
        return False

@router.get("", response_model=List[RoomOut])
def get_rooms(
    status_filter: Optional[str] = None,
    check_in: Optional[str] = None,
    check_out: Optional[str] = None,
    db: Session = Depends(get_db)
):
    from app.models import Booking
    query = db.query(Room)
    if status_filter:
        query = query.filter(Room.status == status_filter)
    
    rooms = query.all()
    if check_in and check_out:
        available_rooms = []
        for room in rooms:
            if room.status != "available":
                continue
            active_bookings = db.query(Booking).filter(
                Booking.room_id == room.id,
                Booking.status.in_(["pending_approval", "approved"])
            ).all()
            has_overlap = any(
                b.check_in_date and b.check_out_date and date_ranges_overlap(check_in, check_out, b.check_in_date, b.check_out_date)
                for b in active_bookings
            )
            if not has_overlap:
                available_rooms.append(room)
        return available_rooms
    return rooms

@router.patch("/{room_id}/status", response_model=RoomOut)
def update_room_status(
    room_id: int,
    status_update: RoomStatusUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin)
):
    room = db.query(Room).filter(Room.id == room_id).first()
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    
    room.status = status_update.status
    db.commit()
    db.refresh(room)
    return room
