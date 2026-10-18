import crypto from 'node:crypto';
import type { DB } from '../db/database';
import { analyzeSimilarity, type CorpusDocument, type SimilarityOptions, type SimilarityResult } from '../similarity';
import { assessAiWriting, type AiWritingAssessment } from '../ai-writing';

interface SubmissionContext { id: string; student_id: string; assignment_id: string; course_id: string; text: string | null; similarity_enabled: number; ai_assessment_enabled: number }

function context(db: DB, submissionId: string): SubmissionContext {
  return db.prepare(`
    SELECT s.id, s.student_id, s.assignment_id, a.course_id, d.text, a.similarity_enabled, a.ai_assessment_enabled
    FROM submissions s JOIN assignments a ON a.id = s.assignment_id JOIN documents d ON d.id = s.document_id WHERE s.id = ?`).get(submissionId) as unknown as SubmissionContext;
}

/**
 * The comparison corpus is restricted to the submission's own course (reference sources plus other students'
 * papers) so that report passages never disclose text from courses the viewer cannot access.
 */
export function buildCorpus(db: DB, ctx: SubmissionContext): CorpusDocument[] {
  const sources = db.prepare('SELECT id, title, url, text FROM reference_sources WHERE course_id = ?').all(ctx.course_id) as
    { id: string; title: string; url: string | null; text: string }[];
  const papers = db.prepare(`
    SELECT s.id, a.title AS assignment_title, s.attempt, d.text FROM submissions s
    JOIN assignments a ON a.id = s.assignment_id JOIN documents d ON d.id = s.document_id
    WHERE a.course_id = ? AND s.student_id <> ? AND d.text IS NOT NULL AND d.text <> ''`).all(ctx.course_id, ctx.student_id) as
    { id: string; assignment_title: string; attempt: number; text: string }[];
  return [
    ...sources.map((s) => ({ id: `ref:${s.id}`, title: s.title, type: 'REFERENCE' as const, text: s.text, url: s.url ?? undefined })),
    ...papers.map((p) => ({ id: `sub:${p.id}`, title: `Student paper (${p.assignment_title}, attempt ${p.attempt})`, type: 'STUDENT_PAPER' as const, text: p.text })),
  ];
}

export interface StoredSimilarityReport { id: string; submissionId: string; options: SimilarityOptions; result: SimilarityResult; createdAt: string }

export function runSimilarity(db: DB, submissionId: string, options: SimilarityOptions = {}): StoredSimilarityReport {
  const ctx = context(db, submissionId);
  const corpus = buildCorpus(db, ctx);
  const result = analyzeSimilarity(ctx.text ?? '', corpus, options);
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
