import fs from 'fs/promises';
import path from 'path';
import prisma from './db/prisma';
import { hashPassword } from './services/auth';
import { uploadDir } from './services/extract';
import { assessText, evaluateFixtures } from './services/aiAssessment';
import { buildSimilarityReport } from './services/similarity';

export const DEMO_ACCOUNTS = {
  teacher: { email: 'ada@demo.lab', password: 'DemoTeacher!2026', name: 'Ada Lovelace' },
  grace: { email: 'grace@demo.lab', password: 'DemoStudent!2026', name: 'Grace Hopper' },
  alan: { email: 'alan@demo.lab', password: 'DemoStudent!2026', name: 'Alan Turing' },
};

const AUSTEN = `It is a truth universally acknowledged, that a single man in possession of a good fortune, must be in want of a wife. However little known the feelings or views of such a man may be on his first entering a neighbourhood, this truth is so well fixed in the minds of the surrounding families, that he is considered the rightful property of some one or other of their daughters.`;

const GETTYSBURG = `Four score and seven years ago our fathers brought forth on this continent, a new nation, conceived in Liberty, and dedicated to the proposition that all men are created equal. Now we are engaged in a great civil war, testing whether that nation, or any nation so conceived and so dedicated, can long endure.`;

const GRACE_ESSAY = `${AUSTEN}

I am not sure the joke is only about marriage. The sentence makes the neighborhood sound certain, and then the next sentence admits we do not know the man at all. That gap is the part I want to write about, because the certainty belongs to the families rather than to the narrator's evidence.

References
Austen, Jane. Pride and Prejudice. 1813.`;

