import { ABBREVIATIONS, FUNCTION_WORDS } from './lexicon';

export interface Span {
  start: number;
  end: number;
}

export interface Sentence extends Span {
  paragraph: number;
  raw: string;
  tokens: string[];
}

const WORD_RE = /[\p{L}\p{N}]+(?:['\u2019][\p{L}]+)*/gu;

export function tokenize(s: string): string[] {
  const out: string[] = [];
  for (const m of s.matchAll(WORD_RE)) out.push(m[0].toLowerCase().replace(/\u2019/g, "'"));
  return out;
}

export function countWords(text: string): number {
  let n = 0;
  for (const _ of text.matchAll(WORD_RE)) n++;
  return n;
}

function trimSpan(text: string, start: number, end: number): Span | null {
  while (start < end && /\s/.test(text[start])) start++;
  while (end > start && /\s/.test(text[end - 1])) end--;
  return end > start ? { start, end } : null;
}

export function splitParagraphs(text: string): Span[] {
  const spans: Span[] = [];
  const re = /\n[ \t\r\f\v]*\n\s*/g;
  let last = 0;
  for (const m of text.matchAll(re)) {
    const s = trimSpan(text, last, m.index ?? 0);
    if (s) spans.push(s);
    last = (m.index ?? 0) + m[0].length;
  }
  const tail = trimSpan(text, last, text.length);
  if (tail) spans.push(tail);
  return spans;
}

function precededByAbbreviation(text: string, from: number, dotIndex: number): boolean {
  let k = dotIndex - 1;
  while (k >= from && /[\p{L}.]/u.test(text[k])) k--;
  const word = text.slice(k + 1, dotIndex).toLowerCase();
  if (!word) return false;
  if (/^\p{L}$/u.test(word)) return true;
  return ABBREVIATIONS.has(word);
}

function splitSentenceSpans(text: string, para: Span): Span[] {
  const spans: Span[] = [];
  let start = para.start;
  for (let i = para.start; i < para.end; i++) {
    const c = text[i];
    if (c !== '.' && c !== '!' && c !== '?' && c !== '\u2026') continue;
    let j = i + 1;
    while (j < para.end && /[.!?\u2026]/.test(text[j])) j++;
    while (j < para.end && /["'\u201d\u2019)\]]/.test(text[j])) j++;
    if (j < para.end && !/\s/.test(text[j])) {
      i = j - 1;
      continue;
    }
    if (c === '.' && j === i + 1 && precededByAbbreviation(text, start, i)) continue;
    let k = j;
    while (k < para.end && /\s/.test(text[k])) k++;
    if (k < para.end && /\p{Ll}/u.test(text[k])) {
      i = j - 1;
      continue;
    }
    const s = trimSpan(text, start, j);
    if (s) spans.push(s);
    start = k;
    i = k - 1;
  }
  const tail = trimSpan(text, start, para.end);
  if (tail) spans.push(tail);
  return spans;
}

export interface Segmentation {
  paragraphs: Span[];
  sentences: Sentence[];
}

export function segment(text: string): Segmentation {
  const paragraphs = splitParagraphs(text);
  const sentences: Sentence[] = [];
  paragraphs.forEach((p, pi) => {
    for (const s of splitSentenceSpans(text, p)) {
      const raw = text.slice(s.start, s.end);
      const tokens = tokenize(raw);
      if (tokens.length > 0) sentences.push({ ...s, paragraph: pi, raw, tokens });
    }
  });
  return { paragraphs, sentences };
}

/** Share of tokens that are English closed-class words; English prose is typically 0.35-0.55. */
export function englishFunctionWordRatio(tokens: string[]): number {
  if (tokens.length === 0) return 0;
  let n = 0;
  for (const t of tokens) if (FUNCTION_WORDS.has(t)) n++;
  return n / tokens.length;
}

export const MIN_ENGLISH_FUNCTION_WORD_RATIO = 0.25;

export function detectLanguage(tokens: string[]): 'en' | 'unknown' {
  return englishFunctionWordRatio(tokens) >= MIN_ENGLISH_FUNCTION_WORD_RATIO ? 'en' : 'unknown';
}

/** FNV-1a 32-bit hash, used to derive a per-input PRNG seed. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
