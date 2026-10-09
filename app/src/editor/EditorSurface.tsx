import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode, ChangeEvent, KeyboardEvent } from 'react'
import { ReactFlow, Background, BackgroundVariant, ConnectionMode, Handle, Position, NodeResizer, useReactFlow } from '@xyflow/react'
import type { Node, NodeProps, Edge, EdgeProps, NodeChange, Connection as FlowConnection } from '@xyflow/react'
import { Workflow, MousePointer2, Hand, Boxes, Cable, Frame, Type, Square, Trash2, Copy, ClipboardPaste, Scissors, CopyPlus, Undo2, Redo2, Download, ChevronDown, X, Plus, Minus, Maximize2, PanelRight, PanelLeftClose, LayoutGrid, FilePlus2, FolderOpen, FileInput, Save, ArrowRight, ArrowDown, SlidersHorizontal, CircleCheck, LoaderCircle, Group, Ungroup, BringToFront, SendToBack, ImagePlus } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ClipboardFragment, DocumentCommand, EditorProps, EntityPatch, ConnectionPatch, MetadataPatch } from '../contracts.ts'
import type { ConnectionSide, Diagram, Entity, Point } from '../model.ts'
import { buildScene, entityMarkup, connectionMarkup, MARKERS } from '../scene.ts'
import type { SceneConnection } from '../scene.ts'
import { COLORS, genericLibrary, isColorKey, resolveColor } from '../catalog.ts'
import { visualAssets } from '../assets.ts'
import { canConnect, captureFragment, DROP_TYPE, freshIdMap, groupCommand, libraryItems, makeEntity, minimumSize, movePositions, nudgeCommand, parentChoices, previewDocument, readDrop, selectionRoots, sideAtPoint, sides } from './interactions.ts'
import type { LibraryItem, Tool } from './interactions.ts'
import { CatalogAccordion, CatalogOptions } from './CatalogAccordion.tsx'
import { importCustomIcon } from '../custom-icons/import.ts'
import { validateCustomIcon } from '../custom-icons/contract.ts'
import { ThemeToggle } from '../theme/index.ts'

type ArchitectureNode = Node<{ entity: Entity; minWidth: number; minHeight: number; writable: boolean; startResize(): void }, 'architecture'>
type ArchitectureEdge = Edge<{ connection: SceneConnection }, 'architecture'>
type Measurement = { width: number; height: number; canonicalWidth: number; canonicalHeight: number }
type Transaction = { key: string; command: DocumentCommand; documentId: string; revision: number }
const SAVE_LABELS = { loading: 'Loading', saving: 'Saving', saved: 'Saved', error: 'Save failed', 'read-only': 'Read-only' }
const tools: { tool: Tool; icon: LucideIcon; label: string }[] = [{ tool: 'select', icon: MousePointer2, label: 'Select tool' }, { tool: 'pan', icon: Hand, label: 'Pan tool' }, { tool: 'component', icon: Boxes, label: 'Add component' }, { tool: 'connector', icon: Cable, label: 'Connect components' }, { tool: 'boundary', icon: Frame, label: 'Add boundary' }, { tool: 'text', icon: Type, label: 'Add text' }, { tool: 'rectangle', icon: Square, label: 'Add rectangle' }]
const positions = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left }

