import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { api, apiBlob } from './api'

export interface PageAnnotation {
  id: string
  type: string
  page: number
  x: number
  y: number
  width: number | null
  height: number | null
  color: string | null
  strokeData: string | null
  content: string | null
  anchor: { kind: string } | null
}

type Point = { x: number; y: number }
type Tool = 'AREA' | 'FREE_DRAW'

const MAX_POINTS = 5000

function parseStrokes(strokeData: string | null): Point[][] {
  try {
    const parsed = JSON.parse(strokeData ?? '[]') as Point[][]
    return Array.isArray(parsed) ? parsed.filter(Array.isArray) : []
  } catch {
    return []
  }
}

const countPoints = (strokes: Point[][]) => strokes.reduce((sum, stroke) => sum + stroke.length, 0)

const polyline = (points: Point[]) => points.map((point) => `${point.x},${point.y}`).join(' ')

function isPageAnnotation(annotation: { type: string; anchor: { kind: string } | null; width: number | null }): boolean {
  return annotation.type === 'FREE_DRAW' || (annotation.anchor?.kind !== 'text' && annotation.type === 'AREA' && annotation.width !== null)
}

interface Props {
  submissionId: string
  documentId: string
  pages: number
  annotations: PageAnnotation[]
  teacher: boolean
  comment: string
  onSaved: () => Promise<void>
}

