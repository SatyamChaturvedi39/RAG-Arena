"""
Eval system configuration.

Defines datasets, baselines, and shared paths used by the eval runner.
"""
from pathlib import Path

# ── Dataset definitions ───────────────────────────────────────────────────────

EVAL_DATASETS: dict[str, dict] = {
    "nq": {
        "hf_path": "google-research-datasets/natural_questions",
        "hf_split": "validation",
        "max_samples": 3610,
        "primary_metric": "em",
    },
    "triviaqa": {
        "hf_path": "mandarjoshi/trivia_qa",
        "hf_config": "rc.wikipedia",
        "hf_split": "validation",
        "max_samples": 11313,
        "primary_metric": "f1",
    },
    "squad": {
        "hf_path": "rajpurkar/squad_v2",
        "hf_split": "validation",
        "max_samples": 11873,
        "primary_metric": "f1",
    },
    "asqa": {
        "hf_path": "din0s/asqa",
        "hf_split": "dev",
        "max_samples": 948,
        "primary_metric": "f1",
    },
    "bioasq": {
        "hf_path": "rag-datasets/rag-mini-bioasq",
        "hf_config": "question-answer-passages",
        "hf_split": "test",
        "max_samples": 300,
        "primary_metric": "f1",
    },
}

# ── Baseline system names ─────────────────────────────────────────────────────

BASELINES: list[str] = [
    "standard_rag",    # always vector, no routing
    "adaptive_rag",    # classify then route (existing classifier), always embeds
    "embedding_free",  # always vectorless, no embeddings
    "dual_axis",       # DDAR — our router
]

# ── Results directory ─────────────────────────────────────────────────────────

RESULTS_DIR: Path = Path(__file__).parent / "results"
RESULTS_DIR.mkdir(exist_ok=True)

# ── Model for parametric generation during eval ───────────────────────────────

EVAL_GROQ_MODEL: str = "llama-3.3-70b-versatile"
EVAL_MAX_TOKENS: int = 256
EVAL_TEMPERATURE: float = 0.1

# ── Open-domain QA prompt used when routing goes to VECTOR or VECTORLESS ─────
# (in eval mode we can't do real retrieval on benchmark docs, so we simulate
#  the routing decision and measure parametric answer quality + routing behaviour)

OPEN_DOMAIN_QA_PROMPT: str = """\
You are a knowledgeable assistant. Answer the following question as concisely \
as possible using your training knowledge.

Question: {question}

Give only the factual answer, no explanation."""