function IconButton({ icon: Icon, label, active, ...props }: { icon: LucideIcon; label: string; active?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  return <button type="button" className={`icon-button ${active ? 'active' : ''}`} title={label} aria-label={label} aria-pressed={active} {...props}><Icon size={18} strokeWidth={1.7} /></button>
}
function sameEntityPaint(before: Entity, after: Entity): boolean {
  return before.kind === after.kind && before.label === after.label && before.subtitle === after.subtitle && before.icon === after.icon && before.status === after.status && before.color === after.color && before.width === after.width && before.height === after.height && before.customIcon?.name === after.customIcon?.name && before.customIcon?.dataUrl === after.customIcon?.dataUrl && before.customIcon?.width === after.customIcon?.width && before.customIcon?.height === after.customIcon?.height
}
const EntityArtwork = memo(function EntityArtwork({ entity }: { entity: Entity }) {
  return <svg width={entity.width} height={entity.height} viewBox={`0 0 ${entity.width} ${entity.height}`} aria-label={entity.label} dangerouslySetInnerHTML={{ __html: entityMarkup(entity, visualAssets) }} />
}, (before, after) => sameEntityPaint(before.entity, after.entity))
const ArchitectureTile = memo(function ArchitectureTile({ data, selected }: NodeProps<ArchitectureNode>) {
  const entity = data.entity
  const connectable = entity.kind === 'component' || entity.kind === 'boundary'
  return <div className={`architecture-tile ${entity.kind} ${selected ? 'tile-selected' : ''}`}>
    <EntityArtwork entity={entity} />
    {(entity.kind === 'boundary' || entity.kind === 'rectangle' || entity.kind === 'text') && <NodeResizer isVisible={selected && data.writable} minWidth={data.minWidth} minHeight={data.minHeight} onResizeStart={data.startResize} color="#117865" />}
    {connectable && Object.entries(positions).map(([side, position]) => <Handle key={side} type="source" position={position} id={side} isConnectable={data.writable} aria-label={`${entity.label} ${side} connector`} />)}
  </div>
}, (before, after) => before.selected === after.selected && before.data.writable === after.data.writable && before.data.minWidth === after.data.minWidth && before.data.minHeight === after.data.minHeight && before.data.startResize === after.data.startResize && sameEntityPaint(before.data.entity, after.data.entity))
const ArchitectureLink = memo(function ArchitectureLink({ data }: EdgeProps<ArchitectureEdge>) {
  if (!data) return null
  return <g><path d={data.connection.path} stroke="transparent" strokeWidth={20} fill="none" className="react-flow__edge-interaction" /><g dangerouslySetInnerHTML={{ __html: connectionMarkup(data.connection) }} /></g>
}, (before, after) => {
  if (before.data === after.data) return true
  if (!before.data || !after.data) return false
  const previous = before.data.connection, next = after.data.connection
  return previous.path === next.path && previous.label === next.label && previous.style === next.style && previous.arrow === next.arrow && previous.labelPosition.x === next.labelPosition.x && previous.labelPosition.y === next.labelPosition.y
})
const nodeTypes = { architecture: ArchitectureTile }
const edgeTypes = { architecture: ArchitectureLink }
function Property({ label, children }: { label: string; children: ReactNode }) { return <label className="property"><span>{label}</span>{children}</label> }
function DraftField({ label, value, maxLength, disabled, multiline, onDraft, onFinish, onCancel }: { label: string; value: string; maxLength: number; disabled: boolean; multiline?: boolean; onDraft(value: string): void; onFinish(): void; onCancel(): void }) {
  const props = { 'aria-label': label, value, maxLength, disabled, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onDraft(event.target.value), onBlur: onFinish, onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (event.key === 'Escape') { event.stopPropagation(); onCancel(); event.currentTarget.blur() }
    if (event.key === 'Enter' && !multiline && !event.nativeEvent.isComposing) event.currentTarget.blur()
  } }
  return multiline ? <textarea {...props} rows={5} /> : <input {...props} />
}
function HexField({ color, disabled, onDraft, onFinish, onCancel }: { color: string; disabled: boolean; onDraft(color: string): void; onFinish(): void; onCancel(): void }) {
  const [value, setValue] = useState(color.startsWith('#') ? color : '')
  const [error, setError] = useState(false)
  useEffect(() => { setValue(color.startsWith('#') ? color : ''); setError(false) }, [color])
  function finish() {
    if (disabled) return
    const valid = /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value) && isColorKey(value)
    setError(!!value && !valid)
    if (valid) onFinish(); else onCancel()
  }
  return <><input aria-label="Hex color" value={value} placeholder="#0078d4" disabled={disabled} maxLength={7} aria-invalid={error} onChange={event => {
    if (disabled) return
    const next = event.target.value
    setValue(next); setError(false)
    if (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(next) && isColorKey(next)) onDraft(next)
    else onCancel()
  }} onBlur={finish} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.stopPropagation(); setValue(color.startsWith('#') ? color : ''); setError(false); onCancel() } }} />{error && <small className="field-error" role="alert">Use #RGB or #RRGGBB.</small>}</>
}
function changed(document: Diagram, command: DocumentCommand): boolean {
  if (command.type === 'metadata') return Object.entries(command.patch).some(([key, value]) => document[key as keyof MetadataPatch] !== value)
  if (command.type === 'move') return command.positions.some(point => document.entities.some(entity => entity.id === point.id && (point.x !== entity.x || point.y !== entity.y)))
  if (command.type === 'resize') return document.entities.some(entity => entity.id === command.id && (entity.width !== command.width || entity.height !== command.height))
  if (command.type === 'updateEntity' || command.type === 'updateConnection') {
    const target = (command.type === 'updateEntity' ? document.entities : document.connections).find(item => item.id === command.id)
    return !!target && Object.entries(command.patch).some(([key, value]) => (target as unknown as Record<string, unknown>)[key] !== value)
  }
  return true
}

