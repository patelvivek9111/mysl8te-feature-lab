import { SimilarityIndex } from './similarityIndex';
import type { CorpusDocument, SimilarityOptions, SimilarityResult } from './types';

export type {
  SourceType,
  CorpusDocument,
  SimilarityOptions,
  MatchPassage,
  SourceMatch,
  SimilarityResult,
  ExcludedRegion,
  ExclusionReason,
  Token,
} from './types';
export { tokenize } from './tokenize';
export { SimilarityIndex, ALGORITHM_NAME, ALGORITHM_VERSION } from './similarityIndex';

/**
 * One-shot analysis: builds a throwaway SimilarityIndex over `corpus` (duplicate ids are
 * deduplicated, the later document wins) and analyzes `submissionText` against it.
 * Callers are responsible for not including the submission itself in the corpus.
 */
export function analyzeSimilarity(
  submissionText: string,
  corpus: CorpusDocument[],
  options: SimilarityOptions = {},
): SimilarityResult {
  const excluded = new Set(options.excludedSourceIds ?? []);
  const index = new SimilarityIndex(corpus.filter((d) => !excluded.has(d.id)));
  return index.analyze(submissionText, options);
}
