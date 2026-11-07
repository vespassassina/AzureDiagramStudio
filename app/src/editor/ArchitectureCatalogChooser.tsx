import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Bot, Boxes, BrainCircuit, ChevronDown, Database, GitBranch, HeartPulse, Network, RadioTower, SearchCheck, ShieldCheck, SlidersHorizontal, X } from 'lucide-react'
import { MarkdownPreview } from './MarkdownDescription.tsx'
import type { StarterChoice } from '../app/starters.ts'
import type { ArchitectureCatalogChoice } from '../app/architecture-catalog.ts'
import { architectureCategories, searchArchitectureCatalog } from '../app/architecture-catalog.ts'
import { starterDocument } from '../app/session.ts'
import { buildScene, connectionMarkup, entityMarkup, MARKERS } from '../scene.ts'
import { visualAssets } from '../assets.ts'
import './ArchitectureCatalogChooser.css'

export type CatalogStarterChoice = StarterChoice | ArchitectureCatalogChoice
const isArchitecture = (choice: CatalogStarterChoice): choice is ArchitectureCatalogChoice => choice.sourceCue === 'Architecture catalog'

function CatalogPreview({ choice, zoom, viewport }: { choice: CatalogStarterChoice; zoom: number; viewport: { width: number; height: number } }) {
  const scene = buildScene(starterDocument(choice.key))
  const width = Math.max(1, scene.contentBounds.width), height = Math.max(1, scene.contentBounds.height)
  const scaledWidth = width * zoom, scaledHeight = height * zoom
  const left = Math.max(16, (viewport.width - scaledWidth) / 2)
  const top = Math.max(16, (viewport.height - scaledHeight) / 2)
  return <div className="architecture-catalog-preview-canvas" style={{ width: `${Math.max(viewport.width, scaledWidth + 32)}px`, height: `${Math.max(viewport.height, scaledHeight + 32)}px` }}>
    <svg className="architecture-catalog-preview" style={{ width: `${scaledWidth}px`, height: `${scaledHeight}px`, left: `${left}px`, top: `${top}px` }} viewBox={`${scene.contentBounds.x} ${scene.contentBounds.y} ${width} ${height}`} aria-label={`${choice.label} diagram preview at ${Math.round(zoom * 100)} percent`} role="img">
    <defs dangerouslySetInnerHTML={{ __html: MARKERS }} />
    {scene.entities.filter(entity => entity.kind === 'boundary').map(entity => <g key={entity.id} transform={`translate(${entity.absolute.x} ${entity.absolute.y})`} dangerouslySetInnerHTML={{ __html: entityMarkup(entity, visualAssets, scene.entityBackgrounds[entity.id]) }} />)}
    {scene.connections.map(connection => <g key={connection.id} data-preview-connection={connection.id} dangerouslySetInnerHTML={{ __html: connectionMarkup(connection, scene.connectionBackgrounds[connection.id]) }} />)}
    {scene.entities.filter(entity => entity.kind !== 'boundary').map(entity => <g key={entity.id} transform={`translate(${entity.absolute.x} ${entity.absolute.y})`} dangerouslySetInnerHTML={{ __html: entityMarkup(entity, visualAssets, scene.entityBackgrounds[entity.id]) }} />)}
    </svg>
  </div>
}

function focusable(dialog: HTMLElement) {
  return [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])')]
    .filter(element => !element.hasAttribute('hidden') && element.getAttribute('aria-hidden') !== 'true')
}

const categoryIcons = {
  'AI and search': SearchCheck,
  'AI and machine learning': BrainCircuit,
  'Applications and APIs': Network,
  'Applications and platforms': Boxes,
  'Data and analytics': Database,
  'Data integration': GitBranch,
  'Hybrid and edge': RadioTower,
  'Integration and event processing': SlidersHorizontal,
  'IoT and edge': Bot,
  'Operations and observability': HeartPulse,
  'Resilience and recovery': HeartPulse,
  'SaaS and multitenancy': Boxes,
  'Security and data access': ShieldCheck,
} as const

