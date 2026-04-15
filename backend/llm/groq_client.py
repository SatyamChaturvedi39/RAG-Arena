"""
Async Groq client with automatic retry on rate-limit (429) and transient errors.

Two model tiers:
  - NAV model  (llama-3.1-8b-instant):   routing + tree navigation (fast, cheap)
  - ANSWER model (llama-3.3-70b-versatile): final answer generation (quality)
"""
import asyncio
import json
from typing import Any

from groq import AsyncGroq
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)


def _get_client() -> AsyncGroq:
    from config import get_settings
    return AsyncGroq(api_key=get_settings().groq_api_key)


@retry(
    retry=retry_if_exception_type(Exception),
    wait=wait_exponential(multiplier=1, min=2, max=30),
    stop=stop_after_attempt(4),
    reraise=True,
)
async def chat(
    messages: list[dict],
    model: str | None = None,
    temperature: float = 0.0,
    max_tokens: int = 1024,
    response_format: dict | None = None,
) -> tuple[str, int, int]:
    """
    Send a chat completion request.
    Returns (content_str, prompt_tokens, completion_tokens).
    temperature=0 for all routing/navigation to keep decisions deterministic.
    """
    from config import get_settings
    if model is None:
        model = get_settings().groq_nav_model

    kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }
    if response_format:
        kwargs["response_format"] = response_format

    client = _get_client()
    response = await client.chat.completions.create(**kwargs)
    content = response.choices[0].message.content or ""
    usage = response.usage
    return content, usage.prompt_tokens, usage.completion_tokens


async def chat_json(
    messages: list[dict],
    model: str | None = None,
    max_tokens: int = 512,
) -> tuple[dict, int, int]:
    """
    Like chat() but enforces JSON output mode and parses the response.
    Returns (parsed_dict, prompt_tokens, completion_tokens).
    """
    content, pt, ct = await chat(
        messages=messages,
        model=model,
        max_tokens=max_tokens,
        response_format={"type": "json_object"},
    )
    try:
        return json.loads(content), pt, ct
    except json.JSONDecodeError as e:
        raise ValueError(f"Groq returned non-JSON: {content[:200]}") from e


async def check_groq() -> None:
    """Lightweight connectivity check used by /health endpoint."""
    from config import get_settings
    client = _get_client()
    # List models — doesn't consume tokens
    await client.models.list()
