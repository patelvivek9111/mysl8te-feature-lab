import path from 'node:path';
import mammoth from 'mammoth';

export type DocumentFormat = 'PDF' | 'DOCX' | 'TXT' | 'MARKDOWN' | 'HTML' | 'CSV' | 'RTF' | 'PNG' | 'JPEG' | 'WEBP' | 'GIF';

interface FormatSpec { format: DocumentFormat; mime: string; extensions: string[]; kind: 'pdf' | 'docx' | 'text' | 'image' }

export const FORMATS: FormatSpec[] = [
  { format: 'PDF', mime: 'application/pdf', extensions: ['.pdf'], kind: 'pdf' },
  { format: 'DOCX', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', extensions: ['.docx'], kind: 'docx' },
  { format: 'TXT', mime: 'text/plain', extensions: ['.txt'], kind: 'text' },
  { format: 'MARKDOWN', mime: 'text/markdown', extensions: ['.md', '.markdown'], kind: 'text' },
  { format: 'HTML', mime: 'text/html', extensions: ['.html', '.htm'], kind: 'text' },
  { format: 'CSV', mime: 'text/csv', extensions: ['.csv'], kind: 'text' },
  { format: 'RTF', mime: 'application/rtf', extensions: ['.rtf'], kind: 'text' },
  { format: 'PNG', mime: 'image/png', extensions: ['.png'], kind: 'image' },
  { format: 'JPEG', mime: 'image/jpeg', extensions: ['.jpg', '.jpeg'], kind: 'image' },
  { format: 'WEBP', mime: 'image/webp', extensions: ['.webp'], kind: 'image' },
  { format: 'GIF', mime: 'image/gif', extensions: ['.gif'], kind: 'image' },
];

export const SUPPORTED_EXTENSIONS = FORMATS.flatMap((f) => f.extensions);

export class UnsupportedFormatError extends Error {}

const startsWith = (buf: Buffer, bytes: number[], offset = 0) => bytes.every((b, i) => buf[offset + i] === b);

function sniff(buf: Buffer): DocumentFormat | 'ZIP' | 'BINARY' | 'TEXT' {
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return 'PDF';
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'PNG';
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return 'JPEG';
  if (startsWith(buf, [0x47, 0x49, 0x46, 0x38])) return 'GIF';
  if (startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8)) return 'WEBP';
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04])) return 'ZIP';
  if (startsWith(buf, [0x7b, 0x5c, 0x72, 0x74, 0x66])) return 'RTF';
  const sample = buf.subarray(0, Math.min(buf.length, 8192));
  if (sample.includes(0)) return 'BINARY';
  if (!isValidUtf8(sample)) return 'BINARY';
  return 'TEXT';
}

function isValidUtf8(buf: Buffer): boolean {
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(buf);
    return true;
  } catch (err) {
    // A truncated multi-byte sequence at the sample boundary is still valid text.
    return buf.length >= 8192 && (err as Error).name === 'TypeError' && tryTrimmed(buf);
  }
}

function tryTrimmed(buf: Buffer): boolean {
  for (let cut = 1; cut <= 3; cut++) {
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(buf.subarray(0, buf.length - cut));
      return true;
    } catch { /* try shorter */ }
  }
  return false;
}

/** Determines the format from content bytes, using the extension only to disambiguate container/text types. */
export function detectFormat(buf: Buffer, originalName: string): FormatSpec {
  const ext = path.extname(originalName).toLowerCase();
  const byExt = FORMATS.find((f) => f.extensions.includes(ext));
  const sniffed = sniff(buf);
  if (sniffed === 'ZIP') {
    if (byExt?.format === 'DOCX' && buf.includes(Buffer.from('word/'))) return byExt;
    throw new UnsupportedFormatError('Archive files are not supported (only .docx Office documents)');
  }
  if (sniffed === 'BINARY') throw new UnsupportedFormatError('Unrecognized binary file type');
  if (sniffed === 'TEXT') {
    if (byExt && byExt.kind === 'text' && byExt.format !== 'RTF') return byExt;
    if (!byExt) return FORMATS.find((f) => f.format === 'TXT')!;
    throw new UnsupportedFormatError(`File content does not match the ${ext} extension`);
  }
  const spec = FORMATS.find((f) => f.format === sniffed)!;
  if (byExt && byExt.format !== spec.format) {
    throw new UnsupportedFormatError(`File content (${spec.format}) does not match the ${ext} extension`);
  }
  return spec;
}

export interface ExtractionResult { text: string; html: string | null; pageCount: number | null; status: 'completed' | 'unsupported'; note?: string }

export async function extractContent(buf: Buffer, format: DocumentFormat): Promise<ExtractionResult> {
  switch (format) {
    case 'PDF':
      return extractPdf(buf);
    case 'DOCX': {
      assertSafeZip(buf);
      const { value } = await mammoth.convertToHtml({ buffer: buf });
      const html = sanitizeHtml(value);
      return { text: normalizeWhitespace(htmlToText(html)), html, pageCount: 1, status: 'completed' };
    }
    case 'HTML': {
      const raw = buf.toString('utf8');
      const clean = sanitizeHtml(raw);
      return { text: normalizeWhitespace(htmlToText(clean)), html: clean, pageCount: 1, status: 'completed' };
    }
    case 'RTF': {
      const text = normalizeWhitespace(rtfToText(buf.toString('latin1')));
      return { text, html: textToHtml(text), pageCount: 1, status: 'completed' };
    }
    case 'TXT':
    case 'MARKDOWN':
    case 'CSV': {
      const text = buf.toString('utf8').replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
      return { text, html: textToHtml(text), pageCount: 1, status: 'completed' };
    }
    default:
      return { text: '', html: null, pageCount: 1, status: 'unsupported', note: 'Image text recognition (OCR) is not yet available; the image can still be viewed and annotated.' };
  }
}

