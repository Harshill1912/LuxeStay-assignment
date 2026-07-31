from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import init_db
from app.routers import auth, rooms, bookings, knowledge, chat

app = FastAPI(
    title="LuxeStay API",
    description="Backend API for LuxeStay Hotel Platform with Role-Based Auth and AI Assistant",
    version="1.0.0"
)

# Enable CORS for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {"message": "Welcome to LuxeStay API", "status": "running"}

app.include_router(auth.router)
app.include_router(rooms.router)
app.include_router(bookings.router)
app.include_router(knowledge.router)
app.include_router(chat.router)
