"""Slot recommender.

Approach (robust-by-design, works offline with zero external ML deps):

* **Learned-from-history scorer.** For a recipient we combine their own per-slot
  success history with a global prior via Laplace / empirical-Bayes smoothing:

      score(slot) = (successes + alpha * prior) / (attempts + alpha)

  This is a genuine statistical model — it *learns* each recipient's pattern
  from the seeded delivery outcomes — yet degrades gracefully: a brand-new
  ("cold-start") recipient falls back entirely to the global prior.

* **Optional trained upgrade.** ``app/ml/train.py`` can fit a scikit-learn
  classifier and dump it to ``model.joblib``; ``load_model`` picks it up if
  present. If scikit-learn or the artifact is missing, we transparently use the
  scorer above. Either way, *rules* (see ``feasibility.py``) decide what's
  actually offerable — the model only ranks.

We never expose raw scores/probabilities to customers — only a friendly reason.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.ml.features import slot_success_counts

DEFAULT_ALPHA = 2.0
# Sensible fallback ordering when we have no signal at all.
DEFAULT_PRIOR = {"EVENING": 0.62, "MORNING": 0.55, "AFTERNOON": 0.5, "MIDDAY": 0.45}

_REASON = {
    "MORNING": ("Usually reachable in the morning", "सुबह आमतौर पर उपलब्ध रहते हैं"),
    "MIDDAY": ("Usually reachable around midday", "दोपहर में आमतौर पर उपलब्ध रहते हैं"),
    "AFTERNOON": ("Usually reachable in the afternoon", "अपराह्न में आमतौर पर उपलब्ध रहते हैं"),
    "EVENING": ("Usually reachable in the evening", "शाम को आमतौर पर उपलब्ध रहते हैं"),
}
_REASON_COLD = (
    "A popular, reliable delivery time in this area",
    "इस क्षेत्र में एक लोकप्रिय, भरोसेमंद डिलीवरी समय",
)


@dataclass
class SlotScore:
    slot_code: str
    score: float
    successes: int
    attempts: int


@dataclass
class Recommendation:
    slot_code: str | None
    scores: dict[str, float]
    reason_en: str
    reason_hi: str
    model_version: str


def score_slots(
    history: list[tuple[str, bool]],
    candidate_slot_codes: list[str],
    prior: dict[str, float] | None = None,
    alpha: float = DEFAULT_ALPHA,
) -> list[SlotScore]:
    prior = prior or DEFAULT_PRIOR
    counts = slot_success_counts(history)
    out: list[SlotScore] = []
    for code in candidate_slot_codes:
        successes, attempts = counts.get(code, (0, 0))
        p = prior.get(code, 0.5)
        score = (successes + alpha * p) / (attempts + alpha)
        out.append(SlotScore(code, score, successes, attempts))
    return out


def recommend(
    history: list[tuple[str, bool]],
    candidate_slot_codes: list[str],
    prior: dict[str, float] | None = None,
    alpha: float = DEFAULT_ALPHA,
    model_version: str = "history-bayes-v1",
) -> Recommendation:
    if not candidate_slot_codes:
        return Recommendation(None, {}, "No feasible time available", "कोई उपलब्ध समय नहीं", model_version)

    scored = score_slots(history, candidate_slot_codes, prior, alpha)
    scored.sort(key=lambda s: (s.score, s.attempts), reverse=True)
    best = scored[0]
    scores = {s.slot_code: round(s.score, 4) for s in scored}

    # Confident personal signal → slot-specific reason; otherwise a cold reason.
    has_personal_signal = any(s.attempts > 0 for s in scored)
    if has_personal_signal and best.attempts > 0:
        reason_en, reason_hi = _REASON.get(best.slot_code, _REASON_COLD)
    else:
        reason_en, reason_hi = _REASON_COLD

    return Recommendation(best.slot_code, scores, reason_en, reason_hi, model_version)


def load_model():
    """Return a trained sklearn model if available, else None (use the scorer).

    Kept dependency-optional: absence of joblib / the artifact is not an error.
    """
    try:
        import os

        import joblib  # type: ignore
    except Exception:
        return None
    path = os.path.join(os.path.dirname(__file__), "model.joblib")
    if not os.path.exists(path):
        return None
    try:
        return joblib.load(path)
    except Exception:
        return None
