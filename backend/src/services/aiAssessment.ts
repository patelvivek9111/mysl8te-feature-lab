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

// Analyses from an older model version are rebuilt with each report's stored similarity options.
// The previous teacher review is kept in the audit log by storeAiAssessment.
export async function refreshStaleAnalyses(): Promise<number> {
  const stale = await prisma.$queryRaw<Array<{ submission_id: string }>>`
    SELECT submission_id FROM ai_assessments WHERE features->>'modelVersion' IS DISTINCT FROM ${MODEL_VERSION}`;
  let refreshed = 0;
  for (const { submission_id: submissionId } of stale) {
    try {
      const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { document: true, similarityReport: true } });
      if (!submission) continue;
      const stored = submission.similarityReport;
      const similarity = await buildSimilarityReport(submissionId, stored ? {
        excludeQuotes: stored.excludeQuotes,
        excludeBibliography: stored.excludeBibliography,
        excludeSmallMatches: stored.excludeSmallMatches,
        smallMatchThreshold: stored.smallMatchThreshold,
      } : undefined);
      await storeAiAssessment(submissionId, submission.document.textContent ?? '', similarity, 'model_version_changed');
      refreshed += 1;
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', message: 'stale analysis refresh failed', submissionId, error: String(error) }));
    }
  }
  return refreshed;
}

// Reports written before excluded-region offsets were stored are rebuilt with their own options.
export async function backfillExcludedOffsets(): Promise<number> {
  const legacy = await prisma.similarityReport.findMany({
    where: { excludedMatches: { some: { startPosition: null } } },
    select: { submissionId: true, excludeQuotes: true, excludeBibliography: true, excludeSmallMatches: true, smallMatchThreshold: true },
  });
  let rebuilt = 0;
  for (const { submissionId, ...options } of legacy) {
    try {
      const similarity = await buildSimilarityReport(submissionId, options);
      const submission = await prisma.submission.findUnique({ where: { id: submissionId }, include: { document: true } });
      await refreshAfterSimilarity(submissionId, submission?.document.textContent ?? '', similarity);
      rebuilt += 1;
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', message: 'excluded offset backfill failed', submissionId, error: String(error) }));
    }
  }
  return rebuilt;
}

function sameJson(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const keysA = Object.keys(a).filter((key) => (a as Record<string, unknown>)[key] !== undefined);
  const keysB = Object.keys(b).filter((key) => (b as Record<string, unknown>)[key] !== undefined);
  if (keysA.length !== keysB.length) return false;
  return keysA.every((key) => sameJson((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]));
}

// Only the paraphrase signal depends on similarity. When recalculation leaves it unchanged the
// stored assessment and its teacher review stay as they are; otherwise the assessment is rebuilt
// and the earlier review is moved to the audit log.
export async function refreshAfterSimilarity(submissionId: string, text: string, similarity: SimilarityResult | null): Promise<boolean> {
  const existing = await prisma.aiAssessment.findUnique({ where: { submissionId } });
  if (!existing || existing.status !== 'COMPLETED') return false;
  const record = assessmentRecord(text, similarity);
  const stored = existing.features as { paraphraseSignal?: unknown; modelVersion?: string } | null;
  const next = record.features as { paraphraseSignal?: unknown; modelVersion?: string };
  if (stored?.modelVersion === next.modelVersion && sameJson(stored?.paraphraseSignal, next.paraphraseSignal)) return false;
  await storeAiAssessment(submissionId, text, similarity, 'similarity_recalculated');
  return true;
}

export async function storeAiAssessment(
  submissionId: string,
  text: string,
  similarity: SimilarityResult | null,
  reason: 'reprocessed' | 'model_version_changed' | 'similarity_recalculated' = 'reprocessed',
): Promise<void> {
  const record = assessmentRecord(text, similarity);
  const reviewReset = { reviewDecision: null, reviewNote: null, reviewedById: null, reviewedAt: null };
  await prisma.$transaction(async (tx) => {
    const previous = await tx.aiAssessment.findUnique({ where: { submissionId } });
    if (previous?.reviewDecision) {
      await tx.auditLog.create({
        data: {
          userId: previous.reviewedById,
          action: 'ai_review_superseded',
          entity: 'submission',
          entityId: submissionId,
          changes: {
            reason,
            decision: previous.reviewDecision,
            note: previous.reviewNote,
            reviewedAt: previous.reviewedAt?.toISOString() ?? null,
            modelVersion: (previous.features as { modelVersion?: string } | null)?.modelVersion ?? null,
          },
        },
      });
    }
    await tx.aiAssessment.upsert({
      where: { submissionId },
      update: { ...record, ...reviewReset },
      create: { submissionId, ...record },
    });
  });
}
