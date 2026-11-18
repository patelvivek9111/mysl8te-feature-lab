import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

export const MAX_EXPORT_TEXT = 300_000;
export const MAX_EMBEDDED_PAGES = 200;
export const MAX_MARK_SEGMENTS = 20_000;

export interface ExportAnnotation {
  type: string;
  page: number;
  x: number;
  y: number;
  width: number | null;
  height: number | null;
  content: string | null;
  color: string | null;
  strokeData: string | null;
  anchor: unknown;
  isDraft: boolean;
  authorName: string;
  replies: Array<{ authorName: string; content: string; isDraft: boolean }>;
}

export interface ExportInput {
  assignmentTitle: string;
  courseCode: string;
  studentName: string;
  version: number;
  submittedAt: Date;
  fileName: string;
  format: string;
  text: string | null;
  originalPdf: Uint8Array | null;
  grade: { score: number; maxScore: number; letterGrade: string | null; feedback: string | null; isDraft: boolean; rubricScores: Record<string, number> | null } | null;
  rubric: Array<{ id: string; title: string; points: number; ratings: Array<{ title: string; points: number }> }>;
  annotations: ExportAnnotation[];
}

const TYPE_LABELS: Record<string, string> = {
  POINT: 'Point comment',
  AREA: 'Area comment',
  HIGHLIGHT: 'Highlight',
  UNDERLINE: 'Underline',
  STRIKEOUT: 'Strikethrough',
  FREE_DRAW: 'Drawing',
  FREE_TEXT: 'Text box',
};

const PAGE_W = 612;
const PAGE_H = 792;
const MARGIN = 54;
const INK = rgb(0.1, 0.1, 0.1);
const MUTED = rgb(0.35, 0.35, 0.35);
const HIGHLIGHT = rgb(0.95, 0.76, 0.31);
const UNDERLINE = rgb(0.16, 0.44, 0.59);

export function textRange(anchor: unknown, textLength: number): { start: number; end: number } | null {
  if (!anchor || typeof anchor !== 'object') return null;
  const a = anchor as { kind?: unknown; start?: unknown; end?: unknown };
  if (a.kind !== 'text' || typeof a.start !== 'number' || typeof a.end !== 'number') return null;
  const start = Math.max(0, Math.floor(a.start));
  const end = Math.min(textLength, Math.floor(a.end));
  return end > start ? { start, end } : null;
}

