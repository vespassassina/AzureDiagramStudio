import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Hand, Pencil, Undo2, Redo2, Trash2 } from 'lucide-react'
import { useReactFlow, useViewport } from '@xyflow/react'
import './PresentationMarkup.css'
import { frameResizeObserver } from './resize-observer.ts'

const colors = { Red: '#ff0000', Blue: '#0000ff', Green: '#008000', Yellow: '#ffff00', Black: '#000000' }
type Point = { x: number; y: number }
type Shape = { id: number; kind: 'freehand' | 'rectangle' | 'ellipse' | 'arrow'; color: string; points: Point[] }
type InkHistory = { past: Shape[][]; present: Shape[]; future: Shape[][] }
type Gesture = { pointerId: number; target: SVGSVGElement; shape: Shape }

function MarkupButton({ label, active, disabled, onClick, children }: { label: string; active?: boolean; disabled?: boolean; onClick(): void; children: ReactNode }) {
  const tooltipId = useId()
  const [anchor, setAnchor] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const pointerFocus = useRef(false)
  useEffect(() => { setAnchor(null) }, [active, disabled])
  useEffect(() => {
    if (!anchor) return
    const hide = () => setAnchor(null)
    const keydown = (event: KeyboardEvent) => { if (['Escape', 'Enter', ' '].includes(event.key)) hide() }
    const otherTip = (event: Event) => { if ((event as CustomEvent<string>).detail !== tooltipId) hide() }
    window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide); window.addEventListener('blur', hide)
    window.addEventListener('keydown', keydown, true); document.addEventListener('pointerdown', hide, true); document.addEventListener('editor-tooltip', otherTip)
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); window.removeEventListener('blur', hide); window.removeEventListener('keydown', keydown, true); document.removeEventListener('pointerdown', hide, true); document.removeEventListener('editor-tooltip', otherTip) }
  }, [anchor, tooltipId])
  function show(button: HTMLButtonElement) {
    if (disabled) return
    document.dispatchEvent(new CustomEvent('editor-tooltip', { detail: tooltipId }))
    const bounds = button.getBoundingClientRect(), above = bounds.bottom + 48 > window.innerHeight
    setAnchor({ left: Math.max(112, Math.min(window.innerWidth - 112, bounds.left + bounds.width / 2)), top: above ? bounds.top - 8 : bounds.bottom + 8, above })
  }
  return <><button type="button" aria-label={label} aria-pressed={active} aria-describedby={anchor ? tooltipId : undefined} disabled={disabled}
    onPointerDown={() => { pointerFocus.current = true; setAnchor(null) }} onClick={() => { setAnchor(null); onClick() }}
    onFocus={event => { if (!pointerFocus.current) show(event.currentTarget) }} onBlur={() => { pointerFocus.current = false; setAnchor(null) }}
    onMouseEnter={event => show(event.currentTarget)} onMouseLeave={() => setAnchor(null)}>{children}</button>
    {anchor && createPortal(<span id={tooltipId} role="tooltip" className={`action-tooltip ${anchor.above ? 'above' : ''}`} style={{ left: anchor.left, top: anchor.top }}>{label}</span>, document.fullscreenElement ?? document.body)}
  </>
}

function hasInk(shape: Shape) {
  const start = shape.points[0], end = shape.points.at(-1)!
  if (shape.kind === 'rectangle' || shape.kind === 'ellipse') return start.x !== end.x && start.y !== end.y
  return shape.points.some(point => point.x !== start.x || point.y !== start.y)
}

