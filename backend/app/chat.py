import json
import httpx
from typing import Optional, List, Any
from sqlalchemy.orm import Session
from app.models import User, Room, Booking
from app.schemas import ChatResponse
from app.rag import search_relevant_docs
from app.config import settings


def call_gemini(prompt: str) -> Optional[dict]:
    """Call Google Gemini API with retries and return parsed JSON response."""
    if not settings.GEMINI_API_KEY:
        return None
    model = settings.LLM_MODEL or "gemini-flash-latest"
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"
    headers = {
        "Content-Type": "application/json",
        "X-goog-api-key": settings.GEMINI_API_KEY
    }
    payload = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {"responseMimeType": "application/json"}
    }
    # Retry up to 2 times on timeout/network issue
    for attempt in range(2):
        try:
            with httpx.Client(timeout=30.0) as client:
                res = client.post(url, json=payload, headers=headers)
                if res.status_code == 200:
                    text = res.json()["candidates"][0]["content"]["parts"][0]["text"]
                    try:
                        return json.loads(text)
                    except Exception:
                        return {"type": "text", "message": text.strip()}
                else:
                    print(f"Gemini API error {res.status_code} (attempt {attempt+1}): {res.text[:300]}")
        except Exception as e:
            print(f"Gemini call exception (attempt {attempt+1}): {e}")
    return None


def call_openai(system_prompt: str, query: str) -> Optional[dict]:
    """Call OpenAI API and return parsed JSON response."""
    if not settings.OPENAI_API_KEY:
        return None
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model=settings.LLM_MODEL if "gpt" in settings.LLM_MODEL else "gpt-4o-mini",
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": query}
            ],
            response_format={"type": "json_object"}
        )
        return json.loads(response.choices[0].message.content)
    except Exception as e:
        print(f"OpenAI call exception: {e}")
    return None


def build_context(db: Session, user: Optional[User]) -> str:
    """Build rich context string about rooms, bookings, and policies for the LLM."""
    user_role = user.role if user else "guest"
    user_name = user.full_name if user else "Guest"

    # All rooms with current status
    rooms = db.query(Room).all()
    rooms_info = "\n".join([
        f"  - Room #{r.room_number}: {r.title} (Type: {r.type}, ₹{r.price_per_night:,.0f}/night, "
        f"Capacity: {r.capacity} guests, Status: {r.status})"
        for r in rooms
    ])

    # User's own bookings (if logged in)
    user_bookings_info = "Not logged in."
    if user:
        bookings = db.query(Booking).filter(Booking.user_id == user.id).all()
        if bookings:
            booking_items = []
            for b in bookings:
                rm = db.query(Room).filter(Room.id == b.room_id).first()
                title_str = rm.title if rm else 'Room'
                price_str = f"₹{b.total_price:,.0f}" if b.total_price is not None else "N/A"
                status_str = 'Being confirmed' if b.status == 'pending_approval' else 'Approved (Awaiting Deposit)' if b.status == 'approved' else 'Deposit Paid & Confirmed ✓' if b.status == 'paid' else 'Declined'
                booking_items.append(
                    f"  - Booking #{b.id} for {title_str} (Dates: {b.check_in_date or 'Standard'} to {b.check_out_date or 'Standard'}, Total: {price_str}, Status: {status_str})"
                )
            user_bookings_info = "\n".join(booking_items)
        else:
            user_bookings_info = "No reservations yet."

    # Pending approvals & All booking records (admin context only)
    pending_info = ""
    all_bookings_info = ""
    if user_role == "admin":
        pending = db.query(Booking).filter(Booking.status == "pending_approval").all()
        if pending:
            items = []
            for b in pending:
                room = db.query(Room).filter(Room.id == b.room_id).first()
                guest = db.query(User).filter(User.id == b.user_id).first()
                price_str = f"₹{b.total_price:,.0f}" if b.total_price else "N/A"
                items.append(
                    f"  - Booking ID {b.id}: {guest.full_name if guest else 'Guest'} ({guest.email if guest else 'N/A'}) "
                    f"requested Room #{room.room_number if room else '?'} ({room.title if room else 'Room'}) "
                    f"for {b.check_in_date or 'TBD'} to {b.check_out_date or 'TBD'} (Total: {price_str})"
                )
            pending_info = f"\nPENDING BOOKING REQUESTS (admin only):\n" + "\n".join(items)
        
        all_bookings = db.query(Booking).all()
        if all_bookings:
            items = []
            for b in all_bookings:
                room = db.query(Room).filter(Room.id == b.room_id).first()
                guest = db.query(User).filter(User.id == b.user_id).first()
                price_str = f"₹{b.total_price:,.0f}" if b.total_price else "N/A"
                items.append(
                    f"  - Booking ID {b.id}: Guest '{guest.full_name if guest else 'Guest'}' ({guest.email if guest else 'N/A'}) "
                    f"reserved Room #{room.room_number if room else '?'} ({room.title if room else 'Room'}) "
                    f"for {b.check_in_date or 'TBD'} to {b.check_out_date or 'TBD'} (Guests: {b.num_guests or 2}, Total: {price_str}, Status: {b.status})"
                )
            all_bookings_info = f"\nALL HISTORICAL & ACTIVE RESERVATION RECORDS (admin only):\n" + "\n".join(items)

    return f"""CURRENT USER: {user_name} (Role: {user_role})
TODAY'S DATE: 2026-07-31
HOTEL ROOMS:
{rooms_info}
USER'S RESERVATIONS:
{user_bookings_info}{pending_info}{all_bookings_info}"""


