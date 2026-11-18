import {
  aggregate,
  combineScore,
  computeSentenceStats,
  describeFeatures,
  paragraphUniformity,
  type SentenceStats,
} from './features';
import {
  DEFAULT_MIN_WORDS,
  MAX_INTERVAL_WIDTH,
  MODEL_VERSION,
  OPERATING_THRESHOLD,
  SAFEGUARDS,
  resolveReleaseGate,
} from './gates';
import { detectLanguage, hashString, mulberry32, segment, tokenize, type Sentence } from './text';
import type { AiWritingAssessment, AssessOptions, SegmentSignal, SimilarityContext } from './types';

export const BOOTSTRAP_RESAMPLES = 200;
/** Minimum half-width of the interval is INTERVAL_FLOOR / sqrt(sentences), keeping short texts wide. */
export const INTERVAL_FLOOR = 0.5;
export const SEGMENT_SENTENCES = 3;

const PARAPHRASE_MIN_MATCHED_WORDS = 40;
const PARAPHRASE_MIN_NEAR_SHARE = 0.6;
const PARAPHRASE_MIN_NEAR_COVERAGE = 0.1;
const PARAPHRASE_FULL_COVERAGE = 0.3;

const round = (x: number, d = 4): number => Math.round(x * 10 ** d) / 10 ** d;
const clamp01 = (x: number): number => Math.min(1, Math.max(0, x));

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 1) return sorted[0];
  const idx = p * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

function bootstrapInterval(
  stats: SentenceStats[],
  paraUniformity: number | null,
  score: number,
  seed: number,
): { low: number; high: number } {
  const n = stats.length;
  const rng = mulberry32(seed);
  const samples: number[] = [];
  const idx = new Array<number>(n);
  for (let b = 0; b < BOOTSTRAP_RESAMPLES; b++) {
    for (let i = 0; i < n; i++) idx[i] = Math.floor(rng() * n);
    const s = combineScore(aggregate(stats, idx, paraUniformity));
    if (s !== null) samples.push(s);
  }
  samples.sort((a, b) => a - b);
  const floor = INTERVAL_FLOOR / Math.sqrt(Math.max(1, n));
  let low = samples.length ? percentile(samples, 0.025) : score;
  let high = samples.length ? percentile(samples, 0.975) : score;
  low = clamp01(Math.min(low, score - floor));
  high = clamp01(Math.max(high, score + floor));
  // Clamping at 0 or 1 must not shrink the minimum width; extend the opposite side instead.
  const minWidth = Math.min(1, 2 * floor);
  if (high - low < minWidth - 1e-9) {
    if (low === 0) high = Math.max(high, minWidth);
    else if (high === 1) low = Math.min(low, 1 - minWidth);
  }
  return { low: round(low), high: round(high) };
}

function sentenceWindows(sentences: Sentence[]): number[][] {
  const windows: number[][] = [];
  let current: number[] = [];
  let para = -1;
  const flush = () => {
    if (current.length === 0) return;
    const prev = windows[windows.length - 1];
    if (current.length < 2 && prev && sentences[prev[0]].paragraph === sentences[current[0]].paragraph) {
      prev.push(...current);
    } else {
      windows.push(current);
    }
    current = [];
  };
  sentences.forEach((s, i) => {
    if (s.paragraph !== para) {
      flush();
      para = s.paragraph;
    }
    current.push(i);
    if (current.length === SEGMENT_SENTENCES) {
      windows.push(current);
      current = [];
    }
  });
  flush();
  return windows;
}

function segmentSignals(sentences: Sentence[], stats: SentenceStats[]): SegmentSignal[] {
  const out: SegmentSignal[] = [];
  for (const w of sentenceWindows(sentences)) {
    const values = aggregate(stats, w, null);
    const score = combineScore(values, true);
    if (score === null || score < OPERATING_THRESHOLD) continue;
    out.push({
      start: sentences[w[0]].start,
      end: sentences[w[w.length - 1]].end,
      score: round(score),
      features: describeFeatures(values, true)
        .filter((f) => f.direction === 'atypical')
        .map((f) => f.id),
    });
  }
  return out;
}

