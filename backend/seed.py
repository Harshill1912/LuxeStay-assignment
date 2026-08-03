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
     "Children under 6 stay free using existing bedding. An extra rollaway bed or mattress is available at "
     "₹1,500 per night plus 18% GST, inclusive of breakfast. The hotel is family friendly with a kids' play area. "
     "Pets are not permitted, except certified service animals accompanying guests with disabilities."),
    ("Hotel Location & Contact",
     "LuxeStay is located on Beach Road, North Goa, Goa 403516, India. The property is approximately "
     "45 minutes by road from Dabolim International Airport and 20 minutes from the city railway station. "
     "The front desk is staffed 24 hours a day and can be reached through the concierge desk in the lobby."),
    ("Guest Safety & House Rules",
     "The property is 100% non-smoking indoors; smoking is permitted only in designated outdoor zones. "
     "Unmarried couples with valid government ID are welcome. Visitors are allowed in rooms until 9:00 PM "
     "after registering at reception. The hotel has 24/7 CCTV surveillance, in-room safes, and round-the-clock security."),

    # ===== Documents describing how the LuxeStay platform itself works =====
    # These mirror the reservation logic implemented in chat.py and routers/bookings.py.
    # Keep them in sync whenever that logic changes.
    ("Reservation & Approval Process",
     "Reservations are requested through the LuxeStay AI Concierge or the room listing, and every request is "
     "reviewed by our reservations team before it is confirmed. A new request first appears as awaiting "
     "confirmation, then becomes approved once our team accepts it, and finally becomes confirmed after the "
     "advance deposit is paid. You must be signed in to request a reservation. A room cannot be requested for "
     "more guests than its stated capacity, and a room already reserved for overlapping dates cannot be "
     "requested again — the concierge will suggest alternative dates or accommodations."),

    ("Advance Deposit & Balance Payment",
     "A 30% advance deposit of the total stay value is required to confirm a reservation. The deposit becomes "
     "payable once our reservations team approves your request, and is paid by credit or debit card from the "
     "Bookings page. The remaining 70% balance is due at check-in. A transaction reference beginning with TXN "
     "is issued the moment the deposit is received, and the reservation is then marked as confirmed. Until the "
     "deposit is paid the room is held only provisionally."),

    ("Optional Add-on Services & Charges",
     "Four optional services can be added to a reservation at the time of booking. Airport chauffeur transfer "
     "is ₹3,000 per stay. The couples spa and wellness package is ₹6,000 per stay. A private chef dinner is "
     "₹4,500 per stay. An extra rollaway bed is ₹1,500 per night. All add-on services are charged 18% GST "
     "regardless of the room tariff, and are included in the total on which the 30% advance deposit is "
     "calculated. Add-ons are selected on the reservation checkout card before you confirm."),

    ("Reservation Voucher & Pass",
     "Once the advance deposit is paid, an official LuxeStay reservation voucher is issued and can be viewed, "
     "printed, or saved as a PDF from the Bookings page. The voucher carries a QR code, your reservation "
     "reference, room and stay details, the full payment breakdown, and the balance amount payable at check-in. "
     "Please present the voucher together with valid government photo ID at the front desk on arrival."),

    ("Room Categories & Accommodation Types",
     "LuxeStay offers four accommodation categories. Suites are our signature ocean-view and heritage rooms. "
     "Villas are our largest residences, with private pools, butler or personal chef service, and space for up "
     "to six guests. Executive rooms are designed for business travellers with dedicated workspaces. Cabanas "
     "are rustic-luxury garden retreats. Nightly tariffs range from ₹12,000 for an executive room to ₹95,000 "
     "for a lagoon villa, exclusive of GST. Live availability, capacity, and current tariffs for every room "
     "are shown in the concierge and on the rooms page."),

    ("Managing or Cancelling Your Reservation",
     "You can view every reservation, its current status, and its payment state on the Bookings page after "
     "signing in. A reservation may be cancelled from that page at any time before check-in, and the room is "
     "immediately released back into availability. Refund amounts are governed by our Cancellation & Refund "
     "Policy. To change dates, guest count, or add-on services, please cancel and submit a fresh request, or "
     "ask the concierge for assistance."),

    # ===== Additional guest-services policies =====
    ("Wi-Fi, Connectivity & Business Centre",
     "Complimentary high-speed Wi-Fi is available in all rooms and public areas; connect to the LuxeStay "
     "network and sign in with your room number and surname. The business centre offers printing, scanning, "
     "and two private meeting pods, and is open from 8:00 AM to 8:00 PM. Guests in suites and villas receive "
     "premium bandwidth suitable for video conferencing."),

    ("Housekeeping & Laundry Services",
     "Rooms are serviced daily between 9:00 AM and 4:00 PM, with evening turndown available on request. "
     "Same-day laundry, dry cleaning, and pressing are collected before 9:00 AM and returned by 7:00 PM the "
     "same day; items collected later are returned the next day. Laundry is charged per item as listed in the "
     "in-room directory. Sanctuary Club Suite guests receive complimentary laundry."),

    ("Swimming Pool & Wellness Timings",
     "The outdoor infinity pool is open from 6:00 AM to 8:00 PM daily; children must be accompanied by an "
     "adult at all times and there is no lifeguard on duty after 6:00 PM. The Ayurvedic spa operates from "
     "9:00 AM to 9:00 PM with treatments by prior appointment through the concierge. The fitness centre is "
     "accessible 24 hours with your room key. Complimentary yoga is held every morning at 6:30 AM in the garden."),

    ("Accessibility & Special Assistance",
     "The lobby, restaurants, pool deck, and banquet halls are step-free and wheelchair accessible, and "
     "accessible rooms with grab rails and roll-in showers are available on request at the time of booking. "
     "Wheelchairs can be borrowed from the concierge at no charge. Certified service animals are welcome "
     "throughout the property. Please inform us of any mobility, dietary, or medical requirement in advance "
     "so we can prepare for your arrival."),

    ("Medical Assistance & Emergencies",
     "A doctor is on call 24 hours a day and can attend to guests in their room; consultation charges are "
     "posted to the room account. First-aid kits and an automated external defibrillator are held at the front "
     "desk, and the nearest multi-speciality hospital is approximately 15 minutes away. In an emergency, dial "
     "0 from any room phone to reach the front desk, or use the emergency call points on every floor."),

    ("Events, Weddings & Banquets",
     "LuxeStay has two banquet halls and a beachfront lawn for weddings, receptions, and corporate events, "
     "accommodating up to 400 guests. Packages cover catering, décor, audio-visual equipment, and "
     "accommodation blocks at preferential rates. Event enquiries are handled by our events team through the "
     "concierge, and a site visit can be arranged. Confirmed events require a signed agreement and an advance "
     "against the estimated value."),

    ("Lost & Found and Guest Property",
     "Items left behind are logged and held securely at the front desk for 90 days, after which unclaimed "
     "items are donated to charity. To claim an item, contact the concierge with your reservation reference "
     "and a description; recovered items can be couriered at the guest's cost. Valuables should be kept in the "
     "in-room safe, as the hotel is not liable for cash or valuables left unsecured in rooms."),

    ("Tipping, Currency & Foreign Exchange",
     "All charges are billed in Indian Rupees (₹). Tipping is entirely at your discretion; a service charge is "
     "not added to your bill. Foreign exchange for major currencies is available at the front desk during "
     "banking hours at prevailing rates, and a currency declaration form is completed as required by Indian "
     "regulations. International cards are accepted, and charges are settled in Indian Rupees."),

    ("Sustainability & Responsible Hospitality",
     "LuxeStay operates on solar-assisted power with rainwater harvesting and an on-site water treatment plant. "
     "Single-use plastics have been eliminated from rooms and dining in favour of glass and biodegradable "
     "alternatives. Linen and towels are changed on request rather than daily to conserve water. Kitchen waste "
     "is composted for the property gardens, and we source produce from farms within the region wherever possible."),
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


        # Seed Knowledge Base (RAG) — sync by title so newly added documents are
        # ingested on the next startup even when the KB is already populated.
        existing_titles = {t for (t,) in db.query(KnowledgeDocument.title).all()}
        for title, content in KNOWLEDGE_DOCS:
            if title not in existing_titles:
                ingest_document(db, title, content)

        print("Database seeded successfully!")
    finally:
        db.close()

if __name__ == "__main__":
    seed()
