/**
 * EXPERIMENTAL AI-writing / AI-paraphrasing signal module.
 *
 * Produces interpretable stylometric signals for mandatory human review. It
 * never produces an accusation or a probability of AI authorship, is not
 * validated, and is not equivalent to any commercial detector.
 * See docs/evaluations/AI_WRITING_RELEASE_GATES.md.
 */
export type {
  AssessmentStatus,
  SignalFeature,
  SegmentSignal,
  AiWritingAssessment,
  AssessOptions,
  SimilarityContext,
  ReleaseGateStatus,
  SampleLabel,
  LabeledSample,
  EvaluateOptions,
  EvaluationReport,
  GateResult,
  GroupFpr,
  CalibrationBin,
  ReviewerSignOff,
} from './types';
export { assessAiWriting } from './assess';
export { evaluate, computeAuroc } from './evaluate';
export {
  RELEASE_GATES,
  SAFEGUARDS,
  MODEL_VERSION,
  OPERATING_THRESHOLD,
  DEFAULT_MIN_WORDS,
  resolveReleaseGate,
} from './gates';