def build_system_prompt(context: str, rag_context: str, user_role: str, history_str: str = "") -> str:
    """Build the full system prompt for the LLM."""
    if user_role == "admin":
        persona_header = """AGENCY-SPECIFIED OPERATIONAL PERSONA (AGENCY / ADMIN PORTAL):
You are LuxeStay's AI Agency Operations & Property Management Assistant.
You are interacting with a LuxeStay Agency Administrator or Hotel Operations Manager.
Your role is to assist with property operations, booking approvals, room inventory oversight, and agency administrative management.
Maintain an efficient, executive, analytical, and professional operational tone."""
    else:
        persona_header = """GUEST CONCIERGE PERSONA (GUEST PORTAL):
You are LuxeStay's AI Hotel Concierge for a luxury hotel in India — warm, professional, and hospitable.
You may open with a gracious "Namaste" when greeting a guest."""

    return f"""{persona_header}

You MUST respond with a JSON object using this exact schema:
{{
  "type": "text" | "room_cards" | "action_card" | "book_room" | "error",
  "message": "<your response>",
  "data": [<room objects if type=room_cards>],
  "actions": [<booking action objects if type=action_card>],
  "room_number": "<room number to book if type=book_room>",
  "check_in_date": "YYYY-MM-DD",
  "check_out_date": "YYYY-MM-DD",
  "nights": <number of nights integer>,
  "num_guests": <number of guests integer>
}}

RESPONSE TYPE RULES:
1. "room_cards" — When asked about available rooms or room inventory. Set "data" to an array of ONLY rooms with status "available" using their exact details from the context below. Each object needs: id, room_number, title, type, price_per_night, capacity, description, image_url, status.
2. "book_room" — When a guest wants to book/reserve a room (e.g., "book room 101", "book Royal Sunset Penthouse", or follow-up phrases like "book this room", "book that room", "book it", "reserve this one").
   - If the guest says "book this room", "book that room", or "book it", inspect the sliding window history below to identify which room was mentioned or displayed in the immediate previous turn, and set "room_number" to that room's room_number.
   - Extract check-in date ("check_in_date": "YYYY-MM-DD"), check-out date ("check_out_date": "YYYY-MM-DD"), and number of guests ("num_guests": int) if specified by user (e.g., "Aug 5 to Aug 8 for 2 guests").
   - If the guest hasn't specified the guest count, ask them first (e.g. "How many guests will be staying with us?"). If they insist or you proceed with book_room, default num_guests to 2.
   - If no dates are mentioned, default check_in_date to "2026-08-01" and check_out_date to "2026-08-03" (2 nights stay).
3. "action_card" — ONLY when an admin/agency staff asks about pending/booking requests. Set "actions" to an array of pending booking objects with: booking_id, room_id, room_number, room_title, user_name, user_email, status, check_in_date, check_out_date, total_price.
4. "text" — For all other queries: policy questions, amenities, greetings, booking status, operational summaries, follow-up questions. Write a natural response tailored to the user's role.
5. "error" — Only for truly invalid requests.

FOLLOW-UP QUESTION RESOLUTION & SLIDING WINDOW CONTEXT RULES:
- Below is the sliding window of up to 10 previous conversation turns. Give the HIGHEST RELEVANCE AND PRIORITY to the most recent preceding turns.
- Detect if the current question is a FOLLOW-UP query (e.g., "What is the capacity of the room?", "Book this room", "How many are pending?", "Approve that one").
- Resolve referenced entities ("this room", "it", "that one") from the immediate previous turn(s) and answer or execute action specifically for THAT room/booking/topic.

CRITICAL RULES:
- {"AGENCY MODE ACTIVE: Provide operational details, room availability metrics, pending approval counts, and agency administrative insights." if user_role == "admin" else "GUEST MODE ACTIVE: NEVER expose internal system details like 'pending_approval', database IDs, or admin workflows to guests."}
- For guest booking status, use guest-friendly terms: "Being confirmed by our team", "Confirmed ✓", "Unfortunately unavailable".
- CURRENCY: All tariffs are in Indian Rupees (₹). Always show prices with the ₹ symbol (e.g. ₹29,000/night).
- PAYMENTS & POLICIES: Aadhaar/Passport required at check-in. Standard GST applies (12% up to ₹7,500/night, 18% above).
- Use the HOTEL POLICY context to answer policy questions naturally.

SLIDING WINDOW CHAT HISTORY (UP TO 10 RECENT TURNS - CLOSEST TURN HAS HIGHEST PRIORITY):
{history_str if history_str else "No prior conversation history."}

LIVE HOTEL DATA & INVENTORY:
{context}

HOTEL POLICIES & KNOWLEDGE:
{rag_context if rag_context else "No specific policies loaded."}"""


