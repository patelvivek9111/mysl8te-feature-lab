import { findBibliographyRegion, findQuoteRegions } from './exclusions';
import { hashKgram, hashWord, tokenize } from './tokenize';
import type {
  CorpusDocument,
  ExcludedRegion,
  MatchPassage,
  SimilarityOptions,
  SimilarityResult,
  SourceMatch,
  Token,
} from './types';

export const ALGORITHM_NAME = 'mysl8te-kgram-seed-extend';
export const ALGORITHM_VERSION = '1.0.0';

export const DEFAULT_NGRAM_SIZE = 5;
export const DEFAULT_MIN_MATCH_WORDS = 8;
/** At most one substituted word per this many words of passage length. */
export const MISMATCH_RATIO_DENOMINATOR = 8;
/** A substituted word is only bridged if this many words immediately after it match again. */
export const MISMATCH_LOOKAHEAD = 3;
/** Same-source passages separated by at most this many words (on both sides) are merged. */
export const MERGE_GAP_WORDS = 2;

interface StoredDoc {
  doc: CorpusDocument;
  tokens: Token[];
  norms: string[];
  hashes: Uint32Array;
  alive: boolean;
}

/** Pair kinds in an alignment. */
const KIND_SUBST = 0;
const KIND_NEAR = 1;
const KIND_EXACT = 2;

interface Alignment {
  s: number[]; // submission token indexes (strictly increasing)
  t: number[]; // source token indexes (strictly increasing)
  kind: number[];
}

interface RawPassage {
  docNum: number;
  al: Alignment;
}

/**
 * Full (non-winnowed) inverted index of hashed word k-grams. Postings are kept as
 * linked lists in growable typed arrays so millions of postings stay compact.
 */
class KgramIndex {
  private head = new Map<number, number>();
  private next: Int32Array = new Int32Array(1024);
  private docArr: Int32Array = new Int32Array(1024);
  private posArr: Int32Array = new Int32Array(1024);
  private count = 0;

  constructor(readonly k: number) {}

  addDoc(docNum: number, hashes: Uint32Array): void {
    const k = this.k;
    for (let p = 0; p + k <= hashes.length; p++) {
      this.push(hashKgram(hashes, p, k), docNum, p);
    }
  }

  private push(h: number, docNum: number, pos: number): void {
    if (this.count === this.next.length) {
      const cap = this.next.length * 2;
      this.next = grow(this.next, cap);
      this.docArr = grow(this.docArr, cap);
      this.posArr = grow(this.posArr, cap);
    }
    const e = this.count++;
    const prev = this.head.get(h);
    this.next[e] = prev === undefined ? -1 : prev;
    this.docArr[e] = docNum;
    this.posArr[e] = pos;
    this.head.set(h, e);
  }

  forEach(h: number, fn: (docNum: number, pos: number) => void): void {
    let e = this.head.get(h);
    while (e !== undefined && e !== -1) {
      fn(this.docArr[e], this.posArr[e]);
      e = this.next[e];
    }
  }
}

