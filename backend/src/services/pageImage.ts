import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { DocumentFormat } from '@prisma/client';
import { uploadDir } from './extract';

const execFileAsync = promisify(execFile);

export const PAGE_RENDER_DPI = 110;
export const PAGE_RENDER_LIMIT = 200;

const IMAGE_TYPES: Partial<Record<DocumentFormat, string>> = {
  PNG: 'image/png',
  JPG: 'image/jpeg',
  JPEG: 'image/jpeg',
  WEBP: 'image/webp',
  BMP: 'image/bmp',
};

type PageDocument = { id: string; format: DocumentFormat; storedFilename: string; pageCount: number | null };

/** Number of pages that can be drawn on, or 0 when the format has no page image. */
export function markablePages(document: PageDocument): number {
  if (IMAGE_TYPES[document.format]) return 1;
  if (document.format === 'PDF') return Math.min(Math.max(document.pageCount ?? 1, 1), PAGE_RENDER_LIMIT);
  return 0;
}

const inflight = new Map<string, Promise<string>>();

/** Returns a cached PNG (or the original image) for one page; rendering runs once per page. */
export async function pageImage(document: PageDocument, page: number): Promise<{ filePath: string; contentType: string } | null> {
  if (!Number.isInteger(page) || page < 1 || page > markablePages(document)) return null;
  const original = path.join(uploadDir(), document.storedFilename);
  const imageType = IMAGE_TYPES[document.format];
  if (imageType) return { filePath: original, contentType: imageType };
  const cacheDir = path.join(uploadDir(), 'pages');
  const target = path.join(cacheDir, `${document.id}-${page}.png`);
  try {
    await fs.access(target);
    return { filePath: target, contentType: 'image/png' };
  } catch {
    // not rendered yet
  }
  let job = inflight.get(target);
  if (!job) {
    job = (async () => {
      await fs.mkdir(cacheDir, { recursive: true });
      const prefix = path.join(cacheDir, `${document.id}-${page}.tmp-${process.pid}-${Date.now()}`);
      await execFileAsync('pdftoppm', ['-png', '-r', String(PAGE_RENDER_DPI), '-f', String(page), '-l', String(page), '-singlefile', original, prefix], { timeout: 30_000 });
      await fs.rename(`${prefix}.png`, target);
      return target;
    })().finally(() => inflight.delete(target));
    inflight.set(target, job);
  }
  await job;
  return { filePath: target, contentType: 'image/png' };
}
