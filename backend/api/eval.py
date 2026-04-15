import asyncio
import uuid
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, HTTPException
from pydantic import BaseModel

from db.supabase_client import get_client

router = APIRouter()


class EvalRunRequest(BaseModel):
    dataset: str                        # "financebench" | "custom"
    document_ids: Optional[list[str]] = None
    max_questions: int = 50
    session_tag: Optional[str] = None


@router.post("/run")
async def start_eval_run(req: EvalRunRequest, background_tasks: BackgroundTasks):
    if req.dataset not in ("financebench", "custom"):
        raise HTTPException(status_code=400, detail="dataset must be 'financebench' or 'custom'")

    client = get_client()
    run_id = str(uuid.uuid4())
    client.table("evaluation_runs").insert({
        "id": run_id,
        "dataset_name": req.dataset,
        "status": "running",
        "notes": req.session_tag,
    }).execute()

    background_tasks.add_task(_run_eval, run_id, req)
    return {"eval_run_id": run_id, "status": "started"}


@router.get("/runs")
async def list_eval_runs():
    client = get_client()
    result = client.table("evaluation_runs").select("*").order("run_at", desc=True).execute()
    return result.data or []


@router.get("/runs/{run_id}")
async def get_eval_run(run_id: str):
    client = get_client()
    run = client.table("evaluation_runs").select("*").eq("id", run_id).single().execute()
    if not run.data:
        raise HTTPException(status_code=404, detail="Eval run not found.")

    # Fetch per-question results via pipeline_results + queries joined
    results = (
        client.table("queries")
        .select("id,query_text,query_type,router_recommended,pipeline_results(pipeline,answer,f1_score,exact_match,latency_ms)")
        .eq("session_id", run_id)
        .execute()
    )
    return {"run": run.data, "question_results": results.data or []}


async def _run_eval(run_id: str, req: EvalRunRequest):
    """Background task: runs the eval suite and writes aggregate metrics."""
    import sys, os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "eval"))

    from eval.financebench_runner import run_financebench
    from eval.metrics import compute_aggregate

    client = get_client()
    try:
        results = await run_financebench(
            run_id=run_id,
            max_questions=req.max_questions,
            document_ids=req.document_ids,
        )
        agg = compute_aggregate(results)
        client.table("evaluation_runs").update({
            "status": "completed",
            "total_questions": agg["total"],
            "vector_f1_mean": agg["vector_f1"],
            "vectorless_f1_mean": agg["vectorless_f1"],
            "vector_em_rate": agg["vector_em"],
            "vectorless_em_rate": agg["vectorless_em"],
            "vector_latency_p50": agg["vector_p50"],
            "vectorless_latency_p50": agg["vectorless_p50"],
            "vector_latency_p95": agg["vector_p95"],
            "vectorless_latency_p95": agg["vectorless_p95"],
            "router_accuracy": agg["router_accuracy"],
        }).eq("id", run_id).execute()
    except Exception as e:
        client.table("evaluation_runs").update({
            "status": "failed",
            "notes": str(e)[:500],
        }).eq("id", run_id).execute()
        raise
