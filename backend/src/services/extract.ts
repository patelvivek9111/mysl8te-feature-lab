import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { DocumentFormat } from '@prisma/client';

const execFileAsync = promisify(execFile);
const MAX_TEXT = 1_500_000;

export interface ExtractionResult {
  text: string | null;
  pageCount: number | null;
  previewKind: 'text' | 'pdf' | 'image' | 'audio' | 'video' | 'archive' | 'none';
  note: string;
}

async function commandExists(command: string): Promise<boolean> {
  try {
    await execFileAsync('which', [command]);
    return true;
  } catch {
    return false;
  }
}

function clamp(text: string): string {
  return text.replace(/\u0000/g, '').slice(0, MAX_TEXT);
}

function xmlToText(xml: string): string {
  return clamp(
    xml
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<a:t[^>]*>/g, '')
      .replace(/<\/a:t>/g, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]{2,}/g, ' ')
      .trim(),
  );
}

async function zipEntries(filePath: string): Promise<string[]> {
  const { stdout } = await execFileAsync('unzip', ['-Z1', filePath], { maxBuffer: 8_000_000 });
  return stdout.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function unzipEntry(filePath: string, entry: string): Promise<string> {
  const { stdout } = await execFileAsync('unzip', ['-p', filePath, entry], {
    maxBuffer: 12_000_000,
    encoding: 'utf8',
  });
  return stdout;
}

async function zipXmlText(filePath: string, pattern: RegExp): Promise<string> {
  const entries = (await zipEntries(filePath)).filter((entry) => pattern.test(entry));
  const parts: string[] = [];
  for (const entry of entries.slice(0, 80)) {
    parts.push(xmlToText(await unzipEntry(filePath, entry)));
  }
  return clamp(parts.filter(Boolean).join('\n\n'));
}

function rtfToText(rtf: string): string {
  return clamp(
    rtf
      .replace(/\\par[d]?/g, '\n')
      .replace(/\\'[0-9a-fA-F]{2}/g, ' ')
      .replace(/\\[a-zA-Z]+-?\d* ?/g, '')
      .replace(/[{}]/g, '')
      .trim(),
  );
}

async function readUtf8(filePath: string): Promise<string> {
  const buffer = await fs.readFile(filePath);
  if (buffer.includes(0)) {
    throw new Error('File declared as text contains binary data');
  }
  return clamp(buffer.toString('utf8'));
}

export async function extractDocument(filePath: string, format: DocumentFormat): Promise<ExtractionResult> {
  switch (format) {
    case 'TXT':
    case 'MARKDOWN':
    case 'CSV':
    case 'SOURCE':
    case 'SVG':
      return { text: await readUtf8(filePath), pageCount: 1, previewKind: format === 'SVG' ? 'text' : 'text', note: 'Text extracted from the original file.' };
    case 'RTF':
      return { text: rtfToText(await readUtf8(filePath)), pageCount: 1, previewKind: 'text', note: 'RTF control words were stripped. This is not a layout-faithful preview.' };
    case 'PDF': {
      const { stdout } = await execFileAsync('pdftotext', ['-layout', filePath, '-'], { maxBuffer: 12_000_000, encoding: 'utf8' });
      const info = await execFileAsync('pdfinfo', [filePath], { encoding: 'utf8' }).catch(() => ({ stdout: '' }));
      const pages = Number(/Pages:\s+(\d+)/.exec(info.stdout)?.[1] ?? 1);
      return {
        text: clamp(stdout),
        pageCount: Number.isFinite(pages) ? pages : 1,
        previewKind: 'pdf',
        note: 'PDF text comes from pdftotext. Highlights anchor to that extracted text, not to exact PDF glyph positions.',
      };
    }
    case 'DOCX':
    case 'DOCM':
      return {
        text: await zipXmlText(filePath, /^word\/document\.xml$/),
        pageCount: 1,
        previewKind: 'text',
        note: 'DOCX preview is extracted paragraph text, not the original Word layout.',
      };
    case 'PPTX':
      return {
        text: await zipXmlText(filePath, /^ppt\/slides\/slide\d+\.xml$/),
        pageCount: null,
        previewKind: 'text',
        note: 'PPTX preview is slide text in file order, not a rendered slideshow.',
      };
    case 'XLSX':
      return {
        text: await zipXmlText(filePath, /^xl\/(sharedStrings\.xml|worksheets\/sheet\d+\.xml)$/),
        pageCount: 1,
        previewKind: 'text',
        note: 'XLSX preview is cell text, not a spreadsheet grid.',
      };
    case 'ODT':
    case 'ODS':
    case 'ODP':
    case 'EPUB':
      return {
        text: await zipXmlText(filePath, /(content\.xml|.*\.xhtml|.*\.html)$/i),
        pageCount: 1,
        previewKind: 'text',
        note: 'OpenDocument/EPUB preview is extracted text, not the original layout.',
      };
    case 'ZIP':
    case 'TAR':
    case 'SEVEN_Z':
      return extractArchive(filePath, format);
    case 'PNG':
    case 'JPG':
    case 'JPEG':
    case 'WEBP':
    case 'TIFF':
    case 'BMP':
      return extractImage(filePath);
    case 'HEIC':
      return { text: null, pageCount: 1, previewKind: 'none', note: 'HEIC is stored. This environment does not decode HEIC previews.' };
    case 'MP3':
    case 'WAV':
      return { text: null, pageCount: null, previewKind: 'audio', note: 'Audio can be played. Speech is not transcribed.' };
    case 'MP4':
    case 'MOV':
    case 'WEBM':
      return { text: null, pageCount: null, previewKind: 'video', note: 'Video can be played. Speech is not transcribed.' };
    case 'DOC':
    case 'XLS':
    case 'PPT':
      return { text: null, pageCount: null, previewKind: 'none', note: 'Legacy binary Office files are stored and downloadable. Text extraction is not available without a conversion engine.' };
    default:
      return { text: null, pageCount: null, previewKind: 'none', note: 'The file is stored, but this format has no verified preview.' };
  }
}

async function extractArchive(filePath: string, format: DocumentFormat): Promise<ExtractionResult> {
  if (format === 'ZIP') {
    const entries = await zipEntries(filePath);
    const textEntries = entries.filter((entry) => /\.(txt|md|csv|json|js|ts|py|java|c|html|css)$/i.test(entry)).slice(0, 20);
    const parts = [`Archive members (${entries.length}):`, ...entries.slice(0, 200)];
    for (const entry of textEntries) {
      parts.push(`\n----- ${entry} -----\n${await unzipEntry(filePath, entry)}`);
    }
    return { text: clamp(parts.join('\n')), pageCount: 1, previewKind: 'archive', note: 'ZIP listing plus text members. Nested binaries are not executed.' };
  }
  if (format === 'TAR') {
    const { stdout } = await execFileAsync('tar', ['-tf', filePath], { maxBuffer: 4_000_000 });
    return { text: clamp(stdout), pageCount: 1, previewKind: 'archive', note: 'TAR member listing only.' };
  }
  if (await commandExists('7z')) {
    const { stdout } = await execFileAsync('7z', ['l', '-ba', filePath], { maxBuffer: 4_000_000 });
    return { text: clamp(stdout), pageCount: 1, previewKind: 'archive', note: '7z listing only. Members are not extracted or executed.' };
  }
  return { text: null, pageCount: null, previewKind: 'none', note: '7z listing is unavailable because the 7z command is not installed.' };
}

async function extractImage(filePath: string): Promise<ExtractionResult> {
  if (!(await commandExists('tesseract'))) {
    return { text: null, pageCount: 1, previewKind: 'image', note: 'Image preview is available. OCR is not installed, so no text was extracted.' };
  }
  try {
    const { stdout } = await execFileAsync('tesseract', [filePath, 'stdout'], { maxBuffer: 4_000_000, encoding: 'utf8' });
    return { text: clamp(stdout), pageCount: 1, previewKind: 'image', note: 'OCR text is approximate and was not verified as a full transcription.' };
  } catch {
    return { text: null, pageCount: 1, previewKind: 'image', note: 'Image preview is available. OCR failed for this file.' };
  }
}

export function assertMagic(buffer: Buffer, format: DocumentFormat): void {
  const start = buffer.subarray(0, 16);
  const isZip = start[0] === 0x50 && start[1] === 0x4b;
  const zipFormats: DocumentFormat[] = ['DOCX', 'DOCM', 'XLSX', 'PPTX', 'ODT', 'ODS', 'ODP', 'EPUB', 'ZIP'];
  if (zipFormats.includes(format) && !isZip) {
    throw new Error('File content is not a ZIP-based document');
  }
  if (format === 'PDF' && !buffer.subarray(0, 5).toString().startsWith('%PDF')) {
    throw new Error('File content is not a PDF');
  }
  if ((format === 'PNG') && start.subarray(0, 4).toString('hex') !== '89504e47') {
    throw new Error('File content is not a PNG');
  }
  if ((format === 'JPG' || format === 'JPEG') && !(start[0] === 0xff && start[1] === 0xd8)) {
    throw new Error('File content is not a JPEG');
  }
  if (format === 'SEVEN_Z' && start.subarray(0, 4).toString('hex') !== '377abcaf') {
    throw new Error('File content is not a 7z archive');
  }
  const textFormats: DocumentFormat[] = ['TXT', 'MARKDOWN', 'CSV', 'SOURCE', 'RTF', 'SVG'];
  if (textFormats.includes(format) && buffer.includes(0)) {
    throw new Error('Text upload contains binary data');
  }
}

export const EXTENSION_TO_FORMAT: Record<string, DocumentFormat> = {
  '.pdf': 'PDF',
  '.docx': 'DOCX',
  '.doc': 'DOC',
  '.docm': 'DOCM',
  '.rtf': 'RTF',
  '.odt': 'ODT',
  '.txt': 'TXT',
  '.md': 'MARKDOWN',
  '.markdown': 'MARKDOWN',
  '.xlsx': 'XLSX',
  '.xls': 'XLS',
  '.ods': 'ODS',
  '.csv': 'CSV',
  '.pptx': 'PPTX',
  '.ppt': 'PPT',
  '.odp': 'ODP',
  '.png': 'PNG',
  '.jpg': 'JPG',
  '.jpeg': 'JPEG',
  '.webp': 'WEBP',
  '.tiff': 'TIFF',
  '.tif': 'TIFF',
  '.bmp': 'BMP',
  '.heic': 'HEIC',
  '.svg': 'SVG',
  '.zip': 'ZIP',
  '.tar': 'TAR',
  '.7z': 'SEVEN_Z',
  '.mp3': 'MP3',
  '.wav': 'WAV',
  '.mp4': 'MP4',
  '.mov': 'MOV',
  '.webm': 'WEBM',
  '.epub': 'EPUB',
  '.js': 'SOURCE',
  '.ts': 'SOURCE',
  '.tsx': 'SOURCE',
  '.py': 'SOURCE',
  '.java': 'SOURCE',
  '.c': 'SOURCE',
  '.cpp': 'SOURCE',
  '.h': 'SOURCE',
  '.go': 'SOURCE',
  '.rs': 'SOURCE',
  '.rb': 'SOURCE',
  '.php': 'SOURCE',
  '.html': 'SOURCE',
  '.css': 'SOURCE',
  '.json': 'SOURCE',
};

export function formatSupport() {
  const tested = new Set(['TXT', 'MARKDOWN', 'CSV', 'PDF', 'DOCX', 'PNG', 'ZIP', 'SOURCE']);
  return Object.entries(EXTENSION_TO_FORMAT).map(([extension, format]) => ({
    extension,
    format,
    tested: tested.has(format),
    textExtraction: !['DOC', 'XLS', 'PPT', 'HEIC', 'MP3', 'WAV', 'MP4', 'MOV', 'WEBM'].includes(format),
    nativeEditing: false,
  }));
}

export function uploadDir(): string {
  return path.resolve(process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads'));
}
