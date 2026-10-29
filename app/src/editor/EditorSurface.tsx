import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ButtonHTMLAttributes, CSSProperties, MouseEvent, ReactNode, ChangeEvent, FocusEvent, KeyboardEvent } from 'react'
import { ReactFlow, Background, BackgroundVariant, ConnectionMode, Handle, Position, NodeResizer, NodeToolbar, useReactFlow, useStoreApi, getNodesBounds, getViewportForBounds } from '@xyflow/react'
import type { Node, NodeProps, Edge, EdgeProps, NodeChange, Connection as FlowConnection } from '@xyflow/react'
import { Scan, MousePointer2, Hand, Boxes, Cable, Frame, Type, Square, Trash2, Copy, ClipboardPaste, Scissors, CopyPlus, Undo2, Redo2, Download, ChevronDown, X, Plus, Minus, Maximize2, PanelRight, PanelLeftClose, LayoutGrid, FilePlus2, ArrowRight, ArrowDown, ArrowUp, SlidersHorizontal, CircleCheck, LoaderCircle, Group, Ungroup, BringToFront, SendToBack, ImagePlus, Command as CommandIcon } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { ClipboardFragment, DocumentCommand, EditorProps, EntityPatch, ConnectionPatch, MetadataPatch } from '../contracts.ts'
import type { ConnectionSide, Diagram, Entity, Point } from '../model.ts'
import { buildScene, buildExportScene, pngDimensions, entityMarkup, connectionMarkup, connectionMarkers, MARKERS } from '../scene.ts'
import { entityTextGeometry } from '../model.ts'
import { contrastInk, fullHex, isHexColor, isWhiteBackground } from '../render/contrast.ts'
import type { SceneConnection } from '../scene.ts'
import { COLORS, genericLibrary, isColorKey, resolveColor } from '../catalog.ts'
import { visualAssets } from '../assets.ts'
import { alignmentPositions, canConnect, captureFragment, DROP_TYPE, freshIdMap, groupCommand, libraryItems, makeEntity, minimumSize, movePositions, nudgeCommand, parentChoices, previewDocument, readDrop, resizeCommand, selectionRoots, sideAtPoint, sides } from './interactions.ts'
import { editorGridOffset, effectiveGrid, snapPoint } from '../grid.ts'
import { frameResizeObserver } from './resize-observer.ts'
import type { AddSide, AlignmentAction, LibraryItem, Tool } from './interactions.ts'
import { addConnectedCommand } from './interactions.ts'
import { CatalogAccordion, CatalogOptions, ComponentPicker } from './CatalogAccordion.tsx'
import { ExportDialog } from './ExportDialog.tsx'
import type { ExportPreset } from './ExportDialog.tsx'
import { CommandMenu } from './CommandMenu.tsx'
import type { EditorAction } from './CommandMenu.tsx'
import { importCustomIcon } from '../custom-icons/import.ts'
import { validateCustomIcon } from '../custom-icons/contract.ts'
import { useTheme } from '../theme/index.ts'
import { painterOrder } from '../order.ts'
import { applyCommand } from '../document/index.ts'
import { Presentation, Expand, Crosshair, ArrowLeft } from 'lucide-react'
import { starterDocument } from '../app/session.ts'
import { starterCatalog } from '../app/starters.ts'
import type { StarterChoice } from '../app/starters.ts'
import { HelpGuide } from './HelpGuide.tsx'
import { AboutDialog } from './AboutDialog.tsx'
import { SettingsDialog } from './SettingsDialog.tsx'
import { ContextMenu } from './ContextMenu.tsx'
import { PresentationMarkup } from './PresentationMarkup.tsx'
import { FileText } from 'lucide-react'
import { MarkdownDescription } from './MarkdownDescription.tsx'
import type { MarkdownMode } from './MarkdownDescription.tsx'
import { MarkdownSidebarResize } from './MarkdownSidebarResize.tsx'
import { ArrangeMenu } from './ArrangeMenu.tsx'
import { TopMenus } from './TopMenus.tsx'
import type { TopMenu } from './TopMenus.tsx'

type ArchitectureNode = Node<{ entity: Entity; backgroundColor: string; minWidth: number; minHeight: number; writable: boolean; presenting: boolean; startResize(): void; quickAddSourceId: string | null; onQuickAdd(side: AddSide): void; onDeleteComponent(): void }, 'architecture'>
type ArchitectureEdge = Edge<{ connection: SceneConnection; backgroundColor: string }, 'architecture'>
type Measurement = { width: number; height: number; canonicalWidth: number; canonicalHeight: number }
type Transaction = { key: string; command: DocumentCommand; documentId: string; revision: number }
type ConnectedPicker = { document: Diagram; revision: number; selection: string; sourceId: string; side: AddSide }
type InlineEdit = { document: Diagram; revision: number; id: string; kind: 'entity' | 'connection'; value: string; multiline: boolean; error: string }
type Viewport = { x: number; y: number; zoom: number }
type CanvasContext = { document: Diagram; revision: number; writable: boolean; kind: 'pane' | 'entity' | 'connection'; id?: string; point: Point; screen: Point; origin: HTMLElement | null }
type PresentationSnapshot = { document: Diagram; viewport: { x: number; y: number; zoom: number }; libraryRequested: boolean; inspectorRequested: boolean; inspectorIntent: boolean | null; sidebarView: 'properties' | 'markdown'; markdownMode: MarkdownMode; sidebarWidth: number; tool: Tool; selectedIds: string[]; selectedEdges: string[]; focus: HTMLElement | null; focusLabel: string | null }
const SAVE_LABELS = { loading: 'Loading local work', saving: 'Saving locally', saved: 'Saved on this device', error: 'Local save failed', 'read-only': 'Read-only' }
const entersStarterChooser = (target: EventTarget | null) => target instanceof HTMLElement && target.getAttribute('aria-label') === 'New diagram'
const tools: { tool: Tool; icon: LucideIcon; label: string }[] = [{ tool: 'select', icon: MousePointer2, label: 'Select tool' }, { tool: 'pan', icon: Hand, label: 'Pan tool' }, { tool: 'component', icon: Boxes, label: 'Add component' }, { tool: 'connector', icon: Cable, label: 'Connect components' }, { tool: 'boundary', icon: Frame, label: 'Add boundary' }, { tool: 'text', icon: Type, label: 'Add text' }, { tool: 'rectangle', icon: Square, label: 'Add rectangle' }]
const positions = { top: Position.Top, right: Position.Right, bottom: Position.Bottom, left: Position.Left }
const addDirections: { side: AddSide; icon: LucideIcon }[] = [{ side: 'left', icon: ArrowLeft }, { side: 'right', icon: ArrowRight }, { side: 'top', icon: ArrowUp }, { side: 'bottom', icon: ArrowDown }]

function IconButton({ icon: Icon, label, active, className = '', ...props }: { icon: LucideIcon; label: string; active?: boolean } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'>) {
  const tooltipId = useId()
  const [anchor, setAnchor] = useState<{ left: number; top: number; above: boolean } | null>(null)
  const hovered = useRef(false)
  const focused = useRef(false)
  const pointerFocus = useRef(false)
  useEffect(() => { setAnchor(null) }, [props.disabled, active, label])
  useEffect(() => {
    if (!anchor) return
    const hide = () => setAnchor(null)
    const keydown = (event: globalThis.KeyboardEvent) => { if (['Escape', 'Enter', ' '].includes(event.key)) hide() }
    const otherTip = (event: Event) => { if ((event as CustomEvent<string>).detail !== tooltipId) hide() }
    window.addEventListener('scroll', hide, true); window.addEventListener('resize', hide); window.addEventListener('blur', hide)
    document.addEventListener('pointerdown', hide, true); document.addEventListener('keydown', keydown, true); document.addEventListener('editor-tooltip', otherTip)
    return () => { window.removeEventListener('scroll', hide, true); window.removeEventListener('resize', hide); window.removeEventListener('blur', hide); document.removeEventListener('pointerdown', hide, true); document.removeEventListener('keydown', keydown, true); document.removeEventListener('editor-tooltip', otherTip) }
  }, [anchor, tooltipId])
  function show(button: HTMLButtonElement) {
    if (button.disabled || button.closest('[inert]')) return
    document.dispatchEvent(new CustomEvent('editor-tooltip', { detail: tooltipId }))
    const bounds = button.getBoundingClientRect()
    const above = bounds.bottom + 48 > window.innerHeight
    setAnchor({ left: Math.max(112, Math.min(window.innerWidth - 112, bounds.left + bounds.width / 2)), top: above ? bounds.top - 8 : bounds.bottom + 8, above })
  }
  return <><button type="button" className={`icon-button ${active ? 'active' : ''} ${className}`} aria-label={label} aria-pressed={active} aria-describedby={anchor ? tooltipId : undefined} {...props} title={undefined}
    onPointerDown={event => { pointerFocus.current = true; focused.current = false; setAnchor(null); props.onPointerDown?.(event) }} onClick={event => { setAnchor(null); props.onClick?.(event) }}
    onFocus={event => { focused.current = !pointerFocus.current; if (event.currentTarget.closest('.tool-rail')) event.currentTarget.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); if (focused.current) show(event.currentTarget); props.onFocus?.(event) }} onBlur={event => { focused.current = false; pointerFocus.current = false; setAnchor(null); props.onBlur?.(event) }}
    onMouseEnter={event => { hovered.current = true; show(event.currentTarget); props.onMouseEnter?.(event) }} onMouseLeave={event => { hovered.current = false; setAnchor(null); props.onMouseLeave?.(event) }}><Icon size={18} strokeWidth={1.7} /></button>{anchor && createPortal(<span id={tooltipId} role="tooltip" className={`action-tooltip ${anchor.above ? 'above' : ''}`} style={{ left: anchor.left, top: anchor.top }}>{label}</span>, document.body)}</>
}
function sameEntityPaint(before: Entity, after: Entity): boolean {
  return before.kind === after.kind && before.label === after.label && before.subtitle === after.subtitle && before.icon === after.icon && before.status === after.status && before.color === after.color && before.width === after.width && before.height === after.height && before.customIcon?.name === after.customIcon?.name && before.customIcon?.dataUrl === after.customIcon?.dataUrl && before.customIcon?.width === after.customIcon?.width && before.customIcon?.height === after.customIcon?.height
}
const EntityArtwork = memo(function EntityArtwork({ entity, backgroundColor }: { entity: Entity; backgroundColor: string }) {
  return <svg width={entity.width} height={entity.height} viewBox={`0 0 ${entity.width} ${entity.height}`} aria-label={entity.label} dangerouslySetInnerHTML={{ __html: isWhiteBackground(backgroundColor) ? entityMarkup(entity, visualAssets) : entityMarkup(entity, visualAssets, backgroundColor) }} />
}, (before, after) => before.backgroundColor === after.backgroundColor && sameEntityPaint(before.entity, after.entity))
const ArchitectureTile = memo(function ArchitectureTile({ data, selected }: NodeProps<ArchitectureNode>) {
  const entity = data.entity
  const connectable = entity.kind === 'component' || entity.kind === 'boundary'
  return <div className={`architecture-tile ${entity.kind} ${selected ? 'tile-selected' : ''}`}>
    <EntityArtwork entity={entity} backgroundColor={data.backgroundColor} />
    {!data.presenting && selected && data.quickAddSourceId === entity.id && <NodeToolbar nodeId={entity.id} isVisible position={Position.Top} align="start" offset={12}><div className="quick-add-actions nodrag nopan" role="group" aria-label={`Add connected from ${entity.label}`} onClick={event => event.stopPropagation()}>{addDirections.map(({ side, icon }) => <IconButton key={side} icon={icon} label={`Add connected component ${side}`} disabled={!data.writable} onClick={() => data.onQuickAdd(side)} />)}{entity.kind === 'component' && <IconButton icon={Trash2} label="Delete component" className="quick-delete-component" disabled={!data.writable} onPointerDown={event => event.stopPropagation()} onMouseDown={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()} onClick={() => data.onDeleteComponent()} />}</div></NodeToolbar>}
    {!data.presenting && (entity.kind === 'boundary' || entity.kind === 'rectangle' || entity.kind === 'text') && <NodeResizer isVisible={selected && data.writable} minWidth={data.minWidth} minHeight={data.minHeight} onResizeStart={data.startResize} color="#117865" />}
    {!data.presenting && connectable && Object.entries(positions).map(([side, position]) => <Handle key={side} type="source" position={position} id={side} isConnectable={data.writable} aria-label={`${entity.label} ${side} connector`} />)}
  </div>
}, (before, after) => before.selected === after.selected && before.data.backgroundColor === after.data.backgroundColor && before.data.presenting === after.data.presenting && before.data.writable === after.data.writable && before.data.minWidth === after.data.minWidth && before.data.minHeight === after.data.minHeight && before.data.startResize === after.data.startResize && before.data.quickAddSourceId === after.data.quickAddSourceId && before.data.onQuickAdd === after.data.onQuickAdd && before.data.onDeleteComponent === after.data.onDeleteComponent && sameEntityPaint(before.data.entity, after.data.entity))
const ArchitectureLink = memo(function ArchitectureLink({ data }: EdgeProps<ArchitectureEdge>) {
  if (!data) return null
  return <g><path d={data.connection.path} stroke="transparent" strokeWidth={20} fill="none" className="react-flow__edge-interaction" /><g dangerouslySetInnerHTML={{ __html: isWhiteBackground(data.backgroundColor) ? connectionMarkup(data.connection) : connectionMarkup(data.connection, data.backgroundColor) }} /></g>
}, (before, after) => {
  if (before.data === after.data) return true
  if (!before.data || !after.data) return false
  const previous = before.data.connection, next = after.data.connection
  return before.data.backgroundColor === after.data.backgroundColor && previous.path === next.path && previous.label === next.label && previous.style === next.style && previous.arrow === next.arrow && previous.labelPosition.x === next.labelPosition.x && previous.labelPosition.y === next.labelPosition.y
})
const nodeTypes = { architecture: ArchitectureTile }
const edgeTypes = { architecture: ArchitectureLink }
function Property({ label, children }: { label: string; children: ReactNode }) { return <label className="property"><span>{label}</span>{children}</label> }
function DraftField({ label, value, maxLength, disabled, multiline, onDraft, onFinish, onCancel, deferFinish }: { label: string; value: string; maxLength: number; disabled: boolean; multiline?: boolean; onDraft(value: string): void; onFinish(): void; onCancel(): void; deferFinish(): boolean }) {
  const composing = useRef(false)
  const blurred = useRef(false)
  const props = { 'aria-label': label, value, maxLength, disabled, onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onDraft(event.target.value),
    onCompositionStart: () => { composing.current = true },
    onCompositionEnd: () => { composing.current = false; if (blurred.current) { blurred.current = false; queueMicrotask(onFinish) } },
    onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (deferFinish() || entersStarterChooser(event.relatedTarget)) return; if (composing.current) blurred.current = true; else onFinish() }, onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (composing.current || event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key === 'Escape') { event.stopPropagation(); onCancel(); event.currentTarget.blur() }
    if (event.key === 'Enter' && !multiline && !event.nativeEvent.isComposing) event.currentTarget.blur()
  } }
  return multiline ? <textarea {...props} rows={5} /> : <input {...props} />
}
function HexField({ color, disabled, label = 'Hex color', onDraft, onFinish, onCancel }: { color: string; disabled: boolean; label?: string; onDraft(color: string): void; onFinish(): void; onCancel(): void }) {
  const errorId = useId()
  const [value, setValue] = useState(color.startsWith('#') ? color : '')
  const [error, setError] = useState(false)
  useEffect(() => { setValue(color.startsWith('#') ? color : ''); setError(false) }, [color])
  function finish() {
    if (disabled) return
    const valid = isHexColor(value) && isColorKey(value)
    setError(!!value && !valid)
    if (valid) onFinish(); else onCancel()
  }
  return <><input aria-label={label} value={value} placeholder="#0078d4" disabled={disabled} maxLength={7} aria-invalid={error} aria-describedby={error ? errorId : undefined} onChange={event => {
    if (disabled) return
    const next = event.target.value
    setValue(next); setError(!!next && !(isHexColor(next) && isColorKey(next)))
    if (isHexColor(next) && isColorKey(next)) onDraft(next)
    else onCancel()
  }} onBlur={finish} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.stopPropagation(); setValue(color.startsWith('#') ? color : ''); setError(false); onCancel() } }} />{error && <small id={errorId} className="field-error" role="alert">Use #RGB or #RRGGBB.</small>}</>
}
function StarterPreview({ choice }: { choice: StarterChoice }) {
  const document = starterDocument(choice.key)
  const scene = buildScene(document)
  return <svg className="starter-preview" viewBox={`${scene.contentBounds.x} ${scene.contentBounds.y} ${Math.max(1, scene.contentBounds.width)} ${Math.max(1, scene.contentBounds.height)}`} aria-hidden="true">
    <defs dangerouslySetInnerHTML={{ __html: MARKERS }} />
    {scene.entities.filter(entity => entity.kind === 'boundary').map(entity => <g key={entity.id} transform={`translate(${entity.absolute.x} ${entity.absolute.y})`} dangerouslySetInnerHTML={{ __html: entityMarkup(entity, visualAssets, scene.entityBackgrounds[entity.id]) }} />)}
    {scene.connections.map(connection => <g key={connection.id} data-preview-connection={connection.id} dangerouslySetInnerHTML={{ __html: connectionMarkup(connection, scene.connectionBackgrounds[connection.id]) }} />)}
    {scene.entities.filter(entity => entity.kind !== 'boundary').map(entity => <g key={entity.id} transform={`translate(${entity.absolute.x} ${entity.absolute.y})`} dangerouslySetInnerHTML={{ __html: entityMarkup(entity, visualAssets, scene.entityBackgrounds[entity.id]) }} />)}
  </svg>
}
function StarterChooser({ onChoose, onCancel }: { onChoose(choice: StarterChoice | null): void; onCancel(): void }) {
  const titleId = useId()
  return <div className="starter-overlay" onKeyDown={event => {
    event.stopPropagation()
    if (event.nativeEvent.isComposing || event.nativeEvent.keyCode === 229) return
    if (event.key === 'Escape') { event.preventDefault(); onCancel() }
    if (event.ctrlKey || event.metaKey || event.altKey) return
    const buttons = [...event.currentTarget.querySelectorAll<HTMLButtonElement>('.starter-dialog button:not(:disabled)')]
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    const backward = event.key === 'ArrowLeft' || event.key === 'ArrowUp'
    const forward = event.key === 'ArrowRight' || event.key === 'ArrowDown'
    if (backward || forward || (event.key === 'Tab' && (event.shiftKey ? index <= 0 : index === buttons.length - 1))) {
      event.preventDefault()
      const next = buttons[(index + (backward || (event.key === 'Tab' && event.shiftKey) ? -1 : 1) + buttons.length) % buttons.length]
      next?.focus()
      next?.scrollIntoView?.({ block: 'nearest' })
    }
  }}>
    <button type="button" className="starter-backdrop" tabIndex={-1} aria-label="Dismiss new diagram choices" onClick={onCancel} />
    <section className="starter-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <header><h2 id={titleId}>New diagram</h2><button type="button" aria-label="Close new diagram" title="Close new diagram" onClick={onCancel}><X size={18} /></button></header>
      <div className="starter-choices"><button type="button" autoFocus aria-label="Blank" className="starter-choice blank default" onClick={() => onChoose(null)}><span>Blank</span><small>Empty diagram</small></button>{starterCatalog.map(choice => <button type="button" key={choice.key} aria-label={choice.label} className="starter-choice" onClick={() => onChoose(choice)}><StarterPreview choice={choice} /><span>{choice.label}</span><small>{choice.sourceCue}</small></button>)}</div>
    </section>
  </div>
}
function changed(document: Diagram, command: DocumentCommand): boolean {
  if (command.type === 'metadata') return Object.entries(command.patch).some(([key, value]) => key === 'grid' ? JSON.stringify(document.grid) !== JSON.stringify(value) : document[key as keyof MetadataPatch] !== value)
  if (command.type === 'move') return command.positions.some(point => document.entities.some(entity => entity.id === point.id && (point.x !== entity.x || point.y !== entity.y)))
  if (command.type === 'resize') return document.entities.some(entity => entity.id === command.id && (entity.width !== command.width || entity.height !== command.height))
  if (command.type === 'updateEntity' || command.type === 'updateConnection') {
    const target = (command.type === 'updateEntity' ? document.entities : document.connections).find(item => item.id === command.id)
    return !!target && Object.entries(command.patch).some(([key, value]) => (target as unknown as Record<string, unknown>)[key] !== value)
  }
  return true
}

