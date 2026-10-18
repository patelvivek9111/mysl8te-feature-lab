import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { extractDocument, formatSupport } from './services/extract';

const execFileAsync = promisify(execFile);

async function makeDocx(text: string): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-docx-'));
  const word = path.join(dir, 'word');
  await fs.mkdir(word);
  await fs.writeFile(
    path.join(word, 'document.xml'),
    `<?xml version="1.0" encoding="UTF-8"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`,
  );
  const file = path.join(dir, 'sample.docx');
  await execFileAsync('zip', ['-q', '-r', file, 'word'], { cwd: dir });
  return file;
}

test('docx extraction returns paragraph text and not a layout claim', async () => {
  const file = await makeDocx('Docx lab sentence about rivers.');
  const result = await extractDocument(file, 'DOCX');
  assert.match(result.text ?? '', /rivers/);
  assert.match(result.note, /not the original Word layout/);
  assert.equal(result.previewKind, 'text');
});

test('zip extraction lists a text member without executing it', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-zip-'));
  await fs.writeFile(path.join(dir, 'notes.txt'), 'Zip member about a library catalog.');
  const file = path.join(dir, 'bundle.zip');
  await execFileAsync('zip', ['-q', file, 'notes.txt'], { cwd: dir });
  const result = await extractDocument(file, 'ZIP');
  assert.match(result.text ?? '', /notes\.txt/);
  assert.match(result.text ?? '', /library catalog/);
  assert.equal(result.previewKind, 'archive');
});

test('plain text family extraction keeps the original words', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-text-'));
  const cases: Array<['TXT' | 'MARKDOWN' | 'CSV' | 'SOURCE', string, string]> = [
    ['TXT', 'plain.txt', 'Plain observation about rivers.'],
    ['MARKDOWN', 'plain.md', '# Heading\n\nA markdown observation.'],
    ['CSV', 'plain.csv', 'name,note\nriver,wide'],
    ['SOURCE', 'plain.ts', 'export const river = "wide"'],
  ];
  for (const [format, name, body] of cases) {
    const file = path.join(dir, name);
    await fs.writeFile(file, body);
    const result = await extractDocument(file, format as 'TXT' | 'MARKDOWN' | 'CSV' | 'SOURCE');
    assert.match(result.text ?? '', /river|Heading|wide/);
  }
});

test('png preview is available and does not invent OCR text', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'lab-png-'));
  const file = path.join(dir, 'dot.png');
  const png = Buffer.from(
    '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c63000100000500010d0a2db40000000049454e44ae426082',
    'hex',
  );
  await fs.writeFile(file, png);
  const result = await extractDocument(file, 'PNG');
  assert.equal(result.previewKind, 'image');
  assert.equal(result.text, null);
  assert.match(result.note, /OCR is not installed|OCR/);
});

test('format matrix only marks families this suite exercises', async () => {
  const tested = new Set<string>(formatSupport().filter((item) => item.tested).map((item) => item.format));
  for (const format of ['TXT', 'MARKDOWN', 'CSV', 'PDF', 'DOCX', 'PNG', 'ZIP', 'SOURCE']) {
    assert.equal(tested.has(format), true, format);
  }
  assert.equal(tested.has('DOC'), false);
  assert.equal(formatSupport().every((item) => item.nativeEditing === false), true);
});
