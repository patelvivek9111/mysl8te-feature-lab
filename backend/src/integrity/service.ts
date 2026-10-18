import crypto from 'node:crypto';
import type { DB } from '../db/database';
import { SimilarityIndex, type CorpusDocument, type SimilarityOptions, type SimilarityResult } from '../similarity';
import { assessAiWriting, type AiWritingAssessment } from '../ai-writing';

interface SubmissionContext { id: string; student_id: string; assignment_id: string; course_id: string; text: string | null; similarity_enabled: number; ai_assessment_enabled: number }

function context(db: DB, submissionId: string): SubmissionContext {
  return db.prepare(`
    SELECT s.id, s.student_id, s.assignment_id, a.course_id, d.text, a.similarity_enabled, a.ai_assessment_enabled
    FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN documents d ON d.id = s.document_id WHERE s.id = ?`).get(submissionId) as unknown as SubmissionContext;
}

/**
 * The comparison corpus is restricted to the submission's own course (reference sources plus students' papers)
 * so that report passages never disclose text from courses the viewer cannot access. The submitter's own papers
 * are in the course index but excluded per request.
 */
function corpusIds(db: DB, courseId: string): string[] {
  const refs = db.prepare('SELECT id FROM reference_sources WHERE course_id = ?').all(courseId) as { id: string }[];
  const papers = db.prepare(`
    SELECT s.id FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN documents d ON d.id = s.document_id
    WHERE a.course_id = ? AND d.text IS NOT NULL AND d.text <> ''`).all(courseId) as { id: string }[];
  return [...refs.map((r) => `ref:${r.id}`), ...papers.map((p) => `sub:${p.id}`)];
}

function loadCorpusDocument(db: DB, id: string): CorpusDocument | null {
  if (id.startsWith('ref:')) {
    const s = db.prepare('SELECT title, url, text FROM reference_sources WHERE id = ?').get(id.slice(4)) as { title: string; url: string | null; text: string } | undefined;
    return s ? { id, title: s.title, type: 'REFERENCE', text: s.text, url: s.url ?? undefined } : null;
  }
  const p = db.prepare(`SELECT a.title AS assignment_title, s.attempt, d.text FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id JOIN documents d ON d.id = s.document_id WHERE s.id = ?`).get(id.slice(4)) as
    { assignment_title: string; attempt: number; text: string } | undefined;
  return p ? { id, title: `Student paper (${p.assignment_title}, attempt ${p.attempt})`, type: 'STUDENT_PAPER', text: p.text } : null;
}

function ownPaperIds(db: DB, ctx: SubmissionContext): string[] {
  const rows = db.prepare(`SELECT s.id FROM submissions s JOIN assignments a ON a.id = s.assignment_id WHERE a.course_id = ? AND s.student_id = ?`)
    .all(ctx.course_id, ctx.student_id) as { id: string }[];
  return rows.map((r) => `sub:${r.id}`);
}

const MAX_CACHED_COURSES = 32;
const indexCache = new WeakMap<DB, Map<string, SimilarityIndex>>();

/** Corpus documents are immutable once stored, so a cached course index only needs new ids added and deleted ids removed. */
export function courseIndex(db: DB, courseId: string): SimilarityIndex {
  let perDb = indexCache.get(db);
  if (!perDb) indexCache.set(db, (perDb = new Map()));
  let index = perDb.get(courseId);
  if (index) perDb.delete(courseId);
  else index = new SimilarityIndex();
  perDb.set(courseId, index);
  if (perDb.size > MAX_CACHED_COURSES) perDb.delete(perDb.keys().next().value!);
  const current = new Set(corpusIds(db, courseId));
  for (const id of index.ids()) if (!current.has(id)) index.remove(id);
  for (const id of current) {
    if (index.has(id)) continue;
    const doc = loadCorpusDocument(db, id);
    if (doc) index.add(doc);
  }
  return index;
}

export interface StoredSimilarityReport { id: string; submissionId: string; options: SimilarityOptions; result: SimilarityResult; createdAt: string }

