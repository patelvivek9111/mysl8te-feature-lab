import { describe, expect, it } from 'vitest';
import { COMMENT_MAX_LENGTH, STROKE_MAX_PATHS, STROKE_MAX_POINTS, commentContent, parseStrokeData, strokeBounds, threadDescendants, threadOrder } from './annotationInput';

describe('comment content', () => {
  it('trims and enforces length', () => {
    expect(commentContent('  Good point.  ')).toBe('Good point.');
    expect(commentContent('   ')).toBeNull();
    expect(commentContent(42)).toBeNull();
    expect(commentContent('x'.repeat(COMMENT_MAX_LENGTH))).toHaveLength(COMMENT_MAX_LENGTH);
    expect(commentContent('x'.repeat(COMMENT_MAX_LENGTH + 1))).toBeNull();
  });
});

describe('stroke data', () => {
  it('accepts JSON strings and arrays of paths, rounding points', () => {
    const fromString = parseStrokeData(JSON.stringify([[{ x: 10.123, y: 20 }, { x: 30, y: 40.456 }]]));
    expect(fromString).toEqual({ paths: [[{ x: 10.12, y: 20 }, { x: 30, y: 40.46 }]] });
    expect(parseStrokeData([[{ x: 0, y: 0 }], [{ x: 100, y: 100 }]])).toEqual({ paths: [[{ x: 0, y: 0 }], [{ x: 100, y: 100 }]] });
  });

  it('rejects malformed, out-of-range, and oversized drawings', () => {
    for (const bad of ['not json', '[]', [], [[]], [{ x: 1, y: 1 }], [[{ x: -1, y: 5 }]], [[{ x: 5, y: 101 }]], [[{ x: '5', y: 5 }]], [[{ x: Number.NaN, y: 5 }]], [[null]]]) {
      expect(parseStrokeData(bad)).toHaveProperty('error');
    }
    expect(parseStrokeData(Array.from({ length: STROKE_MAX_PATHS + 1 }, () => [{ x: 1, y: 1 }]))).toHaveProperty('error');
    expect(parseStrokeData([Array.from({ length: STROKE_MAX_POINTS + 1 }, () => ({ x: 1, y: 1 }))])).toHaveProperty('error');
    expect(parseStrokeData(' '.repeat(200_001))).toHaveProperty('error');
  });

  it('computes the bounding box of all paths', () => {
    expect(strokeBounds([[{ x: 10, y: 50 }, { x: 30, y: 20 }], [{ x: 5, y: 60 }]])).toEqual({ x: 5, y: 20, width: 25, height: 40 });
  });
});

describe('thread order', () => {
  it('puts each reply after its parent with its depth, and orphans at the top level', () => {
    const at = (minute: number) => new Date(Date.UTC(2026, 0, 1, 0, minute));
    const ordered = threadOrder([
      { id: 'late-root', parentId: null, createdAt: at(5) },
      { id: 'reply-2', parentId: 'root', createdAt: at(3) },
      { id: 'root', parentId: null, createdAt: at(1) },
      { id: 'nested', parentId: 'reply-1', createdAt: at(4) },
      { id: 'reply-1', parentId: 'root', createdAt: at(2) },
      { id: 'orphan', parentId: 'hidden-draft', createdAt: at(6) },
    ]);
    expect(ordered.map((comment) => [comment.id, comment.depth])).toEqual([
      ['root', 0], ['reply-1', 1], ['nested', 2], ['reply-2', 1], ['late-root', 0], ['orphan', 0],
    ]);
  });
});

describe('thread descendants', () => {
  it('collects every nested reply once, including through cycles', () => {
    const thread = [
      { id: 'a', parentId: null },
      { id: 'b', parentId: 'a' },
      { id: 'c', parentId: 'b' },
      { id: 'd', parentId: 'a' },
      { id: 'e', parentId: null },
    ];
    expect(threadDescendants('a', thread).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(threadDescendants('b', thread).sort()).toEqual(['b', 'c']);
    expect(threadDescendants('x', [{ id: 'x', parentId: 'y' }, { id: 'y', parentId: 'x' }]).sort()).toEqual(['x', 'y']);
  });
});
