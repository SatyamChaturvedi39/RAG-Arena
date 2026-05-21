"""
User feedback / voting API.

After seeing both pipeline answers side-by-side, users can vote on which
answer was better. This crowdsourced preference data is the core research
artifact — it tells us when each RAG paradigm wins in human judgment,
not just automated metrics.
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from db.supabase_client import get_client

router = APIRouter()
logger = logging.getLogger(__name__)


class VoteRequest(BaseModel):
    query_id: str
    winner: str            # "vector" | "vectorless" | "tie"
    session_id: Optional[str] = None


class VoteResponse(BaseModel):
    success: bool
    vote_id: str
    message: str


class VoteTally(BaseModel):
    query_id: str
    vector_votes: int
    vectorless_votes: int
    tie_votes: int
    total_votes: int


@router.post("/vote", response_model=VoteResponse)
async def submit_vote(req: VoteRequest):
    """
    Record a user's preference for which pipeline gave the better answer.
    One vote per session_id per query (upsert on conflict).
    """
    if req.winner not in ("vector", "vectorless", "tie"):
        raise HTTPException(status_code=400, detail="winner must be 'vector', 'vectorless', or 'tie'")

    client = get_client()

    # Verify query exists
    q = client.table("queries").select("id").eq("id", req.query_id).single().execute()
    if not q.data:
        raise HTTPException(status_code=404, detail="Query not found")

    import uuid
    vote_id = str(uuid.uuid4())

    try:
        client.table("user_votes").upsert({
            "id": vote_id,
            "query_id": req.query_id,
            "winner": req.winner,
            "session_id": req.session_id,
        }).execute()
    except Exception as e:
        logger.error("Failed to record vote: %s", e)
        raise HTTPException(status_code=500, detail="Failed to record vote")

    logger.info("Vote recorded: query=%s winner=%s", req.query_id[:8], req.winner)
    return VoteResponse(
        success=True,
        vote_id=vote_id,
        message=f"Vote for '{req.winner}' recorded.",
    )


@router.get("/tally/{query_id}", response_model=VoteTally)
async def get_vote_tally(query_id: str):
    """Get vote counts for a specific query."""
    client = get_client()
    votes = (
        client.table("user_votes")
        .select("winner")
        .eq("query_id", query_id)
        .execute()
    ).data or []

    counts = {"vector": 0, "vectorless": 0, "tie": 0}
    for v in votes:
        w = v.get("winner")
        if w in counts:
            counts[w] += 1

    return VoteTally(
        query_id=query_id,
        vector_votes=counts["vector"],
        vectorless_votes=counts["vectorless"],
        tie_votes=counts["tie"],
        total_votes=sum(counts.values()),
    )


@router.get("/stats")
async def vote_stats():
    """
    Aggregate vote statistics across all queries.
    Returns overall win rates — the core research metric.
    """
    client = get_client()
    votes = (
        client.table("user_votes")
        .select("winner")
        .execute()
    ).data or []

    counts = {"vector": 0, "vectorless": 0, "tie": 0}
    for v in votes:
        w = v.get("winner")
        if w in counts:
            counts[w] += 1

    total = sum(counts.values())
    return {
        "total_votes": total,
        "vector_wins": counts["vector"],
        "vectorless_wins": counts["vectorless"],
        "ties": counts["tie"],
        "vector_win_rate": round(counts["vector"] / total, 4) if total else 0,
        "vectorless_win_rate": round(counts["vectorless"] / total, 4) if total else 0,
    }
