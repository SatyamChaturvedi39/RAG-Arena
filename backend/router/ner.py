"""
Axis 2 of the Deterministic Dual-Axis Router.

Computes Named Entity Density D(q) and Syntactic Query Type (SQT) flag
using regex patterns — no ML model, no external NER library.

Decision (applied by dual_axis_router.py):
    if D(q) > THETA_2 or SQT → VECTORLESS
    otherwise                 → VECTOR

Thresholds are imported from ``router.router_config`` (single source of
truth).  Provisional THETA_2 = 0.15 — replace with output of
calibration/calibrate.py once experiments are complete.
"""
from __future__ import annotations

import re

from router.router_config import THETA_2

# ── NE Detection Patterns ─────────────────────────────────────────────────────

# Pattern 1: Capitalised multi-word phrases not at sentence start
# Matches 1-4 consecutive capitalised words that appear after at least one char
_CAP_PROPER_NOUN = re.compile(
    r"(?<!\A)(?<=[a-z\s,;:.?!])\s([A-Z][a-zA-Z'-]{1,30}"
    r"(?:\s+[A-Z][a-zA-Z'-]{1,30}){0,3})"
)

# Pattern 2a: Dates — DD/MM/YYYY, MM-DD-YYYY, Month YYYY, YYYY alone
_DATE_PATTERN = re.compile(
    r"\b(?:\d{1,2}[/\-]\d{1,2}[/\-]\d{2,4}|"
    r"\d{4}|"
    r"(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|"
    r"Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|"
    r"Dec(?:ember)?)\s+\d{4})\b",
    re.IGNORECASE,
)

# Pattern 2b: Version numbers — v1.2, 3.4.1, 2.0.0-alpha
_VERSION_PATTERN = re.compile(
    r"\bv?\d{1,3}\.\d{1,3}(?:\.\d{1,4})?(?:-[a-zA-Z]+)?\b",
    re.IGNORECASE,
)

# Pattern 2c: Currency amounts — $1,234 / €500 / £1.2M
_CURRENCY_PATTERN = re.compile(
    r"[$€£¥₹]\s*\d[\d,]*(?:\.\d+)?(?:\s*[KMBkmbTt])?\b"
)

# Pattern 2d: Percentages — 12.5%
_PERCENT_PATTERN = re.compile(r"\b\d+(?:\.\d+)?\s*%")

# Pattern 2e: Plain numbers used as identifiers (3+ digits)
_NUMERIC_ID_PATTERN = re.compile(r"\b\d{3,}\b")

# Pattern 3a: ALL_CAPS tokens of 2+ characters (e.g. "WHO", "NASA", "PMID")
_ALLCAPS_PATTERN = re.compile(r"\b[A-Z][A-Z0-9_]{1,}\b")

# Pattern 3b: camelCase identifiers (at least one lower→upper transition)
_CAMEL_PATTERN = re.compile(r"\b[a-z][a-z0-9]*(?:[A-Z][a-z0-9]+)+\b")

# Pattern 3c: DOI patterns — 10.XXXX/...
_DOI_PATTERN = re.compile(r"\b10\.\d{4,}/\S+\b")

# Pattern 3d: ISBN patterns — ISBN followed by 10 or 13 digits
_ISBN_PATTERN = re.compile(
    r"\bISBN[-\s]?(?:\d[-\s]?){9,12}\d\b", re.IGNORECASE
)

# Pattern 3e: PMID patterns — PMID followed by digits
_PMID_PATTERN = re.compile(r"\bPMID\s*\d{6,9}\b", re.IGNORECASE)

# Pattern 3f: CVE patterns — CVE-YYYY-NNNNN
_CVE_PATTERN = re.compile(r"\bCVE-\d{4}-\d{4,}\b", re.IGNORECASE)

# Pattern 3g: Product codes / model numbers — alphanumeric with hyphens
# e.g. GTX-3090, ICD-10, A320-neo, RX-7900
_PRODUCT_CODE_PATTERN = re.compile(
    r"\b[A-Z]{1,5}[-]?\d{1,5}(?:[-][A-Z0-9]+)?\b"
)

# Pattern 4: Section / Clause / Article / Chapter references
_SECTION_REF_PATTERN = re.compile(
    r"\b(?:Section|Clause|Article|Chapter|Appendix|Exhibit|Schedule|"
    r"Annex|Part|Item)\s+[\dA-Z][\d.A-Z]*\b",
    re.IGNORECASE,
)


# ── Structured lookup patterns (for SQT check) ────────────────────────────────

# Backtick code syntax
_BACKTICK_PATTERN = re.compile(r"`[^`]+`")

# Field=value patterns
_FIELD_VALUE_EQ_PATTERN = re.compile(r"\[[\w\s]+\]\s*=")

# Field:value patterns (colon syntax)
_FIELD_VALUE_COLON_PATTERN = re.compile(r"\b\w+\s*:\s*\w+")

# Standard identifiers: PMID, ISBN, DOI, RFC, CVE
_STD_ID_PATTERN = re.compile(r"\b(?:PMID|ISBN|DOI|RFC|CVE)\b")

# Section-followed-by-number
_SECTION_NUM_PATTERN = re.compile(
    r"\b(?:Section|Clause|Article|Chapter|Appendix|Exhibit|Item)\s+[\d.]+\b",
    re.IGNORECASE,
)

# Code token patterns: snake_case identifiers, dot.notation
_CODE_TOKEN_PATTERN = re.compile(r"\b[a-z_]\w*(?:_\w+)+\b")
_DOT_NOTATION_PATTERN = re.compile(r"\b\w+\.\w+\.\w+\b")

