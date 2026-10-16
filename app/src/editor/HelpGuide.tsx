import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'

const steps = [
  { title: 'Start a diagram', target: '[aria-label="New diagram"]', text: 'New diagram offers Blank or a synthetic starter: Web/API, Event-driven, Fabric or Enterprise. Choose one when you are ready to replace the current diagram.' },
  { title: 'Name your diagram', target: '[aria-label="Document title"]', text: 'Document title names the diagram. Type a title, then press Enter or leave the field to apply it.' },
  { title: 'Add components', target: '.library-search', text: 'Components lets you search and browse the library. Choose a component, then click the canvas to place it, or drag it from the library onto the canvas.' },
  { title: 'Navigate the canvas', target: '.zoom-controls', text: 'Select tool selects and moves objects; Shift-click adds to a selection. Pan tool moves the view. Use Zoom in, Zoom out, Fit diagram or Fit selection to frame your work. Undo in the top bar reverses an edit.' },
  { title: 'Connect and annotate', target: '.tool-rail [aria-label="Connect components"]', text: 'Connect components links a source to a target; you can also drag connector handles. Add boundary groups a region, Add text places a note, and Add rectangle adds a shape. Select tool returns to selection.' },
  { title: 'Edit properties', target: '.inspector .panel-heading', text: 'Properties edits the current selection: labels, types, colors, status and parent boundaries, or connection settings. With nothing selected it shows document, background and grid settings. Double-click a label to edit it on the canvas.' },
  { title: 'Arrange your diagram', target: '.canvas-toolbar', text: 'Right layout or Down layout sets the flow direction. Auto-arrange lays out components and boundaries. Undo reverses the arrangement; you can still position objects manually.' },
  { title: 'Save editable work', target: '[aria-label="Save JSON"]', text: 'Saved on this device means local browser or app storage, not a portable backup. Save JSON downloads an editable JSON copy. Open JSON loads a saved diagram; Import skill JSON accepts supported skill-generated diagrams. Keep a JSON copy for later editing or sharing.' },
  { title: 'Export artwork', target: '[aria-label="Export"]', text: 'Export opens SVG and PNG options, with whole-diagram or selection scope. SVG stays sharp when resized; PNG is a bitmap. Artwork is for documents and slides, not a substitute for editable JSON.' },
  { title: 'Present and hand off', target: '[aria-label="Present"]', text: 'Present hides editing chrome for review, with a pointer, fullscreen and Exit controls. Escape returns to editing. Hand off SVG or PNG for viewing, and JSON when the recipient needs to edit. Read-only sessions can explore this guide but cannot edit.' },
] as const

type Box = { left: number; top: number; width: number; height: number }
type Placement = { target: Box | null; left: number; top: number; maxHeight: number }

function place(target: Box | null, width: number, height: number, viewportWidth: number, viewportHeight: number): Placement {
  const margin = 12, gap = 16
  const clampLeft = (left: number) => Math.max(margin, Math.min(viewportWidth - width - margin, left))
  const clampTop = (top: number) => Math.max(margin, Math.min(viewportHeight - height - margin, top))
  const centered = { left: clampLeft((viewportWidth - width) / 2), top: clampTop((viewportHeight - height) / 2) }
  if (!target) return { target, ...centered, maxHeight: viewportHeight - margin * 2 }
  const candidates = [
    { left: clampLeft(target.left), top: target.top + target.height + gap },
    { left: clampLeft(target.left), top: target.top - height - gap },
    { left: target.left + target.width + gap, top: clampTop(target.top) },
    { left: target.left - width - gap, top: clampTop(target.top) },
  ]
  const available = candidates.find(candidate => candidate.left >= margin && candidate.top >= margin && candidate.left + width <= viewportWidth - margin && candidate.top + height <= viewportHeight - margin)
  if (available) return { target, ...available, maxHeight: viewportHeight - margin * 2 }
  const below = viewportHeight - margin - target.top - target.height - gap
  const above = target.top - gap - margin
  if (Math.max(above, below) >= 156) return { target, left: clampLeft(target.left), top: below >= above ? target.top + target.height + gap : margin, maxHeight: Math.max(above, below) }
  return { target, ...centered, maxHeight: viewportHeight - margin * 2 }
}

