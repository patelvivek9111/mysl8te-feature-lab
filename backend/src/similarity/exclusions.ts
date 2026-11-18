import type { ExcludedRegion } from './types';

const QUOTE_PAIRS: Record<string, string> = { '"': '"', '“': '”', '„': '”', '«': '»' };

/** Regions between paired double quotation marks (straight, curly, low-9, guillemets), marks included. */
export function findQuoteRegions(text: string): ExcludedRegion[] {
  const regions: ExcludedRegion[] = [];
  let i = 0;
  while (i < text.length) {
    const close = QUOTE_PAIRS[text[i]];
    if (close === undefined) {
      i++;
      continue;
    }
    const j = text.indexOf(close, i + 1);
    if (j === -1) {
      i++;
      continue;
    }
    regions.push({ start: i, end: j + 1, reason: 'QUOTE' });
    i = j + 1;
  }
  return regions;
}

// Heading on its own line, optionally prefixed by markdown "#" or section numbering, optionally followed by ":".
const BIBLIO_HEADING_RE =
  /^[ \t]*(?:#{1,6}[ \t]*)?(?:\d+(?:\.\d+)*\.?[ \t]+)?(?:references|bibliography|works cited|sources|reference list)[ \t]*:?[ \t]*$/gim;

/** Region from the LAST bibliography-style heading to the end of the text, if any. */
export function findBibliographyRegion(text: string): ExcludedRegion | null {
  BIBLIO_HEADING_RE.lastIndex = 0;
  let last: RegExpExecArray | null = null;
  let m: RegExpExecArray | null;
  while ((m = BIBLIO_HEADING_RE.exec(text)) !== null) {
    last = m;
    if (m[0].length === 0) BIBLIO_HEADING_RE.lastIndex++;
  }
  if (!last) return null;
  return { start: last.index, end: text.length, reason: 'BIBLIOGRAPHY' };
}

/** Every region excluded from matching for these options, sorted by position. Depends only on the text. */
export function findExcludedRegions(text: string, options: { excludeQuotes?: boolean; excludeBibliography?: boolean } = {}): ExcludedRegion[] {
  const regions: ExcludedRegion[] = [];
  if (options.excludeQuotes ?? true) regions.push(...findQuoteRegions(text));
  if (options.excludeBibliography ?? true) {
    const bib = findBibliographyRegion(text);
    if (bib) regions.push(bib);
  }
  return regions.sort((a, b) => a.start - b.start || a.end - b.end);
}
