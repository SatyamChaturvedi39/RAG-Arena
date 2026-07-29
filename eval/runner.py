"""
RAG-Arena Eval Runner
─────────────────────
CLI orchestrator for the DDAR evaluation system.

Usage:
  # Run a single dataset × baseline combination:
  python -m eval.runner --dataset triviaqa --baseline dual_axis

  # Run all baselines for a single dataset:
  python -m eval.runner --dataset triviaqa --baseline all

  # Run everything:
  python -m eval.runner --all

  # Compare saved result files for a dataset:
  python -m eval.runner --dataset triviaqa --compare

Design note:
  The eval runner operates in SIMULATION MODE for open-domain benchmarks
  (NQ, TriviaQA, SQuAD, ASQA, BioASQ). We have no retrieval corpus for
  these benchmarks so:
    - We measure routing BEHAVIOUR (which path is chosen, how often).
    - We measure parametric answer QUALITY using Groq 70B for all paths.
  This correctly isolates the router's signal from retrieval corpus quality.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

# ── Path setup ────────────────────────────────────────────────────────────────
_ROOT    = Path(__file__).resolve().parent.parent
_BACKEND = _ROOT / "backend"
for p in [str(_ROOT), str(_BACKEND)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from eval.config import (
    BASELINES,
    EVAL_DATASETS,
    EVAL_GROQ_MODEL,
    EVAL_MAX_TOKENS,
    EVAL_TEMPERATURE,
    OPEN_DOMAIN_QA_PROMPT,
    RESULTS_DIR,
)
from eval.baselines import ROUTE_FNS
from eval import metrics as M

# Dataset loader dispatch
_LOADER_MAP: dict[str, str] = {
    "nq":       "eval.datasets.nq_loader",
    "triviaqa": "eval.datasets.triviaqa_loader",
    "squad":    "eval.datasets.squad2",
    "asqa":     "eval.datasets.asqa",
    "bioasq":   "eval.datasets.bioasq_loader",
}


# ── Groq client (lazy import — not available without GROQ_API_KEY in env) ────

def _get_groq():
    """Lazy-initialize Groq client (requires GROQ_API_KEY env var)."""
    try:
        from groq import Groq  # type: ignore
        api_key = os.environ.get("GROQ_API_KEY") or _load_env_key()
        if not api_key:
            raise EnvironmentError("GROQ_API_KEY not set")
        return Groq(api_key=api_key)
    except ImportError as exc:
        raise ImportError("groq package not installed — run: pip install groq") from exc


def _load_env_key() -> str | None:
    """Try to load GROQ_API_KEY from .env file at repo root."""
    env_path = _ROOT / ".env"
    if not env_path.exists():
        return None
    with open(env_path) as f:
        for line in f:
            if line.startswith("GROQ_API_KEY="):
                return line.split("=", 1)[1].strip()
    return None


def _generate_answer(client, question: str, decision: str) -> tuple[str, float]:
    """
    Generate an answer for the question and return (answer_text, latency_ms).
    All decisions (parametric, vector, vectorless) use the same Groq call
    because in eval mode we measure routing behaviour, not retrieval quality.

    Retries indefinitely on HTTP 429 (rate-limit): pauses 60 s then retries.
    """
    prompt = OPEN_DOMAIN_QA_PROMPT.format(question=question)
    while True:
        try:
            start = time.perf_counter()
            response = client.chat.completions.create(
                model=EVAL_GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=EVAL_TEMPERATURE,
                max_tokens=EVAL_MAX_TOKENS,
            )
            latency_ms = (time.perf_counter() - start) * 1000
            answer = response.choices[0].message.content.strip()
            return answer, round(latency_ms, 2)
        except Exception as exc:
            exc_str = str(exc)
            # Groq surfaces 429 as an exception whose message contains the status code
            if "429" in exc_str or "rate_limit" in exc_str.lower() or "rate limit" in exc_str.lower():
                print(f"\n    [429] Rate limited — pausing 60 s before retry...", flush=True)
                time.sleep(60)
                # loop continues — retry same question
            else:
                raise  # propagate non-rate-limit errors


# ── Loader helper ──────────────────────────────────────────────────────────────

def _load_dataset(name: str, max_samples: int) -> list[dict]:
    import importlib
    mod = importlib.import_module(_LOADER_MAP[name])
    return mod.load(max_samples=max_samples)


# ── Single evaluation run ──────────────────────────────────────────────────────

def run_eval(dataset_name: str, baseline_name: str, verbose: bool = True, limit: int | None = None) -> dict:
    """
    Run one (dataset, baseline) combination.
    Returns the aggregate results dict and saves a JSON file to eval/results/.
    """
    cfg = EVAL_DATASETS[dataset_name]
    route_fn = ROUTE_FNS[baseline_name]
    max_samples = limit if limit is not None else cfg["max_samples"]

    if verbose:
        print(f"\n{'='*60}")
        print(f"  Dataset : {dataset_name}  |  Baseline: {baseline_name}")
        print(f"  Max samples: {max_samples}")
        print(f"{'='*60}")

    # Load dataset
    if verbose:
        print("  Loading dataset...", end="", flush=True)
    samples = _load_dataset(dataset_name, max_samples)
    if verbose:
        print(f" {len(samples)} samples loaded.")

    # Guard: if loader returned [] (e.g. BioASQ without manual download), skip gracefully
    if not samples:
        reason = f"{dataset_name}: skipped (manual download required or dataset unavailable)"
        if verbose:
            print(f"  [SKIP] {reason}")
        return {
            "dataset":        dataset_name,
            "baseline":       baseline_name,
            "n_samples":      0,
            "em":             0.0,
            "f1":             0.0,
            "rouge_l":        0.0,
            "avg_latency_ms": 0.0,
            "eo_percent":     0.0,
            "decision_breakdown": {},
            "skipped_reason": reason,
        }

    # Init Groq
    groq_client = _get_groq()

    per_sample_results: list[dict] = []

    for i, sample in enumerate(samples):
        question  = sample["question"]
        gt_answers = sample["answers"]

        # Route
        routing = route_fn(question)
        decision = routing["decision"]

        # Generate answer
        try:
            prediction, latency_ms = _generate_answer(groq_client, question, decision)
        except Exception as exc:
            prediction = ""
            latency_ms = 0.0
            if verbose:
                print(f"\n    [WARN] Sample {i+1} generation failed: {exc}")

        # 2-second inter-call delay to respect Groq rate limits
        time.sleep(2)

        # Score
        em  = M.exact_match(prediction, gt_answers)
        f1  = M.token_f1(prediction, gt_answers)
        rl  = M.rouge_l(prediction, gt_answers)

        is_unanswerable = sample.get("is_unanswerable", False)
        # Confession phrases per the spec — empty output also counts as a confession.
        _CONFESSION_PHRASES = [
            "", "cannot answer", "don't know", "no answer",
            "unanswerable", "not enough information",
        ]
        model_confessed = False
        is_router_failure = False  # routing decision is never penalised for unanswerable queries
        if is_unanswerable:
            pred_lower = prediction.strip().lower()
            model_confessed = (
                pred_lower == ""
                or any(phrase in pred_lower for phrase in _CONFESSION_PHRASES if phrase)
            )
            # is_router_failure intentionally stays False — route is irrelevant

        per_sample_results.append({
            "question":          question,
            "prediction":        prediction,
            "ground_truth":      gt_answers,
            "routing_decision":  decision,
            "embedding_used":    routing["embedding_used"],
            "routing_reasoning": routing.get("reasoning", ""),
            "latency_ms":        latency_ms,
            "em":                em,
            "f1":                f1,
            "rouge_l":           rl,
            "is_unanswerable":   is_unanswerable,
            "model_confessed":   model_confessed,
            "is_router_failure": is_router_failure,
        })

        if verbose and (i + 1) % 10 == 0:
            print(
                f"    [{i+1:>3}/{len(samples)}] "
                f"route={decision:<10}  em={em:.2f}  f1={f1:.2f}  lat={latency_ms:.0f}ms",
                flush=True,
            )

    agg = M.aggregate_results(per_sample_results)

    # Log unanswerable queries separately
    unans_samples = [r for r in per_sample_results if r.get("is_unanswerable")]
    if unans_samples:
        unans_total = len(unans_samples)
        unans_router_failures = sum(1 for r in unans_samples if r.get("is_router_failure"))
        unans_confessed = sum(1 for r in unans_samples if r.get("model_confessed"))
        agg["unanswerable_stats"] = {
            "total": unans_total,
            "router_failures": unans_router_failures,
            "model_confessed_concise": unans_confessed,
        }

    # Save results
    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    out_path = RESULTS_DIR / f"{dataset_name}_{baseline_name}_{ts}.json"
    payload = {
        "dataset":   dataset_name,
        "baseline":  baseline_name,
        "timestamp": ts,
        "aggregate": agg,
        "samples":   per_sample_results,
    }
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    if verbose:
        _print_summary(dataset_name, baseline_name, agg)
        print(f"\n  Saved -> {out_path.name}")

    return agg


# ── Comparison table ───────────────────────────────────────────────────────────

def _print_summary(dataset: str, baseline: str, agg: dict) -> None:
    print(f"\n  {'-'*52}")
    print(f"  {dataset} x {baseline}")
    print(f"  {'-'*52}")
    print(f"  EM           : {agg['em']*100:.1f}%")
    print(f"  Token F1     : {agg['f1']*100:.1f}%")
    print(f"  ROUGE-L      : {agg['rouge_l']*100:.1f}%")
    print(f"  EO%          : {agg['eo_percent']:.1f}%")
    print(f"  Avg latency  : {agg['avg_latency_ms']:.0f} ms")
    print(f"  N samples    : {agg['n_samples']}")
    bd = agg["decision_breakdown"]
    print(f"  Decisions    : parametric={bd['parametric']}  vector={bd['vector']}  vectorless={bd['vectorless']}")
    if "unanswerable_stats" in agg:
        ustats = agg["unanswerable_stats"]
        print(f"  Unanswerable : total={ustats['total']}  model_confessed={ustats['model_confessed_concise']}")


def print_comparison_table(dataset_name: str) -> None:
    """
    Read all saved result files for a dataset and print a comparison table.
    """
    files = sorted(RESULTS_DIR.glob(f"{dataset_name}_*.json"))
    if not files:
        print(f"No result files found for dataset '{dataset_name}' in {RESULTS_DIR}")
        return

    # Keep only the latest file per baseline
    latest: dict[str, dict] = {}
    for f in files:
        parts = f.stem.split("_")
        # filename format: {dataset}_{baseline}_{timestamp}
        # baseline may contain underscores so join everything between dataset and timestamp
        baseline_ts = "_".join(parts[len(dataset_name.split("_")):])
        # Last part after final _ is timestamp (ends with Z)
        ts_idx = baseline_ts.rfind("_")
        baseline = baseline_ts[:ts_idx]
        if baseline not in latest:
            latest[baseline] = json.loads(f.read_text())
        # files are sorted ascending so last wins (most recent)
        latest[baseline] = json.loads(f.read_text())

    header = f"{'System':<18} | {'EM':>6} | {'F1':>6} | {'ROUGE':>6} | {'EO%':>5} | {'Lat(ms)':>8}"
    print(f"\n  {header}")
    print(f"  {'-'*60}")
    for baseline, data in sorted(latest.items()):
        agg = data["aggregate"]
        print(
            f"  {baseline:<18} | {agg['em']*100:>5.1f}% | "
            f"{agg['f1']*100:>5.1f}% | {agg['rouge_l']*100:>5.1f}% | "
            f"{agg['eo_percent']:>4.1f}% | {agg['avg_latency_ms']:>7.0f}ms"
        )


# ── CLI ────────────────────────────────────────────────────────────────────────

def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="RAG-Arena DDAR Evaluation Runner",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m eval.runner --dataset triviaqa --baseline dual_axis
  python -m eval.runner --dataset nq --baseline all
  python -m eval.runner --all
  python -m eval.runner --dataset triviaqa --compare
        """,
    )
    p.add_argument(
        "--dataset",
        choices=list(EVAL_DATASETS.keys()),
        help="Dataset to evaluate on.",
    )
    p.add_argument(
        "--baseline",
        choices=BASELINES + ["all"],
        default="all",
        help="Baseline system (or 'all').",
    )
    p.add_argument(
        "--all",
        action="store_true",
        help="Run all datasets × all baselines.",
    )
    p.add_argument(
        "--compare",
        action="store_true",
        help="Print comparison table from saved results (requires --dataset).",
    )
    p.add_argument(
        "--quiet",
        action="store_true",
        help="Suppress per-sample logging.",
    )
    p.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit the number of samples to evaluate (useful for quick smoke tests).",
    )
    return p.parse_args()


def main() -> None:
    args = _parse_args()
    verbose = not args.quiet

    if args.compare:
        if not args.dataset:
            print("ERROR: --compare requires --dataset")
            sys.exit(1)
        print_comparison_table(args.dataset)
        return

    if args.all:
        datasets  = list(EVAL_DATASETS.keys())
        baselines = BASELINES
    else:
        if not args.dataset:
            print("ERROR: --dataset is required unless --all is specified")
            sys.exit(1)
        datasets  = [args.dataset]
        baselines = BASELINES if args.baseline == "all" else [args.baseline]

    for ds in datasets:
        for bl in baselines:
            try:
                run_eval(ds, bl, verbose=verbose, limit=args.limit)
            except Exception as exc:
                print(f"\n[ERROR] {ds} x {bl} failed: {exc}")
                import traceback
                traceback.print_exc()


if __name__ == "__main__":
    main()
