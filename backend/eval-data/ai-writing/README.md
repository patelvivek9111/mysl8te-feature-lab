# AI-writing evaluation data

## `smoke.jsonl` — SYNTHETIC PLUMBING TEST ONLY

**This file has NO evidentiary value and MUST NOT be used to claim, estimate or
imply accuracy, false-positive rates, or fitness for release.**

- All 12 samples, **including those labelled `human`**, were written by an AI
  coding assistant imitating different styles. The labels are nominal and do
  not describe how the text was actually produced.
- The `ai` samples are exaggerated caricatures of LLM style written by the same
  author who chose the heuristic's features. Any separation seen on this file is
  circular and expected.
- The samples are ~140–170 words, below the default 300-word minimum. Run the
  smoke test with `--min-words 100` so the scoring path is exercised.
- The `group` values (`native_en`, `non_native_en`, `synthetic_ai_style`) are
  imitations, not samples from real writers in those groups.

It exists only so the harness, metrics and report format can be exercised end
to end:

```bash
cd backend
npx tsx scripts/eval-ai-writing.ts eval-data/ai-writing/smoke.jsonl --min-words 100
```

Expected and correct outcome: **all release gates fail** (dataset size,
insufficient samples for the metric gates, no subgroup data, no reviewer
sign-off).

## Real evaluation data

A qualifying dataset (see `docs/evaluations/AI_WRITING_RELEASE_GATES.md`) must be
independently sourced, consented, held out from any tuning, and stored outside
this repository if it contains student work. JSONL format, one object per line:

```json
{"id": "s-0001", "text": "...", "label": "human", "group": "non_native_en"}
```

`label` is one of `human`, `ai`, `ai_paraphrased`, `hybrid`. `group` is optional
and is used for per-subgroup false-positive rates (G4). A group whose name
matches `non[-_ ]?native|esl|ell` counts toward the non-native requirement (G1).

## `reports/`

Timestamped JSON reports written by the harness. The committed smoke report is
a plumbing artefact only.

## `validated-evaluation.json` (intentionally absent)

The module reports `VALIDATED` only if this file exists with
`"gatesPassed": true`, a non-empty `evaluationId`, and a `modelVersion` equal to
the running module's `MODEL_VERSION`. Only create it after a qualifying
evaluation passes every gate **and** an independent reviewer has signed off.
The harness never writes it.
