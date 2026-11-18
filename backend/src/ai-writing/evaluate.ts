import { assessAiWriting } from './assess';
import { DEFAULT_MIN_WORDS, MODEL_VERSION, OPERATING_THRESHOLD, RELEASE_GATES } from './gates';
import { hashString } from './text';
import type {
  AssessmentStatus,
  CalibrationBin,
  EvaluateOptions,
  EvaluationReport,
  GateResult,
  GroupFpr,
  LabeledSample,
  SampleLabel,
} from './types';

const LABELS: SampleLabel[] = ['human', 'ai', 'ai_paraphrased', 'hybrid'];
const NON_NATIVE_GROUP_RE = /non[-_ ]?native|esl|ell/i;
const MIN_GROUP_N_FOR_DISPARITY = 100;
const CALIBRATION_BINS = 10;
/** Metric gates (G2, G3, G5) cannot pass on fewer scored samples than this per class. */
const MIN_SCORED_PER_CLASS = 500;

const round = (x: number, d = 4): number => Math.round(x * 10 ** d) / 10 ** d;
const roundOrNull = (x: number | null): number | null => (x === null ? null : round(x));

/** Mann-Whitney AUROC: P(positive score > negative score), ties counted as 0.5. Null if either side is empty. */
export function computeAuroc(negatives: number[], positives: number[]): number | null {
  if (negatives.length === 0 || positives.length === 0) return null;
  const all = [
    ...negatives.map((s) => ({ s, pos: false })),
    ...positives.map((s) => ({ s, pos: true })),
  ].sort((a, b) => a.s - b.s);
  let rankSumPos = 0;
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j + 1 < all.length && all[j + 1].s === all[i].s) j++;
    const avgRank = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) if (all[k].pos) rankSumPos += avgRank;
    i = j + 1;
  }
  const nP = positives.length;
  const nN = negatives.length;
  return (rankSumPos - (nP * (nP + 1)) / 2) / (nP * nN);
}

export function wilsonUpper95(successes: number, n: number): number | null {
  if (n === 0) return null;
  const z = 1.959964;
  const p = successes / n;
  const denom = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return Math.min(1, (centre + margin) / denom);
}

function labelRecord<T>(make: () => T): Record<SampleLabel, T> {
  return { human: make(), ai: make(), ai_paraphrased: make(), hybrid: make() };
}

function calibration(humanScores: number[], aiScores: number[]): { bins: CalibrationBin[]; ece: number | null } {
  const pts = [...humanScores.map((s) => ({ s, y: 0 })), ...aiScores.map((s) => ({ s, y: 1 }))];
  const bins: CalibrationBin[] = [];
  let ece = 0;
  for (let b = 0; b < CALIBRATION_BINS; b++) {
    const low = b / CALIBRATION_BINS;
    const high = (b + 1) / CALIBRATION_BINS;
    const inBin = pts.filter((p) => p.s >= low && (b === CALIBRATION_BINS - 1 ? p.s <= high : p.s < high));
    const count = inBin.length;
    const meanScore = count ? inBin.reduce((a, p) => a + p.s, 0) / count : null;
    const observedAiRate = count ? inBin.reduce((a, p) => a + p.y, 0) / count : null;
    if (count && meanScore !== null && observedAiRate !== null) {
      ece += (count / pts.length) * Math.abs(meanScore - observedAiRate);
    }
    bins.push({ low, high, count, meanScore: roundOrNull(meanScore), observedAiRate: roundOrNull(observedAiRate) });
  }
  return { bins, ece: pts.length ? round(ece) : null };
}

function fmt(x: number | null, pct = false): string {
  if (x === null) return 'n/a';
  return pct ? `${(x * 100).toFixed(2)}%` : x.toFixed(4);
}

