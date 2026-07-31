# 🧪 LuxeStay — Test Map

A step-by-step checklist to verify the new white/minimal UI, ₹ currency, and the upgraded RAG concierge.

## 0. Servers & login

| Service | URL |
|---|---|
| Frontend | http://localhost:3000 |
| Backend API | http://127.0.0.1:8000 |
| API docs (Swagger) | http://127.0.0.1:8000/docs |

**Demo logins** (login page has one-click buttons):
- 👤 User: `user@luxestay.com` / `user123`
- 🛡️ Admin: `admin@luxestay.com` / `admin123`

---

## 1. Design — white / soft / minimal (Booking.com style)

Look for: white backgrounds, blue `#0071c2` accents, soft borders, **no dark slate / gold** anywhere.

- [ ] **Home** (`/`) — white hero, blue "book in seconds", "Starting from ₹18,000" card, 3 feature cards, featured rooms.
- [ ] **Navbar** — white sticky bar, "Luxe**Stay**" logo (blue), blue Login button.
- [ ] **Rooms** (`/rooms`) — white cards, blue price pill, blue filter tabs, blue "Book Room" button.
- [ ] **Amenities** (`/amenities`) — white cards, blue icon chips, Indian content (Ayurvedic spa, thalis, yoga).
- [ ] **Login** (`/login`) — white card, blue button, demo buttons.
- [ ] **Admin** (`/admin`) — white sidebar + tables (admin login required).
- [ ] **Chat widget** — blue "Chat with concierge" pill bottom-right; opens a white panel with blue header.

---

## 2. Currency — ₹ (INR) everywhere

No `$` should appear. Expected tariffs:

| Room | Price |
|---|---|
| #101 Deluxe Ocean Suite | ₹29,000 |
| #102 Presidential Sky Villa | ₹75,000 |
| #201 Executive Garden Room | ₹18,000 |
| #202 Royal Sunset Penthouse | ₹52,000 |

- [ ] Home featured rooms show ₹ with Indian grouping (e.g. `₹75,000`).
- [ ] Rooms page price pills show ₹.
- [ ] Admin → Rooms table "Price / night" column shows ₹.
- [ ] Chat room cards show ₹ per night.

---

## 3. RAG concierge — ask & verify

Open the chat widget (bottom-right). Ask each question and confirm the answer matches the knowledge base.

| Ask | Expect the answer to mention |
|---|---|
| `Do you accept UPI or Paytm?` | UPI (GPay/PhonePe/Paytm), cards, net banking; ₹10,000/night deposit hold |
| `What is the cancellation policy?` | Free cancel up to 48h before check-in; 1-night charge within 48h |
| `Is there veg or Jain breakfast?` | Veg/Jain on request; buffet 7:00–10:30 AM |
| `What ID do I need at check-in?` | Aadhaar / passport / driving licence; passport+visa for foreigners |
| `How much GST will I pay?` | 12% up to ₹7,500/night, 18% above; GST invoice at checkout |
| `Do you allow pets?` | No pets except service animals; extra bed ₹2,500 |
| `Is there an airport pickup?` | Complimentary for suite/villa guests on request |
| `Can I smoke in the room?` | 100% non-smoking indoors; designated outdoor zones |

- [ ] Greeting opens with "Namaste".
- [ ] Answers are warm/concise (not raw policy dumps).

---

## 4. Booking flow (login as **user** first)

- [ ] In chat: `What rooms are available?` → room cards appear with ₹ prices + "Book this room".
- [ ] Click **Book this room** (or on `/rooms`, "Book Room #…") → warm confirmation message.
- [ ] That room's status flips to **Pending approval** on `/rooms`.

---

## 5. Role guardrails (security)

**As a normal user:**
- [ ] Chat: `Show me booking requests` → should **NOT** show other guests' data / approve buttons.
- [ ] Chat: `Approve booking 1` → blocked with "Unauthorized… administrators only".
- [ ] Visiting `/admin` directly → "Access denied" screen.

**As admin:**
- [ ] Chat: `Show me booking requests` → action cards with Approve / Reject buttons.
- [ ] Click **Approve** → booking confirmed, room becomes "booked".
- [ ] Admin → Rooms tab: pending booking listed; approve/reject works and refreshes.

---

## 6. Admin — Knowledge Base (RAG ingestion)

Login as admin → `/admin` → **Knowledge Base (RAG)** tab.

- [ ] "Ingested documents" list shows **9** Indian policy docs.
- [ ] Add a new doc (e.g. title `Wi-Fi Policy`, content `Free high-speed Wi-Fi is available in all rooms and the lobby.`) → Embed.
- [ ] Back in chat, ask `Is Wi-Fi free?` → answer reflects the doc you just added.

---

### Quick reset (if data gets messy)
```bash
cd backend
python reset_data.py
```
Re-applies ₹ prices and rebuilds the 9-doc knowledge base. (Note: this clears the KB, so re-add any custom docs from step 6.)
