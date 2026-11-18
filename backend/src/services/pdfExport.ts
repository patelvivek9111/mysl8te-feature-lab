import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';

export const MAX_EXPORT_TEXT = 300_000;

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

const WIN_ANSI_SUBSTITUTES: Record<string, string> = {
  '\u2018': "'", '\u2019': "'", '\u201c': '"', '\u201d': '"', '\u2013': '-', '\u2014': '-', '\u2026': '...', '\t': ' ',
};

/** Standard 14 fonts only encode WinAnsi; anything else becomes '?' so drawing never throws. */
export function winAnsi(s: string): string {
  return s.replace(/[\u2018\u2019\u201c\u201d\u2013\u2014\u2026\t]/g, (c) => WIN_ANSI_SUBSTITUTES[c])
    .replace(/[\ud800-\udbff][\udc00-\udfff]/g, '?')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of winAnsi(text).split('\n')) {
    let line = '';
    for (const word of para.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      line = word;
      while (line.length > 1 && font.widthOfTextAtSize(line, size) > width) {
        const cut = fitChars(line, font, size, width);
        lines.push(line.slice(0, cut));
        line = line.slice(cut);
      }
    }
    lines.push(line);
  }
  return lines;
}

function fitChars(s: string, font: PDFFont, size: number, width: number): number {
  let lo = 1;
  let hi = Math.min(s.length - 1, 400);
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (font.widthOfTextAtSize(s.slice(0, mid), size) <= width) lo = mid;
    else hi = mid - 1;
  }
  return lo;
}

export interface PlacedWord { text: string; start: number; end: number; x: number; width: number; line: number }

/**
 * Lays out text word by word while keeping each word's character offsets, so text-anchored
 * annotations (UTF-16 offsets into the extracted text) can be drawn over exactly the words they cover.
 */
export function layoutWords(text: string, font: PDFFont, size: number, width: number): { words: PlacedWord[]; lineCount: number } {
  const words: PlacedWord[] = [];
  let line = 0;
  let x = 0;
  const space = font.widthOfTextAtSize(' ', size);
  const pattern = /\n|[^\s]+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match[0] === '\n') {
      line += 1;
      x = 0;
      continue;
    }
    let raw = match[0];
    let offset = match.index;
    while (raw.length) {
      let drawn = winAnsi(raw);
      let w = font.widthOfTextAtSize(drawn, size);
      if (x > 0 && x + space + w > width) {
        line += 1;
        x = 0;
      }
      let take = raw.length;
      if (w > width) {
        take = fitChars(raw, font, size, width);
        if (/[\ud800-\udbff]/.test(raw[take - 1] ?? '')) take = Math.max(1, take - 1);
        drawn = winAnsi(raw.slice(0, take));
        w = font.widthOfTextAtSize(drawn, size);
      }
      const startX = x === 0 ? 0 : x + space;
      words.push({ text: drawn, start: offset, end: offset + take, x: startX, width: w, line });
      x = startX + w;
      raw = raw.slice(take);
      offset += take;
      if (raw.length) {
        line += 1;
        x = 0;
      }
    }
  }
  return { words, lineCount: line + 1 };
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
      this.page.drawText(line, { x: MARGIN + (opts.indent ?? 0), y: this.y - size, size, font: f, color: opts.color ?? INK });
      this.y -= size * 1.35;
    }
  }
  gap(n = 6) {
    this.y -= n;
  }
}

function marker(page: PDFPage, x: number, y: number, label: string, color: RGB, font: PDFFont) {
  page.drawCircle({ x, y, size: 6.5, color, borderColor: rgb(0.15, 0.15, 0.15), borderWidth: 0.75 });
  page.drawText(label, { x: x - font.widthOfTextAtSize(label, 7) / 2, y: y - 2.5, size: 7, font, color: rgb(0, 0, 0) });
}