function hex(color: string | null, fallback: RGB): RGB {
  if (!color || !/^#[0-9a-f]{6}$/i.test(color)) return fallback;
  const n = parseInt(color.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Pre-blends a highlight with white so it can be drawn opaque behind text. */
function tint(color: RGB, amount = 0.35): RGB {
  return rgb(1 - (1 - color.red) * amount, 1 - (1 - color.green) * amount, 1 - (1 - color.blue) * amount);
}

const WIN_ANSI_SUBSTITUTES: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2026': '.', '\t': ' ', '\r': ' ',
};

/**
 * Standard 14 fonts only encode WinAnsi. Every UTF-16 unit maps to exactly one drawable character,
 * so character offsets into the original text stay valid for the drawn copy.
 */
export function winAnsi(s: string): string {
  return s.replace(/[^\x20-\x7e\xa0-\xff\n]/g, (c) => WIN_ANSI_SUBSTITUTES[c] ?? '?');
}

const widthCache = new WeakMap<PDFFont, Map<string, number>>();

/** Width of WinAnsi-safe text as the sum of cached glyph widths (kerning ignored), linear in length. */
function measure(font: PDFFont, s: string, size: number): number {
  let cache = widthCache.get(font);
  if (!cache) widthCache.set(font, (cache = new Map()));
  let total = 0;
  for (const ch of s) {
    let w = cache.get(ch);
    if (w === undefined) cache.set(ch, (w = font.widthOfTextAtSize(ch, 1000)));
    total += w;
  }
  return (total * size) / 1000;
}

export interface PlacedWord { text: string; start: number; end: number; x: number; width: number; line: number }

/**
 * Lays out text word by word while keeping each word's character offsets, so text-anchored
 * annotations (UTF-16 offsets into the extracted text) can be drawn over exactly the words they cover.
 * Words wider than a line are split across lines.
 */
export function layoutWords(text: string, font: PDFFont, size: number, width: number): { words: PlacedWord[]; lineCount: number } {
  const safe = winAnsi(text);
  const words: PlacedWord[] = [];
  const space = measure(font, ' ', size);
  let line = 0;
  let x = 0;
  let blankLines = 0;
  const pattern = /\n|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(safe))) {
    if (match[0] === '\n') {
      if (x === 0 && line > 0 && ++blankLines > 1) continue;
      line += 1;
      x = 0;
      continue;
    }
    blankLines = 0;
    const end = match.index + match[0].length;
    let pos = match.index;
    while (pos < end) {
      let take = 0;
      let w = 0;
      while (pos + take < end) {
        const next = w + measure(font, safe[pos + take], size);
        if (next > width && take > 0) break;
        w = next;
        take += 1;
      }
      const fitsWhole = pos + take === end;
      if (x > 0 && (!fitsWhole || x + space + w > width)) {
        line += 1;
        x = 0;
      }
      const startX = x === 0 ? 0 : x + space;
      words.push({ text: safe.slice(pos, pos + take), start: pos, end: pos + take, x: startX, width: w, line });
      x = startX + w;
      pos += take;
      if (pos < end) {
        line += 1;
        x = 0;
      }
    }
  }
  return { words, lineCount: line + 1 };
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const { words, lineCount } = layoutWords(text, font, size, width);
  const lines: string[] = Array.from({ length: lineCount }, () => '');
  for (const word of words) lines[word.line] = lines[word.line] ? `${lines[word.line]} ${word.text}` : word.text;
  return lines;
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) {
    this.newPage();
  }
  newPage() {
    this.page = this.doc.addPage([PAGE_W, PAGE_H]);
    this.y = PAGE_H - MARGIN;
  }
  ensure(height: number) {
    if (this.y - height < MARGIN) this.newPage();
  }
  text(s: string, opts: { size?: number; bold?: boolean; indent?: number; color?: RGB } = {}) {
    const size = opts.size ?? 10;
    const f = opts.bold ? this.bold : this.font;
    for (const line of wrap(s, f, size, PAGE_W - 2 * MARGIN - (opts.indent ?? 0))) {
      this.ensure(size * 1.35);
      if (line) this.page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y: this.y - size, size, font: f, color: opts.color ?? INK });
      this.y -= size * 1.35;
    }
  }
  gap(n = 6) {
    this.y -= n;
  }
}

type TextMark = { index: number; type: string; start: number; end: number; color: RGB };

/** Returns false when the segment budget ran out and some marks were not drawn. */
function drawAnnotatedText(w: Writer, text: string, marks: TextMark[], font: PDFFont, bold: PDFFont): boolean {
  const size = 10.5;
  const lead = size * 1.6;
  const { words, lineCount } = layoutWords(text, font, size, PAGE_W - 2 * MARGIN - 14);
  const lines: Array<{ page: PDFPage; baseline: number }> = [];
  for (let i = 0; i < lineCount; i++) {
    w.ensure(lead);
    lines.push({ page: w.page, baseline: w.y - size });
    w.y -= lead;
  }

  let budget = MAX_MARK_SEGMENTS;
  const labels = new Map<number, number[]>();
  for (const mark of marks) {
    let lo = 0;
    let hi = words.length;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (words[mid].end <= mark.start) lo = mid + 1;
      else hi = mid;
    }
    let i = lo;
    let last = -1;
    while (i < words.length && words[i].start < mark.end && budget > 0) {
      const line = words[i].line;
      const left = MARGIN + words[i].x;
      while (i + 1 < words.length && words[i + 1].line === line && words[i + 1].start < mark.end) i += 1;
      const right = MARGIN + words[i].x + words[i].width;
      const { page, baseline } = lines[line];
      if (mark.type === 'UNDERLINE' || mark.type === 'STRIKEOUT') {
        const y = mark.type === 'UNDERLINE' ? baseline - 2 : baseline + size * 0.32;
        page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 1.2, color: mark.color });
      } else {
        page.drawRectangle({ x: left, y: baseline - 3, width: right - left, height: size + 4, color: tint(mark.color) });
      }
      budget -= 1;
      last = i;
      i += 1;
    }
    if (last >= 0) labels.set(last, [...(labels.get(last) ?? []), mark.index + 1]);
  }

  let start = 0;
  while (start < words.length) {
    let end = start;
    while (end + 1 < words.length && words[end + 1].line === words[start].line) end += 1;
    const { page, baseline } = lines[words[start].line];
    page.drawText(words.slice(start, end + 1).map((word) => word.text).join(' '), { x: MARGIN + words[start].x, y: baseline, size, font, color: INK });
    start = end + 1;
  }
  for (const [wordIndex, numbers] of labels) {
    const word = words[wordIndex];
    const { page, baseline } = lines[word.line];
    page.drawText(numbers.join(','), { x: MARGIN + word.x + word.width + 1, y: baseline + size * 0.55, size: 6.5, font: bold, color: rgb(0.55, 0.1, 0.1) });
  }
  return budget > 0;
}

