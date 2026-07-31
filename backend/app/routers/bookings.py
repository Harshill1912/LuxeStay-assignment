from fastapi import APIRouter, Depends, HTTPException, status
from typing import List
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Booking, Room, User
from app.schemas import BookingOut, ChatActionRequest
from app.auth import require_current_user, require_admin

router = APIRouter(prefix="/api/bookings", tags=["Bookings"])

@router.get("", response_model=List[BookingOut])
def get_bookings(db: Session = Depends(get_db), current_user: User = Depends(require_current_user)):
    if current_user.role == "admin":
        bookings = db.query(Booking).order_by(Booking.created_at.desc()).all()
    else:
        bookings = db.query(Booking).filter(Booking.user_id == current_user.id).order_by(Booking.created_at.desc()).all()

    res = []
    for b in bookings:
        usr = db.query(User).filter(User.id == b.user_id).first()
        b_out = BookingOut(
            id=b.id,
            room_id=b.room_id,
            user_id=b.user_id,
            status=b.status,
            check_in_date=b.check_in_date,
            check_out_date=b.check_out_date,
            num_guests=b.num_guests,
            add_on_airport_transfer=b.add_on_airport_transfer,
            add_on_spa_package=b.add_on_spa_package,
            add_on_private_chef=b.add_on_private_chef,
            add_on_extra_bed=b.add_on_extra_bed,
            total_price=b.total_price,
            transaction_id=b.transaction_id,
            created_at=b.created_at,
            room=b.room,
            user_name=usr.full_name if usr else "Guest",
            user_email=usr.email if usr else None
        )
        res.append(b_out)
    return res

@router.post("/{booking_id}/action")
def update_booking_action(
    booking_id: int,
    payload: ChatActionRequest,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin) # SERVER-SIDE GUARDRAIL REQUIREMENT
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    room = db.query(Room).filter(Room.id == booking.room_id).first()

    action = payload.action.lower()
    if action == "approve":
        booking.status = "approved"
        if room:
            room.status = "booked"
        db.commit()
        return {"message": f"Booking #{booking_id} approved successfully", "status": "approved"}
    elif action == "reject":
        booking.status = "rejected"
        if room:
            room.status = "available"
        db.commit()
        return {"message": f"Booking #{booking_id} rejected", "status": "rejected"}
    else:
        raise HTTPException(status_code=400, detail="Invalid action")


@router.post("/{booking_id}/cancel")
def cancel_booking(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if current_user.role != "admin" and booking.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to cancel this booking")

    room = db.query(Room).filter(Room.id == booking.room_id).first()
    booking.status = "rejected"
    if room:
        room.status = "available"
    db.commit()
    return {"message": "Booking cancelled successfully", "status": "rejected"}


@router.post("/{booking_id}/pay", response_model=BookingOut)
def pay_booking_endpoint(
    booking_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_current_user)
):
    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking request not found.")
    
    if booking.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Unauthorized.")
        
    import random
    txn_num = random.randint(10000, 99999)
    
    booking.status = "paid"
    booking.transaction_id = f"TXN-{txn_num}-LS"
    db.commit()
    db.refresh(booking)
    
    usr = db.query(User).filter(User.id == booking.user_id).first()
    return BookingOut(
        id=booking.id,
        room_id=booking.room_id,
        user_id=booking.user_id,
        status=booking.status,
        check_in_date=booking.check_in_date,
        check_out_date=booking.check_out_date,
        num_guests=booking.num_guests,
        add_on_airport_transfer=booking.add_on_airport_transfer,
        add_on_spa_package=booking.add_on_spa_package,
        add_on_private_chef=booking.add_on_private_chef,
        add_on_extra_bed=booking.add_on_extra_bed,
        total_price=booking.total_price,
        transaction_id=booking.transaction_id,
        created_at=booking.created_at,
        room=booking.room,
        user_name=usr.full_name if usr else "Guest",
        user_email=usr.email if usr else None
    )
