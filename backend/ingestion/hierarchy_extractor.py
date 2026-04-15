"""
Hierarchy extractor: identifies document structure from a parsed PDF.

Three passes applied in priority order:
  Pass 1 — Embedded TOC (doc.get_toc()) — most reliable when present
  Pass 2 — Font/style heuristics        — covers most financial PDFs (10-Ks)
  Pass 3 — Regex patterns               — last resort for plain PDFs

Output is a list of RawSection objects and a structure_score (0.0–1.0).
tree_builder.py converts these into TreeNode objects for DB storage.
"""
import re
import statistics
from dataclasses import dataclass, field
from typing import Optional

from ingestion.pdf_parser import ParsedDocument, FontBlock


# ─── Output types ─────────────────────────────────────────────────────────────

@dataclass
class RawSection:
    title: str
    depth: int              # 0 = top-level, 1 = sub-section, etc.
    page_start: int
    page_end: Optional[int] = None
    text: str = ""          # full text of this section (filled by _assign_text)
    extraction_method: str = "toc"


# ─── Regex patterns for Pass 3 ───────────────────────────────────────────────

_PATTERNS = [
    (0, re.compile(r"^PART\s+[IVX]+\b", re.IGNORECASE)),          # PART I, PART II
    (1, re.compile(r"^Item\s+\d+[A-Za-z]?\.", re.IGNORECASE)),    # Item 1A.
    (1, re.compile(r"^\d+(\.\d+)*\s+[A-Z][A-Z\s]{3,}")),         # 1.2 OVERVIEW
    (2, re.compile(r"^[A-Z][A-Z\s]{8,}$")),                       # ALL CAPS HEADING
]


# ─── Main entry point ─────────────────────────────────────────────────────────

def extract_hierarchy(parsed: ParsedDocument) -> tuple[list[RawSection], float]:
    """
    Returns (sections, structure_score).
    structure_score < 0.35 means the document is too unstructured for
    reliable tree navigation — the router will force vector RAG.
    """
    sections: list[RawSection] = []
    method_used = "none"

    # Pass 1: Embedded TOC
    if len(parsed.toc) >= 3:
        sections = _from_toc(parsed.toc, parsed.pages)
        method_used = "toc"

    # Pass 2: Font heuristics (if TOC was absent or too shallow)
    if len(sections) < 3:
        font_sections = _from_fonts(parsed.pages)
        if len(font_sections) >= len(sections):
            sections = font_sections
            method_used = "font_heuristic"

    # Pass 3: Regex patterns (last resort)
    if len(sections) < 3:
        regex_sections = _from_regex(parsed.pages)
        if len(regex_sections) >= len(sections):
            sections = regex_sections
            method_used = "regex"

    # Assign full text to each section
    if sections:
        _assign_text(sections, parsed.pages)

    score = _compute_structure_score(sections, parsed.page_count, method_used)
    return sections, score


# ─── Pass 1: TOC ──────────────────────────────────────────────────────────────

def _from_toc(toc: list, pages: list) -> list[RawSection]:
    sections: list[RawSection] = []
    for i, entry in enumerate(toc):
        level, title, page = entry[0], entry[1], entry[2]
        page_idx = max(0, page - 1)  # PyMuPDF toc uses 1-indexed pages

        # page_end = start of next entry at same or higher level
        next_page = pages[-1].page_num + 1
        for j in range(i + 1, len(toc)):
            if toc[j][0] <= level:
                next_page = toc[j][2] - 1
                break

        sections.append(RawSection(
            title=title.strip(),
            depth=level - 1,        # TOC levels are 1-indexed; we use 0-indexed depth
            page_start=page_idx,
            page_end=min(next_page - 1, pages[-1].page_num) if next_page else pages[-1].page_num,
            extraction_method="toc",
        ))
    return sections


# ─── Pass 2: Font heuristics ──────────────────────────────────────────────────

