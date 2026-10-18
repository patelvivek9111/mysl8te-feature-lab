import prisma from '../db/prisma';

export interface PassageMatch {
  sourceName: string;
  sourceUrl: string | null;
  sourceType: 'INTERNET' | 'PUBLICATION' | 'STUDENT_PAPER';
  submissionText: string;
  sourceText: string;
  startPosition: number;
  endPosition: number;
  matchType: 'EXACT' | 'NEAR_MATCH';
  wordCount: number;
}

export interface SimilarityOptions {
  excludeQuotes: boolean;
  excludeBibliography: boolean;
  excludeSmallMatches: boolean;
  smallMatchThreshold: number;
}

function wordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9'\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function quoteWordIndexes(original: string, normalizedWords: string[]): Set<number> {
  const excluded = new Set<number>();
  const pattern = /["“](.{20,}?)["”]/gs;
  const quoted = original.match(pattern) ?? [];
  for (const quote of quoted) {
    const quoteWords = wordsOf(quote);
    if (quoteWords.length < 8) continue;
    markSequence(normalizedWords, quoteWords, excluded);
  }
  return excluded;
}

function bibliographyWordIndexes(original: string, normalizedWords: string[]): Set<number> {
  const match = /\n\s*(references|bibliography|works cited)\s*\n/i.exec(original);
  if (!match) return new Set();
  const before = wordsOf(original.slice(0, match.index)).length;
  const excluded = new Set<number>();
  for (let i = before; i < normalizedWords.length; i += 1) excluded.add(i);
  return excluded;
}

function markSequence(haystack: string[], needle: string[], into: Set<number>): void {
  if (needle.length === 0) return;
  for (let i = 0; i <= haystack.length - needle.length; i += 1) {
    let ok = true;
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      for (let j = 0; j < needle.length; j += 1) into.add(i + j);
    }
  }
}

function shingleHits(submission: string[], source: string[], size = 5): boolean[] {
  const hits = Array(submission.length).fill(false);
  if (source.length < size || submission.length < size) return hits;
  const index = new Set<string>();
  for (let i = 0; i <= source.length - size; i += 1) {
    index.add(source.slice(i, i + size).join(' '));
  }
  for (let i = 0; i <= submission.length - size; i += 1) {
    if (index.has(submission.slice(i, i + size).join(' '))) {
      for (let j = 0; j < size; j += 1) hits[i + j] = true;
    }
  }
  return hits;
}

function collapse(words: string[], hits: boolean[], matchType: 'EXACT' | 'NEAR_MATCH'): Array<{ start: number; end: number; text: string; wordCount: number; matchType: 'EXACT' | 'NEAR_MATCH' }> {
  const passages = [];
  let start = -1;
  for (let i = 0; i <= hits.length; i += 1) {
    if (i < hits.length && hits[i]) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      passages.push({
        start,
        end: i,
        text: words.slice(start, i).join(' '),
        wordCount: i - start,
        matchType,
      });
      start = -1;
    }
  }
  return passages;
}

function nearHits(submission: string[], source: string[]): boolean[] {
  const hits = Array(submission.length).fill(false);
  const window = 8;
  if (source.length < window || submission.length < window) return hits;
  const sourceShingles = new Set<string>();
  for (let i = 0; i <= source.length - 5; i += 1) sourceShingles.add(source.slice(i, i + 5).join(' '));
  for (let i = 0; i <= submission.length - window; i += 1) {
    let found = 0;
    for (let j = 0; j <= window - 5; j += 1) {
      if (sourceShingles.has(submission.slice(i + j, i + j + 5).join(' '))) found += 1;
    }
    if (found >= 2 && found < 4) {
      for (let j = 0; j < window; j += 1) hits[i + j] = true;
    }
  }
  return hits;
}

export function compareTexts(submissionText: string, sourceText: string, sourceName: string, sourceUrl: string | null, sourceType: PassageMatch['sourceType'], options: SimilarityOptions): PassageMatch[] {
  const submissionWords = wordsOf(submissionText);
  const sourceWords = wordsOf(sourceText);
  const excluded = new Set<number>();
  if (options.excludeQuotes) quoteWordIndexes(submissionText, submissionWords).forEach((index) => excluded.add(index));
  if (options.excludeBibliography) bibliographyWordIndexes(submissionText, submissionWords).forEach((index) => excluded.add(index));

  const exact = shingleHits(submissionWords, sourceWords);
  const near = nearHits(submissionWords, sourceWords);
  for (let i = 0; i < submissionWords.length; i += 1) {
    if (excluded.has(i)) {
      exact[i] = false;
      near[i] = false;
    }
    if (exact[i]) near[i] = false;
  }
  const passages = [
    ...collapse(submissionWords, exact, 'EXACT'),
    ...collapse(submissionWords, near, 'NEAR_MATCH'),
  ];
  return passages
    .filter((passage) => !options.excludeSmallMatches || passage.wordCount >= options.smallMatchThreshold)
    .map((passage) => ({
      sourceName,
      sourceUrl,
      sourceType,
      submissionText: passage.text,
      sourceText: passage.text,
      startPosition: passage.start,
      endPosition: passage.end,
      matchType: passage.matchType,
      wordCount: passage.wordCount,
    }));
}

