import { useState, type FormEvent } from 'react'
import { api } from './api'

export interface ThreadComment {
  id: string
  parentId: string | null
  content: string
  isDraft: boolean
  createdAt: string
  createdById: string
  createdBy: { id: string; name: string; role: string }
}

export interface ThreadAnnotation {
  id: string
  type: string
  page: number
  content: string | null
  isDraft: boolean
  anchor: { kind: string; start?: number; end?: number } | null
  createdBy: { name: string }
  comments: ThreadComment[]
}

const TYPE_LABELS: Record<string, string> = {
  HIGHLIGHT: 'Highlight',
  UNDERLINE: 'Underline',
  STRIKEOUT: 'Strikethrough',
  POINT: 'Comment',
  AREA: 'Area',
  FREE_DRAW: 'Drawing',
  FREE_TEXT: 'Text box',
}

interface Props {
  annotations: ThreadAnnotation[]
  text: string
  userId: string
  teacher: boolean
  canReply: boolean
  onChanged: () => Promise<void>
}

export function CommentThreads({ annotations, text, userId, teacher, canReply, onChanged }: Props) {
  const [error, setError] = useState('')
  async function run(action: () => Promise<unknown>): Promise<boolean> {
    setError('')
    try {
      await action()
      await onChanged()
      return true
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work')
      return false
    }
  }
  return (
    <div className="card" data-testid="feedback-threads">
      <h2>Feedback comments</h2>
      {annotations.length === 0 && <p className="note">No feedback on this submission yet.</p>}
      <ol className="threads">
        {annotations.map((annotation, index) => {
          const quote = annotation.anchor?.kind === 'text' && typeof annotation.anchor.start === 'number' && typeof annotation.anchor.end === 'number'
            ? text.slice(annotation.anchor.start, annotation.anchor.end)
            : ''
          return (
            <li key={annotation.id} className="thread" data-testid="thread" data-annotation-id={annotation.id}>
              <p className="thread-head">
                <strong>#{index + 1} {TYPE_LABELS[annotation.type] ?? annotation.type}</strong>
                {quote ? <> on “{quote.length > 80 ? `${quote.slice(0, 80)}…` : quote}”</> : annotation.anchor?.kind !== 'text' && <> on page {annotation.page}</>}
                {' · '}{annotation.createdBy.name}
                {annotation.isDraft && <span className="badge">Draft</span>}
              </p>
              {annotation.content && <p className="thread-body">{annotation.content}</p>}
              <Replies
                comments={annotation.comments}
                parentId={null}
                depth={0}
                userId={userId}
                teacher={teacher}
                canReply={canReply}
                onReply={(content, parentId) => run(() => api(`/api/annotations/${annotation.id}/comments`, { method: 'POST', body: JSON.stringify({ content, parentId }) }))}
                onDelete={(id) => run(() => api(`/api/comments/${id}`, { method: 'DELETE' }))}
              />
              <div className="button-row">
                {canReply && (
                  <ReplyForm label={`Reply to annotation ${index + 1}`} onSubmit={(content) => run(() => api(`/api/annotations/${annotation.id}/comments`, { method: 'POST', body: JSON.stringify({ content }) }))} />
                )}
                {teacher && (
                  <button type="button" className="link-button" data-testid="delete-annotation" onClick={() => {
                    if (window.confirm('Remove this annotation and its replies?')) run(() => api(`/api/annotations/${annotation.id}`, { method: 'DELETE' }))
                  }}>Remove annotation</button>
                )}
              </div>
            </li>
          )
        })}
      </ol>
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}

function Replies({ comments, parentId, depth, userId, teacher, canReply, onReply, onDelete }: {
  comments: ThreadComment[]
  parentId: string | null
  depth: number
  userId: string
  teacher: boolean
  canReply: boolean
  onReply: (content: string, parentId: string) => Promise<boolean>
  onDelete: (id: string) => Promise<boolean>
}) {
  const ids = new Set(comments.map((comment) => comment.id))
  const level = comments.filter((comment) => parentId === null
    ? !comment.parentId || !ids.has(comment.parentId)
    : comment.parentId === parentId)
  if (level.length === 0) return null
  return (
    <ul className="replies">
      {level.map((comment) => (
        <li key={comment.id} data-testid="reply">
          <p>
            <strong>{comment.createdBy.name}</strong>
            {comment.createdBy.role === 'STUDENT' ? ' (student)' : ''}
            {comment.isDraft && <span className="badge">Draft</span>}
            <span className="note"> · {new Date(comment.createdAt).toLocaleString()}</span>
          </p>
          <p className="thread-body">{comment.content}</p>
          <div className="button-row">
            {canReply && <ReplyForm label={`Reply to ${comment.createdBy.name}`} onSubmit={(content) => onReply(content, comment.id)} />}
            {(teacher || comment.createdById === userId) && (
              <button type="button" className="link-button" data-testid="delete-reply" onClick={() => {
                if (window.confirm('Delete this reply and any replies under it?')) onDelete(comment.id)
              }}>Delete</button>
            )}
          </div>
          <Replies comments={comments} parentId={comment.id} depth={depth + 1} userId={userId} teacher={teacher} canReply={canReply} onReply={onReply} onDelete={onDelete} />
        </li>
      ))}
    </ul>
  )
}

function ReplyForm({ label, onSubmit }: { label: string; onSubmit: (content: string) => Promise<boolean> }) {
  const [open, setOpen] = useState(false)
  const [content, setContent] = useState('')
  const [busy, setBusy] = useState(false)
  if (!open) return <button type="button" className="link-button" data-testid="open-reply" onClick={() => setOpen(true)}>Reply</button>
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!content.trim()) return
    setBusy(true)
    try {
      if (await onSubmit(content.trim())) {
        setContent('')
        setOpen(false)
      }
    } finally {
      setBusy(false)
    }
  }
  return (
    <form className="reply-form" onSubmit={submit}>
      <label>{label}<textarea data-testid="reply-text" value={content} maxLength={4000} onChange={(event) => setContent(event.target.value)} autoFocus /></label>
      <div className="button-row">
        <button type="submit" data-testid="send-reply" disabled={busy || !content.trim()}>Send reply</button>
        <button type="button" className="link-button" onClick={() => { setOpen(false); setContent('') }}>Cancel</button>
      </div>
    </form>
  )
}
