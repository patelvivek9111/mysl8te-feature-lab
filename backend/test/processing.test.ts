import { describe, expect, it } from 'vitest';
import { detectFormat, extractContent, sanitizeHtml, UnsupportedFormatError } from '../src/documents/processing';
import { makeDocx, makePdf } from './fixtures';

describe('detectFormat', () => {
  it('identifies PDF, DOCX, text and images by content', () => {
    expect(detectFormat(makePdf([['hi']]), 'essay.pdf').format).toBe('PDF');
    expect(detectFormat(makeDocx(['hi']), 'essay.docx').format).toBe('DOCX');
    expect(detectFormat(Buffer.from('# Title\n\nbody'), 'notes.md').format).toBe('MARKDOWN');
    expect(detectFormat(Buffer.from('plain'), 'noext').format).toBe('TXT');
    expect(detectFormat(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]), 'img.png').format).toBe('PNG');
    expect(detectFormat(Buffer.from('{\\rtf1 hello}'), 'a.rtf').format).toBe('RTF');
  });

  it('rejects disguised and unknown binaries', () => {
    expect(() => detectFormat(Buffer.from('MZ\x90\x00\x03\x00\x00\x00'), 'essay.pdf')).toThrow(UnsupportedFormatError);
    expect(() => detectFormat(makePdf([['x']]), 'essay.docx')).toThrow(/does not match/);
    expect(() => detectFormat(Buffer.from('plain text'), 'essay.pdf')).toThrow(/does not match/);
    expect(() => detectFormat(Buffer.from([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]), 'archive.zip')).toThrow(/Archive/);
  });

  it('accepts UTF-8 text with non-ASCII characters', () => {
    expect(detectFormat(Buffer.from('Café — “quoted” ✓'), 'a.txt').format).toBe('TXT');
  });
});

describe('extractContent', () => {
  it('extracts per-page text from a real PDF', async () => {
    const pdf = makePdf([['First page line one', 'First page line two'], ['Second page text']]);
    const r = await extractContent(pdf, 'PDF');
    expect(r.pageCount).toBe(2);
    expect(r.text).toContain('First page line one');
    expect(r.text).toContain('Second page text');
  });

  it('extracts text and safe HTML from DOCX', async () => {
    const r = await extractContent(makeDocx(['# My Heading', 'Body paragraph with <script> text & more.']), 'DOCX');
    expect(r.text).toContain('My Heading');
    expect(r.text).toContain('Body paragraph with <script> text & more.');
    expect(r.html).toContain('<h1>My Heading</h1>');
    expect(r.html).not.toMatch(/<script/i);
  });

  it('extracts RTF text', async () => {
    const r = await extractContent(Buffer.from('{\\rtf1\\ansi{\\fonttbl\\f0 Arial;}\\f0 Hello\\par World caf\\\'e9}'), 'RTF');
    expect(r.text).toBe('Hello\nWorld café');
  });

  it('marks images as viewable but without OCR text', async () => {
    const r = await extractContent(Buffer.alloc(10), 'PNG');
    expect(r.status).toBe('unsupported');
    expect(r.note).toMatch(/OCR/);
  });
});

describe('sanitizeHtml', () => {
  it('runs in linear time on adversarial input', () => {
    for (const payload of ['<script '.repeat(30000), '<!--'.repeat(50000), '<x '.repeat(100000), '<script>'.repeat(30000), '<a'.repeat(100000) + '>']) {
      const started = Date.now();
      const out = sanitizeHtml(payload);
      expect(Date.now() - started).toBeLessThan(500);
      expect(out).not.toMatch(/<script/i);
    }
  });

  it('escapes an unfinished trailing tag and keeps plain comparisons', () => {
    expect(sanitizeHtml('<p>hi</p><img src=x onerror=alert(1)//')).toBe('<p>hi</p>&lt;img src=x onerror=alert(1)//');
    expect(sanitizeHtml('<p>a < b and c > d</p>')).toBe('<p>a &lt; b and c > d</p>');
    expect(sanitizeHtml('<scr<script>ipt>alert(1)</script>')).not.toMatch(/<script/i);
    expect(sanitizeHtml('<P CLASS="x">Up</P><BR/>')).toBe('<p>Up</p><br>');
  });

  it('strips scripts, event handlers, styles, links and unknown tags', () => {
    const dirty = '<p onclick="x()">Hi<script>alert(1)</script><img src=x onerror=alert(1)><a href="javascript:alert(1)">link</a><style>p{}</style><iframe src="//evil"></iframe></p>';
    const clean = sanitizeHtml(dirty);
    expect(clean).toBe('<p>Hilink</p>');
  });
});
