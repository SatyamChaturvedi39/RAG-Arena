"""
All LLM prompt templates as module-level constants.
Keeping prompts here (not inline in pipeline code) makes them easy to
iterate on without touching business logic.
"""

# ─── Router ───────────────────────────────────────────────────────────────────

QUERY_TYPE_CLASSIFICATION = """\
Classify the following query into exactly one category.

Categories:
- precise_factual: asks for a specific number, date, name, or fact (e.g. "What was net revenue in Q3 2023?")
- fuzzy_semantic: asks for explanation, summary, comparison, or opinion (e.g. "What are the main risks?")
- multi_hop: requires combining information from multiple sections (e.g. "How did the revenue change affect the dividend?")

Query: {query}

Respond with JSON only: {{"query_type": "<category>", "reasoning": "<one sentence>"}}"""


# ─── Vectorless RAG: tree navigation ─────────────────────────────────────────

TREE_NAV_ROOT = """\
You are navigating a structured document to answer a query. Your task is to \
select which top-level sections are most likely to contain the answer.

Document: {document_title}
Query: {query}

Top-level sections:
{sections}

Select 1-3 section numbers most likely to contain the answer.
Respond with JSON only: {{"selected": [<numbers>], "reasoning": "<one sentence>"}}"""


TREE_NAV_BRANCH = """\
You are inside section "{parent_title}" of a document, navigating to answer a query.

Query: {query}

Available subsections:
{sections}

Select 1-3 subsection numbers most likely to contain the answer. \
If the current section's content is already sufficient to answer the query, set stop_here to true.
Respond with JSON only: {{"selected": [<numbers>], "stop_here": <true|false>, "reasoning": "<one sentence>"}}"""


TREE_NAV_LEAF_CHECK = """\
Does the following document section contain information to answer this query?
Query: {query}
Section title: {title}
Section preview (first 300 chars): {preview}

Respond with JSON only: {{"relevant": <true|false>}}"""


# ─── Final answer generation ──────────────────────────────────────────────────

VECTOR_RAG_ANSWER = """\
Answer the following query using ONLY the provided document excerpts. \
Be concise and precise. If the answer is not present in the excerpts, \
say exactly: "The answer was not found in the retrieved sections."

Query: {query}

Document excerpts:
{context}

Answer:"""


VECTORLESS_RAG_ANSWER = """\
Answer the following query using ONLY the provided document sections. \
Be concise and precise. If the answer is not present in the sections, \
say exactly: "The answer was not found in the retrieved sections."

Query: {query}

Document sections:
{context}

Answer:"""


# ─── Node summarization (ingest time) ────────────────────────────────────────

NODE_SUMMARY = """\
Write a 1-2 sentence summary of what information this document section contains. \
Focus on what topics or data points a reader would find here.

Section title: {title}
Section text (first 800 chars): {text_preview}

Summary:"""


# ─── Vectorless fallback (low-structure documents) ───────────────────────────

WINDOW_RELEVANCE_CHECK = """\
Is the following document passage relevant to answering this query?
Query: {query}
Passage: {passage}

Respond with JSON only: {{"relevant": <true|false>}}"""
