"""
Supabase client wrapper.

Uses the Supabase Python client for most operations (simple CRUD).
Raw asyncpg is used only for the pgvector cosine similarity query because
the Supabase client doesn't support the <=> operator natively.

IMPORTANT: Always use the Transaction pooler URL (port 6543) from Supabase
dashboard, not the direct connection. Fly.io instances share limited DB
connections and the pooler prevents exhaustion.
"""
from functools import lru_cache
from supabase import create_client, Client


@lru_cache(maxsize=1)
def get_client() -> Client:
    from config import get_settings
    s = get_settings()
    return create_client(s.supabase_url, s.supabase_service_key)


def insert_chunks(chunks: list) -> None:
    """Bulk-insert Chunk objects (with embeddings) into the chunks table."""
    client = get_client()
    rows = [
        {
            "id": str(c.id),
            "document_id": c.document_id,
            "chunk_index": c.chunk_index,
            "text": c.text,
            "page_num": c.page_num,
            "char_start": c.char_start,
            "char_end": c.char_end,
            "token_count": c.token_count,
            "embedding": c.embedding,   # list[float], supabase-py serialises to JSON array
        }
        for c in chunks
    ]
    # Supabase upserts in batches of 500 to stay under payload limits
    batch_size = 500
    for i in range(0, len(rows), batch_size):
        client.table("chunks").upsert(rows[i : i + batch_size]).execute()


async def cosine_search(document_id: str, query_embedding: list[float], top_k: int = 5) -> list[dict]:
    """
    Find the top-k chunks most similar to query_embedding using pgvector's <=> operator.
    Uses asyncpg directly because the Supabase REST API doesn't expose vector operators.
    """
    import asyncpg
    from config import get_settings

    settings = get_settings()
    # Convert list to pgvector wire format: '[0.1,0.2,...]'
    vec_str = "[" + ",".join(str(v) for v in query_embedding) + "]"

    conn = await asyncpg.connect(settings.supabase_direct_url, ssl="require")
    try:
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
    finally:
        await conn.close()

    return [dict(r) for r in rows]
