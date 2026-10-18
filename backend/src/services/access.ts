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
      similarityReport: { include: { sources: { include: { passages: true } } } },
      aiAssessment: true,
    },
  });
}

export function canReadSubmission(user: AuthUser, submission: NonNullable<Awaited<ReturnType<typeof loadSubmission>>>, teacherIds: string[], studentIds: string[]): boolean {
  if (user.role === UserRole.ADMIN) return true;
  if (user.role === UserRole.TEACHER) return teacherIds.includes(user.id);
  return user.role === UserRole.STUDENT && submission.studentId === user.id && studentIds.includes(user.id);
}

export function studentView<T extends { grade: { isDraft: boolean } | null; annotations: Array<{ isDraft: boolean; comments: Array<{ isDraft: boolean }> }> }>(user: AuthUser, submission: T): T {
  if (user.role !== UserRole.STUDENT) return submission;
  return {
    ...submission,
    grade: submission.grade && !submission.grade.isDraft ? submission.grade : null,
    annotations: submission.annotations
      .filter((annotation) => !annotation.isDraft)
      .map((annotation) => ({ ...annotation, comments: annotation.comments.filter((comment) => !comment.isDraft) })),
  };
}