function grow(a: Int32Array, cap: number): Int32Array {
  const b = new Int32Array(cap);
  b.set(a);
  return b;
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

export class SimilarityIndex {
  private docs: StoredDoc[] = [];
  private idToNum = new Map<string, number>();
  private kgramIndexes = new Map<number, KgramIndex>();
  private deadCount = 0;

  constructor(docs: Iterable<CorpusDocument> = []) {
    for (const d of docs) this.add(d);
  }

  /** Number of live documents in the index. */
  get size(): number {
    return this.idToNum.size;
  }

  has(id: string): boolean {
    return this.idToNum.has(id);
  }

  /** Adds a document; a document with an existing id replaces the earlier one. */
  add(doc: CorpusDocument): void {
    if (this.idToNum.has(doc.id)) this.remove(doc.id);
    const tokens = tokenize(doc.text);
    const norms = tokens.map((t) => t.norm);
    const hashes = new Uint32Array(norms.length);
    for (let i = 0; i < norms.length; i++) hashes[i] = hashWord(norms[i]);
    const docNum = this.docs.length;
    this.docs.push({ doc, tokens, norms, hashes, alive: true });
    this.idToNum.set(doc.id, docNum);
    for (const idx of this.kgramIndexes.values()) idx.addDoc(docNum, hashes);
  }

  remove(id: string): boolean {
    const num = this.idToNum.get(id);
    if (num === undefined) return false;
    this.idToNum.delete(id);
    const d = this.docs[num];
    d.alive = false;
    d.tokens = [];
    d.norms = [];
    d.hashes = new Uint32Array(0);
    this.deadCount++;
    if (this.deadCount > 64 && this.deadCount > this.idToNum.size) this.compact();
    return true;
  }

  private compact(): void {
    const live = this.docs.filter((d) => d.alive);
    this.docs = live;
    this.idToNum.clear();
    live.forEach((d, i) => this.idToNum.set(d.doc.id, i));
    this.deadCount = 0;
    this.kgramIndexes.clear();
  }

  private kgramIndex(k: number): KgramIndex {
    let idx = this.kgramIndexes.get(k);
    if (!idx) {
      idx = new KgramIndex(k);
      for (let n = 0; n < this.docs.length; n++) {
        if (this.docs[n].alive) idx.addDoc(n, this.docs[n].hashes);
      }
      this.kgramIndexes.set(k, idx);
    }
    return idx;
  }

  analyze(submissionText: string, options: SimilarityOptions = {}): SimilarityResult {
    const excludeQuotes = options.excludeQuotes ?? true;
    const excludeBibliography = options.excludeBibliography ?? true;
    const minMatchWords = Math.max(1, Math.floor(options.minMatchWords ?? DEFAULT_MIN_MATCH_WORDS));
    const k = Math.max(1, Math.floor(options.ngramSize ?? DEFAULT_NGRAM_SIZE));
    const excludedIds = new Set(options.excludedSourceIds ?? []);

    const text = submissionText ?? '';
    const tokens = tokenize(text);
    const n = tokens.length;
    const norms = tokens.map((t) => t.norm);
    const hashes = new Uint32Array(n);
    for (let i = 0; i < n; i++) hashes[i] = hashWord(norms[i]);

    const excludedRegions: ExcludedRegion[] = [];
    if (excludeQuotes) excludedRegions.push(...findQuoteRegions(text));
    if (excludeBibliography) {
      const bib = findBibliographyRegion(text);
      if (bib) excludedRegions.push(bib);
    }
    excludedRegions.sort((a, b) => a.start - b.start || a.end - b.end);
    const excluded = markExcluded(tokens, excludedRegions);

    const raw = this.findPassages(tokens, norms, hashes, excluded, k, excludedIds);
    const merged = mergePerSource(raw, excluded);
    const candidates = merged.filter((p) => spanWords(p.al) >= minMatchWords);
    const passages = this.attribute(candidates, tokens, n, minMatchWords);

    const sourceMap = new Map<number, MatchPassage[]>();
    for (const { docNum, passage } of passages) {
      let list = sourceMap.get(docNum);
      if (!list) sourceMap.set(docNum, (list = []));
      list.push(passage);
    }
    const sources: SourceMatch[] = [];
    for (const [docNum, list] of sourceMap) {
      const doc = this.docs[docNum].doc;
      list.sort((a, b) => a.start - b.start);
      const matchedWords = list.reduce((acc, p) => acc + p.wordCount, 0);
      const sm: SourceMatch = {
        sourceId: doc.id,
        title: doc.title,
        type: doc.type,
        matchedWords,
        percent: n === 0 ? 0 : round1((matchedWords / n) * 100),
        passages: list,
        rank: 0,
      };
      if (doc.url !== undefined) sm.url = doc.url;
      sources.push(sm);
    }
    sources.sort(
      (a, b) => b.matchedWords - a.matchedWords || (a.sourceId < b.sourceId ? -1 : a.sourceId > b.sourceId ? 1 : 0),
    );
    sources.forEach((s, i) => (s.rank = i + 1));

    const allPassages = passages.map((p) => p.passage).sort((a, b) => a.start - b.start);
    const matchedWords = allPassages.reduce((acc, p) => acc + p.wordCount, 0);

    return {
      overallPercent: n === 0 ? 0 : round1((matchedWords / n) * 100),
      totalWords: n,
      matchedWords,
      sources,
      passages: allPassages,
      excludedRegions,
      algorithm: {
        name: ALGORITHM_NAME,
        version: ALGORITHM_VERSION,
        params: {
          ngramSize: k,
          minMatchWords,
          excludeQuotes,
          excludeBibliography,
          mismatchRatioDenominator: MISMATCH_RATIO_DENOMINATOR,
          mismatchLookahead: MISMATCH_LOOKAHEAD,
          mergeGapWords: MERGE_GAP_WORDS,
          corpusSize: this.size,
          excludedSourceCount: excludedIds.size,
        },
      },
    };
  }

  /** Seed with k-gram hits, verify, then greedily extend each seed to a maximal passage. */
  private findPassages(
    tokens: Token[],
    norms: string[],
    hashes: Uint32Array,
    excluded: Uint8Array,
    k: number,
    excludedIds: Set<string>,
  ): RawPassage[] {
    const n = norms.length;
    const out: RawPassage[] = [];
    if (n < k || this.size === 0) return out;
    const index = this.kgramIndex(k);
    // docNum -> diagonal (i - j) -> exclusive submission token end already covered on that diagonal
    const covered = new Map<number, Map<number, number>>();

    // Prefix count of excluded tokens so a k-gram window can be tested in O(1).
    const exPrefix = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) exPrefix[i + 1] = exPrefix[i] + excluded[i];

    for (let i = 0; i + k <= n; i++) {
      if (exPrefix[i + k] - exPrefix[i] > 0) continue;
      const h = hashKgram(hashes, i, k);
      index.forEach(h, (docNum, j) => {
        const sd = this.docs[docNum];
        if (!sd.alive || excludedIds.has(sd.doc.id)) return;
        const diag = i - j;
        let diagMap = covered.get(docNum);
        if (diagMap && (diagMap.get(diag) ?? -1) > i) return;
        const src = sd.norms;
        for (let x = 0; x < k; x++) if (norms[i + x] !== src[j + x]) return;
        const al = extendSeed(tokens, norms, excluded, sd.tokens, src, i, j, k);
        if (!diagMap) covered.set(docNum, (diagMap = new Map()));
        diagMap.set(diag, al.s[al.s.length - 1] + 1);
        out.push({ docNum, al });
      });
    }
    return out;
  }

  /**
   * Primary-source attribution: passages are processed longest first and each submission
   * word is claimed by at most one passage. Remaining unclaimed sub-runs of a passage survive
   * only if they still meet minMatchWords.
   */
  private attribute(
    candidates: RawPassage[],
    tokens: Token[],
    n: number,
    minMatchWords: number,
  ): { docNum: number; passage: MatchPassage }[] {
    const order = candidates.slice().sort((a, b) => {
      const d = spanWords(b.al) - spanWords(a.al);
      if (d !== 0) return d;
      const ia = this.docs[a.docNum].doc.id;
      const ib = this.docs[b.docNum].doc.id;
      if (ia !== ib) return ia < ib ? -1 : 1;
      return a.al.s[0] - b.al.s[0];
    });
    const claimed = new Uint8Array(n);
    const out: { docNum: number; passage: MatchPassage }[] = [];

    for (const p of order) {
      const { s, t, kind } = p.al;
      const srcTokens = this.docs[p.docNum].tokens;
      const first = s[0];
      const last = s[s.length - 1];
      // Map submission token -> alignment index for this passage.
      const pairAt = new Map<number, number>();
      for (let x = 0; x < s.length; x++) pairAt.set(s[x], x);

      let runStart = -1;
      const flush = (runEnd: number) => {
        // Trim the run so it starts and ends on norm-equal pairs.
        let a = runStart;
        let b = runEnd;
        while (a <= b && !isMatchPair(pairAt.get(a), kind)) a++;
        while (b >= a && !isMatchPair(pairAt.get(b), kind)) b--;
        if (a > b) return;
        const wordCount = b - a + 1;
        if (wordCount < minMatchWords) return;
        const pa = pairAt.get(a) as number;
        const pb = pairAt.get(b) as number;
        let exact = pb - pa === b - a && t[pb] - t[pa] === b - a;
        for (let x = pa; exact && x <= pb; x++) if (kind[x] !== KIND_EXACT) exact = false;
        for (let x = a; x <= b; x++) claimed[x] = 1;
        out.push({
          docNum: p.docNum,
          passage: {
            sourceId: this.docs[p.docNum].doc.id,
            start: tokens[a].start,
            end: tokens[b].end,
            sourceStart: srcTokens[t[pa]].start,
            sourceEnd: srcTokens[t[pb]].end,
            wordCount,
            matchType: exact ? 'EXACT' : 'NEAR',
          },
        });
      };

      for (let i = first; i <= last; i++) {
        if (!claimed[i]) {
          if (runStart === -1) runStart = i;
        } else if (runStart !== -1) {
          flush(i - 1);
          runStart = -1;
        }
      }
      if (runStart !== -1) flush(last);
    }
    return out;
  }
}

