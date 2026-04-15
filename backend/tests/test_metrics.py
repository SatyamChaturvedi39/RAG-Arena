"""
Unit tests for the evaluation metrics module.
Run: cd backend && pytest ../eval/tests/ or: python -m pytest from repo root.
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "eval"))

from metrics import token_f1, exact_match, normalize, compute_aggregate


def test_exact_match_identical():
    assert exact_match("The revenue was $1.2 billion", "The revenue was $1.2 billion")


def test_exact_match_case_insensitive():
    assert exact_match("Revenue Was 1.2 BILLION", "revenue was 1.2 billion")


def test_exact_match_punctuation_ignored():
    assert exact_match("$1.2 billion.", "1 2 billion")


def test_f1_perfect():
    assert token_f1("hello world", "hello world") == 1.0


def test_f1_zero():
    assert token_f1("foo bar", "baz qux") == 0.0


def test_f1_partial():
    score = token_f1("hello world", "hello there")
    assert 0.0 < score < 1.0


def test_f1_empty():
    assert token_f1("", "something") == 0.0
    assert token_f1("something", "") == 0.0


def test_compute_aggregate_basic():
    results = [
        {
            "ground_truth": "42 million",
            "vector_answer": "approximately 42 million dollars",
            "vectorless_answer": "42 million",
            "vector_latency_ms": 500,
            "vectorless_latency_ms": 800,
            "router_recommended": "vectorless",
        }
    ]
    agg = compute_aggregate(results)
    assert agg["total"] == 1
    assert 0.0 <= agg["vector_f1"] <= 1.0
    assert 0.0 <= agg["vectorless_f1"] <= 1.0
    assert agg["router_accuracy"] == 1.0   # vectorless was recommended and had higher F1


def test_compute_aggregate_empty():
    assert compute_aggregate([]) == {}
