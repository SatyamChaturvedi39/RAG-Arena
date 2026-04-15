"""
Generates 1-2 sentence summaries for internal (non-leaf) tree nodes.

Why: During tree navigation, the LLM sees node titles + summaries to decide
which branch to explore. Short summaries are much cheaper to include in the
navigation prompt than full section text. They're generated once at ingest
and cached in document_tree.summary — never regenerated.

Uses llama-3.1-8b-instant (nav model) since this is a cheap summarisation
task and we want to minimize Groq token consumption during ingestion.
"""
import asyncio

from ingestion.tree_builder import TreeNode
from llm.prompts import NODE_SUMMARY


async def summarize_internal_nodes(
    nodes: list[TreeNode],
    batch_size: int = 10,
) -> list[TreeNode]:
    """
    Generate summaries for all non-leaf nodes.
    Leaf nodes have their raw text — they don't need summaries.
    Internal nodes only get a summary if they have text content.

    Processes in small concurrent batches to respect Groq TPM limits.
    """
    from config import get_settings
    settings = get_settings()

    internal_with_text = [
        n for n in nodes
        if not n.is_leaf and n.text and len(n.text.strip()) > 50
    ]

    if not internal_with_text:
        return nodes

    sem = asyncio.Semaphore(batch_size)

    async def summarize_one(node: TreeNode) -> None:
        async with sem:
            text_preview = node.text[:800] if node.text else ""
            prompt = NODE_SUMMARY.format(
                title=node.title,
                text_preview=text_preview,
            )
            from llm.groq_client import chat
            summary, _, _ = await chat(
                messages=[{"role": "user", "content": prompt}],
                model=settings.groq_nav_model,
                max_tokens=80,
                temperature=0.0,
            )
            node.summary = summary.strip()
            # Small delay to respect Groq TPM limits during bulk ingestion
            await asyncio.sleep(0.2)

    await asyncio.gather(*[summarize_one(n) for n in internal_with_text])
    return nodes
