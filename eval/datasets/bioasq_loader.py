"""
BioASQ dataset loader.

Tries sources in order:
  1. Local file at eval/data/bioasq.json  (manual download)
  2. HuggingFace rag-datasets/rag-mini-bioasq (community mirror, no registration)

BioASQ Task B Phase A requires manual registration at https://bioasq.org.
If the HF mirror is also unavailable, returns [] and prints instructions.
"""
from __future__ import annotations

import os
import json

BIOASQ_LOCAL_PATH = os.path.join(os.path.dirname(__file__), "..", "data", "bioasq.json")


def _flatten_to_strings(val) -> list[str]:
    """Recursively flatten any nested list/str into a flat list[str]."""
    if isinstance(val, str):
        return [val] if val.strip() else []
    if isinstance(val, list):
        out = []
        for item in val:
            out.extend(_flatten_to_strings(item))
        return out
    s = str(val)
    return [s] if s.strip() else []


def load(max_samples: int = 300) -> list[dict]:
    """
    Load BioASQ samples.

    Returns list of {"question": str, "answers": list[str], "dataset": "bioasq"}.
    Returns [] if no source is available — the eval runner will skip BioASQ
    and log "BioASQ: skipped (manual download required)" in the CSV output.
    """
    # ── Source 1: local JSON file (manual download) ────────────────────────────
    if os.path.exists(BIOASQ_LOCAL_PATH):
        try:
            with open(BIOASQ_LOCAL_PATH, encoding="utf-8") as f:
                raw = json.load(f)
            # BioASQ official download wraps items under a "questions" key
            if isinstance(raw, dict):
                raw = raw.get("questions", [])
            samples: list[dict] = []
            for item in raw[:max_samples]:
                q = item.get("body") or item.get("question", "")
                raw_ans = item.get("exact_answer") or item.get("ideal_answer") or []
                ans = _flatten_to_strings(raw_ans)
                if not q or not ans:
                    continue
                samples.append({"question": q, "answers": ans, "dataset": "bioasq"})
            return samples
        except Exception as e:
            print(f"[BioASQ] Failed to read local file {BIOASQ_LOCAL_PATH}: {e}")

    # ── Source 2: HuggingFace community mirror ─────────────────────────────────
    try:
        import sys as _sys, importlib as _importlib
        _hf = _sys.modules.get("datasets")
        if _hf is None or not hasattr(_hf, "load_dataset"):
            _sys.modules.pop("datasets", None)
            _saved = _sys.path[:]
            _sys.path = [p for p in _sys.path
                         if not (p.endswith("eval") or p.endswith("eval\\") or p.endswith("eval/"))]
            _hf = _importlib.import_module("datasets")
            _sys.path = _saved
        load_dataset = _hf.load_dataset

        ds = load_dataset(
            "rag-datasets/rag-mini-bioasq",
            "question-answer-passages",
            split="test",
        )
        samples = []
        for item in ds:
            if len(samples) >= max_samples:
                break
            try:
                question = item["question"]
                answer   = item["answer"]
                if not answer:
                    continue
                # Normalize to flat list[str] — HF mirror returns a plain string
                if isinstance(answer, list):
                    answers = [str(a) for a in answer if a]
                else:
                    answers = [str(answer)]
                if not answers:
                    continue
                samples.append({
                    "question": question,
                    "answers":  answers,
                    "dataset":  "bioasq",
                })
            except (KeyError, TypeError):
                continue
        return samples

    except Exception:
        print(
            "\n[BioASQ] Dataset not found. BioASQ requires manual registration at "
            "https://participants-area.bioasq.org/datasets -- download Task B Phase A "
            "and place the JSON file at eval/data/bioasq.json, then re-run.\n"
        )
        return []
