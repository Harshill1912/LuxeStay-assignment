# 🔄 LuxeStay — Complete System Architecture & Operational Workflow

Welcome to the **LuxeStay System Workflow Document**. This document outlines the end-to-end user journeys, AI engine execution pipelines, data models, financial transaction flows, and deployment processes powering LuxeStay.

---

## 🏗️ 1. High-Level Architecture Diagram

```
                             [ GUEST & ADMIN USERS ]
                                        │
                                        ▼
                       ┌──────────────────────────────────┐
                       │  Next.js 16 Frontend (Vercel)    │
                       │  • Tailwind / Glassmorphism UI   │
                       │  • ChatWidget.js / Pass Checkout │
                       │  • JWT Auth State & Local Storage│
                       └────────────────┬─────────────────┘
                                        │
                                        │ (HTTP REST / JSON)
                                        ▼
                       ┌──────────────────────────────────┐
                       │   FastAPI Backend (Render)       │
                       │  • JWT Authentication / RBAC     │
                       │  • 3-Layer Chat Engine           │
                       │  • PDF Pass Voucher Generator    │
                       └────────┬─────────────────┬───────┘
                                │                 │
            (SQLAlchemy ORM)   │                 │ (Gemini API)
                                ▼                 ▼
       ┌──────────────────────────────┐     ┌──────────────────────────────┐
       │ PostgreSQL DB (Render / Vector)│     │  Google Gemini AI Engine     │
       │ • users & bookings tables    │     │  • text-embedding-004        │
       │ • rooms inventory            │     │  • gemini-flash-latest       │
       │ • knowledge_documents RAG    │     │  • Structured JSON Contract  │
       └──────────────────────────────┘     └──────────────────────────────┘
```

---

## 👤 2. User Workflows

### 🏨 Guest Journey Workflow
1. **Landing & Exploration**: Guest lands on the home page, browses luxury rooms (Suites, Villas, Executive, Cabanas), and explores resort amenities.
2. **Authentication**: Guest signs up or logs in via JWT auth (or uses one-click demo login: `user@luxestay.com` / `user123`).
3. **AI Concierge Interaction**:
   - Guest opens the floating **LuxeStay AI Concierge** chat drawer.
   - Asks about available rooms (e.g. *"What rooms are available?"*), hotel policies, or amenities.
   - Bot displays interactive **Room Selection Cards**.
4. **Reservation Request**:
   - Guest specifies stay dates and number of guests (e.g., *"Book Room #204 from Aug 1 to Aug 3 for 2 guests"*).
   - Bot displays an **Interactive Reservation Checkout Card** with stay calculations, GST taxes, and optional add-ons (Airport Transfer, Spa, Chef).
   - Guest clicks **"✓ Confirm Booking"**, creating a `pending_approval` reservation in PostgreSQL.
5. **Approval Notification & Payment**:
   - Once the Agency Manager approves the request, status changes to `approved`.
   - Guest visits the **Bookings Page** and clicks **"Pay 30% Deposit"**.
   - Opens the glassmorphic **VISA Credit Card Checkout Modal**, enters card details, and processes the 30% advance deposit.
6. **Pass Voucher Generation**:
   - Reservation status updates to `paid` (`30% Deposit Paid & Stay Confirmed ✓`).
   - Guest views or prints the official **PDF Reservation Voucher Pass** complete with QR code, payment breakdown, and 70% balance due notice at check-in.

---

### 🔑 Agency Administrator Workflow
1. **Admin Login**: Log in with administrator credentials (`admin@luxestay.com` / `admin123`).
2. **Dashboard Overview**: Access the **Agency Operations Dashboard** at `/admin`.
3. **Real-time Occupancy Metrics**: Monitor live property stats: Total Rooms, Available, Booked, and Pending Approvals with category breakdowns.
4. **Reservation Approval & Management**:
   - Review incoming pending requests in the **Booking Requests Table**.
   - One-click **Approve** or **Reject** requests.
   - Filter reservations by status (`Pending`, `Approved`, `Deposit Paid`).
5. **AI Assistant Operations**:
   - Open the **Agency Operations AI** assistant in the chat widget.
   - Query operational stats (e.g., *"How many rooms are booked?"*).
   - Lookup guest reservations (e.g., *"Show bookings by user John"*).
   - Trigger batch actions (e.g., *"Approve all pending requests"*).

---

## 🤖 3. AI Concierge Execution Workflow (3-Layer Hybrid Pipeline)

Every message sent to `/api/chat` passes through a **3-Layer Execution Engine** (`chat.py` & `rag.py`) designed for zero downtime and sub-50ms performance:

```
                  [ Message Received at POST /api/chat ]
                                    │
                                    ▼
         ┌─────────────────────────────────────────────────────┐
         │ LAYER 1: Deterministic Failsafe Intercepts          │
         │ • Checks auth & role guardrails                     │
         │ • Intercepts exact actions ("Book Room 204",        │
         │   "Payment status", booking/room status queries)    │
         │ • Policy intercepts answer via KB lookup, not       │
         │   hardcoded text (check-in, dining, pets, rules…)   │
         └──────────────────────────┬──────────────────────────┘
                                    │ (If general conversational query)
                                    ▼
         ┌─────────────────────────────────────────────────────┐
         │ LAYER 2: Production Hybrid RAG & LLM Engine         │
         │ • Synonym expansion & token weighting in rag.py      │
         │ • Cosine similarity search against vector index     │
         │ • Sentence-level extraction windowing              │
         │ • Gemini Flash API call with structured JSON schema │
         │ • CLOSED-BOOK: prompt + server-side citation check  │
         └──────────────────────────┬──────────────────────────┘
                                    │ (If LLM rate-limited / HTTP 429
                                    │  or answer fails grounding check)
                                    ▼
         ┌─────────────────────────────────────────────────────┐
         │ LAYER 3: Smart Database-Driven Fallback             │
         │ • Executes direct SQLAlchemy queries based on query │
         │ • Returns real live DB status instead of plain error│
         │ • Else verbatim KB snippet (strong matches only,    │
         │   ≥ RAG_ANSWER_MIN_SCORE), else explicit refusal    │
         └─────────────────────────────────────────────────────┘
```

### 📚 Knowledge-Base-Only Grounding (Closed Book)

The concierge answers **only** from two authorised sources: the retrieved `knowledge_documents` and the live hotel/booking data pulled from PostgreSQL. It never answers from the model's own training data.

| Control | Where | What it does |
|---|---|---|
| **Strict retrieval** | `rag.py → rank_relevant_docs` | Returns nothing when no document clears `RAG_MIN_SCORE`. An empty result is the signal to refuse; the old "return the top doc anyway" behaviour is now opt-in via `allow_low_score_fallback`. |
| **Closed-book prompt** | `chat.py → build_kb_only_rules` | Forbids world knowledge, estimates and extrapolated figures; mandates an exact refusal sentence when the KB does not cover the question; resists prompt-injection inside documents. |
| **Citation contract** | prompt schema `grounded` + `sources` | The model must cite the exact document titles it used, or `live_data`, or `none`. |
| **Server-side verifier** | `chat.py → verify_grounding` | Rejects any free-text answer that (a) self-reports `grounded: false`, (b) cites a document that was never supplied, or (c) cites no real source while carrying factual content — digits, ₹ amounts, or long explanatory text with `sources: ["none"]` are blocked even if the model claims it is grounded. Refusals, greetings, and clarifying questions pass. A rejected answer is replaced by a verbatim KB snippet, or the refusal message. |
| **Weak-match answer floor** | `chat.py → kb_only_refusal` + final fallback | A KB snippet is served directly to the guest only when the top document scores ≥ `RAG_ANSWER_MIN_SCORE`. A tangential one-word overlap (e.g. *"who is the prime minister of india"* matching the Location document on "india") refuses instead of quoting an unrelated fact. Documents between the two thresholds may still inform the LLM as context. |
| **Cross-document snippet extraction** | `rag.py → extract_best_answer_across` | Fallback answers pick the best-scoring sentence across ALL retrieved documents, not just the top-ranked one — fixing cases where two documents share a keyword but only one answers the question. |
| **KB-backed intercepts** | `chat.py → kb_answer` | Layer-1 policy answers are read out of the knowledge base instead of hardcoded strings, so editing a document changes the answer immediately. Intercept keyword matching is whole-word (`"cat"` no longer matches *"categories"*). |

Structured responses (`room_cards`, `book_room`, `action_card`) skip the verifier because they are rebuilt server-side from the database and cannot carry model-invented facts.

**Behaviour matrix** (verified by `tests/test_kb_grounding.py`, 21-test suite):

| Guest asks | LLM available | LLM down / rate-limited |
|---|---|---|
| In-KB question (*"check-in time?"*) | Grounded answer citing the document | Verbatim KB sentence (*"Standard check-in is 2:00 PM…"*) |
| Live-data question (*"my booking status?"*) | Grounded answer citing `live_data` | Direct SQL-built status reply |
| Off-topic (*"What is Claude?"*, *"capital of France?"*) | Prompt-mandated refusal; verifier blocks leaks | Hard-coded refusal (no model is ever consulted) |
| Tangential keyword match (*"who is the PM of india"*) | LLM refuses per closed-book rules | Refusal — match below `RAG_ANSWER_MIN_SCORE` |

**Configuration** (`config.py` / environment):

| Variable | Default | Purpose |
|---|---|---|
| `KB_ONLY_MODE` | `true` | Master switch for closed-book mode. |
| `RAG_MIN_SCORE` | `0.15` | Minimum hybrid retrieval score to enter the LLM prompt. |
| `RAG_ANSWER_MIN_SCORE` | `0.35` | Higher bar for quoting a KB snippet directly as the answer (no-LLM fallback). |
| `KB_NO_ANSWER_MESSAGE` | *"I don't have that information in LuxeStay's hotel records…"* | The single refusal sentence shown when the KB has no answer. |

