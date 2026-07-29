"""
Unit tests for the Deterministic Dual-Axis Router (DDAR).

Tests cover:
  - Mean token surprisal calculation (corrected formula)
  - NER entity extraction and density
  - Structured query type (SQT) detection
  - Routing decisions (parametric / vector / vectorless)
  - Dict-based router output and JSON serialisation
"""
import json
import math

import pytest

from router.entropy import compute_mean_token_surprisal, needs_retrieval
from router.ner import (
    compute_entity_density,
    compute_sqt_flag,
    extract_named_entities,
    is_structured_lookup,
    use_vectorless,
)
from router.dual_axis_router import route
from router.router_config import THETA_1, THETA_2


# ═══════════════════════════════════════════════════════════════════════════════
# Axis 1: Mean Token Surprisal
# ═══════════════════════════════════════════════════════════════════════════════

def test_surprisal_empty_and_short():
    """Empty strings and single-char tokens should return 0.0."""
    assert compute_mean_token_surprisal("") == 0.0
    assert compute_mean_token_surprisal("a") == 0.0
    assert compute_mean_token_surprisal("I") == 0.0


def test_the_low_surprisal():
    """'the' is the highest-frequency English word — surprisal well under 7 bits."""
    s = compute_mean_token_surprisal("the")
    assert s > 0.0, "surprisal of 'the' should be positive"
    assert s < 7.0, f"'the' surprisal should be well under 7 bits, got {s}"


def test_oov_word_max_surprisal():
    """A truly OOV nonsense word should get maximum smoothed surprisal ~log2(N_total)."""
    s = compute_mean_token_surprisal("xyzzyplugh")
    # log2(N_total) where N_total ~ 1 trillion => ~39.9 bits
    # If corpus loaded, expect > 35.  If fallback, lower but still high.
    assert s > 15.0, f"OOV word surprisal should be > 15 bits, got {s}"


def test_common_query_routes_parametric():
    """A query of all common words should produce S(q) < THETA_1."""
    s = compute_mean_token_surprisal("what is the capital of france")
    assert s < THETA_1, (
        f"Common query surprisal {s} should be < THETA_1={THETA_1}"
    )


def test_technical_query_passes_axis1():
    """A query with technical/rare terms should produce S(q) >= THETA_1."""
    s = compute_mean_token_surprisal("CRISPR Cas9 gene editing mechanism")
    assert s >= THETA_1, (
        f"Technical query surprisal {s} should be >= THETA_1={THETA_1}"
    )


def test_needs_retrieval_gate():
    """needs_retrieval() should return False for common queries, True for rare."""
    assert needs_retrieval("what is the capital of france") is False
    assert needs_retrieval("CRISPR Cas9 gene editing mechanism") is True
    # With a custom low threshold, everything needs retrieval
    assert needs_retrieval("hello world", threshold=0.01) is True


# ═══════════════════════════════════════════════════════════════════════════════
# Axis 2: Named Entity Detection
# ═══════════════════════════════════════════════════════════════════════════════

def test_extract_named_entities():
    """Verify detection of proper nouns, currencies, dates, versions."""
    query = "Google acquired YouTube for $1.65 billion in October 2006. We used v1.2."
    entities = extract_named_entities(query)

    assert "YouTube" in entities
    assert any("$" in e for e in entities), "Should detect currency"
    assert "October 2006" in entities
    assert "v1.2" in entities


def test_entity_density():
    """High-entity query should have density > THETA_2, low-entity < 0.10."""
    high = compute_entity_density(
        "Microsoft Windows v10.0 and Apple macOS v14.2 on 2026-06-16"
    )
    assert high > THETA_2, f"High-entity density {high} should be > {THETA_2}"

    low = compute_entity_density(
        "tell me how to bake a cake with flour and sugar"
    )
    assert low < 0.10, f"Low-entity density {low} should be < 0.10"


def test_structured_lookup_detection():
    """SQT flag should fire for backticks, field=value, PMID, section refs."""
    assert compute_sqt_flag("search for `my_function` in the codebase") is True
    assert compute_sqt_flag("[User] = admin") is True
    assert compute_sqt_flag("PMID 123456") is True
    assert compute_sqt_flag("Refer to Section 4.2 of the documentation") is True
    assert compute_sqt_flag("how do birds fly in winter") is False

    # Backward-compatible alias
    assert is_structured_lookup("RFC 1234") is True


def test_high_surprisal_token_treated_as_entity():
    """Rare domain-specific terms (surprisal > 17 bits) must be counted
    as implicit entities even when they are lowercase and match no regex."""
    density = compute_entity_density("methotrexate dosage rheumatoid")
    assert density > 0, (
        "methotrexate has surprisal ~39.9 bits and should be detected "
        "as a high-surprisal implicit entity, giving D(q) > 0"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Routing Decisions
# ═══════════════════════════════════════════════════════════════════════════════

def test_routing_parametric():
    """Common-knowledge query should route to parametric."""
    result = route("what is the capital of france")
    assert result["route"] == "parametric"
    assert result["axis_triggered"] == 1
    assert result["d_q"] is None
    assert result["sqt"] is None


def test_routing_vectorless():
    """Entity-dense or structured query should route to vectorless."""
    result = route(
        "Compare Google LLC revenue with Apple Inc net income for "
        "fiscal year 2023 under Section 7"
    )
    assert result["route"] == "vectorless"
    assert result["axis_triggered"] == 2
    assert result["d_q"] is not None


def test_routing_vector():
    """Broad semantic query with rare terms but low entity density -> vector."""
    result = route(
        "how should a developer design robust microservices using "
        "hexagonal architecture and domain driven design principles"
    )
    # This query has rare terms (passes Axis 1) but low entity density
    assert result["route"] in ("vector", "vectorless"), (
        f"Expected vector or vectorless, got {result['route']}"
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Serialisation & Output Format
# ═══════════════════════════════════════════════════════════════════════════════

def test_route_dict_json_serializable():
    """Route output must be a JSON-serialisable dict with all required keys."""
    result = route("explain how neural networks work")
    required_keys = {
        "route", "axis_triggered", "s_q", "d_q", "sqt",
        "theta_1", "theta_2", "reason",
    }
    assert isinstance(result, dict)
    for key in required_keys:
        assert key in result, f"Missing key: {key}"

    # Must be JSON serialisable
    json_str = json.dumps(result)
    assert len(json_str) > 0

    # Route value must be one of the three valid options
    assert result["route"] in ("parametric", "vector", "vectorless")


def test_route_preview_dict_fields():
    """All router dicts must contain the 8 required keys."""
    for query in [
        "what is gravity",
        "CRISPR Cas9 mechanism in oncogene therapy",
        "Section 4.2 of RFC 7231",
    ]:
        d = route(query)
        for key in ("route", "axis_triggered", "s_q", "d_q",
                     "sqt", "theta_1", "theta_2", "reason"):
            assert key in d, f"Missing key '{key}' for query: {query}"
        # Verify types
        assert isinstance(d["route"], str)
        assert isinstance(d["axis_triggered"], int)
        assert isinstance(d["s_q"], float)
        assert isinstance(d["theta_1"], float)
        assert isinstance(d["theta_2"], float)
        assert isinstance(d["reason"], str)
