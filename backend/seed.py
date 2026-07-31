from app.database import SessionLocal, init_db
from app.models import User, Room, KnowledgeDocument
from app.auth import get_password_hash
from app.rag import ingest_document

# ===== RAG KNOWLEDGE BASE — Indian luxury hotel policies =====
# Shared by seed() and reset_data.py so the AI concierge always has rich context.
KNOWLEDGE_DOCS = [
    ("Cancellation & Refund Policy",
     "Guests may cancel a booking up to 48 hours before check-in for a 100% full refund. "
     "Cancellations within 48 hours of check-in incur a one-night retention charge plus applicable GST. "
     "No-shows are charged the full first night. Refunds are processed to the original payment method "
     "(UPI, card, or net banking) within 5-7 working days."),
    ("Check-in & Check-out Hours",
     "Standard check-in is 2:00 PM and check-out is 12:00 noon (IST). Early check-in and late check-out "
     "are subject to availability and may carry a charge. A valid government photo ID — Aadhaar card, "
     "passport, or driving licence — is mandatory for every guest at check-in as per Indian law. "
     "Foreign nationals must present a passport and valid visa."),
    ("Tariff, GST & Billing",
     "All room tariffs are quoted in Indian Rupees (₹) and are exclusive of taxes. GST is charged at 12% "
     "for tariffs up to ₹7,500 per night and 18% for tariffs above ₹7,500 per night. A GST tax invoice with "
     "the hotel GSTIN is issued at check-out. Corporate guests may share their company GSTIN at check-in "
     "for input tax credit."),
    ("Payment Methods",
     "We accept UPI (Google Pay, PhonePe, Paytm, BHIM), all major credit and debit cards (Visa, Mastercard, "
     "RuPay, Amex), net banking, and cash up to statutory limits. A pre-authorisation hold of ₹10,000 per "
     "night is placed on the card at check-in as a security deposit and released at check-out."),
    ("Dining & Breakfast",
     "Complimentary buffet breakfast is served at the Azure Lounge daily from 7:00 AM to 10:30 AM, featuring "
     "South Indian, North Indian, and Continental spreads. Pure-vegetarian and Jain meals are available on "
     "request. Our restaurants serve multi-cuisine and authentic Indian thalis. In-room dining and 24/7 room "
     "service are available via the concierge."),
    ("Amenities & Facilities",
     "The hotel offers an outdoor infinity pool, a traditional Ayurvedic spa, a 24/7 fitness centre, "
     "complimentary high-speed Wi-Fi, valet parking, currency exchange, a business centre, and banquet halls "
     "for weddings and events. Yoga sessions are conducted every morning at 6:30 AM in the garden."),
    ("Airport Transfer & Local Travel",
     "Complimentary airport pick-up and drop is available for suite and villa guests on prior request. "
     "Chauffeur-driven cabs and self-drive rentals can be arranged through the concierge. The hotel is "
     "approximately 45 minutes from the international airport and 20 minutes from the city railway station."),
    ("Children, Extra Beds & Pets",
     "Children under 6 stay free using existing bedding. An extra bed or mattress is available at ₹2,500 per "
     "night inclusive of breakfast. The hotel is family friendly with a kids' play area. Pets are not permitted, "
     "except certified service animals accompanying guests with disabilities."),
    ("Guest Safety & House Rules",
     "The property is 100% non-smoking indoors; smoking is permitted only in designated outdoor zones. "
     "Unmarried couples with valid government ID are welcome. Visitors are allowed in rooms until 9:00 PM "
     "after registering at reception. The hotel has 24/7 CCTV surveillance, in-room safes, and round-the-clock security."),
]