function drawAnnotatedText(w: Writer, text: string, marks: Array<{ index: number; type: string; start: number; end: number; color: RGB }>, font: PDFFont, bold: PDFFont) {
  const size = 10.5;
  const lead = size * 1.6;
  const { words } = layoutWords(text, font, size, PAGE_W - 2 * MARGIN - 14);
  const endsAt = new Map<number, typeof marks>();
  for (const mark of marks) {
    const last = words.filter((word) => word.start < mark.end && word.end > mark.start).pop();
    if (!last) continue;
    const key = words.indexOf(last);
    endsAt.set(key, [...(endsAt.get(key) ?? []), mark]);
  }
  let currentLine = -1;
  let baseline = 0;
  words.forEach((word, wordIndex) => {
    if (word.line !== currentLine) {
      const skipped = currentLine < 0 ? 0 : word.line - currentLine - 1;
      w.y -= skipped * lead;
      w.ensure(lead);
      baseline = w.y - size;
      w.y -= lead;
      currentLine = word.line;
    }
    const x = MARGIN + word.x;
    const next = words[wordIndex + 1];
    for (const mark of marks) {
      if (!(word.start < mark.end && word.end > mark.start)) continue;
      const continues = next && next.line === word.line && next.start < mark.end;
      const right = continues ? MARGIN + next.x : x + word.width;
      if (mark.type === 'UNDERLINE') {
        w.page.drawLine({ start: { x, y: baseline - 2 }, end: { x: right, y: baseline - 2 }, thickness: 1.2, color: mark.color });
      } else if (mark.type === 'STRIKEOUT') {
        w.page.drawLine({ start: { x, y: baseline + size * 0.32 }, end: { x: right, y: baseline + size * 0.32 }, thickness: 1.2, color: mark.color });
      } else {
        w.page.drawRectangle({ x, y: baseline - 3, width: right - x, height: size + 4, color: mark.color, opacity: 0.35 });
      }
    }
    w.page.drawText(word.text, { x, y: baseline, size, font, color: INK });
    const ending = endsAt.get(wordIndex);
    if (ending) {
      const label = ending.map((mark) => mark.index + 1).join(',');
      w.page.drawText(label, { x: x + word.width + 1, y: baseline + size * 0.55, size: 6.5, font: bold, color: rgb(0.55, 0.1, 0.1) });
    }
  });
}

function percentBox(page: PDFPage, a: ExportAnnotation) {
  const { width: W, height: H } = page.getSize();
  const w = ((a.width ?? 0) / 100) * W;
  const h = ((a.height ?? 0) / 100) * H;
  return { x: (a.x / 100) * W, y: H - (a.y / 100) * H - h, width: w, height: h };
}

function strokePaths(strokeData: string | null): Array<Array<{ x: number; y: number }>> {
  if (!strokeData) return [];
  try {
    const parsed = JSON.parse(strokeData) as unknown;
    if (!Array.isArray(parsed)) return [];
    const paths = (Array.isArray(parsed[0]) ? parsed : [parsed]) as unknown[];
    return paths
      .filter(Array.isArray)
      .map((path) => (path as unknown[]).filter((p): p is { x: number; y: number } => !!p && typeof (p as { x: unknown }).x === 'number' && typeof (p as { y: unknown }).y === 'number'))
      .filter((path) => path.length > 0);
  } catch {
    return [];
  }
}

/** Draws a page-positioned annotation; coordinates are percentages (0-100) with a top-left origin. */
function drawOnPage(page: PDFPage, a: ExportAnnotation, index: number, font: PDFFont) {
  const { width: W, height: H } = page.getSize();
  const color = hex(a.color, rgb(0.95, 0.76, 0.31));
  const box = percentBox(page, a);
  const hasBox = box.width > 0 && box.height > 0;
  if (a.type === 'HIGHLIGHT' && hasBox) page.drawRectangle({ ...box, color, opacity: 0.35 });
  if (a.type === 'AREA' && hasBox) page.drawRectangle({ ...box, borderColor: color, borderWidth: 2 });
  if ((a.type === 'STRIKEOUT' || a.type === 'UNDERLINE') && hasBox) {
    const y = a.type === 'STRIKEOUT' ? box.y + box.height / 2 : box.y;
    page.drawLine({ start: { x: box.x, y }, end: { x: box.x + box.width, y }, thickness: 1.5, color });
  }
  if (a.type === 'FREE_TEXT' && hasBox) {
    page.drawRectangle({ ...box, borderColor: color, borderWidth: 1, color: rgb(1, 1, 1), opacity: 0.85 });
    const size = Math.max(6, Math.min(12, box.height * 0.6));
    const maxLines = Math.max(1, Math.floor(box.height / (size * 1.2)));
    wrap(a.content ?? '', font, size, Math.max(10, box.width - 4)).slice(0, maxLines).forEach((line, i) => {
      page.drawText(line, { x: box.x + 2, y: box.y + box.height - (i + 1) * size * 1.2 + 2, size, font, color: INK });
    });
  }
  const paths = a.type === 'FREE_DRAW' ? strokePaths(a.strokeData) : [];
  for (const path of paths) {
    for (let i = 1; i < path.length; i++) {
      page.drawLine({
        start: { x: (path[i - 1].x / 100) * W, y: H - (path[i - 1].y / 100) * H },
        end: { x: (path[i].x / 100) * W, y: H - (path[i].y / 100) * H },
        thickness: 2,
        color,
      });
    }
  }
  const anchor = paths.length ? { x: (paths[0][0].x / 100) * W, y: H - (paths[0][0].y / 100) * H } : { x: (a.x / 100) * W, y: H - (a.y / 100) * H };
  marker(page, Math.min(Math.max(anchor.x, 7), W - 7), Math.min(Math.max(anchor.y, 7), H - 7), String(index + 1), color, font);
}