export async function seedDemo(): Promise<void> {
  const institution = await prisma.institution.upsert({
    where: { domain: 'demo.lab' },
    update: { name: 'Demo College' },
    create: { name: 'Demo College', domain: 'demo.lab' },
  });
  const teacher = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.teacher.email },
    update: { name: DEMO_ACCOUNTS.teacher.name, role: 'TEACHER' },
    create: {
      email: DEMO_ACCOUNTS.teacher.email,
      name: DEMO_ACCOUNTS.teacher.name,
      role: 'TEACHER',
      passwordHash: hashPassword(DEMO_ACCOUNTS.teacher.password),
      institutionId: institution.id,
    },
  });
  const grace = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.grace.email },
    update: { name: DEMO_ACCOUNTS.grace.name, role: 'STUDENT' },
    create: {
      email: DEMO_ACCOUNTS.grace.email,
      name: DEMO_ACCOUNTS.grace.name,
      role: 'STUDENT',
      passwordHash: hashPassword(DEMO_ACCOUNTS.grace.password),
      institutionId: institution.id,
    },
  });
  const alan = await prisma.user.upsert({
    where: { email: DEMO_ACCOUNTS.alan.email },
    update: { name: DEMO_ACCOUNTS.alan.name, role: 'STUDENT' },
    create: {
      email: DEMO_ACCOUNTS.alan.email,
      name: DEMO_ACCOUNTS.alan.name,
      role: 'STUDENT',
      passwordHash: hashPassword(DEMO_ACCOUNTS.alan.password),
      institutionId: institution.id,
    },
  });

  await prisma.corpusDocument.deleteMany({ where: { title: { in: ['Pride and Prejudice, Chapter 1', 'Gettysburg Address'] } } });
  await prisma.corpusDocument.createMany({
    data: [
      {
        title: 'Pride and Prejudice, Chapter 1',
        author: 'Jane Austen',
        license: 'Public domain (published 1813)',
        sourceUrl: 'https://www.gutenberg.org/ebooks/1342',
        text: AUSTEN,
      },
      {
        title: 'Gettysburg Address',
        author: 'Abraham Lincoln',
        license: 'Public domain (U.S. government work, 1863)',
        sourceUrl: 'https://www.loc.gov/resource/rbpe.24404500/',
        text: GETTYSBURG,
      },
    ],
  });

  let course = await prisma.course.findFirst({ where: { code: 'HIST210', institutionId: institution.id } });
  if (!course) {
    course = await prisma.course.create({
      data: {
        name: 'Reading Public-Domain Prose',
        code: 'HIST210',
        description: 'Synthetic demo course. No real student data.',
        institutionId: institution.id,
      },
    });
  }
  await prisma.courseTeacher.upsert({
    where: { courseId_userId: { courseId: course.id, userId: teacher.id } },
    update: {},
    create: { courseId: course.id, userId: teacher.id },
  });
  for (const student of [grace, alan]) {
    await prisma.courseStudent.upsert({
      where: { courseId_userId: { courseId: course.id, userId: student.id } },
      update: {},
      create: { courseId: course.id, userId: student.id },
    });
  }

  let rubric = await prisma.rubric.findFirst({ where: { title: 'Close-reading rubric' } });
  if (!rubric) {
    rubric = await prisma.rubric.create({
      data: {
        title: 'Close-reading rubric',
        description: 'Demo rubric for a short prose response.',
        totalPoints: 20,
        criteria: {
          create: [
            {
              title: 'Textual evidence',
              description: 'Uses a specific passage from the reading.',
              points: 10,
              order: 1,
              ratings: { create: [{ title: 'Specific', points: 10, order: 1 }, { title: 'Partial', points: 6, order: 2 }, { title: 'Missing', points: 0, order: 3 }] },
            },
            {
              title: 'Interpretation',
              description: 'Explains what the passage is doing.',
              points: 10,
              order: 2,
              ratings: { create: [{ title: 'Clear', points: 10, order: 1 }, { title: 'Developing', points: 6, order: 2 }, { title: 'Missing', points: 0, order: 3 }] },
            },
          ],
        },
      },
    });
  }

  let assignment = await prisma.assignment.findFirst({ where: { courseId: course.id, title: 'Opening paragraph close reading' } });
  if (!assignment) {
    assignment = await prisma.assignment.create({
      data: {
        title: 'Opening paragraph close reading',
        description: 'Explain what the opening of Pride and Prejudice is doing. Quote only what you need.',
        courseId: course.id,
        createdById: teacher.id,
        maxScore: 20,
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        rubricId: rubric.id,
        similarityCheckEnabled: true,
      },
    });
  }
  let uploadAssignment = await prisma.assignment.findFirst({ where: { courseId: course.id, title: 'Optional source notes' } });
  if (!uploadAssignment) {
    uploadAssignment = await prisma.assignment.create({
      data: {
        title: 'Optional source notes',
        description: 'Upload a text, PDF, DOCX, image, or source file of your own notes.',
        courseId: course.id,
        createdById: teacher.id,
        maxScore: 10,
        rubricId: rubric.id,
        similarityCheckEnabled: true,
      },
    });
  }

  const existing = await prisma.submission.findFirst({ where: { assignmentId: assignment.id, studentId: grace.id } });
  if (!existing) {
    await fs.mkdir(uploadDir(), { recursive: true });
    const storedFilename = `seed-grace-essay.txt`;
    await fs.writeFile(path.join(uploadDir(), storedFilename), GRACE_ESSAY);
    const document = await prisma.document.create({
      data: {
        originalFilename: 'grace-close-reading.txt',
        storedFilename,
        mimeType: 'text/plain',
        fileSize: Buffer.byteLength(GRACE_ESSAY),
        format: 'TXT',
        processingStatus: 'COMPLETED',
        textContent: GRACE_ESSAY,
        pageCount: 1,
        processedAt: new Date(),
        metadata: { previewKind: 'text', note: 'Seeded demo submission.' },
      },
    });
    const submission = await prisma.submission.create({
      data: {
        assignmentId: assignment.id,
        studentId: grace.id,
        documentId: document.id,
        status: 'SUBMITTED',
        version: 1,
      },
    });
    await buildSimilarityReport(submission.id);
    const assessment = assessText(GRACE_ESSAY);
    await prisma.aiAssessment.create({
      data: {
        submissionId: submission.id,
        status: 'COMPLETED',
        outcome: assessment.outcome,
        consequentialUseEnabled: false,
        humanReviewRequired: true,
        uncertainty: assessment.uncertainty,
        reasons: assessment.reasons,
        features: JSON.parse(JSON.stringify(assessment.features)),
        limitations: assessment.limitations,
        evaluation: JSON.parse(JSON.stringify(evaluateFixtures())),
      },
    });
    await prisma.annotation.create({
      data: {
        documentId: document.id,
        submissionId: submission.id,
        createdById: teacher.id,
        type: 'HIGHLIGHT',
        page: 1,
        x: 0,
        y: 0,
        width: 0,
        height: 0,
        color: '#f2c14e',
        content: 'This quotation is the passage I want you to spend more time on.',
        isDraft: true,
        anchor: { kind: 'text', start: 0, end: AUSTEN.length },
      },
    });
    await prisma.grade.create({
      data: {
        submissionId: submission.id,
        gradedById: teacher.id,
        score: 16,
        maxScore: 20,
        rubricScores: { evidence: 10, interpretation: 6 },
        feedback: 'Draft only: the quotation is well chosen. Say more about who holds the certainty.',
        isDraft: true,
      },
    });
  }
  void uploadAssignment;
}

if (require.main === module) {
  seedDemo()
    .then(() => prisma.$disconnect())
    .catch(async (error) => {
      console.error(error);
      await prisma.$disconnect();
      process.exit(1);
    });
}
