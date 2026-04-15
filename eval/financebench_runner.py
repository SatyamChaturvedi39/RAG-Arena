"""
FinanceBench evaluation runner.

Dataset: PatronusAI/financebench on HuggingFace
  - 150 QA pairs over public financial documents (10-Ks, 10-Qs, earnings releases)
  - Each question has a ground-truth answer + source document

This runner:
1. Loads the dataset from HuggingFace (requires `datasets` package)
2. For each question, calls POST /query/compare via the API
3. Computes F1 + exact match against ground truth
4. Writes per-question results to pipeline_results table
5. Returns results list for aggregate computation

Rate limit handling: sleeps 10s between questions to respect Groq TPM limits.
At 50 questions × 10s = ~8 minutes minimum. Plan eval runs as background jobs.

Custom dataset runner (run_custom):
- Reads eval/data/custom_dataset.json
- Same pipeline/DB logic, no HuggingFace dependency
- Matches questions to uploaded documents by doc_name substring
"""
import asyncio
import json
import sys
import os
from typing import Optional

# Add backend to path when running standalone
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "backend"))

from eval.metrics import token_f1, exact_match

_CUSTOM_DATASET_PATH = os.path.join(os.path.dirname(__file__), "data", "custom_dataset.json")


async def run_financebench(
    run_id: str,
    max_questions: int = 50,
    document_ids: Optional[list[str]] = None,
) -> list[dict]:
    """
    Run FinanceBench evaluation.
    Returns list of per-question result dicts for aggregate computation.
    """
    try:
        from datasets import load_dataset
    except ImportError:
        raise ImportError(
            "Run: pip install datasets\n"
            "The HuggingFace datasets library is required for FinanceBench."
        )

    dataset = load_dataset("PatronusAI/financebench", split="train")
    questions = list(dataset)[:max_questions]

    from db.supabase_client import get_client
    from pipelines.vector_rag import run_vector_rag
    from pipelines.vectorless_rag import run_vectorless_rag
    from router.classifier import classify_query, recommend, classify_doc_type

    client = get_client()
    results = []

    for i, item in enumerate(questions):
        query = item.get("question", "")
        ground_truth = item.get("answer", "")
        doc_name = item.get("doc_name", "")

        # Find the matching document in our DB (matched by filename substring)
        doc_result = None
        if document_ids:
            for did in document_ids:
                doc = client.table("documents").select("id,doc_type,structure_score").eq("id", did).single().execute()
                if doc.data:
                    doc_result = doc.data
                    break
        else:
            docs = (
                client.table("documents")
                .select("id,filename,doc_type,structure_score,status")
                .eq("status", "ready")
                .ilike("filename", f"%{doc_name[:20]}%")
                .limit(1)
                .execute()
            )
            if docs.data:
                doc_result = docs.data[0]

        if not doc_result:
            # Skip questions where we don't have the document
            continue

        doc_id = doc_result["id"]

        try:
            # Run both pipelines
            v_result, vl_result = await asyncio.gather(
                run_vector_rag(doc_id, query),
                run_vectorless_rag(doc_id, query),
            )

            query_type = await classify_query(query)
            router = recommend(
                structure_score=doc_result.get("structure_score") or 0.0,
                doc_type=doc_result.get("doc_type") or "financial",
                query_type=query_type,
            )

            v_f1 = token_f1(v_result.answer, ground_truth)
            vl_f1 = token_f1(vl_result.answer, ground_truth)

            # Write per-question results to pipeline_results for UI display
            import uuid
            query_id = str(uuid.uuid4())
            client.table("queries").insert({
                "id": query_id,
                "document_id": doc_id,
                "query_text": query,
                "query_type": query_type,
                "router_recommended": router.recommended,
                "router_confidence": router.confidence,
                "session_id": run_id,
            }).execute()

            for pipeline, result, f1 in [
                ("vector", v_result, v_f1),
                ("vectorless", vl_result, vl_f1),
            ]:
                client.table("pipeline_results").insert({
                    "query_id": query_id,
                    "pipeline": pipeline,
                    "answer": result.answer,
                    "latency_ms": result.latency_ms,
                    "llm_prompt_tokens": result.llm_prompt_tokens,
                    "llm_completion_tokens": result.llm_completion_tokens,
                    "f1_score": f1,
                    "exact_match": exact_match(result.answer, ground_truth),
                }).execute()

            results.append({
                "question": query,
                "ground_truth": ground_truth,
                "vector_answer": v_result.answer,
                "vectorless_answer": vl_result.answer,
                "vector_latency_ms": v_result.latency_ms,
                "vectorless_latency_ms": vl_result.latency_ms,
                "vector_f1": v_f1,
                "vectorless_f1": vl_f1,
                "router_recommended": router.recommended,
            })

        except Exception as e:
            print(f"[eval] Question {i} failed: {e}")
            continue

        # Rate-limit pause: ~7 LLM calls per question, Groq 30 RPM free tier
        # Sleep 10s between questions to stay under limits during batch eval
        await asyncio.sleep(10)

    return results


