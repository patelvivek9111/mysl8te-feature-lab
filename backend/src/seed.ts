import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './auth/auth';
import { transaction, type DB } from './db/database';
import { extractContent, textToHtml } from './documents/processing';
import { runAutomaticChecks } from './integrity/service';

export const DEMO_PASSWORD = 'demo-password-123';
export const DEMO_USERS = {
  teacher: { email: 'teacher@demo.test', name: 'Dana Teacher', role: 'teacher' as const },
  alice: { email: 'alice@demo.test', name: 'Alice Student', role: 'student' as const },
  bob: { email: 'bob@demo.test', name: 'Bob Student', role: 'student' as const },
};

const REFERENCE_TEXT = `The water cycle describes the continuous movement of water on, above, and below the surface of the Earth.
Water changes state between liquid, vapor, and ice at various places in the cycle. Evaporation from oceans and lakes
transfers water to the atmosphere, where it condenses into clouds and eventually returns to the surface as precipitation.
Plants contribute through transpiration, releasing water vapor from their leaves into the air. Groundwater moves slowly
through aquifers and may take thousands of years to return to the ocean.`;

const ALICE_ESSAY = `The Role of Wetlands in Regional Water Systems

Wetlands act as natural sponges in a landscape. During heavy storms they absorb excess runoff and release it slowly,
which reduces flooding in nearby towns. In my field observations at the county marsh, the water level rose nearly
forty centimeters after a single afternoon storm, yet the creek downstream barely changed.

Beyond flood control, wetlands filter sediment and nutrients. Cattails and sedges slow the water so particles settle
out before reaching the river. Farmers upstream benefit indirectly because cleaner water supports the fish that local
families depend on for food and recreation.

Protecting these areas requires cooperation between landowners and the county. Simple measures, such as leaving buffer
strips of native grass along drainage ditches, can make a measurable difference within a few seasons.`;

const BOB_ESSAY = `How Water Moves Through Our Environment

The water cycle describes the continuous movement of water on, above, and below the surface of the Earth. Water changes
state between liquid, vapor, and ice at various places in the cycle. I think this is important because every living
thing needs water to survive.

Evaporation from oceans and lakes transfers water to the atmosphere, where it condenses into clouds and eventually
returns to the surface as rain. "Plants contribute through transpiration, releasing water vapor from their leaves into the air."

Wetlands act as natural sponges in a landscape. During heavy storms they absorb excess runoff and release it slowly,
which reduces flooding in nearby towns. This shows how connected the whole system is.

References
Smith, J. (2020). The water cycle describes the continuous movement of water on, above, and below the surface of the Earth.`;

export async function seedDemo(db: DB, uploadDir: string) {
  const ids: Record<keyof typeof DEMO_USERS, string> = { teacher: '', alice: '', bob: '' };
  const pw = hashPassword(DEMO_PASSWORD);
  const courseId = crypto.randomUUID();
  const assignmentId = crypto.randomUUID();
  const rubricId = crypto.randomUUID();
  transaction(db, () => {
    for (const [key, u] of Object.entries(DEMO_USERS) as [keyof typeof DEMO_USERS, (typeof DEMO_USERS)[keyof typeof DEMO_USERS]][]) {
      ids[key] = crypto.randomUUID();
      db.prepare('INSERT INTO users (id, email, name, role, password_hash) VALUES (?, ?, ?, ?, ?)').run(ids[key], u.email, u.name, u.role, pw);
    }
    db.prepare('INSERT INTO courses (id, name, code, owner_id) VALUES (?, ?, ?, ?)').run(courseId, 'Environmental Science 101', 'ENVS-101', ids.teacher);
    db.prepare("INSERT INTO enrollments (course_id, user_id, role) VALUES (?, ?, 'teacher'), (?, ?, 'student'), (?, ?, 'student')")
      .run(courseId, ids.teacher, courseId, ids.alice, courseId, ids.bob);
    const criteria = [
      { id: crypto.randomUUID(), description: 'Thesis and argument', points: 10, ratings: [
        { id: crypto.randomUUID(), label: 'Excellent', points: 10 }, { id: crypto.randomUUID(), label: 'Developing', points: 6 }, { id: crypto.randomUUID(), label: 'Missing', points: 0 }] },
      { id: crypto.randomUUID(), description: 'Use of evidence and citation', points: 10, ratings: [
        { id: crypto.randomUUID(), label: 'Excellent', points: 10 }, { id: crypto.randomUUID(), label: 'Developing', points: 6 }, { id: crypto.randomUUID(), label: 'Missing', points: 0 }] },
    ];
    db.prepare('INSERT INTO rubrics (id, course_id, title, criteria_json) VALUES (?, ?, ?, ?)').run(rubricId, courseId, 'Essay rubric', JSON.stringify(criteria));
    db.prepare(`INSERT INTO assignments (id, course_id, title, description, points_possible, rubric_id, similarity_enabled, students_see_similarity, ai_assessment_enabled)
                VALUES (?, ?, ?, ?, 20, ?, 1, 0, 1)`).run(assignmentId, courseId, 'Water Systems Essay', 'Write a short essay about how water moves through a regional ecosystem.', rubricId);
    db.prepare('INSERT INTO reference_sources (id, course_id, title, url, text) VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), courseId, 'Course reader: The Water Cycle', 'https://example.edu/reader/water-cycle', REFERENCE_TEXT.replace(/\n/g, ' '));
  });

  fs.mkdirSync(uploadDir, { recursive: true });
  const submit = async (studentId: string, name: string, text: string) => {
    const buf = Buffer.from(text, 'utf8');
    const extraction = await extractContent(buf, 'TXT');
    const docId = crypto.randomUUID();
    const storagePath = path.join(uploadDir, docId);
    fs.writeFileSync(storagePath, buf, { mode: 0o600 });
    const submissionId = crypto.randomUUID();
    db.prepare(`INSERT INTO documents (id, owner_id, original_name, mime, format, size, sha256, storage_path, page_count, text, html, extraction_status)
                VALUES (?, ?, ?, 'text/plain', 'TXT', ?, ?, ?, 1, ?, ?, 'completed')`)
      .run(docId, studentId, name, buf.length, crypto.createHash('sha256').update(buf).digest('hex'), storagePath, extraction.text, textToHtml(extraction.text));
    db.prepare('INSERT INTO submissions (id, assignment_id, student_id, attempt, document_id) VALUES (?, ?, ?, 1, ?)').run(submissionId, assignmentId, studentId, docId);
    runAutomaticChecks(db, submissionId);
    return submissionId;
  };
  const aliceSubmission = await submit(ids.alice, 'wetlands-essay.txt', ALICE_ESSAY);
  const bobSubmission = await submit(ids.bob, 'water-cycle-essay.txt', BOB_ESSAY);
  return { users: ids, courseId, assignmentId, rubricId, submissions: { alice: aliceSubmission, bob: bobSubmission }, password: DEMO_PASSWORD };
}
