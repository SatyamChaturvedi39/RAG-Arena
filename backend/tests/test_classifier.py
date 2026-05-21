"""
Unit tests for the query classifier and routing decision matrix.
Run: cd backend && pytest tests/test_classifier.py -v
"""
import pytest
from router.classifier import _classify_by_regex, classify_doc_type, recommend, RouterOutput


def test_regex_classification():
    # Precise factual queries
    q1 = "what was the net income in 2024?"
    type1, count1 = _classify_by_regex(q1)
    assert type1 == "precise_factual"
    assert count1 >= 1

    q2 = "how much revenue was earned as of Q3?"
    type2, count2 = _classify_by_regex(q2)
    assert type2 == "precise_factual"
    assert count2 >= 1

    # Fuzzy semantic queries
    q3 = "explain the core concepts of the paper"
    type3, count3 = _classify_by_regex(q3)
    assert type3 == "fuzzy_semantic"
    assert count3 >= 1

    q4 = "summarize what the author says about risks"
    type4, count4 = _classify_by_regex(q4)
    assert type4 == "fuzzy_semantic"
    assert count4 >= 1

    # Multi-hop queries
    q5 = "how did the pandemic affect revenue growth?"
    type5, count5 = _classify_by_regex(q5)
    assert type5 == "multi_hop"
    assert count5 >= 1


def test_document_classification():
    # Financial indicators
    text_fin = "Our annual report SEC filing contains the balance sheet and earnings numbers."
    assert classify_doc_type(text_fin, "report.pdf") == "financial"
    assert classify_doc_type("", "10k_filing.pdf") == "financial"

    # Legal indicators
    text_legal = "This agreement is hereby signed by both parties, whereas they consent."
    assert classify_doc_type(text_legal, "contract.pdf") == "legal"

    # Technical indicators
    text_tech = "An implementation of the algorithm described in the abstract."
    assert classify_doc_type(text_tech, "architecture.pdf") == "technical"

    # General fallback
    assert classify_doc_type("Just a friendly letter about coffee.", "coffee.pdf") == "general"


def test_routing_recommendations():
    # Rule 1: low structure -> vector RAG (confidence=1.0)
    out1 = recommend(structure_score=0.2, doc_type="financial", query_type="precise_factual")
    assert out1.recommended == "vector"
    assert out1.confidence == 1.0
    assert "low structural clarity" in out1.reasoning

    # Rule 2: high structure + precise factual -> vectorless RAG (confidence=0.85)
    out2 = recommend(structure_score=0.8, doc_type="financial", query_type="precise_factual")
    assert out2.recommended == "vectorless"
    assert out2.confidence == 0.85

    # Rule 3: high structure + fuzzy semantic -> vector RAG (confidence=0.7)
    out3 = recommend(structure_score=0.8, doc_type="financial", query_type="fuzzy_semantic")
    assert out3.recommended == "vector"
    assert out3.confidence == 0.7

    # Rule 4: medium structure + precise factual + financial -> vectorless RAG (confidence=0.6)
    out4 = recommend(structure_score=0.5, doc_type="financial", query_type="precise_factual")
    assert out4.recommended == "vectorless"
    assert out4.confidence == 0.6

    # Rule 5: multi-hop -> vector RAG (confidence=0.65)
    out5 = recommend(structure_score=0.8, doc_type="financial", query_type="multi_hop")
    assert out5.recommended == "vector"
    assert out5.confidence == 0.65
