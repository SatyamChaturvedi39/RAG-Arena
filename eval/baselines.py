"""
Baseline routing strategies for the DDAR eval system.

Operates in SIMULATION MODE for open-domain benchmarks (NQ, TriviaQA, SQuAD,
ASQA, BioASQ) — we have no retrieval corpus for these benchmarks so we measure:
  1. Routing behaviour (which system decided what and how often)
  2. Parametric answer quality (what Groq 70B answers from knowledge)

This is the correct methodology for a routing study: isolate the router's
signal from confounds introduced by retrieval corpus quality.

Four baselines:
  standard_rag   — always routes to vector (embedding for every query)
  adaptive_rag   — uses existing RAG-Arena classifier, always embeds
  embedding_free — always routes to vectorless (never embeds)
  dual_axis      — our Deterministic Dual-Axis Router (DDAR)
"""
from __future__ import annotations

from collections.abc import Callable
import sys
from pathlib import Path

# Allow imports from backend/ when running from repo root
_BACKEND = Path(__file__).resolve().parent.parent / "backend"
if str(_BACKEND) not in sys.path:
    sys.path.insert(0, str(_BACKEND))


def standard_rag_route(query: str) -> dict:
    """
    Standard RAG baseline: always vector retrieval.
    Embedding is always used — 100% EO%.
    """
    return {
        "decision":       "vector",
        "embedding_used": True,
        "reasoning":      "Standard RAG: always embed and retrieve.",
    }


def adaptive_rag_route(query: str) -> dict:
    """
    Adaptive-RAG baseline: uses the existing RAG-Arena classifier.

    If classifier yields precise_factual → label as "vectorless"
    (Adaptive-RAG would skip multi-hop retrieval for simple lookups).
    All other types → "vector".

    NOTE: Adaptive-RAG still embeds retrieved queries (embedding_used=True)
    regardless of the routing decision. This is the key difference from DDAR
    which can skip embedding entirely via the PARAMETRIC path.
    """
    import asyncio

    async def _classify() -> str:
        from router.classifier import classify_query
        return await classify_query(query)

    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Inside async context (shouldn't happen in CLI runner, but guard anyway)
            import concurrent.futures
            with concurrent.futures.ThreadPoolExecutor() as pool:
                future = pool.submit(asyncio.run, _classify())
                query_type = future.result(timeout=10)
        else:
            query_type = loop.run_until_complete(_classify())
    except Exception:
        query_type = "fuzzy_semantic"

    decision = "vectorless" if query_type == "precise_factual" else "vector"

    return {
        "decision":       decision,
        "embedding_used": True,   # Adaptive-RAG always embeds
        "reasoning":      f"Adaptive-RAG: query_type={query_type} → {decision} (always embeds).",
    }


def embedding_free_route(query: str) -> dict:
    """
    Embedding-free baseline: always vectorless tree navigation.
    No embedding API calls — 0% EO%.
    """
    return {
        "decision":       "vectorless",
        "embedding_used": False,
        "reasoning":      "Embedding-Free: always vectorless, no embeddings.",
    }


def dual_axis_route(query: str) -> dict:
    """
    DDAR baseline: Deterministic Dual-Axis Router.
    May route to PARAMETRIC (no retrieval), VECTOR, or VECTORLESS.
    """
    from router.dual_axis_router import route
    d = route(query)
    return {
        "decision":       d["route"],
        "embedding_used": d["route"] == "vector",
        "reasoning":      d["reason"],
    }


# ── Dispatch table ────────────────────────────────────────────────────────────

ROUTE_FNS: dict[str, Callable[[str], dict]] = {
    "standard_rag":    standard_rag_route,
    "adaptive_rag":    adaptive_rag_route,
    "embedding_free":  embedding_free_route,
    "dual_axis":       dual_axis_route,
}
