import { useState } from 'react'
import { api } from './api'

export interface AiAssessment {
  outcome: string
  consequentialUseEnabled: boolean
  humanReviewRequired: boolean
  uncertainty: string
  reasons: string[]
  limitations: string
  features: {
    score: number | null
    paraphraseSignal: { score: number | null; basis: string }
    wordCount: number
    modelVersion: string
  } | null
  evaluation: { stage: string; validated: boolean; notes: string } | null
  reviewDecision: string | null
  reviewNote: string | null
  reviewedAt: string | null
  reviewedBy: { id: string; name: string } | null
}

const DECISIONS: Array<{ value: string; label: string }> = [
  { value: 'NO_CONCERN', label: 'No concern after reading the work' },
  { value: 'DISCUSS_WITH_STUDENT', label: 'Discuss the writing process with the student' },
  { value: 'REFER_FOR_INTEGRITY_REVIEW', label: 'Refer for a separate integrity review' },
  { value: 'SIGNAL_NOT_RELIABLE', label: 'Signal not reliable for this work' },
]

const OUTCOME_LABELS: Record<string, string> = {
  INSUFFICIENT_TEXT: 'Not scored: too little text',
  UNSUPPORTED_LANGUAGE: 'Not scored: unsupported language',
  NO_NOTABLE_SIGNALS: 'No notable style signals',
  SIGNALS_FOR_REVIEW: 'Style signals for human review',
  INCONCLUSIVE: 'Inconclusive',
}

export function AiReviewCard({ submissionId, assessment, onSaved }: { submissionId: string; assessment: AiAssessment | null; onSaved: () => Promise<void> }) {
  const [decision, setDecision] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setError('')
    setSaving(true)
    try {
      await api(`/api/submissions/${submissionId}/ai-assessment/review`, { method: 'POST', body: JSON.stringify({ decision, note }) })
      setDecision('')
      setNote('')
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the review')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card warning" data-testid="ai-report">
      <h2>Writing-signal review</h2>
      <p>Experimental and not validated. Not proof of AI authorship. Students never see this panel. A teacher must read the work and record a decision.</p>
      {!assessment ? <p>Assessment not ready.</p> : (
        <>
          <p data-testid="ai-outcome"><strong>{OUTCOME_LABELS[assessment.outcome] ?? assessment.outcome}</strong></p>
          <p data-testid="ai-uncertainty">{assessment.uncertainty}</p>
          {assessment.evaluation && <p data-testid="ai-release-stage">Release stage: {assessment.evaluation.stage}{assessment.evaluation.validated ? '' : ' (release gates not met)'}</p>}
          <ul className="plain">{assessment.reasons.map((reason, index) => <li key={index}>{reason}</li>)}</ul>
          {assessment.features?.paraphraseSignal && <p className="note">Paraphrase: {assessment.features.paraphraseSignal.basis}</p>}
          <details>
            <summary>Safeguards</summary>
            <p data-testid="ai-safeguards">{assessment.limitations}</p>
          </details>
          {assessment.reviewDecision ? (
            <p data-testid="ai-review-recorded">
              Reviewed by {assessment.reviewedBy?.name ?? 'a teacher'}: <strong>{DECISIONS.find((item) => item.value === assessment.reviewDecision)?.label ?? assessment.reviewDecision}</strong>. {assessment.reviewNote}
            </p>
          ) : <p data-testid="ai-review-pending">No review recorded yet.</p>}
          <label>Review decision
            <select data-testid="ai-review-decision" value={decision} onChange={(event) => setDecision(event.target.value)}>
              <option value="">Choose a decision</option>
              {DECISIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
          </label>
          <label>Review note (required)
            <textarea data-testid="ai-review-note" maxLength={4000} value={note} onChange={(event) => setNote(event.target.value)} />
          </label>
          <button data-testid="ai-review-save" disabled={saving || !decision || note.trim().length < 10} onClick={save}>Record review</button>
          {error && <p className="error">{error}</p>}
        </>
      )}
    </div>
  )
}
