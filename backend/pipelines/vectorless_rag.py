"""
Vectorless RAG pipeline.

Navigate: LLM reads the document tree top-down, picks branches, narrows to leaves.
Generate: stuff retrieved leaf text into prompt → Groq llama-3.3-70b-versatile

Navigation is depth-first guided search:
  - At each level, LLM picks 1-3 child nodes to explore
  - Max depth = settings.max_nav_depth (default 3)
  - Circuit breaker: if >max_nav_calls LLM calls or >nav_timeout_seconds,
    fall back to returning the top-3 root-level sections directly

For documents with structure_score < 0.35, the fallback uses sliding-window
binary relevance scoring (see _fallback_retrieve).
"""
import asyncio
import time
from typing import Optional

from api.queries import PipelineResult
from db.tree_store import get_children, get_leaf_texts, get_root_nodes
from llm import groq_client
from llm.prompts import (
    TREE_NAV_ROOT,
    TREE_NAV_BRANCH,
    VECTORLESS_RAG_ANSWER,
    WINDOW_RELEVANCE_CHECK,
)


async def run_vectorless_rag(document_id: str, query: str) -> PipelineResult:
    from config import get_settings
    settings = get_settings()

    t0 = time.monotonic()
    total_prompt_tokens = 0
    total_completion_tokens = 0
    nav_calls = 0
    nav_path_parts: list[str] = []
    fallback_used = False

    # ── 1. Fetch root nodes ───────────────────────────────────────────────────
    root_nodes = get_root_nodes(document_id)
    if not root_nodes:
        return PipelineResult(
            answer="Document tree is empty. The document may not have been indexed for vectorless RAG.",
            latency_ms=int((time.monotonic() - t0) * 1000),
            llm_prompt_tokens=0,
            llm_completion_tokens=0,
            fallback_used=False,
        )

    # ── 2. Navigate the tree ──────────────────────────────────────────────────
    leaf_ids: list[str] = []

    async def navigate(nodes: list[dict], parent_title: str, depth: int) -> None:
        nonlocal nav_calls, total_prompt_tokens, total_completion_tokens

        if depth > settings.max_nav_depth:
            # Depth limit: collect all leaf nodes at this level
            for n in nodes:
                if n.get("is_leaf"):
                    leaf_ids.append(n["id"])
            return

        if nav_calls >= settings.max_nav_calls:
            # Circuit breaker: collect all leaves at this level and stop
            for n in nodes:
                if n.get("is_leaf"):
                    leaf_ids.append(n["id"])
            return

        elapsed = time.monotonic() - t0
        if elapsed > settings.nav_timeout_seconds:
            for n in nodes:
                if n.get("is_leaf"):
                    leaf_ids.append(n["id"])
            return

        # Build section list for the prompt
        section_lines = "\n".join(
            f"{i+1}. [{n['title']}] {n.get('summary', '').strip()}"
            for i, n in enumerate(nodes)
        )

        if depth == 0:
            # Root prompt: include document title context
            doc_title = nodes[0].get("title", "Document") if nodes else "Document"
            prompt = TREE_NAV_ROOT.format(
                document_title=doc_title,
                query=query,
                sections=section_lines,
            )
        else:
            prompt = TREE_NAV_BRANCH.format(
                parent_title=parent_title,
                query=query,
                sections=section_lines,
            )

        nav_calls += 1
        try:
            result, pt, ct = await groq_client.chat_json(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=256,
            )
            total_prompt_tokens += pt
            total_completion_tokens += ct
        except Exception:
            # If navigation LLM call fails, fall back to all nodes at this level
            for n in nodes:
                if n.get("is_leaf"):
                    leaf_ids.append(n["id"])
            return

        selected_indices = result.get("selected", [])
        stop_here = result.get("stop_here", False)

        if not selected_indices:
            selected_indices = [1]  # default to first if LLM returns empty

        # Clamp to valid range
        selected_indices = [i for i in selected_indices if 1 <= i <= len(nodes)]
        if not selected_indices:
            selected_indices = [1]

        selected_nodes = [nodes[i - 1] for i in selected_indices]

        # Add to nav path breadcrumb
        nav_path_parts.append(" / ".join(n["title"] for n in selected_nodes))

        for node in selected_nodes:
            if stop_here or node.get("is_leaf"):
                leaf_ids.append(node["id"])
            else:
                # Fetch children and recurse
                children = get_children(document_id, parent_id=node["id"])
                if children:
                    await navigate(children, node["title"], depth + 1)
                else:
                    # No children found — treat as leaf
                    leaf_ids.append(node["id"])

    await navigate(root_nodes, "", 0)

    # ── 3. Retrieve leaf text ─────────────────────────────────────────────────
    leaf_data = get_leaf_texts(document_id, leaf_ids) if leaf_ids else []

    if not leaf_data:
        # Full fallback: sliding window relevance scoring
        fallback_used = True
        leaf_data = await _fallback_retrieve(document_id, query)
        total_prompt_tokens += sum(r.get("_pt", 0) for r in leaf_data)
        total_completion_tokens += sum(r.get("_ct", 0) for r in leaf_data)

    # ── 4. Generate answer ────────────────────────────────────────────────────
    context_parts = []
    nodes_visited_count = nav_calls

    for leaf in leaf_data:
        page_ref = ""
        if leaf.get("page_start") is not None:
            page_ref = f" (page {leaf['page_start'] + 1})"
        context_parts.append(f"[{leaf['title']}{page_ref}]\n{leaf.get('text', '')}")

    context = "\n\n---\n\n".join(context_parts) if context_parts else "No relevant sections found."
    prompt = VECTORLESS_RAG_ANSWER.format(query=query, context=context)

    from config import get_settings as _gs
    answer_model = _gs().groq_answer_model

    answer, pt, ct = await groq_client.chat(
        messages=[{"role": "user", "content": prompt}],
        model=answer_model,
        temperature=0.1,
        max_tokens=512,
    )
    total_prompt_tokens += pt
    total_completion_tokens += ct

    latency_ms = int((time.monotonic() - t0) * 1000)
    navigation_path = " → ".join(nav_path_parts) if nav_path_parts else "root"

    return PipelineResult(
        answer=answer.strip(),
        latency_ms=latency_ms,
        llm_prompt_tokens=total_prompt_tokens,
        llm_completion_tokens=total_completion_tokens,
        navigation_path=navigation_path,
        nodes_visited_count=nodes_visited_count,
        fallback_used=fallback_used,
    )