def process_chat_message(db: Session, user: Optional[User], query: str, history: Optional[List[Any]] = None) -> ChatResponse:
    query_lower = query.lower().strip()
    user_role = user.role if user else "guest"

    # ===== SERVER-SIDE SECURITY GUARDRAIL & BATCH ACTIONS (runs BEFORE LLM) =====
    intent_is_approval = any(w in query_lower for w in [
        "approve booking", "reject booking", "approve request", "reject request",
        "approve room", "reject room", "approve all", "reject all"
    ])
    if intent_is_approval and user_role != "admin":
        return ChatResponse(
            type="error",
            message="Unauthorized: Only administrators are permitted to approve or reject booking requests."
        )

    # --- DETERMINISTIC BOOKING CARD INTERCEPT (Failsafe for LLM rate limits/offline) ---
    is_query_or_status = any(w in query_lower for w in [
        "how many", "status", "show my", "history", "list my", "list booking", "list bookings", "booked by", "who booked"
    ])
    
    is_book_intent = False
    if not is_query_or_status:
        words = query_lower.split()
        is_book_intent = any(w in ["book", "reserve", "booking"] for w in words) or any(phrase in query_lower for phrase in [
            "want to book", "i want to book", "make a reservation", "book a room", "book the", "reserve the", "book room", "reserve room"
        ])

    if is_book_intent:
        if not user:
            return ChatResponse(type="error", message="Please log in to book a room.")
        
        all_rooms = db.query(Room).all()
        target_room = None
        for r in all_rooms:
            if r.room_number in query_lower:
                target_room = r
                break
            if r.title.lower() in query_lower or (len(r.title) > 5 and r.title.lower()[:8] in query_lower):
                target_room = r
                break
                
        if not target_room:
            target_room = db.query(Room).filter(Room.status == "available").first()
            
        if target_room:
            import re
            guests_match = re.search(r'(\d+)\s*guest', query_lower)
            guests_count = int(guests_match.group(1)) if guests_match else 2
            
            room_payload = {
                "id": target_room.id,
                "room_number": target_room.room_number,
                "title": target_room.title,
                "type": target_room.type,
                "price_per_night": target_room.price_per_night,
                "capacity": target_room.capacity,
                "description": target_room.description,
                "image_url": target_room.image_url,
                "status": target_room.status,
                "check_in_date": "2026-08-01",
                "check_out_date": "2026-08-03",
                "nights": 2,
                "num_guests": guests_count
            }
            return ChatResponse(
                type="book_room",
                message=f"I have initialized a booking session for the **{target_room.title}** (Room #{target_room.room_number}). Please review the checkout pass details below:",
                data=[room_payload]
            )

    # --- DETERMINISTIC ROOM LIST INTERCEPT (Failsafe for LLM rate limits/offline) ---
    is_search_intent = any(w in query_lower for w in ["show room", "show rooms", "available room", "available rooms", "search room", "search rooms", "view room", "view rooms", "list room", "list rooms", "find room", "find rooms", "availability"])
    if is_search_intent:
        avail_rooms = db.query(Room).filter(Room.status == "available").all()
        room_payloads = []
        for r in avail_rooms:
            room_payloads.append({
                "id": r.id,
                "room_number": r.room_number,
                "title": r.title,
                "type": r.type,
                "price_per_night": r.price_per_night,
                "capacity": r.capacity,
                "description": r.description,
                "image_url": r.image_url,
                "status": r.status
            })
        return ChatResponse(
            type="room_cards",
            message="Here are the exquisite rooms and suites available for your stay at LuxeStay:",
            data=room_payloads
        )

    # --- DETERMINISTIC BOOKED COUNT INTERCEPT (Failsafe for LLM rate limits/offline) ---
    is_booked_count_query = any(phrase in query_lower for phrase in [
        "how many room is booked", "how many rooms is booked", "how many rooms are booked",
        "how many room are booked", "how many booked rooms", "how many booked room", "how many rooms booked", "how many room booked"
    ])
    if is_booked_count_query:
        if not user:
            return ChatResponse(type="text", message="Please log in to check booking statistics.")
        
        if user_role == "admin":
            total_booked_count = db.query(Booking).filter(Booking.status.in_(["approved", "paid"])).count()
            return ChatResponse(
                type="text",
                message=f"There are currently **{total_booked_count} rooms** booked and confirmed in the LuxeStay database system."
            )
        else:
            guest_bookings_count = db.query(Booking).filter(Booking.user_id == user.id, Booking.status.in_(["approved", "paid"])).count()
            return ChatResponse(
                type="text",
                message=f"You currently have **{guest_bookings_count} confirmed reservation{'s' if guest_bookings_count > 1 else ''}** with LuxeStay."
            )

    # --- GUEST RESERVATION QUERIES DETERMINISTIC INTERCEPT ---
    is_user_booking_query = any(w in query_lower for w in [
        "booked by me", "my booking", "my bookings", "my reservation", "my reservations", "show my booking", "how many rooms is booked", "how many rooms are booked"
    ])
    if is_user_booking_query:
        if not user:
            return ChatResponse(type="text", message="Please log in to your account to view your reservations.")
        bookings = db.query(Booking).filter(Booking.user_id == user.id).all()
        if not bookings:
            return ChatResponse(type="text", message="You do not have any active room reservations at LuxeStay yet.")
        
        items = []
        for b in bookings:
            rm = db.query(Room).filter(Room.id == b.room_id).first()
            title = rm.title if rm else f"Room #{b.room_id}"
            status_label = (
                "Awaiting Manager Approval (Pending)" if b.status == "pending_approval"
                else "Approved (Awaiting 30% Deposit Payment)" if b.status == "approved"
                else "30% Deposit Paid & Stay Confirmed ✓" if b.status == "paid"
                else "Declined / Cancelled"
            )
            dates_label = f"{b.check_in_date} to {b.check_out_date}" if b.check_in_date and b.check_out_date else "Standard stay"
            price_label = f" (Total: ₹{b.total_price:,.0f})" if b.total_price else ""
            items.append(f"• **{title}** (Room #{rm.room_number if rm else '?'})\n  📅 Dates: {dates_label}{price_label}\n  Status: {status_label}")
        
        msg = f"You currently have **{len(bookings)} reservation{'s' if len(bookings) > 1 else ''}** with LuxeStay:\n\n" + "\n\n".join(items)
        return ChatResponse(type="text", message=msg)

    # --- ADMIN BOOKINGS LOOKUP DETERMINISTIC INTERCEPT ---
    is_admin_lookup_query = any(w in query_lower for w in ["booked by", "booking by", "bookings by", "reservations by", "booked for", "bookings of", "reservations of", "books by", "booking for"])
    if is_admin_lookup_query and user_role == "admin":
        import re
        search_term = ""
        match = re.search(r'(?:by user|by|for|of)\s+([a-z0-9_\-\.\s@]+)', query_lower)
        if match:
            search_term = match.group(1).strip()
            
        if search_term:
            matched_users = db.query(User).filter(
                (User.full_name.ilike(f"%{search_term}%")) | 
                (User.email.ilike(f"%{search_term}%"))
            ).all()
            
            if matched_users:
                user_ids = [u.id for u in matched_users]
                bookings = db.query(Booking).filter(Booking.user_id.in_(user_ids)).all()
                
                if bookings:
                    items = []
                    for b in bookings:
                        rm = db.query(Room).filter(Room.id == b.room_id).first()
                        title = rm.title if rm else f"Room #{b.room_id}"
                        guest = db.query(User).filter(User.id == b.user_id).first()
                        
                        status_label = (
                            "Pending Approval" if b.status == "pending_approval"
                            else "Approved (Awaiting Deposit)" if b.status == "approved"
                            else "Deposit Paid & Confirmed" if b.status == "paid"
                            else "Declined / Cancelled"
                        )
                        dates_label = f"{b.check_in_date} to {b.check_out_date}" if b.check_in_date and b.check_out_date else "Standard stay"
                        price_label = f" (Total: ₹{b.total_price:,.0f})" if b.total_price else ""
                        items.append(
                            f"• **Booking ID #LS-{b.id}** for Guest **{guest.full_name if guest else 'Guest'}** ({guest.email if guest else 'N/A'})\n"
                            f"  🏨 Accommodation: {title} (Room #{rm.room_number if rm else '?'})\n"
                            f"  📅 Dates: {dates_label}{price_label}\n"
                            f"  Status: **{status_label}**"
                        )
                    
                    msg = f"Found **{len(bookings)} reservation{'s' if len(bookings) > 1 else ''}** matching your search for guest **\"{search_term}\"**:\n\n" + "\n\n".join(items)
                    return ChatResponse(type="text", message=msg)
                else:
                    return ChatResponse(type="text", message=f"No active bookings found for guest matching \"{search_term}\".")
            else:
                return ChatResponse(type="text", message=f"No guests found matching name or email: \"{search_term}\".")
        
        all_bookings = db.query(Booking).all()
        if not all_bookings:
            return ChatResponse(type="text", message="There are currently no bookings registered in the LuxeStay database.")
            
        items = []
        for b in all_bookings:
            rm = db.query(Room).filter(Room.id == b.room_id).first()
            guest = db.query(User).filter(User.id == b.user_id).first()
            status_label = (
                "Pending Approval" if b.status == "pending_approval"
                else "Approved (Awaiting Deposit)" if b.status == "approved"
                else "Deposit Paid & Confirmed" if b.status == "paid"
                else "Declined"
            )
            items.append(f"• **#LS-{b.id}**: {guest.full_name if guest else 'Guest'} · Room #{rm.room_number if rm else '?'} ({b.status})")
        
        msg = f"Here is the complete historical and active reservations log ({len(all_bookings)} total):\n\n" + "\n".join(items)
        return ChatResponse(type="text", message=msg)

    # --- ADMIN OCCUPANCY QUERIES DETERMINISTIC INTERCEPT ---
    is_occupancy_query = any(w in query_lower for w in [
        "occupancy", "room status summary", "inventory status", "rooms status", "how many rooms are available", "how many rooms is available"
    ])
    if is_occupancy_query and user_role == "admin":
        total_rooms = db.query(Room).count()
        available_rooms = db.query(Room).filter(Room.status == "available").count()
        pending_rooms = db.query(Room).filter(Room.status == "pending_approval").count()
        booked_rooms = db.query(Room).filter(Room.status == "booked").count()
        
        # Breakdown by category
        suites_avail = db.query(Room).filter(Room.type == "Suite", Room.status == "available").count()
        suites_total = db.query(Room).filter(Room.type == "Suite").count()
        villas_avail = db.query(Room).filter(Room.type == "Villa", Room.status == "available").count()
        villas_total = db.query(Room).filter(Room.type == "Villa").count()
        exec_avail = db.query(Room).filter(Room.type == "Executive", Room.status == "available").count()
        exec_total = db.query(Room).filter(Room.type == "Executive").count()
        cabanas_avail = db.query(Room).filter(Room.type == "Cabana", Room.status == "available").count()
        cabanas_total = db.query(Room).filter(Room.type == "Cabana").count()

        widget_data = [{
            "total_rooms": total_rooms,
            "available_rooms": available_rooms,
            "pending_rooms": pending_rooms,
            "booked_rooms": booked_rooms,
            "breakdown": {
                "Suites": {"available": suites_avail, "total": suites_total},
                "Villas": {"available": villas_avail, "total": villas_total},
                "Executive": {"available": exec_avail, "total": exec_total},
                "Cabanas": {"available": cabanas_avail, "total": cabanas_total}
            }
        }]
        
        msg = "Here is the real-time operational occupancy and room inventory summary for today:"
        return ChatResponse(type="occupancy_widget", message=msg, data=widget_data)

    # --- BATCH ACTION TEXT INTENTS (ADMIN ONLY) ---
    if any(w in query_lower for w in ["approve all bookings", "approve all requests", "approve all"]):
        return handle_chat_action(db, user, "approve_all")

    if any(w in query_lower for w in ["reject all bookings", "reject all requests", "reject all"]):
        return handle_chat_action(db, user, "reject_all")

    # ===== FORMAT SLIDING WINDOW HISTORY (LAST 10 MESSAGES, HIGHEST PRIORITY TO LAST) =====
    history_str = ""
    if history:
        recent_history = history[-10:] # Sliding window of last 10 messages
        formatted_turns = []
        total = len(recent_history)
        for idx, item in enumerate(recent_history, 1):
            if isinstance(item, dict):
                r = item.get("role", "user")
                c = item.get("content", "")
            else:
                r = getattr(item, "role", "user")
                c = getattr(item, "content", "")
            priority_tag = " (MOST RECENT PRECEDING TURN - HIGHEST RELEVANCE PRIORITY)" if idx == total else ""
            formatted_turns.append(f"Turn {idx}/{total}{priority_tag} [{r.upper()}]: {c}")
        history_str = "\n".join(formatted_turns)

    # ===== GATHER CONTEXT =====
    context = build_context(db, user)
    relevant_docs = search_relevant_docs(db, query, top_k=4)
    rag_context = "\n".join([f"- {doc.title}: {doc.content}" for doc in relevant_docs]) if relevant_docs else ""
    system_prompt = build_system_prompt(context, rag_context, user_role, history_str)

    # ===== CALL LLM (Gemini primary, OpenAI fallback) =====
    full_prompt = f"{system_prompt}\n\nGuest's Current Question: {query}"
    llm_result = call_gemini(full_prompt)
    if not llm_result:
        llm_result = call_openai(system_prompt, query)

    # ===== PROCESS LLM RESPONSE =====
    if llm_result:
        resp_type = llm_result.get("type", "text")
        message = llm_result.get("message", "")

        # --- LLM wants to book a room: execute DB action server-side with Dates & Price Calculation ---
        if resp_type == "book_room":
            if not user:
                return ChatResponse(type="error", message="Please log in to book a room.")

            room_number = str(llm_result.get("room_number", ""))
            target_room = db.query(Room).filter(Room.room_number == room_number).first()

            if not target_room:
                target_room = db.query(Room).filter(Room.status == "available").first()

            if not target_room:
                return ChatResponse(
                    type="text",
                    message="I'm sorry, all our rooms are currently occupied. Please check back shortly."
                )
            if target_room.status != "available":
                return ChatResponse(
                    type="text",
                    message=f"I'm sorry, the {target_room.title} is not available at the moment. Would you like to see other rooms?"
                )

            # Dates, Duration & Guests calculation
            check_in_str = llm_result.get("check_in_date", "2026-08-01")
            check_out_str = llm_result.get("check_out_date", "2026-08-03")
            nights = llm_result.get("nights", 2)
            num_guests = llm_result.get("num_guests", 2)

            # Capacity Guardrail Check
            if target_room.capacity < num_guests:
                return ChatResponse(
                    type="text",
                    message=f"I'm sorry, the **{target_room.title}** has a maximum capacity of **{target_room.capacity}** guests. Your request is for **{num_guests}** guests. Would you like to select fewer guests or view larger accommodations?"
                )

            # Date Range Overlap Check against DB
            active_bookings = db.query(Booking).filter(
                Booking.room_id == target_room.id,
                Booking.status.in_(["pending_approval", "approved"])
            ).all()
            for b in active_bookings:
                if b.check_in_date and b.check_out_date:
                    if (check_in_str < b.check_out_date) and (b.check_in_date < check_out_str):
                        return ChatResponse(
                            type="text",
                            message=f"I'm sorry, the **{target_room.title}** (Room #{target_room.room_number}) is already reserved for the dates **{b.check_in_date} to {b.check_out_date}**. Please select alternative stay dates or explore our other available accommodations."
                        )

            # Calculate GST & total price
            price_per_night = target_room.price_per_night
            gst_rate = 0.12 if price_per_night <= 7500 else 0.18
            base_total = price_per_night * nights
            gst_amount = base_total * gst_rate
            total_price = round(base_total + gst_amount, 2)

            confirm_data = [{
                "room_id": target_room.id,
                "room_number": target_room.room_number,
                "title": target_room.title,
                "price_per_night": price_per_night,
                "check_in_date": check_in_str,
                "check_out_date": check_out_str,
                "nights": nights,
                "num_guests": num_guests,
                "base_total": base_total,
                "gst_rate": gst_rate,
                "gst_amount": gst_amount,
                "total_price": total_price
            }]

            return ChatResponse(
                type="book_room",
                message="Please confirm your reservation request details below:",
                data=confirm_data
            )

        # --- LLM returned room_cards: pass through with data ---
        if resp_type == "room_cards":
            data = llm_result.get("data", [])
            # If LLM didn't provide proper data, build it from DB
            if not data:
                available = db.query(Room).filter(Room.status == "available").all()
                data = [
                    {
                        "id": r.id, "room_number": r.room_number, "title": r.title,
                        "type": r.type, "price_per_night": r.price_per_night,
                        "capacity": r.capacity, "description": r.description,
                        "image_url": r.image_url, "status": r.status
                    }
                    for r in available
                ]
            return ChatResponse(type="room_cards", message=message, data=data)

        # --- LLM returned action_card (admin only, guardrail re-check) ---
        if resp_type == "action_card":
            if user_role != "admin":
                return ChatResponse(type="error", message="Unauthorized: Only administrators can view booking requests.")
            actions = llm_result.get("actions", [])
            if not actions:
                pending = db.query(Booking).filter(Booking.status == "pending_approval").all()
                actions = []
                for b in pending:
                    room = db.query(Room).filter(Room.id == b.room_id).first()
                    guest = db.query(User).filter(User.id == b.user_id).first()
                    actions.append({
                        "booking_id": b.id, "room_id": b.room_id,
                        "room_number": room.room_number if room else "", "room_title": room.title if room else "Room",
                        "user_name": guest.full_name if guest else "Guest", "user_email": guest.email if guest else "",
                        "status": b.status,
                        "check_in_date": b.check_in_date or "2026-08-01",
                        "check_out_date": b.check_out_date or "2026-08-03",
                        "total_price": b.total_price or (room.price_per_night * 2 * 1.18 if room else 0)
                    })
            if not actions:
                return ChatResponse(type="text", message=message or "No pending booking requests at this time.")
            return ChatResponse(type="action_card", message=message, actions=actions)

        # --- LLM returned text or error: pass through ---
        return ChatResponse(type=resp_type if resp_type in ["text", "error"] else "text", message=message)

    # ===== SMART FALLBACK: No LLM available — try contextual database answers =====
    
    # Admin: queries about bookings, guests, or rooms
    if user_role == "admin":
        # General booking list
        if any(w in query_lower for w in ["booking", "reservation", "booked", "guest"]):
            all_bookings = db.query(Booking).all()
            if all_bookings:
                items = []
                for b in all_bookings:
                    rm = db.query(Room).filter(Room.id == b.room_id).first()
                    guest = db.query(User).filter(User.id == b.user_id).first()
                    status_label = (
                        "⏳ Pending Approval" if b.status == "pending_approval"
                        else "✅ Approved" if b.status == "approved"
                        else "💳 Deposit Paid & Confirmed" if b.status == "paid"
                        else "❌ Declined"
                    )
                    guest_name = guest.full_name if guest else "Guest"
                    room_name = f"{rm.title} (#{rm.room_number})" if rm else f"Room #{b.room_id}"
                    dates = f"{b.check_in_date} → {b.check_out_date}" if b.check_in_date else "TBD"
                    price_str = f" · ₹{b.total_price:,.0f}" if b.total_price else ""
                    items.append(f"• **#LS-{b.id}** | {guest_name} | {room_name} | {dates}{price_str} | {status_label}")
                
                msg = f"📋 **LuxeStay Reservations Dashboard** ({len(all_bookings)} total):\n\n" + "\n".join(items)
                return ChatResponse(type="text", message=msg)
            else:
                return ChatResponse(type="text", message="There are currently no bookings in the system.")
        
        # Room inventory / status
        if any(w in query_lower for w in ["room", "inventory", "available", "status"]):
            total = db.query(Room).count()
            avail = db.query(Room).filter(Room.status == "available").count()
            booked = db.query(Room).filter(Room.status == "booked").count()
            pending = db.query(Room).filter(Room.status == "pending_approval").count()
            msg = (
                f"🏨 **Room Inventory Status**:\n\n"
                f"• Total Rooms: **{total}**\n"
                f"• Available: **{avail}** ✅\n"
                f"• Booked / Confirmed: **{booked}** 🔒\n"
                f"• Pending Approval: **{pending}** ⏳"
            )
            return ChatResponse(type="text", message=msg)
    
    # Guest: queries about their own bookings
    if user and any(w in query_lower for w in ["booking", "reservation", "booked", "my room"]):
        bookings = db.query(Booking).filter(Booking.user_id == user.id).all()
        if bookings:
            items = []
            for b in bookings:
                rm = db.query(Room).filter(Room.id == b.room_id).first()
                title = rm.title if rm else f"Room #{b.room_id}"
                status_label = (
                    "⏳ Awaiting Manager Approval" if b.status == "pending_approval"
                    else "✅ Approved (Awaiting 30% Deposit)" if b.status == "approved"
                    else "💳 30% Deposit Paid & Confirmed" if b.status == "paid"
                    else "❌ Declined"
                )
                dates = f"{b.check_in_date} → {b.check_out_date}" if b.check_in_date else "Standard stay"
                price_str = f" (Total: ₹{b.total_price:,.0f})" if b.total_price else ""
                items.append(f"• **{title}** (#{rm.room_number if rm else '?'})\n  📅 {dates}{price_str}\n  Status: {status_label}")
            
            msg = f"You have **{len(bookings)} reservation{'s' if len(bookings) > 1 else ''}** with LuxeStay:\n\n" + "\n\n".join(items)
            return ChatResponse(type="text", message=msg)
        else:
            return ChatResponse(type="text", message="You don't have any reservations yet. Would you like to browse our available rooms?")
    
    # Fallback: RAG context if available
    if rag_context:
        return ChatResponse(type="text", message=f"Based on our hotel information:\n\n" + "\n".join([f"• {doc.content}" for doc in relevant_docs]))

    return ChatResponse(
        type="text",
        message="Welcome to LuxeStay! I can help you with room availability, reservations, hotel amenities, and policies. What would you like to know?"
    )


