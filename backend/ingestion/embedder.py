"""
Async Gemini embedding client.

Free tier limits:
  - 100 RPM (requests per minute)
  - 1500 RPD (requests per day)
  - Batch size: up to 100 texts per request

Rate-limiting strategy:
  - asyncio.Semaphore(2) limits concurrent batch requests
  - At ~2-3 sec per batch call, this stays well under 100 RPM
  - We batch 100 chunks per call → 15 batch calls max per day (1500 RPD / 100)
  - At 100 chunks/batch that's 1500 chunks max per day (~3 medium-size docs)

IMPORTANT: Never re-embed chunks that are already in the DB.
The insert_chunks() in supabase_client uses upsert with the unique(document_id, chunk_index)
constraint, so re-running ingestion is safe, but embedder.py should not be called
for chunks that already have embeddings.
"""
import asyncio
from typing import Optional

import google.generativeai as genai
from tenacity import retry, stop_after_attempt, wait_exponential

from ingestion.chunker import Chunk


def _configure():
    from config import get_settings
    genai.configure(api_key=get_settings().gemini_api_key)


@retry(
    wait=wait_exponential(multiplier=1, min=3, max=60),
    stop=stop_after_attempt(4),
    reraise=True,
)
def _embed_batch_sync(texts: list[str], model: str) -> list[list[float]]:
    """
    Synchronous batch embedding call (Gemini SDK is sync-only).
    Wrapped with retry for transient 429/503 errors.
    """
    result = genai.embed_content(
        model=model,
        content=texts,
        task_type="retrieval_document",
    )
    return result["embedding"]


async def embed_chunks(
    chunks: list[Chunk],
    batch_size: Optional[int] = None,
) -> list[Chunk]:
    """
    Embed all chunks in parallel batches.
    Fills chunk.embedding in-place and returns the same list.
    """
    from config import get_settings
    settings = get_settings()
    _configure()

    bs = batch_size or settings.embed_batch_size
    model = settings.gemini_embed_model
    sem = asyncio.Semaphore(settings.embed_batch_semaphore)

    async def embed_batch(batch: list[Chunk]) -> None:
        async with sem:
            texts = [c.text for c in batch]
            # Run sync SDK call in executor to avoid blocking the event loop
            embeddings = await asyncio.get_event_loop().run_in_executor(
                None, _embed_batch_sync, texts, model
            )
            for chunk, emb in zip(batch, embeddings):
                chunk.embedding = emb

    batches = [chunks[i : i + bs] for i in range(0, len(chunks), bs)]
    await asyncio.gather(*[embed_batch(b) for b in batches])
    return chunks


async def embed_query(query: str) -> list[float]:
    """
    Embed a single query string for retrieval (uses retrieval_query task type).
    """
    from config import get_settings
    _configure()
    model = get_settings().gemini_embed_model

    result = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: genai.embed_content(
            model=model,
            content=query,
            task_type="retrieval_query",
        ),
    )
    return result["embedding"]


async def check_gemini() -> None:
    """Lightweight connectivity check used by /health endpoint."""
    _configure()
    # Embed a tiny string — uses <1 quota unit
    await embed_query("health check")