**Known limitation:** a short, digit-free hallucination (a one-line world fact under ~220 characters citing `sources: ["none"]`) is caught by the prompt rules but not by the server-side heuristic; deterministic detection would require a second LLM verification call per message.

### 📖 Knowledge Base Contents (24 documents)

Seeded from `KNOWLEDGE_DOCS` in `seed.py` and extensible at runtime via `POST /api/knowledge/upload` (admin only):

- **Hotel policies** — cancellation & refunds, check-in/check-out hours, tariff & GST billing, payment methods, dining & breakfast, amenities, airport transfer, children/extra beds/pets, guest safety & house rules, location & contact.
- **Platform mechanics** (mirrors `chat.py` / `routers/bookings.py` logic — keep in sync when that logic changes) — reservation & approval process, 30% advance deposit & 70% balance, add-on services & charges (transfer ₹3,000 · spa ₹6,000 · chef ₹4,500 · extra bed ₹1,500/night, all +18% GST), reservation voucher & pass, room categories & tariff range, managing/cancelling a reservation.
- **Guest services** — Wi-Fi & business centre, housekeeping & laundry, pool/spa/fitness timings, accessibility & special assistance, medical & emergencies, events & weddings, lost & found, tipping/currency/forex, sustainability.

To extend what the concierge can answer, add a document — nothing else needs to change. New entries in `KNOWLEDGE_DOCS` are auto-ingested on the next deploy (title-based sync); consider a matching entry in `rag.py → _SYNONYM_MAP` if the topic introduces new guest vocabulary.

---

## 💳 4. Financial & Business Logic Workflow

### 💰 Tax & Deposit Formulas

$$\text{Base Total} = \text{Price Per Night} \times \text{Nights}$$

$$\text{GST Rate} = \begin{cases} 12\% & \text{if Tariff } \le \text{₹7,500 / night} \\ 18\% & \text{if Tariff } > \text{₹7,500 / night} \end{cases}$$

$$\text{Room GST} = \text{Base Total} \times \text{GST Rate}$$

$$\text{Services Subtotal} = \text{Transfer (₹3,000)} + \text{Spa (₹6,000)} + \text{Chef (₹4,500)} + \text{Extra Bed (₹1,500} \times \text{Nights)}$$

$$\text{Services GST} = \text{Services Subtotal} \times 18\%$$

$$\text{Gross Stay Total} = \text{Base Total} + \text{Room GST} + \text{Services Subtotal} + \text{Services GST}$$

$$\text{30% Advance Deposit Required} = \text{Gross Stay Total} \times 0.30$$

$$\text{70% Balance Due at Check-in} = \text{Gross Stay Total} \times 0.70$$

---

## 🔐 5. Security & Authentication Workflow

1. **Password Hashing**: User passwords are encrypted using `passlib` with `bcrypt`.
2. **JWT Session Tokens**: Login issues a signed JWT token containing `user_id`, `email`, and `role`.
3. **Route Guardrails**:
   - Guest routes (`/api/bookings`, `/api/chat`) require valid `Bearer <JWT_TOKEN>`.
   - Admin endpoints (`/api/bookings/{id}/status`, `/api/admin/stats`) enforce `role == "admin"`.
4. **Client-Side Auth Guardrails**: Unauthenticated guests attempting to book rooms receive immediate Toast notifications (`"Please log in to book a room."`).

---

## 🚀 6. CI/CD & Deployment Workflow

### 📦 Production Services

| Service | Hosting Platform | Build Command | Start Command |
|---|---|---|---|
| **Frontend Web App** | Vercel | `npm run build` | `next start` |
| **Backend API** | Render | `pip install -r requirements.txt` | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| **Database** | Render PostgreSQL | Managed DB | PostgreSQL with `pgvector` |

### 🧪 Test Suite

Run the backend suite (21 tests) before every deploy:

```bash
cd backend && python -m pytest tests -q
```

- `tests/test_guardrail.py` — server-side role enforcement: normal users cannot approve bookings via chat or the action endpoint; admins can.
- `tests/test_kb_grounding.py` — closed-book guarantees: off-topic retrieval returns nothing, the prompt embeds the grounding contract, the verifier blocks fabricated citations and uncited factual claims, weak tangential matches refuse, and strong matches still answer. Runs fully offline (no API key or network required).

### 🔄 Deployment Steps
1. Make local changes and verify code correctness.
2. Commit and push to GitHub:
   ```bash
   git add .
   git commit -m "feat: update workflow"
   git push origin main
   ```
3. GitHub webhooks automatically trigger builds on **Vercel** and **Render**.
4. Database auto-seeder runs on startup: demo accounts and room inventory are created if their tables are empty, and the RAG knowledge base is **synced by document title** — any document newly added to `KNOWLEDGE_DOCS` in `seed.py` is ingested (with a fresh embedding) on the next deploy without wiping existing documents. To force a full rebuild of every embedding, run `python reset_data.py`.

---

*LuxeStay — Developed with Next.js 16, FastAPI, PostgreSQL, and Google Gemini AI.*
