# 🏨 LuxeStay — Role-Based AI Hotel Platform MVP

LuxeStay is a full-stack luxury hotel management website and booking platform featuring role-based authentication (`user` vs `admin`), an Admin Dashboard with pgvector RAG Knowledge Base ingestion, and a **Role-Aware AI Chat Assistant** that returns structured JSON payloads to dynamically render custom UI components on the frontend.

---

## 🌟 Key Features

1. **Frontend Marketing & Pages**:
   - **Home**: Luxury hero section, feature highlights, and featured suite showcases.
   - **Rooms & Suites**: Interactive catalog with real-time status filtering (`available`, `pending_approval`, `booked`) and one-click booking requests.
   - **Amenities**: Showcase of resort services (Dining, Thermal Spa, Infinity Pool, Fitness & Airport Chauffeur).
2. **Role-Based Authentication**:
   - JWT tokens with embedded user roles (`user` or `admin`) verified server-side on every request.
   - Dynamic Header: Logged-out users see "Login / Signup"; Normal Users see avatar profile menu; Admins get avatar profile menu + link to Admin Dashboard.
3. **Protected Admin Dashboard**:
   - **Rooms Management View**: Real-time room status table & pending booking request approval/rejection queue.
   - **Knowledge Base (RAG) View**: Upload form for text or `.txt` policy files embedded and stored in PostgreSQL via `pgvector`.
4. **Role-Aware AI Assistant (Chat Widget)**:
   - Floating chat widget available across all pages.
   - Renders custom frontend components based on a strict **JSON Contract**.
   - Security Guardrail: Non-admin approval requests trigger server-side JWT verification checks and are immediately rejected with an `error` JSON response.

---

## 🚀 Quick Start Guide

### 1. Start the Database (PostgreSQL + pgvector)

Start PostgreSQL with the `pgvector` extension using Docker Compose:

```bash
docker-compose up -d
```

*Or run directly via docker:*

```bash
docker run -d --name luxestay_db \
  -e POSTGRES_USER=luxestay_user \
  -e POSTGRES_PASSWORD=luxestay_password \
  -e POSTGRES_DB=luxestay_db \
  -p 5432:5432 \
  pgvector/pgvector:pg16
```

---

### 2. Backend Setup (FastAPI)

```bash
# Navigate to backend directory
cd backend

# Install dependencies
pip install -r requirements.txt

# Seed initial database with default Admin, Users, Rooms & RAG Policies
python seed.py

# Run FastAPI server
uvicorn app.main:app --reload --port 8000
```

- API Documentation: `http://localhost:8000/docs`

---

### 3. Frontend Setup (Next.js)

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Run dev server
npm run dev
```

- Web App UI: `http://localhost:3000`

---

## 🔑 Default Demo Accounts

You can click the **One-Click Demo Credentials** buttons on the Login page or use:

| Role | Email | Password | Access Rights |
|---|---|---|---|
| **Admin** | `admin@luxestay.com` | `admin123` | Full access to Admin Dashboard, Room Status controls & In-Chat Approvals |
| **Normal User** | `user@luxestay.com` | `user123` | Room bookings, AI Concierge, Policy lookup |

---

## 🛠️ Environment Configuration (`.env.example`)

Copy `.env.example` to `.env`:

```env
# Database Configuration
DATABASE_URL=postgresql://luxestay_user:luxestay_password@localhost:5432/luxestay_db
POSTGRES_USER=luxestay_user
POSTGRES_PASSWORD=luxestay_password
POSTGRES_DB=luxestay_db

# Security & Auth
SECRET_KEY=luxestay_secret_key_super_secure_jwt_token_change_in_production_12345
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=1440

# LLM / AI Configuration (Swappable)
LLM_PROVIDER=openai
OPENAI_API_KEY=your-openai-api-key-here
LLM_MODEL=gpt-4o-mini
EMBEDDING_MODEL=text-embedding-3-small
```

---

## 📜 JSON Chat Response Payload Contract

The AI Chat Assistant (`POST /api/chat`) returns structured JSON adhering to the contract below so the frontend renders dedicated UI components:

```json
{
  "type": "room_cards | action_card | text | error",
  "message": "Human readable context message",
  "data": [ ... ],
  "actions": [ ... ]
}
```

### Response Payload Types:

1. **Room Inventory Cards (`type: "room_cards"`)**:
   Returned when asking *"What rooms are available?"*:
   ```json
   {
     "type": "room_cards",
     "message": "Found 4 available room(s) for your stay:",
     "data": [
       {
         "id": 1,
         "room_number": "101",
         "title": "Deluxe Ocean Suite",
         "price_per_night": 350.0,
         "capacity": 2,
         "image_url": "https://...",
         "status": "available"
       }
     ]
   }
   ```

2. **Admin Action Cards (`type: "action_card"`)**:
   Returned to Admins when asking *"Show me booking requests"*:
   ```json
   {
     "type": "action_card",
     "message": "There are 1 pending booking request(s) awaiting your action:",
     "actions": [
       {
         "booking_id": 5,
         "room_number": "102",
         "room_title": "Presidential Sky Villa",
         "user_name": "John Smith",
         "user_email": "user@luxestay.com",
         "status": "pending_approval"
       }
     ]
   }
   ```

3. **Standard Text / RAG Answer (`type: "text"`)**:
   Returned for policy queries or general hotel FAQ:
   ```json
   {
     "type": "text",
     "message": "Based on LuxeStay Policies: Guests may cancel bookings up to 48 hours prior to check-in for a 100% full refund."
   }
   ```

4. **Security Guardrail Error (`type: "error"`)**:
   Returned if a Normal User attempts an administrative approval action:
   ```json
   {
     "type": "error",
     "message": "Unauthorized: Only administrators are permitted to approve or reject booking requests."
   }
   ```

---

## 🔒 Security Guardrail Verification

To verify that Normal Users cannot bypass permission checks via chat prompt injection or direct action execution:

```bash
cd backend
python -m pytest tests/test_guardrail.py
```

Result:
```
tests/test_guardrail.py ... [100%]
3 passed in 1.20s
```
