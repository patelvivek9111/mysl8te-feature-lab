import type { Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { analyzeSimilarity, findExcludedRegions, type CorpusDocument, type ExcludedRegion, type SimilarityResult } from '../similarity';

export interface SimilarityOptions {
  excludeQuotes: boolean;
  excludeBibliography: boolean;
  excludeSmallMatches: boolean;
  smallMatchThreshold: number;
}

const DEFAULTS: SimilarityOptions = {
  excludeQuotes: true,
  excludeBibliography: true,
  excludeSmallMatches: true,
  smallMatchThreshold: 8,
};

const CORPUS_PREFIX = 'corpus:';
const PEER_PREFIX = 'submission:';

export function resolveOptions(options?: Partial<SimilarityOptions>): SimilarityOptions {
  const threshold = Number(options?.smallMatchThreshold ?? DEFAULTS.smallMatchThreshold);
  return {
    excludeQuotes: options?.excludeQuotes ?? DEFAULTS.excludeQuotes,
    excludeBibliography: options?.excludeBibliography ?? DEFAULTS.excludeBibliography,
    excludeSmallMatches: options?.excludeSmallMatches ?? DEFAULTS.excludeSmallMatches,
    smallMatchThreshold: Number.isFinite(threshold) ? Math.min(200, Math.max(1, Math.floor(threshold))) : DEFAULTS.smallMatchThreshold,
  };
}

export async function loadCorpusFor(submissionId: string, assignmentId: string): Promise<{ corpus: CorpusDocument[]; names: Map<string, string> }> {
  const references = await prisma.corpusDocument.findMany();
  const peers = await prisma.submission.findMany({
    where: { assignmentId, id: { not: submissionId }, document: { textContent: { not: null } } },
    include: { document: true, student: true },
  });
  const corpus: CorpusDocument[] = [];
  const names = new Map<string, string>();
  for (const source of references) {
    const id = `${CORPUS_PREFIX}${source.id}`;
    const title = `${source.title} — ${source.author}`;
    corpus.push({ id, title, type: 'REFERENCE', text: source.text, ...(source.sourceUrl ? { url: source.sourceUrl } : {}) });
    names.set(id, title);
  }
  for (const peer of peers) {
    if (!peer.document.textContent) continue;
    const id = `${PEER_PREFIX}${peer.id}`;
    const title = `Another submission by ${peer.student.name}`;
    corpus.push({ id, title, type: 'STUDENT_PAPER', text: peer.document.textContent });
    names.set(id, title);
  }
  return { corpus, names };
}

export function runSimilarity(text: string, corpus: CorpusDocument[], options: SimilarityOptions): SimilarityResult {
  return analyzeSimilarity(text, corpus, {
    excludeQuotes: options.excludeQuotes,
    excludeBibliography: options.excludeBibliography,
    minMatchWords: options.excludeSmallMatches ? options.smallMatchThreshold : 1,
  });
}

// Serializes rebuilds of one submission's report (teacher recalculation, worker, boot backfill).
async function lockReport(tx: Prisma.TransactionClient, submissionId: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`similarity:${submissionId}`}))`;
}

function excludedRows(text: string, regions: ExcludedRegion[]) {
  return regions.map((region) => ({
    text: text.slice(region.start, region.end).slice(0, 2000),
    reason: region.reason,
    startPosition: region.start,
    endPosition: region.end,
  }));
}

// Reports written before offsets were stored get their excluded rows recomputed from the text and
// the report's own options. Matches, scores, and AI assessments are left untouched.
export async function backfillExcludedOffsets(batchSize = 100): Promise<number> {
  let fixed = 0;
  let cursor: string | undefined;
  for (;;) {
    const batch = await prisma.similarityReport.findMany({
      where: { excludedMatches: { some: { startPosition: null } }, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: batchSize,
      select: { id: true, submissionId: true },
    });
    if (batch.length === 0) return fixed;
    cursor = batch[batch.length - 1].id;
    for (const { submissionId } of batch) {
      try {
        await prisma.$transaction(async (tx) => {
          await lockReport(tx, submissionId);
          const report = await tx.similarityReport.findUnique({ where: { submissionId }, include: { submission: { include: { document: true } } } });
          if (!report) return;
          const text = report.submission.document.textContent ?? '';
          const regions = findExcludedRegions(text, { excludeQuotes: report.excludeQuotes, excludeBibliography: report.excludeBibliography });
          await tx.excludedMatch.deleteMany({ where: { reportId: report.id } });
          await tx.excludedMatch.createMany({ data: excludedRows(text, regions).map((row) => ({ ...row, reportId: report.id })) });
        });
        fixed += 1;
      } catch (error) {
        console.error(JSON.stringify({ level: 'error', message: 'excluded offset backfill failed', submissionId, error: String(error) }));
      }
    }
  }
}

export async function buildSimilarityReport(submissionId: string, options?: Partial<SimilarityOptions>): Promise<SimilarityResult | null> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { document: true },
  });
  if (!submission) return null;
  const resolved = resolveOptions(options);
  const text = submission.document.textContent ?? '';
  const { corpus } = text ? await loadCorpusFor(submissionId, submission.assignmentId) : { corpus: [] };
  const result = runSimilarity(text, corpus, resolved);
  const sourceTexts = new Map(corpus.map((doc) => [doc.id, doc.text]));

  await prisma.$transaction(async (tx) => {
    await lockReport(tx, submissionId);
    const existing = await tx.similarityReport.findUnique({ where: { submissionId } });
    if (existing) {
      await tx.similarityPassage.deleteMany({ where: { source: { reportId: existing.id } } });
      await tx.similaritySource.deleteMany({ where: { reportId: existing.id } });
      await tx.excludedMatch.deleteMany({ where: { reportId: existing.id } });
      await tx.similarityReport.delete({ where: { id: existing.id } });
    }
    await tx.similarityReport.create({
      data: {
        submissionId,
        overallSimilarity: result.overallPercent,
        status: 'COMPLETED',
        excludeQuotes: resolved.excludeQuotes,
        excludeBibliography: resolved.excludeBibliography,
        excludeSmallMatches: resolved.excludeSmallMatches,
        smallMatchThreshold: resolved.smallMatchThreshold,
        sources: {
          create: result.sources.map((source) => ({
            sourceName: source.title,
            sourceUrl: source.url ?? null,
            sourceType: source.type === 'STUDENT_PAPER' ? 'STUDENT_PAPER' : source.type === 'INTERNET' ? 'INTERNET' : 'PUBLICATION',
            similarityPercentage: source.percent,
            passages: {
              create: source.passages.map((passage) => ({
                submissionText: text.slice(passage.start, passage.end),
                sourceText: (sourceTexts.get(source.sourceId) ?? '').slice(passage.sourceStart, passage.sourceEnd),
                startPosition: passage.start,
                endPosition: passage.end,
                matchType: passage.matchType === 'NEAR' ? 'NEAR_MATCH' : 'EXACT',
              })),
            },
          })),
        },
        excludedMatches: { create: excludedRows(text, result.excludedRegions) },
      },
    });
  });
  return result;
}
