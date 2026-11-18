import type { Token } from './types';

// Apostrophes join word parts ("don't" is one token); hyphens/dashes separate words,
// so "well-known" and "well known" tokenize identically.
const WORD_RE = /[\p{L}\p{N}\p{M}]+(?:['’‘ʼ`][\p{L}\p{N}\p{M}]+)*/gu;
const QUOTE_DASH_RE = /[‘’‚‛′ʼ`´“”„‟″«»‐‑‒–—―−]/g;
const NON_WORD_RE = /[^\p{L}\p{N}\p{M}]+/gu;
const ASCII_ALNUM_RE = /^[A-Za-z0-9]+$/;

export function normalizeWord(word: string): string {
  if (ASCII_ALNUM_RE.test(word)) return word.toLowerCase();
  return word
    .normalize('NFKC')
    .toLowerCase()
    .replace(QUOTE_DASH_RE, '')
    .replace(NON_WORD_RE, '');
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  if (!text) return tokens;
  WORD_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = WORD_RE.exec(text)) !== null) {
    const word = m[0];
    const norm = normalizeWord(word);
    if (norm.length === 0) continue;
    tokens.push({ word, norm, start: m.index, end: m.index + word.length });
  }
  return tokens;
}

/** 32-bit FNV-1a hash of a normalized word. */
export function hashWord(norm: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < norm.length; i++) {
    h ^= norm.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Hash of the k-gram starting at `pos`; collisions are harmless because seeds are verified word by word. */
export function hashKgram(wordHashes: Uint32Array, pos: number, k: number): number {
  let h = 0x9e3779b1;
  for (let i = pos; i < pos + k; i++) {
    h = Math.imul(h ^ wordHashes[i], 0x85ebca6b);
    h ^= h >>> 13;
  }
  return h >>> 0;
}
