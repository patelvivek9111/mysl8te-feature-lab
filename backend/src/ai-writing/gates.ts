import * as fs from 'fs';
import * as path from 'path';
import type { ReleaseGateStatus } from './types';

export const MODEL_VERSION = 'ai-writing-heuristic-0.1.0-experimental';

/** Unvalidated operating point; must be re-set from a qualifying evaluation. */
export const OPERATING_THRESHOLD = 0.55;

export const DEFAULT_MIN_WORDS = 300;

export const MAX_INTERVAL_WIDTH = 0.35;

export const SAFEGUARDS: readonly string[] = [
  'Not evidence of misconduct. This is a heuristic writing-style signal, not a determination of authorship.',
  'Requires human review. A teacher must review the work and record a decision; no action may be taken on this signal alone.',
  'The score is a heuristic signal strength, not a probability or a percentage of AI-written text.',
  'Known higher false-positive risk for non-native English writers, neurodivergent writers, and formulaic genres (lab reports, templates, legal or technical prose).',
  'Human-edited, paraphrased, or "humanised" AI text is often not flagged; absence of signals is not evidence of independent work.',
  'Experimental and not validated: accuracy has not been established on independent data. Not equivalent to any commercial detector.',
];

/**
 * PROPOSED gates for the product owner's approval. They are deliberately
 * strict; none has been met by this module.
 */
export const RELEASE_GATES: { id: string; description: string; threshold: string }[] = [
  {
    id: 'G1_DATASET_SIZE',
    description:
      'Labelled evaluation set of independently sourced samples, including human writing by non-native English writers (group name matching /non[-_ ]?native|esl|ell/i).',
    threshold: '>= 2000 samples total; >= 500 human and >= 500 ai; >= 200 human samples in a non-native group',
  },
  {
    id: 'G2_AUROC',
    description: 'Discrimination between human and AI-generated text on held-out data not used to tune weights or thresholds.',
    threshold: 'AUROC (human vs ai) >= 0.90, with >= 500 scored human and >= 500 scored ai samples',
  },
  {
    id: 'G3_HUMAN_FPR',
    description: 'False-positive rate on human-written samples at the operating threshold.',
    threshold: 'FPR <= 1% and Wilson 95% upper bound <= 2%, with >= 500 scored human and ai samples',
  },
  {
    id: 'G4_SUBGROUP_DISPARITY',
    description: 'Ratio of the highest to lowest smoothed human FPR across subgroups with >= 100 human samples (at least 2 such groups required).',
    threshold: 'max/min smoothed FPR <= 1.5 (ratio is 1 when no group has a false positive)',
  },
  {
    id: 'G5_CALIBRATION',
    description: 'Expected calibration error of score vs observed AI rate (human vs ai samples, 10 equal-width bins).',
    threshold: 'ECE <= 0.10, with >= 500 scored human and ai samples',
  },
  {
    id: 'G6_INDEPENDENT_SIGN_OFF',
    description:
      'Independent reviewer (not on the implementing team) has reviewed the dataset provenance, held-out protocol and results.',
    threshold: 'Signed reviewer record supplied (reviewer, organization, date, reference)',
  },
];

export const VALIDATED_RECORD_PATH = path.resolve(__dirname, '../../eval-data/ai-writing/validated-evaluation.json');

const EXPERIMENTAL_NOTES =
  'Experimental heuristic. No evaluation meeting the release gates has been recorded; results must not be used for decisions about students.';

/**
 * VALIDATED only when the record exists, has gatesPassed === true, a non-empty
 * evaluationId, and a modelVersion matching this build (a validation of one
 * version never carries over to another).
 */
export function resolveReleaseGate(recordPath: string = VALIDATED_RECORD_PATH): ReleaseGateStatus {
  const experimental = (notes: string): ReleaseGateStatus => ({
    stage: 'EXPERIMENTAL',
    validated: false,
    evaluationId: null,
    notes,
  });
  let raw: string;
  try {
    raw = fs.readFileSync(recordPath, 'utf8');
  } catch {
    return experimental(EXPERIMENTAL_NOTES);
  }
  let record: unknown;
  try {
    record = JSON.parse(raw);
  } catch {
    return experimental(`${EXPERIMENTAL_NOTES} A validation record exists but is not valid JSON.`);
  }
  const r = (record ?? {}) as Record<string, unknown>;
  if (r.gatesPassed !== true) {
    return experimental(`${EXPERIMENTAL_NOTES} The recorded evaluation did not pass all gates.`);
  }
  if (typeof r.evaluationId !== 'string' || r.evaluationId.length === 0) {
    return experimental(`${EXPERIMENTAL_NOTES} The validation record has no evaluationId.`);
  }
  if (r.modelVersion !== MODEL_VERSION) {
    return experimental(
      `${EXPERIMENTAL_NOTES} The validation record is for model version ${String(r.modelVersion)}, not ${MODEL_VERSION}.`,
    );
  }
  return {
    stage: 'VALIDATED',
    validated: true,
    evaluationId: r.evaluationId,
    notes: 'Release gates passed for this model version. Human review remains mandatory; safeguards still apply.',
  };
}
