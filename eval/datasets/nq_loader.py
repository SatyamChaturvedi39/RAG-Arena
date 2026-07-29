"""
Natural Questions Open (NQ-Open) dataset loader.
HuggingFace: nq_open, split=validation.
Flat schema: {"question": str, "answer": list[str]}.

Note: NOT google-research-datasets/natural_questions — that dataset has a complex
nested annotation format (item["annotations"][0]["short_answers"][N]["text"])
which is error-prone. nq_open is the clean, already-filtered version.
"""
from __future__ import annotations


def load(max_samples: int = 3610) -> list[dict]:
    """
    Load NQ-Open validation split.

    Returns list of {"question": str, "answers": list[str], "dataset": "nq"}.
    """
    from datasets import load_dataset  # type: ignore

    ds = load_dataset(
        "google-research-datasets/nq_open",
        split="validation",
    )
    samples: list[dict] = []

    for item in ds:
        if len(samples) >= max_samples:
            break
        try:
            question = item["question"]
            answers = item["answer"]          # already a list[str] in nq_open
            if not answers:
                continue
            samples.append({
                "question": question,
                "answers":  answers,
                "dataset":  "nq",
            })
        except (KeyError, IndexError, TypeError):
            continue

    return samples
