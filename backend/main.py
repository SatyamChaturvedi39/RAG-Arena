import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from api.documents import router as documents_router
from api.queries import router as queries_router
from api.eval import router as eval_router
from api.metrics import router as metrics_router

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: verify external service connectivity
    from db.supabase_client import get_client
    client = get_client()
    # Lightweight connectivity check — just instantiate the client
    yield
    # Shutdown: nothing to clean up (connections are pooled externally)


app = FastAPI(
    title="RAG-Arena API",
    description="Side-by-side benchmarking for Vector RAG vs Vectorless RAG",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(documents_router, prefix="/documents", tags=["documents"])
app.include_router(queries_router,   prefix="/query",     tags=["query"])
app.include_router(eval_router,      prefix="/eval",      tags=["eval"])
app.include_router(metrics_router,   prefix="/metrics",   tags=["metrics"])


@app.api_route("/ping", methods=["GET", "HEAD"], tags=["health"])
async def ping():
    """Lightweight liveness probe — no external calls. Used by UptimeRobot."""
    return {"status": "ok"}


@app.api_route("/health", methods=["GET", "HEAD"], tags=["health"])
async def health():
    """
    Deep health check. UptimeRobot pings /ping; /health runs full connectivity checks.
    """
    status: dict = {"status": "ok", "version": "0.1.0"}

    # Check Supabase reachability
    try:
        from db.supabase_client import get_client
        client = get_client()
        # Ping with a lightweight query
        result = client.table("documents").select("id").limit(1).execute()
        status["db"] = "connected"
    except Exception as e:
        status["db"] = f"error: {e}"
        status["status"] = "degraded"

    # Check Groq reachability
    try:
        from llm.groq_client import check_groq
        await check_groq()
        status["groq"] = "reachable"
    except Exception as e:
        status["groq"] = f"error: {e}"
        status["status"] = "degraded"

    # Check Gemini reachability
    try:
        from ingestion.embedder import check_gemini
        await check_gemini()
        status["gemini"] = "reachable"
    except Exception as e:
        status["gemini"] = f"error: {e}"
        status["status"] = "degraded"

    return status
