"""
Axis 1 of the Deterministic Dual-Axis Router — Mean Token Surprisal.

Computes the mean per-token surprisal of a query against Peter Norvig's
word frequency corpus (count_1w.txt, ~333 000 words from Google's Web
Trillion Word Corpus, N_total ~ 1 024 908 267 229).

Formula
-------
    S(q) = (1 / |T|) * sum( -log2( p_hat(w) )  for w in T )

where:
    T       = set of alphabetic tokens in the query (lowercased, len >= 2)
    |T|     = number of such tokens
    p_hat(w) = count(w) / N_total       if w is in the corpus
    p_hat(w) = 1 / N_total              if w is NOT in the corpus (smoothed
                to the lowest possible positive probability, giving it the
                highest possible surprisal — unknown / rare words look
                maximally suspicious to the router)

Threshold
---------
    THETA_1 is imported from ``router.router_config`` (single source of
    truth).  The provisional value is 11.5 bits.  It will be replaced by
    the output of ``calibration/calibrate.py`` once experiments are complete.

When S(q) < THETA_1 the query is routed to PARAMETRIC (no retrieval).
"""
from __future__ import annotations

import math
import re
from pathlib import Path

from router.router_config import CORPUS_PATH, THETA_1

# ── Constants ─────────────────────────────────────────────────────────────────

_MIN_TOKEN_LEN = 2  # ignore single-char tokens (a, I, …)

# ── Fallback: 500 most common English words (used when corpus file missing) ──

_FALLBACK_WORDS = [
    "the", "be", "to", "of", "and", "a", "in", "that", "have", "it",
    "for", "not", "on", "with", "he", "as", "you", "do", "at", "this",
    "but", "his", "by", "from", "they", "we", "say", "her", "she", "or",
    "an", "will", "my", "one", "all", "would", "there", "their", "what",
    "so", "up", "out", "if", "about", "who", "get", "which", "go", "me",
    "when", "make", "can", "like", "time", "no", "just", "him", "know",
    "take", "people", "into", "year", "your", "good", "some", "could",
    "them", "see", "other", "than", "then", "now", "look", "only", "come",
    "its", "over", "think", "also", "back", "after", "use", "two", "how",
    "our", "work", "first", "well", "way", "even", "new", "want", "because",
    "any", "these", "give", "day", "most", "us", "great", "between", "need",
    "large", "often", "hand", "high", "place", "hold", "set", "turn", "here",
    "why", "ask", "went", "men", "read", "need", "land", "different", "home",
    "move", "try", "kind", "hand", "picture", "again", "change", "off",
    "play", "spell", "air", "away", "animal", "house", "point", "page",
    "letter", "mother", "answer", "found", "study", "still", "learn",
    "plant", "cover", "food", "sun", "four", "between", "state", "keep",
    "eye", "never", "last", "let", "thought", "city", "tree", "cross",
    "farm", "hard", "start", "might", "story", "saw", "far", "sea",
    "draw", "left", "late", "run", "don", "while", "press", "close",
    "night", "real", "life", "few", "north", "open", "seem", "together",
    "next", "white", "children", "begin", "got", "walk", "example",
    "ease", "paper", "group", "always", "music", "those", "both", "mark",
    "book", "carry", "took", "science", "eat", "room", "friend", "began",
    "idea", "fish", "mountain", "stop", "once", "base", "hear", "horse",
    "cut", "sure", "watch", "color", "face", "wood", "main", "enough",
    "plain", "girl", "usual", "young", "ready", "above", "ever", "red",
    "list", "though", "feel", "talk", "bird", "soon", "body", "dog",
    "family", "direct", "pose", "leave", "song", "measure", "door",
    "product", "black", "short", "numeral", "class", "wind", "question",
    "happen", "complete", "ship", "area", "half", "rock", "order", "fire",
    "south", "problem", "piece", "told", "knew", "pass", "since", "top",
    "whole", "king", "space", "heard", "best", "hour", "better", "true",
    "during", "hundred", "five", "remember", "step", "early", "hold",
    "west", "ground", "interest", "reach", "fast", "verb", "sing",
    "listen", "six", "table", "travel", "less", "morning", "ten", "simple",
    "several", "vowel", "toward", "war", "lay", "against", "pattern",
    "slow", "center", "love", "person", "money", "serve", "appear",
    "road", "map", "rain", "rule", "govern", "pull", "cold", "notice",
    "voice", "unit", "power", "town", "fine", "drive", "lead", "cry",
    "dark", "machine", "note", "wait", "plan", "figure", "star", "box",
    "noun", "field", "rest", "correct", "able", "pound", "done", "beauty",
    "drive", "stood", "contain", "front", "teach", "week", "final", "gave",
    "green", "oh", "quick", "develop", "ocean", "warm", "free", "minute",
    "strong", "special", "behind", "clear", "tail", "produce", "fact",
    "street", "inch", "multiply", "nothing", "course", "stay", "wheel",
    "full", "force", "blue", "object", "decide", "surface", "deep",
    "moon", "island", "foot", "system", "busy", "test", "record", "boat",
    "common", "gold", "possible", "plane", "stead", "dry", "wonder",
    "laugh", "thousand", "ago", "ran", "check", "game", "shape", "equate",
    "hot", "miss", "brought", "heat", "snow", "tire", "bring", "yes",
    "distant", "fill", "east", "paint", "language", "among",
]