export default function EditorSurface(props: EditorProps) {
  const writable = !props.readOnly && props.saveState !== 'loading'
  const [draft, setDraft] = useState<Diagram | null>(null)
  const transaction = useRef<Transaction | null>(null)
  const gestureCancelled = useRef(false)
  const startResize = useCallback(() => { gestureCancelled.current = false }, [])
  const diagram = draft ?? props.document
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const selectionAfterCommit = useRef<string[] | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [template, setTemplate] = useState<LibraryItem>(genericLibrary[3])
  const [libraryOpen, setLibraryOpen] = useState(() => window.innerWidth > 640)
  const [inspectorOpen, setInspectorOpen] = useState(() => window.innerWidth > 900)
  const [exportOpen, setExportOpen] = useState(false)
  const [transparent, setTransparent] = useState(false)
  const [zoom, setZoom] = useState(1)
  const [connectionStart, setConnectionStart] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [isImportingIcon, setIsImportingIcon] = useState(false)
  const iconInput = useRef<HTMLInputElement>(null)
  const canvasElement = useRef<HTMLElement>(null)
  const importEpoch = useRef(0)
  const importRequest = useRef(0)
  const mounted = useRef(true)
  const [hasClipboard, setHasClipboard] = useState(false)
  const clipboard = useRef<{ fragment: ClipboardFragment; pastes: number } | null>(null)
  const [measurements, setMeasurements] = useState<Map<string, Measurement>>(() => new Map())
  const idCounter = useRef(0)
  const idPrefix = useRef('')
  const previousDocumentId = useRef(props.document.id)
  const { fitView, screenToFlowPosition, zoomIn, zoomOut } = useReactFlow<ArchitectureNode, ArchitectureEdge>()
  const scene = useMemo(() => buildScene(diagram), [diagram])
  const selected = diagram.entities.find(entity => entity.id === selectedIds.at(-1))
  const selectedEdge = selectedEdges.at(-1)
  const connection = diagram.connections.find(candidate => candidate.id === selectedEdge)
  const selectableParents = parentChoices(diagram, selectedIds)
  const multiSelection = selectedIds.length > 1
  const boundaries = selectedIds.filter(id => diagram.entities.some(entity => entity.id === id && entity.kind === 'boundary'))
  const selectedCustomIcon = validateCustomIcon(selected?.customIcon)
  const latestImport = useRef({ document: props.document, writable, selection: selectedIds.join('\n'), draft, emit })
  latestImport.current = { document: props.document, writable, selection: selectedIds.join('\n'), draft, emit }
  useEffect(() => { importEpoch.current++ }, [props.document, writable, selectedIds, draft])
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; importRequest.current++ } }, [])

  function nextId() {
    if (!idPrefix.current) idPrefix.current = `editor-${crypto.randomUUID()}`
    let id: string
    do { id = `${idPrefix.current}-${++idCounter.current}` } while ([...props.document.entities, ...props.document.connections].some(item => item.id === id))
    return id
  }
  function clearPreview() {
    if (!transaction.current) return
    transaction.current = null; setDraft(null); props.onPreviewChange(null)
  }
  function finish(command?: DocumentCommand) {
    const pending = transaction.current
    const completed = command ?? pending?.command
    try {
      if (writable && completed && (!pending || (pending.documentId === props.document.id && pending.revision === props.document.revision)) && changed(props.document, completed)) { importEpoch.current++; props.onCommand(completed) }
    } finally {
      if (pending) clearPreview()
      else if (command && writable) props.onPreviewChange(null)
    }
  }
  function emit(command: DocumentCommand) {
    if (!writable) return
    if (transaction.current) finish()
    setNotice('')
    if (changed(props.document, command)) { importEpoch.current++; props.onCommand(command) }
  }
  function openIconPicker() {
    if (!writable || isImportingIcon) return
    finish()
    iconInput.current?.click()
  }
  // Capture the destination and edit token; normalize without mutation; reject stale completion; commit exactly once.
  async function importIconFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !writable) return
    const captured = latestImport.current
    const epoch = importEpoch.current
    const request = ++importRequest.current
    const target = selected?.kind === 'component' && selectedIds.length === 1 ? selected.id : undefined
    const bounds = canvasElement.current?.getBoundingClientRect()
    const center = screenToFlowPosition(bounds ? { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 } : { x: 0, y: 0 })
    setIsImportingIcon(true); setNotice('')
    try {
      const customIcon = await importCustomIcon(file)
      if (!mounted.current || request !== importRequest.current) return
      const current = latestImport.current
      if (!current.writable || current.document !== captured.document || current.document.revision !== captured.document.revision || current.selection !== captured.selection || current.draft || transaction.current || epoch !== importEpoch.current) {
        setNotice('Document or selection changed. Import again with the intended component selected.'); return
      }
      if (target) current.emit({ type: 'updateEntity', id: target, patch: { customIcon } })
      else {
        const entity = makeEntity('component', { x: center.x - 110, y: center.y - 44 }, nextId(), { icon: 'service', label: customIcon.name, subtitle: '', color: 'gray' })
        current.emit({ type: 'addEntity', entity: { ...entity, customIcon } })
        selectionAfterCommit.current = [entity.id]
      }
      setTool('select'); setConnectionStart(null)
      if (window.innerWidth <= 900) { setLibraryOpen(false); setInspectorOpen(false) }
    } catch (error) {
      if (mounted.current && request === importRequest.current) setNotice(error instanceof Error ? error.message : 'Image import failed. Choose a valid supported image.')
    } finally {
      if (mounted.current && request === importRequest.current) setIsImportingIcon(false)
    }
  }
  function preview(command: DocumentCommand, key: string) {
    if (!writable) return
    if (transaction.current && transaction.current.key !== key) finish()
    transaction.current = { key, command, documentId: props.document.id, revision: props.document.revision }
    const next = previewDocument(props.document, command)
    setDraft(next); props.onPreviewChange(next)
  }
  function editEntity(patch: EntityPatch, typing = false) {
    if (!selected) return
    const command: DocumentCommand = { type: 'updateEntity', id: selected.id, patch }
    if (typing) preview(command, `entity:${selected.id}`); else emit(command)
  }
  function editConnection(patch: ConnectionPatch, typing = false) {
    if (!connection) return
    const command: DocumentCommand = { type: 'updateConnection', id: connection.id, patch }
    if (typing) preview(command, `connection:${connection.id}`); else emit(command)
  }
  function editMetadata(patch: MetadataPatch, typing = false) {
    const command: DocumentCommand = { type: 'metadata', patch }
    if (typing) preview(command, 'metadata'); else emit(command)
  }
  function openLibrary() { setLibraryOpen(true); if (window.innerWidth <= 900) setInspectorOpen(false) }
  function openInspector() { setInspectorOpen(true); if (window.innerWidth <= 900) setLibraryOpen(false) }
  function chooseTool(next: Tool) {
    if (!writable && next !== 'select' && next !== 'pan') return
    finish(); setTool(next); setConnectionStart(null); setNotice('')
    if (next === 'component') openLibrary()
  }
  function selectEntity(id: string, event?: MouseEvent) {
    setSelectedEdges([])
    if (!event?.shiftKey && !event?.ctrlKey && !event?.metaKey) setSelectedIds([id])
    if (window.innerWidth > 900) setInspectorOpen(true)
    if (tool !== 'connector' || !writable) return
    if (connectionStart) connect({ source: connectionStart, target: id, sourceHandle: null, targetHandle: null })
    else if (diagram.entities.some(entity => entity.id === id && ['component', 'boundary'].includes(entity.kind))) setConnectionStart(id)
  }
  function deleteSelection() {
    if (!writable || (!selectedIds.length && !selectedEdges.length)) return
    emit({ type: 'remove', entityIds: selectedIds, connectionIds: selectedEdges })
    setSelectedIds([]); setSelectedEdges([]); setConnectionStart(null)
  }
  function copySelection(cut = false) {
    if (!selectedIds.length || (cut && !writable)) return
    if (transaction.current) finish()
    clipboard.current = { fragment: captureFragment(props.document, selectedIds), pastes: 0 }; setHasClipboard(true)
    if (cut) deleteSelection()
  }
  function paste(fragment = clipboard.current?.fragment, duplicate = false) {
    if (!writable || !fragment?.entities.length) return
    const idMap = freshIdMap(fragment, nextId)
    const distance = duplicate ? 32 : 32 * ((clipboard.current?.pastes ?? 0) + 1)
    emit({ type: 'paste', fragment, idMap, offset: { x: distance, y: distance } })
    if (!duplicate && clipboard.current) clipboard.current.pastes++
    selectionAfterCommit.current = fragment.entities.map(entity => idMap[entity.id]); setTool('select')
  }
  function duplicate() { if (writable) paste(captureFragment(props.document, selectedIds), true) }
  function groupSelection() {
    if (!writable) return
    const command = groupCommand(props.document, selectedIds, nextId())
    if (!command || command.type !== 'group') return
    emit(command); selectionAfterCommit.current = [command.boundary.id]
  }
  function ungroupSelection() { if (writable && boundaries.length) { emit({ type: 'ungroup', boundaryIds: boundaries }); setSelectedIds([]) } }
  function insertComponent(item: LibraryItem, point?: Point) {
    if (!writable) return
    const route = scene.connections.find(candidate => candidate.id === connection?.id)
    const entity = makeEntity('component', point ?? route?.labelPosition ?? { x: 0, y: 0 }, nextId(), item)
    if (connection && !point) {
      entity.x -= Math.round(entity.width / 16) * 8; entity.y -= Math.round(entity.height / 16) * 8
      emit({ type: 'insertOnConnection', connectionId: connection.id, entity, upstreamId: nextId(), downstreamId: nextId() })
    } else emit({ type: 'addEntity', entity })
    selectionAfterCommit.current = [entity.id]; setTool('select'); setConnectionStart(null)
    if (window.innerWidth <= 900) { setLibraryOpen(false); setInspectorOpen(false) }
  }
  function chooseComponent(item: LibraryItem) {
    if (!writable) return
    setTemplate(item)
    if (connection) insertComponent(item)
    else { setTool('component'); if (window.innerWidth <= 900) { setLibraryOpen(false); setInspectorOpen(false) } }
  }
  function insertAt(event: MouseEvent) {
    setExportOpen(false)
    if (!writable || !['component', 'boundary', 'text', 'rectangle'].includes(tool)) { setSelectedIds([]); setSelectedEdges([]); return }
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    if (tool === 'component') insertComponent(template, point)
    else { const entity = makeEntity(tool as Entity['kind'], point, nextId(), template); emit({ type: 'addEntity', entity }); selectionAfterCommit.current = [entity.id]; setTool('select') }
  }
  function connect(next: FlowConnection, reconnectId?: string) {
    if (!writable) return
    if (!canConnect(diagram, next.source, next.target)) { setNotice('Choose two different components or boundaries.'); return }
    const sourceSide = sides.includes(next.sourceHandle as ConnectionSide) ? next.sourceHandle as ConnectionSide : 'auto'
    const targetSide = sides.includes(next.targetHandle as ConnectionSide) ? next.targetHandle as ConnectionSide : 'auto'
    if (reconnectId) emit({ type: 'updateConnection', id: reconnectId, patch: { from: next.source!, to: next.target!, sourceSide, targetSide } })
    else emit({ type: 'connect', connection: { id: nextId(), from: next.source!, to: next.target!, label: '', style: 'solid', arrow: 'forward', sourceSide, targetSide } })
    setConnectionStart(null); setTool('select')
  }
  function moveNodes(moved: ArchitectureNode[], finished: boolean) {
    if (!writable) return
    if (gestureCancelled.current) { if (finished) gestureCancelled.current = false; return }
    const positions = movePositions(props.document, moved)
    if (!positions.length) return
    const command: DocumentCommand = { type: 'move', positions }
    if (finished) finish(command); else preview(command, 'move')
  }
  function updateNodes(changes: NodeChange<ArchitectureNode>[]) {
    const selections = changes.filter(change => change.type === 'select')
    if (selections.length) setSelectedIds(current => {
      const next = new Set(current)
      for (const change of selections) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id) }
      return [...next]
    })
    const dimensions = changes.filter(change => change.type === 'dimensions')
    if (!dimensions.length) return
    setMeasurements(current => {
      const next = new Map(current)
      let updated = false
      for (const change of dimensions) {
        const entity = props.document.entities.find(candidate => candidate.id === change.id)
        if (change.type !== 'dimensions' || !change.dimensions || !entity) continue
        const before = current.get(change.id)
        if (before?.width === change.dimensions.width && before.height === change.dimensions.height && before.canonicalWidth === entity.width && before.canonicalHeight === entity.height) continue
        next.set(change.id, { ...change.dimensions, canonicalWidth: entity.width, canonicalHeight: entity.height })
        updated = true
      }
      return updated ? next : current
    })
    if (!writable) return
    for (const change of dimensions) {
      if (change.type !== 'dimensions' || change.resizing === undefined || !change.dimensions) continue
      if (gestureCancelled.current) { if (change.resizing === false) gestureCancelled.current = false; continue }
      const entity = props.document.entities.find(candidate => candidate.id === change.id)
      if (!entity) continue
      const min = minimumSize(props.document, entity)
      const command: DocumentCommand = { type: 'resize', id: entity.id, width: Math.max(min.width, change.dimensions.width), height: Math.max(min.height, change.dimensions.height) }
      if (change.resizing === false) finish(command); else preview(command, `resize:${entity.id}`)
    }
  }
  function undo() { if (writable && props.canUndo) { importEpoch.current++; gestureCancelled.current = true; clearPreview(); props.onUndo() } }
  function redo() { if (writable && props.canRedo) { importEpoch.current++; gestureCancelled.current = true; clearPreview(); props.onRedo() } }
  function fileAction(callback: () => void, mutation = false) { if (mutation && !writable) return; finish(); if (mutation) importEpoch.current++; callback() }

  useEffect(() => {
    const pending = transaction.current
    if (pending && (!writable || pending.documentId !== props.document.id || pending.revision !== props.document.revision)) { gestureCancelled.current = true; clearPreview() }
    const accepted = selectionAfterCommit.current
    if (accepted?.every(id => props.document.entities.some(entity => entity.id === id))) { setSelectedIds(accepted); setSelectedEdges([]) }
    else { setSelectedIds(current => current.filter(id => props.document.entities.some(entity => entity.id === id))); setSelectedEdges(current => current.filter(id => props.document.connections.some(connection => connection.id === id))) }
    selectionAfterCommit.current = null
    if (previousDocumentId.current !== props.document.id) { previousDocumentId.current = props.document.id; setTool('select'); setConnectionStart(null); setMeasurements(new Map()); setNotice('') }
    if (!writable) { setTool(current => current === 'pan' ? 'pan' : 'select'); setConnectionStart(null) }
  }, [props.document.id, props.document.revision, writable])
  const previewCallback = useRef(props.onPreviewChange)
  previewCallback.current = props.onPreviewChange
  useEffect(() => () => { if (transaction.current) previewCallback.current(null) }, [])
  useEffect(() => {
    const keydown = (event: globalThis.KeyboardEvent) => {
      if ((event.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      if (key === 'escape') { gestureCancelled.current = true; clearPreview(); setTool('select'); setConnectionStart(null); setExportOpen(false); setLibraryOpen(false); setInspectorOpen(false); return }
      if (modifier && key === 'c') { event.preventDefault(); copySelection(); return }
      if (!writable) return
      if (modifier && key === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); return }
      if (modifier && key === 'y') { event.preventDefault(); redo(); return }
      if (modifier && key === 'x') { event.preventDefault(); copySelection(true); return }
      if (modifier && key === 'v') { event.preventDefault(); paste(); return }
      if (modifier && key === 'd') { event.preventDefault(); duplicate(); return }
      if (key === 'delete' || key === 'backspace') { event.preventDefault(); deleteSelection(); return }
      if (!modifier && !event.altKey) { const command = nudgeCommand(props.document, selectedIds, event.key, event.shiftKey); if (command) { event.preventDefault(); emit(command) } }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  })

  // Parents precede children; passive React Flow measurements never overwrite canonical geometry.
  const ordered = useMemo(() => [...scene.entities].sort((before, after) => {
    const depth = (entity: Entity) => { let count = 0; let parent = entity.parentId; while (parent && count < 3) { count++; parent = diagram.entities.find(candidate => candidate.id === parent)?.parentId } return count }
    return depth(before) - depth(after)
  }).map(entity => ({ entity, min: minimumSize(diagram, entity) })), [scene, diagram])
  const nodes = useMemo<ArchitectureNode[]>(() => ordered.map(({ entity, min }) => {
    const measured = measurements.get(entity.id)
    return { id: entity.id, type: 'architecture', position: { x: entity.x, y: entity.y }, parentId: entity.parentId ?? undefined, width: entity.width, height: entity.height, measured: measured && measured.canonicalWidth === entity.width && measured.canonicalHeight === entity.height ? { width: measured.width, height: measured.height } : { width: entity.width, height: entity.height }, style: { width: entity.width, height: entity.height }, selected: selectedIds.includes(entity.id), data: { entity, minWidth: min.width, minHeight: min.height, writable, startResize }, zIndex: entity.kind === 'boundary' ? 0 : entity.layer === 'background' ? -1 : 4 }
  }), [ordered, measurements, selectedIds, writable, startResize])
  const edges = useMemo<ArchitectureEdge[]>(() => scene.connections.map(item => ({ id: item.id, type: 'architecture', source: item.from, target: item.to, sourceHandle: item.sourceSide && item.sourceSide !== 'auto' ? item.sourceSide : sideAtPoint(diagram, item.from, item.start), targetHandle: item.targetSide && item.targetSide !== 'auto' ? item.targetSide : sideAtPoint(diagram, item.to, item.end), selected: selectedEdges.includes(item.id), reconnectable: writable, data: { connection: item }, zIndex: 2 })), [scene, diagram, selectedEdges, writable])
  const panelTitle = multiSelection ? 'Selection' : selected ? ({ component: 'Component', boundary: 'Boundary', text: 'Text', rectangle: 'Rectangle' })[selected.kind] : connection ? 'Connection' : 'Document'
  const field = (label: string, value: string, maxLength: number, onDraft: (value: string) => void, multiline = false) => <DraftField label={label} value={value} maxLength={maxLength} disabled={!writable} multiline={multiline} onDraft={onDraft} onFinish={() => finish()} onCancel={clearPreview} />
  const entityActions = <div className="selection-actions"><IconButton icon={Copy} label="Copy selection" disabled={!selectedIds.length} onClick={() => copySelection()} /><IconButton icon={Scissors} label="Cut selection" disabled={!writable || !selectedIds.length} onClick={() => copySelection(true)} /><IconButton icon={CopyPlus} label="Duplicate selection" disabled={!writable || !selectedIds.length} onClick={duplicate} /><IconButton icon={Trash2} label="Delete selection" disabled={!writable || (!selectedIds.length && !selectedEdges.length)} onClick={deleteSelection} /></div>

  return <div className="app-shell">
    <input ref={iconInput} type="file" aria-label="Import icon file" accept=".svg,.png,.jpg,.jpeg,.gif,.webp" hidden disabled={!writable} onChange={event => void importIconFile(event)} />
    <header className="topbar">
      <div className="wordmark" aria-label="Azure Diagram Studio"><img className="brand-icon" src="./branding/logo.svg" alt="" width={36} height={36} /><span className="brand-name">Azure Diagram Studio</span></div>
      <div className="document-bar"><span className="breadcrumb">Workspace /</span>{field('Document title', diagram.title, 120, value => editMetadata({ title: value }, true))}<span className={`session-state state-${props.saveState}`}><span />{SAVE_LABELS[props.saveState]}</span></div>
      <div className="top-actions"><IconButton icon={FilePlus2} label="New diagram" disabled={!writable} onClick={() => fileAction(props.onNew, true)} /><IconButton icon={FolderOpen} label="Open JSON" disabled={!writable} onClick={() => fileAction(props.onOpen, true)} /><IconButton icon={FileInput} label="Import skill JSON" disabled={!writable} onClick={() => fileAction(props.onImport, true)} /><IconButton icon={Save} label="Save JSON" onClick={() => fileAction(props.onSaveJson)} /><span className="separator" /><IconButton icon={Undo2} label="Undo" disabled={!writable || !props.canUndo} onClick={undo} /><IconButton icon={Redo2} label="Redo" disabled={!writable || !props.canRedo} onClick={redo} /><button type="button" className="export-button" title="Export" aria-label="Export" aria-expanded={exportOpen} onClick={() => setExportOpen(!exportOpen)} disabled={props.isExporting}>{props.isExporting ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}<span>Export</span><ChevronDown size={14} /></button></div>
    </header>
    <div className="workspace">
      <nav className="tool-rail" aria-label="Drawing tools">{tools.map(item => <IconButton key={item.tool} icon={item.icon} label={item.label} active={tool === item.tool} disabled={!writable && item.tool !== 'select' && item.tool !== 'pan'} onClick={() => chooseTool(item.tool)} />)}<IconButton icon={isImportingIcon ? LoaderCircle : ImagePlus} label="Import custom icon" disabled={!writable || isImportingIcon} onClick={openIconPicker} /><span className="rail-spacer" /><ThemeToggle /><IconButton icon={ClipboardPaste} label="Paste selection" disabled={!writable || !hasClipboard} onClick={() => paste()} /><IconButton icon={PanelRight} label="Document properties" onClick={() => { finish(); setSelectedIds([]); setSelectedEdges([]); openInspector() }} /></nav>
      <aside className={`library ${libraryOpen ? 'open' : ''}`} aria-label="Component library" inert={!libraryOpen}>
        <div className="panel-heading"><h2>Components</h2><IconButton icon={PanelLeftClose} label="Close component library" onClick={() => setLibraryOpen(false)} /></div>
        <CatalogAccordion writable={writable} selectedIcon={tool === 'component' ? template.icon : null} onChoose={chooseComponent} />
        <div className="library-bottom"><span className="library-category">ARCHITECTURE</span>{tools.filter(item => ['boundary', 'text', 'rectangle'].includes(item.tool)).map(item => <button type="button" key={item.tool} title={item.label} disabled={!writable} onClick={() => { chooseTool(item.tool); if (window.innerWidth <= 900) { setLibraryOpen(false); setInspectorOpen(false) } }}><item.icon size={17} />{item.tool.charAt(0).toUpperCase() + item.tool.slice(1)}<Plus size={14} /></button>)}</div>
      </aside>
      <main ref={canvasElement} className={`canvas-surface tool-${tool}`} aria-label="Architecture canvas" onDragOver={event => { if (writable && event.dataTransfer.types.includes(DROP_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={event => {
        event.preventDefault()
        if (!writable) return
        const item = readDrop(event.dataTransfer.getData(DROP_TYPE))
        if (!item) { setNotice('Drop a component from the library.'); return }
        insertComponent(item, screenToFlowPosition({ x: event.clientX, y: event.clientY }))
      }}>
        <div className="canvas-heading">{diagram.synthetic && <div className="canvas-kicker"><span className="synthetic-dot" />SYNTHETIC EXAMPLE</div>}<h1>{diagram.title || 'Untitled architecture'}</h1>{diagram.subtitle && <div className="diagram-meta">{diagram.subtitle}</div>}</div>
        <div className="canvas-toolbar"><div className="direction-control" role="group" aria-label="Layout direction"><button type="button" title="Right layout" aria-label="Right layout" aria-pressed={diagram.direction === 'RIGHT'} disabled={!writable} className={diagram.direction === 'RIGHT' ? 'chosen' : ''} onClick={() => editMetadata({ direction: 'RIGHT' })}><ArrowRight size={15} /></button><button type="button" title="Down layout" aria-label="Down layout" aria-pressed={diagram.direction === 'DOWN'} disabled={!writable} className={diagram.direction === 'DOWN' ? 'chosen' : ''} onClick={() => editMetadata({ direction: 'DOWN' })}><ArrowDown size={15} /></button></div><button type="button" className="arrange-button" title="Auto-arrange" aria-label="Auto-arrange" disabled={!writable || props.isArranging || !diagram.entities.some(entity => entity.kind === 'component' || entity.kind === 'boundary')} onClick={() => { finish(); props.onArrange(diagram.direction) }}>{props.isArranging ? <LoaderCircle size={15} className="spin" /> : <LayoutGrid size={15} />}<span>Auto-arrange</span></button></div>
        {(selectedIds.length > 0 || selectedEdges.length > 0) && <div className="canvas-selection-toolbar" aria-label="Selection actions">{entityActions}<IconButton icon={ClipboardPaste} label="Paste clipboard" disabled={!writable || !hasClipboard} onClick={() => paste()} /><span className="separator" /><IconButton icon={Group} label="Group selection" disabled={!writable || !selectedIds.length} onClick={groupSelection} /><IconButton icon={Ungroup} label="Ungroup selection" disabled={!writable || !boundaries.length} onClick={ungroupSelection} />{connection && <IconButton icon={Plus} label={`Insert ${template.label} on connection`} disabled={!writable} onClick={() => insertComponent(template)} />}</div>}
        <ReactFlow<ArchitectureNode, ArchitectureEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} connectionMode={ConnectionMode.Loose} onNodesChange={updateNodes} onNodeDragStart={() => { gestureCancelled.current = false }} onNodeDrag={(_event, _node, moved) => moveNodes(moved, false)} onNodeDragStop={(_event, _node, moved) => moveNodes(moved, true)} onNodeClick={(event, node) => selectEntity(node.id, event)} onEdgeClick={(event, edge) => { setSelectedIds([]); setSelectedEdges(current => event.shiftKey || event.ctrlKey || event.metaKey ? current.includes(edge.id) ? current.filter(id => id !== edge.id) : [...current, edge.id] : [edge.id]); if (window.innerWidth > 900) setInspectorOpen(true) }} onEdgesChange={changes => setSelectedEdges(current => { const next = new Set(current); for (const change of changes) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id) } return [...next] })} onPaneClick={insertAt} onConnect={next => connect(next)} onReconnect={(edge, next) => connect(next, edge.id)} isValidConnection={next => canConnect(diagram, next.source, next.target)} onMove={(_event, viewport) => setZoom(viewport.zoom)} fitView fitViewOptions={{ padding: 0.19, minZoom: 0.25, maxZoom: 0.9 }} minZoom={0.15} maxZoom={2} snapToGrid snapGrid={[8, 8]} panOnDrag={tool === 'pan' ? true : [1, 2]} selectionOnDrag={tool === 'select'} nodesDraggable={writable && tool === 'select'} nodesConnectable={writable} edgesReconnectable={writable} deleteKeyCode={null}>
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="#dce5e5" /><svg width={0} height={0}><defs dangerouslySetInnerHTML={{ __html: MARKERS }} /></svg>
        </ReactFlow>
        <div className="mobile-controls"><IconButton icon={Boxes} label="Open component library" active={libraryOpen} onClick={() => libraryOpen ? setLibraryOpen(false) : openLibrary()} /><IconButton icon={PanelRight} label="Open properties" active={inspectorOpen} onClick={() => inspectorOpen ? setInspectorOpen(false) : openInspector()} /></div>
        {diagram.legendVisible && scene.legendItems.length > 0 && <div className="canvas-legend" aria-label="Diagram legend" role="list">{scene.legendItems.map((item, index) => <span key={`${item.label}-${index}`} role="listitem"><i style={{ borderColor: resolveColor(item.color).main, borderStyle: item.dashed ? 'dashed' : 'solid' }} />{item.label}</span>)}</div>}
        <div className="zoom-controls"><IconButton icon={Minus} label="Zoom out" onClick={() => void zoomOut({ duration: 150 })} /><span>{Math.round(zoom * 100)}%</span><IconButton icon={Plus} label="Zoom in" onClick={() => void zoomIn({ duration: 150 })} /><span className="separator" /><IconButton icon={Maximize2} label="Fit diagram" onClick={() => void fitView({ padding: 0.19, duration: 200 })} /></div>
      </main>
      <aside className={`inspector ${inspectorOpen ? 'open' : ''}`} aria-label="Properties" inert={!inspectorOpen}>
        <div className="panel-heading"><h2><SlidersHorizontal size={15} />Properties</h2><IconButton icon={X} label="Close properties" onClick={() => setInspectorOpen(false)} /></div>
        <div className="inspector-content"><div className="inspector-kind">{panelTitle}{multiSelection && <span>{selectedIds.length}</span>}</div>
          {selected && <>
            {!multiSelection && <>
              <Property label={selected.kind === 'text' ? 'Text' : 'Label'}>{field(selected.kind === 'text' ? 'Note text' : 'Component label', selected.label, selected.kind === 'text' ? 2000 : 120, value => editEntity({ label: value }, true), selected.kind === 'text')}</Property>
              {selected.kind !== 'text' && <Property label="Subtitle">{field('Component subtitle', selected.subtitle ?? '', 200, value => editEntity({ subtitle: value }, true))}</Property>}
              {selected.kind === 'component' && <>
                <Property label="Type"><select aria-label="Component type" value={selected.icon ?? 'service'} disabled={!writable} onChange={event => editEntity({ icon: event.target.value, customIcon: undefined })}><CatalogOptions currentIcon={selected.icon} /></select></Property>
                <div className="property"><span>Artwork</span><div className="selection-actions" style={{ width: '100%', minWidth: 0 }}>
                  {selectedCustomIcon.ok && <img src={selectedCustomIcon.value.dataUrl} alt="Custom icon preview" width={48} height={48} style={{ objectFit: 'contain', flexShrink: 0 }} />}
                  <IconButton icon={ImagePlus} label="Replace component icon" disabled={!writable || isImportingIcon} onClick={openIconPicker} />
                  {selectedCustomIcon.ok && <IconButton icon={X} label="Clear custom icon" disabled={!writable} onClick={() => editEntity({ customIcon: undefined })} />}
                </div>{selectedCustomIcon.ok && <><input aria-label="Custom icon name" value={selectedCustomIcon.value.name} readOnly title={selectedCustomIcon.value.name} /><div className="readout"><span>PNG</span><strong>{selectedCustomIcon.value.width} x {selectedCustomIcon.value.height}</strong></div></>}</div>
              </>}
              <Property label="Status"><select aria-label="Component status" value={selected.status ?? ''} disabled={!writable} onChange={event => editEntity({ status: (event.target.value || undefined) as Entity['status'] })}><option value="">Unset</option><option value="live">Live</option><option value="planned">Planned</option><option value="not-connected">Not connected</option><option value="synthetic">Synthetic</option></select></Property>
              <Property label="Color"><div className="swatches">{Object.entries(COLORS).map(([key, value]) => <button type="button" key={key} className={selected.color === key ? 'swatch picked' : 'swatch'} style={{ '--swatch': value.main } as CSSProperties} aria-label={`${key} color`} title={key} disabled={!writable} onClick={() => editEntity({ color: key })}>{selected.color === key && <CircleCheck size={17} />}</button>)}</div></Property><Property label="Hex color"><HexField key={selected.id} color={props.document.entities.find(entity => entity.id === selected.id)?.color ?? selected.color} disabled={!writable} onDraft={color => editEntity({ color }, true)} onFinish={() => finish()} onCancel={clearPreview} /></Property>
            </>}
            <Property label="Parent"><select aria-label="Parent boundary" value={multiSelection ? '' : selected.parentId ?? ''} disabled={!writable} onChange={event => emit({ type: 'reparent', ids: selectionRoots(diagram, selectedIds).map(entity => entity.id), parentId: event.target.value || null })}><option value="">Canvas</option>{selectableParents.map(entity => <option value={entity.id} key={entity.id}>{entity.label || entity.id}</option>)}</select></Property>
            {selectedIds.some(id => diagram.entities.some(entity => entity.id === id && ['text', 'rectangle'].includes(entity.kind))) && <div className="ordering-actions"><IconButton icon={BringToFront} label="Bring to foreground" disabled={!writable} onClick={() => emit({ type: 'order', ids: selectedIds, layer: 'foreground' })} /><IconButton icon={SendToBack} label="Send to background" disabled={!writable} onClick={() => emit({ type: 'order', ids: selectedIds, layer: 'background' })} /></div>}
            <div className="inspector-divider" /><div className="readout"><span>Dimensions</span><strong>{Math.round(selected.width)} x {Math.round(selected.height)}</strong></div>
            <div className="inspector-group-actions"><IconButton icon={Group} label="Group objects" disabled={!writable} onClick={groupSelection} /><IconButton icon={Ungroup} label="Ungroup boundaries" disabled={!writable || !boundaries.length} onClick={ungroupSelection} /></div>
          </>}
          {connection && <>
            <Property label="Label">{field('Connection label', connection.label, 80, value => editConnection({ label: value }, true))}</Property>
            <Property label="Source"><select aria-label="Connection source" value={connection.from} disabled={!writable} onChange={event => editConnection({ from: event.target.value })}>{diagram.entities.filter(entity => ['component', 'boundary'].includes(entity.kind) && entity.id !== connection.to).map(entity => <option key={entity.id} value={entity.id}>{entity.label || entity.id}</option>)}</select></Property>
            <Property label="Target"><select aria-label="Connection target" value={connection.to} disabled={!writable} onChange={event => editConnection({ to: event.target.value })}>{diagram.entities.filter(entity => ['component', 'boundary'].includes(entity.kind) && entity.id !== connection.from).map(entity => <option key={entity.id} value={entity.id}>{entity.label || entity.id}</option>)}</select></Property>
            <Property label="Source side"><select aria-label="Source side" value={connection.sourceSide ?? 'auto'} disabled={!writable} onChange={event => editConnection({ sourceSide: event.target.value as ConnectionSide })}>{sides.map(side => <option key={side} value={side}>{side.charAt(0).toUpperCase() + side.slice(1)}</option>)}</select></Property>
            <Property label="Target side"><select aria-label="Target side" value={connection.targetSide ?? 'auto'} disabled={!writable} onChange={event => editConnection({ targetSide: event.target.value as ConnectionSide })}>{sides.map(side => <option key={side} value={side}>{side.charAt(0).toUpperCase() + side.slice(1)}</option>)}</select></Property>
            <Property label="Line"><select aria-label="Connection line" value={connection.style} disabled={!writable} onChange={event => editConnection({ style: event.target.value as 'solid' | 'dashed' })}><option value="solid">Solid</option><option value="dashed">Dashed</option></select></Property>
            <Property label="Direction"><select aria-label="Connection direction" value={connection.arrow} disabled={!writable} onChange={event => editConnection({ arrow: event.target.value as 'forward' | 'both' | 'none' })}><option value="forward">Forward</option><option value="both">Both ways</option><option value="none">No arrow</option></select></Property>
            <Property label="Insert component"><select aria-label="Insertion component" value={template.icon} disabled={!writable} onChange={event => { const item = libraryItems.find(item => item.icon === event.target.value); if (item) setTemplate(item) }}><CatalogOptions /></select></Property><button type="button" className="inspector-command" title="Insert on connection" aria-label="Insert on connection" disabled={!writable} onClick={() => insertComponent(template)}><Plus size={16} />Insert</button>
          </>}
          {!selected && !connection && <>
            <Property label="Subtitle">{field('Document subtitle', diagram.subtitle, 200, value => editMetadata({ subtitle: value }, true))}</Property>
            <label className="property-toggle"><input aria-label="Synthetic diagram" type="checkbox" checked={diagram.synthetic} disabled={!writable} onChange={event => editMetadata({ synthetic: event.target.checked })} />Synthetic</label><label className="property-toggle"><input aria-label="Show legend" type="checkbox" checked={diagram.legendVisible} disabled={!writable} onChange={event => editMetadata({ legendVisible: event.target.checked })} />Show legend</label>
            <div className="document-summary"><Workflow size={30} strokeWidth={1.3} /><strong>{diagram.title}</strong></div><div className="readout"><span>Objects</span><strong>{diagram.entities.length}</strong></div><div className="readout"><span>Connections</span><strong>{diagram.connections.length}</strong></div>
          </>}
        </div><div className="inspector-footer"><span className={`status-dot state-${props.saveState}`} />{props.readOnly ? 'Read-only' : SAVE_LABELS[props.saveState]}</div>
      </aside>
    </div>
    <footer className="statusbar"><span><span className={`status-dot state-${props.saveState}`} /><span className="save-label">{SAVE_LABELS[props.saveState]}</span><span className="footer-divider" /><span className="backup-state">{props.backupDirty ? 'JSON backup needed' : 'JSON backup current'}</span><span className="object-count"><span className="footer-divider" />{diagram.entities.length} objects</span></span><span role="status" title={notice || props.message}>{notice || props.message || (connectionStart ? 'Connection source selected' : tool === 'component' ? template.label : '')}</span><span className="status-right">{Math.round(zoom * 100)}%{diagram.synthetic && <><span className="footer-divider" />Synthetic</>}</span></footer>
    {exportOpen && <><button type="button" className="menu-backdrop" aria-label="Close export menu" onClick={() => setExportOpen(false)} /><div className="export-menu" role="dialog" aria-label="Export diagram"><div className="menu-title">Export diagram</div>{([{ format: 'svg', scale: 1 }, { format: 'png', scale: 1 }, { format: 'png', scale: 2 }] as const).map(option => <button type="button" key={`${option.format}-${option.scale}`} aria-label={option.format === 'svg' ? 'Export SVG' : `Export PNG ${option.scale}x`} disabled={props.isExporting} onClick={() => { finish(); setExportOpen(false); props.onExport({ ...option, transparent }) }}><Download size={16} /><strong>{option.format.toUpperCase()}</strong><small>{option.format === 'svg' ? 'Vector' : `${option.scale}x`}</small></button>)}<label className="export-option"><input type="checkbox" checked={transparent} onChange={event => setTransparent(event.target.checked)} />Transparent background</label></div></>}
  </div>
}