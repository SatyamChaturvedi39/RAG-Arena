"""
DDAR Router Configuration — Single Source of Truth.

All routing thresholds, corpus paths, and calibration state are defined here.
Every other router module (entropy.py, ner.py, dual_axis_router.py) imports
from this file.  No threshold values should be hardcoded anywhere else.

Provisional thresholds are overridden at import time if
``calibration/thresholds.json`` exists (produced by ``calibration/calibrate.py``).
"""
from __future__ import annotations

import json
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# ── Paths ─────────────────────────────────────────────────────────────────────

# Peter Norvig's word frequency corpus (Google Web Trillion Word Corpus)
CORPUS_PATH: Path = Path(__file__).parent / "data" / "count_1w.txt"

# Calibration output (written by calibration/calibrate.py)
_CALIBRATION_FILE: Path = Path(__file__).resolve().parent.parent.parent / "calibration" / "thresholds.json"

# ── Provisional thresholds ────────────────────────────────────────────────────
# Provisional threshold — replace with output of calibration/calibrate.py
# once experiments are complete.
# Note: THETA_1 = 11.5 was empirically determined during implementation testing, pending replacement by calibration/calibrate.py output.

THETA_1: float = 11.5   # Axis 1: mean token surprisal threshold (bits)
THETA_2: float = 0.15   # Axis 2: named entity density threshold

# ── Calibration override ──────────────────────────────────────────────────────

CALIBRATED: bool = False

def _load_calibrated_thresholds() -> None:
    """Load calibrated thresholds from calibration/thresholds.json if it exists."""
    global THETA_1, THETA_2, CALIBRATED

    if not _CALIBRATION_FILE.exists():
        logger.warning(
            "[DDAR] WARNING: Using provisional thresholds "
            "(theta_1=%.1f, theta_2=%.2f). "
            "Run calibration/calibrate.py on NQ+TriviaQA validation sets "
            "to get calibrated values.",
            THETA_1, THETA_2,
        )
        return

    try:
        with open(_CALIBRATION_FILE, "r", encoding="utf-8") as fh:
            data = json.load(fh)
        THETA_1 = float(data["theta_1"])
        THETA_2 = float(data["theta_2"])
        CALIBRATED = True
        logger.info(
            "[DDAR] Loaded calibrated thresholds from %s: "
            "theta_1=%.2f, theta_2=%.3f (method=%s, dataset=%s)",
            _CALIBRATION_FILE.name,
            THETA_1,
            THETA_2,
            data.get("method", "unknown"),
            data.get("calibrated_on", "unknown"),
        )
    except Exception as exc:
        logger.error(
            "[DDAR] Failed to load calibration file %s: %s. "
            "Falling back to provisional thresholds.",
            _CALIBRATION_FILE, exc,
        )


# Run at import time
_load_calibrated_thresholds()
