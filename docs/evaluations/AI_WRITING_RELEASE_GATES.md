# AI-Writing Signals: Release Gates (EXPERIMENTAL)

**Current status: NOT VALIDATED.** Stage `EXPERIMENTAL`. No release gate has been met.
Module: `backend/src/ai-writing/` · Model version: `ai-writing-heuristic-0.1.0-experimental`

## Purpose

The product owner reversed the earlier scope removal
(`docs/architecture/AI_DETECTION_DECISION.md`) and asked for AI-writing and
AI-paraphrasing assessment to come back as an **evaluation and implementation
workstream**, with release depending on evidence. This module gives
interpretable writing-style signals to support a teacher's **human review**. It
never accuses anyone, never estimates the probability that AI wrote the text,
and is **not equivalent to Turnitin** or any other commercial detector.

## Why it is experimental

- The documented accuracy and bias risks in the decision record still apply:
  higher false positives for non-native English writers, neurodivergent writers
  and formulaic genres, and weak detection of edited or paraphrased AI text.
- Feature weights, baselines and the operating threshold (`0.55`) were **chosen
  by inspection, not fitted** to labelled data. Accuracy is unknown.
- The only data in the repo is a 12-sample synthetic smoke set that has no
  evidentiary value (see `backend/eval-data/ai-writing/README.md`).

## How it works

`assessAiWriting(text, options)` computes the interpretable features below over
sentences. Each feature has a provisional "human baseline" range and a side
that the heuristic associates with AI text. Each feature's sub-score is a
logistic function that equals 0.5 at the edge of the baseline range, and the
overall score is the weighted mean of the sub-scores.

| Feature | Weight | AI-associated side |
|---|---|---|
| Sentence-length variation (coefficient of variation, "burstiness") | 0.20 | low |
| Transition/hedging phrase density per 100 words | 0.21 | high |
| Paragraph-length uniformity (≥ 3 paragraphs) | 0.12 | high |
| Vocabulary rarity (share of content words not in a small embedded common-word list) | 0.12 | high |
| Lexical diversity (moving-average type-token ratio, MATTR, 50-word window) | 0.08 | low |
| Function-word rate | 0.08 | low |
| Repeated three-word phrase rate | 0.08 | high |
| Punctuation diversity (normalised entropy) | 0.06 | low |
| Mean sentence length | 0.05 | high |

Weights sum to 1.0. Vocabulary rarity
deliberately treats *formal, less-common* words as the AI-associated side,
because the reverse would penalise developing and non-native writers.
Punctuation diversity has a low weight for the same reason.

- **Uncertainty.** The interval is a 200-resample bootstrap over sentences,
  seeded from a hash of the text so results are deterministic. Its half-width
  is never less than `0.5/√(sentences)`, so short texts always get wide bands.
- **Status rules** (applied in order):
  1. Fewer than `minWords` words (default 300) → `INSUFFICIENT_TEXT`.
  2. English function-word ratio below 0.25 → `UNSUPPORTED_LANGUAGE`.
  3. Interval wider than 0.35 → `INCONCLUSIVE`.
  4. Score ≥ threshold but the interval's lower bound is below the threshold →
     `INCONCLUSIVE`. This is a conservative addition to the original spec.
  5. Score ≥ threshold → `SIGNALS_FOR_REVIEW`.
  6. Otherwise → `NO_NOTABLE_SIGNALS`.
- **Segments.** Windows of about 3 sentences, each with character offsets, are
  returned only when the status is `SIGNALS_FOR_REVIEW`.
- **Paraphrase signal.** This needs `similarityContext` (near-match and
  exact-match word counts from the similarity engine). A score is reported only
  when there are at least 40 matched words, near matches make up at least 60%
  of matched words, and near matches cover at least 10% of the text. Otherwise
  the score is `null`, with a basis explaining what evidence was missing. Style
  alone is never used to infer paraphrasing.

## Proposed release gates (for product-owner approval)

These are defined in `RELEASE_GATES` (`backend/src/ai-writing/gates.ts`) and
checked by `evaluate()`:

| ID | Gate | Threshold |
|---|---|---|
| G1 | Dataset size and makeup | ≥ 2,000 independently sourced samples; ≥ 500 human and ≥ 500 AI; ≥ 200 human samples from non-native writers |
| G2 | Discrimination on held-out data | AUROC (human vs AI) ≥ 0.90, with ≥ 500 scored samples per class |
| G3 | Human false-positive rate at the operating threshold | ≤ 1%, and Wilson 95% upper bound ≤ 2% |
| G4 | Subgroup fairness | Highest/lowest smoothed human false-positive rate ≤ 1.5×, across ≥ 2 groups with ≥ 100 human samples each |
| G5 | Calibration | Expected calibration error ≤ 0.10 (10 bins) |
| G6 | Independent review | Signed sign-off from a reviewer outside the team (reviewer, organisation, date, reference) |

The report also includes AUROC and detection rates for `ai_paraphrased` and
`hybrid` samples. These are informational for now; the owner may decide to
add gates for them.

## Running an evaluation

```bash
cd backend
npx tsx scripts/eval-ai-writing.ts path/to/dataset.jsonl \
  [--min-words 300] [--threshold 0.55] [--sign-off reviewer.json] [--fail-on-gates]
```

This prints a JSON report and writes it to
`backend/eval-data/ai-writing/reports/<timestamp>.json`.
`--fail-on-gates` makes the script exit with code 2 when any gate fails, for
use in CI.

## Evidence required before `VALIDATED`

1. A dataset meeting G1. It must be consented, independently sourced, held out
   from all tuning, and cover the genres, grade levels and writer populations
   the product will actually serve.
2. Weights, baselines and threshold re-derived **only** on a separate
   development split, then frozen with a new `MODEL_VERSION`.
3. A harness run on the held-out split in which G1–G5 pass.
4. Independent reviewer sign-off (G6) covering provenance, the held-out
   protocol and the report.
5. A human creates `backend/eval-data/ai-writing/validated-evaluation.json`
   containing `gatesPassed: true`, the `evaluationId`, and the matching
   `modelVersion`. The module checks all three, and a validation never carries
   over to a different model version.

Even when `VALIDATED`, every safeguard and the human-review requirement stay in
force.

## UI requirements (mandatory for any integration)

- **Always show `safeguards`** next to any result, including when there are no
  notable signals.
- **Never show the score as a percentage of "AI"** or as a probability. Show the
  status, the uncertainty band, and the feature explanations instead.
- **Never show it to students** unless the institution explicitly turns this
  on. It is off by default and is a teacher-only view.
- **The teacher must record a human review decision**: reviewer, decision,
  rationale and timestamp. No automated action, grade change or misconduct
  referral may be triggered by the signal.
- Show `releaseGate.stage` (EXPERIMENTAL) prominently. Treat
  `INCONCLUSIVE`, `INSUFFICIENT_TEXT` and `UNSUPPORTED_LANGUAGE` as "no
  assessment", not as either signal or clearance.
- Highlight segments only as "areas the reviewer may wish to read closely".

## Current status

| Item | Status |
|---|---|
| Implementation | Experimental heuristic, deterministic, unit-tested |
| Qualifying dataset | **None** |
| Smoke run (12 synthetic samples, `--min-words 100`) | 0/6 gates passed (expected) |
| Stage | **EXPERIMENTAL — NOT VALIDATED** |
