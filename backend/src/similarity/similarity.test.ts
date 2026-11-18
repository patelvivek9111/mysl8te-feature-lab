import { describe, expect, it } from 'vitest';
import { analyzeSimilarity, SimilarityIndex, tokenize, type CorpusDocument } from './index';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SYLLABLES = ['ka', 'lo', 'mi', 'ne', 'ru', 'ta', 'vo', 'zi', 'pe', 'su', 'da', 'go', 'hu', 'ji', 'be', 'xo'];

function buildVocabulary(size: number, rand: () => number): string[] {
  const seen = new Set<string>();
  while (seen.size < size) {
    const len = 2 + Math.floor(rand() * 3);
    let w = '';
    for (let i = 0; i < len; i++) w += SYLLABLES[Math.floor(rand() * SYLLABLES.length)];
    seen.add(w);
  }
  return [...seen];
}

function randomWords(vocab: string[], count: number, rand: () => number): string[] {
  const out: string[] = [];
  for (let i = 0; i < count; i++) out.push(vocab[Math.floor(rand() * vocab.length)]);
  return out;
}

function doc(id: string, text: string, type: CorpusDocument['type'] = 'REFERENCE'): CorpusDocument {
  return { id, title: `Title ${id}`, type, text };
}

const wc = (s: string) => tokenize(s).length;

const SOURCE_A =
  'Photosynthesis is the process by which green plants and certain other organisms transform light energy into chemical energy. ' +
  'During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds. ' +
  'It would be impossible to overestimate the importance of photosynthesis in the maintenance of life on Earth.';

const SOURCE_B =
  'The French Revolution was a period of political and societal change in France that began with the Estates General of 1789 ' +
  'and ended with the coup of 18 Brumaire in November 1799 and the formation of the French Consulate. ' +
  'Many of its ideas are considered fundamental principles of liberal democracy, while its values and institutions remain central to modern French political discourse.';

const UNRELATED =
  'My grandmother kept bees behind the old barn every summer, and we would sit on the porch eating honey toast ' +
  'while the dogs chased swallows across the yard until the sun finally dipped below the hills.';

describe('tokenize', () => {
  it('preserves original char offsets and normalizes', () => {
    const text = 'Hello, WORLD! It’s “fine”—really.';
    const toks = tokenize(text);
    expect(toks.map((t) => t.norm)).toEqual(['hello', 'world', 'its', 'fine', 'really']);
    for (const t of toks) expect(text.slice(t.start, t.end)).toBe(t.word);
    expect(toks[2].word).toBe('It’s');
  });

  it('applies NFKC and handles empty input', () => {
    expect(tokenize('')).toEqual([]);
    expect(tokenize('   ,,, !!! ')).toEqual([]);
    expect(tokenize('Ｆｕｌｌｗｉｄｔｈ ﬁne').map((t) => t.norm)).toEqual(['fullwidth', 'fine']);
  });

  it('treats curly and straight apostrophes identically', () => {
    expect(tokenize("don't").map((t) => t.norm)).toEqual(tokenize('don’t').map((t) => t.norm));
  });
});

