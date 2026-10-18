import fs from 'node:fs';
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage, type RGB } from 'pdf-lib';
import type { submissionDetail } from '../routes/submissions';

type Detail = ReturnType<typeof submissionDetail>;
type Annotation = Detail['annotations'][number];

const MAX_EXPORT_TEXT = 300_000;

const TYPE_LABELS: Record<string, string> = {
  point: 'Point comment', highlight: 'Highlight', strikeout: 'Strikeout', area: 'Area comment', freedraw: 'Drawing', freetext: 'Text box',
};

function hex(color: string): RGB {
  const n = parseInt(color.slice(1), 16);
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}

/** Standard 14 fonts only support WinAnsi; replace anything else so drawing never throws. */
function winAnsi(s: string): string {
  return s
    .replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, '-').replace(/\u2026/g, '...')
    .replace(/[^\x20-\x7e\xa0-\xff\n]/g, '?');
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const para of winAnsi(text).split('\n')) {
    let line = '';
    for (const word of para.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) line = candidate;
      else {
        if (line) lines.push(line);
        line = word;
        while (line.length > 1 && font.widthOfTextAtSize(line, size) > width) {
          let lo = 1;
          let hi = Math.min(line.length - 1, 400);
          while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (font.widthOfTextAtSize(line.slice(0, mid), size) <= width) lo = mid;
            else hi = mid - 1;
          }
          lines.push(line.slice(0, lo));
          line = line.slice(lo);
        }
      }
    }
    lines.push(line);
  }
  return lines;
}

/** Draws one annotation; coordinates are page-relative fractions with a top-left origin. */
function drawAnnotation(page: PDFPage, a: Annotation, index: number, font: PDFFont) {
  const { width: W, height: H } = page.getSize();
  const color = hex(a.color);
  const c = a.coords as Record<string, unknown>;
  const box = (r: { x: number; y: number; w: number; h: number }) => ({ x: r.x * W, y: H - (r.y + r.h) * H, width: r.w * W, height: r.h * H });
  switch (a.type) {
    case 'highlight':
      for (const r of c.rects as { x: number; y: number; w: number; h: number }[]) page.drawRectangle({ ...box(r), color, opacity: 0.35 });
      break;
    case 'strikeout':
      for (const r of c.rects as { x: number; y: number; w: number; h: number }[]) {
        const b = box(r);
        page.drawLine({ start: { x: b.x, y: b.y + b.height / 2 }, end: { x: b.x + b.width, y: b.y + b.height / 2 }, thickness: 1.5, color });
      }
      break;
    case 'area':
      page.drawRectangle({ ...box(c as never), borderColor: color, borderWidth: 2 });
      break;
    case 'freetext': {
      const b = box(c as never);
      page.drawRectangle({ ...b, borderColor: color, borderWidth: 1, color: rgb(1, 1, 1), opacity: 0.85 });
      const size = Math.max(6, Math.min(12, b.height * 0.6));
      wrap(a.content, font, size, Math.max(10, b.width - 4)).slice(0, Math.max(1, Math.floor(b.height / (size * 1.2)))).forEach((line, i) => {
        page.drawText(line, { x: b.x + 2, y: b.y + b.height - (i + 1) * size * 1.2 + 2, size, font, color: rgb(0.1, 0.1, 0.1) });
      });
      break;
    }
    case 'freedraw':
      for (const path of c.paths as { x: number; y: number }[][]) {
        for (let i = 1; i < path.length; i++) {
          page.drawLine({ start: { x: path[i - 1].x * W, y: H - path[i - 1].y * H }, end: { x: path[i].x * W, y: H - path[i].y * H }, thickness: 2, color });
        }
      }
      break;
    case 'point':
      break;
  }
  const anchor = a.type === 'point' ? { x: (c.x as number) * W, y: H - (c.y as number) * H }
    : a.type === 'freedraw' ? { x: (c.paths as { x: number; y: number }[][])[0][0].x * W, y: H - (c.paths as { x: number; y: number }[][])[0][0].y * H }
      : (() => { const r = (a.type === 'highlight' || a.type === 'strikeout') ? (c.rects as { x: number; y: number }[])[0] : (c as { x: number; y: number }); return { x: r.x * W, y: H - r.y * H }; })();
  page.drawCircle({ x: anchor.x, y: anchor.y, size: 7, color, borderColor: rgb(0.15, 0.15, 0.15), borderWidth: 0.75 });
  const label = String(index + 1);
  page.drawText(label, { x: anchor.x - font.widthOfTextAtSize(label, 7) / 2, y: anchor.y - 2.5, size: 7, font, color: rgb(0, 0, 0) });
}

