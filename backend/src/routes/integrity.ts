import { Router } from 'express';
import { requireUser } from '../auth/auth';
import { loadSubmission, requireGrader, type SubmissionAccess } from '../auth/permissions';
import { ah, badRequest, bool, forbidden, notFound, num, param, str } from '../http';
import { audit } from '../audit';
import type { DB } from '../db/database';
import type { SimilarityOptions } from '../similarity';
import { latestAiAssessment, latestSimilarity, runAiAssessment, runSimilarity, sourceText, type StoredSimilarityReport } from '../integrity/service';

const router = Router();

function readOptions(body: Record<string, unknown> | undefined): SimilarityOptions {
  const b = body ?? {};
  const opts: SimilarityOptions = {};
  if (b.excludeQuotes !== undefined) opts.excludeQuotes = bool(b.excludeQuotes, true);
  if (b.excludeBibliography !== undefined) opts.excludeBibliography = bool(b.excludeBibliography, true);
  if (b.minMatchWords !== undefined) opts.minMatchWords = num(b.minMatchWords, 'minMatchWords', { min: 1, max: 200 })!;
  if (b.excludedSourceIds !== undefined) {
    if (!Array.isArray(b.excludedSourceIds) || b.excludedSourceIds.length > 1000) throw badRequest('excludedSourceIds must be an array');
    opts.excludedSourceIds = b.excludedSourceIds.map((s, i) => str(s, `excludedSourceIds[${i}]`, { max: 100 }));
  }
  return opts;
}

/** Adds source excerpts; students only ever see excerpts from instructor-provided reference sources. */
function presentReport(db: DB, report: StoredSimilarityReport, access: SubmissionAccess) {
  const isTeacher = access.role === 'teacher';
  const texts = new Map<string, string | null>();
  const excerpt = (sourceId: string, start: number, end: number) => {
    const type = report.result.sources.find((s) => s.sourceId === sourceId)?.type;
    if (!isTeacher && type !== 'REFERENCE') return null;
    if (!texts.has(sourceId)) texts.set(sourceId, sourceText(db, sourceId));
    return texts.get(sourceId)?.slice(start, end) ?? null;
  };
  return {
    id: report.id,
    createdAt: report.createdAt,
    options: report.options,
    ...report.result,
    passages: report.result.passages.map((p) => ({ ...p, sourceExcerpt: excerpt(p.sourceId, p.sourceStart, p.sourceEnd) })),
    sources: report.result.sources.map((s) => ({
      ...s,
      passages: s.passages.map((p) => ({ ...p, sourceExcerpt: excerpt(p.sourceId, p.sourceStart, p.sourceEnd) })),
    })),
    disclaimer: 'Similarity is computed by this lab\'s independent engine against the course corpus only (instructor reference sources and other students\' papers in this course). It is not a Turnitin score and does not by itself indicate plagiarism.',
  };
}

router.get('/submissions/:submissionId/similarity', ah((req, res) => {
  const user = requireUser(req);
  const access = loadSubmission(req.db, user, param(req, 'submissionId'));
  if (access.role !== 'teacher' && !access.assignment.students_see_similarity) throw forbidden('Similarity reports are not shared with students for this assignment');
  const report = latestSimilarity(req.db, access.submission.id);
  res.json({ report: report ? presentReport(req.db, report, access) : null });
}));

router.post('/submissions/:submissionId/similarity', ah((req, res) => {
  const user = requireUser(req);
  const access = loadSubmission(req.db, user, param(req, 'submissionId'));
  requireGrader(access);
  const report = runSimilarity(req.db, access.submission.id, readOptions(req.body));
  audit(req.db, user.id, 'run_similarity', 'submission', access.submission.id);
  res.status(201).json({ report: presentReport(req.db, report, access) });
}));

router.get('/submissions/:submissionId/ai-assessment', ah((req, res) => {
  const user = requireUser(req);
  const access = loadSubmission(req.db, user, param(req, 'submissionId'));
  if (access.role !== 'teacher') throw notFound();
  res.json({ enabled: !!access.assignment.ai_assessment_enabled, assessment: latestAiAssessment(req.db, access.submission.id) });
}));

router.post('/submissions/:submissionId/ai-assessment', ah((req, res) => {
  const user = requireUser(req);
  const access = loadSubmission(req.db, user, param(req, 'submissionId'));
  if (access.role !== 'teacher') throw notFound();
  if (!access.assignment.ai_assessment_enabled) throw forbidden('Experimental AI-writing assessment is not enabled for this assignment');
  const assessment = runAiAssessment(req.db, access.submission.id);
  audit(req.db, user.id, 'run_ai_assessment', 'submission', access.submission.id);
  res.status(201).json({ enabled: true, assessment });
}));

const DECISIONS = ['no_concern', 'needs_conversation', 'dismissed'];

router.put('/submissions/:submissionId/ai-assessment/review', ah((req, res) => {
  const user = requireUser(req);
  const access = loadSubmission(req.db, user, param(req, 'submissionId'));
  if (access.role !== 'teacher') throw notFound();
  const current = latestAiAssessment(req.db, access.submission.id);
  if (!current) throw badRequest('Run an assessment before recording a review');
  const decision = str(req.body?.decision, 'decision');
  if (!DECISIONS.includes(decision)) throw badRequest(`decision must be one of ${DECISIONS.join(', ')}`);
  const note = str(req.body?.note, 'note', { min: 10, max: 5000 });
  req.db.prepare("UPDATE ai_assessments SET review_decision = ?, review_note = ?, reviewer_id = ?, reviewed_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id = ?")
    .run(decision, note, user.id, current.id);
  audit(req.db, user.id, 'review_ai_assessment', 'submission', access.submission.id);
  res.json({ enabled: !!access.assignment.ai_assessment_enabled, assessment: latestAiAssessment(req.db, access.submission.id) });
}));

export default router;