export function assessParaphrase(ctx: SimilarityContext | undefined): { score: number | null; basis: string } {
  if (!ctx) {
    return {
      score: null,
      basis: 'No similarity context supplied. Paraphrasing is not inferred from writing style alone.',
    };
  }
  const { nearMatchWords, exactMatchWords, totalWords } = ctx;
  if (![nearMatchWords, exactMatchWords, totalWords].every((v) => Number.isFinite(v) && v >= 0) || totalWords === 0) {
    return { score: null, basis: 'Similarity context is invalid (requires non-negative counts and totalWords > 0).' };
  }
  const near = Math.min(nearMatchWords, totalWords);
  const exact = Math.min(exactMatchWords, totalWords);
  const matched = near + exact;
  if (matched < PARAPHRASE_MIN_MATCHED_WORDS) {
    return {
      score: null,
      basis: `Insufficient evidence: only ${matched} matched words (minimum ${PARAPHRASE_MIN_MATCHED_WORDS}).`,
    };
  }
  const nearShare = near / matched;
  const nearCoverage = near / totalWords;
  if (nearShare < PARAPHRASE_MIN_NEAR_SHARE || nearCoverage < PARAPHRASE_MIN_NEAR_COVERAGE) {
    return {
      score: null,
      basis:
        `Insufficient evidence of paraphrasing: near matches are ${(nearShare * 100).toFixed(1)}% of matched words ` +
        `and cover ${(nearCoverage * 100).toFixed(1)}% of the text (requires >= ${PARAPHRASE_MIN_NEAR_SHARE * 100}% and ` +
        `>= ${PARAPHRASE_MIN_NEAR_COVERAGE * 100}%).`,
    };
  }
  const score = round(clamp01(nearShare * Math.min(1, nearCoverage / PARAPHRASE_FULL_COVERAGE)), 3);
  return {
    score,
    basis:
      `${near} of ${totalWords} words (${(nearCoverage * 100).toFixed(1)}%) closely match sources with altered wording, ` +
      `versus ${exact} exact-match words. A high near-to-exact ratio is consistent with paraphrasing (human or tool-assisted) ` +
      'and should be reviewed against the matched sources; it does not indicate who or what did the rewording.',
  };
}

export function assessAiWriting(text: string, options: AssessOptions = {}): AiWritingAssessment {
  const minWords = options.minWords ?? DEFAULT_MIN_WORDS;
  const input = typeof text === 'string' ? text : '';
  const tokens = tokenize(input);
  const wordCount = tokens.length;
  const language = detectLanguage(tokens);
  const base: AiWritingAssessment = {
    status: 'INSUFFICIENT_TEXT',
    score: null,
    interval: null,
    paraphraseSignal: assessParaphrase(options.similarityContext),
    wordCount,
    language,
    features: [],
    segments: [],
    releaseGate: resolveReleaseGate(),
    safeguards: [...SAFEGUARDS],
    modelVersion: MODEL_VERSION,
  };
  if (wordCount < minWords) return base;
  if (language !== 'en') return { ...base, status: 'UNSUPPORTED_LANGUAGE' };

  const { paragraphs, sentences } = segment(input);
  const stats = computeSentenceStats(sentences);
  const paraU = paragraphUniformity(paragraphs, sentences);
  const values = aggregate(
    stats,
    stats.map((_, i) => i),
    paraU,
  );
  const raw = combineScore(values);
  if (raw === null) return { ...base, status: 'INCONCLUSIVE' };
  const score = round(raw);
  const interval = bootstrapInterval(stats, paraU, score, hashString(input));
  const features = describeFeatures(values);

  let status: AiWritingAssessment['status'];
  if (interval.high - interval.low > MAX_INTERVAL_WIDTH) status = 'INCONCLUSIVE';
  else if (score >= OPERATING_THRESHOLD && interval.low < OPERATING_THRESHOLD) status = 'INCONCLUSIVE';
  else if (score >= OPERATING_THRESHOLD) status = 'SIGNALS_FOR_REVIEW';
  else status = 'NO_NOTABLE_SIGNALS';

  return {
    ...base,
    status,
    score,
    interval,
    features,
    segments: status === 'SIGNALS_FOR_REVIEW' ? segmentSignals(sentences, stats) : [],
  };
}
