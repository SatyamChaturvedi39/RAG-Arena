import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from config import get_settings
from api.documents import router as documents_router
from api.queries import router as queries_router
from api.eval import router as eval_router
from api.metrics import router as metrics_router
from api.feedback import router as feedback_router

# ─── Logging setup ────────────────────────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-7s | %(name)s | %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger("rag_arena")

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup ──────────────────────────────────────────────────────────────
    logger.info("Starting RAG-Arena API v0.2.0")

    # Verify Supabase REST connectivity
    from db.supabase_client import get_client
    try:
        client = get_client()
        client.table("documents").select("id").limit(1).execute()
        logger.info("Supabase REST client: connected ✓")
    except Exception as e:
        logger.warning("Supabase REST client: connection check failed — %s", e)

    # Initialize asyncpg connection pool
    from db.supabase_client import init_pool
    try:
        await init_pool()
    except Exception as e:
        logger.warning("asyncpg pool: failed to initialize — %s", e)

    yield

    # ── Shutdown ─────────────────────────────────────────────────────────────
    from db.supabase_client import close_pool
    await close_pool()
    logger.info("RAG-Arena API shut down cleanly")


app = FastAPI(
    title="RAG-Arena API",
    description="Side-by-side benchmarking for Vector RAG vs Vectorless RAG",
    version="0.2.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── Request ID middleware ────────────────────────────────────────────────────

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


# ─── Global exception handler ────────────────────────────────────────────────

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    req_id = getattr(request.state, "request_id", "unknown")
    logger.error("Unhandled error [%s]: %s", req_id, exc, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error. Please try again.", "request_id": req_id},
    )


# ─── Routers ─────────────────────────────────────────────────────────────────

app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(queries_router,   prefix="/query",     tags=["query"])
app.include_router(eval_router,      prefix="/eval",      tags=["eval"])
app.include_router(metrics_router,   prefix="/metrics",   tags=["metrics"])
app.include_router(feedback_router,  prefix="/feedback",  tags=["feedback"])


# ─── Health endpoints ────────────────────────────────────────────────────────

@app.api_route("/ping", methods=["GET", "HEAD"], tags=["health"])
async def ping():
    """Lightweight liveness probe — no external calls. Used by UptimeRobot."""
    return {"status": "ok"}


@app.api_route("/health", methods=["GET", "HEAD"], tags=["health"])
async def health():
    """
    Deep health check. Only checks Supabase DB — Groq/Gemini are checked at query
    time to avoid burning free-tier rate limits on every UptimeRobot ping.
    """
    status: dict = {"status": "ok", "version": "0.2.0"}

    try:
        from db.supabase_client import get_client
        client = get_client()
        client.table("documents").select("id").limit(1).execute()
        status["db"] = "connected"
    except Exception as e:
        status["db"] = f"error: {e}"
        status["status"] = "degraded"

    return status
