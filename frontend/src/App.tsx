import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { api, apiBlob, getToken, setToken, type AuthUser } from './api'

interface CourseSummary {
  id: string
  name: string
  code: string
  description: string | null
  assignments: Array<{ id: string; title: string; dueDate: string | null; maxScore: number | null }>
  students?: Array<{ user: { id: string; name: string; email: string } }>
}

interface AssignmentDetail {
  id: string
  title: string
  description: string | null
  dueDate: string | null
  maxScore: number | null
  submissions: Array<{ id: string; studentId: string; status: string; submittedAt: string; version: number }>
  rubric: {
    criteria: Array<{ id: string; title: string; points: number; ratings: Array<{ id: string; title: string; points: number }> }>
  } | null
}

interface TextAnchor { kind: 'text'; start: number; end: number }

interface Annotation {
  id: string
  type: string
  content: string | null
  color: string | null
  isDraft: boolean
  anchor: TextAnchor | { kind: string } | null
  createdBy: { name: string }
}

interface SubmissionDetail {
  id: string
  status: string
  version: number
  student: { id: string; name: string }
  document: {
    id: string
    originalFilename: string
    format: string
    processingStatus: string
    processingError: string | null
    textContent: string | null
    metadata: { previewKind?: string; note?: string } | null
  }
  assignment: AssignmentDetail & { courseId: string; title: string }
  grade: { score: number; maxScore: number; feedback: string | null; isDraft: boolean; rubricScores: Record<string, number> | null } | null
  annotations: Annotation[]
  similarityReport: {
    overallSimilarity: number
    sources: Array<{ id: string; sourceName: string; sourceType: string; similarityPercentage: number; passages: Array<{ id: string; submissionText: string; matchType: string }> }>
  } | null
  aiAssessment: {
    outcome: string
    consequentialUseEnabled: boolean
    humanReviewRequired: boolean
    uncertainty: string
    reasons: string[]
    limitations: string
    evaluation: { accuracy: number; falsePositiveRate: number; fixtureCount: number; note: string }
  } | null
}

function useUser(): AuthUser | null {
  const raw = sessionStorage.getItem('lab_user')
  return raw ? JSON.parse(raw) as AuthUser : null
}

function saveUser(user: AuthUser | null): void {
  if (user) sessionStorage.setItem('lab_user', JSON.stringify(user))
  else sessionStorage.removeItem('lab_user')
}

function Shell({ children }: { children: ReactNode }) {
  const user = useUser()
  const navigate = useNavigate()
  if (!getToken() || !user) return <Navigate to="/login" replace />
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">Academic Review Lab</Link>
        <Notifications />
        <p className="role-pill">{user.role === 'TEACHER' ? 'Instructor' : 'Student'} · {user.name}</p>
        <button className="ghost" onClick={() => { setToken(null); saveUser(null); navigate('/login') }}>Sign out</button>
      </header>
      <main>{children}</main>
    </div>
  )
}

function Notifications() {
  const [items, setItems] = useState<Array<{ id: string; title: string; message: string; read: boolean }>>([])
  useEffect(() => {
    api<{ notifications: Array<{ id: string; title: string; message: string; read: boolean }> }>('/api/notifications')
      .then((data) => setItems(data.notifications))
      .catch(() => setItems([]))
  }, [])
  const unread = items.filter((item) => !item.read).length
  return (
    <details className="notifications">
      <summary data-testid="notifications">{unread} unread</summary>
      <ul>
        {items.slice(0, 6).map((item) => <li key={item.id}><strong>{item.title}</strong> {item.message}</li>)}
        {items.length === 0 && <li>No notifications.</li>}
      </ul>
    </details>
  )
}

function Login() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('ada@demo.lab')
  const [password, setPassword] = useState('DemoTeacher!2026')
  const [error, setError] = useState('')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      const result = await api<{ token: string; user: AuthUser }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      })
      setToken(result.token)
      saveUser(result.user)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    }
  }
  return (
    <div className="login-wrap">
      <form className="card login-card" onSubmit={submit}>
        <p className="eyebrow">Synthetic demo · not a production school system</p>
        <h1>Academic Review Lab</h1>
        <p>Review writing, leave anchored comments, grade with a rubric, and read overlap and writing-signal reports.</p>
        <label>Email<input data-testid="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="username" /></label>
        <label>Password<input data-testid="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete="current-password" /></label>
        {error && <p className="error" role="alert">{error}</p>}
        <button data-testid="login-submit" type="submit">Sign in</button>
        <div className="demo-accounts">
          <p>Demo instructor: ada@demo.lab / DemoTeacher!2026</p>
          <p>Demo students: grace@demo.lab and alan@demo.lab / DemoStudent!2026</p>
        </div>
      </form>
    </div>
  )
}