function excerpt(text: string, start: number, end: number): string {
  const slice = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return slice.length > 160 ? `${slice.slice(0, 157)}...` : slice;
}

/**
 * Builds the downloadable feedback PDF: a grade and rubric summary, the extracted text with
 * text-anchored marks drawn over their character ranges, the original pages of PDF submissions
 * with page-positioned marks, and a numbered list matching the on-page markers.
 */
export async function renderFeedbackPdf(input: ExportInput): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fullText = input.text ?? '';
  const text = fullText.length > MAX_EXPORT_TEXT ? fullText.slice(0, MAX_EXPORT_TEXT) : fullText;
  const notes: string[] = [];

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

  const textMarks: Array<{ index: number; type: string; start: number; end: number; color: RGB }> = [];
  const pageMarks: Array<{ index: number; annotation: ExportAnnotation }> = [];
  input.annotations.forEach((annotation, index) => {
    const range = textRange(annotation.anchor, text.length);
    if (range) {
      const fallback = annotation.type === 'UNDERLINE' ? rgb(0.16, 0.44, 0.59) : rgb(0.95, 0.76, 0.31);
      textMarks.push({ index, type: annotation.type, ...range, color: hex(annotation.color, fallback) });
    } else if (!annotation.anchor) {
      pageMarks.push({ index, annotation });
    }
  });

  w.gap(10);
  w.text(`Annotations (${input.annotations.length})`, { size: 13, bold: true });
  if (!input.annotations.length) w.text('No annotations.');
  input.annotations.forEach((annotation, index) => {
    const range = textRange(annotation.anchor, text.length);
    const where = range ? `on "${excerpt(text, range.start, range.end)}"` : `page ${annotation.page}`;
    w.text(`#${index + 1} ${TYPE_LABELS[annotation.type] ?? annotation.type} - ${annotation.authorName}${annotation.isDraft ? ' (draft)' : ''}`, { bold: true, indent: 10 });
    w.text(where, { indent: 20, size: 9, color: rgb(0.35, 0.35, 0.35) });
    if (annotation.content) w.text(annotation.content, { indent: 20 });
    for (const reply of annotation.replies) w.text(`${reply.authorName}${reply.isDraft ? ' (draft)' : ''}: ${reply.content}`, { indent: 30, size: 9 });
  });

  if (input.originalPdf) {
    try {
      const original = await PDFDocument.load(input.originalPdf, { updateMetadata: false });
      const copied = await doc.copyPages(original, original.getPageIndices());
      const first = doc.getPageCount();
      copied.forEach((page) => doc.addPage(page));
      for (const { index, annotation } of copied.length ? pageMarks : []) {
        const pageIndex = Math.min(Math.max(annotation.page, 1), copied.length) - 1;
        drawOnPage(doc.getPage(first + pageIndex), annotation, index, font);
      }
    } catch {
      notes.push('The original PDF pages could not be embedded (the file may be encrypted or damaged), so only the extracted text is shown.');
    }
  }

  if (!input.originalPdf || textMarks.length || notes.length) {
    const tw = new Writer(doc, font, bold);
    tw.text(input.originalPdf ? 'Extracted text with annotations' : `Document: ${input.fileName}`, { size: 14, bold: true });
    for (const note of notes) tw.text(note, { size: 9 });
    if (textMarks.length) tw.text('Numbers after marked passages match the annotation list.', { size: 9, color: rgb(0.35, 0.35, 0.35) });
    tw.gap(8);
    if (text) drawAnnotatedText(tw, text, textMarks, font, bold);
    else tw.text('(No extractable text)');
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
