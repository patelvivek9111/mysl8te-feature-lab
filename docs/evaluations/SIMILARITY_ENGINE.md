# Similarity Engine (independent, Turnitin-style workflow)

Code: `backend/src/similarity/` (pure TypeScript, no dependencies, no DB or I/O).
Tests: `backend/src/similarity/similarity.test.ts` (`cd backend && npx vitest run src/similarity`).

This engine was built independently. It follows the general *workflow* of commercial
similarity checkers (match overview, primary-source attribution, quote/bibliography
exclusions), but it is **not** Turnitin, it is **not** equivalent to Turnitin, and its
percentages are **not comparable** to Turnitin similarity scores.

## Public API

- `analyzeSimilarity(text, corpus, options?)` is a one-shot call that builds a temporary index.
- `SimilarityIndex` (`add(doc)`, `remove(id)`, `size`, `has(id)`, `analyze(text, options?)`) is a reusable index.
- `tokenize(text)` returns words with original char offsets and a normalized form.

The caller must not put the submission itself in the corpus. Corpus documents with the
same `id` are deduplicated, and the later one replaces the earlier one.

## Algorithm (`mysl8te-kgram-seed-extend` v1.0.0)

1. **Tokenize.** Words are matched with `[\p{L}\p{N}\p{M}]+` and may be joined by apostrophes. Hyphens and dashes split words. Each token keeps its original `start` and `end` char offsets. `norm` is NFKC, then lowercase, with quotes, apostrophes and dashes removed and any remaining punctuation stripped.
2. **Fingerprint.** Each normalized word gets a 32-bit FNV-1a hash. Each word k-gram (default k=5) gets a mixed hash.
3. **Inverted index.** This is a **full k-gram index, not winnowing**. Every k-gram position of every corpus document is a posting. Postings are linked lists stored in growable `Int32Array`s, with one `Map<hash, head>` entry per distinct k-gram. Why not winnowing:
   - A full index finds every shared run of at least k words. Winnowing only guarantees runs of at least w+k-1 words.
   - The full index makes NEAR-match seeding robust next to substituted words.
   - Memory stays acceptable at the target scale (see Performance).
   - The index is built lazily per `ngramSize` and kept up to date by `add`. `remove` marks the document dead, and the index is compacted once dead documents outnumber live ones (and there are more than 64 of them).
4. **Seed and extend.** Each k-gram of the submission is looked up in the index. Every hit is checked word by word, so hash collisions are harmless. The engine then extends right and then left, word by word, to a maximal passage. A mismatched word is bridged as a *substitution* only if:
   - the next 3 words match again, and
   - the passage keeps at most 1 substitution per 8 words.

   Seeds that fall inside a passage already found on the same source diagonal are skipped.
5. **Merge per source.** Passages from the same source are merged when they overlap or are separated by at most 2 words on both the submission side and the source side. This absorbs small insertions and deletions. A merge never bridges an excluded word.
6. **Filter.** Passages shorter than `minMatchWords` are dropped. Sources in `excludedSourceIds` are never matched.
7. **Primary-source attribution.** Passages are processed longest first (ties go to the lower source id). Each submission word can be claimed by only one passage. Unclaimed leftover pieces of a passage are kept only if they still reach `minMatchWords`. The final passages therefore never overlap.
8. **Score.**
   - `overallPercent = matchedWords / totalWords * 100`, rounded to 1 decimal. `totalWords` counts *all* submission words, because excluded regions simply cannot match.
   - A source's `percent` is computed the same way from the words attributed to it. The sources' `matchedWords` add up exactly to the overall `matchedWords`.

### Match types

- **EXACT** means every aligned word has the identical surface form (case-sensitive, inner apostrophe included) and there are no substitutions or gaps. Punctuation *between* words is not compared, so `plants, light` and `plants; light` still count as EXACT.
- **NEAR** covers everything else: case changes, a different apostrophe style, bridged word substitutions, and merged gaps.

### Exclusions

