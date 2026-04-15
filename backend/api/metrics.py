from fastapi import APIRouter
from db.supabase_client import get_client

router = APIRouter()


@router.get("/summary")
async def metrics_summary(days: int = 7):
    """
    Aggregate stats for the dashboard: win rates, avg latency, query distribution.
    """
    client = get_client()

    # Total queries in the window
    queries_result = (
        client.table("queries")
        .select("id,query_type,router_recommended", count="exact")
        .gte("created_at", f"now() - interval '{days} days'")
        .execute()
    )
    queries = queries_result.data or []
    total = queries_result.count or 0

    router_counts = {"vector": 0, "vectorless": 0}
    query_type_counts: dict[str, int] = {}
    for q in queries:
        rec = q.get("router_recommended")
        if rec in router_counts:
            router_counts[rec] += 1
        qt = q.get("query_type") or "unknown"
        query_type_counts[qt] = query_type_counts.get(qt, 0) + 1

    # Avg latency per pipeline
    results = (
        client.table("pipeline_results")
        .select("pipeline,latency_ms")
        .gte("created_at", f"now() - interval '{days} days'")
        .execute()
    ).data or []

    latencies: dict[str, list[int]] = {"vector": [], "vectorless": []}
    for r in results:
        p = r.get("pipeline")
        if p in latencies and r.get("latency_ms"):
            latencies[p].append(r["latency_ms"])

    def avg(lst): return int(sum(lst) / len(lst)) if lst else 0

    return {
        "total_queries": total,
        "router_recommendation_distribution": router_counts,
        "avg_vector_latency_ms": avg(latencies["vector"]),
        "avg_vectorless_latency_ms": avg(latencies["vectorless"]),
        "queries_by_type": query_type_counts,
    }


@router.get("/history")
async def metrics_history(limit: int = 100, pipeline: str = None):
    """
    Time-series points for the latency chart.
    """
    client = get_client()
    query = (
        client.table("pipeline_results")
        .select("created_at,latency_ms,pipeline")
        .order("created_at", desc=True)
        .limit(limit)
    )
    if pipeline:
        query = query.eq("pipeline", pipeline)

    result = query.execute()
    return {"points": result.data or []}