# SQL / programming field names
_SQL_FIELD_PATTERN = re.compile(
    r"\b(?:SELECT|FROM|WHERE|JOIN|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b",
    re.IGNORECASE,
)


# ── Public Functions ──────────────────────────────────────────────────────────

def extract_named_entities(query: str) -> list[str]:
    """
    Detect named entities in the query using regex patterns.

    Detects:
    1. Capitalised proper nouns (not at sentence start)
    2. Numeric identifiers (dates, versions, currencies, percentages)
    3. Code identifiers (ALL_CAPS 2+, camelCase, DOI, ISBN, PMID, CVE)
    4. Product codes / model numbers
    5. Section references (Section X, Clause Y, etc.)

    Returns list of matched entity strings (deduplicated, order preserved).
    """
    entities: list[str] = []

    # Pattern 1: Capitalised proper nouns after sentence start
    for m in _CAP_PROPER_NOUN.finditer(query):
        text = m.group(1).strip()
        if text:
            entities.append(text)

    # Pattern 2: Numeric identifiers
    for pattern in (_DATE_PATTERN, _VERSION_PATTERN,
                    _CURRENCY_PATTERN, _PERCENT_PATTERN):
        for m in pattern.finditer(query):
            entities.append(m.group(0).strip())

    # Pattern 3: Code and catalogue identifiers
    for pattern in (_ALLCAPS_PATTERN, _CAMEL_PATTERN,
                    _DOI_PATTERN, _ISBN_PATTERN, _PMID_PATTERN,
                    _CVE_PATTERN, _PRODUCT_CODE_PATTERN):
        for m in pattern.finditer(query):
            entities.append(m.group(0).strip())

    # Pattern 4: Section references
    for m in _SECTION_REF_PATTERN.finditer(query):
        entities.append(m.group(0).strip())

    # Deduplicate while preserving order
    seen: set[str] = set()
    unique: list[str] = []
    for e in entities:
        if e and e not in seen:
            seen.add(e)
            unique.append(e)

    return unique


def compute_entity_density(query: str) -> float:
    """
    Compute the Named Entity Density D(q) of the query.

    D(q) = (sum of token counts of all detected entities) / total tokens

    Entity detection combines two approaches:
    1. Regex patterns (capitalized proper nouns, codes, dates, etc.)
    2. High-surprisal tokens: alphabetic tokens that are rare in the Norvig
       corpus (surprisal > 17 bits, i.e. count < ~10M occurrences). These
       are typically technical/medical/scientific terms that appear in
       lowercase form and would be missed by capitalization-based patterns.

    Returns 0.0 for empty queries.
    """
    tokens = re.findall(r"\S+", query)
    if not tokens:
        return 0.0

    # Approach 1: regex-detected named entities
    entities = extract_named_entities(query)
    entity_tokens: set[str] = set()
    for e in entities:
        for t in e.split():
            entity_tokens.add(t.lower())

    # Approach 2: high-surprisal token detection (technical/medical terms)
    # Import corpus lazily to avoid circular import
    try:
        from router.entropy import _COUNTS, _N_TOTAL
        import math
        _HIGH_SURPRISAL_THRESHOLD = 17.0  # bits; ~10M occurrences in corpus
        alpha_tokens = re.findall(r"[a-zA-Z]{3,}", query)
        for tok in alpha_tokens:
            tok_lower = tok.lower()
            count = _COUNTS.get(tok_lower)
            if count and count > 0:
                surprisal = math.log2(_N_TOTAL) - math.log2(count)
                if surprisal > _HIGH_SURPRISAL_THRESHOLD:
                    entity_tokens.add(tok_lower)
            elif not count:
                # OOV token — maximum surprisal, definitely a technical term
                entity_tokens.add(tok_lower)
    except Exception:
        pass  # if entropy module unavailable, fall back to regex only

    # Count tokens that are entities
    all_tokens = re.findall(r"[a-zA-Z]+", query)
    if not all_tokens:
        return 0.0
    entity_token_count = sum(1 for t in all_tokens if t.lower() in entity_tokens)

    return round(entity_token_count / len(tokens), 4)


def compute_sqt_flag(query: str) -> bool:
    """
    Syntactic Query Type (SQT) binary flag.

    Returns True if the query contains ANY of:
    - Section/structural references (Section X, Clause Y, etc.)
    - Catalogue lookup patterns (ISBN, DOI, PMID, CVE, RFC)
    - Field-value lookup phrasing (field=value, field:value, [field]=value)
    - Code token patterns (snake_case, dot.notation, SQL keywords)
    - Backtick code syntax

    Returns False otherwise.
    """
    if _BACKTICK_PATTERN.search(query):
        return True
    if _FIELD_VALUE_EQ_PATTERN.search(query):
        return True
    if _STD_ID_PATTERN.search(query):
        return True
    if _SECTION_NUM_PATTERN.search(query):
        return True
    if _CODE_TOKEN_PATTERN.search(query):
        return True
    if _DOT_NOTATION_PATTERN.search(query):
        return True
    if _SQL_FIELD_PATTERN.search(query):
        return True
    return False


# Keep backward-compatible alias
is_structured_lookup = compute_sqt_flag


def use_vectorless(
    query: str,
    ned_threshold: float | None = None,
) -> bool:
    """
    Returns True (use vectorless RAG) when:
      - Named entity density > ned_threshold, OR
      - Query is a structured lookup (SQT = True)
    Returns False (use vector RAG) otherwise.
    """
    if ned_threshold is None:
        ned_threshold = THETA_2
    ned = compute_entity_density(query)
    if ned > ned_threshold:
        return True
    if compute_sqt_flag(query):
        return True
    return False
