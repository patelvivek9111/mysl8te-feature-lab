import prisma from './db/prisma';
import { assessText, evaluateFixtures } from './services/aiAssessment';
import { extractDocument } from './services/extract';
import { buildSimilarityReport } from './services/similarity';
import path from 'path';
import { uploadDir } from './services/extract';

let timer: NodeJS.Timeout | null = null;

export async function processNextJob(): Promise<boolean> {
  const job = await prisma.processingJob.findFirst({ where: { status: 'PENDING' }, orderBy: { createdAt: 'asc' } });
  if (!job) return false;
  await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'PROCESSING', attempts: { increment: 1 } } });
  try {
    const payload = job.payload as { documentId?: string; submissionId?: string };
    if (job.type === 'PROCESS_DOCUMENT' && payload.documentId && payload.submissionId) {
      const document = await prisma.document.findUnique({ where: { id: payload.documentId } });
      if (!document) throw new Error('Document not found');
      const filePath = path.join(uploadDir(), document.storedFilename);
      const extracted = await extractDocument(filePath, document.format);
      await prisma.document.update({
        where: { id: document.id },
        data: {
          textContent: extracted.text,
          pageCount: extracted.pageCount,
          processingStatus: 'COMPLETED',
          processedAt: new Date(),
          metadata: { previewKind: extracted.previewKind, note: extracted.note },
        },
      });
      await buildSimilarityReport(payload.submissionId);
      const assessment = extracted.text ? assessText(extracted.text) : assessText('');
      const evaluation = evaluateFixtures();
      await prisma.aiAssessment.upsert({
        where: { submissionId: payload.submissionId },
        update: {
          status: 'COMPLETED',
          outcome: assessment.outcome,
          consequentialUseEnabled: false,
          humanReviewRequired: true,
          uncertainty: assessment.uncertainty,
          reasons: assessment.reasons,
          features: JSON.parse(JSON.stringify(assessment.features)),
          limitations: assessment.limitations,
          evaluation: JSON.parse(JSON.stringify(evaluation)),
        },
        create: {
          submissionId: payload.submissionId,
          status: 'COMPLETED',
          outcome: assessment.outcome,
          consequentialUseEnabled: false,
          humanReviewRequired: true,
          uncertainty: assessment.uncertainty,
          reasons: assessment.reasons,
          features: JSON.parse(JSON.stringify(assessment.features)),
          limitations: assessment.limitations,
          evaluation: JSON.parse(JSON.stringify(evaluation)),
        },
      });
      await prisma.submission.update({ where: { id: payload.submissionId }, data: { status: 'SUBMITTED' } });
      const submission = await prisma.submission.findUnique({
        where: { id: payload.submissionId },
        include: { assignment: { include: { course: { include: { teachers: true } } } }, student: true },
      });
      if (submission) {
        await prisma.notification.createMany({
          data: submission.assignment.course.teachers.map((teacher) => ({
            userId: teacher.userId,
            type: 'SUBMISSION_RECEIVED' as const,
            title: 'Submission ready for review',
            message: `${submission.student.name} submitted ${submission.assignment.title}.`,
            relatedEntity: 'submission',
            relatedEntityId: submission.id,
          })),
        });
      }
    }
    await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'COMPLETED' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Processing failed';
    await prisma.processingJob.update({ where: { id: job.id }, data: { status: 'FAILED', error: message } });
    const payload = job.payload as { documentId?: string };
    if (payload.documentId) {
      await prisma.document.update({
        where: { id: payload.documentId },
        data: { processingStatus: 'FAILED', processingError: message },
      });
    }
  }
  return true;
}

export function startWorker(): void {
  if (timer) return;
  timer = setInterval(() => {
    processNextJob().catch((error) => {
      console.error(JSON.stringify({ level: 'error', message: 'worker failed', error: String(error) }));
    });
  }, 400);
}

export function stopWorker(): void {
  if (timer) clearInterval(timer);
  timer = null;
}