- **Quotes** (`excludeQuotes`, default on): text between paired `"…"`, `“…”`, `„…”` or `«…»`. Words inside a quotation act as hard barriers, so a passage cannot cross them. Copied text outside the quotes can still match. Single quotes are ignored because they are ambiguous with apostrophes.
- **Bibliography** (`excludeBibliography`, default on): everything from the *last* line that consists only of a heading to the end of the text. The headings are `References`, `Bibliography`, `Works Cited`, `Sources` and `Reference List`. Matching is case-insensitive, and an optional `#` markdown prefix, section number or trailing `:` is allowed.
- `excludedRegions` in the result lists every applied region with its reason.

## Parameters

| Option / constant | Default | Meaning |
| --- | --- | --- |
| `ngramSize` | 5 | Seed length in words |
| `minMatchWords` | 8 | Minimum passage length after merging and attribution |
| `excludeQuotes` / `excludeBibliography` | true / true | See Exclusions |
| `excludedSourceIds` | [] | Manual source exclusion |
| Substitution budget | 1 per 8 words | `MISMATCH_RATIO_DENOMINATOR` |
| Lookahead after substitution | 3 words | `MISMATCH_LOOKAHEAD` |
| Merge gap | 2 words | `MERGE_GAP_WORDS` |

All of these values are echoed back in `result.algorithm.params`.

## Complexity

Let C be the total number of corpus words, n the number of submission words, and k the k-gram size.

- **Index build:** O(C·k) time and O(C) postings, at 12 bytes per posting plus one Map entry per distinct k-gram.
- **Analysis:** O(n·k) hashing, plus O(h) seed checks where h is the number of posting hits, plus O(total passage length) for extension, plus a sort over the passages.
- Diagonal skipping keeps extension from repeating work inside passages that were already found. Random or unrelated text produces almost no hits, so analysis cost is driven mainly by n and the amount of real overlap.

## Measured performance (observed, not projected)

Environment: Node v22.14.0, 4 vCPU "Intel(R) Xeon(R) Processor" cloud VM.

Data: 2,000 synthetic documents (998,657 words in total, about 450–550 words each) drawn from a 5,000-word synthetic vocabulary with a seeded PRNG. The submission has 3,000 words, including ten planted 30-word copied passages. This is the same data as the Vitest performance test.

| Measurement (5 runs) | Observed |
| --- | --- |
| One-shot `analyzeSimilarity` (tokenize + index 2,000 docs + analyze) | 400–557 ms |
| `SimilarityIndex` build (add 2,000 docs + build k-gram index) | 364–413 ms |
| `analyze` on a reused, warm index | 1.6–2.1 ms |
| Approximate heap retained by the warm index (`heapUsed` delta after GC) | ~135 MB |
| Result | 300/3000 words matched (10.0%), 10 sources, exactly the planted passages |

The Vitest performance case asserts that the one-shot call finishes in under 3 s and that reused analysis finishes in under 500 ms.

## Known limitations

- **No internet or publication corpus.** Matching only covers the institution-provided corpus (prior student papers and reference sources that callers pass in). The `INTERNET` source type is just a label for documents the caller supplies. There is no crawling.
- **No semantic or paraphrase detection.** Matching is lexical only. Reworded text, synonym swaps beyond the 1-in-8 substitution budget, reordered sentences and translations are not detected.
- Insertions and deletions longer than 2 words split a passage into pieces. Each piece must reach `minMatchWords` on its own.
- Common boilerplate phrases of 8 or more words will match. There is no stop-phrase or template exclusion, and no per-source "small match" threshold.
- Quote detection uses simple pairing, so an unbalanced `"` can exclude the wrong span. Block quotes made only by indentation are not detected.
- Bibliography detection needs the heading to be on its own line. Inline or unlabeled reference lists are not excluded.
- Synthetic-text benchmarks do not reflect the k-gram frequency skew of real prose. Real corpora produce more seed hits from common phrases.
- **Not equivalent to Turnitin.** The scores are not comparable to Turnitin, iThenticate or any other commercial product, and must not be presented as such.
