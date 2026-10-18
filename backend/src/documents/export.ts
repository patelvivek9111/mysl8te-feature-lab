import type { submissionDetail } from '../routes/submissions';

type Detail = ReturnType<typeof submissionDetail>;

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const TYPE_LABELS: Record<string, string> = {
  point: 'Point comment', highlight: 'Highlight', strikeout: 'Strikeout', area: 'Area comment', freedraw: 'Drawing', freetext: 'Text box',
};

/** Self-contained, script-free HTML report of the feedback visible to the requesting user. */
export function renderFeedbackExport(d: Detail): string {
  const g = d.grade;
  const rubricRows = d.rubric && g
    ? d.rubric.criteria.map((c) => {
      const s = (g.rubricScores as Record<string, { points: number; ratingId?: string; comment?: string }>)[c.id];
      const rating = s?.ratingId ? c.ratings.find((r) => r.id === s.ratingId)?.label : '';
      return `<tr><td>${esc(c.description)}</td><td>${esc(rating)}</td><td>${s ? esc(s.points) : '&mdash;'} / ${esc(c.points)}</td><td>${esc(s?.comment)}</td></tr>`;
    }).join('')
    : '';
  const annotations = d.annotations.map((a, i) => `
    <li><strong>#${i + 1} ${esc(TYPE_LABELS[a.type] ?? a.type)}</strong> &middot; page ${esc(a.page)} &middot; ${esc(a.authorName)}${a.published ? '' : ' <em>(draft)</em>'}
      ${a.content ? `<p>${esc(a.content)}</p>` : ''}
      ${a.replies.length ? `<ul>${(a.replies as { authorName: string; body: string }[]).map((r) => `<li>${esc(r.authorName)}: ${esc(r.body)}</li>`).join('')}</ul>` : ''}
    </li>`).join('');
  const comments = d.comments.map((c) => `<li><strong>${esc(c.authorName)}</strong>${c.published ? '' : ' <em>(draft)</em>'}: ${esc(c.body)}</li>`).join('');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Feedback: ${esc(d.assignment.title)}</title>
<style>body{font-family:system-ui,sans-serif;max-width:860px;margin:2rem auto;padding:0 1rem;color:#1a1a1a;line-height:1.5}
table{border-collapse:collapse;width:100%}td,th{border:1px solid #ccc;padding:.4rem;text-align:left;vertical-align:top}
.doc{white-space:pre-wrap;border:1px solid #ddd;padding:1rem;background:#fafafa}h1{font-size:1.5rem}</style></head>
<body>
<h1>${esc(d.assignment.title)}</h1>
<p>Student: ${esc((d.student as { name: string }).name)} &middot; Attempt ${esc(d.submission.attempt)} &middot; Submitted ${esc(d.submission.submittedAt)} &middot; File: ${esc(d.document.fileName)}</p>
<h2>Grade</h2>
${g ? `<p><strong>${esc(g.score ?? '—')} / ${esc(d.assignment.pointsPossible)}</strong> (${esc(g.status)})</p>${g.feedback ? `<p>${esc(g.feedback)}</p>` : ''}` : '<p>No grade has been released.</p>'}
${rubricRows ? `<h2>Rubric</h2><table><thead><tr><th>Criterion</th><th>Rating</th><th>Points</th><th>Comment</th></tr></thead><tbody>${rubricRows}</tbody></table>` : ''}
<h2>Annotations (${d.annotations.length})</h2>${annotations ? `<ol>${annotations}</ol>` : '<p>None.</p>'}
<h2>Comments (${d.comments.length})</h2>${comments ? `<ul>${comments}</ul>` : '<p>None.</p>'}
<h2>Submitted text</h2><div class="doc">${esc(d.document.text || '(No extractable text)')}</div>
</body></html>`;
}
