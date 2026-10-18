export type AssessmentStatus =
  | 'INSUFFICIENT_TEXT'
  | 'UNSUPPORTED_LANGUAGE'
  | 'NO_NOTABLE_SIGNALS'
  | 'SIGNALS_FOR_REVIEW'
  | 'INCONCLUSIVE';

export interface SignalFeature {
  id: string;
  label: string;
  value: number;
  /** Provisional range for human writing, set by inspection; not empirically validated. */
  baseline: { low: number; high: number };
  /** 'atypical' = outside the baseline in the direction this heuristic associates with AI-generated text. */
  direction: 'typical' | 'atypical';
  explanation: string;
}

/** Character offsets into the original text (end exclusive), covering a window of sentences. */
export interface SegmentSignal {
  start: number;
  end: number;
  score: number;
  features: string[];
}

export interface ReleaseGateStatus {
  stage: 'EXPERIMENTAL' | 'VALIDATED';
  validated: boolean;
  evaluationId: string | null;
  notes: string;
}

export interface AiWritingAssessment {
  status: AssessmentStatus;
  /** 0..1 heuristic signal strength, NOT a probability; null when not computed. */
  score: number | null;
  /** Bootstrap uncertainty band around score; null when score is null. */
  interval: { low: number; high: number } | null;
  paraphraseSignal: { score: number | null; basis: string };
  wordCount: number;
  language: 'en' | 'unknown';
  features: SignalFeature[];
  segments: SegmentSignal[];
  releaseGate: ReleaseGateStatus;
  /** Must always be displayed alongside any result. */
  safeguards: string[];
  modelVersion: string;
}

export interface SimilarityContext {
  nearMatchWords: number;
  exactMatchWords: number;
  totalWords: number;
}

export interface AssessOptions {
  /** Default 300. */
  minWords?: number;
  similarityContext?: SimilarityContext;
}

export type SampleLabel = 'human' | 'ai' | 'ai_paraphrased' | 'hybrid';

export interface LabeledSample {
  id: string;
  text: string;
  label: SampleLabel;
  group?: string;
}

export interface ReviewerSignOff {
  reviewer: string;
  organization: string;
  date: string;
  reference: string;
}

export interface EvaluateOptions {
  minWords?: number;
  operatingThreshold?: number;
  independentReviewerSignOff?: ReviewerSignOff;
  /** Overrides the scorer (used for testing the metric plumbing). Return null for "not scored". */
  scoreFn?: (text: string) => number | null;
}

export interface GateResult {
  id: string;
  description: string;
  threshold: string;
  observed: string;
  passed: boolean;
}

export interface GroupFpr {
  group: string;
  n: number;
  falsePositives: number;
  rate: number | null;
  /** (fp + 0.5) / (n + 1), used for disparity ratios so zero-FPR groups do not divide by zero. */
  smoothedRate: number | null;
}

export interface CalibrationBin {
  low: number;
  high: number;
  count: number;
  meanScore: number | null;
  observedAiRate: number | null;
}

export interface EvaluationReport {
  evaluationId: string;
  modelVersion: string;
  operatingThreshold: number;
  minWords: number;
  counts: {
    total: number;
    byLabel: Record<SampleLabel, number>;
    scoredByLabel: Record<SampleLabel, number>;
    notScored: { insufficientText: number; unsupportedLanguage: number; other: number };
  };
  statusCountsByLabel: Record<SampleLabel, Partial<Record<AssessmentStatus, number>>>;
  auroc: { humanVsAi: number | null; humanVsAiParaphrased: number | null; humanVsHybrid: number | null };
  humanFpr: { falsePositives: number; n: number; rate: number | null; wilsonUpper95: number | null };
  detectionRateAtThreshold: { ai: number | null; aiParaphrased: number | null; hybrid: number | null };
  groupFpr: GroupFpr[];
  fprDisparityRatio: number | null;
  calibration: { bins: CalibrationBin[]; expectedCalibrationError: number | null; basis: string };
  gates: GateResult[];
  gatesPassed: boolean;
  caveats: string[];
}
