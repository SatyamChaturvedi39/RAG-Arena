import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.supabase_client import get_client

router = APIRouter()


# ─── Request / Response models ────────────────────────────────────────────────

class CompareRequest(BaseModel):
    document_id: str
    query: str
    override_pipeline: Optional[str] = None  # "vector" | "vectorless" | None
    session_id: Optional[str] = None


class ChunkContext(BaseModel):
    text: str
    page: Optional[int]
    similarity: float


class PipelineResult(BaseModel):
    answer: str
    latency_ms: int
    llm_prompt_tokens: int
    llm_completion_tokens: int
    # Vector-specific
    chunks: Optional[list[ChunkContext]] = None
    # Vectorless-specific
    navigation_path: Optional[str] = None
    nodes_visited_count: Optional[int] = None
    fallback_used: Optional[bool] = None
    error: Optional[str] = None


class RouterOutput(BaseModel):
    recommended: str
    confidence: float
    reasoning: str
    signals: dict


class CompareResponse(BaseModel):
    query_id: str
    router: RouterOutput
    vector: PipelineResult
    vectorless: PipelineResult


# ─── Endpoints ────────────────────────────────────────────────────────────────

@router.post("/compare", response_model=CompareResponse)
async def compare(req: CompareRequest):
    """
    Runs BOTH pipelines in parallel and returns side-by-side results.
    The router recommendation is advisory — the UI always shows both.
    """
    client = get_client()

    # Verify document is ready
    doc_result = (
        client.table("documents")
        .select("id,status,doc_type,structure_score")
        .eq("id", req.document_id)
        .single()
        .execute()
    )
    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc = doc_result.data
    if doc["status"] != "ready":
        raise HTTPException(status_code=400, detail=f"Document is not ready (status: {doc['status']}). Wait for ingestion to complete.")

    # Route
    from router.classifier import classify_query, recommend
    query_type = await classify_query(req.query)
    router_output = recommend(
        structure_score=doc.get("structure_score") or 0.0,
        doc_type=doc.get("doc_type") or "general",
        query_type=query_type,
    )

    # Log the query
    import uuid
    query_id = str(uuid.uuid4())
    client.table("queries").insert({
        "id": query_id,
        "document_id": req.document_id,
        "query_text": req.query,
        "query_type": query_type,
        "router_recommended": router_output.recommended,
        "router_confidence": router_output.confidence,
        "router_reasoning": router_output.reasoning,
        "router_signals": router_output.signals,
        "user_override": req.override_pipeline or "none",
        "session_id": req.session_id,
    }).execute()

    # Run both pipelines in parallel
    from pipelines.vector_rag import run_vector_rag
    from pipelines.vectorless_rag import run_vectorless_rag

    vector_task = asyncio.create_task(
        _safe_run(run_vector_rag, req.document_id, req.query)
    )
    vectorless_task = asyncio.create_task(
        _safe_run(run_vectorless_rag, req.document_id, req.query)
    )

    vector_result, vectorless_result = await asyncio.gather(vector_task, vectorless_task)

    # Persist results
    for pipeline, result in [("vector", vector_result), ("vectorless", vectorless_result)]:
        payload: dict = {
            "query_id": query_id,
            "pipeline": pipeline,
            "answer": result.answer,
            "latency_ms": result.latency_ms,
            "llm_prompt_tokens": result.llm_prompt_tokens,
            "llm_completion_tokens": result.llm_completion_tokens,
        }
        if pipeline == "vector" and result.chunks:
            payload["top_similarity_score"] = result.chunks[0].similarity if result.chunks else None
        if pipeline == "vectorless":
            payload["navigation_path"] = result.navigation_path
            payload["navigation_depth"] = result.nodes_visited_count
            payload["fallback_used"] = result.fallback_used or False
        client.table("pipeline_results").insert(payload).execute()

    return CompareResponse(
        query_id=query_id,
        router=RouterOutput(**router_output.__dict__),
        vector=vector_result,
        vectorless=vectorless_result,
    )


@router.post("/vector", response_model=PipelineResult)
async def query_vector(req: CompareRequest):
    _check_doc_ready(req.document_id)
    from pipelines.vector_rag import run_vector_rag
    return await run_vector_rag(req.document_id, req.query)


@router.post("/vectorless", response_model=PipelineResult)
async def query_vectorless(req: CompareRequest):
    _check_doc_ready(req.document_id)
    from pipelines.vectorless_rag import run_vectorless_rag
    return await run_vectorless_rag(req.document_id, req.query)


@router.get("/{query_id}")
async def get_query(query_id: str):
    client = get_client()
    q = client.table("queries").select("*").eq("id", query_id).single().execute()
    if not q.data:
        raise HTTPException(status_code=404, detail="Query not found.")
    results = client.table("pipeline_results").select("*").eq("query_id", query_id).execute()
    return {"query": q.data, "results": results.data or []}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _check_doc_ready(doc_id: str):
    client = get_client()
    result = client.table("documents").select("status").eq("id", doc_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    if result.data["status"] != "ready":
        raise HTTPException(status_code=400, detail="Document is not ready.")


async def _safe_run(fn, doc_id: str, query: str) -> PipelineResult:
    """Wraps a pipeline run so one failure doesn't cancel the other."""
    try:
        return await fn(doc_id, query)
    except Exception as e:
        return PipelineResult(
            answer=f"[Pipeline error: {e}]",
            latency_ms=0,
            llm_prompt_tokens=0,
            llm_completion_tokens=0,
            error=str(e),
        )