export function runSimilarity(db: DB, submissionId: string, options: SimilarityOptions = {}): StoredSimilarityReport {
  const ctx = context(db, submissionId);
  const index = courseIndex(db, ctx.course_id);
  const excludedSourceIds = [...(options.excludedSourceIds ?? []), ...ownPaperIds(db, ctx)];
  const result = index.analyze(ctx.text ?? '', { ...options, excludedSourceIds });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO similarity_reports (id, submission_id, options_json, result_json, overall_percent) VALUES (?, ?, ?, ?, ?)')
    .run(id, submissionId, JSON.stringify(options), JSON.stringify(result), result.overallPercent);
  return latestSimilarity(db, submissionId)!;
}

export function latestSimilarity(db: DB, submissionId: string): StoredSimilarityReport | null {
  const row = db.prepare('SELECT id, options_json, result_json, created_at FROM similarity_reports WHERE submission_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1')
    .get(submissionId) as { id: string; options_json: string; result_json: string; created_at: string } | undefined;
  if (!row) return null;
  return { id: row.id, submissionId, options: JSON.parse(row.options_json), result: JSON.parse(row.result_json), createdAt: row.created_at };
}

export function sourceText(db: DB, sourceId: string): string | null {
  if (sourceId.startsWith('ref:')) {
    const r = db.prepare('SELECT text FROM reference_sources WHERE id = ?').get(sourceId.slice(4)) as { text: string } | undefined;
    return r?.text ?? null;
  }
  if (sourceId.startsWith('sub:')) {
    const r = db.prepare('SELECT d.text FROM submissions s JOIN documents d ON d.id = s.document_id WHERE s.id = ?').get(sourceId.slice(4)) as { text: string } | undefined;
    return r?.text ?? null;
  }
  return null;
}

export interface StoredAiAssessment {
  id: string; submissionId: string; result: AiWritingAssessment; createdAt: string;
  review: { decision: string | null; note: string | null; reviewerId: string | null; reviewedAt: string | null };
}

export function runAiAssessment(db: DB, submissionId: string): StoredAiAssessment {
  const ctx = context(db, submissionId);
  const sim = latestSimilarity(db, submissionId);
  let similarityContext;
  if (sim) {
    const near = sim.result.passages.filter((p) => p.matchType === 'NEAR').reduce((n, p) => n + p.wordCount, 0);
    const exact = sim.result.passages.filter((p) => p.matchType === 'EXACT').reduce((n, p) => n + p.wordCount, 0);
    similarityContext = { nearMatchWords: near, exactMatchWords: exact, totalWords: sim.result.totalWords };
  }
  const result = assessAiWriting(ctx.text ?? '', { similarityContext });
  const id = crypto.randomUUID();
  db.prepare('INSERT INTO ai_assessments (id, submission_id, result_json) VALUES (?, ?, ?)').run(id, submissionId, JSON.stringify(result));
  return latestAiAssessment(db, submissionId)!;
}

export function latestAiAssessment(db: DB, submissionId: string): StoredAiAssessment | null {
  const row = db.prepare('SELECT * FROM ai_assessments WHERE submission_id = ? ORDER BY created_at DESC, rowid DESC LIMIT 1').get(submissionId) as
    | { id: string; result_json: string; created_at: string; review_decision: string | null; review_note: string | null; reviewer_id: string | null; reviewed_at: string | null } | undefined;
  if (!row) return null;
  return {
    id: row.id, submissionId, result: JSON.parse(row.result_json), createdAt: row.created_at,
    review: { decision: row.review_decision, note: row.review_note, reviewerId: row.reviewer_id, reviewedAt: row.reviewed_at },
  };
}

export function runAutomaticChecks(db: DB, submissionId: string): void {
  const ctx = context(db, submissionId);
  if (!ctx.text) return;
  try {
    if (ctx.similarity_enabled) runSimilarity(db, submissionId);
    if (ctx.ai_assessment_enabled) runAiAssessment(db, submissionId);
  } catch (err) {
    console.error(`Automatic integrity checks failed for submission ${submissionId}:`, err);
  }
}
