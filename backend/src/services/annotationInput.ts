export const COMMENT_MAX_LENGTH = 4000;
export const THREAD_MAX_COMMENTS = 200;
export const STROKE_MAX_PATHS = 50;
export const STROKE_MAX_POINTS = 5000;
export const STROKE_MAX_BYTES = 200_000;

export type StrokePoint = { x: number; y: number };

export function commentContent(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const content = value.trim();
  return content && content.length <= COMMENT_MAX_LENGTH ? content : null;
}

/** Validates freehand strokes: paths of {x, y} percentages of the page, rounded to 0.01. */
export function parseStrokeData(value: unknown): { paths: StrokePoint[][] } | { error: string } {
  let parsed: unknown = value;
  if (typeof value === 'string') {
    if (value.length > STROKE_MAX_BYTES) return { error: 'The drawing has too much stroke data' };
    try {
      parsed = JSON.parse(value);
    } catch {
      return { error: 'Stroke data must be JSON' };
    }
  }
  if (!Array.isArray(parsed) || parsed.length === 0) return { error: 'A drawing needs at least one stroke' };
  if (parsed.length > STROKE_MAX_PATHS) return { error: `A drawing can have at most ${STROKE_MAX_PATHS} strokes` };
  let total = 0;
  const paths: StrokePoint[][] = [];
  for (const path of parsed) {
    if (!Array.isArray(path) || path.length === 0) return { error: 'Each stroke must be a list of points' };
    total += path.length;
    if (total > STROKE_MAX_POINTS) return { error: `A drawing can have at most ${STROKE_MAX_POINTS} points` };
    const points: StrokePoint[] = [];
    for (const point of path) {
      const x = (point as { x?: unknown } | null)?.x;
      const y = (point as { y?: unknown } | null)?.y;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)
        || x < 0 || x > 100 || y < 0 || y > 100) {
        return { error: 'Stroke points must be page percentages from 0 to 100' };
      }
      points.push({ x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 });
    }
    paths.push(points);
  }
  return { paths };
}

export function strokeBounds(paths: StrokePoint[][]): { x: number; y: number; width: number; height: number } {
  const points = paths.flat();
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y };
}

/** Depth-first thread order, oldest first among siblings; replies whose parent is not in the list become top level. */
export function threadOrder<T extends { id: string; parentId: string | null; createdAt: Date }>(comments: T[]): Array<T & { depth: number }> {
  const ids = new Set(comments.map((comment) => comment.id));
  const children = new Map<string | null, T[]>();
  for (const comment of [...comments].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
    const key = comment.parentId && ids.has(comment.parentId) ? comment.parentId : null;
    children.set(key, [...(children.get(key) ?? []), comment]);
  }
  const ordered: Array<T & { depth: number }> = [];
  const seen = new Set<string>();
  const visit = (parent: string | null, depth: number) => {
    for (const comment of children.get(parent) ?? []) {
      if (seen.has(comment.id)) continue;
      seen.add(comment.id);
      ordered.push({ ...comment, depth });
      visit(comment.id, depth + 1);
    }
  };
  visit(null, 0);
  return ordered;
}

/** Ids of the comment and every reply below it, given the whole thread. */
export function threadDescendants(rootId: string, thread: Array<{ id: string; parentId: string | null }>): string[] {
  const children = new Map<string, string[]>();
  for (const comment of thread) {
    if (!comment.parentId) continue;
    children.set(comment.parentId, [...(children.get(comment.parentId) ?? []), comment.id]);
  }
  const ids: string[] = [];
  const queue = [rootId];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.shift()!;
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
    queue.push(...(children.get(id) ?? []));
  }
  return ids;
}
