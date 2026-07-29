"""
Supabase client wrapper.

Uses the Supabase Python client for most operations (simple CRUD).
Raw asyncpg is used only for the pgvector cosine similarity query because
the Supabase client doesn't support the <=> operator natively.

Connection pooling: asyncpg pool is created once at startup and reused
across all requests. This prevents connection exhaustion under load.

IMPORTANT: Always use the Transaction pooler URL (port 6543) from Supabase
dashboard, not the direct connection. Fly.io instances share limited DB
connections and the pooler prevents exhaustion.
"""
import logging
from functools import lru_cache
from typing import Optional

import asyncpg
from supabase import create_client, Client

logger = logging.getLogger(__name__)

# ─── Supabase REST client (CRUD operations) ──────────────────────────────────

@lru_cache(maxsize=1)
def get_client() -> Client:
    from config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


# ─── asyncpg connection pool (pgvector operations) ───────────────────────────

_pool: Optional[asyncpg.Pool] = None


async def init_pool() -> None:
    """Create the asyncpg connection pool. Called once at application startup."""
    global _pool
    if _pool is not None:
        return

    from config import get_settings
    settings = get_settings()

    logger.info("Creating asyncpg connection pool → %s", settings.supabase_direct_url[:40] + "...")
    _pool = await asyncpg.create_pool(
        dsn=settings.supabase_direct_url,
        ssl="require",
        min_size=1,
        max_size=5,
        command_timeout=30,
    )
    logger.info("asyncpg pool created (min=1, max=5)")


async def close_pool() -> None:
    """Close the asyncpg connection pool. Called at application shutdown."""
    global _pool
    if _pool:
        await _pool.close()
        _pool = None
        logger.info("asyncpg pool closed")


# ─── Chunk operations ────────────────────────────────────────────────────────

async def insert_chunks(chunks: list) -> None:
    """Bulk-insert Chunk objects (with embeddings) into the chunks table using pooled asyncpg."""
    global _pool
    if _pool is None:
        await init_pool()

    rows = []
    for c in chunks:
        # Convert embedding float list to pgvector string format: '[0.1, 0.2, ...]'
        if hasattr(c, "embedding") and c.embedding:
            vec_str = "[" + ",".join(str(v) for v in c.embedding) + "]"
        else:
            vec_str = None

        rows.append((
            str(c.id),
            str(c.document_id),
            c.chunk_index,
            c.text,
            c.page_num,
            c.char_start,
            c.char_end,
            c.token_count,
            vec_str,
        ))

    async with _pool.acquire() as conn:
        await conn.executemany(
            """
            INSERT INTO chunks (id, document_id, chunk_index, text, page_num, char_start, char_end, token_count, embedding)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector)
            ON CONFLICT (document_id, chunk_index)
            DO UPDATE SET
                text = EXCLUDED.text,
                page_num = EXCLUDED.page_num,
                char_start = EXCLUDED.char_start,
                char_end = EXCLUDED.char_end,
                token_count = EXCLUDED.token_count,
                embedding = EXCLUDED.embedding;
            """,
            rows
        )
    logger.info("Inserted %d chunks into DB", len(rows))


async def cosine_search(document_id: str, query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """
    Find the top-k chunks most similar to query_embedding using pgvector's <=> operator.
    Uses the asyncpg connection pool for efficient connection reuse.
    """
    global _pool

    # Fallback: create pool if not initialized (e.g. during testing)
    if _pool is None:
        await init_pool()

    # Convert list to pgvector wire format: '[0.1,0.2,...]'
    vec_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    async with _pool.acquire() as conn:
        rows = await conn.fetch(
            """
            SELECT id, text, page_num, char_start, char_end,
                   1 - (embedding <=> $1::vector) AS similarity
            FROM chunks
            WHERE document_id = $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3
            """,
            vec_str,
            document_id,
            top_k,
        )

    logger.debug("cosine_search: doc=%s, top_k=%d, results=%d", document_id[:8], top_k, len(rows))
    return [dict(r) for r in rows]