function Dashboard() {
  const user = useUser()
  const [courses, setCourses] = useState<CourseSummary[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    api<{ courses: CourseSummary[] }>('/api/courses').then((data) => setCourses(data.courses)).catch((err: Error) => setError(err.message))
  }, [])
  return (
    <section>
      <h1>{user?.role === 'TEACHER' ? 'Instructor workspace' : 'Student workspace'}</h1>
      {error && <p className="error">{error}</p>}
      <div className="grid">
        {courses.map((course) => (
          <Link key={course.id} className="card course-card" to={`/courses/${course.id}`} data-testid={`course-${course.code}`}>
            <p className="eyebrow">{course.code}</p>
            <h2>{course.name}</h2>
            <p>{course.description}</p>
            <p>{course.assignments.length} assignment{course.assignments.length === 1 ? '' : 's'}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}

function CoursePage() {
  const { courseId = '' } = useParams()
  const user = useUser()
  const [course, setCourse] = useState<{ id: string; name: string; code: string; assignments: AssignmentDetail[]; students: Array<{ user: { name: string; email: string } }> } | null>(null)
  const [title, setTitle] = useState('Response journal')
  const [description, setDescription] = useState('Upload a short text response.')
  const [error, setError] = useState('')

  function reload() {
    api<{ course: NonNullable<typeof course> }>(`/api/courses/${courseId}`).then((data) => setCourse(data.course)).catch((err: Error) => setError(err.message))
  }
  useEffect(reload, [courseId])

  async function createAssignment(event: FormEvent) {
    event.preventDefault()
    await api(`/api/courses/${courseId}/assignments`, {
      method: 'POST',
      body: JSON.stringify({
        title,
        description,
        maxScore: 10,
        criteria: [{ title: 'Completion', points: 10, ratings: [{ title: 'Complete', points: 10 }, { title: 'Missing', points: 0 }] }],
      }),
    })
    reload()
  }

  if (!course) return <p>Loading course…</p>
  return (
    <section>
      <p className="eyebrow">{course.code}</p>
      <h1>{course.name}</h1>
      {error && <p className="error">{error}</p>}
      {user?.role === 'TEACHER' && (
        <form className="card form-row" onSubmit={createAssignment}>
          <h2>New assignment</h2>
          <label>Title<input data-testid="assignment-title" value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>Prompt<textarea value={description} onChange={(event) => setDescription(event.target.value)} /></label>
          <button data-testid="create-assignment" type="submit">Create assignment</button>
        </form>
      )}
      <div className="stack">
        {course.assignments.map((assignment) => (
          <article key={assignment.id} className="card" data-testid={`assignment-${assignment.title}`}>
            <h2>{assignment.title}</h2>
            <p>{assignment.description}</p>
            <p>Max score {assignment.maxScore ?? '—'} · {assignment.submissions.length} visible submission{assignment.submissions.length === 1 ? '' : 's'}</p>
            {user?.role === 'STUDENT' ? (
              <StudentUpload assignmentId={assignment.id} existing={assignment.submissions[0]} />
            ) : (
              <ul className="plain">
                {latestByStudent(assignment.submissions).map((submission) => (
                  <li key={submission.id}>
                    <Link to={`/submissions/${submission.id}`} data-testid={`open-submission-${submission.id}`}>Open version {submission.version} · {submission.status}</Link>
                  </li>
                ))}
                {assignment.submissions.length === 0 && <li>No submissions yet.</li>}
              </ul>
            )}
          </article>
        ))}
      </div>
      {user?.role === 'TEACHER' && (
        <aside className="card">
          <h2>Roster</h2>
          <ul className="plain">{course.students.map((row) => <li key={row.user.email}>{row.user.name} · {row.user.email}</li>)}</ul>
        </aside>
      )}
    </section>
  )
}

function latestByStudent(submissions: AssignmentDetail['submissions']) {
  const map = new Map<string, AssignmentDetail['submissions'][number]>()
  for (const submission of submissions) {
    const current = map.get(submission.studentId)
    if (!current || submission.version > current.version) map.set(submission.studentId, submission)
  }
  return [...map.values()]
}

function StudentUpload({ assignmentId, existing }: { assignmentId: string; existing?: { id: string; status: string } }) {
  const [file, setFile] = useState<File | null>(null)
  const [message, setMessage] = useState('')
  const navigate = useNavigate()
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!file) return
    const body = new FormData()
    body.append('file', file)
    const result = await api<{ submissionId: string }>(`/api/assignments/${assignmentId}/submissions`, { method: 'POST', body })
    setMessage('Uploaded. Processing started.')
    navigate(`/submissions/${result.submissionId}`)
  }
  return (
    <form onSubmit={submit} className="upload-row">
      <input data-testid={`file-${assignmentId}`} type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
      <button data-testid={`upload-${assignmentId}`} type="submit">Upload</button>
      {existing && <Link to={`/submissions/${existing.id}`}>View latest submission</Link>}
      {message && <p>{message}</p>}
    </form>
  )
}

function Review() {
  const { submissionId = '' } = useParams()
  const user = useUser()
  const textRef = useRef<HTMLDivElement>(null)
  const gradeDirty = useRef(false)
  const pendingAnchor = useRef<TextAnchor | null>(null)
  const [data, setData] = useState<{ submission: SubmissionDetail; navigation: Array<{ id: string; version: number; student: { id: string; name: string } }> } | null>(null)
  const [score, setScore] = useState('')
  const [feedback, setFeedback] = useState('')
  const [rubricScores, setRubricScores] = useState<Record<string, number>>({})
  const [comment, setComment] = useState('Look at how certain the families sound.')
  const [error, setError] = useState('')
  const [mediaUrl, setMediaUrl] = useState<string | null>(null)

  async function reload() {
    const next = await api<{ submission: SubmissionDetail; navigation: Array<{ id: string; version: number; student: { id: string; name: string } }> }>(`/api/submissions/${submissionId}`)
    setData(next)
    if (!gradeDirty.current) {
      setScore(next.submission.grade ? String(next.submission.grade.score) : '')
      setFeedback(next.submission.grade?.feedback ?? '')
      setRubricScores(next.submission.grade?.rubricScores ?? {})
    }
  }

  useEffect(() => {
    gradeDirty.current = false
  }, [submissionId])

  useEffect(() => {
    let stop = false
    reload().catch((err: Error) => setError(err.message))
    const timer = window.setInterval(() => {
      if (!stop) reload().catch(() => undefined)
    }, 1500)
    return () => { stop = true; window.clearInterval(timer) }
  }, [submissionId])

  useEffect(() => {
    const preview = data?.submission.document.metadata?.previewKind
    if (!data || (preview !== 'pdf' && preview !== 'image' && preview !== 'audio' && preview !== 'video')) {
      setMediaUrl(null)
      return
    }
    let url = ''
    apiBlob(`/api/documents/${data.submission.document.id}/file`).then((blob) => {
      url = URL.createObjectURL(blob)
      setMediaUrl(url)
    }).catch(() => setMediaUrl(null))
    return () => { if (url) URL.revokeObjectURL(url) }
  }, [data?.submission.document.id, data?.submission.document.metadata?.previewKind])

  const text = data?.submission.document.textContent ?? ''
  const pieces = useMemo(() => renderPieces(text, data?.submission.annotations ?? []), [text, data])
  if (!data) return <p>Loading submission…</p>
  const submission = data.submission
  const teacher = user?.role === 'TEACHER'

  function rememberSelection() {
    pendingAnchor.current = selectionAnchor(textRef.current, text)
  }

  async function annotate(type: 'HIGHLIGHT' | 'UNDERLINE' | 'POINT') {
    const anchor = pendingAnchor.current ?? selectionAnchor(textRef.current, text)
    if (!anchor) {
      setError('Select a passage in the document first.')
      return
    }
    pendingAnchor.current = null
    const content = comment.trim()
    await api(`/api/submissions/${submission.id}/annotations`, {
      method: 'POST',
      body: JSON.stringify({ type, content, anchor, color: type === 'UNDERLINE' ? '#2a6f97' : '#f2c14e' }),
    })
    await reload()
  }

  function chooseRating(criterionId: string, points: number) {
    gradeDirty.current = true
    const next = { ...rubricScores, [criterionId]: points }
    setRubricScores(next)
    const criteria = submission.assignment.rubric?.criteria ?? []
    if (criteria.length > 0 && criteria.every((criterion) => next[criterion.id] !== undefined)) {
      const total = criteria.reduce((sum, criterion) => sum + Number(next[criterion.id]), 0)
      setScore(String(total))
    }
  }

  async function saveGrade(publish: boolean) {
    const criteria = submission.assignment.rubric?.criteria ?? []
    const complete = criteria.length > 0 && criteria.every((criterion) => rubricScores[criterion.id] !== undefined)
    const total = complete ? criteria.reduce((sum, criterion) => sum + Number(rubricScores[criterion.id]), 0) : Number(score)
    await api(`/api/submissions/${submission.id}/grade`, {
      method: 'POST',
      body: JSON.stringify({
        score: total,
        maxScore: submission.assignment.maxScore ?? 20,
        feedback,
        publish,
        rubricScores: complete ? rubricScores : undefined,
      }),
    })
    gradeDirty.current = false
    await reload()
  }

  const students = new Map<string, { id: string; name: string; version: number }>()
  for (const item of data.navigation) {
    const current = students.get(item.student.id)
    if (!current || item.version > current.version) students.set(item.student.id, { id: item.id, name: item.student.name, version: item.version })
  }

  return (
    <section className="review">
      <div>
        <p className="eyebrow">{submission.assignment.title} · version {submission.version}</p>
        <h1>{submission.student.name}</h1>
        <p data-testid="processing-status">File {submission.document.originalFilename} · {submission.document.format} · {submission.document.processingStatus}</p>
        {submission.document.metadata?.note && <p className="note">{submission.document.metadata.note}</p>}
        {submission.document.processingError && <p className="error">{submission.document.processingError}</p>}
        {teacher && (
          <>
            <label>Annotation comment<input data-testid="annotation-comment" value={comment} onChange={(event) => setComment(event.target.value)} /></label>
            <div className="button-row">
              <button data-testid="highlight" onClick={() => annotate('HIGHLIGHT')}>Highlight selection</button>
              <button data-testid="underline" onClick={() => annotate('UNDERLINE')}>Underline selection</button>
              <button onClick={() => annotate('POINT')}>Comment on selection</button>
            </div>
          </>
        )}
        {mediaUrl && submission.document.metadata?.previewKind === 'pdf' && <iframe title="PDF preview" className="pdf-frame" src={mediaUrl} />}
        {mediaUrl && submission.document.metadata?.previewKind === 'image' && <img alt="Uploaded image preview" className="image-preview" src={mediaUrl} />}
        {mediaUrl && submission.document.metadata?.previewKind === 'audio' && <audio controls src={mediaUrl} />}
        {mediaUrl && submission.document.metadata?.previewKind === 'video' && <video controls className="image-preview" src={mediaUrl} />}
        <div ref={textRef} className="document" data-testid="document-text" onMouseUp={rememberSelection}>
          {pieces.map((piece, index) => piece.mark
            ? <mark key={index} className={piece.mark === 'UNDERLINE' ? 'underline' : 'highlight'} title={piece.comment || undefined}>{piece.text}</mark>
            : <span key={index}>{piece.text}</span>)}
          {!text && <p>No extracted text for this file.</p>}
        </div>
        <a data-testid="export-feedback" href="#" onClick={async (event) => {
          event.preventDefault()
          const blob = await apiBlob(`/api/submissions/${submission.id}/export`)
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'feedback.txt'
          link.click()
          URL.revokeObjectURL(url)
        }}>Download feedback transcript</a>
      </div>
      <aside className="side">
        {teacher && students.size > 1 && (
          <div className="card">
            <h2>Students</h2>
            <ul className="plain">
              {[...students.values()].map((item) => <li key={item.id}><Link to={`/submissions/${item.id}`}>{item.name}</Link></li>)}
            </ul>
          </div>
        )}
        <div className="card">
          <h2>Grade</h2>
          {teacher ? (
            <>
              <label>Score<input data-testid="score" value={score} onChange={(event) => { gradeDirty.current = true; setScore(event.target.value) }} /></label>
              <label>Feedback<textarea data-testid="feedback" value={feedback} onChange={(event) => { gradeDirty.current = true; setFeedback(event.target.value) }} /></label>
              <div className="button-row">
                <button data-testid="save-draft" onClick={() => saveGrade(false)}>Save draft</button>
                <button data-testid="publish" onClick={() => saveGrade(true)}>Publish</button>
              </div>
              <p>{submission.grade?.isDraft ? 'Draft is hidden from the student.' : submission.grade ? 'Published.' : 'Not graded.'}</p>
            </>
          ) : (
            <div data-testid="published-grade">
              {submission.grade ? <p><strong>{submission.grade.score} / {submission.grade.maxScore}</strong></p> : <p>No published grade yet.</p>}
              <p>{submission.grade?.feedback || 'No published feedback yet.'}</p>
            </div>
          )}
          {submission.assignment.rubric && (
            <div data-testid="rubric">
              <h3>Rubric</h3>
              {teacher ? submission.assignment.rubric.criteria.map((criterion) => (
                <label key={criterion.id}>{criterion.title} · {criterion.points} pts
                  <select
                    data-testid={`rubric-${criterion.title}`}
                    value={rubricScores[criterion.id] ?? ''}
                    onChange={(event) => {
                      if (event.target.value === '') return
                      chooseRating(criterion.id, Number(event.target.value))
                    }}
                  >
                    <option value="">Choose a rating</option>
                    {criterion.ratings.map((rating) => (
                      <option key={rating.id} value={rating.points}>{rating.title} · {rating.points}</option>
                    ))}
                  </select>
                </label>
              )) : (
                <ul className="plain">
                  {submission.assignment.rubric.criteria.map((criterion) => (
                    <li key={criterion.id}>
                      {criterion.title}: {submission.grade?.rubricScores?.[criterion.id] ?? '—'} / {criterion.points}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <div className="card" data-testid="similarity-report">
          <h2>Similarity overlap</h2>
          <p>Not proof of plagiarism, and not a Turnitin score. The corpus is public-domain text plus other submissions in this assignment.</p>
          {submission.similarityReport ? (
            <>
              <p data-testid="similarity-score"><strong>{submission.similarityReport.overallSimilarity}%</strong> of words overlap included sources.</p>
              <ul className="plain">
                {submission.similarityReport.sources.map((source) => (
                  <li key={source.id}>{source.sourceName} · {source.similarityPercentage}% · {source.passages.length} passage{source.passages.length === 1 ? '' : 's'}</li>
                ))}
              </ul>
            </>
          ) : <p>Report not ready.</p>}
        </div>
        <div className="card warning" data-testid="ai-report">
          <h2>Writing-signal review</h2>
          <p>Experimental. Not proof of AI authorship. Consequential use is disabled. A person must read the work.</p>
          {submission.aiAssessment ? (
            <>
              <p data-testid="ai-outcome"><strong>{submission.aiAssessment.outcome}</strong> · uncertainty {submission.aiAssessment.uncertainty}</p>
              <ul className="plain">{submission.aiAssessment.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>
              <p>{submission.aiAssessment.limitations}</p>
              <p>Synthetic fixture accuracy {submission.aiAssessment.evaluation.accuracy} on {submission.aiAssessment.evaluation.fixtureCount} items. {submission.aiAssessment.evaluation.note}</p>
            </>
          ) : <p>Assessment not ready.</p>}
        </div>
        {error && <p className="error">{error}</p>}
      </aside>
    </section>
  )
}

function renderPieces(text: string, annotations: Annotation[]): Array<{ text: string; mark: string | null; comment: string | null }> {
  const ranges = annotations
    .map((annotation) => annotation.anchor && annotation.anchor.kind === 'text' ? { ...(annotation.anchor as TextAnchor), type: annotation.type, comment: annotation.content } : null)
    .filter((range): range is TextAnchor & { type: string; comment: string | null } => Boolean(range))
    .sort((a, b) => a.start - b.start)
  if (!text) return []
  const pieces: Array<{ text: string; mark: string | null; comment: string | null }> = []
  let cursor = 0
  for (const range of ranges) {
    const start = Math.max(0, Math.min(text.length, range.start))
    const end = Math.max(start, Math.min(text.length, range.end))
    if (start < cursor) continue
    if (start > cursor) pieces.push({ text: text.slice(cursor, start), mark: null, comment: null })
    pieces.push({ text: text.slice(start, end), mark: range.type, comment: range.comment })
    cursor = end
  }
  if (cursor < text.length) pieces.push({ text: text.slice(cursor), mark: null, comment: null })
  return pieces
}

function selectionAnchor(root: HTMLDivElement | null, fullText: string): TextAnchor | null {
  const selection = window.getSelection()
  if (!root || !selection || selection.rangeCount === 0 || selection.isCollapsed) return null
  const range = selection.getRangeAt(0)
  if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return null
  const start = caretOffset(root, range.startContainer, range.startOffset)
  const end = caretOffset(root, range.endContainer, range.endOffset)
  const [from, to] = start < end ? [start, end] : [end, start]
  if (to - from < 2 || fullText.slice(from, to).trim().length === 0) return null
  return { kind: 'text', start: from, end: to }
}

function caretOffset(root: HTMLElement, node: Node, offset: number): number {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let count = 0
  let current = walker.nextNode()
  while (current) {
    if (current === node) return count + offset
    count += current.textContent?.length ?? 0
    current = walker.nextNode()
  }
  return count
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Shell><Dashboard /></Shell>} />
        <Route path="/courses/:courseId" element={<Shell><CoursePage /></Shell>} />
        <Route path="/submissions/:submissionId" element={<Shell><Review /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