export function evaluate(dataset: LabeledSample[], options: EvaluateOptions = {}): EvaluationReport {
  const minWords = options.minWords ?? DEFAULT_MIN_WORDS;
  const threshold = options.operatingThreshold ?? OPERATING_THRESHOLD;
  const byLabel = labelRecord(() => 0);
  const scoredByLabel = labelRecord(() => 0);
  const statusCountsByLabel = labelRecord<Partial<Record<AssessmentStatus, number>>>(() => ({}));
  const scores = labelRecord<number[]>(() => []);
  const humanByGroup = new Map<string, { n: number; fp: number }>();
  const notScored = { insufficientText: 0, unsupportedLanguage: 0, other: 0 };

  for (const sample of dataset) {
    if (!LABELS.includes(sample.label)) throw new Error(`Unknown label "${String(sample.label)}" for sample ${sample.id}`);
    byLabel[sample.label]++;
    let score: number | null;
    if (options.scoreFn) {
      score = options.scoreFn(sample.text);
      if (score === null) notScored.other++;
    } else {
      const a = assessAiWriting(sample.text, { minWords });
      const sc = statusCountsByLabel[sample.label];
      sc[a.status] = (sc[a.status] ?? 0) + 1;
      score = a.score;
      if (score === null) {
        if (a.status === 'INSUFFICIENT_TEXT') notScored.insufficientText++;
        else if (a.status === 'UNSUPPORTED_LANGUAGE') notScored.unsupportedLanguage++;
        else notScored.other++;
      }
    }
    if (score === null) continue;
    scoredByLabel[sample.label]++;
    scores[sample.label].push(score);
    if (sample.label === 'human') {
      const g = sample.group?.trim() || 'unspecified';
      const entry = humanByGroup.get(g) ?? { n: 0, fp: 0 };
      entry.n++;
      if (score >= threshold) entry.fp++;
      humanByGroup.set(g, entry);
    }
  }

  const rateAt = (xs: number[]): number | null => (xs.length ? xs.filter((s) => s >= threshold).length / xs.length : null);
  const humanFp = scores.human.filter((s) => s >= threshold).length;
  const humanN = scores.human.length;
  const humanRate = humanN ? humanFp / humanN : null;
  const wilson = wilsonUpper95(humanFp, humanN);

  const groupFpr: GroupFpr[] = [...humanByGroup.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([group, { n, fp }]) => ({
      group,
      n,
      falsePositives: fp,
      rate: roundOrNull(n ? fp / n : null),
      smoothedRate: roundOrNull(n ? (fp + 0.5) / (n + 1) : null),
    }));
  const eligibleGroups = groupFpr.filter((g) => g.n >= MIN_GROUP_N_FOR_DISPARITY && g.smoothedRate !== null);
  let disparity: number | null = null;
  if (eligibleGroups.length >= 2) {
    // With zero false positives everywhere, smoothing alone would invent a disparity between unequal group sizes.
    disparity = eligibleGroups.every((g) => g.falsePositives === 0)
      ? 1
      : Math.max(...eligibleGroups.map((g) => g.smoothedRate as number)) /
        Math.min(...eligibleGroups.map((g) => g.smoothedRate as number));
  }

  const aurocAi = computeAuroc(scores.human, scores.ai);
  const cal = calibration(scores.human, scores.ai);

  const total = dataset.length;
  const nonNativeHuman = [...humanByGroup.entries()]
    .filter(([g]) => NON_NATIVE_GROUP_RE.test(g))
    .reduce((a, [, v]) => a + v.n, 0);
  const signOff = options.independentReviewerSignOff;
  const signedOff =
    !!signOff && [signOff.reviewer, signOff.organization, signOff.date, signOff.reference].every((v) => typeof v === 'string' && v.trim().length > 0);

  const enoughScored = scoredByLabel.human >= MIN_SCORED_PER_CLASS && scoredByLabel.ai >= MIN_SCORED_PER_CLASS;
  const sizeNote = enoughScored
    ? ''
    : `; not passable: requires >= ${MIN_SCORED_PER_CLASS} scored human and ai samples (have ${scoredByLabel.human}/${scoredByLabel.ai})`;

  const checks: Record<string, { passed: boolean; observed: string }> = {
    G1_DATASET_SIZE: {
      passed: total >= 2000 && byLabel.human >= 500 && byLabel.ai >= 500 && nonNativeHuman >= 200,
      observed: `total=${total}, human=${byLabel.human}, ai=${byLabel.ai}, non-native human (scored)=${nonNativeHuman}`,
    },
    G2_AUROC: {
      passed: enoughScored && aurocAi !== null && aurocAi >= 0.9,
      observed: `AUROC=${fmt(aurocAi)} (held-out status must be attested by the G6 reviewer)${sizeNote}`,
    },
    G3_HUMAN_FPR: {
      passed: enoughScored && humanRate !== null && wilson !== null && humanRate <= 0.01 && wilson <= 0.02,
      observed: `FPR=${fmt(humanRate, true)} (${humanFp}/${humanN}), Wilson upper 95%=${fmt(wilson, true)}${sizeNote}`,
    },
    G4_SUBGROUP_DISPARITY: {
      passed: disparity !== null && disparity <= 1.5,
      observed:
        disparity === null
          ? `insufficient subgroup data (${eligibleGroups.length} group(s) with >= ${MIN_GROUP_N_FOR_DISPARITY} scored human samples)`
          : `max/min smoothed FPR=${disparity.toFixed(3)}`,
    },
    G5_CALIBRATION: {
      passed: enoughScored && cal.ece !== null && cal.ece <= 0.1,
      observed: `ECE=${fmt(cal.ece)}${sizeNote}`,
    },
    G6_INDEPENDENT_SIGN_OFF: {
      passed: signedOff,
      observed: signedOff ? `signed by ${signOff?.reviewer} (${signOff?.organization}), ${signOff?.date}` : 'no sign-off supplied',
    },
  };
  const gates: GateResult[] = RELEASE_GATES.map((g) => ({ ...g, ...(checks[g.id] ?? { passed: false, observed: 'not evaluated' }) }));

  const caveats = [
    'Metrics describe this dataset only; they are not evidence of accuracy on other populations or genres.',
    'The harness cannot verify that the dataset is held out from tuning or independently sourced; that is the reviewer\'s responsibility (G6).',
    'Samples that were not scored (too short / unsupported language) are excluded from AUROC, FPR and calibration.',
  ];
  if (total < 2000) caveats.push(`Dataset has ${total} samples; results have no evidentiary value for release decisions.`);
  if (options.scoreFn) caveats.push('A custom scoreFn was used; this report does not describe the shipped heuristic.');

  const idSource = JSON.stringify({ m: MODEL_VERSION, t: threshold, w: minWords, d: dataset.map((s) => [s.id, s.label, s.group ?? '', hashString(s.text)]) });

  return {
    evaluationId: `eval-${hashString(idSource).toString(16).padStart(8, '0')}`,
    modelVersion: MODEL_VERSION,
    operatingThreshold: threshold,
    minWords,
    counts: { total, byLabel, scoredByLabel, notScored },
    statusCountsByLabel,
    auroc: {
      humanVsAi: roundOrNull(aurocAi),
      humanVsAiParaphrased: roundOrNull(computeAuroc(scores.human, scores.ai_paraphrased)),
      humanVsHybrid: roundOrNull(computeAuroc(scores.human, scores.hybrid)),
    },
    humanFpr: { falsePositives: humanFp, n: humanN, rate: roundOrNull(humanRate), wilsonUpper95: roundOrNull(wilson) },
    detectionRateAtThreshold: {
      ai: roundOrNull(rateAt(scores.ai)),
      aiParaphrased: roundOrNull(rateAt(scores.ai_paraphrased)),
      hybrid: roundOrNull(rateAt(scores.hybrid)),
    },
    groupFpr,
    fprDisparityRatio: roundOrNull(disparity),
    calibration: {
      bins: cal.bins,
      expectedCalibrationError: cal.ece,
      basis: 'human (y=0) vs ai (y=1) samples only; score is a heuristic and is not expected to be calibrated until refitted.',
    },
    gates,
    gatesPassed: gates.every((g) => g.passed),
    caveats,
  };
}