describe('analyzeSimilarity basics', () => {
  it('identical text is 100% with a single EXACT passage', () => {
    const r = analyzeSimilarity(SOURCE_A, [doc('a', SOURCE_A)]);
    expect(r.overallPercent).toBe(100);
    expect(r.totalWords).toBe(wc(SOURCE_A));
    expect(r.matchedWords).toBe(r.totalWords);
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0]).toMatchObject({ sourceId: 'a', rank: 1, percent: 100, title: 'Title a', type: 'REFERENCE' });
    expect(r.passages).toHaveLength(1);
    expect(r.passages[0].matchType).toBe('EXACT');
    expect(r.passages[0].start).toBe(0);
    expect(r.passages[0].end).toBe(SOURCE_A.length - 1); // trailing "." is not part of a word
    expect(r.passages[0].sourceStart).toBe(0);
  });

  it('unrelated text is 0%', () => {
    const r = analyzeSimilarity(UNRELATED, [doc('a', SOURCE_A), doc('b', SOURCE_B)]);
    expect(r.overallPercent).toBe(0);
    expect(r.matchedWords).toBe(0);
    expect(r.sources).toEqual([]);
    expect(r.passages).toEqual([]);
  });

  it('empty submission and empty corpus are handled', () => {
    const r1 = analyzeSimilarity('', [doc('a', SOURCE_A)]);
    expect(r1).toMatchObject({ overallPercent: 0, totalWords: 0, matchedWords: 0, sources: [], passages: [] });
    const r2 = analyzeSimilarity(SOURCE_A, []);
    expect(r2.overallPercent).toBe(0);
    expect(r2.totalWords).toBe(wc(SOURCE_A));
    const r3 = analyzeSimilarity(SOURCE_A, [doc('empty', '')]);
    expect(r3.overallPercent).toBe(0);
  });

  it('partial copy yields correct percentage and char offsets', () => {
    const copied =
      'During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen and energy-rich organic compounds.';
    const submission = `${UNRELATED} ${copied} ${UNRELATED.replace('grandmother', 'uncle')}`;
    const r = analyzeSimilarity(submission, [doc('a', SOURCE_A)]);
    expect(r.passages).toHaveLength(1);
    const p = r.passages[0];
    expect(p.matchType).toBe('EXACT');
    expect(submission.slice(p.start, p.end + 1)).toBe(copied);
    expect(submission.slice(p.start, p.end)).toContain('light energy is captured and used to convert water');
    expect(SOURCE_A.slice(p.sourceStart, p.sourceEnd)).toBe(submission.slice(p.start, p.end));
    expect(p.wordCount).toBe(wc(copied));
    expect(r.matchedWords).toBe(wc(copied));
    expect(r.totalWords).toBe(wc(submission));
    expect(r.overallPercent).toBe(Math.round((wc(copied) / wc(submission)) * 1000) / 10);
  });

  it('case and punctuation changes still match, classified as NEAR', () => {
    const changed =
      'during PHOTOSYNTHESIS in green plants light energy is captured, and used to convert water carbon dioxide and minerals into oxygen';
    const r = analyzeSimilarity(`${UNRELATED} ${changed}`, [doc('a', SOURCE_A)]);
    expect(r.passages).toHaveLength(1);
    expect(r.passages[0].matchType).toBe('NEAR');
    expect(r.passages[0].wordCount).toBe(wc(changed));
  });

  it('punctuation-only differences between words stay EXACT (inter-word punctuation is ignored)', () => {
    const changed =
      'During photosynthesis in green plants; light energy is captured and used to convert water carbon dioxide and minerals';
    const r = analyzeSimilarity(changed, [doc('a', SOURCE_A)]);
    expect(r.passages).toHaveLength(1);
    expect(r.passages[0].matchType).toBe('EXACT');
    expect(r.overallPercent).toBe(100);
  });

  it('a one-word substitution inside a long copied passage yields a single NEAR passage', () => {
    const original =
      'During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen';
    const edited = original.replace('captured', 'harvested');
    const submission = `${UNRELATED} ${edited} ${UNRELATED.replace('bees', 'goats')}`;
    const r = analyzeSimilarity(submission, [doc('a', SOURCE_A)]);
    expect(r.passages).toHaveLength(1);
    const p = r.passages[0];
    expect(p.matchType).toBe('NEAR');
    expect(submission.slice(p.start, p.end)).toBe(edited);
    expect(p.wordCount).toBe(wc(edited));
    expect(SOURCE_A.slice(p.sourceStart, p.sourceEnd)).toBe(original);
  });

  it('many substitutions break a passage apart', () => {
    const words = tokenize(SOURCE_A).map((t) => t.word);
    const mangled = words.map((w, i) => (i % 3 === 0 ? 'zzz' : w)).join(' ');
    const r = analyzeSimilarity(mangled, [doc('a', SOURCE_A)]);
    expect(r.overallPercent).toBe(0);
  });
});