function isMatchPair(x: number | undefined, kind: number[]): boolean {
  return x !== undefined && kind[x] !== KIND_SUBST;
}

function spanWords(al: Alignment): number {
  return al.s[al.s.length - 1] - al.s[0] + 1;
}

function markExcluded(tokens: Token[], regions: ExcludedRegion[]): Uint8Array {
  const ex = new Uint8Array(tokens.length);
  if (regions.length === 0) return ex;
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    for (const r of regions) {
      if (r.start >= tk.end) break;
      if (tk.start < r.end && tk.end > r.start) {
        ex[i] = 1;
        break;
      }
    }
  }
  return ex;
}

/**
 * Extends a verified seed [i, i+k) <-> [j, j+k) right then left, word by word. A single
 * mismatched word is bridged (as a substitution) only if the next MISMATCH_LOOKAHEAD words
 * match again and the passage stays within 1 mismatch per MISMATCH_RATIO_DENOMINATOR words.
 * Excluded submission tokens are hard barriers.
 */
function extendSeed(
  subTokens: Token[],
  sub: string[],
  excluded: Uint8Array,
  srcTokens: Token[],
  src: string[],
  i: number,
  j: number,
  k: number,
): Alignment {
  const n = sub.length;
  const m = src.length;
  const L = MISMATCH_LOOKAHEAD;
  const R = MISMATCH_RATIO_DENOMINATOR;
  let len = k;
  let mm = 0;
  const kindOf = (p: number, q: number) => (subTokens[p].word === srcTokens[q].word ? KIND_EXACT : KIND_NEAR);

  const right: [number, number, number][] = [];
  let p = i + k;
  let q = j + k;
  while (p < n && q < m && !excluded[p]) {
    if (sub[p] === src[q]) {
      right.push([p, q, kindOf(p, q)]);
      len++;
      p++;
      q++;
      continue;
    }
    let ok = (mm + 1) * R <= len + 1 + L;
    for (let l = 1; ok && l <= L; l++) {
      if (p + l >= n || q + l >= m || excluded[p + l] || sub[p + l] !== src[q + l]) ok = false;
    }
    if (!ok) break;
    mm++;
    right.push([p, q, KIND_SUBST]);
    len++;
    p++;
    q++;
  }

  const left: [number, number, number][] = [];
  p = i - 1;
  q = j - 1;
  while (p >= 0 && q >= 0 && !excluded[p]) {
    if (sub[p] === src[q]) {
      left.push([p, q, kindOf(p, q)]);
      len++;
      p--;
      q--;
      continue;
    }
    let ok = (mm + 1) * R <= len + 1 + L;
    for (let l = 1; ok && l <= L; l++) {
      if (p - l < 0 || q - l < 0 || excluded[p - l] || sub[p - l] !== src[q - l]) ok = false;
    }
    if (!ok) break;
    mm++;
    left.push([p, q, KIND_SUBST]);
    len++;
    p--;
    q--;
  }

  const al: Alignment = { s: [], t: [], kind: [] };
  for (let x = left.length - 1; x >= 0; x--) pushPair(al, left[x]);
  for (let x = 0; x < k; x++) pushPair(al, [i + x, j + x, kindOf(i + x, j + x)]);
  for (const pr of right) pushPair(al, pr);
  return al;
}