# ── Module-level corpus loading ───────────────────────────────────────────────

def _load_corpus() -> tuple[dict[str, int], int]:
    """
    Load word -> raw count mapping from count_1w.txt.

    Returns (counts_dict, N_total).
    Falls back to a uniform distribution over the fallback word list.
    """
    try:
        if not CORPUS_PATH.exists():
            raise FileNotFoundError(f"Corpus not found at {CORPUS_PATH}")

        counts: dict[str, int] = {}
        total = 0
        with open(CORPUS_PATH, "r", encoding="utf-8") as fh:
            for line in fh:
                parts = line.strip().split("\t")
                if len(parts) != 2:
                    continue
                word, count_str = parts
                try:
                    c = int(count_str)
                    counts[word.lower()] = c
                    total += c
                except ValueError:
                    continue

        if total == 0:
            raise ValueError("Corpus loaded but total count is 0")

        return counts, total

    except Exception:
        # Fallback: each word gets count=1, total = len(fallback)
        n = len(set(_FALLBACK_WORDS))
        counts = {w: 1 for w in _FALLBACK_WORDS}
        return counts, n


# Load once at import time
_COUNTS, _N_TOTAL = _load_corpus()

# Maximum surprisal for OOV words: -log2(1 / N_total) = log2(N_total)
_MAX_SURPRISAL: float = math.log2(_N_TOTAL) if _N_TOTAL > 0 else 40.0


# ── Public API ────────────────────────────────────────────────────────────────

def compute_mean_token_surprisal(query: str) -> float:
    """
    Compute mean per-token surprisal of *query* against the Norvig corpus.

    Formula:  S(q) = (1/|T|) * sum( -log2(p_hat(w))  for w in T )

    where T is the set of alphabetic tokens (lowercased, length >= 2),
    p_hat(w) = count(w)/N_total for known words, 1/N_total for OOV.

    Returns 0.0 if the query has zero extractable tokens.
    """
    tokens = re.findall(r"[a-z]+", query.lower())
    tokens = [t for t in tokens if len(t) >= _MIN_TOKEN_LEN]

    if not tokens:
        return 0.0

    total_surprisal = 0.0
    for token in tokens:
        count = _COUNTS.get(token)
        if count is not None and count > 0:
            # -log2(count / N_total) = log2(N_total) - log2(count)
            surprisal = math.log2(_N_TOTAL) - math.log2(count)
        else:
            # OOV: p_hat = 1 / N_total  =>  surprisal = log2(N_total)
            surprisal = _MAX_SURPRISAL
        total_surprisal += surprisal

    return round(total_surprisal / len(tokens), 4)


def needs_retrieval(query: str, threshold: float | None = None) -> bool:
    """
    Returns True (proceed to Axis 2) when mean token surprisal >= threshold.
    Returns False (skip retrieval → PARAMETRIC) when surprisal < threshold.

    Threshold defaults to THETA_1 from router_config.py.
    """
    if threshold is None:
        threshold = THETA_1
    return compute_mean_token_surprisal(query) >= threshold
