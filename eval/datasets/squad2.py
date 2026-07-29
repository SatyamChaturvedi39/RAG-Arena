"""
SQuAD 2.0 dataset loader.
HuggingFace: rajpurkar/squad_v2, split=validation.
"""
from __future__ import annotations


def load(max_samples: int = 11873) -> list[dict]:
    """
    Load SQuAD v2 validation split.
    For examples where answers["text"] is empty, the expected answer is set to ""
    and the query is flagged is_unanswerable = True.
    """
    from datasets import load_dataset  # type: ignore

    ds = load_dataset(
        "rajpurkar/squad_v2",
        split="validation",
    )
    samples: list[dict] = []

    for item in ds:
        if len(samples) >= max_samples:
            break
        try:
            answers = item["answers"]["text"]
            is_unanswerable = len(answers) == 0
            samples.append({
                "question":      item["question"],
                "answers":       list(answers) if answers else [""],
                "dataset":       "squad",
                "is_unanswerable":  is_unanswerable,
            })
        except (KeyError, TypeError):
            continue

    return samples