function InlineLabel({ edit, style, onDraft, onFinish, onCancel, onComposing, deferFinish }: { edit: InlineEdit; style: CSSProperties; onDraft(value: string): void; onFinish(): void; onCancel(): void; onComposing(active: boolean): void; deferFinish(): boolean }) {
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null)
  const composing = useRef(false)
  const blurred = useRef(false)
  const errorId = useId()
  useLayoutEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const fieldProps = { ref: input, value: edit.value, 'aria-label': edit.kind === 'connection' ? 'Inline connection label' : edit.multiline ? 'Inline note text' : 'Inline component label', 'aria-invalid': !!edit.error, 'aria-describedby': edit.error ? errorId : undefined,
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => onDraft(event.target.value),
    onCompositionStart: () => { composing.current = true; onComposing(true) },
    onCompositionEnd: () => { composing.current = false; onComposing(false); if (blurred.current) { blurred.current = false; queueMicrotask(onFinish) } },
    onBlur: (event: FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => { if (deferFinish() || entersStarterChooser(event.relatedTarget)) return; if (composing.current) blurred.current = true; else onFinish() },
    onKeyDown: (event: KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      event.stopPropagation()
      if (event.nativeEvent.isComposing || composing.current || event.keyCode === 229) return
      if (event.key === 'Escape') { event.preventDefault(); onCancel() }
      else if (event.key === 'Enter' && (!edit.multiline || event.ctrlKey || event.metaKey)) { event.preventDefault(); onFinish() }
    } }
  return <div className="inline-label nodrag nopan nowheel" style={style} onPointerDown={event => event.stopPropagation()} onClick={event => event.stopPropagation()} onDoubleClick={event => event.stopPropagation()}>
    {edit.multiline ? <textarea {...fieldProps} rows={3} /> : <input {...fieldProps} />}
    {edit.error && <small id={errorId} role="alert" className="field-error">{edit.error}</small>}
  </div>
}

