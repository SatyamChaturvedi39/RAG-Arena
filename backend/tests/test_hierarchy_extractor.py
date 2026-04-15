"""
Unit tests for the hierarchy extractor.
Run: cd backend && pytest tests/test_hierarchy_extractor.py -v
"""
import pytest
from ingestion.pdf_parser import PageData, FontBlock, ParsedDocument
from ingestion.hierarchy_extractor import extract_hierarchy, RawSection


def make_parsed(pages: list[PageData], toc=None) -> ParsedDocument:
    return ParsedDocument(
        pages=pages,
        page_count=len(pages),
        toc=toc or [],
        first_page_text=pages[0].text if pages else "",
    )


# ─── Pass 1: TOC tests ────────────────────────────────────────────────────────

def test_toc_pass_used_when_rich():
    toc = [
        [1, "PART I", 1],
        [2, "Item 1. Business", 2],
        [2, "Item 1A. Risk Factors", 5],
        [1, "PART II", 10],
    ]
    pages = [PageData(page_num=i, text=f"Page {i} content " * 20, blocks=[]) for i in range(15)]
    parsed = make_parsed(pages, toc=toc)
    sections, score = extract_hierarchy(parsed)
    titles = [s.title for s in sections]
    assert "PART I" in titles
    assert "Item 1. Business" in titles
    assert score > 0.3


def test_toc_depth_mapping():
    """TOC levels 1,2,3 should map to depths 0,1,2."""
    toc = [[1, "Top", 1], [2, "Sub", 2], [3, "SubSub", 3]]
    pages = [PageData(page_num=i, text="x " * 50, blocks=[]) for i in range(5)]
    parsed = make_parsed(pages, toc=toc)
    sections, _ = extract_hierarchy(parsed)
    depths = {s.title: s.depth for s in sections}
    assert depths["Top"] == 0
    assert depths["Sub"] == 1
    assert depths["SubSub"] == 2


# ─── Pass 2: Font heuristic tests ─────────────────────────────────────────────

def _block(text, size, bold=False, page=0):
    return FontBlock(
        text=text,
        size=size,
        flags=16 if bold else 0,
        page_num=page,
        bbox=(0, 0, 100, 12),
    )


def test_font_pass_detects_headings():
    body_blocks = [_block("Body text content here " * 3, 11.0) for _ in range(20)]
    heading_blocks = [
        _block("CHAPTER ONE", 18.0, page=0),
        _block("Section 1.1", 14.0, page=1),
    ]
    pages = [
        PageData(page_num=0, text="CHAPTER ONE\nBody text " * 30, blocks=heading_blocks[:1] + body_blocks[:10]),
        PageData(page_num=1, text="Section 1.1\nMore body " * 30, blocks=heading_blocks[1:] + body_blocks[10:]),
    ]
    parsed = make_parsed(pages)
    sections, score = extract_hierarchy(parsed)
    titles = [s.title for s in sections]
    assert "CHAPTER ONE" in titles
    assert "Section 1.1" in titles


# ─── Pass 3: Regex tests ──────────────────────────────────────────────────────

def test_regex_detects_part_items():
    text = "\n".join([
        "Some intro content on this page.",
        "PART I",
        "Some text after part I.",
        "Item 1. Business Description",
        "Company overview content here.",
        "Item 1A. Risk Factors",
        "Risk content here.",
    ])
    pages = [PageData(page_num=0, text=text, blocks=[])]
    parsed = make_parsed(pages)
    sections, score = extract_hierarchy(parsed)
    titles = [s.title for s in sections]
    assert any("PART I" in t or "Item 1" in t for t in titles)


# ─── Structure score tests ────────────────────────────────────────────────────

def test_empty_document_scores_zero():
    pages = [PageData(page_num=0, text="", blocks=[])]
    parsed = make_parsed(pages)
    _, score = extract_hierarchy(parsed)
    assert score == 0.0


def test_rich_toc_scores_high():
    toc = [[i % 2 + 1, f"Section {i}", i + 1] for i in range(10)]
    pages = [PageData(page_num=i, text="content " * 100, blocks=[]) for i in range(15)]
    parsed = make_parsed(pages, toc=toc)
    _, score = extract_hierarchy(parsed)
    assert score >= 0.35, f"Expected score >= 0.35, got {score}"


def test_score_in_range():
    toc = [[1, "A", 1], [1, "B", 3], [1, "C", 5]]
    pages = [PageData(page_num=i, text="x " * 50, blocks=[]) for i in range(8)]
    parsed = make_parsed(pages, toc=toc)
    _, score = extract_hierarchy(parsed)
    assert 0.0 <= score <= 1.0
