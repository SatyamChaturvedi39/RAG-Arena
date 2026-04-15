"""
Intelligent router: classifies a query + document and recommends a pipeline.

Decision logic:
  1. Compute structure_score at ingest time (hierarchy_extractor.py)
  2. Classify query type via regex heuristics (fast, zero cost)
     → fall back to a cheap Groq call if regex is inconclusive
  3. Apply decision matrix → RouterOutput with confidence + reasoning

The router is advisory: the UI always runs BOTH pipelines and displays
the recommendation with reasoning. The user can override.
"""
import re
from dataclasses import dataclass

from llm.prompts import QUERY_TYPE_CLASSIFICATION


# ─── Output types ─────────────────────────────────────────────────────────────

@dataclass
class RouterOutput:
    recommended: str        # "vector" | "vectorless"
    confidence: float       # 0.0–1.0
    reasoning: str
    signals: dict


# ─── Query type classification ────────────────────────────────────────────────

_PRECISE_PATTERNS = [
    re.compile(r"\b(what (is|was|were) the (exact|total|net|gross|annual|quarterly))\b", re.I),
    re.compile(r"\b(how much|how many|what amount|what number|what (is|was) the (value|figure|amount))\b", re.I),
    re.compile(r"\b(in \d{4}|for (fiscal|the) year|as of|at the end of)\b", re.I),
    re.compile(r"\b(per share|EPS|EBITDA|revenue|net income|operating income|gross profit|cash flow|diluted)\b", re.I),
    re.compile(r"\b(what (did|does) .{0,30}(earn|report|record|generate))\b", re.I),
]

_FUZZY_PATTERNS = [
    re.compile(r"\b(explain|describe|summarize|summarise|overview|what does .+? mean)\b", re.I),
    re.compile(r"\b(compare|contrast|relationship between|difference between)\b", re.I),
    re.compile(r"\b(what (are|were) the (main|key|primary|major|significant) (risks|factors|reasons|challenges))\b", re.I),
    re.compile(r"\b(why did|why does|why is|how does|how did)\b", re.I),
]

_MULTI_HOP_PATTERNS = [
    re.compile(r"\b(how did .+? (affect|impact|change) .+?)\b", re.I),
    re.compile(r"\b(what (caused|led to) .+? and (how|why))\b", re.I),
    re.compile(r"\b(given .+?, what|if .+?, then what)\b", re.I),
]


def _classify_by_regex(query: str) -> tuple[str, int]:
    """Returns (query_type, match_count). match_count < 1 means uncertain."""
    scores: dict[str, int] = {"precise_factual": 0, "fuzzy_semantic": 0, "multi_hop": 0}

    for p in _PRECISE_PATTERNS:
        if p.search(query):
            scores["precise_factual"] += 1

    for p in _FUZZY_PATTERNS:
        if p.search(query):
            scores["fuzzy_semantic"] += 1

    for p in _MULTI_HOP_PATTERNS:
        if p.search(query):
            scores["multi_hop"] += 1

    best = max(scores, key=scores.get)
    return best, scores[best]


async def classify_query(query: str) -> str:
    """
    Classify query type. Uses regex first; falls back to a cheap Groq call
    only if regex is inconclusive (< 1 match for any category).
    """
    query_type, confidence_count = _classify_by_regex(query)

    if confidence_count >= 1:
        return query_type

    # Regex inconclusive — use LLM
    try:
        from llm.groq_client import chat_json
        result, _, _ = await chat_json(
            messages=[{
                "role": "user",
                "content": QUERY_TYPE_CLASSIFICATION.format(query=query),
            }],
            max_tokens=64,
        )
        return result.get("query_type", "fuzzy_semantic")
    except Exception:
        return "fuzzy_semantic"  # safe default