function inkShape(shape: Shape, zoom: number, preview = false) {
  const start = shape.points[0], end = shape.points.at(-1)!
  const common = { key: shape.id, stroke: shape.color, strokeWidth: 6, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none', vectorEffect: 'non-scaling-stroke', 'data-markup-kind': shape.kind, 'data-markup-preview': preview ? '' : undefined, 'data-markup-committed': preview ? undefined : '' }
  const left = Math.min(start.x, end.x), top = Math.min(start.y, end.y)
  const width = Math.abs(end.x - start.x), height = Math.abs(end.y - start.y)
  if (shape.kind === 'rectangle') return <rect {...common} x={left} y={top} width={width} height={height} />
  if (shape.kind === 'ellipse') return <ellipse {...common} cx={left + width / 2} cy={top + height / 2} rx={width / 2} ry={height / 2} />
  if (shape.kind === 'freehand') return <path {...common} d={shape.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ')} />
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  const head = Math.min(16 / zoom, Math.hypot(end.x - start.x, end.y - start.y) * .65)
  const first = { x: end.x - head * Math.cos(angle - Math.PI / 6), y: end.y - head * Math.sin(angle - Math.PI / 6) }
  const second = { x: end.x - head * Math.cos(angle + Math.PI / 6), y: end.y - head * Math.sin(angle + Math.PI / 6) }
  return <path {...common} d={`M ${start.x} ${start.y} L ${end.x} ${end.y} M ${first.x} ${first.y} L ${end.x} ${end.y} L ${second.x} ${second.y}`} />
}

export function PresentationMarkup() {
  const { screenToFlowPosition } = useReactFlow()
  const viewport = useViewport()
  const [drawing, setDrawing] = useState(false)
  const [color, setColor] = useState<keyof typeof colors>('Red')
  const [history, setHistory] = useState<InkHistory>({ past: [], present: [], future: [] })
  const historyRef = useRef(history)
  const [preview, setPreview] = useState<Shape | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const nextId = useRef(0)
  const canvas = useRef<SVGSVGElement>(null)
  const toolbar = useRef<HTMLDivElement>(null)
  const mounted = useRef(true)
  const [bottom, setBottom] = useState(78)

  function updateHistory(next: InkHistory) { historyRef.current = next; setHistory(next) }
  function commit(shapes: Shape[]) {
    const current = historyRef.current
    updateHistory({ past: [...current.past, current.present], present: shapes, future: [] })
  }
  function release(active: Gesture) {
    if (active.target.hasPointerCapture?.(active.pointerId)) active.target.releasePointerCapture(active.pointerId)
  }
  function cancel() {
    const active = gesture.current
    gesture.current = null
    if (mounted.current) setPreview(null)
    if (active) release(active)
  }
  function undo() {
    cancel()
    const current = historyRef.current, previous = current.past.at(-1)
    if (previous) updateHistory({ past: current.past.slice(0, -1), present: previous, future: [current.present, ...current.future] })
  }
  function redo() {
    cancel()
    const current = historyRef.current, following = current.future[0]
    if (following) updateHistory({ past: [...current.past, current.present], present: following, future: current.future.slice(1) })
  }
  function sample(event: ReactPointerEvent<SVGSVGElement>, shape: Shape) {
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false })
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return shape
    const last = shape.points.at(-1)!
    if (point.x === last.x && point.y === last.y) return shape
    return { ...shape, points: shape.kind === 'freehand' ? [...shape.points, point] : [shape.points[0], point] }
  }
  function begin(event: ReactPointerEvent<SVGSVGElement>) {
    if (!drawing || event.button !== 0 || event.isPrimary === false || gesture.current || !mounted.current || !event.currentTarget.isConnected) return
    event.preventDefault(); event.stopPropagation()
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false })
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return
    const kind = event.ctrlKey || event.metaKey ? 'arrow' : event.altKey ? 'ellipse' : event.shiftKey ? 'rectangle' : 'freehand'
    const shape: Shape = { id: nextId.current++, kind, color: colors[color], points: [point] }
    gesture.current = { pointerId: event.pointerId, target: event.currentTarget, shape }
    event.currentTarget.focus()
    event.currentTarget.setPointerCapture(event.pointerId)
    setPreview(shape)
  }
  function move(event: ReactPointerEvent<SVGSVGElement>) {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    if (!mounted.current || !active.target.isConnected) { cancel(); return }
    active.shape = sample(event, active.shape)
    setPreview(active.shape)
  }
  function end(event: ReactPointerEvent<SVGSVGElement>) {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    event.preventDefault(); event.stopPropagation()
    gesture.current = null
    if (mounted.current && active.target.isConnected) {
      const shape = sample(event, active.shape)
      if (hasInk(shape)) commit([...historyRef.current.present, shape])
      setPreview(null)
    }
    release(active)
  }
  function interrupted(event: ReactPointerEvent<SVGSVGElement>) { if (gesture.current?.pointerId === event.pointerId) cancel() }

  useEffect(() => {
    mounted.current = true
    const blur = () => cancel()
    window.addEventListener('blur', blur)
    return () => { mounted.current = false; window.removeEventListener('blur', blur); cancel() }
  }, [])
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if (event.key === 'Escape' && gesture.current) {
        event.preventDefault(); event.stopImmediatePropagation(); cancel(); return
      }
      const ownsFocus = canvas.current === document.activeElement || toolbar.current?.contains(document.activeElement)
      if (!drawing || !ownsFocus || !(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      if (key !== 'z' && key !== 'y') return
      event.preventDefault(); event.stopImmediatePropagation()
      if (key === 'y' || event.shiftKey) redo(); else undo()
    }
    window.addEventListener('keydown', keydown, true)
    return () => window.removeEventListener('keydown', keydown, true)
  }, [drawing])
  useLayoutEffect(() => {
    const surface = canvas.current?.closest('.canvas-surface')
    const chrome = surface?.querySelector('.canvas-bottom-chrome')
    if (!surface || !chrome) return
    let previousBottom = -1
    const measure = () => {
      const next = Math.max(16, surface.getBoundingClientRect().bottom - chrome.getBoundingClientRect().top + 8)
      if (next === previousBottom) return
      previousBottom = next
      setBottom(current => current === next ? current : next)
    }
    measure()
    const observer = frameResizeObserver(measure)
    observer?.observe(surface); observer?.observe(chrome)
    window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [])

  return <>
    <svg ref={canvas} className="presentation-markup-canvas" data-testid="markup-canvas" data-drawing={drawing} tabIndex={drawing ? 0 : -1} role="img" aria-label="Temporary presentation markup" onPointerDown={begin} onPointerMove={move} onPointerUp={end} onPointerCancel={interrupted} onLostPointerCapture={interrupted} onContextMenu={event => { if (drawing) event.preventDefault() }}>
      <g transform={`translate(${viewport.x} ${viewport.y}) scale(${viewport.zoom})`}>
        {history.present.map(shape => inkShape(shape, viewport.zoom))}
        {preview && inkShape(preview, viewport.zoom, true)}
      </g>
    </svg>
    <div ref={toolbar} className="presentation-markup-toolbar" style={{ bottom }} role="toolbar" aria-label="Presentation markup" data-fit-chrome="bottom">
    <div role="group" aria-label="Markup mode">
      <MarkupButton label="Navigate" active={!drawing} onClick={() => { cancel(); setDrawing(false) }}><Hand size={18} /></MarkupButton>
      <MarkupButton label="Draw" active={drawing} onClick={() => setDrawing(true)}><Pencil size={18} /></MarkupButton>
    </div>
    <div role="group" aria-label="Markup colors">{(Object.keys(colors) as (keyof typeof colors)[]).map(name => <MarkupButton key={name} label={`${name} markup`} active={color === name} onClick={() => setColor(name)}><span className="markup-swatch" style={{ backgroundColor: colors[name] }} /></MarkupButton>)}</div>
    <div role="group" aria-label="Markup history">
      <MarkupButton label="Undo markup" disabled={!history.past.length} onClick={undo}><Undo2 size={18} /></MarkupButton>
      <MarkupButton label="Redo markup" disabled={!history.future.length} onClick={redo}><Redo2 size={18} /></MarkupButton>
      <MarkupButton label="Clear markup" disabled={!history.present.length} onClick={() => { cancel(); commit([]) }}><Trash2 size={18} /></MarkupButton>
    </div>
    </div>
  </>
}