/**
 * Maps a point given in percent of the page as displayed (top-left origin) to PDF user space,
 * honouring the crop box offset and the page's /Rotate.
 */
function pagePoint(page: PDFPage, u: number, v: number): { x: number; y: number } {
  const box = page.getCropBox();
  const fu = Math.min(Math.max(u / 100, 0), 1);
  const fv = Math.min(Math.max(v / 100, 0), 1);
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  const [px, py] = angle === 90 ? [fv, fu] : angle === 180 ? [1 - fu, fv] : angle === 270 ? [1 - fv, 1 - fu] : [fu, 1 - fv];
  return { x: box.x + px * box.width, y: box.y + py * box.height };
}

function pageRect(page: PDFPage, a: ExportAnnotation) {
  const p = pagePoint(page, a.x, a.y);
  const q = pagePoint(page, a.x + (a.width ?? 0), a.y + (a.height ?? 0));
  return { x: Math.min(p.x, q.x), y: Math.min(p.y, q.y), width: Math.abs(q.x - p.x), height: Math.abs(q.y - p.y) };
}

function strokePaths(strokeData: string | null): Array<Array<{ x: number; y: number }>> {
  if (!strokeData) return [];
  try {
    const parsed = JSON.parse(strokeData) as unknown;
    if (!Array.isArray(parsed)) return [];
    const paths = (Array.isArray(parsed[0]) ? parsed : [parsed]) as unknown[];
    return paths
      .filter(Array.isArray)
      .map((path) => (path as unknown[]).filter((p): p is { x: number; y: number } => !!p && Number.isFinite((p as { x: unknown }).x) && Number.isFinite((p as { y: unknown }).y)))
      .filter((path) => path.length > 0);
  } catch {
    return [];
  }
}

const finite = (n: number | null) => (n !== null && Number.isFinite(n) ? n : 0);