async function extractPdf(buf: Buffer): Promise<ExtractionResult> {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = pdfjs.getDocument({ data: new Uint8Array(buf), useSystemFonts: false });
  const doc = await task.promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    let line = '';
    const lines: string[] = [];
    for (const item of content.items as { str?: string; hasEOL?: boolean }[]) {
      if (typeof item.str !== 'string') continue;
      line += item.str;
      if (item.hasEOL) { lines.push(line); line = ''; }
    }
    if (line) lines.push(line);
    pages.push(lines.join('\n'));
  }
  const pageCount = doc.numPages;
  await task.destroy();
  const text = normalizeWhitespace(pages.join('\n\n'));
  return {
    text,
    html: null,
    pageCount,
    status: 'completed',
    note: text.trim() ? undefined : 'No text layer found; this PDF may be scanned. OCR is not yet available.',
  };
}

function normalizeWhitespace(s: string): string {
  return s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

export function textToHtml(text: string): string {
  return text.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`).join('\n');
}

const ALLOWED_TAGS = new Set(['p', 'br', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'blockquote', 'pre', 'code', 'table', 'thead', 'tbody', 'tr', 'td', 'th', 'hr', 'span', 'div']);
const DROP_WITH_CONTENT = new Set(['script', 'style', 'iframe', 'object', 'embed', 'noscript', 'template', 'svg', 'math', 'head', 'textarea', 'title', 'xmp', 'noembed', 'noframes']);
const VOID_TAGS = new Set(['br', 'hr']);
const TAG_NAME = /^<(\/?)([a-zA-Z][a-zA-Z0-9]*)/;

/**
 * Allow-list sanitizer: keeps only structural tags (re-emitted without attributes) and drops scripts, styles,
 * embedded objects and comments. Single forward pass so runtime stays linear for adversarial input.
 */
export function sanitizeHtml(html: string): string {
  let out = '';
  let i = 0;
  let gt = -2;
  const n = html.length;
  while (i < n) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { out += html.slice(i); break; }
    out += html.slice(i, lt);
    if (html.startsWith('<!--', lt)) {
      const end = html.indexOf('-->', lt + 4);
      if (end === -1) break;
      i = end + 3;
      continue;
    }
    if (gt !== -1 && gt <= lt) gt = html.indexOf('>', lt + 1);
    if (gt === -1) { out += '&lt;' + html.slice(lt + 1).replace(/</g, '&lt;'); break; }
    const m = TAG_NAME.exec(html.slice(lt, Math.min(gt + 1, lt + 64)));
    if (!m) {
      if (html[lt + 1] === '!' || html[lt + 1] === '?') { i = gt + 1; continue; }
      out += '&lt;';
      i = lt + 1;
      continue;
    }
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    i = gt + 1;
    if (DROP_WITH_CONTENT.has(name)) {
      if (closing) continue;
      const closeRe = new RegExp(`</${name}\\s*>`, 'gi');
      closeRe.lastIndex = i;
      const close = closeRe.exec(html);
      if (!close) break;
      i = close.index + close[0].length;
      continue;
    }
    if (!ALLOWED_TAGS.has(name)) continue;
    if (closing) { if (!VOID_TAGS.has(name)) out += `</${name}>`; }
    else out += `<${name}>`;
  }
  return out;
}

const MAX_DOCX_XML_BYTES = 6 * 1024 * 1024;
const MAX_DOCX_TOTAL_BYTES = 60 * 1024 * 1024;

/** Rejects zip bombs and oversized Word XML before mammoth inflates and parses everything in memory. */
export function assertSafeZip(buf: Buffer): void {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd === -1 || eocd + 22 > buf.length) throw new Error('Invalid DOCX archive');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  let total = 0;
  for (let k = 0; k < count; k++) {
    if (p + 46 > buf.length || buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Invalid DOCX archive');
    const uncompressed = buf.readUInt32LE(p + 24);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    total += uncompressed;
    if (name.endsWith('.xml') && uncompressed > MAX_DOCX_XML_BYTES) throw new Error(`document part ${name} is too large to process`);
    p += 46 + nameLen + extraLen + commentLen;
  }
  if (total > MAX_DOCX_TOTAL_BYTES) throw new Error('document expands to more than 60 MB');
}

function htmlToText(html: string): string {
  return html
    .replace(/<(br|\/p|\/div|\/h[1-6]|\/li|\/tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&');
}

function rtfToText(rtf: string): string {
  let out = '';
  let depth = 0;
  const skipDepth: number[] = [];
  for (let i = 0; i < rtf.length; i++) {
    const c = rtf[i];
    if (c === '{') { depth++; continue; }
    if (c === '}') { if (skipDepth.at(-1) === depth) skipDepth.pop(); depth--; continue; }
    if (c === '\\') {
      const m = /^\\([a-z]+)(-?\d+)? ?|^\\'([0-9a-f]{2})|^\\(.)/i.exec(rtf.slice(i));
      if (!m) continue;
      i += m[0].length - 1;
      if (m[3]) { if (!skipDepth.length) out += String.fromCharCode(parseInt(m[3], 16)); continue; }
      if (m[4]) { if (m[4] === '*') skipDepth.push(depth); else if (!skipDepth.length && '\\{}'.includes(m[4])) out += m[4]; continue; }
      const word = m[1];
      if (['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'header', 'footer'].includes(word)) skipDepth.push(depth);
      else if (!skipDepth.length && (word === 'par' || word === 'line')) out += '\n';
      else if (!skipDepth.length && word === 'tab') out += '\t';
      continue;
    }
    if (c === '\r' || c === '\n') continue;
    if (!skipDepth.length) out += c;
  }
  return out;
}
