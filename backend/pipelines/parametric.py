"""
Parametric pipeline — answers queries from LLM training knowledge only.

Used when Axis 1 of the Dual-Axis Router determines that retrieval is
unnecessary (low lexical entropy query).  No vector search, no tree
navigation — just a direct Groq call with PARAMETRIC_ANSWER prompt.
"""
from __future__ import annotations

import time

from llm.groq_client import chat
from llm.prompts import PARAMETRIC_ANSWER


async def run_parametric(query: str) -> dict:
    """
    Generate a parametric answer for the given query.

    Uses the answer model from settings (llama-3.3-70b-versatile).
    No document retrieval is performed.

    Returns:
        dict with keys: answer, latency_ms, tokens_used, pipeline,
                        embedding_used, chunks_retrieved
    """
    from config import get_settings
    settings = get_settings()

    start = time.perf_counter()
    prompt = PARAMETRIC_ANSWER.format(query=query)

    answer, prompt_tokens, completion_tokens = await chat(
        messages=[{"role": "user", "content": prompt}],
        model=settings.groq_answer_model,
        temperature=0.1,
        max_tokens=512,
    )

    latency_ms = (time.perf_counter() - start) * 1000

    return {
        "answer":            answer.strip(),
        "latency_ms":        round(latency_ms, 2),
        "tokens_used":       prompt_tokens + completion_tokens,
        "llm_prompt_tokens": prompt_tokens,
        "llm_completion_tokens": completion_tokens,
        "pipeline":          "parametric",
        "embedding_used":    False,
        "chunks_retrieved":  0,
        "retrieval_used":    False,
        "embedding_calls":   0,
    }
