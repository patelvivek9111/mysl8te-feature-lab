import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { degrees, PDFDocument, StandardFonts } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { layoutWords, MAX_EMBEDDED_PAGES, MAX_EXPORT_TEXT, renderFeedbackPdf, textRange, winAnsi, type ExportAnnotation, type ExportInput } from './pdfExport';


const TEXT = 'It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife.\n\nHowever little known the feelings or views of such a man may be on his first entering a neighbourhood.';

function annotation(overrides: Partial<ExportAnnotation>): ExportAnnotation {
  return {
    type: 'HIGHLIGHT', page: 1, x: 0, y: 0, width: null, height: null, content: null, color: null, strokeData: null,
    anchor: null, isDraft: false, authorName: 'Ada Lovelace', replies: [], ...overrides,
  };
}

function input(overrides: Partial<ExportInput> = {}): ExportInput {
  return {
    assignmentTitle: 'Close reading: Austen',
    courseCode: 'HIST210',
    studentName: 'Grace Hopper',
    version: 2,
    submittedAt: new Date('2026-11-18T12:00:00Z'),
    fileName: 'essay.txt',
    format: 'TXT',
    text: TEXT,
    originalPdf: null,
    grade: { score: 16, maxScore: 20, letterGrade: null, feedback: 'The quotation is specific.', isDraft: false, rubricScores: { c1: 10, c2: 6 } },
    rubric: [
      { id: 'c1', title: 'Textual evidence', points: 10, ratings: [{ title: 'Specific', points: 10 }] },
      { id: 'c2', title: 'Interpretation', points: 10, ratings: [{ title: 'Developing', points: 6 }] },
    ],
    annotations: [],
    ...overrides,
  };
}

function scratch(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'pdf-export-'));
}

function pdfText(bytes: Uint8Array): string {
  const dir = scratch();
  const file = path.join(dir, 'out.pdf');
  fs.writeFileSync(file, bytes);
  return execFileSync('pdftotext', ['-layout', file, '-'], { encoding: 'utf8' });
}

type Box = { word: string; page: number; xMin: number; yMin: number; xMax: number; yMax: number };

function wordBoxes(file: string): Box[] {
  const html = execFileSync('pdftotext', ['-bbox', file, '-'], { encoding: 'utf8' });
  const boxes: Box[] = [];
  let page = 0;
  for (const line of html.split('\n')) {
    if (line.includes('<page ')) page += 1;
    const m = line.match(/xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</);
    if (m) boxes.push({ page, xMin: +m[1], yMin: +m[2], xMax: +m[3], yMax: +m[4], word: m[5] });
  }
  return boxes;
}

/** Renders one page at 72 dpi (1 px per point) and returns a pixel reader. */
function renderPage(file: string, page: number): (x: number, y: number) => [number, number, number] {
  const prefix = path.join(path.dirname(file), `p${page}`);
  execFileSync('pdftoppm', ['-r', '72', '-f', String(page), '-l', String(page), '-singlefile', file, prefix]);
  const buf = fs.readFileSync(`${prefix}.ppm`);
  const header = buf.toString('latin1', 0, 64).match(/^P6\s+(\d+)\s+(\d+)\s+255\s/);
  if (!header) throw new Error('unexpected PPM header');
  const width = Number(header[1]);
  const offset = header[0].length;
  return (x, y) => {
    const i = offset + (Math.round(y) * width + Math.round(x)) * 3;
    return [buf[i], buf[i + 1], buf[i + 2]];
  };
}

function tinted(read: ReturnType<typeof renderPage>, box: Box): boolean {
  for (let x = box.xMin + 1; x < box.xMax - 1; x += 1) {
    for (let y = box.yMin; y < box.yMax; y += 1) {
      const [r, g, b] = read(x, y);
      if (r - b > 30 && g - b > 20) return true;
    }
  }
  return false;
}

describe('pdf export helpers', () => {
  it('accepts only well-formed text anchors and clamps them to the text', () => {
    expect(textRange({ kind: 'text', start: 3, end: 9 }, 100)).toEqual({ start: 3, end: 9 });
    expect(textRange({ kind: 'text', start: 90, end: 500 }, 100)).toEqual({ start: 90, end: 100 });
    expect(textRange({ kind: 'text', start: 9, end: 9 }, 100)).toBeNull();
    expect(textRange({ kind: 'cell', start: 1, end: 2 }, 100)).toBeNull();
    expect(textRange({ kind: 'text', start: '1', end: 2 }, 100)).toBeNull();
    expect(textRange(null, 100)).toBeNull();
  });

  it('maps characters the standard fonts cannot encode', () => {
    const input = '\u201cHi\u201d \u2014 caf\u00e9 \u4e2d \ud83d\ude00\u2026\f\u20ac\u2022\u2122\u3000\t';
    expect(winAnsi(input)).toBe('\u201cHi\u201d \u2014 caf\u00e9 ? ??\u2026 \u20ac\u2022\u2122  ');
    expect(winAnsi(input)).toHaveLength(input.length);
  });

  it('keeps original character offsets while wrapping, including non-WinAnsi text', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const text = 'alpha \u201cbeta\u201d \ud83d\ude00 gamma\n\ndelta ' + 'x'.repeat(400);
    const { words, lineCount } = layoutWords(text, font, 10, 200);
    for (const word of words) expect(text.slice(word.start, word.end).replace(/\s/g, '')).toBe(text.slice(word.start, word.end));
    expect(words.find((w) => w.text === '\u201cbeta\u201d')).toMatchObject({ start: 6, end: 12 });
    expect(words.find((w) => w.text === 'delta')!.line).toBe(2);
    const long = words.filter((w) => w.text.startsWith('x'));
    expect(long.length).toBeGreaterThan(1);
    expect(long.reduce((n, w) => n + (w.end - w.start), 0)).toBe(400);
    expect(lineCount).toBeGreaterThan(3);
    for (const w of words) expect(w.x + w.width).toBeLessThanOrEqual(200.01);
  });
});

