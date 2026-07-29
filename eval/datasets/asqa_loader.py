"""
ASQA dataset loader.
HuggingFace: din0s/asqa, split=dev.

Uses annotations[*]["long_answer"] for ROUGE-L reference strings
(take max score across all long-answer references during evaluation).
948 examples.
"""
from __future__ import annotations


def load(max_samples: int = 948) -> list[dict]:
    """
    Load ASQA dev split.

    Returns list of {"question": str, "answers": list[str], "dataset": "asqa"}.

    answers contains all long_answer strings from annotations for
    multi-reference ROUGE-L scoring (take max across references).
    """
    from datasets import load_dataset  # type: ignore

    ds = load_dataset("din0s/asqa", split="dev", trust_remote_code=True)
    samples: list[dict] = []

    for item in ds:
        if len(samples) >= max_samples:
            break
        try:
            question = item["ambiguous_question"]

            # Collect all long_answer strings from annotations
            answers: list[str] = []
            annotations = item.get("annotations", [])
            if annotations:
                for ann in annotations:
                    la = ann.get("long_answer", "")
                    if la and isinstance(la, str) and la.strip():
                        answers.append(la.strip())

            # Fallback: also collect short answers from qa_pairs
            if not answers:
                qa_pairs = item.get("qa_pairs", [])
                for pair in qa_pairs:
                    a = pair.get("answer", "")
                    if a and isinstance(a, str) and a.strip():
                        answers.append(a.strip())

            if not answers:
                continue

            samples.append({
                "question": question,
                "answers":  answers,
                "dataset":  "asqa",
            })
        except (KeyError, TypeError):
            continue

    return samples