describe('exclusions and options', () => {
  const copied =
    'During photosynthesis in green plants, light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen';

  it('quoted matches are excluded by default and included when excludeQuotes=false', () => {
    const submission = `${UNRELATED} As the textbook says, "${copied}" which is true.`;
    const on = analyzeSimilarity(submission, [doc('a', SOURCE_A)]);
    expect(on.overallPercent).toBe(0);
    expect(on.excludedRegions).toHaveLength(1);
    expect(on.excludedRegions[0].reason).toBe('QUOTE');
    expect(submission.slice(on.excludedRegions[0].start, on.excludedRegions[0].end)).toBe(`"${copied}"`);

    const off = analyzeSimilarity(submission, [doc('a', SOURCE_A)], { excludeQuotes: false });
    expect(off.excludedRegions).toEqual([]);
    expect(off.matchedWords).toBe(wc(copied));
    expect(off.passages[0].matchType).toBe('EXACT');
  });

  it('curly quotes and guillemets are recognized as quotations', () => {
    for (const [o, c] of [
      ['“', '”'],
      ['«', '»'],
    ]) {
      const submission = `${UNRELATED} ${o}${copied}${c} end.`;
      const r = analyzeSimilarity(submission, [doc('a', SOURCE_A)]);
      expect(r.overallPercent).toBe(0);
      expect(r.excludedRegions[0].reason).toBe('QUOTE');
    }
  });

  it('copied text outside a quotation still matches', () => {
    const submission = `"A short quote here." ${copied}. "Another quote."`;
    const r = analyzeSimilarity(submission, [doc('a', SOURCE_A)]);
    expect(r.excludedRegions).toHaveLength(2);
    expect(r.matchedWords).toBe(wc(copied));
  });

  it('bibliography after a trailing heading is excluded by default', () => {
    const bib = 'Smith, J. (2020). During photosynthesis in green plants, light energy is captured and used to convert water. Journal of Plants.';
    for (const heading of ['References', 'BIBLIOGRAPHY', 'Works Cited:', '## Reference List', '7. Sources']) {
      const submission = `${UNRELATED}\n\n${heading}\n${bib}`;
      const r = analyzeSimilarity(submission, [doc('a', SOURCE_A)]);
      expect(r.overallPercent).toBe(0);
      expect(r.excludedRegions).toHaveLength(1);
      expect(r.excludedRegions[0].reason).toBe('BIBLIOGRAPHY');
      expect(submission.slice(r.excludedRegions[0].start)).toBe(`${heading}\n${bib}`);
      expect(r.totalWords).toBe(wc(submission));

      const off = analyzeSimilarity(submission, [doc('a', SOURCE_A)], { excludeBibliography: false });
      expect(off.matchedWords).toBeGreaterThanOrEqual(12);
    }
  });

  it('a heading word inside a sentence does not trigger bibliography exclusion', () => {
    const submission = `References are important. ${copied}`;
    const r = analyzeSimilarity(submission, [doc('a', SOURCE_A)]);
    expect(r.excludedRegions).toEqual([]);
    expect(r.matchedWords).toBe(wc(copied));
  });

  it('minMatchWords filters short passages', () => {
    const short = 'light energy is captured and used to convert'; // 8 words
    const submission = `${UNRELATED} ${short} ${UNRELATED.replace('bees', 'goats')}`;
    expect(analyzeSimilarity(submission, [doc('a', SOURCE_A)]).matchedWords).toBe(8);
    expect(analyzeSimilarity(submission, [doc('a', SOURCE_A)], { minMatchWords: 9 }).matchedWords).toBe(0);
    const six = 'light energy is captured and used';
    const sub6 = `${UNRELATED} ${six} ${UNRELATED.replace('bees', 'goats')}`;
    expect(analyzeSimilarity(sub6, [doc('a', SOURCE_A)]).matchedWords).toBe(0);
    expect(analyzeSimilarity(sub6, [doc('a', SOURCE_A)], { minMatchWords: 5 }).matchedWords).toBe(6);
  });

  it('ngramSize option controls the seed length', () => {
    const four = 'is captured and used';
    const sub = `${UNRELATED} ${four} ${UNRELATED.replace('bees', 'goats')}`;
    expect(analyzeSimilarity(sub, [doc('a', SOURCE_A)], { minMatchWords: 4 }).matchedWords).toBe(0);
    const r = analyzeSimilarity(sub, [doc('a', SOURCE_A)], { minMatchWords: 4, ngramSize: 3 });
    expect(r.matchedWords).toBe(4);
    expect(r.algorithm.params.ngramSize).toBe(3);
  });

  it('excludedSourceIds removes sources and lets the next best source take over', () => {
    const corpus = [doc('a', SOURCE_A), doc('a-copy', SOURCE_A, 'STUDENT_PAPER')];
    const both = analyzeSimilarity(SOURCE_A, corpus);
    expect(both.sources).toHaveLength(1);
    expect(both.sources[0].sourceId).toBe('a'); // tie broken deterministically by id
    const r = analyzeSimilarity(SOURCE_A, corpus, { excludedSourceIds: ['a'] });
    expect(r.sources).toHaveLength(1);
    expect(r.sources[0].sourceId).toBe('a-copy');
    expect(r.sources[0].type).toBe('STUDENT_PAPER');
    expect(r.overallPercent).toBe(100);
    const none = analyzeSimilarity(SOURCE_A, corpus, { excludedSourceIds: ['a', 'a-copy'] });
    expect(none.overallPercent).toBe(0);
  });

  it('reports algorithm metadata', () => {
    const r = analyzeSimilarity('x', []);
    expect(r.algorithm.name).toBeTruthy();
    expect(r.algorithm.version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(r.algorithm.params).toMatchObject({ ngramSize: 5, minMatchWords: 8, excludeQuotes: true, excludeBibliography: true });
  });
});

describe('multi-source attribution', () => {
  it('attributes each submission word to a single primary source and percentages add up', () => {
    const fromA = 'light energy is captured and used to convert water, carbon dioxide, and minerals into oxygen';
    const fromB =
      'began with the Estates General of 1789 and ended with the coup of 18 Brumaire in November 1799 and the formation of the French Consulate';
    const submission = `${fromA}. ${UNRELATED} ${fromB}.`;
    // C contains a longer overlap with A's sentence plus a short tail, so it competes with A.
    const sourceC = `Some intro. ${fromA} and energy-rich organic compounds were also studied.`;
    const r = analyzeSimilarity(submission, [
      { id: 'a', title: 'A', type: 'REFERENCE', text: SOURCE_A, url: 'https://example.org/a' },
      doc('b', SOURCE_B, 'INTERNET'),
      doc('c', sourceC, 'STUDENT_PAPER'),
    ]);
    expect(r.matchedWords).toBe(wc(fromA) + wc(fromB));
    const sumSources = r.sources.reduce((s, x) => s + x.matchedWords, 0);
    expect(sumSources).toBe(r.matchedWords);
    const sumPercent = r.sources.reduce((s, x) => s + x.percent, 0);
    expect(r.overallPercent).toBeLessThanOrEqual(sumPercent + 0.1 * r.sources.length);

    // A and C tie on the shared passage; only one of them gets it.
    expect(r.sources).toHaveLength(2);
    expect(r.sources[0]).toMatchObject({ sourceId: 'b', rank: 1, type: 'INTERNET' });
    expect(r.sources[1]).toMatchObject({ sourceId: 'a', rank: 2, url: 'https://example.org/a' });

    // No two passages overlap in the submission.
    for (let i = 1; i < r.passages.length; i++) {
      expect(r.passages[i].start).toBeGreaterThanOrEqual(r.passages[i - 1].end);
    }
  });

  it('longest source wins overlapping regions and the remainder stays with the other source', () => {
    const words = randomWords(buildVocabulary(500, mulberry32(7)), 60, mulberry32(8));
    const submission = words.join(' ');
    const long = doc('long', words.slice(0, 40).join(' '));
    const shortOverlap = doc('short', words.slice(30, 60).join(' '));
    const r = analyzeSimilarity(submission, [shortOverlap, long]);
    expect(r.overallPercent).toBe(100);
    const byId = Object.fromEntries(r.sources.map((s) => [s.sourceId, s]));
    expect(byId.long.matchedWords).toBe(40);
    expect(byId.short.matchedWords).toBe(20);
    expect(byId.short.passages[0].start).toBe(byId.long.passages[0].end + 1);
    expect(r.sources.map((s) => s.rank)).toEqual([1, 2]);
  });

  it('handles curly quotes / unicode in sources and submissions', () => {
    const source = 'Itʼs widely believed that the café’s “signature” crème brûlée was invented by a chef from Lyon in 1920.';
    const submission = `It's widely believed that the CAFÉ'S "signature" crème brûlée was invented by a chef from Lyon in 1920`;
    const r = analyzeSimilarity(submission, [doc('u', source)], { excludeQuotes: false });
    expect(r.overallPercent).toBe(100);
    expect(r.passages[0].matchType).toBe('NEAR');
    const quoted = analyzeSimilarity(submission, [doc('u', source)]);
    expect(quoted.excludedRegions).toHaveLength(1);
    // The quoted word is a barrier: the 6 words before it fall below minMatchWords, the 11 after it match.
    expect(quoted.matchedWords).toBe(11);
    expect(submission.slice(quoted.passages[0].start, quoted.passages[0].end)).toBe(
      'crème brûlée was invented by a chef from Lyon in 1920',
    );
  });
});

describe('SimilarityIndex', () => {
  it('supports add/remove/size, dedupes ids and is reusable', () => {
    const idx = new SimilarityIndex();
    expect(idx.size).toBe(0);
    idx.add(doc('a', SOURCE_A));
    idx.add(doc('b', SOURCE_B));
    expect(idx.size).toBe(2);
    expect(idx.analyze(SOURCE_A).sources[0].sourceId).toBe('a');

    idx.add(doc('a', UNRELATED)); // replace
    expect(idx.size).toBe(2);
    expect(idx.analyze(SOURCE_A).overallPercent).toBe(0);
    expect(idx.analyze(UNRELATED).overallPercent).toBe(100);

    expect(idx.remove('a')).toBe(true);
    expect(idx.remove('a')).toBe(false);
    expect(idx.size).toBe(1);
    expect(idx.analyze(UNRELATED).overallPercent).toBe(0);
    expect(idx.analyze(SOURCE_B).overallPercent).toBe(100);
  });

  it('analyzeSimilarity dedupes identical corpus ids', () => {
    const r = analyzeSimilarity(SOURCE_A, [doc('a', SOURCE_A), doc('a', SOURCE_A)]);
    expect(r.sources).toHaveLength(1);
    expect(r.overallPercent).toBe(100);
  });

  it('survives many removals (compaction) and still matches remaining docs', () => {
    const rand = mulberry32(99);
    const vocab = buildVocabulary(2000, rand);
    const idx = new SimilarityIndex();
    const texts: string[] = [];
    for (let i = 0; i < 200; i++) {
      texts.push(randomWords(vocab, 60, rand).join(' '));
      idx.add(doc(`d${i}`, texts[i]));
    }
    idx.analyze('warm up the k-gram index');
    for (let i = 0; i < 150; i++) idx.remove(`d${i}`);
    expect(idx.size).toBe(50);
    expect(idx.analyze(texts[10]).overallPercent).toBe(0);
    const r = idx.analyze(texts[170]);
    expect(r.overallPercent).toBe(100);
    expect(r.sources[0].sourceId).toBe('d170');
  });
});

describe('performance', () => {
  it('2,000 docs x ~500 words vs a 3,000-word submission in < 3 s', () => {
    const rand = mulberry32(20261018);
    const vocab = buildVocabulary(5000, rand);
    const corpus: CorpusDocument[] = [];
    for (let i = 0; i < 2000; i++) {
      const words = randomWords(vocab, 450 + Math.floor(rand() * 100), rand);
      const sentences: string[] = [];
      for (let s = 0; s < words.length; s += 15) sentences.push(words.slice(s, s + 15).join(' ') + '.');
      corpus.push(doc(`doc-${i}`, sentences.join(' '), i % 3 === 0 ? 'STUDENT_PAPER' : 'REFERENCE'));
    }
    const parts: string[] = [];
    let planted = 0;
    for (let i = 0; i < 10; i++) {
      parts.push(randomWords(vocab, 270, rand).join(' '));
      const srcWords = tokenize(corpus[i * 150].text).map((t) => t.word);
      const copy = srcWords.slice(100, 130);
      parts.push(copy.join(' '));
      planted += copy.length;
    }
    const submission = parts.join(' ');
    expect(wc(submission)).toBe(3000);

    const t0 = performance.now();
    const r = analyzeSimilarity(submission, corpus);
    const elapsed = performance.now() - t0;

    const idx = new SimilarityIndex(corpus);
    idx.analyze('warm up the k gram index'); // >= ngramSize words, so the k-gram index is built here
    const t1 = performance.now();
    const r2 = idx.analyze(submission);
    const reuseElapsed = performance.now() - t1;

    console.log(
      `[similarity perf] one-shot (index build + analyze): ${elapsed.toFixed(0)} ms; ` +
        `reused-index analyze: ${reuseElapsed.toFixed(1)} ms; matched ${r.matchedWords}/${r.totalWords} words`,
    );
    expect(elapsed).toBeLessThan(3000);
    expect(reuseElapsed).toBeLessThan(500);
    expect(r.sources.length).toBe(10);
    expect(r.matchedWords).toBeGreaterThanOrEqual(planted);
    expect(r.matchedWords).toBeLessThan(planted + 40);
    expect(r2.matchedWords).toBe(r.matchedWords);
  });
});
