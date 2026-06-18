"""
main.py — Application entry point
Owner: Omkar25-source

Bootstraps FastAPI, wires CORS, manages database lifespan,
and mounts all APIRouter modules. The SSE orchestration stream
lives here because it owns the real-time event loop.
"""
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from db import init_db, close_pool

# ── Route modules (one per owner) ─────────────────────────────────────────────
from routes import integrations   # PoorvaJawale
from routes import sessions       # PoorvaJawale
from routes import pdf            # avadh-lang
from routes import memory         # Omkar25-source


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start and stop the asyncpg connection pool with the server."""
    await init_db()
    yield
    await close_pool()


app = FastAPI(
    title="AI Founder Orchestration API",
    description="Multi-agent orchestration backend for the Founder OS platform.",
    version="1.0.0",
    lifespan=lifespan,
)

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        os.environ.get("FRONTEND_URL", "http://localhost:3000"),
        "https://founder-orchestration.vercel.app",
        "https://maestroaipao.vercel.app",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Mount routers ─────────────────────────────────────────────────────────────
app.include_router(integrations.router)
app.include_router(sessions.router)
app.include_router(pdf.router)
app.include_router(memory.router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/health", tags=["health"])
async def health():
    """Returns 200 OK when the service is running."""
    return {"status": "ok", "service": "founder-orchestration-api"}