/** Draws a page-positioned annotation; coordinates are percentages (0-100) of the displayed page. */
function drawOnPage(page: PDFPage, raw: ExportAnnotation, index: number, font: PDFFont) {
  const a = { ...raw, x: finite(raw.x), y: finite(raw.y), width: finite(raw.width), height: finite(raw.height) };
  const color = hex(a.color, HIGHLIGHT);
  const box = pageRect(page, a);
  const hasBox = box.width > 0 && box.height > 0;
  const upright = page.getRotation().angle % 360 === 0;
  if (a.type === 'HIGHLIGHT' && hasBox) page.drawRectangle({ ...box, color, opacity: 0.35 });
  if (a.type === 'AREA' && hasBox) page.drawRectangle({ ...box, borderColor: color, borderWidth: 2 });
  if ((a.type === 'STRIKEOUT' || a.type === 'UNDERLINE') && hasBox) {
    const from = pagePoint(page, a.x, a.type === 'STRIKEOUT' ? a.y + a.height / 2 : a.y + a.height);
    const to = pagePoint(page, a.x + a.width, a.type === 'STRIKEOUT' ? a.y + a.height / 2 : a.y + a.height);
    page.drawLine({ start: from, end: to, thickness: 1.5, color });
  }
  if (a.type === 'FREE_TEXT' && hasBox) {
    page.drawRectangle({ ...box, borderColor: color, borderWidth: 1, color: rgb(1, 1, 1), opacity: 0.85 });
    if (upright) {
      const size = Math.max(6, Math.min(12, box.height * 0.6));
      const maxLines = Math.max(1, Math.floor(box.height / (size * 1.2)));
      wrap((a.content ?? '').slice(0, 2000), font, size, Math.max(10, box.width - 4)).slice(0, maxLines).forEach((line, i) => {
        if (line) page.drawText(line, { x: box.x + 2, y: box.y + box.height - (i + 1) * size * 1.2 + 2, size, font, color: INK });
      });
    }
  }
  const paths = a.type === 'FREE_DRAW' ? strokePaths(a.strokeData) : [];
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      page.drawLine({ start: pagePoint(page, path[i - 1].x, path[i - 1].y), end: pagePoint(page, path[i].x, path[i].y), thickness: 2, color });
    }
  }
  const at = paths.length ? pagePoint(page, paths[0][0].x, paths[0][0].y) : pagePoint(page, a.x, a.y);
  const crop = page.getCropBox();
  const x = Math.min(Math.max(at.x, crop.x + 7), crop.x + crop.width - 7);
  const y = Math.min(Math.max(at.y, crop.y + 7), crop.y + crop.height - 7);
  const label = String(index + 1);
  page.drawCircle({ x, y, size: 6.5, color, borderColor: rgb(0.15, 0.15, 0.15), borderWidth: 0.75 });
  page.drawText(label, { x: x - measure(font, label, 7) / 2, y: y - 2.5, size: 7, font, color: rgb(0, 0, 0) });
}

function excerpt(text: string, start: number, end: number): string {
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return slice.length > 160 ? `${slice.slice(0, 157)}...` : slice;
}

/**
 * Builds the downloadable feedback PDF: a grade and rubric summary, a numbered annotation list,
 * the original pages of PDF submissions with page-positioned marks, and the extracted text with
 * text-anchored marks drawn over their character ranges.
 */
