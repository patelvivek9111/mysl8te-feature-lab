import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { DocumentFormat } from '@prisma/client';
import { uploadDir } from './extract';

const execFileAsync = promisify(execFile);

export const PAGE_RENDER_DPI = 110;
export const PAGE_RENDER_LIMIT = 200;
/** Longest side in pixels, so an oversized page box cannot allocate a huge bitmap. */
export const PAGE_RENDER_MAX_PIXELS = 2000;
const configuredRenders = Number(process.env.PAGE_RENDER_CONCURRENCY);
const MAX_CONCURRENT_RENDERS = Number.isInteger(configuredRenders) && configuredRenders >= 1 ? configuredRenders : 2;

let running = 0;
const waiting: Array<() => void> = [];

async function withRenderSlot<T>(work: () => Promise<T>): Promise<T> {
  if (running >= MAX_CONCURRENT_RENDERS) await new Promise<void>((resolve) => waiting.push(resolve));
  else running += 1;
  try {
    return await work();
  } finally {
    const nextInLine = waiting.shift();
    if (nextInLine) nextInLine();
    else running -= 1;
  }
}

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

/** Longest side of one page in PDF points, or null (render with -scale-to as a precaution) if pdfinfo cannot tell. */
async function longestSidePoints(filePath: string, page: number): Promise<number | null> {
  const { stdout } = await execFileAsync('pdfinfo', ['-f', String(page), '-l', String(page), filePath], { timeout: 10_000, encoding: 'utf8' })
    .catch(() => ({ stdout: '' }));
  const match = /^Page\s+\d+\s+size:\s+([\d.]+)\s+x\s+([\d.]+)/m.exec(stdout);
  return match ? Math.max(Number(match[1]), Number(match[2])) : null;
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
    job = withRenderSlot(async () => {
      await fs.mkdir(cacheDir, { recursive: true });
      const prefix = path.join(cacheDir, `${document.id}-${page}.tmp-${process.pid}-${Date.now()}`);
      try {
        const longest = await longestSidePoints(original, page);
        const size = longest === null || (longest / 72) * PAGE_RENDER_DPI > PAGE_RENDER_MAX_PIXELS
          ? ['-scale-to', String(PAGE_RENDER_MAX_PIXELS)]
          : ['-r', String(PAGE_RENDER_DPI)];
        await execFileAsync('pdftoppm', ['-png', ...size, '-f', String(page), '-l', String(page), '-singlefile', original, prefix], { timeout: 30_000 });
        await fs.rename(`${prefix}.png`, target);
      } catch (error) {
        await fs.rm(`${prefix}.png`, { force: true });
        throw error;
      }
      return target;
    }).finally(() => inflight.delete(target));
    inflight.set(target, job);
  }
  await job;
  return { filePath: target, contentType: 'image/png' };
}
