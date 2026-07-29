"""
SQuAD 2.0 dataset loader.
HuggingFace: rajpurkar/squad_v2, split=validation.

Includes unanswerable questions with an "unanswerable" flag.
11,873 examples total.
"""
from __future__ import annotations


def load(max_samples: int = 11873) -> list[dict]:
    """
    Load SQuAD v2 validation split.

    Includes BOTH answerable and unanswerable questions.
    Unanswerable questions have answers=[] and unanswerable=True.

    Returns list of:
        {"question": str, "answers": list[str], "dataset": "squad",
         "unanswerable": bool}
    """
    from datasets import load_dataset  # type: ignore

    ds = load_dataset(
        "rajpurkar/squad_v2",
        split="validation",
        trust_remote_code=True,
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
                "answers":       list(answers) if answers else [],
                "dataset":       "squad",
                "unanswerable":  is_unanswerable,
            })
        except (KeyError, TypeError):
            continue

    return samples