class Writer {
  page!: PDFPage;
  y = 0;
  constructor(private doc: PDFDocument, private font: PDFFont, private bold: PDFFont) { this.newPage(); }
  newPage() { this.page = this.doc.addPage([612, 792]); this.y = 792 - 54; }
  text(s: string, opts: { size?: number; bold?: boolean; indent?: number } = {}) {
    const size = opts.size ?? 10;
    const f = opts.bold ? this.bold : this.font;
    for (const line of wrap(s, f, size, 612 - 108 - (opts.indent ?? 0))) {
      if (this.y < 54) this.newPage();
      this.page.drawText(line, { x: 54 + (opts.indent ?? 0), y: this.y, size, font: f, color: rgb(0.1, 0.1, 0.1) });
      this.y -= size * 1.35;
    }
  }
  gap(n = 6) { this.y -= n; }
}

/**
 * PDF submissions get annotations drawn onto their original pages; other formats are rendered as extracted text.
 * Both end with a feedback summary that numbers each annotation to match the on-page markers.
 */
export async function renderAnnotatedPdf(d: Detail, storagePath: string): Promise<Uint8Array> {
  let doc: PDFDocument;
  const isPdf = d.document.format === 'PDF';
  if (isPdf) {
    doc = await PDFDocument.load(fs.readFileSync(storagePath), { ignoreEncryption: true, updateMetadata: false });
  } else {
    doc = await PDFDocument.create();
  }
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  if (isPdf) {
    const pages = doc.getPages();
    d.annotations.forEach((a, i) => {
      const page = pages[a.page - 1];
      if (page) drawAnnotation(page, a, i, font);
    });
  } else {
    const w = new Writer(doc, font, bold);
    w.text(d.document.fileName, { size: 14, bold: true });
    w.gap();
    const text = d.document.text || '(No extractable text)';
    w.text(text.length > MAX_EXPORT_TEXT ? `${text.slice(0, MAX_EXPORT_TEXT)}\n\n[Text truncated at ${MAX_EXPORT_TEXT.toLocaleString('en-US')} characters]` : text);
  }

  const w = new Writer(doc, font, bold);
  w.text(`Feedback: ${d.assignment.title}`, { size: 16, bold: true });
  w.text(`Student: ${(d.student as { name: string }).name}   Attempt ${d.submission.attempt}   Submitted ${d.submission.submittedAt}`);
  w.gap(10);
  w.text('Grade', { size: 13, bold: true });
  if (d.grade) {
    w.text(`${d.grade.score ?? '-'} / ${d.assignment.pointsPossible} (${d.grade.status})`, { bold: true });
    if (d.grade.feedback) w.text(d.grade.feedback);
    if (d.rubric) {
      w.gap();
      for (const c of d.rubric.criteria) {
        const s = (d.grade.rubricScores as Record<string, { points: number; ratingId?: string; comment?: string }>)[c.id];
        const rating = s?.ratingId ? c.ratings.find((r) => r.id === s.ratingId)?.label : undefined;
        w.text(`${c.description}: ${s ? s.points : '-'} / ${c.points}${rating ? ` (${rating})` : ''}`, { indent: 10 });
        if (s?.comment) w.text(s.comment, { indent: 20, size: 9 });
      }
    }
  } else {
    w.text('No grade has been released.');
  }
  w.gap(10);
  w.text(`Annotations (${d.annotations.length})`, { size: 13, bold: true });
  if (!isPdf && d.annotations.length) w.text('Annotation markers are drawn only on PDF submissions; this list describes each one.', { size: 9 });
  d.annotations.forEach((a, i) => {
    w.text(`#${i + 1} ${TYPE_LABELS[a.type] ?? a.type} - page ${a.page} - ${a.authorName}${a.published ? '' : ' (draft)'}`, { bold: true, indent: 10 });
    if (a.content) w.text(a.content, { indent: 20 });
    for (const r of a.replies as { authorName: string; body: string }[]) w.text(`${r.authorName}: ${r.body}`, { indent: 30, size: 9 });
  });
  w.gap(10);
  w.text(`Comments (${d.comments.length})`, { size: 13, bold: true });
  for (const c of d.comments) w.text(`${c.authorName}${c.published ? '' : ' (draft)'}: ${c.body}`, { indent: 10 });

  doc.setTitle(winAnsi(`Feedback - ${d.assignment.title}`));
  doc.setProducer('MySL8TE Feature Lab');
  return doc.save();
}