function pushPair(al: Alignment, [s, t, kind]: [number, number, number]): void {
  al.s.push(s);
  al.t.push(t);
  al.kind.push(kind);
}

/**
 * Merges same-source passages that overlap or are separated by at most MERGE_GAP_WORDS
 * on both the submission and source side (covers small insertions/deletions). Gaps
 * never bridge excluded submission tokens.
 */
function mergePerSource(raw: RawPassage[], excluded: Uint8Array): RawPassage[] {
  const byDoc = new Map<number, RawPassage[]>();
  for (const p of raw) {
    let list = byDoc.get(p.docNum);
    if (!list) byDoc.set(p.docNum, (list = []));
    list.push(p);
  }
  const out: RawPassage[] = [];
  for (const list of byDoc.values()) {
    list.sort((a, b) => a.al.s[0] - b.al.s[0] || a.al.t[0] - b.al.t[0]);
    const kept: RawPassage[] = [];
    for (const p of list) {
      let mergedInto = false;
      for (let x = kept.length - 1; x >= 0 && x >= kept.length - 4; x--) {
        const res = tryMerge(kept[x], p, excluded);
        if (res === 'merged' || res === 'subsumed') {
          mergedInto = true;
          break;
        }
      }
      if (!mergedInto) kept.push(p);
    }
    out.push(...kept);
  }
  return out;
}

