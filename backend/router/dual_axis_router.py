"""
Deterministic Dual-Axis Router (DDAR)

Combines Axis 1 (mean token surprisal -> retrieval necessity) and
Axis 2 (named entity density + SQT -> retrieval mode) into a
single, synchronous routing call with no external API dependency.

Decision outcomes:
  parametric  -- LLM answers from training knowledge (no retrieval)
  vector      -- embedding cosine search (existing vector_rag pipeline)
  vectorless  -- tree navigation (existing vectorless_rag pipeline)

The route() function returns a JSON-serialisable dict with all routing
signals.  This dict is stored directly in the ``dual_axis_result`` JSONB
column and returned by the ``/route-preview`` endpoint.
"""
from __future__ import annotations

from router.entropy import compute_mean_token_surprisal
from router.ner import compute_entity_density, compute_sqt_flag
from router.router_config import THETA_1, THETA_2


def route(query: str) -> dict:
    """
    Run both axes and return a JSON-serialisable routing dict.

    Axis 1: Mean Token Surprisal gate
      S(q) < THETA_1  ->  parametric  (no retrieval)

    Axis 2: Named Entity Density + Structured Query Type
      D(q) > THETA_2 or SQT  ->  vectorless
      otherwise               ->  vector
    """
    # -- Axis 1: Retrieval Necessity ----------------------------------------
    s_q = compute_mean_token_surprisal(query)

    if s_q < THETA_1:
        return {
            "route":          "parametric",
            "axis_triggered": 1,
            "s_q":            s_q,
            "d_q":            None,
            "sqt":            None,
            "theta_1":        THETA_1,
            "theta_2":        THETA_2,
            "reason": (
                f"S(q)={s_q:.3f} < theta_1={THETA_1} "
                "-- common vocabulary, model answers from training knowledge"
            ),
        }

    # -- Axis 2: Retrieval Mode ---------------------------------------------
    d_q = compute_entity_density(query)
    sqt = compute_sqt_flag(query)

    if d_q > THETA_2 or sqt:
        return {
            "route":          "vectorless",
            "axis_triggered": 2,
            "s_q":            s_q,
            "d_q":            d_q,
            "sqt":            sqt,
            "theta_1":        THETA_1,
            "theta_2":        THETA_2,
            "reason": (
                f"S(q)={s_q:.3f} >= theta_1 AND "
                f"(D(q)={d_q:.3f} > theta_2={THETA_2} OR SQT={sqt}) "
                "-- entity-dense or structured, use structural navigation"
            ),
        }

    return {
        "route":          "vector",
        "axis_triggered": 2,
        "s_q":            s_q,
        "d_q":            d_q,
        "sqt":            sqt,
        "theta_1":        THETA_1,
        "theta_2":        THETA_2,
        "reason": (
            f"S(q)={s_q:.3f} >= theta_1 AND "
            f"D(q)={d_q:.3f} <= theta_2 AND SQT=False "
            "-- broad/semantic query, use embedding search"
        ),
    }
