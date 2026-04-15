"""
Async Gemini embedding client using the REST API directly.

Model: gemini-embedding-001 (v1beta, supports embedContent)
Note: text-embedding-004 is NOT available in this API key's quota.
      gemini-embedding-001 outputs 3072 dims by default; we request 768
      via outputDimensionality to match the vector(768) schema column.

Available embedding endpoints (v1beta):
  POST .../models/gemini-embedding-001:embedContent  — single text per call
  No batchEmbedContents — we call embedContent concurrently instead.

Free tier limits (gemini-embedding-001):
  - 100 RPM (requests per minute)
  - 1500 RPD (requests per day)

Rate-limiting strategy:
  - asyncio.Semaphore(embed_batch_semaphore) limits concurrency
  - semaphore(2) at ~0.5-1 sec latency ≈ 120-240 RPM — tenacity retries on 429
"""
import asyncio
from typing import Optional

import httpx
from tenacity import retry, retry_if_exception, stop_after_attempt, wait_exponential

from ingestion.chunker import Chunk

_EMBED_URL = (
    "https://generativelanguage.googleapis.com"
    "/v1beta/models/{model}:embedContent"
)


def _is_retryable(exc: BaseException) -> bool:
    """Retry on 429 (rate limit) and 5xx errors."""
    if isinstance(exc, httpx.HTTPStatusError):
        return exc.response.status_code in (429, 500, 502, 503, 504)
    return isinstance(exc, (httpx.TimeoutException, httpx.NetworkError))


@retry(
    retry=retry_if_exception(_is_retryable),
    wait=wait_exponential(multiplier=1, min=3, max=60),
    stop=stop_after_attempt(5),
    reraise=True,
)
async def _embed_one(
    text: str,
    model: str,
    api_key: str,
    task_type: str,
    output_dim: int,
) -> list[float]:
    """Single embedContent REST call (v1beta)."""
    url = _EMBED_URL.format(model=model)
    payload: dict = {
        "content": {"parts": [{"text": text}]},
        "taskType": task_type,
        "outputDimensionality": output_dim,
    }
    async with httpx.AsyncClient(timeout=30.0) as client:
        resp = await client.post(url, json=payload, params={"key": api_key})
        resp.raise_for_status()
        return resp.json()["embedding"]["values"]


async def embed_chunks(
    chunks: list[Chunk],
    _batch_size: Optional[int] = None,  # kept for API compatibility, unused
) -> list[Chunk]:
    """
    Embed all chunks concurrently (limited by semaphore).
    Fills chunk.embedding in-place and returns the same list.
    """
    from config import get_settings
    settings = get_settings()

    model = settings.gemini_embed_model
    api_key = settings.gemini_api_key
    output_dim = settings.embed_output_dimensions
    sem = asyncio.Semaphore(settings.embed_batch_semaphore)

    async def embed_one_chunk(chunk: Chunk) -> None:
        async with sem:
            chunk.embedding = await _embed_one(
                chunk.text, model, api_key, "RETRIEVAL_DOCUMENT", output_dim
            )

    await asyncio.gather(*[embed_one_chunk(c) for c in chunks])
    return chunks


async def embed_query(query: str) -> list[float]:
    """Embed a single query string for retrieval."""
    from config import get_settings
    settings = get_settings()
    return await _embed_one(
        query,
        settings.gemini_embed_model,
        settings.gemini_api_key,
        "RETRIEVAL_QUERY",
        settings.embed_output_dimensions,
    )


async def check_gemini() -> None:
    """Lightweight connectivity check used by /health endpoint."""
    await embed_query("health check")