async def _fallback_retrieve(document_id: str, query: str) -> list[dict]:
    """
    Low-structure fallback: fetch all leaf nodes, score each with a binary
    relevance LLM call, return top-3 relevant ones.
    Used when tree navigation produces no leaves (e.g. structure_score < 0.35).
    """
    from db.supabase_client import get_client

    client = get_client()
    leaves = (
        client.table("document_tree")
        .select("id,title,text,page_start,page_end")
        .eq("document_id", document_id)
        .eq("is_leaf", True)
        .limit(50)   # cap to avoid burning Groq TPM
        .execute()
    ).data or []

    if not leaves:
        return []

    relevant: list[dict] = []
    tasks = []

    async def check_one(leaf: dict) -> Optional[dict]:
        if not leaf.get("text"):
            return None
        preview = leaf["text"][:300]
        prompt = WINDOW_RELEVANCE_CHECK.format(query=query, passage=preview)
        try:
            result, pt, ct = await groq_client.chat_json(
                messages=[{"role": "user", "content": prompt}],
                max_tokens=16,
            )
            if result.get("relevant"):
                leaf["_pt"] = pt
                leaf["_ct"] = ct
                return leaf
        except Exception:
            pass
        return None

    results = await asyncio.gather(*[check_one(leaf) for leaf in leaves])
    relevant = [r for r in results if r is not None][:3]
    return relevant
