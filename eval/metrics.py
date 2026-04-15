"""
Evaluation metrics: F1, Exact Match, latency percentiles.

Token F1 is the standard RAG evaluation metric from the SQuAD paper:
  F1 = 2 * (precision * recall) / (precision + recall)
  where precision/recall are computed at the token (word) level.
"""
import re
import statistics
from collections import Counter


def normalize(text: str) -> str:
    """Lowercase, remove punctuation and extra whitespace."""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def token_f1(prediction: str, ground_truth: str) -> float:
    pred_tokens = Counter(normalize(prediction).split())
    true_tokens = Counter(normalize(ground_truth).split())

    common = sum((pred_tokens & true_tokens).values())
    if common == 0:
        return 0.0

    precision = common / sum(pred_tokens.values())
    recall = common / sum(true_tokens.values())
    return 2 * precision * recall / (precision + recall)


def exact_match(prediction: str, ground_truth: str) -> bool:
    return normalize(prediction) == normalize(ground_truth)


def compute_aggregate(results: list[dict]) -> dict:
    """
    Given a list of per-question result dicts:
    {
      "vector_answer": str, "vectorless_answer": str, "ground_truth": str,
      "vector_latency_ms": int, "vectorless_latency_ms": int,
      "router_recommended": str,
    }
    Returns aggregate metrics dict.
    """
    if not results:
        return {}

    v_f1s, vl_f1s = [], []
    v_ems, vl_ems = [], []
    v_latencies, vl_latencies = [], []
    router_correct = 0

    for r in results:
        gt = r.get("ground_truth", "")
        va, vla = r.get("vector_answer", ""), r.get("vectorless_answer", "")

        vf = token_f1(va, gt)
        vlf = token_f1(vla, gt)
        v_f1s.append(vf)
        vl_f1s.append(vlf)
        v_ems.append(exact_match(va, gt))
        vl_ems.append(exact_match(vla, gt))

        if r.get("vector_latency_ms"):
            v_latencies.append(r["vector_latency_ms"])
        if r.get("vectorless_latency_ms"):
            vl_latencies.append(r["vectorless_latency_ms"])

        # Router correct = recommended pipeline had higher F1
        rec = r.get("router_recommended")
        if rec == "vector" and vf >= vlf:
            router_correct += 1
        elif rec == "vectorless" and vlf >= vf:
            router_correct += 1

    def pct(lst, p):
        if not lst:
            return None
        sorted_lst = sorted(lst)
        idx = int(len(sorted_lst) * p / 100)
        return sorted_lst[min(idx, len(sorted_lst) - 1)]

    return {
        "total": len(results),
        "vector_f1": round(statistics.mean(v_f1s), 4),
        "vectorless_f1": round(statistics.mean(vl_f1s), 4),
        "vector_em": round(sum(v_ems) / len(v_ems), 4),
        "vectorless_em": round(sum(vl_ems) / len(vl_ems), 4),
        "vector_p50": pct(v_latencies, 50),
        "vectorless_p50": pct(vl_latencies, 50),
        "vector_p95": pct(v_latencies, 95),
        "vectorless_p95": pct(vl_latencies, 95),
        "router_accuracy": round(router_correct / len(results), 4),
    }
