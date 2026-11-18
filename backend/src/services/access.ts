import { UserRole } from '@prisma/client';
import prisma from '../db/prisma';
import { AuthUser } from './auth';

export async function teachesCourse(userId: string, courseId: string): Promise<boolean> {
  const row = await prisma.courseTeacher.findUnique({ where: { courseId_userId: { courseId, userId } } });
  return Boolean(row);
}

export async function studiesCourse(userId: string, courseId: string): Promise<boolean> {
  const row = await prisma.courseStudent.findUnique({ where: { courseId_userId: { courseId, userId } } });
  return Boolean(row);
}

export async function loadSubmission(id: string) {
  return prisma.submission.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, name: true, email: true } },
      document: true,
      assignment: { include: { course: true, rubric: { include: { criteria: { include: { ratings: true }, orderBy: { order: 'asc' } } } } } },
      grade: true,
      annotations: { include: { comments: true, createdBy: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' } },
      similarityReport: {
        include: {
          sources: { include: { passages: { orderBy: { startPosition: 'asc' } } }, orderBy: { similarityPercentage: 'desc' } },
          excludedMatches: true,
        },
      },
      aiAssessment: { include: { reviewedBy: { select: { id: true, name: true } } } },
    },
  });
}

export function canReadSubmission(user: AuthUser, submission: NonNullable<Awaited<ReturnType<typeof loadSubmission>>>, teacherIds: string[], studentIds: string[]): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.TEACHER) return teacherIds.includes(user.id);
  return user.role === UserRole.STUDENT && submission.studentId === user.id && studentIds.includes(user.id);
}

type SimilaritySourceView = { sourceType: string; sourceName: string; passages: Array<{ sourceText: string }> };

type StudentVisible = {
  grade: { isDraft: boolean } | null;
  annotations: Array<{ isDraft: boolean; comments: Array<{ isDraft: boolean }> }>;
  aiAssessment?: unknown;
  similarityReport?: { sources: SimilaritySourceView[] } | null;
};

const PEER_SOURCE_NAME = 'Another submission in this assignment';

// Students never receive AI-writing signals (ADR-009), nor a classmate's name or text through similarity matches.
export function studentView<T extends StudentVisible>(user: AuthUser, submission: T): T {
  if (user.role !== UserRole.STUDENT) return submission;
  const report = submission.similarityReport;
  return {
    ...submission,
    aiAssessment: null,
    similarityReport: report
      ? {
        ...report,
        sources: report.sources.map((source) => source.sourceType === 'STUDENT_PAPER'
          ? { ...source, sourceName: PEER_SOURCE_NAME, sourceUrl: null, passages: source.passages.map((passage) => ({ ...passage, sourceText: '' })) }
          : source),
      }
      : report,
    grade: submission.grade && !submission.grade.isDraft ? submission.grade : null,
    annotations: submission.annotations
      .filter((annotation) => !annotation.isDraft)
      .map((annotation) => ({ ...annotation, comments: annotation.comments.filter((comment) => !comment.isDraft) })),
  };
}