def seed():
    init_db()
    db = SessionLocal()
    try:
        # Seed Users
        if not db.query(User).filter(User.email == "admin@luxestay.com").first():
            admin = User(
                email="admin@luxestay.com",
                hashed_password=get_password_hash("admin123"),
                full_name="Hotel Administrator",
                role="admin"
            )
            db.add(admin)

        if not db.query(User).filter(User.email == "user@luxestay.com").first():
            user = User(
                email="user@luxestay.com",
                hashed_password=get_password_hash("user123"),
                full_name="John Smith",
                role="user"
            )
            db.add(user)

        db.commit()

        # Seed Rooms
        if db.query(Room).count() == 0:
            rooms = [
                Room(
                    room_number="101",
                    title="Deluxe Ocean Suite",
                    type="Suite",
                    price_per_night=29000.0,
                    capacity=2,
                    description="Private balcony overlooking the turquoise ocean with king-sized feather bed and marble bath.",
                    image_url="https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="102",
                    title="Presidential Sky Villa",
                    type="Villa",
                    price_per_night=75000.0,
                    capacity=4,
                    description="Ultra-luxurious rooftop villa with private infinity plunge pool, butler service, and panoramic skyline views.",
                    image_url="https://images.unsplash.com/photo-1618773928121-c32242e63f39?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="103",
                    title="Ocean View Grand Suite",
                    type="Suite",
                    price_per_night=35000.0,
                    capacity=2,
                    description="Wake up to sea views with floor-to-ceiling glass windows, private sundeck, custom sound system, and Egyptian cotton bedding.",
                    image_url="https://images.unsplash.com/photo-1596394516093-501ba68a0ba6?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="104",
                    title="Tropical Forest Cabana",
                    type="Cabana",
                    price_per_night=15000.0,
                    capacity=2,
                    description="Rustic-luxury wooden cabin nestled in lush foliage. Features outdoor stone bathtub, hammock balcony, and morning songbird wakeups.",
                    image_url="https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="201",
                    title="Executive Garden Room",
                    type="Executive",
                    price_per_night=18000.0,
                    capacity=2,
                    description="Peaceful ground-floor retreat featuring a private tropical garden terrace, ergonomic workspace, and rain shower.",
                    image_url="https://images.unsplash.com/photo-1590490360182-c33d57733427?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="202",
                    title="Royal Sunset Penthouse",
                    type="Suite",
                    price_per_night=52000.0,
                    capacity=3,
                    description="Opulent suite with floor-to-ceiling windows, customized cocktail bar, Jacuzzi spa, and sunset view.",
                    image_url="https://images.unsplash.com/photo-1566665797739-1674de7a421a?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="203",
                    title="Elite Business Sanctuary",
                    type="Executive",
                    price_per_night=12000.0,
                    capacity=2,
                    description="Modern high-tech sanctuary optimized for business travelers. Features multi-screen workspace, soundproof walls, and premium espresso bar.",
                    image_url="https://images.unsplash.com/photo-1631049307264-da0ec9d70304?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="204",
                    title="Sanctuary Club Suite",
                    type="Suite",
                    price_per_night=22000.0,
                    capacity=2,
                    description="High-floor corner suite with private cocktail lounge access, complimentary laundry, luxury bath therapies, and custom pillow menu.",
                    image_url="https://images.unsplash.com/photo-1591088398332-8a7791972843?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="301",
                    title="Imperial Lagoon Villa",
                    type="Villa",
                    price_per_night=95000.0,
                    capacity=6,
                    description="Floating wood deck villa over private lagoon, personalized chef, 2 bedrooms, outdoor rain-shower, glass floor viewports.",
                    image_url="https://images.unsplash.com/photo-1439066615861-d1af74d74000?auto=format&fit=crop&w=800&q=80",
                    status="available"
                ),
                Room(
                    room_number="302",
                    title="Heritage Royal Suite",
                    type="Suite",
                    price_per_night=42000.0,
                    capacity=3,
                    description="Inspired by Rajasthani palace architecture, featuring silk upholstery, antique teak furnishings, hand-carved pillars, and terrace views.",
                    image_url="https://images.unsplash.com/photo-1578683010236-d716f9a3f461?auto=format&fit=crop&w=800&q=80",
                    status="available"
                )
            ]
            db.add_all(rooms)
            db.commit()

        # No default bookings seeded for a clean test submission.


        # Seed Knowledge Base (RAG)
        if db.query(KnowledgeDocument).count() == 0:
            docs = KNOWLEDGE_DOCS
            for title, content in docs:
                ingest_document(db, title, content)

        print("Database seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