export default function EditorSurface(props: EditorProps) {
  const editorElement = useRef<HTMLDivElement>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [guidePanel, setGuidePanel] = useState<'library' | 'inspector' | null>(null)
  const guideActive = useRef(false)
  const guideOpening = useRef(false)
  const guideReturn = useRef(false)
  // About reuses the guide's guideActive/guideOpening guards (draft-preserving
  // blur capture, click capture and shortcut suppression) while it is open.
  const [aboutOpen, setAboutOpen] = useState(false)
  const [informationKind, setInformationKind] = useState<'About' | 'Settings'>('About')
  const aboutReturn = useRef(false)
  const composing = useRef(false)
  const keyboardOwner = useRef(false)
  const [inlineEdit, setInlineEdit] = useState<InlineEdit | null>(null)
  const inlineRef = useRef<InlineEdit | null>(null)
  const inlineComposing = useRef(false)
  const inlineOrigin = useRef<HTMLElement | null>(null)
  const [commandsOpen, setCommandsOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<CanvasContext | null>(null)
  const secondaryPress = useRef<{ x: number; y: number; moved: boolean } | null>(null)
  const commandOrigin = useRef<HTMLElement | null>(null)
  const commandReturn = useRef(false)
  const [starterOpen, setStarterOpen] = useState(false)
  const starterOrigin = useRef<HTMLElement | null>(null)
  const starterReturn = useRef(false)
  const starterDocumentId = useRef<string | null>(null)
  const acceptedStarter = useRef(false)
  const starterStarting = useRef(false)
  const starterOpening = useRef(false)
  // True while the picker shows the fresh-workspace offer: Blank then simply keeps the empty canvas.
  const starterFresh = useRef(false)
  const starterAttempt = useRef(0)
  const pendingAction = useRef<string | null>(null)
  const propertyFocus = useRef<string | null>(null)
  const [presenting, setPresenting] = useState(false)
  const presentationActive = useRef(false)
  const presentationCallback = useRef(props.onPresentationChange)
  presentationCallback.current = props.onPresentationChange
  const snapshot = useRef<PresentationSnapshot | null>(null)
  const entryCommit = useRef<Diagram | null>(null)
  const lastCommit = useRef<{ source: Diagram; expected: Diagram; focus: HTMLElement | null } | null>(null)
  const restoreFocus = useRef<HTMLElement | null>(null)
  const restoreFocusLabel = useRef<string | null>(null)
  const entryFocus = useRef<HTMLElement | null>(null)
  const [pointerEnabled, setPointerEnabled] = useState(false)
  const [pointer, setPointer] = useState<Point>({ x: 0, y: 0 })
  const pointerElement = useRef<HTMLDivElement>(null)
  const exitButton = useRef<HTMLButtonElement>(null)
  const ownsFullscreen = useRef(false)
  const storageWritable = !props.readOnly && props.saveState !== 'loading'
  const writable = storageWritable && !presenting
  const [draft, setDraft] = useState<Diagram | null>(null)
  const transaction = useRef<Transaction | null>(null)
  const gestureCancelled = useRef(false)
  const physicalPress = useRef(false)
  const cancelledPress = useRef(false)
  const [gestureEpoch, setGestureEpoch] = useState(0)
  const engineGesture = useRef<{ document: Diagram; revision: number; measurements: Map<string, Measurement> } | null>(null)
  const flowStore = useStoreApi<ArchitectureNode, ArchitectureEdge>()
  const startResize = useCallback(() => {
    if (presentationActive.current || guideActive.current || composing.current || inlineRef.current || cancelledPress.current || !liveDocument.current.writable) return
    engineGesture.current = { document: liveDocument.current.document, revision: liveDocument.current.document.revision, measurements: measurementState.current }
    gestureCancelled.current = false
  }, [])
  const diagram = draft ?? props.document
  const grid = effectiveGrid(diagram.grid)
  const [spacingDraft, setSpacingDraft] = useState(String(grid.spacing))
  const [spacingInvalid, setSpacingInvalid] = useState(false)
  const spacingErrorId = useId()
  useEffect(() => { setSpacingDraft(String(grid.spacing)); setSpacingInvalid(false) }, [props.document.id, props.document.grid?.spacing])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [selectedEdges, setSelectedEdges] = useState<string[]>([])
  const [connectedPicker, setConnectedPicker] = useState<ConnectedPicker | null>(null)
  const selectionAfterCommit = useRef<string[] | null>(null)
  const [tool, setTool] = useState<Tool>('select')
  const [template, setTemplate] = useState<LibraryItem>(genericLibrary[3])
  const [recentIcons, setRecentIcons] = useState<string[]>([])
  const pendingInsertions = useRef<{ documentId: string; revision: number; entityId: string; icon: string }[]>([])
  const clearRecents = useCallback(() => { pendingInsertions.current = []; setRecentIcons([]) }, [])
  useEffect(() => {
    const pending = pendingInsertions.current
    const accepted = pending.filter(item => item.documentId === props.document.id && props.document.revision > item.revision && props.document.entities.some(entity => entity.id === item.entityId && entity.kind === 'component' && entity.icon === item.icon))
    pendingInsertions.current = pending.filter(item => item.documentId === props.document.id && props.document.revision === item.revision)
    if (accepted.length) setRecentIcons(current => [...new Set([...accepted.map(item => item.icon).reverse(), ...current])].slice(0, 8))
  }, [props.document])
  const [windowWidth, setWindowWidth] = useState(() => window.innerWidth)
  const [libraryRequested, setLibraryRequested] = useState(() => window.innerWidth > 640)
  const [inspectorRequested, setInspectorRequested] = useState(false)
  const [sidebarView, setSidebarView] = useState<'properties' | 'markdown'>('properties')
  const [markdownMode, setMarkdownMode] = useState<MarkdownMode>('edit')
  const [sidebarWidth, setSidebarWidth] = useState(320)
  const [sidebarSpace, setSidebarSpace] = useState(() => window.innerWidth - 56)
  const [presentationMarkdownOpen, setPresentationMarkdownOpen] = useState(false)
  const sidebarMaximum = Math.max(240, Math.min(640, presenting ? windowWidth - 56
    : windowWidth <= 900 ? Math.min(sidebarSpace, windowWidth - 56)
      : windowWidth - 56 - (libraryRequested ? windowWidth <= 1200 ? 205 : 222 : 0) - 240))
  const visibleSidebarWidth = Math.min(sidebarMaximum, Math.max(240, sidebarWidth))
  const [arrangeMenuOpen, setArrangeMenuOpen] = useState(false)
  const [topMenuOpen, setTopMenuOpen] = useState<string | null>(null)
  const { theme, toggleTheme, preferenceError } = useTheme()
  const inspectorIntent = useRef<boolean | null>(null)
  const libraryOpen = guidePanel === 'library' || (guidePanel !== 'inspector' && libraryRequested)
  const inspectorOpen = guidePanel === 'inspector' || (guidePanel !== 'library' && inspectorRequested)
  const [exportOpen, setExportOpen] = useState(false)
  useEffect(() => {
    if (!writable || presenting || props.isArranging || guideOpen || aboutOpen || commandsOpen || starterOpen || connectedPicker || exportOpen) setArrangeMenuOpen(false)
    if (presenting || props.isArranging || guideOpen || aboutOpen || commandsOpen || starterOpen || connectedPicker || exportOpen) setTopMenuOpen(null)
  }, [writable, presenting, props.isArranging, guideOpen, aboutOpen, commandsOpen, starterOpen, connectedPicker, exportOpen])
  const [exportPreset, setExportPreset] = useState<ExportPreset>({})
  const [zoom, setZoom] = useState(1)
  const [connectionStart, setConnectionStart] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const [backgroundReset, setBackgroundReset] = useState(0)
  const [isImportingIcon, setIsImportingIcon] = useState(false)
  const iconInput = useRef<HTMLInputElement>(null)
  const canvasElement = useRef<HTMLElement>(null)
  useLayoutEffect(() => {
    const canvas = canvasElement.current
    if (!canvas || windowWidth > 900 || presenting) return
    let previousWidth = -1
    const measure = () => {
      const available = Math.floor(canvas.getBoundingClientRect().width)
      if (available < 240 || available === previousWidth) return
      previousWidth = available
      setSidebarSpace(current => current === available ? current : available)
    }
    measure()
    const observer = frameResizeObserver(measure)
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [windowWidth, presenting, libraryOpen, inspectorOpen])
  const importEpoch = useRef(0)
  const importRequest = useRef(0)
  const mounted = useRef(true)
  const [hasClipboard, setHasClipboard] = useState(false)
  const clipboard = useRef<{ fragment: ClipboardFragment; pastes: number } | null>(null)
  const [measurements, setMeasurements] = useState<Map<string, Measurement>>(() => new Map())
  const measurementState = useRef(measurements)
  measurementState.current = measurements
  const idCounter = useRef(0)
  const idPrefix = useRef('')
  const previousDocumentId = useRef(props.document.id)
  // DGM-127: the session mounts an empty 'loading' placeholder, so the first real document
  // (recovered work) arrives after React Flow init. Frame exactly once, on the first document
  // that is not the empty mount placeholder; later edits, reloads and replacements keep the camera.
  const initialFrame = useRef({ pending: true, flowReady: false, mountId: props.document.id })
    const { getViewport, setViewport, screenToFlowPosition, zoomIn, zoomOut } = useReactFlow<ArchitectureNode, ArchitectureEdge>()
  const [viewport, setCamera] = useState<Viewport>(() => ({ ...getViewport() }))
  const [canvasBounds, setCanvasBounds] = useState({ width: 0, height: 0, left: 0, top: 0 })
  const currentFitCanvas = useRef(fitCanvas)
  currentFitCanvas.current = fitCanvas
  const updateCamera = useCallback((_event: unknown, next: Viewport) => {
    setZoom(next.zoom)
    setCamera(current => current.x === next.x && current.y === next.y && current.zoom === next.zoom ? current : { ...next })
  }, [])
  const liveDocument = useRef({ document: props.document, writable })
  liveDocument.current = { document: props.document, writable }
  const latestContext = useRef({ contextMenu, blocked: false })
  latestContext.current = { contextMenu, blocked: presenting || guideOpen || aboutOpen || commandsOpen || starterOpen || !!connectedPicker || exportOpen || !!entryCommit.current }
  const scene = useMemo(() => buildScene(diagram), [diagram])
  const selected = diagram.entities.find(entity => entity.id === selectedIds.at(-1))
  const quickAddSourceId = selectedIds.length === 1 && !selectedEdges.length && selected && (selected.kind === 'component' || selected.kind === 'boundary') ? selected.id : null
  const selectionKey = selectedIds.join('\n') + '\n--edges--\n' + selectedEdges.join('\n')
  const openConnectedPicker = useCallback((side: AddSide) => {
    if (!writable || presentationActive.current || !quickAddSourceId || draft || transaction.current) return
    setNotice(''); setConnectedPicker({ document: props.document, revision: props.document.revision, selection: selectionKey, sourceId: quickAddSourceId, side })
  }, [writable, quickAddSourceId, draft, props.document, props.document.revision, selectionKey])
  useEffect(() => {
    if (connectedPicker && (!writable || draft || connectedPicker.document !== props.document || connectedPicker.revision !== props.document.revision || connectedPicker.selection !== selectionKey)) setConnectedPicker(null)
  }, [connectedPicker, writable, draft, props.document, props.document.revision, selectionKey])
  const selectedEdge = selectedEdges.at(-1)
  const connection = diagram.connections.find(candidate => candidate.id === selectedEdge)
  const selectableParents = parentChoices(diagram, selectedIds)
  const multiSelection = selectedIds.length > 1
  const alignmentRoots = selectionRoots(diagram, selectedIds)
  const boundaries = selectedIds.filter(id => diagram.entities.some(entity => entity.id === id && entity.kind === 'boundary'))
  const selectedCustomIcon = validateCustomIcon(selected?.customIcon)
  const latestImport = useRef({ document: props.document, writable, selection: selectedIds.join('\n'), draft, emit })
  latestImport.current = { document: props.document, writable, selection: selectedIds.join('\n'), draft, emit }
  const quickDeleteContext = useMemo(() => ({ document: props.document, revision: props.document.revision, sourceId: selected?.kind === 'component' ? quickAddSourceId : null, writable }), [props.document, props.document.revision, selected?.kind, quickAddSourceId, selectionKey, writable])
  const latestQuickDelete = useRef({ context: quickDeleteContext, blocked: false, emit })
  latestQuickDelete.current = { context: quickDeleteContext, blocked: commandsOpen || starterOpen || !!connectedPicker || exportOpen || !!entryCommit.current, emit }
  const deleteComponent = useCallback(() => {
    const current = latestQuickDelete.current
    if (!mounted.current || current.context !== quickDeleteContext || !quickDeleteContext.writable || !quickDeleteContext.sourceId || current.blocked || guideActive.current || guideOpening.current || presentationActive.current || composing.current || inlineComposing.current || transaction.current || inlineRef.current) return
    if (quickDeleteContext.document !== liveDocument.current.document || quickDeleteContext.revision !== liveDocument.current.document.revision || !liveDocument.current.writable) return
    current.blocked = true
    current.emit({ type: 'remove', entityIds: [quickDeleteContext.sourceId], connectionIds: [] })
    setSelectedIds([]); setSelectedEdges([]); setConnectionStart(null)
  }, [quickDeleteContext])
  useEffect(() => { importEpoch.current++ }, [props.document, writable, selectedIds, draft])
  useEffect(() => { mounted.current = true; return () => {
    mounted.current = false; importRequest.current++
    if (presentationActive.current) { presentationActive.current = false; presentationCallback.current?.(false) }
  } }, [])

  function nextId() {
    if (!idPrefix.current) idPrefix.current = `editor-${crypto.randomUUID()}`
    let id: string
    do { id = `${idPrefix.current}-${++idCounter.current}` } while ([...props.document.entities, ...props.document.connections].some(item => item.id === id))
    return id
  }
  function clearPreview() {
    if (guideActive.current || guideOpening.current) return
    if (!transaction.current) return
    transaction.current = null; setDraft(null); props.onPreviewChange(null)
  }
  function cancelGesture() {
    gestureCancelled.current = true
    cancelledPress.current = physicalPress.current
    const saved = engineGesture.current?.measurements
    clearPreview(); if (saved) setMeasurements(saved); setGestureEpoch(current => current + 1)
    flowStore.getState().cancelConnection()
  }
  function blockedGesture() {
    const gesture = engineGesture.current
    return gestureCancelled.current || !liveDocument.current.writable || props.document !== liveDocument.current.document || !!gesture && (gesture.document !== liveDocument.current.document || gesture.revision !== liveDocument.current.document.revision)
  }
  useEffect(() => {
    const gesture = engineGesture.current
    if (gesture && (!writable || gesture.document !== props.document || gesture.revision !== props.document.revision)) cancelGesture()
  }, [props.document, props.document.revision, writable])
  function validInline(edit = inlineRef.current) {
    return !!edit && liveDocument.current.writable && !presentationActive.current && edit.document === liveDocument.current.document && edit.revision === liveDocument.current.document.revision
  }
  function cancelInline(restore = true) {
    inlineRef.current = null; inlineComposing.current = false; setInlineEdit(null); clearPreview()
    if (restore) { const target = inlineOrigin.current; if (target?.isConnected && !target.closest('[inert]') && !target.matches(':disabled')) target.focus(); else canvasElement.current?.focus() }
    inlineOrigin.current = null
  }
  function finishInline(restore = false) {
    const edit = inlineRef.current
    if (!edit) return true
    if (!validInline(edit)) { cancelInline(false); return true }
    if (inlineComposing.current) return false
    if (edit.error || !finish()) return false
    inlineRef.current = null; setInlineEdit(null)
    if (restore) canvasElement.current?.focus()
    return true
  }
  function openInline(id = connection?.id ?? selected?.id, kind: InlineEdit['kind'] = connection ? 'connection' : 'entity', origin?: HTMLElement) {
    if (!writable || presentationActive.current || entryCommit.current || !id || connectedPicker || exportOpen) return
    if (inlineRef.current && !finishInline()) return
    if (!finish()) return
    const target = (kind === 'entity' ? props.document.entities : props.document.connections).find(item => item.id === id)
    if (!target) return
    inlineOrigin.current = origin ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    const edit: InlineEdit = { document: props.document, revision: props.document.revision, id, kind, value: target.label, multiline: kind === 'entity' && 'kind' in target && target.kind === 'text', error: '' }
    inlineRef.current = edit; inlineComposing.current = false; setInlineEdit(edit); setConnectionStart(null); setNotice('')
    setSelectedIds(kind === 'entity' ? [id] : []); setSelectedEdges(kind === 'connection' ? [id] : [])
    updateCamera(null, getViewport())
  }
  function draftInline(value: string) {
    const edit = inlineRef.current
    if (!edit || !validInline(edit)) { cancelInline(false); return }
    const command: DocumentCommand = { type: edit.kind === 'entity' ? 'updateEntity' : 'updateConnection', id: edit.id, patch: { label: value } }
    let error = ''
    try { applyCommand(props.document, command); preview(command, `inline:${edit.id}`, false) }
    catch (failure) { clearPreview(); error = failure instanceof Error ? failure.message : 'Label could not be applied.' }
    const next = { ...edit, value, error }; inlineRef.current = next; setInlineEdit(next)
  }
  function openCommands() {
    if (guideActive.current || presentationActive.current || entryCommit.current || connectedPicker || exportOpen || commandsOpen || !finishInline()) return
    commandOrigin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setCommandsOpen(true)
  }
  function closeCommands(restore = true) {
    setCommandsOpen(false)
    commandReturn.current = restore
  }
  function openStarterChooser(origin?: HTMLElement, fresh = false) {
    if (guideActive.current || !writable || presentationActive.current || starterOpen || connectedPicker || exportOpen) return false
    starterFresh.current = fresh
    starterOpening.current = true
    starterOrigin.current = origin ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    starterDocumentId.current = props.document.id
    acceptedStarter.current = false
    starterStarting.current = false
    setStarterOpen(true)
    return true
  }
  function closeStarterChooser(restore = true) {
    starterFresh.current = false
    starterStarting.current = false
    starterOpening.current = false
    setStarterOpen(false)
    starterReturn.current = restore
  }
  function chooseStarter(choice: StarterChoice | null) {
    if (!starterOpen || starterStarting.current || !writable || presentationActive.current || starterDocumentId.current !== props.document.id) return
    starterOpening.current = false
    // Fresh offer: the empty canvas is already the Blank document, so Blank just dismisses.
    if (!choice && starterFresh.current) { closeStarterChooser(); return }
    if (!finishInline() || !finish()) return
    starterStarting.current = true
    if (!choice) {
      const attempt = ++starterAttempt.current
      props.onNew()
      setTimeout(() => { if (starterAttempt.current === attempt) starterStarting.current = false }, 0)
      return
    }
    if (!props.onChooseStarter(choice.key)) { starterStarting.current = false; return }
    acceptedStarter.current = true
    setSelectedIds([]); setSelectedEdges([]); setConnectionStart(null); setTool('select')
    closeStarterChooser(false)
  }
  function documentProperties(label = 'Document subtitle') {
    if (presentationActive.current || !finishInline() || !finish()) return
    propertyFocus.current = label; setSelectedIds([]); setSelectedEdges([]); openInspector()
  }
  useLayoutEffect(() => {
    const label = propertyFocus.current
    if (!label || !inspectorOpen || commandsOpen) return
    const field = [...(editorElement.current?.querySelectorAll<HTMLElement>('.inspector [aria-label]') ?? [])].find(element => element.getAttribute('aria-label') === label)
    if (field) { propertyFocus.current = null; field.focus() }
  }, [inspectorOpen, selectedIds, selectedEdges, commandsOpen, contextMenu])
  useLayoutEffect(() => {
    const canvas = canvasElement.current
    if (!canvas || !inlineEdit) return
    const measure = () => {
      const rect = canvas.getBoundingClientRect(), flow = canvas.querySelector('.react-flow')?.getBoundingClientRect() ?? rect
      const next = { width: rect.width, height: rect.height, left: flow.left - rect.left, top: flow.top - rect.top }
      setCanvasBounds(current => Object.keys(next).every(key => current[key as keyof typeof next] === next[key as keyof typeof next]) ? current : next)
    }
    measure()
    const observer = frameResizeObserver(measure)
    observer?.observe(canvas); window.addEventListener('resize', measure)
    return () => { observer?.disconnect(); window.removeEventListener('resize', measure) }
  }, [inlineEdit?.id, windowWidth, libraryOpen, inspectorOpen])
  useEffect(() => {
    if (inlineRef.current && !validInline()) cancelInline(false)
  }, [props.document, props.document.revision, writable])
  function closeExport(reason?: 'escape') {
    if (reason === 'escape') { gestureCancelled.current = true; clearPreview() }
    setExportOpen(false)
  }
  function finish(command?: DocumentCommand) {
    if (guideActive.current || guideOpening.current || presentationActive.current || (inlineRef.current && inlineComposing.current)) return false
    const pending = transaction.current
    const completed = command ?? pending?.command
    try {
      if (writable && completed && (!pending || (pending.documentId === props.document.id && pending.revision === props.document.revision)) && changed(props.document, completed)) {
        const expected = applyCommand(props.document, completed)
        lastCommit.current = { source: props.document, expected, focus: document.activeElement instanceof HTMLElement ? document.activeElement : null }
        importEpoch.current++; props.onCommand(completed)
      }
      if (pending) clearPreview()
      else if (command && writable) props.onPreviewChange(null)
      return true
    } catch (error) {
      lastCommit.current = null
      setNotice(error instanceof Error ? error.message : 'Edit could not be committed.')
      return false
    }
  }
  function emit(command: DocumentCommand) {
    if (guideActive.current || !writable || presentationActive.current) return
    if (transaction.current && !finish()) return
    setNotice('')
    if (changed(props.document, command)) { importEpoch.current++; props.onCommand(command) }
  }
  function openIconPicker() {
    if (!writable || presentationActive.current || isImportingIcon) return
    finish()
    iconInput.current?.click()
  }
  // Capture the destination and edit token; normalize without mutation; reject stale completion; commit exactly once.
  async function importIconFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file || !writable || presentationActive.current) return
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
        const entity = makeEntity('component', { x: center.x - 110, y: center.y - 44 }, nextId(), { icon: 'service', label: customIcon.name, subtitle: '', color: 'gray' }, props.document.grid)
        current.emit({ type: 'addEntity', entity: { ...entity, customIcon } })
        selectionAfterCommit.current = [entity.id]
      }
      setTool('select'); setConnectionStart(null)
    } catch (error) {
      if (mounted.current && request === importRequest.current) setNotice(error instanceof Error ? error.message : 'Image import failed. Choose a valid supported image.')
    } finally {
      if (mounted.current && request === importRequest.current) setIsImportingIcon(false)
    }
  }
  function preview(command: DocumentCommand, key: string, display = true) {
    if (guideActive.current || !writable || presentationActive.current) return
    if (transaction.current && transaction.current.key !== key && !finish()) return
    transaction.current = { key, command, documentId: props.document.id, revision: props.document.revision }
    const next = previewDocument(props.document, command)
    if (display) setDraft(next)
    props.onPreviewChange(next)
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
  function editGrid(patch: Partial<NonNullable<Diagram['grid']>>, typing = false) {
    if (!writable || presentationActive.current) return
    editMetadata({ grid: { ...grid, ...patch } }, typing)
  }
  function openLibrary() {
    setLibraryRequested(true)
    if (windowWidth <= 900) requestAnimationFrame(() => editorElement.current?.querySelector<HTMLElement>('.library')?.scrollIntoView?.({ block: 'nearest' }))
  }
  function openInspector(explicit = true) {
    if (!explicit && (windowWidth <= 900 || inspectorIntent.current === false)) return
    setSidebarView('properties')
    finish(); setInspectorRequested(true)
    if (explicit) inspectorIntent.current = true
  }
  function setLibraryOpen(open: boolean) {
    if (open) { openLibrary(); return }
    finish(); setLibraryRequested(false)
    if (document.activeElement?.closest('.library')) editorElement.current?.querySelector<HTMLButtonElement>('[aria-label="Add component"]')?.focus()
  }
  function setInspectorOpen(open: boolean) {
    if (open) { openInspector(); return }
    finish(); setInspectorRequested(false); inspectorIntent.current = false
    if (document.activeElement?.closest('.inspector')) canvasElement.current?.querySelector<HTMLButtonElement>('[aria-label="Sidebar"]')?.focus()
  }
  function showSidebar(view: 'properties' | 'markdown') {
    if (presentationActive.current) { setPresentationMarkdownOpen(true); return }
    if (composing.current || inlineComposing.current) return
    setSidebarView(view); setInspectorRequested(true); inspectorIntent.current = true
    if (windowWidth <= 900) requestAnimationFrame(() => editorElement.current?.querySelector<HTMLElement>('.inspector')?.scrollIntoView?.({ block: 'nearest' }))
  }
  function closeSidebar() {
    const pending = transaction.current?.command
    const pendingDescription = pending?.type === 'metadata' && Object.hasOwn(pending.patch, 'description')
    if (!presentationActive.current && !pendingDescription && !finish()) return
    const label = presenting ? 'Open Markdown' : 'Sidebar'
    const scope = presenting ? '.presentation-controls' : '.canvas-toolbar'
    editorElement.current?.querySelector<HTMLButtonElement>(`${scope} [aria-label="${label}"]`)?.focus({ preventScroll: true })
    if (presentationActive.current) setPresentationMarkdownOpen(false)
    else { setInspectorRequested(false); inspectorIntent.current = false }
  }
  useEffect(() => {
    const resize = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', resize)
    return () => window.removeEventListener('resize', resize)
  }, [])
  useEffect(() => {
    if (guideActive.current) return
    const hidden = (!libraryOpen && document.activeElement?.closest('.library')) || (!inspectorOpen && document.activeElement?.closest('.inspector'))
    if (hidden) { finish(); canvasElement.current?.focus() }
  }, [libraryOpen, inspectorOpen])
  function chooseTool(next: Tool) {
    if (presentationActive.current || guideActive.current) return
    if (!writable && next === 'component') { openLibrary(); return }
    if (!writable && next !== 'select' && next !== 'pan') return
    finish(); setTool(next); setConnectionStart(null); setNotice('')
    if (next === 'connector') startResize()
    if (next === 'component') openLibrary()
  }
  function selectEntity(id: string, event?: MouseEvent) {
      if (presentationActive.current) return
    finish()
    setSelectedEdges([])
    if (event?.shiftKey || event?.ctrlKey || event?.metaKey) setSelectedIds(selectedIds.includes(id) ? selectedIds : [...selectedIds, id])
    else setSelectedIds([id])
    openInspector(false)
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
    const entity = makeEntity('component', point ?? route?.labelPosition ?? { x: 0, y: 0 }, nextId(), item, props.document.grid)
    pendingInsertions.current.push({ documentId: props.document.id, revision: props.document.revision, entityId: entity.id, icon: item.icon })
    if (connection && !point) {
      const half = snapPoint({ x: entity.width / 2, y: entity.height / 2 }, props.document.grid)
      entity.x -= half.x; entity.y -= half.y
      emit({ type: 'insertOnConnection', connectionId: connection.id, entity, upstreamId: nextId(), downstreamId: nextId() })
    } else emit({ type: 'addEntity', entity })
    selectionAfterCommit.current = [entity.id]; setTool('select'); setConnectionStart(null)
  }
  function chooseComponent(item: LibraryItem) {
    if (!writable) return
    setTemplate(item)
    setTool('component')
  }
  function chooseConnectedComponent(item: LibraryItem) {
    const picker = connectedPicker
    setConnectedPicker(null)
    if (!picker || !writable || presentationActive.current || draft || transaction.current || picker.document !== props.document || picker.revision !== props.document.revision || picker.selection !== selectionKey) return
    const counter = idCounter.current, prefix = idPrefix.current
    try {
      const command = addConnectedCommand(props.document, picker.sourceId, picker.side, item, nextId(), nextId())
      if (!command) throw new Error('Choose a component or boundary source again.')
      applyCommand(props.document, command)
      setNotice(''); importEpoch.current++; props.onCommand(command)
      pendingInsertions.current.push({ documentId: props.document.id, revision: props.document.revision, entityId: command.entity.id, icon: item.icon })
      selectionAfterCommit.current = [command.entity.id]
      setTool('select'); setConnectionStart(null)
    } catch (error) {
      idCounter.current = counter; idPrefix.current = prefix
      setNotice(error instanceof Error ? error.message : 'Component could not be added and connected.')
    }
  }
  function insertAt(event: MouseEvent) {
      if (presentationActive.current) return
    finish()
    setExportOpen(false)
    if (!writable || !['component', 'boundary', 'text', 'rectangle'].includes(tool)) { setSelectedIds([]); setSelectedEdges([]); if (inspectorIntent.current === null) setInspectorRequested(false); return }
    const point = screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false })
    if (tool === 'component') insertComponent(template, point)
    else { const entity = makeEntity(tool as Entity['kind'], point, nextId(), template, props.document.grid); emit({ type: 'addEntity', entity }); selectionAfterCommit.current = [entity.id]; setTool('select') }
  }
  function validContext(context: CanvasContext) {
    const current = latestContext.current
    return mounted.current && current.contextMenu === context && !current.blocked && !guideActive.current && !guideOpening.current && !presentationActive.current && !composing.current && !inlineComposing.current && !inlineRef.current && !transaction.current && context.document === liveDocument.current.document && context.revision === liveDocument.current.document.revision && context.writable === liveDocument.current.writable
  }
  function showContext(screen: Point, kind: CanvasContext['kind'], id?: string, origin = canvasElement.current) {
    if (latestContext.current.blocked || guideActive.current || guideOpening.current || presentationActive.current || composing.current || inlineComposing.current || inlineRef.current || transaction.current) return
    if (kind === 'entity' && !props.document.entities.some(entity => entity.id === id)) return
    if (kind === 'connection' && !props.document.connections.some(edge => edge.id === id)) return
    setContextMenu({ document: props.document, revision: props.document.revision, writable, kind, id, point: screenToFlowPosition(screen, { snapToGrid: false }), screen, origin })
  }
  function openContext(event: MouseEvent | globalThis.MouseEvent, kind: CanvasContext['kind'], id?: string) {
    if ((event.target as Element)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
    event.preventDefault(); event.stopPropagation()
    if (secondaryPress.current?.moved) return
    showContext({ x: event.clientX, y: event.clientY }, kind, id)
  }
  function trackSecondary(event: { button: number; clientX: number; clientY: number }) {
    if (event.button === 0) { physicalPress.current = true; cancelledPress.current = false }
    if (event.button === 2) secondaryPress.current = { x: event.clientX, y: event.clientY, moved: false }
  }
  function moveSecondary(event: { buttons: number; clientX: number; clientY: number }) {
    const press = secondaryPress.current
    if (press && event.buttons & 2 && Math.hypot(event.clientX - press.x, event.clientY - press.y) > 4) { press.moved = true; setContextMenu(null) }
  }
  function keyboardContext(active: Element | null) {
    const nodeId = active?.closest('.react-flow__node')?.getAttribute('data-id')
    const edgeId = active?.closest('.react-flow__edge')?.getAttribute('data-id')
    const entity = scene.entities.find(entity => entity.id === (nodeId ?? selectedIds.at(-1)))
    const edge = scene.connections.find(edge => edge.id === (edgeId ?? (!entity ? selectedEdges.at(-1) : null)))
    const bounds = canvasElement.current?.getBoundingClientRect()
    const camera = getViewport()
    const point = entity ? { x: entity.absolute.x + entity.width / 2, y: entity.absolute.y + entity.height / 2 } : edge?.labelPosition
    const screen = point ? { x: (bounds?.left ?? 0) + camera.x + point.x * camera.zoom, y: (bounds?.top ?? 0) + camera.y + point.y * camera.zoom } : { x: (bounds?.left ?? 0) + (bounds?.width ?? 0) / 2, y: (bounds?.top ?? 0) + (bounds?.height ?? 0) / 2 }
    showContext(screen, entity ? 'entity' : edge ? 'connection' : 'pane', entity?.id ?? edge?.id, active instanceof HTMLElement ? active : canvasElement.current)
  }
  useEffect(() => { if (contextMenu && !validContext(contextMenu)) setContextMenu(null) }, [contextMenu, props.document, props.document.revision, writable, guideOpen, aboutOpen, commandsOpen, starterOpen, connectedPicker, exportOpen, presenting])
  useEffect(() => { document.dispatchEvent(new CustomEvent('editor-tooltip', { detail: '' })) }, [tool, writable, presenting, guideOpen, aboutOpen, commandsOpen, starterOpen, connectedPicker, exportOpen, contextMenu])
  useEffect(() => {
    const release = () => { physicalPress.current = false }
    window.addEventListener('mouseup', release, true); window.addEventListener('pointerup', release, true); window.addEventListener('pointercancel', release, true); window.addEventListener('dragend', release, true); window.addEventListener('blur', release)
    return () => { window.removeEventListener('mouseup', release, true); window.removeEventListener('pointerup', release, true); window.removeEventListener('pointercancel', release, true); window.removeEventListener('dragend', release, true); window.removeEventListener('blur', release) }
  }, [])
  const contextActions: EditorAction[] = []
  if (contextMenu) {
    const context = contextMenu
    const entity = context.kind === 'entity' ? props.document.entities.find(entity => entity.id === context.id) : null
    const edge = context.kind === 'connection' ? props.document.connections.find(edge => edge.id === context.id) : null
    const action = (label: string, icon: LucideIcon, disabled: boolean, run: () => void) => contextActions.push({ label, icon, disabled, run: () => { if (validContext(context) && !disabled) run() } })
    for (const item of tools.filter(item => ['component', 'boundary', 'text', 'rectangle'].includes(item.tool))) action(item.label, item.icon, !writable, () => {
      if (item.tool === 'component') insertComponent(template, context.point)
      else { const added = makeEntity(item.tool as Entity['kind'], context.point, nextId(), template, props.document.grid); emit({ type: 'addEntity', entity: added }); selectionAfterCommit.current = [added.id]; setTool('select') }
    })
    if (entity && ['component', 'boundary'].includes(entity.kind)) action('Connect from here', Cable, !writable, () => { startResize(); setSelectedIds([entity.id]); setSelectedEdges([]); setTool('connector'); setConnectionStart(entity.id) })
    if (entity) {
      action('Copy', Copy, false, () => { clipboard.current = { fragment: captureFragment(props.document, [entity.id]), pastes: 0 }; setHasClipboard(true) })
      action('Duplicate', CopyPlus, !writable, () => paste(captureFragment(props.document, [entity.id]), true))
    }
    if (entity || edge) action('Delete', Trash2, !writable, () => { emit({ type: 'remove', entityIds: entity ? [entity.id] : [], connectionIds: edge ? [edge.id] : [] }); setSelectedIds([]); setSelectedEdges([]); setConnectionStart(null) })
    action('Undo', Undo2, !writable || !props.canUndo, undo)
    action('Redo', Redo2, !writable || !props.canRedo, redo)
    action('Paste', ClipboardPaste, !writable || !hasClipboard, () => paste())
    action('Properties', PanelRight, false, () => {
      if (!entity && !edge) { documentProperties(); return }
      if (!finishInline() || !finish()) return
      propertyFocus.current = entity ? entity.kind === 'text' ? 'Note text' : 'Component label' : 'Connection label'
      setSelectedIds(entity ? [entity.id] : []); setSelectedEdges(edge ? [edge.id] : []); openInspector()
    })
  }
  function connect(next: FlowConnection, reconnectId?: string) {
    if (!writable || presentationActive.current || inlineRef.current || guideActive.current || blockedGesture()) return
    if (!canConnect(diagram, next.source, next.target)) { setNotice('Choose two different components or boundaries.'); return }
    const sourceSide = sides.includes(next.sourceHandle as ConnectionSide) ? next.sourceHandle as ConnectionSide : 'auto'
    const targetSide = sides.includes(next.targetHandle as ConnectionSide) ? next.targetHandle as ConnectionSide : 'auto'
    if (reconnectId) emit({ type: 'updateConnection', id: reconnectId, patch: { from: next.source!, to: next.target!, sourceSide, targetSide } })
    else emit({ type: 'connect', connection: { id: nextId(), from: next.source!, to: next.target!, label: '', style: 'solid', arrow: 'forward', sourceSide, targetSide } })
    engineGesture.current = null
    setConnectionStart(null); setTool('select')
  }
  function moveNodes(moved: ArchitectureNode[], finished: boolean) {
    if (!writable || presentationActive.current || inlineRef.current) return
    if (blockedGesture()) { setGestureEpoch(current => current + 1); return }
    const positions = movePositions(props.document, moved)
    if (!positions.length) return
    const command: DocumentCommand = { type: 'move', positions }
    if (finished) { finish(command); engineGesture.current = null } else preview(command, 'move')
  }
  function alignSelection(action: AlignmentAction) {
    if (!writable || presentationActive.current || selectedEdges.length) return
    if (transaction.current || inlineRef.current) { finish(); return }
    if (!finish()) return
    const positions = alignmentPositions(props.document, selectedIds, action)
    if (positions) emit({ type: 'move', positions })
  }
  function updateNodes(changes: NodeChange<ArchitectureNode>[]) {
    const selections = changes.filter(change => change.type === 'select')
    if (selections.length) finish()
    if (selections.length) setSelectedIds(current => {
      const next = new Set(current)
      for (const change of selections) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id) }
      return [...next]
    })
    const dimensions = changes.filter(change => change.type === 'dimensions')
    if (!dimensions.length) return
    if (blockedGesture() && dimensions.some(change => change.resizing !== undefined)) { setGestureEpoch(current => current + 1); return }
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
    if (!writable || presentationActive.current) return
      if (presentationActive.current) return
    for (const change of dimensions) {
      if (change.type !== 'dimensions' || change.resizing === undefined || !change.dimensions) continue
      const entity = props.document.entities.find(candidate => candidate.id === change.id)
      if (!entity) continue
      const command = resizeCommand(props.document, entity, { x: entity.x, y: entity.y, ...change.dimensions })
      if (change.resizing === false) { finish(command); engineGesture.current = null } else preview(command, `resize:${entity.id}`)
    }
  }
  function undo() { if (!presentationActive.current && writable && props.canUndo) { importEpoch.current++; gestureCancelled.current = true; clearPreview(); props.onUndo() } }
  function redo() { if (!presentationActive.current && writable && props.canRedo) { importEpoch.current++; gestureCancelled.current = true; clearPreview(); props.onRedo() } }
  function fileAction(callback: () => void, mutation = false) { if (presentationActive.current || (mutation && !writable) || !finish()) return; if (mutation) importEpoch.current++; callback() }

  // Capture intent before hiding chrome; invalidate imports synchronously; frame after the presentation DOM is committed.
  function enterPresentation() {
    if (presentationActive.current || entryCommit.current || props.saveState === 'loading' || props.isArranging) return
    const invalid = canvasElement.current?.closest('.app-shell')?.querySelector<HTMLElement>('input[aria-invalid="true"], textarea[aria-invalid="true"]')
    if (invalid) { invalid.focus(); return }
    const pending = transaction.current
    let expected: Diagram | null = lastCommit.current?.source === props.document ? lastCommit.current.expected : null
    try { if (pending && changed(props.document, pending.command)) expected = applyCommand(props.document, pending.command) }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Edit could not be committed.'); return }
    if (!finishInline() || !finish()) return
    const focus = entryFocus.current ?? lastCommit.current?.focus ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null)
    snapshot.current = { document: props.document, viewport: { ...getViewport() }, libraryRequested, inspectorRequested, inspectorIntent: inspectorIntent.current, sidebarView, markdownMode, sidebarWidth, tool, selectedIds: [...selectedIds], selectedEdges: [...selectedEdges], focus, focusLabel: focus?.getAttribute('aria-label') ?? null }
    entryFocus.current = null
    if (expected) { entryCommit.current = expected; setNotice('Edit has not yet been accepted.'); return }
    activatePresentation()
  }
  function activatePresentation() {
    presentationActive.current = true; presentationCallback.current?.(true)
    importEpoch.current++; importRequest.current++
    setIsImportingIcon(false); selectionAfterCommit.current = null
    gestureCancelled.current = true
    setExportOpen(false); setConnectedPicker(null); setNotice(''); setPresenting(true)
    setPresentationMarkdownOpen(Boolean(props.document.description))
    cancelInline(false); setCommandsOpen(false)
  }
  // Restore the exact camera and intent only for the same document; never restore storage writability.
  function exitPresentation(restore = true) {
    const saved = snapshot.current
    snapshot.current = null; entryCommit.current = null
    if (presentationActive.current) { presentationActive.current = false; presentationCallback.current?.(false) }
    setPresenting(false); setPointerEnabled(false)
    if (ownsFullscreen.current && document.fullscreenElement) void document.exitFullscreen?.().catch(() => {})
    ownsFullscreen.current = false
    if (!restore || !saved) return
    setLibraryRequested(saved.libraryRequested); setInspectorRequested(saved.inspectorRequested); inspectorIntent.current = saved.inspectorIntent
    setSidebarView(saved.sidebarView); setMarkdownMode(saved.markdownMode); setSidebarWidth(saved.sidebarWidth)
    setTool(storageWritable ? saved.tool : saved.tool === 'pan' ? 'pan' : 'select'); setSelectedIds(saved.selectedIds); setSelectedEdges(saved.selectedEdges)
    setZoom(saved.viewport.zoom); void setViewport(saved.viewport, { duration: 0 })
    restoreFocus.current = saved.focus
    restoreFocusLabel.current = saved.focusLabel
  }
  async function fullscreen() {
    if (!presentationActive.current || !editorElement.current) return
    const canvas = editorElement.current
    try {
      if (!canvas.requestFullscreen) throw new Error('Fullscreen is unavailable.')
      await canvas.requestFullscreen()
      if (!presentationActive.current) { if (document.fullscreenElement === canvas) await document.exitFullscreen?.(); return }
      ownsFullscreen.current = document.fullscreenElement === canvas
      fitCanvas(selectedIds.length > 0)
    } catch { if (presentationActive.current) setNotice('Fullscreen unavailable. Presentation remains in this window.') }
  }
  useEffect(() => {
    if (lastCommit.current && props.document !== lastCommit.current.source) lastCommit.current = null
    const expected = entryCommit.current
    if (expected) {
      if (JSON.stringify(props.document) === JSON.stringify(expected)) { entryCommit.current = null; if (snapshot.current) snapshot.current.document = props.document; activatePresentation() }
      else if (props.document !== snapshot.current?.document || props.message || !storageWritable) { entryCommit.current = null; snapshot.current = null; setNotice(props.message || 'Edit was not accepted. Presentation was not opened.') }
    } else if (presenting && snapshot.current?.document !== props.document) exitPresentation(false)
  }, [props.document, props.message, storageWritable, presenting])
  useLayoutEffect(() => {
    if (presenting) {
      const canvas = canvasElement.current
      let active = true
      const reframe = () => { if (active && presentationActive.current) currentFitCanvas.current(selectedIds.length > 0) }
      exitButton.current?.focus()
      const observer = frameResizeObserver(reframe)
      if (canvas) {
        observer?.observe(canvas)
        for (const overlay of canvas.querySelectorAll<HTMLElement>('.canvas-heading, .presentation-controls, .canvas-bottom-chrome, .presentation-markup-toolbar')) observer?.observe(overlay)
      }
      void document.fonts?.ready.then(reframe)
      return () => { active = false; observer?.disconnect() }
    }
    else if (restoreFocus.current || restoreFocusLabel.current) {
      const target = restoreFocus.current?.isConnected ? restoreFocus.current : [...(canvasElement.current?.closest('.app-shell')?.querySelectorAll<HTMLElement>('[aria-label]') ?? [])].find(element => element.getAttribute('aria-label') === restoreFocusLabel.current)
      restoreFocus.current = null; restoreFocusLabel.current = null
      if (target && !target.closest('[inert]') && !target.matches(':disabled')) target.focus(); else canvasElement.current?.focus()
    }
  }, [presenting])
  useLayoutEffect(() => {
    if (presenting) currentFitCanvas.current(selectedIds.length > 0)
  }, [presenting, presentationMarkdownOpen, visibleSidebarWidth, windowWidth])
  useEffect(() => {
    const changed = () => {
      if (!presentationActive.current) return
      if (document.fullscreenElement === editorElement.current) ownsFullscreen.current = true
      else if (ownsFullscreen.current) exitPresentation()
    }
    document.addEventListener('fullscreenchange', changed)
    return () => document.removeEventListener('fullscreenchange', changed)
  })

  // Frame absolute scene geometry; subtract fixed chrome in pixels; update only the camera.
  function fitCanvas(selectionOnly = false) {
    const canvas = canvasElement.current
    if (!canvas || !scene.entities.length || (selectionOnly && !selectedIds.length)) return
    const rect = canvas.getBoundingClientRect()
    let left = 24, right = rect.width - 24, top = 24, bottom = rect.height - 24
    for (const overlay of canvas.querySelectorAll<HTMLElement>('[data-fit-chrome]')) {
      const bounds = overlay.getBoundingClientRect()
      if (!bounds.width || !bounds.height) continue
      if (overlay.dataset.fitChrome === 'top') top = Math.max(top, bounds.bottom - rect.top + 24)
      else bottom = Math.min(bottom, bounds.top - rect.top - 24)
    }
    if (windowWidth <= 900 && (presenting ? presentationMarkdownOpen : inspectorOpen)) {
      const availableRight = canvas.parentElement!.querySelector('.inspector')!.getBoundingClientRect().left - rect.left - 24
      if (availableRight - left >= 240) right = Math.min(right, availableRight)
    }
    if (!presenting && windowWidth <= 640 && libraryOpen) left = Math.max(left, canvas.parentElement!.querySelector('.library')!.getBoundingClientRect().right - rect.left + 24)
    if (right <= left || bottom <= top) return
    const included = selectionOnly ? new Set(captureFragment(diagram, selectedIds).entities.map(entity => entity.id)) : null
    const bounds = included ? getNodesBounds(scene.entities.filter(entity => included.has(entity.id)).map(entity => ({ id: entity.id, position: entity.absolute, width: entity.width, height: entity.height, data: {} }))) : scene.contentBounds
    const viewport = getViewportForBounds(bounds, right - left, bottom - top, .001, selectionOnly ? 2 : .9, 0)
    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const next = { zoom: viewport.zoom, x: left + (right - left - bounds.width * viewport.zoom) / 2 - bounds.x * viewport.zoom, y: top + (bottom - top - bounds.height * viewport.zoom) / 2 - bounds.y * viewport.zoom }
    const current = getViewport()
    if (Math.abs(current.x - next.x) < 1e-6 && Math.abs(current.y - next.y) < 1e-6 && Math.abs(current.zoom - next.zoom) < 1e-6) return
    void setViewport(next, { duration: presenting || reducedMotion ? 0 : 200 })
  }
  // Pseudocode: wait until React Flow is ready; skip while still showing the empty mount
  // placeholder; otherwise consume the one-shot and fit (a fresh blank consumes it with a no-op fit).
  function settleInitialFrame() {
    const frame = initialFrame.current
    if (!frame.pending || !frame.flowReady) return
    if (props.document.id === frame.mountId && !scene.entities.length) return
    frame.pending = false
    fitCanvas()
  }
  useEffect(settleInitialFrame, [props.document.id])

  useEffect(() => {
    const pending = transaction.current
    if (pending && (!writable || pending.documentId !== props.document.id || pending.revision !== props.document.revision)) { gestureCancelled.current = true; clearPreview() }
    if (starterOpen && (!writable || presentationActive.current)) closeStarterChooser(false)
    const accepted = selectionAfterCommit.current
    if (accepted?.every(id => props.document.entities.some(entity => entity.id === id))) { setSelectedIds(accepted); setSelectedEdges([]) }
    else { setSelectedIds(current => current.filter(id => props.document.entities.some(entity => entity.id === id))); setSelectedEdges(current => current.filter(id => props.document.connections.some(connection => connection.id === id))) }
    selectionAfterCommit.current = null
    if (previousDocumentId.current !== props.document.id) {
      previousDocumentId.current = props.document.id
      if (starterOpen) closeStarterChooser(false)
      if (acceptedStarter.current) { setSelectedIds([]); setSelectedEdges([]); acceptedStarter.current = false }
      setTool('select'); setConnectionStart(null); setMeasurements(new Map()); setNotice('')
    }
    if (!storageWritable) { setTool(current => current === 'pan' ? 'pan' : 'select'); setConnectionStart(null) }
  }, [props.document.id, props.document.revision, writable])
  // DGM-127: a fresh workspace offers the unified New diagram picker once. Wait while another
  // surface is blocking; acknowledge only after the picker actually opened.
  const starterOfferedCallback = useRef(props.onStarterOffered)
  starterOfferedCallback.current = props.onStarterOffered
  const starterOfferTaken = useRef(false)
  useEffect(() => {
    // Re-arm only after the parent withdrew the offer, so a slow acknowledgement never reopens it.
    if (!props.starterOffer) { starterOfferTaken.current = false; return }
    if (starterOfferTaken.current || presenting || guideOpen || aboutOpen || commandsOpen || starterOpen || connectedPicker || exportOpen) return
    if (!openStarterChooser(canvasElement.current ?? undefined, true)) return
    starterOfferTaken.current = true
    starterOfferedCallback.current?.()
  }, [props.starterOffer, writable, presenting, guideOpen, aboutOpen, commandsOpen, starterOpen, connectedPicker, exportOpen])
  const previewCallback = useRef(props.onPreviewChange)
  previewCallback.current = props.onPreviewChange
  useEffect(() => () => { if (transaction.current) previewCallback.current(null) }, [])
  useEffect(() => {
    const cancelActiveGesture = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape' || !physicalPress.current || !engineGesture.current) return
      if (guideActive.current || presentationActive.current || composing.current || inlineComposing.current || inlineRef.current || event.isComposing || event.keyCode === 229) return
      if (starterOpen || commandsOpen || connectedPicker || exportOpen || contextMenu || arrangeMenuOpen || topMenuOpen || entryCommit.current) return
      if ((event.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      event.preventDefault(); event.stopPropagation()
      cancelGesture(); setTool('select'); setConnectionStart(null)
    }
    const keydown = (event: globalThis.KeyboardEvent) => {
      if (guideActive.current || composing.current || event.isComposing || event.keyCode === 229) return
      const modifier = event.ctrlKey || event.metaKey
      const key = event.key.toLowerCase()
      const root = editorElement.current, active = document.activeElement
      const ownsFocus = !!root && (root.contains(active) || (active === document.body && keyboardOwner.current))
      if ((key === 'f2' || (modifier && key === 'k')) && !ownsFocus) return
      if (presentationActive.current) {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); exitPresentation(); return }
        if ((event.target as HTMLElement)?.closest?.('[data-markdown-preview]')) return
        if (event.ctrlKey || event.metaKey || event.altKey || ['Delete', 'Backspace', 'F2'].includes(event.key)) event.preventDefault()
        return
      }
      if (event.key !== 'Escape' && (event.target as HTMLElement)?.closest?.('[data-markdown-preview], [data-markdown-ui]')) return
      if ((event.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable="true"]')) return
      if (starterOpen) { if (event.key === 'Escape') { event.preventDefault(); closeStarterChooser() }; return }
      if (commandsOpen) return
      if (connectedPicker) return
      if (exportOpen) { if (event.key === 'Escape') { event.preventDefault(); closeExport('escape') }; return }
      if (contextMenu) return
      if (topMenuOpen) return
      if (arrangeMenuOpen) { if (event.key === 'Escape') { event.preventDefault(); setArrangeMenuOpen(false) }; return }
      if (ownsFocus && (event.key === 'ContextMenu' || (event.key === 'F10' && event.shiftKey && !modifier && !event.altKey))) { event.preventDefault(); keyboardContext(active); return }
      if (modifier && key === 'k' && !event.altKey) { event.preventDefault(); openCommands(); return }
      if (key === 'f2' && !modifier && !event.altKey) { event.preventDefault(); if (writable) openInline(); return }
      if (key === 'escape') { cancelGesture(); setTool('select'); setConnectionStart(null); setExportOpen(false); setInspectorOpen(false); return }
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
    window.addEventListener('keydown', cancelActiveGesture, true)
    window.addEventListener('keydown', keydown)
    return () => { window.removeEventListener('keydown', cancelActiveGesture, true); window.removeEventListener('keydown', keydown) }
  })
  useEffect(() => {
    const pointerdown = (event: PointerEvent) => { keyboardOwner.current = !!editorElement.current?.contains(event.target as globalThis.Node) }
    document.addEventListener('pointerdown', pointerdown)
    return () => document.removeEventListener('pointerdown', pointerdown)
  }, [])

  const paint = useMemo(() => painterOrder(diagram.entities), [diagram])
  const ordered = useMemo(() => scene.entities.map(entity => ({ entity, min: minimumSize(diagram, entity) })), [scene, diagram])
  const nodes = useMemo<ArchitectureNode[]>(() => ordered.map(({ entity, min }) => {
    const measured = measurements.get(entity.id)
    return { id: entity.id, type: 'architecture', position: { x: entity.x, y: entity.y }, parentId: entity.parentId ?? undefined, width: entity.width, height: entity.height, measured: measured && measured.canonicalWidth === entity.width && measured.canonicalHeight === entity.height ? { width: measured.width, height: measured.height } : { width: entity.width, height: entity.height }, style: { width: entity.width, height: entity.height }, selected: !presenting && selectedIds.includes(entity.id), data: { entity, backgroundColor: scene.entityBackgrounds[entity.id], minWidth: min.width, minHeight: min.height, writable, presenting, startResize, quickAddSourceId, onQuickAdd: openConnectedPicker, onDeleteComponent: deleteComponent }, zIndex: paint.nodeZIndices.get(entity.id)! }
  }), [ordered, scene, paint, measurements, selectedIds, writable, presenting, startResize, quickAddSourceId, openConnectedPicker, deleteComponent, gestureEpoch])
  const edges = useMemo<ArchitectureEdge[]>(() => scene.connections.map(item => ({ id: item.id, type: 'architecture', source: item.from, target: item.to, sourceHandle: item.sourceSide && item.sourceSide !== 'auto' ? item.sourceSide : sideAtPoint(diagram, item.from, item.start), targetHandle: item.targetSide && item.targetSide !== 'auto' ? item.targetSide : sideAtPoint(diagram, item.to, item.end), selected: !presenting && selectedEdges.includes(item.id), reconnectable: writable, data: { connection: item, backgroundColor: scene.connectionBackgrounds[item.id] }, zIndex: paint.connectionZIndex })), [scene, paint, diagram, selectedEdges, writable, presenting])
  const customBackground = !isWhiteBackground(scene.backgroundColor)
  // Workspace appearance is deliberately separate from the canonical scene:
  // explicit colors, Present, JSON and all export backgrounds stay unchanged.
  const workspaceBackground = !presenting && theme === 'light' && diagram.backgroundColor === undefined ? '#faf8f3' : scene.backgroundColor
  const panelTitle = multiSelection ? 'Selection' : selected ? ({ component: 'Component', boundary: 'Boundary', text: 'Text', rectangle: 'Rectangle' })[selected.kind] : connection ? 'Connection' : 'Document'
  const field = (label: string, value: string, maxLength: number, onDraft: (value: string) => void, multiline = false) => <DraftField label={label} value={value} maxLength={maxLength} disabled={!writable} multiline={multiline} onDraft={onDraft} onFinish={() => finish()} onCancel={clearPreview} deferFinish={() => starterOpening.current} />
  const descriptionEditor = <MarkdownDescription value={diagram.description ?? ''} mode={markdownMode} writable={writable} presenting={presenting} onModeChange={setMarkdownMode} onDraft={value => editMetadata({ description: value === '' ? undefined : value }, true)} onFinish={() => finish()} onCancel={clearPreview} deferFinish={() => starterOpening.current} />
  const mcpInteraction = useRef<() => string | null>(() => 'Editor loading')
  mcpInteraction.current = () => {
    if (presentationActive.current || entryCommit.current) return 'Presentation'
    if (composing.current || inlineComposing.current) return 'IME composition'
    if (transaction.current || inlineRef.current || draft) return 'Unfinished edit'
    if (physicalPress.current || connectionStart) return 'Active gesture'
    if (guideActive.current || guideOpening.current || guideOpen || aboutOpen || commandsOpen || starterOpen || connectedPicker || exportOpen || contextMenu || arrangeMenuOpen || topMenuOpen) return 'Open modal or menu'
    if (isImportingIcon) return 'Icon import in progress'
    if (document.activeElement instanceof HTMLElement && editorElement.current?.contains(document.activeElement) &&
        document.activeElement.matches('input, textarea, select, [contenteditable="true"]')) return 'Focused edit control'
    return null
  }
  useLayoutEffect(() => {
    props.onMcpGuard?.(() => mcpInteraction.current())
    return () => props.onMcpGuard?.(null)
  }, [props.onMcpGuard])
  const alignmentAction = (action: AlignmentAction, icon: LucideIcon, label: string) => {
    const eligible = !selectedEdges.length && !!alignmentPositions(props.document, selectedIds, action)
    const reason = selectedEdges.length ? 'Alignment requires only entities.' : alignmentRoots.length < (action.startsWith('distribute') ? 3 : 2) ? 'Select more top-level objects.' : 'Selection cannot be aligned without changing containment.'
    return <IconButton key={action} icon={icon} label={label} disabled={!writable || !eligible} title={eligible ? label : reason} aria-description={eligible ? undefined : reason} onClick={() => alignSelection(action)} />
  }
  const entityActions = <div className="selection-actions"><IconButton icon={Copy} label="Copy selection" disabled={!selectedIds.length} onClick={() => copySelection()} /><IconButton icon={Scissors} label="Cut selection" disabled={!writable || !selectedIds.length} onClick={() => copySelection(true)} /><IconButton icon={CopyPlus} label="Duplicate selection" disabled={!writable || !selectedIds.length} onClick={duplicate} /><IconButton icon={Trash2} label="Delete selection" disabled={!writable || (!selectedIds.length && !selectedEdges.length)} onClick={deleteSelection} />{alignmentRoots.length >= 2 && <><span className="separator" />{alignmentAction('align-left', ArrowLeft, 'Align left')}{alignmentAction('align-center', SlidersHorizontal, 'Align center')}{alignmentAction('align-top', ArrowUp, 'Align top')}{alignmentAction('distribute-horizontal', ArrowRight, 'Distribute horizontally')}{alignmentAction('distribute-vertical', ArrowDown, 'Distribute vertically')}</>}</div>

  const { scope: exportScope, transparent: copyTransparent = false, ...exportSettings } = exportPreset
  const copyOptions = { ...exportSettings, ...(exportScope === 'selection' ? { selectionIds: [...selectedIds] } : {}) }
  let copyUnavailable = false
  if (commandsOpen) { try { pngDimensions(buildExportScene(diagram, copyOptions), 1) } catch { copyUnavailable = true } }
  const actions: EditorAction[] = [
    { label: 'New diagram', icon: FilePlus2, disabled: !writable, run: openStarterChooser },
    ...tools.map(item => ({ label: item.label, icon: item.icon, disabled: !writable && item.tool !== 'select' && item.tool !== 'pan', run: () => chooseTool(item.tool) })),
    { label: 'Edit label (F2)', icon: Type, disabled: !writable || (!selected && !connection) || selectedIds.length + selectedEdges.length !== 1, run: () => openInline() },
    { label: 'Present', icon: Presentation, disabled: props.saveState === 'loading' || props.isArranging, run: enterPresentation },
    { label: 'Fit diagram', icon: Maximize2, disabled: !scene.entities.length, run: () => fitCanvas() },
    { label: 'Fit selection', icon: Scan, disabled: !selectedIds.length, run: () => fitCanvas(true) },
    { label: 'Align left', icon: ArrowLeft, disabled: !writable || !!selectedEdges.length || !alignmentPositions(props.document, selectedIds, 'align-left'), run: () => alignSelection('align-left') },
    { label: 'Align center', icon: SlidersHorizontal, disabled: !writable || !!selectedEdges.length || !alignmentPositions(props.document, selectedIds, 'align-center'), run: () => alignSelection('align-center') },
    { label: 'Align top', icon: ArrowUp, disabled: !writable || !!selectedEdges.length || !alignmentPositions(props.document, selectedIds, 'align-top'), run: () => alignSelection('align-top') },
    { label: 'Distribute horizontally', icon: ArrowRight, disabled: !writable || !!selectedEdges.length || !alignmentPositions(props.document, selectedIds, 'distribute-horizontal'), run: () => alignSelection('distribute-horizontal') },
    { label: 'Distribute vertically', icon: ArrowDown, disabled: !writable || !!selectedEdges.length || !alignmentPositions(props.document, selectedIds, 'distribute-vertical'), run: () => alignSelection('distribute-vertical') },
    { label: 'Undo', icon: Undo2, disabled: !writable || !props.canUndo, run: undo },
    { label: 'Redo', icon: Redo2, disabled: !writable || !props.canRedo, run: redo },
    { label: 'Copy selection', icon: Copy, disabled: !selectedIds.length, run: () => copySelection() },
    { label: 'Cut selection', icon: Scissors, disabled: !writable || !selectedIds.length, run: () => copySelection(true) },
    { label: 'Paste selection', icon: ClipboardPaste, disabled: !writable || !hasClipboard, run: () => paste() },
    { label: 'Duplicate selection', icon: CopyPlus, disabled: !writable || !selectedIds.length, run: duplicate },
    { label: 'Delete selection', icon: Trash2, disabled: !writable || (!selectedIds.length && !selectedEdges.length), run: deleteSelection },
    { label: 'Group selection', icon: Group, disabled: !writable || !selectedIds.length, run: groupSelection },
    { label: 'Ungroup selection', icon: Ungroup, disabled: !writable || !boundaries.length, run: ungroupSelection },
    { label: 'Copy image', icon: Copy, disabled: props.isExporting || props.saveState === 'loading' || !props.onCopyImage || copyUnavailable, run: () => {
      try { pngDimensions(buildExportScene(diagram, copyOptions), 1); fileAction(() => props.onCopyImage?.({ format: 'png', scale: 1, transparent: copyTransparent, ...copyOptions })) }
      catch (failure) { setNotice(failure instanceof Error ? failure.message : 'Image copy unavailable.') }
    } },
    { label: 'Export', icon: Download, disabled: props.isExporting || props.saveState === 'loading', run: () => setExportOpen(true) },
    { label: 'Diagram background', icon: Square, disabled: false, run: () => documentProperties('Diagram background color') },
    { label: 'Grid settings', icon: LayoutGrid, disabled: false, run: () => documentProperties('Show grid') },
    { label: 'Document properties', icon: PanelRight, disabled: false, run: () => documentProperties() },
  ]
  useLayoutEffect(() => {
    if (commandsOpen || !commandReturn.current) return
    commandReturn.current = false
    const origin = commandOrigin.current
    if (origin?.isConnected && !origin.closest('[inert]') && !origin.matches(':disabled')) origin.focus(); else canvasElement.current?.focus()
    const label = pendingAction.current; pendingAction.current = null
    const action = actions.find(candidate => candidate.label === label)
    if (action && !action.disabled && !presentationActive.current) action.run()
  }, [commandsOpen])
  useLayoutEffect(() => {
    if (starterOpen || !starterReturn.current) return
    starterReturn.current = false
    const origin = starterOrigin.current
    if (origin?.isConnected && !origin.closest('[inert]') && !origin.matches(':disabled')) origin.focus()
    else canvasElement.current?.focus()
  }, [starterOpen])
  const visibleInline = inlineEdit && validInline(inlineEdit) ? inlineEdit : null
  const inlineEntity = visibleInline?.kind === 'entity' ? scene.entities.find(entity => entity.id === visibleInline.id) : null
  const inlineConnection = visibleInline?.kind === 'connection' ? scene.connections.find(item => item.id === visibleInline.id) : null
  const textGeometry = inlineEntity ? entityTextGeometry(inlineEntity) : null
  const anchor = inlineEntity && textGeometry ? { x: inlineEntity.absolute.x + textGeometry.labelX, y: inlineEntity.absolute.y + textGeometry.labelY - 14 } : inlineConnection ? { x: inlineConnection.labelPosition.x, y: inlineConnection.labelPosition.y - 14 } : null
  const inlineWidth = Math.min(visibleInline?.multiline ? 360 : 240, canvasBounds.width ? Math.max(44, canvasBounds.width - 8) : 240)
  const inlineLeft = anchor ? canvasBounds.left + viewport.x + anchor.x * viewport.zoom - (inlineConnection ? inlineWidth / 2 : 0) : 0
  const inlineTop = anchor ? canvasBounds.top + viewport.y + anchor.y * viewport.zoom : 0

  const guideBlocked = presenting || commandsOpen || starterOpen || !!connectedPicker || exportOpen || !!entryCommit.current || props.isArranging || props.isExporting || isImportingIcon
  function openGuide() {
    if (guideBlocked || composing.current || inlineComposing.current) { guideOpening.current = false; return }
    guideOpening.current = false; guideActive.current = true; setGuidePanel(null); setGuideOpen(true)
  }
  function closeGuide() {
    guideReturn.current = true; setGuidePanel(null); setGuideOpen(false)
  }
  useLayoutEffect(() => {
    if (guideOpen || !guideReturn.current) return
    guideReturn.current = false
    const help = editorElement.current?.querySelector<HTMLButtonElement>('[aria-label="Settings menu"]')
    help?.focus({ preventScroll: true })
    guideActive.current = false
  }, [guideOpen])
  // About follows the guide's blocking rules and refuses to stack over it.
  function openInformation(kind: 'About' | 'Settings') {
    const refused = guideBlocked || guideOpen || aboutOpen || composing.current || inlineComposing.current
    guideOpening.current = false
    if (refused) return
    guideActive.current = true; setInformationKind(kind); setAboutOpen(true)
  }
  function openAbout() { openInformation('About') }
  function openSettings() { openInformation('Settings') }
  function closeAbout() {
    aboutReturn.current = true; setAboutOpen(false)
  }
  useLayoutEffect(() => {
    if (aboutOpen || !aboutReturn.current) return
    aboutReturn.current = false
    const about = editorElement.current?.querySelector<HTMLButtonElement>('[aria-label="Settings menu"]')
    about?.focus({ preventScroll: true })
    guideActive.current = false
  }, [aboutOpen, informationKind])
  function changeTopMenu(label: string | null) {
    if (label && (presenting || commandsOpen || starterOpen || connectedPicker || exportOpen || entryCommit.current || guideOpen || aboutOpen || composing.current || inlineComposing.current || contextMenu)) return
    if (label) setArrangeMenuOpen(false)
    setTopMenuOpen(label)
  }
  const viewAction = (run: () => void) => () => {
    if (!presentationActive.current && !guideActive.current && !commandsOpen && !starterOpen && !connectedPicker && !exportOpen && !entryCommit.current && !composing.current && !inlineComposing.current) run()
  }
  const topMenus: TopMenu[] = [
    { label: 'File', items: [
      { label: 'New diagram', disabled: !writable, run: origin => openStarterChooser(origin) },
      { label: 'Open JSON', disabled: !writable, run: () => fileAction(props.onOpen, true) },
      { label: 'Import skill JSON', disabled: !writable, run: () => fileAction(props.onImport, true) },
      { label: 'Save JSON', run: () => fileAction(props.onSaveJson) },
    ] },
    { label: 'View', items: [
      { label: 'Component library', checked: libraryOpen, run: viewAction(() => setLibraryRequested(!libraryRequested)) },
      { label: 'Sidebar', checked: inspectorOpen, run: viewAction(() => { setInspectorRequested(!inspectorRequested); inspectorIntent.current = !inspectorRequested }) },
      { label: 'Show properties', checked: inspectorOpen && sidebarView === 'properties', run: viewAction(() => showSidebar('properties')) },
      { label: 'Show Markdown', checked: inspectorOpen && sidebarView === 'markdown', run: viewAction(() => showSidebar('markdown')) },
      { label: `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`, checked: theme === 'dark', description: preferenceError ?? undefined, run: viewAction(toggleTheme) },
      { label: 'Fit diagram', disabled: !scene.entities.length, run: viewAction(() => fitCanvas()) },
      { label: 'Fit selection', disabled: !selectedIds.length, run: viewAction(() => fitCanvas(true)) },
    ] },
    { label: 'Settings', items: [
      { label: 'Settings', disabled: guideBlocked, run: openSettings },
      { label: 'Help', disabled: guideBlocked, run: openGuide },
      { label: 'About', disabled: guideBlocked, run: openAbout },
    ] },
  ]

  return <div ref={editorElement} inert={guideOpen || aboutOpen} onPointerDownCapture={trackSecondary} onMouseDownCapture={trackSecondary} onPointerMoveCapture={moveSecondary} onMouseMoveCapture={moveSecondary} onContextMenuCapture={event => { if ((event.target as Element)?.closest?.('.canvas-surface') && !(event.target as Element)?.closest?.('input, textarea, select, [contenteditable="true"]')) event.preventDefault() }} onDragStartCapture={event => { if ((event.target as HTMLElement).closest('.library-item')) startResize() }} onCompositionStartCapture={() => { composing.current = true }} onCompositionEndCapture={() => { composing.current = false }} onBlurCapture={event => {
    if (guideActive.current || guideOpening.current || exportOpen || arrangeMenuOpen || topMenuOpen || (event.relatedTarget instanceof HTMLElement && (event.relatedTarget.closest('[data-markdown-ui], .application-menubar') || ['Help', 'About', 'Settings', 'Export', 'Auto-arrange'].includes(event.relatedTarget.getAttribute('aria-label') ?? '')))) event.stopPropagation()
  }} onClickCapture={event => { if (guideActive.current && !(event.target as HTMLElement).closest('.help-guide, .about-dialog')) event.stopPropagation() }} onFocusCapture={() => { keyboardOwner.current = true }} className={`app-shell${presenting ? ' presenting' : ''}`}>
    {guideOpen && <HelpGuide root={editorElement} onReveal={setGuidePanel} onClose={closeGuide} />}
    {aboutOpen && (informationKind === 'Settings' ? <SettingsDialog onClose={closeAbout} /> : <AboutDialog onClose={closeAbout} />)}
    {contextMenu && validContext(contextMenu) && <ContextMenu key={`${contextMenu.screen.x}:${contextMenu.screen.y}:${contextMenu.kind}:${contextMenu.id ?? ''}`} point={contextMenu.screen} origin={contextMenu.origin} actions={contextActions} onClose={() => setContextMenu(null)} />}
    {commandsOpen && !presenting && <CommandMenu actions={actions} onCancel={() => closeCommands()} onExecute={action => { if (presentationActive.current || action.disabled) return; pendingAction.current = action.label; closeCommands() }} />}
    {starterOpen && !presenting && <StarterChooser onCancel={() => closeStarterChooser()} onChoose={chooseStarter} />}
    {connectedPicker && writable && <ComponentPicker title={`Add connected ${connectedPicker.side}: ${props.document.entities.find(entity => entity.id === connectedPicker.sourceId)?.label ?? connectedPicker.sourceId}`} writable={writable} onChoose={chooseConnectedComponent} onCancel={() => setConnectedPicker(null)} />}
    <input ref={iconInput} type="file" aria-label="Import icon file" accept=".svg,.png,.jpg,.jpeg,.gif,.webp" hidden disabled={!writable} onChange={event => void importIconFile(event)} />
    {!presenting && <header className="topbar" inert={commandsOpen || starterOpen}>
      <div className="wordmark" aria-label="Azure Diagram Studio"><img className="brand-icon" src="./branding/logo.svg" alt="" width={36} height={36} /><span className="brand-name">Azure Diagram Studio</span></div>
      <div className="document-bar"><span className="breadcrumb">Workspace /</span>{field('Document title', diagram.title, 120, value => editMetadata({ title: value }, true))}</div>
      <TopMenus menus={topMenus} open={topMenuOpen} onOpen={changeTopMenu} disabled={presenting || commandsOpen || starterOpen || !!connectedPicker || exportOpen || !!entryCommit.current || guideOpen || aboutOpen} />
      <div className="top-actions"><IconButton icon={Undo2} label="Undo" disabled={!writable || !props.canUndo} onClick={undo} /><IconButton icon={Redo2} label="Redo" disabled={!writable || !props.canRedo} onClick={redo} /><button type="button" className="export-button" title="Export" aria-label="Export" aria-expanded={exportOpen} aria-disabled={props.isExporting || props.saveState === 'loading'} onClick={() => { if (!props.isExporting && props.saveState !== 'loading') { setTopMenuOpen(null); setExportOpen(!exportOpen) } }}>{props.isExporting ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}<span>Export</span><ChevronDown size={14} /></button>
      <button type="button" className="present-button" aria-label="Present" title="Present" disabled={props.saveState === 'loading' || props.isArranging} onPointerDown={() => { entryFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null }} onMouseDown={event => event.preventDefault()} onClick={enterPresentation}><Presentation size={18} /><span>Present</span></button></div>
    </header>}
    <div className="workspace" inert={commandsOpen}>
      {!presenting && <nav className="tool-rail" aria-label="Drawing tools">{tools.map(item => <IconButton key={item.tool} icon={item.icon} label={item.label} active={tool === item.tool} disabled={!writable && item.tool !== 'select' && item.tool !== 'pan' && item.tool !== 'component'} onClick={() => chooseTool(item.tool)} />)}<IconButton icon={isImportingIcon ? LoaderCircle : ImagePlus} label="Import custom icon" disabled={!writable || isImportingIcon} onClick={openIconPicker} /><IconButton icon={CommandIcon} label="Commands" className="commands-trigger" onMouseDown={event => event.preventDefault()} onClick={openCommands} /><span className="rail-spacer" /></nav>}
      <aside className={`library ${!presenting && libraryOpen ? 'open' : ''}`} aria-label="Component library" inert={presenting || !libraryOpen}>
        <div className="panel-heading"><h2>Components</h2><div className="panel-actions"><IconButton icon={PanelLeftClose} label="Close component library" onClick={() => setLibraryOpen(false)} /></div></div>
        <CatalogAccordion writable={writable} selectedIcon={tool === 'component' ? template.icon : null} recentIcons={recentIcons} onClearRecents={clearRecents} onChoose={chooseComponent} />
      </aside>
      <main ref={canvasElement} tabIndex={-1} className={`canvas-surface tool-${presenting ? 'pan' : tool}`} style={{ backgroundColor: workspaceBackground, '--canvas-surface': workspaceBackground, '--grid-dot': customBackground ? contrastInk('#c4d2ce', scene.backgroundColor, 3) : '#c4d2ce' } as CSSProperties} aria-label="Architecture canvas" onPointerMove={event => { if (presentationActive.current && pointerEnabled && canvasElement.current) { const bounds = canvasElement.current.getBoundingClientRect(); setPointer({ x: event.clientX - bounds.left, y: event.clientY - bounds.top }) } }} onDragOver={event => { if (writable && !presentationActive.current && event.dataTransfer.types.includes(DROP_TYPE)) { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' } }} onDrop={event => {
        event.preventDefault()
        if (!writable || presentationActive.current || guideActive.current || blockedGesture()) return
        const item = readDrop(event.dataTransfer.getData(DROP_TYPE))
        if (!item) { setNotice('Drop a component from the library.'); return }
        insertComponent(item, screenToFlowPosition({ x: event.clientX, y: event.clientY }, { snapToGrid: false }))
      }}>
        <div className="canvas-heading" data-fit-chrome="top">{diagram.synthetic && <div className="canvas-kicker" style={customBackground ? { color: contrastInk('#849293', scene.backgroundColor, 7) } : undefined}><span className="synthetic-dot" />SYNTHETIC EXAMPLE</div>}<h1 style={customBackground ? { color: contrastInk('#203637', scene.backgroundColor, 7) } : undefined}>{diagram.title || 'Untitled architecture'}</h1>{diagram.subtitle && <div className="diagram-meta" style={customBackground ? { color: contrastInk('#849293', scene.backgroundColor, 7) } : undefined}>{diagram.subtitle}</div>}</div>
        {!presenting && <div className="canvas-toolbar" data-fit-chrome="top">
          <ArrangeMenu open={arrangeMenuOpen} onOpen={open => { if (!open || (!composing.current && !inlineComposing.current && !guideActive.current && !guideOpening.current && !presentationActive.current && !guideOpen && !aboutOpen && !commandsOpen && !starterOpen && !connectedPicker && !exportOpen)) setArrangeMenuOpen(open) }} disabled={!writable || props.isArranging || !diagram.entities.some(entity => entity.kind === 'component' || entity.kind === 'boundary')} busy={props.isArranging} onArrange={(direction, options) => {
            if (!presentationActive.current && !guideActive.current && !guideOpening.current && !composing.current && !inlineComposing.current && !guideOpen && !aboutOpen && !commandsOpen && !starterOpen && !connectedPicker && !exportOpen && writable && !props.isArranging && finish()) props.onArrange(direction, options)
          }} />
          <IconButton icon={PanelRight} label="Sidebar" className="sidebar-trigger" active={inspectorOpen} aria-expanded={inspectorOpen} data-markdown-ui onMouseDown={event => event.preventDefault()} onClick={() => { if (!composing.current && !inlineComposing.current) { if (inspectorOpen) closeSidebar(); else showSidebar(sidebarView) } }} />
        </div>}
        <ReactFlow<ArchitectureNode, ArchitectureEdge> nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} zIndexMode="manual" elevateNodesOnSelect={false} elevateEdgesOnSelect={false} connectionMode={ConnectionMode.Loose} onNodesChange={updateNodes} onNodeDragStart={startResize} onNodeDrag={(_event, _node, moved) => moveNodes(moved, false)} onNodeDragStop={(_event, _node, moved) => moveNodes(moved, true)} onNodeClick={(event, node) => selectEntity(node.id, event)} onNodeDoubleClick={(event, node) => { event.preventDefault(); event.stopPropagation(); openInline(node.id, 'entity', event.currentTarget as HTMLElement) }} onEdgeDoubleClick={(event, edge) => { event.preventDefault(); event.stopPropagation(); openInline(edge.id, 'connection', event.currentTarget as HTMLElement) }} onEdgeClick={(event, edge) => { if (presentationActive.current) return; finish(); setSelectedIds([]); setSelectedEdges(current => event.shiftKey || event.ctrlKey || event.metaKey ? current.includes(edge.id) ? current.filter(id => id !== edge.id) : [...current, edge.id] : [edge.id]); openInspector(false) }} onEdgesChange={changes => { if (presentationActive.current) return; if (changes.some(change => change.type === 'select')) finish(); setSelectedEdges(current => { const next = new Set(current); for (const change of changes) if (change.type === 'select') { if (change.selected) next.add(change.id); else next.delete(change.id) } return [...next] }) }}
          onNodeContextMenu={(event, node) => openContext(event, 'entity', node.id)} onEdgeContextMenu={(event, edge) => openContext(event, 'connection', edge.id)} onPaneContextMenu={event => openContext(event, 'pane')}
          onPaneClick={insertAt} onConnectStart={startResize} onReconnectStart={startResize} onConnect={next => connect(next)} onReconnect={(edge, next) => connect(next, edge.id)} isValidConnection={next => !presentationActive.current && writable && !inlineRef.current && !blockedGesture() && canConnect(diagram, next.source, next.target)} onMove={updateCamera} onInit={() => { initialFrame.current.flowReady = true; settleInitialFrame() }} minZoom={0.001} maxZoom={2} snapToGrid={!presenting && grid.snap} snapGrid={[grid.spacing, grid.spacing]} panOnDrag={presenting || tool === 'pan' ? true : [1, 2]} elementsSelectable={!presenting} nodesFocusable={!presenting} edgesFocusable={!presenting} selectionOnDrag={!presenting && tool === 'select'} nodesDraggable={writable && !visibleInline && tool === 'select'} nodesConnectable={writable && !visibleInline} edgesReconnectable={writable && !visibleInline} deleteKeyCode={null}>
          {(presenting ? grid.present : grid.visible) && <Background id="diagram-grid" variant={grid.style === 'lines' ? BackgroundVariant.Lines : BackgroundVariant.Dots} gap={grid.spacing} offset={editorGridOffset(diagram.grid)} size={1} lineWidth={0.5} color={contrastInk('#c4d2ce', scene.backgroundColor, 3)} />}<svg width={0} height={0}><defs dangerouslySetInnerHTML={{ __html: MARKERS + scene.connections.map(connection => connectionMarkers(connection, scene.connectionBackgrounds[connection.id])).join('') }} /></svg>
        </ReactFlow>
        {visibleInline && anchor && <InlineLabel key={`${visibleInline.kind}:${visibleInline.id}`} edit={visibleInline} style={{ width: inlineWidth, left: canvasBounds.width ? Math.max(4, Math.min(canvasBounds.width - inlineWidth - 4, inlineLeft)) : inlineLeft, top: canvasBounds.height ? Math.max(4, Math.min(canvasBounds.height - (visibleInline.multiline ? 108 : 44) - 4, inlineTop)) : inlineTop }} onDraft={draftInline} onFinish={() => finishInline(true)} onCancel={() => cancelInline()} onComposing={active => { inlineComposing.current = active }} deferFinish={() => starterOpening.current} />}
        <div className="canvas-bottom-chrome">
        {diagram.legendVisible && scene.legendItems.length > 0 && <div className="canvas-legend" style={customBackground ? { color: contrastInk('#7c8e90', scene.backgroundColor) } : undefined} data-fit-chrome="bottom" aria-label="Diagram legend" role="list">{scene.legendItems.map((item, index) => <span key={`${item.label}-${index}`} role="listitem"><i style={{ borderColor: contrastInk(resolveColor(item.color).main, scene.backgroundColor, 3), borderStyle: item.dashed ? 'dashed' : 'solid' }} />{item.label}</span>)}</div>}
        {!presenting && (selectedIds.length > 0 || selectedEdges.length > 0) && <div className="canvas-selection-toolbar" data-fit-chrome="bottom" aria-label="Selection actions">{entityActions}<span className="separator" /><IconButton icon={Group} label="Group selection" disabled={!writable || !selectedIds.length} onClick={groupSelection} /><IconButton icon={Ungroup} label="Ungroup selection" disabled={!writable || !boundaries.length} onClick={ungroupSelection} />{connection && <IconButton icon={Plus} label={`Insert ${template.label} on connection`} disabled={!writable} onClick={() => insertComponent(template)} />}</div>}
        <div className="canvas-navigation">
        {presenting && <div className="presentation-status" data-fit-chrome="bottom" role="status" aria-live="polite">{notice || props.message || (props.readOnly ? 'Read-only' : '')}</div>}
        <div className="zoom-controls" data-fit-chrome="bottom"><IconButton icon={Minus} label="Zoom out" onClick={() => void zoomOut({ duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 150 })} /><span>{Math.round(zoom * 100)}%</span><IconButton icon={Plus} label="Zoom in" onClick={() => void zoomIn({ duration: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 150 })} /><span className="separator" /><IconButton icon={Maximize2} label="Fit diagram" disabled={!scene.entities.length} onClick={() => fitCanvas()} /><IconButton icon={Scan} label="Fit selection" disabled={!selectedIds.length} onClick={() => fitCanvas(true)} /></div>
        </div></div>
        {presenting && <>
          <PresentationMarkup />
          <div className="presentation-controls" data-fit-chrome="top" role="group" aria-label="Presentation controls"><button ref={exitButton} type="button" className="present-button" aria-label="Exit presentation" title="Exit presentation" onClick={() => exitPresentation()}><X size={18} /><span>Exit</span></button><IconButton icon={Crosshair} label="Presentation pointer" active={pointerEnabled} onClick={() => { const bounds = canvasElement.current?.getBoundingClientRect(); setPointer({ x: (bounds?.width ?? 0) / 2, y: (bounds?.height ?? 0) / 2 }); setPointerEnabled(!pointerEnabled); if (!pointerEnabled) requestAnimationFrame(() => pointerElement.current?.focus()) }} /><IconButton icon={FileText} label="Open Markdown" active={presentationMarkdownOpen} data-markdown-ui onClick={() => setPresentationMarkdownOpen(!presentationMarkdownOpen)} /><IconButton icon={Expand} label="Fullscreen presentation" onClick={() => void fullscreen()} /></div>
          {pointerEnabled && <div ref={pointerElement} tabIndex={0} role="img" aria-label="Presentation pointer position" className="presentation-pointer" style={{ left: pointer.x, top: pointer.y }} onKeyDown={event => { const delta: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }; if (event.ctrlKey || event.metaKey || event.altKey || !delta[event.key]) return; event.preventDefault(); const bounds = canvasElement.current?.getBoundingClientRect(); const step = event.shiftKey ? 40 : 10; const direction = delta[event.key]; setPointer(current => ({ x: Math.max(12, Math.min((bounds?.width ?? 24) - 12, current.x + direction.x * step)), y: Math.max(12, Math.min((bounds?.height ?? 24) - 12, current.y + direction.y * step)) })) }} />}
        </>}
      </main>
      <aside className={`inspector shared-sidebar ${presenting || sidebarView === 'markdown' ? 'markdown-sidebar' : ''} ${(presenting ? presentationMarkdownOpen : inspectorOpen) ? 'open' : ''}`} style={{ '--sidebar-width': `${visibleSidebarWidth}px` } as CSSProperties} aria-label={presenting || sidebarView === 'markdown' ? 'Markdown' : 'Properties'} inert={presenting ? !presentationMarkdownOpen : !inspectorOpen}>
        {(presenting ? presentationMarkdownOpen : inspectorOpen) && <MarkdownSidebarResize width={visibleSidebarWidth} minimum={240} maximum={sidebarMaximum} onChange={setSidebarWidth} />}
        <div className="panel-heading"><h2>{presenting || sidebarView === 'markdown' ? <FileText size={15} /> : <SlidersHorizontal size={15} />}{presenting || sidebarView === 'markdown' ? 'Markdown' : 'Properties'}</h2><div className="panel-actions" data-markdown-ui>{!presenting && <><IconButton icon={PanelRight} label="Show properties" active={sidebarView === 'properties'} onMouseDown={event => event.preventDefault()} onClick={() => showSidebar('properties')} /><IconButton icon={FileText} label="Show Markdown" active={sidebarView === 'markdown'} onMouseDown={event => event.preventDefault()} onClick={() => showSidebar('markdown')} /></>}<IconButton icon={X} label={presenting || sidebarView === 'markdown' ? 'Close Markdown' : 'Close properties'} onMouseDown={event => event.preventDefault()} onClick={closeSidebar} /></div></div>
        {(presenting || sidebarView === 'markdown') && <div className="markdown-sidebar-content">{(!presenting || presentationMarkdownOpen) && descriptionEditor}</div>}
        <div className="inspector-content" hidden={presenting || sidebarView !== 'properties'} inert={presenting || sidebarView !== 'properties'}><div className="inspector-kind">{panelTitle}{multiSelection && <span>{selectedIds.length}</span>}</div>
          {selected && <>
            {!multiSelection && <>
              {visibleInline?.id !== selected.id && <Property label={selected.kind === 'text' ? 'Text' : 'Label'}>{field(selected.kind === 'text' ? 'Note text' : 'Component label', selected.label, selected.kind === 'text' ? 2000 : 120, value => editEntity({ label: value }, true), selected.kind === 'text')}</Property>}
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
            {selectedIds.length > 0 && <div className="ordering-actions"><IconButton icon={ArrowUp} label="Bring forward" disabled={!writable} onClick={() => emit({ type: 'order', ids: selectedIds, position: 'forward' })} /><IconButton icon={ArrowDown} label="Send backward" disabled={!writable} onClick={() => emit({ type: 'order', ids: selectedIds, position: 'backward' })} /><IconButton icon={BringToFront} label="Bring to top" disabled={!writable} onClick={() => emit({ type: 'order', ids: selectedIds, position: 'top' })} /><IconButton icon={SendToBack} label="Send to bottom" disabled={!writable} onClick={() => emit({ type: 'order', ids: selectedIds, position: 'bottom' })} /></div>}
            <div className="inspector-divider" /><div className="readout"><span>Dimensions</span><strong>{Math.round(selected.width)} x {Math.round(selected.height)}</strong></div>
            <div className="inspector-group-actions"><IconButton icon={Group} label="Group objects" disabled={!writable} onClick={groupSelection} /><IconButton icon={Ungroup} label="Ungroup boundaries" disabled={!writable || !boundaries.length} onClick={ungroupSelection} /></div>
          </>}
          {connection && <>
            {visibleInline?.id !== connection.id && <Property label="Label">{field('Connection label', connection.label, 80, value => editConnection({ label: value }, true))}</Property>}
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
            <div className="property"><span>Architecture description (Markdown)</span>{!presenting && sidebarView === 'properties' && descriptionEditor}</div>
            <div className="property"><span>Background</span><div className="background-controls"><input type="color" aria-label="Diagram background color" value={fullHex(scene.backgroundColor).toLowerCase()} disabled={!writable} onChange={event => { if (isHexColor(event.target.value)) editMetadata({ backgroundColor: event.target.value }, true); else { clearPreview(); setNotice('backgroundColor: Use #RGB or #RRGGBB.') } }} onBlur={() => finish()} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); clearPreview() } if (event.key === 'Enter') event.currentTarget.blur() }} /><IconButton icon={Undo2} label="Reset diagram background" disabled={!writable} onMouseDown={event => event.preventDefault()} onClick={() => { clearPreview(); setBackgroundReset(value => value + 1); editMetadata({ backgroundColor: undefined }) }} /></div></div>
            <Property label="Background hex color"><HexField key={`${props.document.id}:${backgroundReset}`} label="Background hex color" color={props.document.backgroundColor ?? '#ffffff'} disabled={!writable} onDraft={backgroundColor => editMetadata({ backgroundColor }, true)} onFinish={() => finish()} onCancel={clearPreview} /></Property>
            <div className="grid-controls" role="group" aria-label="Grid settings">
              <label className="property-toggle"><input aria-label="Show grid" type="checkbox" checked={grid.visible} disabled={!writable} onChange={event => editGrid({ visible: event.target.checked })} />Show grid</label>
              <label className="property-toggle"><input aria-label="Snap to grid" type="checkbox" checked={grid.snap} disabled={!writable} onChange={event => editGrid({ snap: event.target.checked })} />Snap to grid</label>
              <div className="grid-style" role="group" aria-label="Grid style"><button type="button" aria-label="Dots grid" aria-pressed={grid.style === 'dots'} disabled={!writable} onClick={() => editGrid({ style: 'dots' })}>Dots</button><button type="button" aria-label="Lines grid" aria-pressed={grid.style === 'lines'} disabled={!writable} onClick={() => editGrid({ style: 'lines' })}>Lines</button></div>
              <Property label="Grid spacing"><input type="number" aria-label="Grid spacing" min={4} max={128} step={1} value={spacingDraft} disabled={!writable} aria-invalid={spacingInvalid} aria-describedby={spacingInvalid ? spacingErrorId : undefined} onChange={event => {
                if (!writable || presentationActive.current) return
                const value = event.target.value, spacing = Number(value)
                const valid = value !== '' && Number.isInteger(spacing) && spacing >= 4 && spacing <= 128
                setSpacingDraft(value); setSpacingInvalid(!valid)
                if (valid) editGrid({ spacing }, true); else clearPreview()
              }} onBlur={() => { if (writable && !presentationActive.current && !spacingInvalid) finish() }} onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { event.stopPropagation(); clearPreview(); setSpacingDraft(String(effectiveGrid(props.document.grid).spacing)); setSpacingInvalid(false) } }} />{spacingInvalid && <small id={spacingErrorId} className="field-error" role="alert">Use an integer from 4 to 128.</small>}</Property>
              <label className="property-toggle"><input aria-label="Show grid in Present" type="checkbox" checked={grid.present} disabled={!writable} onChange={event => editGrid({ present: event.target.checked })} />Show grid in Present</label>
              <label className="property-toggle"><input aria-label="Include grid in exports" type="checkbox" checked={grid.export} disabled={!writable} onChange={event => editGrid({ export: event.target.checked })} />Include grid in exports</label>
            </div>
            <label className="property-toggle"><input aria-label="Synthetic diagram" type="checkbox" checked={diagram.synthetic} disabled={!writable} onChange={event => editMetadata({ synthetic: event.target.checked })} />Synthetic</label><label className="property-toggle"><input aria-label="Show legend" type="checkbox" checked={diagram.legendVisible} disabled={!writable} onChange={event => editMetadata({ legendVisible: event.target.checked })} />Show legend</label>
            <div className="readout"><span>Objects</span><strong>{diagram.entities.length}</strong></div><div className="readout"><span>Connections</span><strong>{diagram.connections.length}</strong></div>
          </>}
        </div>{!presenting && <div className="inspector-footer"><span className={`status-dot state-${props.saveState}`} />{props.readOnly ? 'Read-only' : SAVE_LABELS[props.saveState]}</div>}
      </aside>
    </div>
    {!presenting && <footer className="statusbar"><span><span className={`status-dot state-${props.saveState}`} /><span className="save-label">{SAVE_LABELS[props.saveState]}</span><span className="footer-divider" /><span className="backup-state">{props.backupDirty ? 'Editable JSON copy needed' : 'No newer JSON changes'}</span><span className="object-count"><span className="footer-divider" />{diagram.entities.length} objects</span></span><span role="status" title={notice || props.message}>{notice || props.message || (connectionStart ? 'Connection source selected' : tool === 'component' ? template.label : '')}</span><span className="status-right">{Math.round(zoom * 100)}%{diagram.synthetic && <><span className="footer-divider" />Synthetic</>}</span></footer>}
    {exportOpen && <ExportDialog document={diagram} selectedIds={selectedIds} preset={exportPreset} onPreset={setExportPreset} busy={props.isExporting || props.saveState === 'loading'} onClose={closeExport} onExport={props.onExport} onCopyImage={props.onCopyImage} />}
  </div>
}