export async function renderFeedbackPdf(input: ExportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fullText = input.text ?? '';
  const text = fullText.length > MAX_EXPORT_TEXT ? fullText.slice(0, MAX_EXPORT_TEXT) : fullText;
  const notes: string[] = [];

  const unembeddable = 'The original PDF pages could not be embedded (the file may be encrypted or damaged), so only the extracted text is shown.';
  let original: PDFDocument | null = null;
  let originalPages = 0;
  if (input.originalPdf) {
    try {
      original = await PDFDocument.load(input.originalPdf, { updateMetadata: false });
      originalPages = original.getPageCount();
    } catch {
      original = null;
      notes.push(unembeddable);
    }
  }
  const embeddedPages = Math.min(originalPages, MAX_EMBEDDED_PAGES);

  const textMarks: TextMark[] = [];
  const pageMarks: Array<{ index: number; annotation: ExportAnnotation }> = [];
  const placement = input.annotations.map((annotation, index) => {
    const range = textRange(annotation.anchor, text.length);
    if (range) {
      textMarks.push({ index, type: annotation.type, ...range, color: hex(annotation.color, annotation.type === 'UNDERLINE' ? UNDERLINE : HIGHLIGHT) });
      return `on "${excerpt(text, range.start, range.end)}"`;
    }
    const kind = annotation.anchor && typeof annotation.anchor === 'object' ? (annotation.anchor as { kind?: unknown }).kind : undefined;
    if (kind === 'text') return 'on text beyond the exported document text';
    if (annotation.anchor) return `anchored to ${typeof kind === 'string' ? kind.slice(0, 40) : 'an unsupported location'}`;
    if (!original) return `page ${annotation.page}`;
    if (!Number.isInteger(annotation.page) || annotation.page < 1 || annotation.page > originalPages) return `page ${annotation.page} (not in the original PDF)`;
    if (annotation.page > embeddedPages) return `page ${annotation.page} (beyond the ${MAX_EMBEDDED_PAGES} pages included in this export)`;
    pageMarks.push({ index, annotation });
    return `page ${annotation.page}`;
  });

  const w = new Writer(doc, font, bold);
  w.text(`Feedback: ${input.assignmentTitle}`, { size: 16, bold: true });
  w.text(`${input.courseCode}   Student: ${input.studentName}   Version ${input.version}   Submitted ${input.submittedAt.toISOString().slice(0, 16).replace('T', ' ')} UTC`, { size: 9 });
  w.text(`File: ${input.fileName} (${input.format})`, { size: 9 });
  w.gap(10);
  w.text('Grade', { size: 13, bold: true });
  if (input.grade) {
    const letter = input.grade.letterGrade ? `, ${input.grade.letterGrade}` : '';
    w.text(`${input.grade.score} / ${input.grade.maxScore}${letter}${input.grade.isDraft ? ' (draft, not visible to the student)' : ''}`, { bold: true });
    if (input.grade.feedback) w.text(input.grade.feedback);
    if (input.rubric.length) {
      w.gap();
      for (const criterion of input.rubric) {
        const points = input.grade.rubricScores?.[criterion.id];
        const rating = points === undefined ? undefined : criterion.ratings.find((r) => r.points === points)?.title;
        w.text(`${criterion.title}: ${points ?? '-'} / ${criterion.points}${rating ? ` (${rating})` : ''}`, { indent: 10 });
      }
    }
  } else {
    w.text('No grade has been released.');
  }

  w.gap(10);
  w.text(`Annotations (${input.annotations.length})`, { size: 13, bold: true });
  if (!input.annotations.length) w.text('No annotations.');
  input.annotations.forEach((annotation, index) => {
    w.text(`#${index + 1} ${TYPE_LABELS[annotation.type] ?? annotation.type} - ${annotation.authorName}${annotation.isDraft ? ' (draft)' : ''}`, { bold: true, indent: 10 });
    w.text(placement[index], { indent: 20, size: 9, color: MUTED });
    if (annotation.content) w.text(annotation.content, { indent: 20 });
    for (const reply of annotation.replies) w.text(`${reply.authorName}${reply.isDraft ? ' (draft)' : ''}: ${reply.content}`, { indent: 30, size: 9 });
  });

  let copied: PDFPage[] = [];
  if (original && embeddedPages) {
    try {
      copied = await doc.copyPages(original, Array.from({ length: embeddedPages }, (_, i) => i));
    } catch {
      notes.push(unembeddable);
    }
  }
  if (copied.length) {
    if (embeddedPages < originalPages) notes.push(`Only the first ${MAX_EMBEDDED_PAGES} of ${originalPages} original pages are included.`);
    const first = doc.getPageCount();
    copied.forEach((page) => doc.addPage(page));
    for (const { index, annotation } of pageMarks) {
      try {
        drawOnPage(doc.getPage(first + annotation.page - 1), annotation, index, font);
      } catch {
        notes.push(`Annotation #${index + 1} could not be drawn on its page; it is described in the annotation list.`);
      }
    }
  }

  if (!original || textMarks.length || notes.length) {
    const tw = new Writer(doc, font, bold);
    tw.text(original ? 'Extracted text with annotations' : `Document: ${input.fileName}`, { size: 14, bold: true });
    for (const note of notes) tw.text(note, { size: 9 });
    if (textMarks.length) tw.text('Numbers after marked passages match the annotation list.', { size: 9, color: MUTED });
    tw.gap(8);
    if (text) {
      if (!drawAnnotatedText(tw, text, textMarks, font, bold)) {
        tw.gap(8);
        tw.text('Some marks were not drawn because there were too many; every annotation is described in the list.', { size: 9 });
      }
    } else {
      tw.text('(No extractable text)');
    }
    if (fullText.length > MAX_EXPORT_TEXT) {
      tw.gap(8);
      tw.text(`[Text truncated at ${MAX_EXPORT_TEXT.toLocaleString('en-US')} characters]`, { size: 9 });
    }
  }

  doc.setTitle(winAnsi(`Feedback - ${input.assignmentTitle}`));
  doc.setProducer('MySL8TE Feature Lab');
  doc.setCreator('MySL8TE Feature Lab');
  return doc.save();
}
