import prisma from '../db/prisma';
import { analyzeSimilarity, type CorpusDocument, type SimilarityResult } from '../similarity';

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
        excludedMatches: {
          create: result.excludedRegions.map((region) => ({
            text: text.slice(region.start, region.end).slice(0, 2000),
            reason: region.reason,
          })),
        },
      },
    });
  });
  return result;
}