function tryMerge(a: RawPassage, b: RawPassage, excluded: Uint8Array): 'merged' | 'subsumed' | 'no' {
  const A = a.al;
  const B = b.al;
  const lastS = A.s[A.s.length - 1];
  const lastT = A.t[A.t.length - 1];
  if (B.s[0] > lastS + 1 + MERGE_GAP_WORDS) return 'no';
  let x = 0;
  while (x < B.s.length && (B.s[x] <= lastS || B.t[x] <= lastT || B.kind[x] === KIND_SUBST)) x++;
  if (x === B.s.length) {
    // Nothing of b extends a consistently; drop b only if a already covers its span on a compatible diagonal.
    const bLast = B.s[B.s.length - 1];
    const sameRegion = B.t[0] >= A.t[0] && B.t[B.t.length - 1] <= lastT + MERGE_GAP_WORDS;
    return bLast <= lastS && sameRegion ? 'subsumed' : 'no';
  }
  const sGap = B.s[x] - lastS - 1;
  const tGap = B.t[x] - lastT - 1;
  if (sGap > MERGE_GAP_WORDS || tGap > MERGE_GAP_WORDS) return 'no';
  for (let g = lastS + 1; g < B.s[x]; g++) if (excluded[g]) return 'no';
  for (; x < B.s.length; x++) {
    A.s.push(B.s[x]);
    A.t.push(B.t[x]);
    A.kind.push(B.kind[x]);
  }
  return 'merged';
}
