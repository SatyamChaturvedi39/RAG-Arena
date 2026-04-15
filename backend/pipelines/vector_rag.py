"""
Vector RAG pipeline.

Retrieve: embed query → cosine search in pgvector → top-k chunks
Generate: stuff chunks into prompt → Groq llama-3.3-70b-versatile
"""
import time

from api.queries import ChunkContext, PipelineResult
from db.supabase_client import cosine_search
from ingestion.embedder import embed_query
from llm import groq_client
from llm.prompts import VECTOR_RAG_ANSWER


async def run_vector_rag(document_id: str, query: str) -> PipelineResult:
    from config import get_settings
    settings = get_settings()

    t0 = time.monotonic()

    # 1. Embed the query
    query_embedding = await embed_query(query)

    # 2. Cosine similarity search
    raw_chunks = await cosine_search(document_id, query_embedding, top_k=settings.top_k)

    if not raw_chunks:
        return PipelineResult(
            answer="No relevant content found in the document for this query.",
            latency_ms=int((time.monotonic() - t0) * 1000),
            llm_prompt_tokens=0,
            llm_completion_tokens=0,
            chunks=[],
        )

    # 3. Build context string
    context_parts = []
    for i, c in enumerate(raw_chunks, 1):
        page_ref = f" (page {c['page_num'] + 1})" if c.get("page_num") is not None else ""
        context_parts.append(f"[Excerpt {i}{page_ref}]\n{c['text']}")
    context = "\n\n---\n\n".join(context_parts)

    prompt = VECTOR_RAG_ANSWER.format(query=query, context=context)

    # 4. Generate answer
    answer, prompt_tokens, completion_tokens = await groq_client.chat(
        messages=[{"role": "user", "content": prompt}],
        model=settings.groq_answer_model,
        temperature=0.1,
        max_tokens=512,
    )

    latency_ms = int((time.monotonic() - t0) * 1000)

    chunks = [
        ChunkContext(
            text=c["text"],
            page=c.get("page_num"),
            similarity=round(float(c.get("similarity", 0)), 4),
        )
        for c in raw_chunks
    ]

    return PipelineResult(
        answer=answer.strip(),
        latency_ms=latency_ms,
        llm_prompt_tokens=prompt_tokens,
        llm_completion_tokens=completion_tokens,
        chunks=chunks,
    )
