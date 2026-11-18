import { COMMON_WORDS, FUNCTION_WORDS, TRANSITION_PHRASES } from './lexicon';
import type { Sentence, Span } from './text';
import type { SignalFeature } from './types';

/**
 * Every bootstrappable feature is expressed as a ratio of per-sentence sums so
 * that resampling sentences with replacement yields a proper ratio-estimator
 * bootstrap (duplicated sentences do not artificially inflate repetition).
 */
export interface SentenceStats {
  words: number;
  functionWords: number;
  contentWords: number;
  rareContentWords: number;
  transitions: number;
  punct: number[];
  mattrSum: number;
  mattrCount: number;
  trigrams: number;
  repeatedTrigrams: number;
}

const PUNCT_CLASSES: RegExp[] = [
  /\./g,
  /,/g,
  /;/g,
  /:/g,
  /!/g,
  /\?/g,
  /[-\u2013\u2014]/g,
  /[()[\]]/g,
  /["\u201c\u201d]/g,
  /['\u2018\u2019]/g,
];

export const MATTR_WINDOW = 50;

function countTransitions(tokens: string[]): number {
  let n = 0;
  for (let i = 0; i < tokens.length; i++) {
    for (const phrase of TRANSITION_PHRASES) {
      if (i + phrase.length > tokens.length) continue;
      let ok = true;
      for (let k = 0; k < phrase.length; k++) {
        if (tokens[i + k] !== phrase[k]) {
          ok = false;
          break;
        }
      }
      if (ok) n++;
    }
  }
  return n;
}

export function computeSentenceStats(sentences: Sentence[]): SentenceStats[] {
  const stats: SentenceStats[] = sentences.map((s) => {
    let functionWords = 0;
    let contentWords = 0;
    let rareContentWords = 0;
    for (const t of s.tokens) {
      if (FUNCTION_WORDS.has(t)) {
        functionWords++;
      } else if (/^\p{L}{3,}$/u.test(t)) {
        contentWords++;
        if (!COMMON_WORDS.has(t)) rareContentWords++;
      }
    }
    return {
      words: s.tokens.length,
      functionWords,
      contentWords,
      rareContentWords,
      transitions: countTransitions(s.tokens),
      punct: PUNCT_CLASSES.map((re) => (s.raw.match(re) ?? []).length),
      mattrSum: 0,
      mattrCount: 0,
      trigrams: 0,
      repeatedTrigrams: 0,
    };
  });

  // Trigrams are kept within sentences; repetition is judged against the whole document.
  const trigramCounts = new Map<string, number>();
  const sentenceTrigrams = sentences.map((s) => {
    const grams: string[] = [];
    for (let i = 0; i + 2 < s.tokens.length; i++) grams.push(`${s.tokens[i]} ${s.tokens[i + 1]} ${s.tokens[i + 2]}`);
    for (const g of grams) trigramCounts.set(g, (trigramCounts.get(g) ?? 0) + 1);
    return grams;
  });
  sentenceTrigrams.forEach((grams, i) => {
    stats[i].trigrams = grams.length;
    stats[i].repeatedTrigrams = grams.filter((g) => (trigramCounts.get(g) ?? 0) > 1).length;
  });

  // MATTR: each moving window is attributed to the sentence containing its first token.
  const owner: number[] = [];
  const all: string[] = [];
  sentences.forEach((s, i) => {
    for (const t of s.tokens) {
      all.push(t);
      owner.push(i);
    }
  });
  if (all.length > 0 && all.length < MATTR_WINDOW) {
    const ttr = new Set(all).size / all.length;
    stats.forEach((st) => {
      st.mattrSum = ttr;
      st.mattrCount = 1;
    });
  } else if (all.length >= MATTR_WINDOW) {
    const freq = new Map<string, number>();
    for (let i = 0; i < MATTR_WINDOW; i++) freq.set(all[i], (freq.get(all[i]) ?? 0) + 1);
    for (let p = 0; p + MATTR_WINDOW <= all.length; p++) {
      if (p > 0) {
        const out = all[p - 1];
        const c = (freq.get(out) ?? 0) - 1;
        if (c <= 0) freq.delete(out);
        else freq.set(out, c);
        const inn = all[p + MATTR_WINDOW - 1];
        freq.set(inn, (freq.get(inn) ?? 0) + 1);
      }
      const st = stats[owner[p]];
      st.mattrSum += freq.size / MATTR_WINDOW;
      st.mattrCount++;
    }
  }
  return stats;
}

/** 1 - coefficient of variation of paragraph word counts, clamped to [0, 1]. Null with < 3 paragraphs. */
export function paragraphUniformity(paragraphs: Span[], sentences: Sentence[]): number | null {
  if (paragraphs.length < 3) return null;
  const lengths = paragraphs.map(() => 0);
  for (const s of sentences) lengths[s.paragraph] += s.tokens.length;
  const nonEmpty = lengths.filter((l) => l > 0);
  if (nonEmpty.length < 3) return null;
  const mean = nonEmpty.reduce((a, b) => a + b, 0) / nonEmpty.length;
  const sd = Math.sqrt(nonEmpty.reduce((a, b) => a + (b - mean) ** 2, 0) / nonEmpty.length);
  return Math.min(1, Math.max(0, 1 - sd / mean));
}

export type FeatureId =
  | 'sentence_length_mean'
  | 'sentence_length_cv'
  | 'mattr'
  | 'function_word_rate'
  | 'punctuation_diversity'
  | 'repeated_trigram_rate'
  | 'paragraph_uniformity'
  | 'transition_density'
  | 'vocabulary_rarity';

export type FeatureValues = Record<FeatureId, number | null>;

export function aggregate(stats: SentenceStats[], indices: number[], paraUniformity: number | null): FeatureValues {
  let words = 0;
  let functionWords = 0;
  let contentWords = 0;
  let rare = 0;
  let transitions = 0;
  let mattrSum = 0;
  let mattrCount = 0;
  let trigrams = 0;
  let repeated = 0;
  const punct = new Array<number>(PUNCT_CLASSES.length).fill(0);
  const lengths: number[] = [];
  for (const i of indices) {
    const s = stats[i];
    words += s.words;
    functionWords += s.functionWords;
    contentWords += s.contentWords;
    rare += s.rareContentWords;
    transitions += s.transitions;
    mattrSum += s.mattrSum;
    mattrCount += s.mattrCount;
    trigrams += s.trigrams;
    repeated += s.repeatedTrigrams;
    for (let k = 0; k < punct.length; k++) punct[k] += s.punct[k];
    lengths.push(s.words);
  }
  const n = lengths.length;
  const mean = n > 0 ? words / n : null;
  let cv: number | null = null;
  if (n >= 2 && mean) {
    const sd = Math.sqrt(lengths.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
    cv = sd / mean;
  }
  const punctTotal = punct.reduce((a, b) => a + b, 0);
  let entropy: number | null = null;
  if (punctTotal > 0) {
    let h = 0;
    for (const c of punct) if (c > 0) h -= (c / punctTotal) * Math.log2(c / punctTotal);
    entropy = h / Math.log2(PUNCT_CLASSES.length);
  }
  return {
    sentence_length_mean: mean,
    sentence_length_cv: cv,
    mattr: mattrCount > 0 ? mattrSum / mattrCount : null,
    function_word_rate: words > 0 ? functionWords / words : null,
    punctuation_diversity: entropy,
    repeated_trigram_rate: trigrams > 0 ? repeated / trigrams : null,
    paragraph_uniformity: paraUniformity,
    transition_density: words > 0 ? (transitions / words) * 100 : null,
    vocabulary_rarity: contentWords > 0 ? rare / contentWords : null,
  };
}

export interface FeatureSpec {
  id: FeatureId;
  label: string;
  weight: number;
  baseline: { low: number; high: number };
  aiSide: 'low' | 'high';
  segmentEligible: boolean;
  typicalText: string;
  atypicalText: string;
}

/**
 * Weights and baselines are documented heuristics chosen by inspection, NOT
 * fitted to labelled data. They must be re-derived from a qualifying
 * evaluation dataset before any release gate can pass.
 */
export const FEATURE_SPECS: readonly FeatureSpec[] = [
  {
    id: 'sentence_length_cv',
    label: 'Sentence-length variation (burstiness)',
    weight: 0.2,
    baseline: { low: 0.4, high: 0.8 },
    aiSide: 'low',
    segmentEligible: true,
    typicalText: 'Sentence lengths vary in a way common in human drafts.',
    atypicalText: 'Sentence lengths are unusually uniform; uniform rhythm is also common in formulaic or edited writing.',
  },
  {
    id: 'transition_density',
    label: 'Transition / hedging phrase density (per 100 words)',
    weight: 0.21,
    baseline: { low: 0.2, high: 1.2 },
    aiSide: 'high',
    segmentEligible: true,
    typicalText: 'Signposting phrases appear at a typical rate.',
    atypicalText:
      'Signposting phrases (e.g. "furthermore", "it is important to note") are dense; writers taught explicit signposting also show this.',
  },
  {
    id: 'paragraph_uniformity',
    label: 'Paragraph-length uniformity',
    weight: 0.12,
    baseline: { low: 0.3, high: 0.7 },
    aiSide: 'high',
    segmentEligible: false,
    typicalText: 'Paragraph lengths vary.',
    atypicalText: 'Paragraphs are very similar in length; templates and assignment structures can also cause this.',
  },
  {
    id: 'vocabulary_rarity',
    label: 'Vocabulary rarity (share of less-common content words)',
    weight: 0.12,
    baseline: { low: 0.4, high: 0.75 },
    // The high side is used deliberately: treating simple vocabulary as AI-like would
    // penalise developing and non-native writers.
    aiSide: 'high',
    segmentEligible: true,
    typicalText: 'Word choice includes a typical share of less-common words.',
    atypicalText:
      'Word choice leans on less-common, formal vocabulary; academic and discipline-specific writing also shows this.',
  },
  {
    id: 'punctuation_diversity',
    label: 'Punctuation diversity (normalised entropy)',
    // Low weight: limited punctuation is also common among non-native and younger writers.
    weight: 0.06,
    baseline: { low: 0.3, high: 0.65 },
    aiSide: 'low',
    segmentEligible: true,
    typicalText: 'Punctuation use is varied.',
    atypicalText: 'Punctuation is limited mostly to commas and periods.',
  },
  {
    id: 'mattr',
    label: 'Lexical diversity (MATTR, 50-word window)',
    weight: 0.08,
    baseline: { low: 0.68, high: 0.86 },
    aiSide: 'low',
    segmentEligible: true,
    typicalText: 'Lexical diversity is within a typical range.',
    atypicalText: 'Lexical diversity is low for the window size.',
  },
  {
    id: 'function_word_rate',
    label: 'Function-word rate',
    weight: 0.08,
    baseline: { low: 0.38, high: 0.56 },
    aiSide: 'low',
    segmentEligible: true,
    typicalText: 'Function-word use is within a typical range.',
    atypicalText: 'Prose is noun-dense with few function words; technical writing also shows this.',
  },
  {
    id: 'repeated_trigram_rate',
    label: 'Repeated three-word phrase rate',
    weight: 0.08,
    baseline: { low: 0.0, high: 0.08 },
    aiSide: 'high',
    segmentEligible: false,
    typicalText: 'Little phrase-level repetition.',
    atypicalText: 'Three-word phrases recur often; repetition of key terms in focused essays also raises this.',
  },
  {
    id: 'sentence_length_mean',
    label: 'Mean sentence length (words)',
    weight: 0.05,
    baseline: { low: 10, high: 24 },
    aiSide: 'high',
    segmentEligible: true,
    typicalText: 'Average sentence length is within a typical range.',
    atypicalText: 'Sentences are long on average.',
  },
];

const logistic = (x: number): number => 1 / (1 + Math.exp(-x));

/** 0.5 at the baseline edge on the AI-associated side, ~0.12 at the baseline midpoint. */
export function featureSubScore(spec: FeatureSpec, value: number): number {
  const range = spec.baseline.high - spec.baseline.low;
  const x = spec.aiSide === 'low' ? (spec.baseline.low - value) / range : (value - spec.baseline.high) / range;
  return logistic(4 * x);
}

export function combineScore(values: FeatureValues, segmentOnly = false): number | null {
  let num = 0;
  let den = 0;
  for (const spec of FEATURE_SPECS) {
    if (segmentOnly && !spec.segmentEligible) continue;
    const v = values[spec.id];
    if (v === null || !Number.isFinite(v)) continue;
    num += spec.weight * featureSubScore(spec, v);
    den += spec.weight;
  }
  return den > 0 ? num / den : null;
}

const round = (x: number, d = 4): number => Math.round(x * 10 ** d) / 10 ** d;

export function describeFeatures(values: FeatureValues, segmentOnly = false): SignalFeature[] {
  const out: SignalFeature[] = [];
  for (const spec of FEATURE_SPECS) {
    if (segmentOnly && !spec.segmentEligible) continue;
    const v = values[spec.id];
    if (v === null || !Number.isFinite(v)) continue;
    const atypical = featureSubScore(spec, v) > 0.5;
    out.push({
      id: spec.id,
      label: spec.label,
      value: round(v),
      baseline: { ...spec.baseline },
      direction: atypical ? 'atypical' : 'typical',
      explanation: atypical ? spec.atypicalText : spec.typicalText,
    });
  }
  return out;
}