export function PageMarkup({ submissionId, documentId, pages, annotations, teacher, comment, onSaved }: Props) {
  const [page, setPage] = useState(1)
  const [loaded, setLoaded] = useState<{ key: string; url: string | null; error: string } | null>(null)
  const [tool, setTool] = useState<Tool>('AREA')
  const [area, setArea] = useState<{ from: Point; to: Point } | null>(null)
  const [strokes, setStrokes] = useState<Point[][]>([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const drawing = useRef(false)
  const svgRef = useRef<SVGSVGElement>(null)

  const pageKey = `${documentId}:${page}`
  const image = loaded?.key === pageKey ? loaded.url : null
  const loadError = loaded?.key === pageKey ? loaded.error : ''

  useEffect(() => {
    let url = ''
    let cancelled = false
    apiBlob(`/api/documents/${documentId}/pages/${page}`).then((blob) => {
      if (cancelled) return
      url = URL.createObjectURL(blob)
      setLoaded({ key: `${documentId}:${page}`, url, error: '' })
    }).catch(() => { if (!cancelled) setLoaded({ key: `${documentId}:${page}`, url: null, error: 'This page could not be shown.' }) })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
    }
  }, [documentId, page])

  function discard() {
    setArea(null)
    setStrokes([])
  }

  function confirmDiscard(): boolean {
    if (!pending) return true
    if (!window.confirm('Discard the unsaved markup on this page?')) return false
    discard()
    return true
  }

  function toPoint(event: PointerEvent<SVGSVGElement>): Point {
    const rect = svgRef.current!.getBoundingClientRect()
    const clamp = (value: number) => Math.round(Math.max(0, Math.min(100, value)) * 100) / 100
    return { x: clamp(((event.clientX - rect.left) / rect.width) * 100), y: clamp(((event.clientY - rect.top) / rect.height) * 100) }
  }

  const pointCount = countPoints(strokes)

  function down(event: PointerEvent<SVGSVGElement>) {
    if (!teacher || !event.isPrimary || event.button !== 0) return
    event.preventDefault()
    svgRef.current?.setPointerCapture?.(event.pointerId)
    drawing.current = true
    const point = toPoint(event)
    if (tool === 'AREA') setArea({ from: point, to: point })
    else setStrokes((current) => current.length < 50 && countPoints(current) < MAX_POINTS ? [...current, [point]] : current)
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drawing.current || !event.isPrimary) return
    const point = toPoint(event)
    if (tool === 'AREA') {
      setArea((current) => current && { ...current, to: point })
      return
    }
    setStrokes((current) => {
      const last = current[current.length - 1]
      if (!last || countPoints(current) >= MAX_POINTS) return current
      const previous = last[last.length - 1]
      if (Math.hypot(point.x - previous.x, point.y - previous.y) < 0.4) return current
      return [...current.slice(0, -1), [...last, point]]
    })
  }

  function up() {
    drawing.current = false
  }

  const box = area && {
    x: Math.min(area.from.x, area.to.x),
    y: Math.min(area.from.y, area.to.y),
    width: Math.abs(area.to.x - area.from.x),
    height: Math.abs(area.to.y - area.from.y),
  }
  const pending = tool === 'AREA' ? Boolean(box && box.width >= 0.5 && box.height >= 0.5) : strokes.length > 0

  async function save() {
    setError('')
    setSaving(true)
    try {
      const content = comment.trim() || undefined
      const body = tool === 'AREA'
        ? { type: 'AREA', page, ...box, content, color: '#c0392b' }
        : { type: 'FREE_DRAW', page, strokeData: JSON.stringify(strokes), content, color: '#c0392b' }
      await api(`/api/submissions/${submissionId}/annotations`, { method: 'POST', body: JSON.stringify(body) })
      discard()
      await onSaved()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the markup')
    } finally {
      setSaving(false)
    }
  }

  const onPage = annotations.filter((annotation) => annotation.page === page && isPageAnnotation(annotation))

  return (
    <div className="page-markup" data-testid="page-markup">
      <div className="page-toolbar">
        {pages > 1 && (
          <label>Page
            <select data-testid="markup-page" value={page} onChange={(event) => { if (confirmDiscard()) setPage(Number(event.target.value)) }}>
              {Array.from({ length: pages }, (_, index) => <option key={index + 1} value={index + 1}>{index + 1} of {pages}</option>)}
            </select>
          </label>
        )}
        {teacher && (
          <fieldset className="layer-toggle">
            <legend>Draw on the page</legend>
            <label><input type="radio" name="markup-tool" data-testid="tool-area" checked={tool === 'AREA'} onChange={() => { if (confirmDiscard()) setTool('AREA') }} /> Area box</label>
            <label><input type="radio" name="markup-tool" data-testid="tool-freehand" checked={tool === 'FREE_DRAW'} onChange={() => { if (confirmDiscard()) setTool('FREE_DRAW') }} /> Freehand</label>
          </fieldset>
        )}
      </div>
      <div className="page-stage">
        {image && <img src={image} alt={`Page ${page} of the submission`} className="page-image" draggable={false} />}
        {!image && !loadError && <p className="note">Rendering page…</p>}
        {loadError && <p className="error">{loadError}</p>}
        {image && (
          <svg
            ref={svgRef}
            className={teacher ? 'page-overlay drawable' : 'page-overlay'}
            data-testid="page-overlay"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            role="img"
            aria-label={`${onPage.length} markup${onPage.length === 1 ? '' : 's'} on page ${page}`}
          >
            {onPage.map((annotation) => annotation.type === 'FREE_DRAW'
              ? (
                <g key={annotation.id} data-testid="saved-drawing" stroke={annotation.color ?? '#c0392b'}>
                  <title>{annotation.content || 'Drawing'}</title>
                  {parseStrokes(annotation.strokeData).map((stroke, index) => <polyline key={index} points={polyline(stroke)} fill="none" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
                </g>
              )
              : (
                <rect key={annotation.id} data-testid="saved-area" x={annotation.x} y={annotation.y} width={annotation.width ?? 0} height={annotation.height ?? 0} fill="none" stroke={annotation.color ?? '#c0392b'} strokeWidth={2} vectorEffect="non-scaling-stroke">
                  <title>{annotation.content || 'Area'}</title>
                </rect>
              ))}
            {box && tool === 'AREA' && <rect className="pending" {...box} fill="rgba(192,57,43,0.12)" stroke="#c0392b" strokeDasharray="4 3" strokeWidth={2} vectorEffect="non-scaling-stroke" />}
            {tool === 'FREE_DRAW' && strokes.map((stroke, index) => <polyline key={index} className="pending" points={polyline(stroke)} fill="none" stroke="#c0392b" strokeWidth={2} vectorEffect="non-scaling-stroke" />)}
          </svg>
        )}
      </div>
      {teacher && (
        <div className="button-row">
          <button type="button" data-testid="save-markup" disabled={!pending || saving} onClick={save}>{saving ? 'Saving…' : tool === 'AREA' ? 'Save area comment' : 'Save drawing'}</button>
          <button type="button" className="link-button" disabled={!pending} onClick={discard}>Clear</button>
          <span className="note">{tool === 'AREA' ? 'Drag to draw a box.' : `Draw one or more strokes, then save. ${pointCount} of ${MAX_POINTS} points.`} Uses the annotation comment above.</span>
        </div>
      )}
      {error && <p className="error" role="alert">{error}</p>}
    </div>
  )
}
