export type SourceType = 'STUDENT_PAPER' | 'REFERENCE' | 'INTERNET';

export interface CorpusDocument {
  id: string;
  title: string;
  type: SourceType;
  text: string;
  url?: string;
}

export interface SimilarityOptions {
  /** Default true: text inside quotation marks cannot match. */
  excludeQuotes?: boolean;
  /** Default true: text after a trailing References/Bibliography/Works Cited heading cannot match. */
  excludeBibliography?: boolean;
  /** Default 8: drop match passages shorter than this many words. */
  minMatchWords?: number;
  /** Manual source exclusions. */
  excludedSourceIds?: string[];
  /** Default 5 (word k-grams). */
  ngramSize?: number;
}

export interface MatchPassage {
  sourceId: string;
  /** Char offsets in the ORIGINAL submission text (end exclusive). */
  start: number;
  end: number;
  /** Char offsets in the ORIGINAL source text (end exclusive). */
  sourceStart: number;
  sourceEnd: number;
  wordCount: number;
  /** NEAR = matched after normalization/minor edits (case, punctuation, small word substitutions). */
  matchType: 'EXACT' | 'NEAR';
}

export interface SourceMatch {
  sourceId: string;
  title: string;
  type: SourceType;
  url?: string;
  matchedWords: number;
  percent: number;
  passages: MatchPassage[];
  rank: number;
}

export type ExclusionReason = 'QUOTE' | 'BIBLIOGRAPHY';

export interface ExcludedRegion {
  start: number;
  end: number;
  reason: ExclusionReason;
}

export interface SimilarityResult {
  /** Unique matched submission words (union across sources) / totalWords * 100, rounded to 1 decimal. */
  overallPercent: number;
  /** All words in the submission; excluded regions simply cannot match. */
  totalWords: number;
  matchedWords: number;
  sources: SourceMatch[];
  passages: MatchPassage[];
  excludedRegions: ExcludedRegion[];
  algorithm: { name: string; version: string; params: Record<string, number | boolean> };
}

export interface Token {
  word: string;
  norm: string;
  start: number;
  end: number;
}
