import type { DB } from '../db/database';
import type { AuthUser } from './auth';
import { forbidden, notFound } from '../http';

export type CourseRole = 'teacher' | 'student';

export function courseRole(db: DB, user: AuthUser, courseId: string): CourseRole | null {
  const row = db.prepare('SELECT role FROM enrollments WHERE course_id = ? AND user_id = ?').get(courseId, user.id) as { role: CourseRole } | undefined;
  if (row) return row.role;
  if (user.role === 'admin') {
    const exists = db.prepare('SELECT 1 FROM courses WHERE id = ?').get(courseId);
    return exists ? 'teacher' : null;
  }
  return null;
}

/** Non-members get 404 rather than 403 so course and submission ids cannot be probed. */
export function requireCourseRole(db: DB, user: AuthUser, courseId: string, ...allowed: CourseRole[]): CourseRole {
  const role = courseRole(db, user, courseId);
  if (!role) throw notFound('Course not found');
  if (allowed.length && !allowed.includes(role)) throw forbidden();
  return role;
}

export interface AssignmentRow {
  id: string; course_id: string; title: string; description: string; points_possible: number; due_at: string | null;
  rubric_id: string | null; similarity_enabled: number; students_see_similarity: number; ai_assessment_enabled: number; created_at: string;
}

export function loadAssignment(db: DB, user: AuthUser, assignmentId: string): { assignment: AssignmentRow; role: CourseRole } {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId) as AssignmentRow | undefined;
  if (!assignment) throw notFound('Assignment not found');
  const role = courseRole(db, user, assignment.course_id);
  if (!role) throw notFound('Assignment not found');
  return { assignment, role };
}

export interface SubmissionRow {
  id: string; assignment_id: string; student_id: string; attempt: number; document_id: string; status: string; submitted_at: string;
}

export interface SubmissionAccess { submission: SubmissionRow; assignment: AssignmentRow; role: CourseRole; isOwner: boolean }

export function loadSubmission(db: DB, user: AuthUser, submissionId: string): SubmissionAccess {
  const submission = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId) as SubmissionRow | undefined;
  if (!submission) throw notFound('Submission not found');
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(submission.assignment_id) as unknown as AssignmentRow;
  const role = courseRole(db, user, assignment.course_id);
  const isOwner = submission.student_id === user.id;
  if (!role || (role === 'student' && !isOwner)) throw notFound('Submission not found');
  return { submission, assignment, role, isOwner };
}

export function requireGrader(access: SubmissionAccess): void {
  if (access.role !== 'teacher') throw forbidden('Only course teachers can perform this action');
}
