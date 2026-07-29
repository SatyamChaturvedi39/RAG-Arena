import asyncio
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from db.supabase_client import get_client
from router import dual_axis_router

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
    dual_axis_result: dict


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
        .select("id,status,doc_type")
        .eq("id", req.document_id)
        .single()
        .execute()
    )
    if not doc_result.data:
        raise HTTPException(status_code=404, detail="Document not found.")
    doc = doc_result.data
    if doc["status"] != "ready":
        raise HTTPException(status_code=400, detail=f"Document is not ready (status: {doc['status']}). Wait for ingestion to complete.")

    # ── Deterministic Dual-Axis Router (DDAR) ─────────────────────────────────
    # This is the ONLY routing function called. Its result drives both the DB
    # record and the API response. The old classifier is NOT consulted here.
    duar_dict = dual_axis_router.route(req.query)

    # ── Query-type label (metadata only, NOT used in routing) ─────────────────
    # classify_query is kept solely to tag the DB row with a human-readable
    # label (precise_factual / fuzzy_semantic / multi_hop). It has zero
    # influence on which pipeline is chosen.
    from router.classifier import classify_query
    try:
        query_type = await classify_query(req.query)
    except Exception:
        query_type = "unknown"

    # Log the query
    import uuid
    query_id = str(uuid.uuid4())
    client.table("queries").insert({
        "id": query_id,
        "document_id": req.document_id,
        "query_text": req.query,
        "query_type": query_type,
        # router_recommended / reasoning come from DDAR, not the old classifier
        "router_recommended": duar_dict["route"],
        "router_confidence": 1.0,   # DDAR is deterministic — confidence is always 1
        "router_reasoning": duar_dict["reason"],
        "router_signals": {
            "s_q": duar_dict["s_q"],
            "d_q": duar_dict["d_q"],
            "sqt": duar_dict["sqt"],
            "axis_triggered": duar_dict["axis_triggered"],
        },
        "user_override": req.override_pipeline or "none",
        "session_id": req.session_id,
        "dual_axis_result": duar_dict,
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

    # Build a RouterOutput-compatible dict from DDAR for the frontend
    ddar_router_output = RouterOutput(
        recommended=duar_dict["route"],
        confidence=1.0,
        reasoning=duar_dict["reason"],
        signals={
            "s_q": duar_dict["s_q"],
            "d_q": duar_dict["d_q"],
            "sqt": duar_dict["sqt"],
            "axis_triggered": duar_dict["axis_triggered"],
            "theta_1": duar_dict["theta_1"],
            "theta_2": duar_dict["theta_2"],
        },
    )

    return CompareResponse(
        query_id=query_id,
        router=ddar_router_output,
        vector=vector_result,
        vectorless=vectorless_result,
        dual_axis_result=duar_dict,
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


@router.get("/route-preview")
async def route_preview(
    q: str = Query(..., description="Query string to preview routing for — no DB write, no pipeline execution."),
):
    """
    Preview the Dual-Axis Router decision for a query without running any pipeline
    or writing to the database. Useful for testing and debugging the DDAR.

    Returns:
        {
          "query": "...",
          "routing_decision": { ...full router dict... },
          "explanation": "Human-readable sentence explaining the decision"
        }
    """
    decision = dual_axis_router.route(q)

    # Build human-readable explanation from the routing signals
    route_name = decision["route"]
    s_q = decision["s_q"]
    theta_1 = decision["theta_1"]
    theta_2 = decision["theta_2"]

    if route_name == "parametric":
        explanation = (
            f"Query has mean token surprisal of {s_q:.1f} bits, which is below "
            f"the threshold of {theta_1} bits, so retrieval is skipped and the "
            f"language model answers directly from its training knowledge."
        )
    elif route_name == "vectorless":
        d_q = decision["d_q"]
        sqt = decision["sqt"]
        parts = []
        if d_q is not None and d_q > theta_2:
            parts.append(f"entity density of {d_q:.3f} (above threshold {theta_2})")
        if sqt:
            parts.append("a structural/catalogue lookup pattern was detected")
        detail = " and ".join(parts) if parts else "entity-dense or structured content"
        explanation = (
            f"Query has mean token surprisal of {s_q:.1f} bits (above threshold "
            f"{theta_1}), so retrieval is needed. The query has {detail}, so "
            f"structural tree navigation (vectorless) is selected."
        )
    else:  # vector
        d_q = decision["d_q"]
        explanation = (
            f"Query has mean token surprisal of {s_q:.1f} bits (above threshold "
            f"{theta_1}), so retrieval is needed. Entity density is {d_q:.3f} "
            f"(at or below threshold {theta_2}) with no structural patterns, so "
            f"semantic embedding search (vector) is selected."
        )

    return {
        "query": q,
        "routing_decision": decision,
        "explanation": explanation,
    }


@router.get("/history/list")
async def query_history(
    document_id: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
):
    """
    Retrieve past queries with their pipeline results.
    Powers the History page in the frontend. Filters by session_id to maintain privacy.
    """
    client = get_client()
    query = (
        client.table("queries")
        .select(
            "id,document_id,query_text,query_type,router_recommended,router_confidence,"
            "router_reasoning,dual_axis_result,created_at,"
            "documents(filename),"
            "pipeline_results(pipeline,answer,latency_ms,llm_prompt_tokens,llm_completion_tokens,"
            "f1_score,exact_match,navigation_path,fallback_used,top_similarity_score)",
            count="exact",
        )
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if document_id:
        query = query.eq("document_id", document_id)
    if session_id:
        query = query.eq("session_id", session_id)

    result = query.execute()
    items = result.data or []
    for item in items:
        doc = item.pop("documents", None)
        if doc and isinstance(doc, dict):
            item["document_filename"] = doc.get("filename")
        else:
            item["document_filename"] = "Unknown Document"

    return {
        "items": items,
        "total": result.count or 0,
    }


@router.delete("/{query_id}")
async def delete_query(query_id: str):
    """
    Delete a query and its cascaded pipeline results/votes.
    """
    client = get_client()
    try:
        client.table("queries").delete().eq("id", query_id).execute()
        return {"success": True, "message": "Query deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to delete query: {e}")


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
