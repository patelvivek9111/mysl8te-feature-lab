import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { BrowserRouter, Link, Navigate, Route, Routes, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { api, apiBlob, getToken, setToken, signOut, SESSION_EXPIRED_EVENT, type AuthUser } from './api'
import { AiReviewCard, type AiAssessment } from './AiReviewCard'

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

interface SimilarityReportView {
  overallSimilarity: number
  excludeQuotes: boolean
  excludeBibliography: boolean
  excludeSmallMatches: boolean
  smallMatchThreshold: number
  sources: Array<{
    id: string
    sourceName: string
    sourceType: string
    similarityPercentage: number
    passages: Array<{ id: string; submissionText: string; matchType: string; startPosition: number; endPosition: number }>
  }>
  excludedMatches: Array<{ id: string; reason: string; startPosition: number | null; endPosition: number | null }>
}

type Piece = { text: string; mark: string | null; comment: string | null }

interface SimilarityOptionsForm { excludeQuotes: boolean; excludeBibliography: boolean; excludeSmallMatches: boolean; smallMatchThreshold: string }

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
  similarityReport: SimilarityReportView | null
  aiAssessment: AiAssessment | null
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
  useEffect(() => {
    const onExpired = () => navigate('/login?expired=1', { replace: true })
    window.addEventListener(SESSION_EXPIRED_EVENT, onExpired)
    return () => window.removeEventListener(SESSION_EXPIRED_EVENT, onExpired)
  }, [navigate])
  if (!getToken() || !user) return <Navigate to="/login" replace />
  return (
    <div className="shell">
      <header className="topbar">
        <Link to="/" className="brand">Academic Review Lab</Link>
        <Notifications />
        <p className="role-pill">{user.role === 'TEACHER' ? 'Instructor' : 'Student'} · {user.name}</p>
        <Link to="/account" className="ghost" data-testid="account-link">Account</Link>
        <button className="ghost" onClick={async () => { await signOut(); navigate('/login') }}>Sign out</button>
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
  const [params] = useSearchParams()
  const expired = params.has('expired')
  async function submit(event: FormEvent) {
    event.preventDefault()
    setError('')
    try {
      setToken(null)
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
        {expired && !error && <p className="notice" role="status" data-testid="session-expired">Your session ended. Sign in again.</p>}
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
  const [layer, setLayer] = useState<'annotations' | 'similarity'>('annotations')
  const [editedOptions, setEditedOptions] = useState<{ submissionId: string; value: SimilarityOptionsForm } | null>(null)
  const [recalculating, setRecalculating] = useState(false)
  const [recalcNotice, setRecalcNotice] = useState<{ submissionId: string; text: string } | null>(null)
  const similarityOptions = editedOptions?.submissionId === submissionId ? editedOptions.value : null
  const setSimilarityOptions = (value: SimilarityOptionsForm | null) => setEditedOptions(value ? { submissionId, value } : null)
  const recalcMessage = recalcNotice?.submissionId === submissionId ? recalcNotice.text : ''

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
  const pieces = useMemo(
    () => layer === 'similarity' ? renderSimilarityPieces(text, data?.submission.similarityReport ?? null) : renderPieces(text, data?.submission.annotations ?? []),
    [text, data, layer],
  )
  if (!data) return <p>Loading submission…</p>
  const submission = data.submission
  const teacher = user?.role === 'TEACHER'
  const report = submission.similarityReport
  const options = similarityOptions ?? (report ? {
    excludeQuotes: report.excludeQuotes,
    excludeBibliography: report.excludeBibliography,
    excludeSmallMatches: report.excludeSmallMatches,
    smallMatchThreshold: String(report.smallMatchThreshold),
  } : null)

  async function recalculate(event: FormEvent) {
    event.preventDefault()
    if (!options) return
    const threshold = Number(options.smallMatchThreshold)
    if (!Number.isInteger(threshold) || threshold < 1 || threshold > 200) {
      setError('Minimum match length must be a whole number from 1 to 200 words.')
      return
    }
    setRecalculating(true)
    setError('')
    try {
      const result = await api<{ aiAssessmentRefreshed: boolean }>(`/api/submissions/${submission.id}/similarity/recalculate`, {
        method: 'POST',
        body: JSON.stringify({ ...options, smallMatchThreshold: threshold }),
      })
      setSimilarityOptions(null)
      setRecalcNotice({
        submissionId: submission.id,
        text: result.aiAssessmentRefreshed
          ? 'Similarity recalculated. The paraphrase context changed, so the writing-signal assessment was rebuilt and needs a new review.'
          : 'Similarity recalculated.',
      })
      await reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not recalculate similarity')
    } finally {
      setRecalculating(false)
    }
  }

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
        {text && (
          <fieldset className="layer-toggle">
            <legend>Show in document</legend>
            <label><input type="radio" name="layer" data-testid="layer-annotations" checked={layer === 'annotations'} onChange={() => setLayer('annotations')} /> Annotations</label>
            <label><input type="radio" name="layer" data-testid="layer-similarity" checked={layer === 'similarity'} onChange={() => setLayer('similarity')} disabled={!report} /> Similarity matches and exclusions</label>
          </fieldset>
        )}
        {layer === 'similarity' && report && (
          <p className="note legend" data-testid="similarity-legend">
            <mark className="match-exact">Exact match</mark> <mark className="match-near">Near match</mark> <mark className="excluded">Excluded from matching</mark> Hover a span to see its source or exclusion reason.
          </p>
        )}
        <div ref={textRef} className="document" data-testid="document-text" onMouseUp={rememberSelection}>
          {pieces.map((piece, index) => piece.mark
            ? <mark key={index} className={MARK_CLASSES[piece.mark] ?? 'highlight'} data-mark={piece.mark} title={piece.comment || undefined}>{piece.text}</mark>
            : <span key={index}>{piece.text}</span>)}
          {!text && <p>No extracted text for this file.</p>}
        </div>
        <a data-testid="export-feedback" href="#" onClick={async (event) => {
          event.preventDefault()
          const blob = await apiBlob(`/api/submissions/${submission.id}/export`)
          const url = URL.createObjectURL(blob)
          const link = document.createElement('a')
          link.href = url
          link.download = 'feedback.pdf'
          link.click()
          URL.revokeObjectURL(url)
        }}>Download annotated feedback (PDF)</a>
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
                  <li key={source.id} data-testid="similarity-source">
                    {source.sourceName} · {source.similarityPercentage}% · {source.passages.length} passage{source.passages.length === 1 ? '' : 's'}
                    <ul className="plain">
                      {source.passages.slice(0, 3).map((passage) => (
                        <li key={passage.id} className="note">{passage.matchType === 'NEAR_MATCH' ? 'Near match' : 'Exact'}: “{passage.submissionText.length > 140 ? `${passage.submissionText.slice(0, 140)}…` : passage.submissionText}”</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              {submission.similarityReport.excludedMatches.length > 0 && (
                <p className="note" data-testid="similarity-excluded">
                  Excluded from matching: {[...new Set(submission.similarityReport.excludedMatches.map((item) => item.reason.toLowerCase()))].join(', ')}.
                </p>
              )}
              {teacher && options && (
                <form className="similarity-options" data-testid="similarity-options" onSubmit={recalculate}>
                  <h3>Matching options</h3>
                  <label className="check"><input type="checkbox" data-testid="opt-exclude-quotes" checked={options.excludeQuotes} onChange={(event) => setSimilarityOptions({ ...options, excludeQuotes: event.target.checked })} /> Exclude quotations</label>
                  <label className="check"><input type="checkbox" data-testid="opt-exclude-bibliography" checked={options.excludeBibliography} onChange={(event) => setSimilarityOptions({ ...options, excludeBibliography: event.target.checked })} /> Exclude bibliography</label>
                  <label className="check"><input type="checkbox" data-testid="opt-exclude-small" checked={options.excludeSmallMatches} onChange={(event) => setSimilarityOptions({ ...options, excludeSmallMatches: event.target.checked })} /> Exclude matches shorter than</label>
                  <label>Minimum match length (words)<input data-testid="opt-threshold" type="number" min={1} max={200} step={1} value={options.smallMatchThreshold} disabled={!options.excludeSmallMatches} onChange={(event) => setSimilarityOptions({ ...options, smallMatchThreshold: event.target.value })} /></label>
                  <button type="submit" data-testid="recalculate" disabled={recalculating}>{recalculating ? 'Recalculating…' : 'Recalculate'}</button>
                  {recalcMessage && <p className="notice" role="status" data-testid="recalc-message">{recalcMessage}</p>}
                </form>
              )}
            </>
          ) : <p>Report not ready.</p>}
        </div>
        {teacher && <AiReviewCard submissionId={submission.id} assessment={submission.aiAssessment} onSaved={reload} />}
        {error && <p className="error">{error}</p>}
      </aside>
    </section>
  )
}

const MARK_CLASSES: Record<string, string> = {
  HIGHLIGHT: 'highlight',
  UNDERLINE: 'underline',
  'match-exact': 'match-exact',
  'match-near': 'match-near',
  excluded: 'excluded',
}

const EXCLUSION_LABELS: Record<string, string> = {
  QUOTE: 'Excluded quotation',
  BIBLIOGRAPHY: 'Excluded bibliography',
  SMALL_MATCH: 'Excluded small match',
  MANUAL: 'Excluded by the teacher',
}

// Exclusions win over matches; overlapping matches from different sources are clipped, not dropped.
function renderSimilarityPieces(text: string, report: SimilarityReportView | null): Piece[] {
  if (!text) return []
  const marks: Array<{ mark: string; comment: string } | null> = new Array(text.length).fill(null)
  const paint = (start: number, end: number, mark: string, comment: string, overwrite: boolean) => {
    const from = Math.max(0, Math.min(text.length, start))
    const to = Math.max(from, Math.min(text.length, end))
    for (let i = from; i < to; i += 1) if (overwrite || !marks[i]) marks[i] = { mark, comment }
  }
  for (const source of report?.sources ?? []) {
    for (const passage of source.passages) {
      paint(passage.startPosition, passage.endPosition, passage.matchType === 'NEAR_MATCH' ? 'match-near' : 'match-exact', `${passage.matchType === 'NEAR_MATCH' ? 'Near match' : 'Exact match'}: ${source.sourceName}`, false)
    }
  }
  for (const region of report?.excludedMatches ?? []) {
    if (region.startPosition === null || region.endPosition === null) continue
    paint(region.startPosition, region.endPosition, 'excluded', EXCLUSION_LABELS[region.reason] ?? 'Excluded', true)
  }
  const pieces: Piece[] = []
  let start = 0
  for (let i = 1; i <= text.length; i += 1) {
    if (i < text.length && marks[i]?.mark === marks[start]?.mark && marks[i]?.comment === marks[start]?.comment) continue
    pieces.push({ text: text.slice(start, i), mark: marks[start]?.mark ?? null, comment: marks[start]?.comment ?? null })
    start = i
  }
  return pieces
}

function renderPieces(text: string, annotations: Annotation[]): Piece[] {
  const ranges = annotations
    .map((annotation) => annotation.anchor && annotation.anchor.kind === 'text' ? { ...(annotation.anchor as TextAnchor), type: annotation.type, comment: annotation.content } : null)
    .filter((range): range is TextAnchor & { type: string; comment: string | null } => Boolean(range))
    .sort((a, b) => a.start - b.start)
  if (!text) return []
  const pieces: Piece[] = []
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

function Account() {
  const navigate = useNavigate()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  async function changePassword(event: FormEvent) {
    event.preventDefault()
    setMessage('')
    setError('')
    if (newPassword !== confirm) {
      setError('The new passwords do not match')
      return
    }
    try {
      const result = await api<{ revokedOtherSessions: number }>('/api/auth/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      setCurrentPassword('')
      setNewPassword('')
      setConfirm('')
      setMessage(`Password changed. Signed out ${result.revokedOtherSessions} other session${result.revokedOtherSessions === 1 ? '' : 's'}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change the password')
    }
  }
  return (
    <section>
      <h1>Account</h1>
      <form className="card account-card" onSubmit={changePassword}>
        <h2>Change password</h2>
        <p>Use at least 12 characters. Avoid common passwords and your own name or email. Changing it signs out your other sessions.</p>
        <label>Current password<input data-testid="current-password" type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} autoComplete="current-password" required /></label>
        <label>New password<input data-testid="new-password" type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} autoComplete="new-password" minLength={12} maxLength={200} required /></label>
        <label>Confirm new password<input data-testid="confirm-password" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} autoComplete="new-password" required /></label>
        {error && <p className="error" role="alert">{error}</p>}
        {message && <p className="notice" role="status" data-testid="password-changed">{message}</p>}
        <button data-testid="change-password" type="submit">Change password</button>
      </form>
      <div className="card account-card">
        <h2>Sessions</h2>
        <p>Sign out on every device and browser, including this one.</p>
        <button className="danger" data-testid="sign-out-everywhere" onClick={async () => { await signOut(true); navigate('/login') }}>Sign out everywhere</button>
      </div>
    </section>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/" element={<Shell><Dashboard /></Shell>} />
        <Route path="/account" element={<Shell><Account /></Shell>} />
        <Route path="/courses/:courseId" element={<Shell><CoursePage /></Shell>} />
        <Route path="/submissions/:submissionId" element={<Shell><Review /></Shell>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