def classify_doc_type(first_page_text: str, filename: str = "") -> str:
    """
    Rule-based document type classification from filename + first-page text.
    Used during ingestion to set documents.doc_type.
    """
    text_lower = (first_page_text + " " + filename).lower()

    financial_signals = ["annual report", "10-k", "10k", "earnings", "financial statement",
                          "balance sheet", "income statement", "sec filing", "form 10"]
    legal_signals = ["agreement", "contract", "whereas", "terms and conditions",
                     "party of the first", "hereby", "indemnif", "arbitration"]
    technical_signals = ["abstract", "methodology", "algorithm", "implementation",
                          "technical specification", "api reference", "architecture"]

    def count(signals): return sum(1 for s in signals if s in text_lower)

    scores = {
        "financial": count(financial_signals),
        "legal": count(legal_signals),
        "technical": count(technical_signals),
    }
    best = max(scores, key=scores.get)
    return best if scores[best] >= 1 else "general"


# ─── Decision matrix ──────────────────────────────────────────────────────────

def recommend(
    structure_score: float,
    doc_type: str,
    query_type: str,
) -> RouterOutput:
    """
    Apply decision matrix and return a RouterOutput.

    Matrix logic (in priority order):
      1. Low structure → force vector (tree navigation unreliable)
      2. High structure + precise factual → vectorless (tree wins on lookups)
      3. High structure + fuzzy semantic → vector (embedding better for semantic)
      4. Medium structure + precise + financial → vectorless (likely 10-K)
      5. Multi-hop → vector (cross-section reasoning benefits from embeddings)
      6. Default → vector (safer fallback)
    """
    signals = {
        "structure_score": structure_score,
        "doc_type": doc_type,
        "query_type": query_type,
    }

    # Rule 1: poor structure forces vector regardless
    if structure_score < 0.35:
        return RouterOutput(
            recommended="vector",
            confidence=1.0,
            reasoning=(
                f"Document has low structural clarity (score: {structure_score:.2f}). "
                "Tree navigation is unreliable — vector similarity search is the safe choice."
            ),
            signals=signals,
        )

    # Rule 2: high structure + precise factual
    if structure_score >= 0.65 and query_type == "precise_factual":
        return RouterOutput(
            recommended="vectorless",
            confidence=0.85,
            reasoning=(
                f"Well-structured document (score: {structure_score:.2f}) + precise factual query. "
                "Tree navigation will locate the exact section without embedding noise from short section titles."
            ),
            signals=signals,
        )

    # Rule 3: high structure + fuzzy/semantic
    if structure_score >= 0.65 and query_type == "fuzzy_semantic":
        return RouterOutput(
            recommended="vector",
            confidence=0.70,
            reasoning=(
                f"Well-structured document (score: {structure_score:.2f}), but the query is semantic/explanatory. "
                "Embedding similarity handles fuzzy meaning-matching better than tree traversal."
            ),
            signals=signals,
        )

    # Rule 4: medium structure + precise + financial doc
    if 0.35 <= structure_score < 0.65 and query_type == "precise_factual" and doc_type == "financial":
        return RouterOutput(
            recommended="vectorless",
            confidence=0.60,
            reasoning=(
                f"Financial document with moderate structure (score: {structure_score:.2f}) and specific factual query. "
                "Likely a 10-K or similar with implicit hierarchy — tree navigation has a reasonable chance of locating the figure."
            ),
            signals=signals,
        )

    # Rule 5: multi-hop
    if query_type == "multi_hop":
        return RouterOutput(
            recommended="vector",
            confidence=0.65,
            reasoning=(
                "Multi-hop query requires combining information across sections. "
                "Embedding retrieval can surface multiple relevant passages from different parts of the document."
            ),
            signals=signals,
        )

    # Rule 6: medium structure + general doc → vector
    if doc_type == "general":
        return RouterOutput(
            recommended="vector",
            confidence=0.75,
            reasoning=(
                "General/unstructured document. "
                "Vector similarity is the reliable default for documents without clear professional structure."
            ),
            signals=signals,
        )

    # Default: lean toward vector for safety
    return RouterOutput(
        recommended="vector",
        confidence=0.55,
        reasoning=(
            f"Mixed signals (structure: {structure_score:.2f}, doc_type: {doc_type}, query: {query_type}). "
            "Defaulting to vector RAG as the more robust baseline."
        ),
        signals=signals,
    )
