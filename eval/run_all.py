"""
RAG-Arena Unified Eval Runner — run_all.py

Runs all 5 datasets (NQ, TriviaQA, SQuAD, ASQA, BioASQ) through 3 baselines
(always-vector, always-vectorless, DDAR) and writes:
  - A combined CSV: eval/results/combined_results.csv
  - A JSON summary: eval/results/combined_summary.json

Usage:
    python -m eval.run_all
    python -m eval.run_all --limit 10   # quick smoke test
"""
from __future__ import annotations

import argparse
import csv
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
_ROOT    = Path(__file__).resolve().parent.parent
_BACKEND = _ROOT / "backend"
for p in [str(_ROOT), str(_BACKEND)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from eval.config import EVAL_DATASETS, RESULTS_DIR
from eval.runner import run_eval

# The 3 baselines specified for run_all
_RUN_ALL_BASELINES = ["standard_rag", "embedding_free", "dual_axis"]
_RUN_ALL_DATASETS  = list(EVAL_DATASETS.keys())


def main() -> None:
    parser = argparse.ArgumentParser(description="Run all datasets x baselines")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit samples per dataset (for smoke tests)")
    parser.add_argument("--quiet", action="store_true")
    args = parser.parse_args()

    verbose = not args.quiet
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

    all_rows: list[dict] = []

    for ds in _RUN_ALL_DATASETS:
        for bl in _RUN_ALL_BASELINES:
            try:
                agg = run_eval(ds, bl, verbose=verbose, limit=args.limit)
                bd = agg.get("decision_breakdown", {})
                row = {
                    "dataset":                 ds,
                    "baseline":                bl,
                    "exact_match":             agg.get("em", 0.0),
                    "token_f1":                agg.get("f1", 0.0),
                    "rouge_l":                 agg.get("rouge_l", 0.0),
                    "embedding_overhead_pct":  agg.get("eo_percent", 0.0),
                    "mean_latency_ms":         agg.get("avg_latency_ms", 0.0),
                    "n_queries":               agg.get("n_samples", 0),
                    "n_parametric":            bd.get("parametric", 0),
                    "n_vector":                bd.get("vector", 0),
                    "n_vectorless":            bd.get("vectorless", 0),
                    "skipped_reason":          agg.get("skipped_reason", ""),
                }
                all_rows.append(row)
            except Exception as exc:
                print(f"\n[ERROR] {ds} x {bl} failed: {exc}")
                import traceback
                traceback.print_exc()

    if not all_rows:
        print("No results collected.")
        return

    # ── Write CSV ──────────────────────────────────────────────────────────────
    csv_path = RESULTS_DIR / f"combined_results_{ts}.csv"
    fieldnames = list(all_rows[0].keys())
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_rows)

    # ── Write JSON summary ────────────────────────────────────────────────────
    json_path = RESULTS_DIR / f"combined_summary_{ts}.json"
    summary = {
        "timestamp":  ts,
        "datasets":   _RUN_ALL_DATASETS,
        "baselines":  _RUN_ALL_BASELINES,
        "limit":      args.limit,
        "results":    all_rows,
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"\n{'=' * 60}")
    print(f"  Combined results written:")
    print(f"    CSV:  {csv_path.name}")
    print(f"    JSON: {json_path.name}")
    print(f"  Total runs: {len(all_rows)}")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