export function similarityPercent(submissionText: string, passages: PassageMatch[]): number {
  const total = wordsOf(submissionText).length;
  if (total === 0) return 0;
  const covered = new Set<number>();
  for (const passage of passages) {
    for (let i = passage.startPosition; i < passage.endPosition; i += 1) covered.add(i);
  }
  return Math.round((covered.size / total) * 1000) / 10;
}

export async function buildSimilarityReport(submissionId: string, options?: Partial<SimilarityOptions>): Promise<void> {
  const submission = await prisma.submission.findUnique({
    where: { id: submissionId },
    include: { document: true, assignment: true },
  });
  if (!submission?.document.textContent) {
    await prisma.similarityReport.upsert({
      where: { submissionId },
      update: { overallSimilarity: 0, status: 'COMPLETED' },
      create: {
        submissionId,
        overallSimilarity: 0,
        status: 'COMPLETED',
        excludeQuotes: options?.excludeQuotes ?? true,
        excludeBibliography: options?.excludeBibliography ?? true,
        excludeSmallMatches: options?.excludeSmallMatches ?? true,
        smallMatchThreshold: options?.smallMatchThreshold ?? 8,
      },
    });
    return;
  }

  const resolved: SimilarityOptions = {
    excludeQuotes: options?.excludeQuotes ?? true,
    excludeBibliography: options?.excludeBibliography ?? true,
    excludeSmallMatches: options?.excludeSmallMatches ?? true,
    smallMatchThreshold: options?.smallMatchThreshold ?? 8,
  };
  const corpus = await prisma.corpusDocument.findMany();
  const peers = await prisma.submission.findMany({
    where: { assignmentId: submission.assignmentId, id: { not: submissionId } },
    include: { document: true, student: true },
  });

  const passages: PassageMatch[] = [];
  for (const source of corpus) {
    passages.push(...compareTexts(submission.document.textContent, source.text, `${source.title} — ${source.author}`, source.sourceUrl, 'PUBLICATION', resolved));
  }
  for (const peer of peers) {
    if (!peer.document.textContent) continue;
    passages.push(...compareTexts(
      submission.document.textContent,
      peer.document.textContent,
      `Another submission by ${peer.student.name}`,
      null,
      'STUDENT_PAPER',
      resolved,
    ));
  }

  const percent = similarityPercent(submission.document.textContent, passages);
  await prisma.$transaction(async (tx) => {
    const existing = await tx.similarityReport.findUnique({ where: { submissionId } });
    if (existing) {
      await tx.similarityPassage.deleteMany({ where: { source: { reportId: existing.id } } });
      await tx.similaritySource.deleteMany({ where: { reportId: existing.id } });
      await tx.similarityReport.delete({ where: { id: existing.id } });
    }
    const grouped = new Map<string, PassageMatch[]>();
    for (const passage of passages) {
      const key = `${passage.sourceType}:${passage.sourceName}`;
      grouped.set(key, [...(grouped.get(key) ?? []), passage]);
    }
    await tx.similarityReport.create({
      data: {
        submissionId,
        overallSimilarity: percent,
        status: 'COMPLETED',
        excludeQuotes: resolved.excludeQuotes,
        excludeBibliography: resolved.excludeBibliography,
        excludeSmallMatches: resolved.excludeSmallMatches,
        smallMatchThreshold: resolved.smallMatchThreshold,
        sources: {
          create: [...grouped.entries()].map(([, group]) => ({
            sourceName: group[0].sourceName,
            sourceUrl: group[0].sourceUrl,
            sourceType: group[0].sourceType,
            similarityPercentage: similarityPercent(submission.document.textContent || '', group),
            passages: {
              create: group.map((passage) => ({
                submissionText: passage.submissionText,
                sourceText: passage.sourceText,
                startPosition: passage.startPosition,
                endPosition: passage.endPosition,
                matchType: passage.matchType,
              })),
            },
          })),
        },
      },
    });
  });
}
