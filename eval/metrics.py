"""
Evaluation metrics for the RAG-Arena eval system.

Implements:
  - Exact Match (EM)
  - Token F1
  - ROUGE-L
  - Embedding Overhead % (EO%)
  - Aggregate result computation
"""
from __future__ import annotations

import re
import string
from collections import Counter


# ── Answer normalization ──────────────────────────────────────────────────────

def normalize_answer(s: str) -> str:
    """
    Standard SQuAD answer normalization.
    Lowercase, remove punctuation, remove articles (a, an, the), collapse whitespace.
    """
    def remove_articles(text: str) -> str:
        return re.sub(r"\b(a|an|the)\b", " ", text)

    def white_space_fix(text: str) -> str:
        return " ".join(text.split())

    def remove_punc(text: str) -> str:
        exclude = set(string.punctuation)
        return "".join(ch for ch in text if ch not in exclude)

    def lower(text: str) -> str:
        return text.lower()

    # Guard: if s is not a string (e.g. nested list from BioASQ), coerce it
    if not isinstance(s, str):
        if isinstance(s, list):
            s = " ".join(str(x) for x in s)
        else:
            s = str(s)

    return white_space_fix(remove_articles(remove_punc(lower(s))))


# ── Exact Match ───────────────────────────────────────────────────────────────

def exact_match(
    prediction: str,
    ground_truth: str | list[str],
) -> float:
    """
    Return 1.0 if the normalized prediction exactly matches any ground truth,
    0.0 otherwise.

    ground_truth may be a single string or a list of acceptable answers.
    """
    if isinstance(ground_truth, str):
        ground_truth = [ground_truth]

    norm_pred = normalize_answer(prediction)
    for gt in ground_truth:
        # Flatten any nested lists before normalizing
        if isinstance(gt, list):
            gt = " ".join(str(x) for x in gt)
        if norm_pred == normalize_answer(gt):
            return 1.0
    return 0.0


# ── Token F1 ─────────────────────────────────────────────────────────────────

def _get_tokens(text: str) -> list[str]:
    """Tokenize normalized text by whitespace."""
    return normalize_answer(text).split()


def _token_f1_single(prediction: str, ground_truth: str) -> float:
    pred_tokens = _get_tokens(prediction)
    gt_tokens   = _get_tokens(ground_truth)

    if not pred_tokens or not gt_tokens:
        return 1.0 if pred_tokens == gt_tokens else 0.0

    pred_counter = Counter(pred_tokens)
    gt_counter   = Counter(gt_tokens)
    common = pred_counter & gt_counter
    num_same = sum(common.values())

    if num_same == 0:
        return 0.0

    precision = num_same / len(pred_tokens)
    recall    = num_same / len(gt_tokens)
    f1 = (2 * precision * recall) / (precision + recall)
    return f1


def token_f1(
    prediction: str,
    ground_truth: str | list[str],
) -> float:
    """
    Compute token-level F1 score.
    If ground_truth is a list, return the maximum F1 across all ground truths.
    """
    if isinstance(ground_truth, str):
        ground_truth = [ground_truth]
    return max(_token_f1_single(prediction, gt) for gt in ground_truth)


# ── ROUGE-L ───────────────────────────────────────────────────────────────────

def rouge_l(
    prediction: str,
    ground_truth: str | list[str],
) -> float:
    """Compute ROUGE-L F-measure."""
    try:
        from rouge_score import rouge_scorer
        if isinstance(ground_truth, list):
            scores = []
            for ref in ground_truth:
                scorer = rouge_scorer.RougeScorer(
                    ['rougeL'], use_stemmer=False)
                s = scorer.score(
                    normalize_answer(ref),
                    normalize_answer(prediction))
                scores.append(s['rougeL'].fmeasure)
            return max(scores) if scores else 0.0
        scorer = rouge_scorer.RougeScorer(
            ['rougeL'], use_stemmer=False)
        s = scorer.score(
            normalize_answer(ground_truth),
            normalize_answer(prediction))
        return round(s['rougeL'].fmeasure, 4)
    except Exception as e:
        print(f"[ROUGE-L ERROR] {e}")
        return 0.0


# ── Embedding Overhead % ──────────────────────────────────────────────────────

def compute_embedding_overhead(routing_decisions: list[str]) -> float:
    """
    Compute the Embedding Overhead percentage (EO%).

    EO% = (number of "vector" decisions / total decisions) * 100

    A lower EO% means fewer embedding API calls were needed.
    """
    if not routing_decisions:
        return 0.0
    vector_count = sum(1 for d in routing_decisions if d == "vector")
    return round((vector_count / len(routing_decisions)) * 100, 2)


# ── Aggregate results ─────────────────────────────────────────────────────────

def aggregate_results(results: list[dict]) -> dict:
    """
    Aggregate a list of per-sample result dicts into summary metrics.

    Each result dict must contain:
      - em:              float (0 or 1)
      - f1:              float (0.0–1.0)
      - rouge_l:         float (0.0–1.0)
      - routing_decision: str  ("parametric" | "vector" | "vectorless")
      - embedding_used:  bool
      - latency_ms:      float

    Returns:
    {
      "em":               float (mean),
      "f1":               float (mean),
      "rouge_l":          float (mean),
      "eo_percent":       float (EO%),
      "avg_latency_ms":   float,
      "n_samples":        int,
      "decision_breakdown": {
          "parametric":   int,
          "vector":       int,
          "vectorless":   int
      }
    }
    """
    if not results:
        return {
            "em": 0.0, "f1": 0.0, "rouge_l": 0.0,
            "eo_percent": 0.0, "avg_latency_ms": 0.0,
            "n_samples": 0,
            "decision_breakdown": {"parametric": 0, "vector": 0, "vectorless": 0},
        }

    n = len(results)

    em_mean       = round(sum(r.get("em", 0.0) for r in results) / n, 4)
    f1_mean       = round(sum(r.get("f1", 0.0) for r in results) / n, 4)
    rl_mean       = round(sum(r.get("rouge_l", 0.0) for r in results) / n, 4)
    lat_mean      = round(sum(r.get("latency_ms", 0.0) for r in results) / n, 2)

    decisions     = [r.get("routing_decision", "vector") for r in results]
    eo_pct        = compute_embedding_overhead(decisions)

    breakdown: dict[str, int] = {"parametric": 0, "vector": 0, "vectorless": 0}
    for d in decisions:
        if d in breakdown:
            breakdown[d] += 1

    return {
        "em":               em_mean,
        "f1":               f1_mean,
        "rouge_l":          rl_mean,
        "eo_percent":       eo_pct,
        "avg_latency_ms":   lat_mean,
        "n_samples":        n,
        "decision_breakdown": breakdown,
    }