def handle_chat_action(
    db: Session,
    user: User,
    action: str,
    booking_id: Optional[int] = None,
    room_number: Optional[str] = None,
    check_in_date: Optional[str] = None,
    check_out_date: Optional[str] = None,
    num_guests: Optional[int] = None,
    add_on_airport_transfer: Optional[bool] = False,
    add_on_spa_package: Optional[bool] = False,
    add_on_private_chef: Optional[bool] = False,
    add_on_extra_bed: Optional[bool] = False
) -> ChatResponse:
    """Handle booking confirmation (Guests) and approve/reject actions (Admins)."""
    act = action.lower().strip()

    # --- CLIENT-SIDE / GUEST ACTION: CONFIRM BOOKING RESERVATION ---
    if act == "confirm_booking":
        if not user:
            return ChatResponse(type="error", message="Unauthorized: Please log in to complete your reservation.")
        
        target_room = db.query(Room).filter(Room.room_number == room_number).first()
        if not target_room:
            return ChatResponse(type="error", message="Room not found.")
        
        if target_room.status != "available":
            return ChatResponse(type="text", message=f"I'm sorry, the {target_room.title} is no longer available.")

        # Re-check date overlaps just before committing
        check_in_str = check_in_date or "2026-08-01"
        check_out_str = check_out_date or "2026-08-03"
        guests_count = num_guests or 2
        
        # Double check date range overlaps
        active_bookings = db.query(Booking).filter(
            Booking.room_id == target_room.id,
            Booking.status.in_(["pending_approval", "approved"])
        ).all()
        for b in active_bookings:
            if b.check_in_date and b.check_out_date:
                if (check_in_str < b.check_out_date) and (b.check_in_date < check_out_str):
                    return ChatResponse(
                        type="text",
                        message=f"I'm sorry, the **{target_room.title}** has already been reserved for those dates by another guest."
                    )

        # Calculate stay length and total price
        try:
            from datetime import datetime
            d1 = datetime.strptime(check_in_str, "%Y-%m-%d")
            d2 = datetime.strptime(check_out_str, "%Y-%m-%d")
            nights = max(1, (d2 - d1).days)
        except Exception:
            nights = 2

        price_per_night = target_room.price_per_night
        gst_rate = 0.12 if price_per_night <= 7500 else 0.18
        base_total = price_per_night * nights
        room_gst = base_total * gst_rate
        
        # Amenities math
        transfer_fee = 3000 if add_on_airport_transfer else 0
        spa_fee = 6000 if add_on_spa_package else 0
        chef_fee = 4500 if add_on_private_chef else 0
        bed_fee = (1500 * nights) if add_on_extra_bed else 0
        
        services_subtotal = transfer_fee + spa_fee + chef_fee + bed_fee
        services_gst = services_subtotal * 0.18  # standard service GST in India
        
        total_price = round(base_total + room_gst + services_subtotal + services_gst, 2)

        target_room.status = "pending_approval"
        new_booking = Booking(
            room_id=target_room.id,
            user_id=user.id,
            status="pending_approval",
            check_in_date=check_in_str,
            check_out_date=check_out_str,
            num_guests=guests_count,
            add_on_airport_transfer=bool(add_on_airport_transfer),
            add_on_spa_package=bool(add_on_spa_package),
            add_on_private_chef=bool(add_on_private_chef),
            add_on_extra_bed=bool(add_on_extra_bed),
            total_price=total_price
        )
        db.add(new_booking)
        db.commit()

        # Build list of chosen services
        addons_list = []
        if add_on_airport_transfer: addons_list.append("🚗 Airport Chauffeur Transfer (₹3,000)")
        if add_on_spa_package: addons_list.append("💆 Couples Spa & Wellness (₹6,000)")
        if add_on_private_chef: addons_list.append("🍽️ Private Chef Dinner (₹4,500)")
        if add_on_extra_bed: addons_list.append(f"🛏️ Extra Rollaway Bed (₹1,500/night · ₹{bed_fee:,})")

        addons_section = ""
        if addons_list:
            addons_section = "\n✨ **Premium Add-ons Selected**:\n" + "\n".join([f"  {item}" for item in addons_list]) + "\n"

        confirm_msg = (
            f"✓ **Reservation Request Confirmed!**\n\n"
            f"Your request for the **{target_room.title}** (Room #{target_room.room_number}) has been submitted successfully.\n\n"
            f"📅 **Stay Dates**: {check_in_str} to {check_out_str} ({nights} night{'s' if nights > 1 else ''})\n"
            f"👥 **Guests**: {guests_count} guest{'s' if guests_count > 1 else ''}\n"
            f"{addons_section}"
            f"💰 **Total Tariff**: **₹{total_price:,.0f}** (incl. Room GST & statutory services tax)\n\n"
            f"Our team will confirm your stay shortly. We look forward to welcoming you!"
        )
        return ChatResponse(type="text", message=confirm_msg)

    # CRITICAL SERVER-SIDE GUARDRAIL FOR ADMIN ACTIONS (approve, reject, bulk approval)
    if user.role != "admin":
        return ChatResponse(type="error", message="Unauthorized: Only administrators can approve or reject booking requests.")

    # --- BATCH ACTION: APPROVE ALL PENDING BOOKINGS ---
    if act in ["approve_all", "approve all"]:
        pending_bookings = db.query(Booking).filter(Booking.status == "pending_approval").all()
        if not pending_bookings:
            return ChatResponse(type="text", message="There are currently no pending booking requests awaiting approval.")

        count = len(pending_bookings)
        for b in pending_bookings:
            b.status = "approved"
            room = db.query(Room).filter(Room.id == b.room_id).first()
            if room:
                room.status = "booked"
        db.commit()
        return ChatResponse(
            type="text",
            message=f"✅ Bulk Action Complete — Approved all {count} pending booking request(s). The rooms are now confirmed and guest notifications sent."
        )

    # --- BATCH ACTION: REJECT ALL PENDING BOOKINGS ---
    if act in ["reject_all", "reject all"]:
        pending_bookings = db.query(Booking).filter(Booking.status == "pending_approval").all()
        if not pending_bookings:
            return ChatResponse(type="text", message="There are currently no pending booking requests to reject.")

        count = len(pending_bookings)
        for b in pending_bookings:
            b.status = "rejected"
            room = db.query(Room).filter(Room.id == b.room_id).first()
            if room:
                room.status = "available"
        db.commit()
        return ChatResponse(
            type="text",
            message=f"❌ Bulk Action Complete — Declined all {count} pending booking request(s). All corresponding rooms are now available again."
        )

    # --- SINGLE BOOKING ACTIONS ---
    if not booking_id:
        return ChatResponse(type="error", message="Missing booking ID for action.")

    booking = db.query(Booking).filter(Booking.id == booking_id).first()
    if not booking:
        return ChatResponse(type="error", message=f"Booking #{booking_id} not found.")

    room = db.query(Room).filter(Room.id == booking.room_id).first()
    room_name = f"{room.title} (#{room.room_number})" if room else f"Room #{booking.room_id}"

    if act == "approve":
        booking.status = "approved"
        if room:
            room.status = "booked"
        db.commit()
        return ChatResponse(type="text", message=f"✅ Approved — {room_name} is now confirmed. The guest will be notified.")
    elif act == "reject":
        booking.status = "rejected"
        if room:
            room.status = "available"
        db.commit()
        return ChatResponse(type="text", message=f"❌ Declined — {room_name} booking has been declined. The room is available again.")
    else:
        return ChatResponse(type="error", message=f"Unknown action: '{action}'.")
