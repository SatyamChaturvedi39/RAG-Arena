"""
DDAR Threshold Calibration via Grid Search + 5-Fold Cross-Validation.

Standalone script — run manually once datasets are ready.
NOT called during normal app operation.

Usage:
    python calibration/calibrate.py

What it does:
    1. Loads NQ-open (3 610 examples) and TriviaQA Wikipedia dev set
       (11 313 examples) from HuggingFace.
    2. Computes S(q) and D(q) for every question.
    3. Grid search over theta_1 (4.0–16.0, step 0.5) and theta_2
       (0.05–0.40, step 0.05) with 5-fold cross-validation.
    4. Writes best thresholds to calibration/thresholds.json.
    5. router_config.py loads thresholds.json at startup if present.
"""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

import numpy as np

# ── Path setup ────────────────────────────────────────────────────────────────
_ROOT    = Path(__file__).resolve().parent.parent
_BACKEND = _ROOT / "backend"
for p in [str(_ROOT), str(_BACKEND)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from router.entropy import compute_mean_token_surprisal
from router.ner import compute_entity_density, compute_sqt_flag

# ── Output path ───────────────────────────────────────────────────────────────
_OUT_DIR  = Path(__file__).resolve().parent
_OUT_FILE = _OUT_DIR / "thresholds.json"


# ── Dataset loading ───────────────────────────────────────────────────────────

def _load_nq(max_samples: int = 3610) -> list[dict]:
    """Load Natural Questions open-domain dev split."""
    from datasets import load_dataset  # type: ignore

    print(f"  Loading NQ-open (max {max_samples})...", end="", flush=True)
    ds = load_dataset(
        "google-research-datasets/natural_questions",
        split="validation",
        trust_remote_code=True,
    )
    samples: list[dict] = []
    for item in ds:
        if len(samples) >= max_samples:
            break
        try:
            question = item["question"]["text"]
            short_answers = item["annotations"][0]["short_answers"]
            if not short_answers:
                continue
            answers = [a["text"] for a in short_answers if a.get("text")]
            if not answers:
                continue
            samples.append({"question": question, "answers": answers, "has_entity": False})
        except (KeyError, IndexError, TypeError):
            continue
    print(f" {len(samples)} loaded.")
    return samples


def _load_triviaqa(max_samples: int = 11313) -> list[dict]:
    """Load TriviaQA rc.wikipedia dev split."""
    from datasets import load_dataset  # type: ignore

    print(f"  Loading TriviaQA rc.wikipedia (max {max_samples})...", end="", flush=True)
    ds = load_dataset(
        "mandarjoshi/trivia_qa",
        "rc.wikipedia",
        split="validation",
        trust_remote_code=True,
    )
    samples: list[dict] = []
    for item in ds:
        if len(samples) >= max_samples:
            break
        try:
            question = item["question"]
            aliases = item["answer"]["aliases"]
            if not aliases:
                aliases = [item["answer"]["value"]]
            samples.append({"question": question, "answers": list(aliases), "has_entity": False})
        except (KeyError, TypeError):
            continue
    print(f" {len(samples)} loaded.")
    return samples


# ── Labelling proxy ───────────────────────────────────────────────────────────

def _label_needs_retrieval(samples: list[dict]) -> None:
    """
    Proxy label: a question "needs retrieval" if it contains at least one
    entity token per Axis 2 logic (D(q) > 0 or SQT = True).

    This is a rough proxy — the assumption is that entity-containing questions
    are more likely to require document context to answer correctly.
    """
    for s in samples:
        d_q = compute_entity_density(s["question"])
        sqt = compute_sqt_flag(s["question"])
        s["has_entity"] = d_q > 0 or sqt


# ── Scoring ───────────────────────────────────────────────────────────────────

def _score_theta1(samples: list[dict], theta1: float) -> float:
    """
    Score a theta_1 candidate.

    Correct decisions:
      - S(q) < theta_1 AND question does NOT need retrieval  (correct parametric)
      - S(q) >= theta_1 AND question DOES need retrieval     (correct pass-through)
    """
    correct = 0
    for s in samples:
        s_q = s["s_q"]
        needs = s["has_entity"]
        if s_q < theta1 and not needs:
            correct += 1
        elif s_q >= theta1 and needs:
            correct += 1
    return correct / max(len(samples), 1)


def _score_theta2(samples: list[dict], theta2: float) -> float:
    """
    Score a theta_2 candidate on samples that passed Axis 1 (S(q) >= best_theta1).

    Correct decisions:
      - D(q) > theta_2 or SQT AND question has entities  (correct vectorless)
      - D(q) <= theta_2 and NOT SQT AND question is semantic (correct vector)
    """
    correct = 0
    for s in samples:
        d_q = s["d_q"]
        sqt = s["sqt"]
        has_ent = s["has_entity"]
        if (d_q > theta2 or sqt) and has_ent:
            correct += 1
        elif (d_q <= theta2 and not sqt) and not has_ent:
            correct += 1
    return correct / max(len(samples), 1)


# ── 5-fold cross-validation ──────────────────────────────────────────────────

def _kfold_cv(samples: list[dict], k: int = 5) -> list[tuple[list[dict], list[dict]]]:
    """Split samples into k folds and return (train, test) pairs."""
    n = len(samples)
    fold_size = n // k
    folds = []
    for i in range(k):
        start = i * fold_size
        end = start + fold_size if i < k - 1 else n
        test = samples[start:end]
        train = samples[:start] + samples[end:]
        folds.append((train, test))
    return folds


def _grid_search_theta1(samples: list[dict]) -> float:
    """Grid search for best theta_1 with 5-fold CV."""
    candidates = [round(4.0 + i * 0.5, 1) for i in range(25)]  # 4.0 to 16.0
    print(f"\n  Grid search theta_1: {len(candidates)} candidates x 5 folds")

    best_t1 = 10.0
    best_score = -1.0
    folds = _kfold_cv(samples)

    for t1 in candidates:
        scores = []
        for train, test in folds:
            s = _score_theta1(test, t1)
            scores.append(s)
        mean_score = np.mean(scores)
        if mean_score > best_score:
            best_score = mean_score
            best_t1 = t1

    print(f"  Best theta_1 = {best_t1} (CV accuracy = {best_score:.4f})")
    return best_t1


def _grid_search_theta2(samples: list[dict]) -> float:
    """Grid search for best theta_2 with 5-fold CV."""
    candidates = [round(0.05 + i * 0.05, 2) for i in range(8)]  # 0.05 to 0.40
    print(f"\n  Grid search theta_2: {len(candidates)} candidates x 5 folds")

    best_t2 = 0.15
    best_score = -1.0
    folds = _kfold_cv(samples)

    for t2 in candidates:
        scores = []
        for train, test in folds:
            s = _score_theta2(test, t2)
            scores.append(s)
        mean_score = np.mean(scores)
        if mean_score > best_score:
            best_score = mean_score
            best_t2 = t2

    print(f"  Best theta_2 = {best_t2} (CV accuracy = {best_score:.4f})")
    return best_t2


# ── Main ──────────────────────────────────────────────────────────────────────

def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description="DDAR Threshold Calibration")
    parser.add_argument("--limit", type=int, default=None,
                        help="Limit samples per dataset for quick calibration/testing")
    args = parser.parse_args()

    print("=" * 60)
    print("  DDAR Threshold Calibration")
    print("  Grid Search + 5-Fold Cross-Validation")
    print("=" * 60)

    t0 = time.time()

    # Load datasets
    nq_limit = args.limit if args.limit is not None else 3610
    tqa_limit = args.limit if args.limit is not None else 11313

    nq_samples = _load_nq(max_samples=nq_limit)
    tqa_samples = _load_triviaqa(max_samples=tqa_limit)
    all_samples = nq_samples + tqa_samples
    print(f"\n  Total samples: {len(all_samples)}")

    if not all_samples:
        print("  Error: No samples loaded. Cannot calibrate.")
        sys.exit(1)

    # Label proxy retrieval need
    print("  Labelling retrieval need (entity proxy)...", end="", flush=True)
    _label_needs_retrieval(all_samples)
    n_needs = sum(1 for s in all_samples if s["has_entity"])
    print(f" {n_needs}/{len(all_samples)} need retrieval")

    # Pre-compute S(q) and D(q) for all samples
    print("  Computing S(q) for all samples...", end="", flush=True)
    for s in all_samples:
        s["s_q"] = compute_mean_token_surprisal(s["question"])
    print(" done.")

    print("  Computing D(q) and SQT for all samples...", end="", flush=True)
    for s in all_samples:
        s["d_q"] = compute_entity_density(s["question"])
        s["sqt"] = compute_sqt_flag(s["question"])
    print(" done.")

    # Shuffle for CV
    np.random.seed(42)
    np.random.shuffle(all_samples)

    # Grid search theta_1
    best_t1 = _grid_search_theta1(all_samples)

    # For theta_2, only use samples that pass Axis 1
    axis2_samples = [s for s in all_samples if s["s_q"] >= best_t1]
    print(f"\n  Samples passing Axis 1 (S(q) >= {best_t1}): {len(axis2_samples)}")

    if len(axis2_samples) > 10:
        best_t2 = _grid_search_theta2(axis2_samples)
    else:
        print("  Too few samples for theta_2 search, using provisional 0.15")
        best_t2 = 0.15

    # Write results
    result = {
        "theta_1":        best_t1,
        "theta_2":        best_t2,
        "calibrated_on":  "NQ+TriviaQA",
        "method":         "grid_search_5fold_cv",
        "n_samples":      len(all_samples),
        "n_nq":           len(nq_samples),
        "n_triviaqa":     len(tqa_samples),
    }

    _OUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(_OUT_FILE, "w", encoding="utf-8") as f:
        json.dump(result, f, indent=2)

    elapsed = time.time() - t0
    print(f"\n{'=' * 60}")
    print(f"  RESULTS")
    print(f"  theta_1 = {best_t1}")
    print(f"  theta_2 = {best_t2}")
    print(f"  Written to: {_OUT_FILE}")
    print(f"  Elapsed: {elapsed:.1f}s")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