describe('renderFeedbackPdf (requires poppler-utils)', () => {
  it('writes a parseable PDF with grade, rubric, annotations, replies, and the document text', async () => {
    const bytes = await renderFeedbackPdf(input({
      annotations: [
        annotation({ anchor: { kind: 'text', start: 8, end: 38 }, content: 'Strong opening claim.', replies: [{ authorName: 'Grace Hopper', content: 'Thank you!', isDraft: false }] }),
        annotation({ type: 'UNDERLINE', anchor: { kind: 'text', start: 47, end: 57 }, content: 'Who decides this?', isDraft: true }),
      ],
    }));
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getTitle()).toBe('Feedback - Close reading: Austen');
    const text = pdfText(bytes);
    expect(text).toContain('Feedback: Close reading: Austen');
    expect(text).toContain('Grace Hopper');
    expect(text).toContain('16 / 20');
    expect(text).toContain('Textual evidence: 10 / 10 (Specific)');
    expect(text).toContain('Interpretation: 6 / 10 (Developing)');
    expect(text).toContain('#1 Highlight - Ada Lovelace');
    expect(text).toContain('on "truth universally acknowledged"');
    expect(text).toContain('Strong opening claim.');
    expect(text).toContain('Grace Hopper: Thank you!');
    expect(text).toContain('#2 Underline - Ada Lovelace (draft)');
    expect(text).toContain('neighbourhood');
  });

  it('draws highlights over exactly the anchored words', async () => {
    const bytes = await renderFeedbackPdf(input({
      annotations: [annotation({ anchor: { kind: 'text', start: 8, end: 38 }, content: 'Strong opening claim.' })],
    }));
    const dir = scratch();
    const file = path.join(dir, 'out.pdf');
    fs.writeFileSync(file, bytes);
    const boxes = wordBoxes(file);
    const documentPage = Math.max(...boxes.map((b) => b.page));
    const read = renderPage(file, documentPage);
    const on = (word: string) => boxes.find((b) => b.page === documentPage && b.word === word)!;
    expect(tinted(read, on('truth'))).toBe(true);
    expect(tinted(read, on('universally'))).toBe(true);
    expect(tinted(read, on('acknowledged,'))).toBe(true);
    expect(tinted(read, on('single'))).toBe(false);
    expect(tinted(read, on('neighbourhood.'))).toBe(false);
  });

  it('embeds the original pages of a PDF submission and draws page-positioned marks on them', async () => {
    const original = await PDFDocument.create();
    const font = await original.embedFont(StandardFonts.Helvetica);
    for (const label of ['Original page one', 'Original page two']) {
      original.addPage([612, 792]).drawText(label, { x: 72, y: 700, size: 14, font });
    }
    const bytes = await renderFeedbackPdf(input({
      format: 'PDF',
      fileName: 'essay.pdf',
      originalPdf: await original.save(),
      annotations: [annotation({ type: 'AREA', page: 2, x: 10, y: 10, width: 40, height: 20, color: '#ff0000', content: 'Look here.' })],
    }));
    const doc = await PDFDocument.load(bytes);
    const text = pdfText(bytes);
    expect(text).toContain('Original page one');
    expect(text).toContain('Original page two');
    expect(text).toContain('#1 Area comment - Ada Lovelace');
    expect(text).toContain('page 2');
    expect(text).not.toContain('Extracted text with annotations');
    const dir = scratch();
    const file = path.join(dir, 'out.pdf');
    fs.writeFileSync(file, bytes);
    const read = renderPage(file, doc.getPageCount());
    const red = (x: number, y: number) => {
      const [r, g, b] = read(x, y);
      return r > 200 && g < 80 && b < 80;
    };
    const borderX = 612 * 0.1;
    expect([-1, 0, 1].some((dx) => red(borderX + dx, 792 * 0.2))).toBe(true);
    expect(red(612 * 0.3, 792 * 0.2)).toBe(false);
  });

  it('falls back to extracted text when the original PDF cannot be loaded', async () => {
    const bytes = await renderFeedbackPdf(input({ format: 'PDF', originalPdf: new TextEncoder().encode('%PDF-1.4 not really a pdf') }));
    const text = pdfText(bytes);
    expect(text).toContain('could not be embedded');
    expect(text).toContain('truth universally acknowledged');
  });

  it('handles empty text, missing grades, and very long text', async () => {
    const empty = pdfText(await renderFeedbackPdf(input({ text: null, grade: null })));
    expect(empty).toContain('No grade has been released.');
    expect(empty).toContain('(No extractable text)');
    const long = 'word '.repeat(MAX_EXPORT_TEXT / 5 + 1000);
    const bytes = await renderFeedbackPdf(input({ text: long, annotations: [annotation({ anchor: { kind: 'text', start: MAX_EXPORT_TEXT - 10, end: MAX_EXPORT_TEXT + 50 } })] }));
    expect(pdfText(bytes)).toContain('[Text truncated at 300,000 characters]');
  }, 60_000);

  it('exports long unspaced runs of non-Latin text without throwing', async () => {
    const cjk = '\u4e2d\u6587'.repeat(1500);
    const emoji = '\ud83d\ude00'.repeat(400);
    const text = `${cjk} x${emoji}y \u0416${'\u0416'.repeat(300)} end`;
    const bytes = await renderFeedbackPdf(input({
      text,
      annotations: [annotation({ anchor: { kind: 'text', start: 2990, end: 3010 }, content: 'Across the run boundary.' })],
    }));
    const out = pdfText(bytes);
    expect(out).toContain('end');
    expect(out).toContain('Across the run boundary.');
  });

  it('stays fast for a 300,000-character word and many overlapping marks', async () => {
    let started = Date.now();
    await renderFeedbackPdf(input({ text: 'x'.repeat(MAX_EXPORT_TEXT), annotations: [annotation({ type: 'FREE_TEXT', content: 'y'.repeat(100_000), anchor: { kind: 'text', start: 0, end: MAX_EXPORT_TEXT } })] }));
    expect(Date.now() - started).toBeLessThan(10_000);
    const words = Array.from({ length: 5000 }, (_, i) => `word${i}`).join(' ');
    started = Date.now();
    await renderFeedbackPdf(input({
      text: words,
      annotations: Array.from({ length: 200 }, (_, i) => annotation({ anchor: { kind: 'text', start: i, end: words.length }, type: i % 2 ? 'HIGHLIGHT' : 'UNDERLINE' })),
    }));
    expect(Date.now() - started).toBeLessThan(10_000);
  }, 60_000);

  it('collapses long runs of blank lines', async () => {
    const doc = await PDFDocument.load(await renderFeedbackPdf(input({ text: `a${'\n'.repeat(100_000)}b` })));
    expect(doc.getPageCount()).toBeLessThan(4);
  });

  it('places page marks on rotated pages as displayed', async () => {
    const original = await PDFDocument.create();
    original.addPage([612, 792]).setRotation(degrees(90));
    const bytes = await renderFeedbackPdf(input({
      format: 'PDF',
      originalPdf: await original.save(),
      annotations: [annotation({ type: 'AREA', page: 1, x: 10, y: 10, width: 40, height: 20, color: '#ff0000' })],
    }));
    const dir = scratch();
    const file = path.join(dir, 'out.pdf');
    fs.writeFileSync(file, bytes);
    const doc = await PDFDocument.load(bytes);
    const read = renderPage(file, doc.getPageCount());
    const red = (x: number, y: number) => {
      const [r, g, b] = read(x, y);
      return r > 200 && g < 80 && b < 80;
    };
    expect([-1, 0, 1].some((dx) => red(792 * 0.1 + dx, 612 * 0.2))).toBe(true);
    expect([-1, 0, 1].some((dx) => red(612 * 0.1 + dx, 792 * 0.2))).toBe(false);
  });

  it('labels marks on missing pages and caps embedded pages', async () => {
    const original = await PDFDocument.create();
    for (let i = 0; i < MAX_EMBEDDED_PAGES + 5; i++) original.addPage([200, 200]);
    const bytes = await renderFeedbackPdf(input({
      format: 'PDF',
      originalPdf: await original.save(),
      annotations: [
        annotation({ type: 'POINT', page: MAX_EMBEDDED_PAGES + 50, content: 'Missing page.' }),
        annotation({ type: 'POINT', page: MAX_EMBEDDED_PAGES + 2, content: 'Past the cap.' }),
        annotation({ type: 'POINT', page: 3, x: Number.NaN, y: Number.POSITIVE_INFINITY, content: 'Bad coordinates.' }),
        annotation({ anchor: { kind: 'text', start: TEXT.length + 10, end: TEXT.length + 20 }, content: 'Too far.' }),
      ],
    }));
    const out = pdfText(bytes);
    expect(out).toContain(`page ${MAX_EMBEDDED_PAGES + 50} (not in the original PDF)`);
    expect(out).toContain(`(beyond the ${MAX_EMBEDDED_PAGES} pages included in this export)`);
    expect(out).toContain(`Only the first ${MAX_EMBEDDED_PAGES} of ${MAX_EMBEDDED_PAGES + 5} original pages are included.`);
    expect(out).toContain('on text beyond the exported document text');
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPages().filter((page) => page.getWidth() === 200)).toHaveLength(MAX_EMBEDDED_PAGES);
  });
});