async def run_custom(
    run_id: str,
    max_questions: int = 50,
    document_ids: Optional[list[str]] = None,
) -> list[dict]:
    """
    Run evaluation on eval/data/custom_dataset.json.
    No HuggingFace dependency — useful for smoke-testing with hand-crafted QA pairs.

    Dataset format (array of objects):
      { "question": str, "answer": str, "doc_name": str, "doc_type": str }

    doc_name is matched against documents.filename via ILIKE '%doc_name[:20]%'.
    """
    with open(_CUSTOM_DATASET_PATH, encoding="utf-8") as f:
        raw = json.load(f)

    # Strip meta-comment entries (keys starting with "_")
    questions = [item for item in raw if "question" in item][:max_questions]

    if not questions:
        raise ValueError(
            "custom_dataset.json contains no QA entries. "
            "Add objects with 'question', 'answer', 'doc_name' keys."
        )

    from db.supabase_client import get_client
    from pipelines.vector_rag import run_vector_rag
    from pipelines.vectorless_rag import run_vectorless_rag
    from router.classifier import classify_query, recommend

    client = get_client()
    results = []

    for i, item in enumerate(questions):
        query = item.get("question", "")
        ground_truth = item.get("answer", "")
        doc_name = item.get("doc_name", "")

        # Resolve document from DB
        doc_result = None
        if document_ids:
            for did in document_ids:
                doc = client.table("documents").select("id,doc_type,structure_score").eq("id", did).single().execute()
                if doc.data:
                    doc_result = doc.data
                    break
        else:
            docs = (
                client.table("documents")
                .select("id,filename,doc_type,structure_score,status")
                .eq("status", "ready")
                .ilike("filename", f"%{doc_name[:20]}%")
                .limit(1)
                .execute()
            )
            if docs.data:
                doc_result = docs.data[0]

        if not doc_result:
            print(f"[eval/custom] Skipping question {i}: no matching document for '{doc_name}'")
            continue

        doc_id = doc_result["id"]

        try:
            v_result, vl_result = await asyncio.gather(
                run_vector_rag(doc_id, query),
                run_vectorless_rag(doc_id, query),
            )

            query_type = await classify_query(query)
            router = recommend(
                structure_score=doc_result.get("structure_score") or 0.0,
                doc_type=doc_result.get("doc_type") or item.get("doc_type") or "general",
                query_type=query_type,
            )

            v_f1 = token_f1(v_result.answer, ground_truth)
            vl_f1 = token_f1(vl_result.answer, ground_truth)

            import uuid
            query_id = str(uuid.uuid4())
            client.table("queries").insert({
                "id": query_id,
                "document_id": doc_id,
                "query_text": query,
                "query_type": query_type,
                "router_recommended": router.recommended,
                "router_confidence": router.confidence,
                "session_id": run_id,
            }).execute()

            for pipeline, result, f1 in [
                ("vector", v_result, v_f1),
                ("vectorless", vl_result, vl_f1),
            ]:
                client.table("pipeline_results").insert({
                    "query_id": query_id,
                    "pipeline": pipeline,
                    "answer": result.answer,
                    "latency_ms": result.latency_ms,
                    "llm_prompt_tokens": result.llm_prompt_tokens,
                    "llm_completion_tokens": result.llm_completion_tokens,
                    "f1_score": f1,
                    "exact_match": exact_match(result.answer, ground_truth),
                }).execute()

            results.append({
                "question": query,
                "ground_truth": ground_truth,
                "vector_answer": v_result.answer,
                "vectorless_answer": vl_result.answer,
                "vector_latency_ms": v_result.latency_ms,
                "vectorless_latency_ms": vl_result.latency_ms,
                "vector_f1": v_f1,
                "vectorless_f1": vl_f1,
                "router_recommended": router.recommended,
            })

        except Exception as e:
            print(f"[eval/custom] Question {i} failed: {e}")
            continue

        # Same rate-limit pause as FinanceBench runner
        await asyncio.sleep(10)

    return results
