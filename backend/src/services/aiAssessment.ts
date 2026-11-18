import type { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { assessAiWriting, MODEL_VERSION, type AiWritingAssessment, type SimilarityContext } from '../ai-writing';
import type { SimilarityResult } from '../similarity';
import { buildSimilarityReport } from './similarity';

export const REVIEW_DECISIONS = ['NO_CONCERN', 'DISCUSS_WITH_STUDENT', 'REFER_FOR_INTEGRITY_REVIEW', 'SIGNAL_NOT_RELIABLE'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

export function similarityContextOf(result: SimilarityResult | null): SimilarityContext | undefined {
  if (!result || result.totalWords === 0) return undefined;
  let near = 0;
  let exact = 0;
  for (const passage of result.passages) {
    if (passage.matchType === 'NEAR') near += passage.wordCount;
    else exact += passage.wordCount;
  }
  return { nearMatchWords: near, exactMatchWords: exact, totalWords: result.totalWords };
}

function reasonsOf(assessment: AiWritingAssessment): string[] {
  switch (assessment.status) {
    case 'INSUFFICIENT_TEXT':
      return [`Only ${assessment.wordCount} words; the module declines to score short text.`];
    case 'UNSUPPORTED_LANGUAGE':
      return ['The text does not look like English prose, which is the only language the signals were designed for.'];
    default: {
      const atypical = assessment.features.filter((feature) => feature.direction === 'atypical').map((feature) => feature.explanation);
      return atypical.length ? atypical : ['No style feature fell outside its provisional human-writing range.'];
    }
  }
}

function uncertaintyOf(assessment: AiWritingAssessment): string {
  if (!assessment.interval || assessment.score === null) return 'not scored';
  return `signal ${assessment.score.toFixed(2)} (band ${assessment.interval.low.toFixed(2)}–${assessment.interval.high.toFixed(2)}), not a probability`;
}

export function assessmentRecord(text: string, similarity: SimilarityResult | null) {
  const assessment = assessAiWriting(text, { similarityContext: similarityContextOf(similarity) });
  const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
  return {
    status: 'COMPLETED' as const,
    outcome: assessment.status,
    consequentialUseEnabled: false,
    humanReviewRequired: true,
    uncertainty: uncertaintyOf(assessment),
    reasons: reasonsOf(assessment),
    features: json({
      score: assessment.score,
      interval: assessment.interval,
      paraphraseSignal: assessment.paraphraseSignal,
      wordCount: assessment.wordCount,
      language: assessment.language,
      features: assessment.features,
      segments: assessment.segments,
      modelVersion: assessment.modelVersion,
    }),
    limitations: assessment.safeguards.join(' '),
    evaluation: json(assessment.releaseGate),
  };
}

// Reports produced by an older model version are rebuilt (and need a fresh teacher review).
export async function refreshStaleAnalyses(): Promise<number> {
  const rows = await prisma.aiAssessment.findMany({ select: { submissionId: true, features: true } });
  const stale = rows.filter((row) => (row.features as { modelVersion?: string } | null)?.modelVersion !== MODEL_VERSION);
  for (const row of stale) {
    const submission = await prisma.submission.findUnique({ where: { id: row.submissionId }, include: { document: true } });
    if (!submission) continue;
    const similarity = await buildSimilarityReport(row.submissionId);
    await storeAiAssessment(row.submissionId, submission.document.textContent ?? '', similarity);
  }
  return stale.length;
}

export async function storeAiAssessment(submissionId: string, text: string, similarity: SimilarityResult | null): Promise<void> {
  const record = assessmentRecord(text, similarity);
  const reviewReset = { reviewDecision: null, reviewNote: null, reviewedById: null, reviewedAt: null };
  await prisma.aiAssessment.upsert({
    where: { submissionId },
    update: { ...record, ...reviewReset },
    create: { submissionId, ...record },
  });
}