// Pseudocode:
//   1. retain selection locally so catalog browsing never mutates the workbook
//   2. filter hierarchy from the optional query and preserve a visible selected item
//   3. trap Tab inside every interactive control, while leaving text-input arrows native
//   4. commit only from Add Diagram; Close and Escape return without a choice
export function ArchitectureCatalogChooser({ choices, adding, onChoose, onCancel }: {
  choices: readonly CatalogStarterChoice[]
  adding: boolean
  onChoose(choice: CatalogStarterChoice | null): void
  onCancel(): void
}) {
  const titleId = useId()
  const dialog = useRef<HTMLElement>(null)
  const close = useRef<HTMLButtonElement>(null)
  const previewViewport = useRef<HTMLDivElement>(null)
  const previewPan = useRef<{ pointerId: number; x: number; y: number; left: number; top: number } | null>(null)
  const dialogPosition = useRef({ x: 0, y: 0 })
  const dialogDrag = useRef<{ pointerId: number; x: number; y: number } | null>(null)
  const [query, setQuery] = useState('')
  const architectureChoices = choices.filter(isArchitecture)
  const [expanded, setExpanded] = useState(() => new Set<string>(architectureChoices.length ? [architectureChoices[0].categoryPath[0]] : []))
  const [existingOpen, setExistingOpen] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [zoomMode, setZoomMode] = useState<'fit' | 'manual'>('fit')
  const [viewport, setViewport] = useState({ width: 0, height: 0 })
  const [dialogOffset, setDialogOffset] = useState({ x: 0, y: 0 })
  // First-run initialization preserves the established blank default. Explicit
  // Add Diagram opens on a concrete researched architecture for browsing.
  const [selectedKey, setSelectedKey] = useState<string>(() => adding ? architectureChoices[0]?.key ?? 'blank' : 'blank')
  const matchingArchitectures = useMemo(() => searchArchitectureCatalog(architectureChoices, query), [architectureChoices, query])
  const matchingKeys = new Set(matchingArchitectures.map(choice => choice.key))
  const existingChoices = choices.filter(choice => !isArchitecture(choice) && (!query || `${choice.label}\n${choice.sourceCue}`.toLocaleLowerCase('en').includes(query.trim().toLocaleLowerCase('en'))))
  const categories = useMemo(() => architectureCategories(matchingArchitectures), [matchingArchitectures])
  const selected = selectedKey === 'blank' ? null : choices.find(choice => choice.key === selectedKey) ?? null
  const selectedVisible = selected === null || (!isArchitecture(selected) ? existingChoices.some(choice => choice.key === selected.key) : matchingKeys.has(selected.key))
  const previewedKey = useRef(selectedKey)
  const previewScene = useMemo(() => selected ? buildScene(starterDocument(selected.key)) : null, [selected])
  const fitZoom = previewScene
    ? Math.max(.1, Math.min(2, (viewport.width - 32) / Math.max(1, previewScene.contentBounds.width), (viewport.height - 32) / Math.max(1, previewScene.contentBounds.height)))
    : 1
  const effectiveZoom = zoomMode === 'fit' ? fitZoom : zoom

  useLayoutEffect(() => {
    const blank = dialog.current?.querySelector<HTMLButtonElement>('[aria-label="Blank"]')
    ;(adding ? close.current : blank)?.focus({ preventScroll: true })
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (event.isComposing || event.keyCode === 229) return
      if (!dialog.current?.contains(event.target as Node)) return
      const editing = event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement
      if (editing && event.key !== 'Escape' && event.key !== 'Tab') return
      event.stopImmediatePropagation()
      if (event.key === 'Escape') { event.preventDefault(); onCancel(); return }
      if (event.key !== 'Tab') return
      const controls = focusable(dialog.current)
      const index = controls.indexOf(document.activeElement as HTMLElement)
      event.preventDefault()
      controls[(index + (event.shiftKey ? -1 : 1) + controls.length) % controls.length]?.focus()
    }
    const focusin = (event: FocusEvent) => {
      if (dialog.current && !dialog.current.contains(event.target as Node)) close.current?.focus({ preventScroll: true })
    }
    window.addEventListener('keydown', keydown, true)
    document.addEventListener('focusin', focusin, true)
    return () => { window.removeEventListener('keydown', keydown, true); document.removeEventListener('focusin', focusin, true) }
  }, [onCancel])

  useLayoutEffect(() => {
    const element = previewViewport.current
    if (!element) return
    const measure = () => setViewport({ width: element.clientWidth, height: element.clientHeight })
    measure()
    // Reserve a settled frame after preview content establishes its scrollbars.
    // The second frame keeps Fit centered on first open/template selection.
    const firstFrame = requestAnimationFrame(() => requestAnimationFrame(measure))
    if (typeof ResizeObserver === 'undefined') return () => cancelAnimationFrame(firstFrame)
    const observer = new ResizeObserver(measure)
    observer.observe(element)
    return () => { cancelAnimationFrame(firstFrame); observer.disconnect() }
  }, [selectedKey])

  useLayoutEffect(() => {
    const clampDialog = () => {
      const element = dialog.current
      if (!element) return
      const bounds = element.getBoundingClientRect()
      const next = {
        x: dialogPosition.current.x + Math.max(12 - bounds.left, Math.min(window.innerWidth - 12 - bounds.right, 0)),
        y: dialogPosition.current.y + Math.max(12 - bounds.top, Math.min(window.innerHeight - 12 - bounds.bottom, 0)),
      }
      if (next.x !== dialogPosition.current.x || next.y !== dialogPosition.current.y) {
        dialogPosition.current = next
        setDialogOffset(next)
      }
    }
    window.addEventListener('resize', clampDialog)
    return () => window.removeEventListener('resize', clampDialog)
  }, [])

  useLayoutEffect(() => {
    if (!selectedVisible) setSelectedKey('blank')
  }, [selectedVisible])

  useLayoutEffect(() => {
    if (previewedKey.current === selectedKey) return
    previewedKey.current = selectedKey
    setZoom(1)
    setZoomMode('fit')
    if (previewViewport.current) {
      previewViewport.current.scrollLeft = 0
      previewViewport.current.scrollTop = 0
    }
  }, [selectedKey])

  const setPreviewZoom = (value: number) => {
    setZoomMode('manual')
    setZoom(value)
    if (previewViewport.current) {
      previewViewport.current.scrollLeft = 0
      previewViewport.current.scrollTop = 0
    }
  }

  function fitPreview() {
    setZoomMode('fit')
    if (previewViewport.current) {
      previewViewport.current.scrollLeft = 0
      previewViewport.current.scrollTop = 0
    }
  }

  function startPreviewPan(event: React.PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !(event.target as Element).closest('.architecture-catalog-preview-canvas')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    previewPan.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop }
  }
  function movePreviewPan(event: React.PointerEvent<HTMLDivElement>) {
    const pan = previewPan.current
    if (!pan || pan.pointerId !== event.pointerId) return
    event.currentTarget.scrollLeft = pan.left - (event.clientX - pan.x)
    event.currentTarget.scrollTop = pan.top - (event.clientY - pan.y)
  }
  function stopPreviewPan(event: React.PointerEvent<HTMLDivElement>) {
    if (previewPan.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    previewPan.current = null
  }

  function startDialogDrag(event: React.PointerEvent<HTMLElement>) {
    if (event.button !== 0 || (event.target as Element).closest('button, input, a')) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dialogDrag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY }
  }
  function moveDialogDrag(event: React.PointerEvent<HTMLElement>) {
    const drag = dialogDrag.current
    const element = dialog.current
    if (!drag || drag.pointerId !== event.pointerId || !element) return
    const bounds = element.getBoundingClientRect()
    const next = {
      x: dialogPosition.current.x + event.clientX - drag.x,
      y: dialogPosition.current.y + event.clientY - drag.y,
    }
    next.x += Math.max(12 - (bounds.left + next.x - dialogPosition.current.x), Math.min(window.innerWidth - 12 - (bounds.right + next.x - dialogPosition.current.x), 0))
    next.y += Math.max(12 - (bounds.top + next.y - dialogPosition.current.y), Math.min(window.innerHeight - 12 - (bounds.bottom + next.y - dialogPosition.current.y), 0))
    drag.x = event.clientX
    drag.y = event.clientY
    dialogPosition.current = next
    setDialogOffset(next)
  }
  function stopDialogDrag(event: React.PointerEvent<HTMLElement>) {
    if (dialogDrag.current?.pointerId !== event.pointerId) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    dialogDrag.current = null
  }

  return <div className="architecture-catalog-overlay">
    <button type="button" className="starter-backdrop architecture-catalog-backdrop" tabIndex={-1} aria-label="Dismiss Add diagram choices" onClick={onCancel} />
    <section ref={dialog} className="architecture-catalog-dialog" style={{ transform: `translate(${dialogOffset.x}px, ${dialogOffset.y}px)` }} role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header className={`architecture-catalog-header${dialogDrag.current ? ' dragging' : ''}`} onPointerDown={startDialogDrag} onPointerMove={moveDialogDrag} onPointerUp={stopDialogDrag} onPointerCancel={stopDialogDrag}>
        <div><h2 id={titleId}>Add diagram</h2></div>
        <button ref={close} type="button" aria-label="Close Add diagram" title="Close Add diagram" onClick={onCancel}><X size={18} /></button>
      </header>
      <div className="architecture-catalog-layout">
        <nav className="architecture-catalog-nav" aria-label="Architecture categories">
          <label className="architecture-catalog-search"><span>Search catalog</span><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Title, category, or origin" /></label>
          <button type="button" aria-label="Blank" className={selectedKey === 'blank' ? 'selected' : ''} aria-current={selectedKey === 'blank' ? 'true' : undefined} onClick={() => setSelectedKey('blank')}>Blank <small>{adding ? 'Empty page' : 'Empty diagram'}</small></button>
          {categories.map(category => {
            const open = expanded.has(category.name) || !!query
            const CategoryIcon = categoryIcons[category.name as keyof typeof categoryIcons] ?? Boxes
            return <section key={category.name} className="architecture-catalog-section">
              <button type="button" className="architecture-catalog-category" aria-expanded={open} onClick={() => setExpanded(current => {
                const next = new Set(current); if (next.has(category.name)) next.delete(category.name); else next.add(category.name); return next
              })}><CategoryIcon size={15} aria-hidden="true" /><span>{category.name}</span><ChevronDown size={15} className={open ? 'open' : ''} aria-hidden="true" /></button>
              {open && category.subcategories.map(subcategory => <div key={subcategory.name} className="architecture-catalog-subcategory"><h4>{subcategory.name}</h4>{subcategory.entries.map(choice => <button key={choice.key} type="button" className={selectedKey === choice.key ? 'selected' : ''} aria-current={selectedKey === choice.key ? 'true' : undefined} onClick={() => setSelectedKey(choice.key)}>{choice.label}<small>{choice.origin}</small></button>)}</div>)}
            </section>
          })}
          {existingChoices.length > 0 && <section className="architecture-catalog-section">
            <button type="button" className="architecture-catalog-category" aria-expanded={existingOpen || !!query} onClick={() => setExistingOpen(open => !open)}><Boxes size={15} aria-hidden="true" /><span>Existing starters</span><ChevronDown size={15} className={existingOpen || !!query ? 'open' : ''} aria-hidden="true" /></button>
            {(existingOpen || !!query) && existingChoices.map(choice => <button key={choice.key} type="button" className={selectedKey === choice.key ? 'selected' : ''} aria-current={selectedKey === choice.key ? 'true' : undefined} onClick={() => setSelectedKey(choice.key)}>{choice.label}<small>{choice.sourceCue}</small></button>)}
          </section>}
          {!existingChoices.length && !categories.length && <p className="architecture-catalog-empty" role="status">No architectures match “{query}”. Clear or revise the search to browse the catalog.</p>}
        </nav>
        <main className="architecture-catalog-detail">
          {selected === null
            ? <div className="architecture-catalog-blank"><h3>Blank diagram</h3><p>{adding ? 'Add an empty page to the current workbook.' : 'Start a new empty editable diagram.'}</p></div>
            : <><div className="architecture-catalog-summary"><div><h3>{selected.label}</h3>{isArchitecture(selected) && <p><span className="architecture-origin">{selected.origin} origin</span> Reviewed {selected.reviewedOn}</p>}<p>{isArchitecture(selected) ? selected.summary : selected.sourceCue}</p></div>{isArchitecture(selected) && <a href={selected.reference} target="_blank" rel="noopener noreferrer">Open primary source</a>}</div><div className="architecture-catalog-zoom" role="group" aria-label="Diagram preview zoom"><button type="button" aria-label="Zoom out" disabled={effectiveZoom <= 0.25} onClick={() => setPreviewZoom(Math.max(0.25, effectiveZoom - 0.25))}>−</button><button type="button" aria-label="Reset preview zoom" onClick={() => setPreviewZoom(1)}>100%</button><button type="button" aria-label="Fit overview" aria-pressed={zoomMode === 'fit'} onClick={fitPreview}>Fit</button><button type="button" aria-label="Zoom in" disabled={effectiveZoom >= 2} onClick={() => setPreviewZoom(Math.min(2, effectiveZoom + 0.25))}>+</button></div><div ref={previewViewport} className="architecture-catalog-preview-viewport" tabIndex={0} role="region" aria-label="Scrollable diagram preview" onPointerDown={startPreviewPan} onPointerMove={movePreviewPan} onPointerUp={stopPreviewPan} onPointerCancel={stopPreviewPan} onLostPointerCapture={stopPreviewPan}><CatalogPreview choice={selected} zoom={effectiveZoom} viewport={viewport} /></div><div className="architecture-catalog-guide"><MarkdownPreview source={starterDocument(selected.key).description ?? ''} /></div>{isArchitecture(selected) && <aside className="architecture-catalog-caveats" aria-label="Architecture caveats"><h4>Adaptation caveats</h4><ul>{selected.caveats.map(caveat => <li key={caveat}>{caveat}</li>)}</ul></aside>}</>}
        </main>
      </div>
      <footer className="architecture-catalog-actions"><button type="button" onClick={onCancel}>Cancel</button><button type="button" className="primary" onClick={() => onChoose(selected)}>Add Diagram</button></footer>
    </section>
  </div>
}