export function HelpGuide({ root, onReveal, onClose }: { root: RefObject<HTMLDivElement | null>; onReveal(panel: 'library' | 'inspector' | null): void; onClose(): void }) {
  const [step, setStep] = useState(0)
  const titleId = useId(), descriptionId = useId(), stepId = useId()
  const dialog = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const currentClose = useRef(onClose)
  currentClose.current = onClose
  const [placement, setPlacement] = useState<Placement>({ target: null, left: 12, top: 12, maxHeight: window.innerHeight - 24 })
  const entry = steps[step]
  function navigate(next: number) {
    setStep(next)
    onReveal(next === 2 ? 'library' : next === 5 ? 'inspector' : null)
  }

  useLayoutEffect(() => {
    close.current?.focus({ preventScroll: true })
    const keydown = (event: globalThis.KeyboardEvent) => {
      event.stopImmediatePropagation()
      if (event.isComposing || event.keyCode === 229) return
      if (event.key === 'Escape') { event.preventDefault(); currentClose.current(); return }
      if (event.key === 'Tab') {
        event.preventDefault()
        const controls = [...(dialog.current?.querySelectorAll<HTMLElement>('button:not(:disabled), [tabindex="0"]') ?? [])]
        const index = controls.indexOf(document.activeElement as HTMLElement)
        controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
      } else if (event.ctrlKey || event.metaKey || event.altKey || ['Delete', 'Backspace', 'F2'].includes(event.key)) event.preventDefault()
    }
    const focusin = (event: FocusEvent) => { if (!dialog.current?.contains(event.target as Node)) close.current?.focus({ preventScroll: true }) }
    window.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin, true)
    return () => { window.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin, true) }
  }, [])

  useLayoutEffect(() => {
    const target = root.current?.querySelector<HTMLElement>(entry.target)
    const scrollPositions = new Map<HTMLElement, { left: number; top: number }>()
    let parent = target?.parentElement
    while (parent && parent !== root.current) {
      if (parent.scrollHeight > parent.clientHeight || parent.scrollWidth > parent.clientWidth) scrollPositions.set(parent, { left: parent.scrollLeft, top: parent.scrollTop })
      parent = parent.parentElement
    }
    target?.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' })
    const measure = () => {
      const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight
      const bounds = target?.getBoundingClientRect()
      let box: Box | null = null
      if (bounds && bounds.width > 0 && bounds.height > 0 && target?.isConnected) {
        const left = Math.max(4, bounds.left), top = Math.max(4, bounds.top)
        const right = Math.min(viewportWidth - 4, bounds.right), bottom = Math.min(viewportHeight - 4, bounds.bottom)
        if (right > left && bottom > top) box = { left, top, width: right - left, height: bottom - top }
      }
      const card = dialog.current?.getBoundingClientRect()
      const next = place(box, card?.width || Math.min(352, viewportWidth - 24), Math.min(dialog.current?.scrollHeight || 268, viewportHeight - 24), viewportWidth, viewportHeight)
      setPlacement(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    measure()
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure)
    if (target) observer?.observe(target)
    if (dialog.current) observer?.observe(dialog.current)
    if (root.current) observer?.observe(root.current)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => {
      observer?.disconnect(); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true)
      for (const [element, position] of scrollPositions) { element.scrollLeft = position.left; element.scrollTop = position.top }
    }
  }, [entry, root])

  return createPortal(<div className="help-guide-overlay">
    {placement.target && <div className="help-guide-spotlight" aria-hidden="true" data-guide-target={entry.target} style={placement.target} />}
    <section ref={dialog} role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={`${stepId} ${descriptionId}`} className="help-guide" style={{ left: placement.left, top: placement.top, maxHeight: placement.maxHeight }}>
      <header><span id={titleId}>UI guide</span><button ref={close} type="button" title="Close guide" aria-label="Close guide" onClick={onClose}><X size={18} /></button></header>
      <div className="help-guide-content" role="region" aria-label="Guide step" tabIndex={0}><div id={stepId} className="help-guide-progress" aria-live="polite" aria-atomic="true"><span>{step + 1}/10</span><span>{entry.title}</span></div><h2>{entry.title}</h2><p id={descriptionId}>{entry.text}</p>{!placement.target && <p className="help-guide-unavailable">This control is not visible in the current layout. You can continue or go back.</p>}</div>
      <footer><button type="button" disabled={step === 0} onClick={() => navigate(step - 1)}><ArrowLeft size={16} />Back</button><button type="button" onClick={() => step === steps.length - 1 ? onClose() : navigate(step + 1)}>{step === steps.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}{step === steps.length - 1 ? 'Finish' : 'Next'}</button></footer>
    </section>
  </div>, document.body)
}