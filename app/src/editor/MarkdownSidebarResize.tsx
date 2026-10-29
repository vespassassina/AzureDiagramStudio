import { useEffect, useRef } from 'react'

export function MarkdownSidebarResize({ width, minimum, maximum, onChange }: { width: number; minimum: number; maximum: number; onChange(width: number): void }) {
  const active = useRef<{ width: number; preview: number; x: number; pointerId: number; target: HTMLDivElement } | null>(null)
  const latestChange = useRef(onChange)
  latestChange.current = onChange
  function release(cancel: boolean) {
    const saved = active.current
    active.current = null
    if (!saved) return
    const next = cancel ? saved.width : saved.preview
    saved.target.closest<HTMLElement>('.shared-sidebar')?.style.setProperty('--sidebar-width', `${next}px`)
    saved.target.setAttribute('aria-valuenow', String(next))
    latestChange.current(next)
    if (saved.target.hasPointerCapture?.(saved.pointerId)) saved.target.releasePointerCapture(saved.pointerId)
  }
  useEffect(() => {
    const escape = (event: globalThis.KeyboardEvent) => {
      if (!active.current || event.key !== 'Escape' || event.isComposing || event.keyCode === 229) return
      event.preventDefault(); event.stopImmediatePropagation(); release(true)
    }
    window.addEventListener('keydown', escape, true)
    return () => { window.removeEventListener('keydown', escape, true); active.current = null }
  }, [])
  const clamp = (next: number) => Math.min(maximum, Math.max(minimum, next))
  return <div className="sidebar-resize" role="separator" aria-label="Resize right sidebar" aria-orientation="vertical" aria-valuemin={minimum} aria-valuemax={maximum} aria-valuenow={width} tabIndex={0} data-markdown-ui
    onPointerDown={event => {
      if (event.button !== 0 || event.isPrimary === false) return
      event.preventDefault(); event.stopPropagation()
      active.current = { width, preview: width, x: event.clientX, pointerId: event.pointerId, target: event.currentTarget }
      event.currentTarget.setPointerCapture(event.pointerId)
    }}
    onPointerMove={event => {
      const saved = active.current
      if (!saved || event.pointerId !== saved.pointerId) return
      event.preventDefault(); event.stopPropagation()
      // Preview only the panel's CSS while dragging. Re-rendering the controlled
      // graph on every move feeds its ResizeObservers back into live resizing.
      // Commit the session width once on release; Escape restores it exactly.
      saved.preview = clamp(saved.width + saved.x - event.clientX)
      saved.target.closest<HTMLElement>('.shared-sidebar')?.style.setProperty('--sidebar-width', `${saved.preview}px`)
      saved.target.setAttribute('aria-valuenow', String(saved.preview))
    }}
    onPointerUp={event => { if (event.pointerId === active.current?.pointerId) { event.stopPropagation(); release(false) } }}
    onPointerCancel={() => release(true)} onLostPointerCapture={() => release(true)}
    onKeyDown={event => {
      if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229 || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
      event.preventDefault(); event.stopPropagation()
      onChange(event.key === 'Home' ? minimum : event.key === 'End' ? maximum : clamp(width + (event.key === 'ArrowLeft' ? 1 : -1) * (event.shiftKey ? 40 : 16)))
    }} />
}