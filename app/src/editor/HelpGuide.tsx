import { useId, useLayoutEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { createPortal } from 'react-dom'
import { ArrowLeft, ArrowRight, Check, X } from 'lucide-react'
import { frameResizeObserver } from './resize-observer.ts'

const steps = [
  { title: 'Start a diagram', target: '[aria-label="File menu"]', text: 'The File menu contains New diagram, Load, Import skill JSON, Save and Save As. A fresh workspace opens an empty canvas with the New diagram picker; Blank is the default, so Enter or Escape keeps it empty. Choose Blank or one of eleven starters: four synthetic examples (Web/API, Event-driven, Fabric, Enterprise) and seven Microsoft Learn adaptations. Templates apply only when chosen; saved work reopens as you left it.' },
  { title: 'Name your diagram', target: '[aria-label="Document title"]', text: 'Document title names the diagram. Type a title, then press Enter or leave the field to apply it.' },
  { title: 'Add components', target: '.library-search', text: 'Add component in the drawing rail opens the library. Search and browse, then choose a component and click the canvas, or drag it onto the canvas. Star components to save them in the Favorites category on this device. The library stays open until you explicitly close it. On narrow screens, scroll the workspace between the canvas and open panels. Boundary, Text and Rectangle remain drawing-rail tools.' },
  { title: 'Navigate the canvas', target: '[aria-label="View menu"]', text: 'The View menu controls the component library, Sidebar, Properties/Markdown views, theme and Fit diagram or Fit selection. Theme is remembered on this device without changing diagram colors. Select tool selects and moves objects; Shift-click adds to a selection. Pan tool moves the view. Zoom controls remain beside the canvas. The only top action buttons are Undo, Redo, Export and Present.' },
  { title: 'Connect and annotate', target: '.tool-rail [aria-label="Connect components"]', text: 'Connect components links a source to a target. Select a connector to expose its endpoint targets, then drag endpoint handles to any point on a component or boundary border; arrow keys move a focused endpoint along its current border. Exact positions stay relative as items move or resize. Delete removes the whole selected connector, including while an endpoint is being dragged; Escape or an invalid drop restores it. Saved connector routes remain visible in the diagram and exported artwork; Reset to automatic routing removes only that connector’s saved route, not its exact attachments. Moving or resizing connected objects, reconnecting, changing attachment sides, or Auto-arrange resets routes. Drag an item fully into a boundary to make it a member; drag it fully out to remove it. Crossing or touching its current boundary edge keeps membership and expands only that boundary. Drag any boundary edge or corner directly to resize it; left/top resizing keeps contained items fixed on the canvas. Add boundary groups a region, Add text places a note, and Add rectangle adds a shape. Select tool returns to selection.' },
  { title: 'Edit properties', target: '.inspector .panel-heading', text: 'The square Sidebar button after Auto-arrange at the canvas top right opens the shared sidebar. Show properties edits labels, types, colors, status, parent boundaries or connection settings; with nothing selected it shows document, background and grid settings. Selecting an item never opens the sidebar; an already-open Properties view follows the selection without taking focus, while Markdown keeps its draft. To rename on the canvas, select one item, then click its painted title or connector label. F2 and the context-menu Edit label action remain available, including for empty labels. Background offers White, Paper, Transparent and Solid presets, named swatches, and an in-app RGB mixer with sliders, 0–255 channels and validated hex input. Grid color offers Automatic plus Lightgrey, Mediumgrey, Darkgrey, White, Black, Red, Green, Yellow, Blue, Orange, Purple and Brown; Automatic restores the contrast-aware default. The transparent checkerboard is an editor-only cue and never exports. Show Markdown opens the same architecture description with Edit and Preview modes. Switching views or reopening preserves its draft.' },
  { title: 'Arrange your diagram', target: '[aria-label="Auto-arrange"]', text: 'Open Auto-arrange beside the square Sidebar button. Choose Horizontal, Vertical, Horizontal groups stacked vertically, or Vertical groups side by side. Stacked modes align root groups and ungrouped components on one shared axis with uniform gaps; contents, including nested groups, flow in the chosen direction. Without groups they fall back to Horizontal or Vertical. Choosing a layout is one undoable edit; annotations keep their canvas positions.' },
  { title: 'Save editable work', target: '[aria-label="File menu"]', text: 'The bottom status bar is the canonical place for loading, saving, saved, ownership and error messages. Saved on this device means local browser or app storage, not a portable backup. In File, Save writes editable JSON using the current name in the configured desktop workspace; Save As chooses a destination and name, while later Save still writes the configured-workspace copy. Load opens editable JSON, and Import skill JSON accepts supported skill-generated diagrams. Desktop Recent diagrams rereads original files. Browser downloads cannot guarantee a Settings-controlled filesystem destination. Replacement actions keep their confirmation guards.' },
  { title: 'Export artwork', target: '[aria-label="Export"]', text: 'Export opens SVG and PNG options, with whole-diagram or selection scope. Include Markdown adds the committed description in a companion .md inside one ZIP. Markdown with embedded PNG instead downloads a single .md with an inline image; some viewers block data images, so the ZIP is the portable alternative. SVG stays sharp when resized; PNG is a bitmap. Document exports the whole current page as JSON, PDF or editable Visio (.vsdx). In a workbook, choose Current page or Whole workbook: the workbook ZIP holds one whole-page SVG or PNG per page in saved order with Markdown and a manifest, JSON is the complete workbook, PDF has one titled page per diagram, and Visio keeps every page with editable shapes and glued connectors. PDF needs the desktop app. Artwork is not a substitute for editable JSON.' },
  { title: 'Present and hand off', target: '[aria-label="Present"]', text: 'Present hides editing chrome for review, with a pointer, fullscreen and Exit controls. Draw adds temporary ink for discussion; it is never saved to the diagram and disappears when you leave. Escape cancels an active ink stroke or sidebar resize; otherwise it returns to editing. Hand off SVG or PNG for viewing, and JSON for editing. Read-only sessions can explore this guide but cannot edit.' },
  { title: 'Settings and integration', target: '[aria-label="Settings menu"]', text: 'The Settings menu opens Settings, Help and About. Settings chooses the desktop workspace root for future native file operations; it does not move existing work. Browser downloads still use browser destinations. Desktop MCP exposes the live document, snapshot and export options, including Markdown companions, plus get_workbook, edit_workbook and export_workbook for workbook pages with explicit page tokens; client support and permissions vary. Source builds also provide headless CLI and stdio MCP through `node scripts/headless.mjs`; it is separate from the desktop HTTP MCP and does not alter this profile. About shows version and project information. This source guide does not qualify packaged releases, native dialogs or external clients.' },
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
    const content = dialog.current?.querySelector<HTMLElement>('.help-guide-content')
    if (content) content.scrollTop = 0
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
      // Measure the scrollable content's intrinsic height, not the already
      // constrained card. Otherwise ResizeObserver alternates between a short
      // card that appears to fit and an unconstrained card below the viewport.
      const naturalHeight = dialog.current ? [...dialog.current.children].reduce((height, child) => height + child.scrollHeight, 2) : 0
      const next = place(box, card?.width || Math.min(352, viewportWidth - 24), Math.min(naturalHeight > 2 ? naturalHeight : 268, viewportHeight - 24), viewportWidth, viewportHeight)
      setPlacement(current => JSON.stringify(current) === JSON.stringify(next) ? current : next)
    }
    measure()
    const observer = frameResizeObserver(measure)
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
      <div className="help-guide-content" role="region" aria-label="Guide step" tabIndex={0}><div id={stepId} className="help-guide-progress" aria-live="polite" aria-atomic="true"><span>{step + 1}/{steps.length}</span><span>{entry.title}</span></div><h2>{entry.title}</h2><p id={descriptionId}>{entry.text}</p>{!placement.target && <p className="help-guide-unavailable">This control is not visible in the current layout. You can continue or go back.</p>}</div>
      <footer><button type="button" disabled={step === 0} onClick={() => navigate(step - 1)}><ArrowLeft size={16} />Back</button><button type="button" onClick={() => step === steps.length - 1 ? onClose() : navigate(step + 1)}>{step === steps.length - 1 ? <Check size={16} /> : <ArrowRight size={16} />}{step === steps.length - 1 ? 'Finish' : 'Next'}</button></footer>
    </section>
  </div>, document.body)
}