"""
TriviaQA dataset loader.
HuggingFace: mandarjoshi/trivia_qa, config=rc.wikipedia, split=validation.
Limit to 11,313 samples.
"""
from __future__ import annotations


def load(max_samples: int = 11313) -> list[dict]:
    """
    Load TriviaQA rc.wikipedia validation split.

    Returns list of {"question": str, "answers": list[str], "dataset": "triviaqa"}.
    """
    from datasets import load_dataset  # type: ignore

    ds = load_dataset(
        "mandarjoshi/trivia_qa",
        "rc.wikipedia",
        split="validation",
    )
    samples: list[dict] = []

    for item in ds:
        if len(samples) >= max_samples:
            break
        try:
            question = item["question"]
            aliases  = item["answer"]["aliases"]
            if not aliases:
                aliases = [item["answer"]["value"]]
            samples.append({
                "question": question,
                "answers":  list(aliases),
                "dataset":  "triviaqa",
            })
        except (KeyError, TypeError):
            continue

    return samples