def _from_fonts(pages: list) -> list[RawSection]:
    """
    Cluster font sizes to identify heading levels.
    Largest distinct sizes above body text = h1, h2, h3.
    Bold at body size = h4.
    """
    all_blocks: list[FontBlock] = [b for p in pages for b in p.blocks]
    if not all_blocks:
        return []

    # Find body text size = the most common size among long-text spans.
    # Long spans (> 20 chars) reliably represent body text; short spans include
    # headings, page numbers, and labels — we exclude them from the mode calculation.
    long_blocks = [b for b in all_blocks if len(b.text) > 20]
    if not long_blocks:
        return []

    size_counts: dict[float, int] = {}
    for b in long_blocks:
        size_counts[b.size] = size_counts.get(b.size, 0) + 1
    body_size = max(size_counts, key=size_counts.get)

    # Heading sizes: scan ALL blocks (not just long ones) for sizes above body.
    # Short headings like "Item 7A" (9 chars) are legitimately headings — we must
    # include their sizes here or they'd be missed.
    all_sizes = {b.size for b in all_blocks}
    heading_sizes = sorted(
        {s for s in all_sizes if s > body_size + 0.5},
        reverse=True,
    )[:3]   # top 3 distinct sizes = h1, h2, h3

    def depth_for_block(b: FontBlock) -> Optional[int]:
        for i, hs in enumerate(heading_sizes):
            if abs(b.size - hs) < 0.5:
                return i
        if b.is_bold and abs(b.size - body_size) < 0.5 and len(b.text) < 100:
            return len(heading_sizes)   # bold body = h4
        return None

    sections: list[RawSection] = []
    for page in pages:
        for block in page.blocks:
            d = depth_for_block(block)
            if d is not None and block.text.strip():
                sections.append(RawSection(
                    title=block.text.strip(),
                    depth=d,
                    page_start=page.page_num,
                    extraction_method="font_heuristic",
                ))

    # Assign page_end = page_start of the next same/higher section
    for i, s in enumerate(sections):
        for j in range(i + 1, len(sections)):
            if sections[j].depth <= s.depth:
                s.page_end = sections[j].page_start
                break
        if s.page_end is None:
            s.page_end = pages[-1].page_num

    return sections


# ─── Pass 3: Regex ────────────────────────────────────────────────────────────

def _from_regex(pages: list) -> list[RawSection]:
    sections: list[RawSection] = []
    for page in pages:
        for line in page.text.splitlines():
            line = line.strip()
            if not line or len(line) > 120:
                continue
            for depth, pattern in _PATTERNS:
                if pattern.match(line):
                    sections.append(RawSection(
                        title=line,
                        depth=depth,
                        page_start=page.page_num,
                        extraction_method="regex",
                    ))
                    break

    for i, s in enumerate(sections):
        for j in range(i + 1, len(sections)):
            if sections[j].depth <= s.depth:
                s.page_end = sections[j].page_start
                break
        if s.page_end is None:
            s.page_end = pages[-1].page_num

    return sections


# ─── Text assignment ──────────────────────────────────────────────────────────

def _assign_text(sections: list[RawSection], pages: list) -> None:
    """
    Fill section.text with the raw page text spanning page_start..page_end.
    Only leaf sections (no children) will be used as retrieval units, so
    internal nodes don't strictly need text — but we assign it anyway for
    the node summarizer.
    """
    page_text: dict[int, str] = {p.page_num: p.text for p in pages}
    for s in sections:
        start = s.page_start or 0
        end = s.page_end if s.page_end is not None else start
        text_parts = [page_text.get(pn, "") for pn in range(start, end + 1)]
        s.text = "\n\n".join(t for t in text_parts if t).strip()


# ─── Structure score ──────────────────────────────────────────────────────────

def _compute_structure_score(
    sections: list[RawSection],
    total_pages: int,
    method: str,
) -> float:
    """
    Score 0.0–1.0 indicating how well-structured the document is.
    Used by the router to decide whether vectorless RAG is viable.

    Components:
      0.40 — heading coverage (headings per page)
      0.20 — TOC was present (most reliable extraction)
      0.20 — depth variety (document has multiple levels)
      0.20 — leaf text quality (average leaf section length)
    """
    if not sections:
        return 0.0

    heading_density = len(sections) / max(total_pages, 1)
    coverage_score = min(heading_density * 5, 1.0)   # 0.2 headings/page → 1.0

    toc_score = 1.0 if method == "toc" else (0.6 if method == "font_heuristic" else 0.2)

    depths = {s.depth for s in sections}
    depth_score = min(len(depths) / 3.0, 1.0)

    leaf_lengths = [len(s.text) for s in sections if s.text]
    if leaf_lengths:
        avg_len = statistics.mean(leaf_lengths)
        length_score = 1.0 if 200 < avg_len < 5000 else 0.4
    else:
        length_score = 0.0

    score = (
        0.40 * coverage_score
        + 0.20 * toc_score
        + 0.20 * depth_score
        + 0.20 * length_score
    )
    return round(min(score, 1.0), 3)
