import type { Connection, Diagram, Direction, Entity, Layer, Point, StateStyle } from './model.ts'
import type { LayoutResult } from './layout.ts'

export type ValidationIssue = { path: string; message: string }
export type Result<T> = { ok: true; value: T; warnings?: string[] } | { ok: false; errors: ValidationIssue[] }
export type DomainErrorCode = 'invalid-command' | 'invalid-document' | 'unknown-id' | 'duplicate-id' | 'invalid-parent' | 'invalid-connection' | 'limit-exceeded' | 'stale-layout'
export interface DomainError extends Error {
  name: 'DomainError'
  code: DomainErrorCode
  errors: ValidationIssue[]
}

/** Detached roots use absolute coordinates; retained descendants remain parent-relative. Origin is the minimum absolute selection position. */
export type ClipboardFragment = { entities: Entity[]; connections: Connection[]; origin: Point }
export type EntityPatch = Partial<Pick<Entity, 'label' | 'subtitle' | 'color' | 'icon' | 'customIcon' | 'status'>>
export type ConnectionPatch = Partial<Pick<Connection, 'from' | 'to' | 'label' | 'style' | 'arrow' | 'sourceSide' | 'targetSide' | 'sourceOffset' | 'targetOffset' | 'status'>>
export type MetadataPatch = Partial<Pick<Diagram, 'title' | 'subtitle' | 'description' | 'backgroundColor' | 'grid' | 'direction' | 'synthetic' | 'legendVisible' | 'legend'>>

/** All IDs and geometry are supplied by callers; commands never generate IDs. */
export type DocumentCommand =
  | { type: 'addEntity'; entity: Entity }
  | { type: 'addConnected'; sourceId: string; entity: Entity; connection: Connection }
  | { type: 'updateEntity'; id: string; patch: EntityPatch }
  | { type: 'remove'; entityIds: string[]; connectionIds: string[] }
  | { type: 'move'; positions: { id: string; x: number; y: number }[] }
  | { type: 'resize'; id: string; width: number; height: number }
  | { type: 'connect'; connection: Connection }
  | { type: 'updateConnection'; id: string; patch: ConnectionPatch }
  | { type: 'adjustRoute'; id: string; expectedRevision: number; points: Point[]; labelPosition: Point }
  | { type: 'resetRoute'; id: string; expectedRevision: number }
  | { type: 'insertOnConnection'; connectionId: string; entity: Entity; upstreamId: string; downstreamId: string }
  | { type: 'reparent'; ids: string[]; parentId: string | null }
  | { type: 'group'; ids: string[]; boundary: Entity & { kind: 'boundary' } }
  | { type: 'ungroup'; boundaryIds: string[] }
  | { type: 'paste'; fragment: ClipboardFragment; idMap: Record<string, string>; offset: Point }
  | { type: 'metadata'; patch: MetadataPatch }
  | { type: 'configureStateStyles'; stateStyles: StateStyle[]; remap?: Record<string, string | null> }
  | { type: 'order'; ids: string[]; layer?: Layer; position?: 'forward' | 'backward' | 'top' | 'bottom' }
  | { type: 'applyLayout'; expectedRevision: number; result: LayoutResult }

/** DGM-010 implements these functions in src/document/, not this shared file. */
export interface DocumentApi {
  validateDocument(input: unknown): Result<Diagram>
  parseDocument(text: string): Result<Diagram>
  importSkillSpec(input: unknown): Result<Diagram>
  /** Returns a new document atomically; throws DomainError on failure. */
  applyCommand(document: Diagram, command: DocumentCommand): Diagram
  captureSelection(document: Diagram, ids: string[]): ClipboardFragment
}

export interface DocumentStorage {
  /** Persisted root: a legacy Diagram or a validated Workbook (same database/key, no migration). */
  load(): Promise<import('./workbook.ts').WorkspaceDocument | null>
  save(document: import('./workbook.ts').WorkspaceDocument): Promise<void>
  close(): void
}
export type CreateStorage = () => DocumentStorage
export type WatchSessionLock = (onWritableChange: (writable: boolean) => void) => () => void
export interface PersistenceApi {
  createStorage: CreateStorage
  watchSessionLock: WatchSessionLock
}

export type SaveState = 'loading' | 'saving' | 'saved' | 'error' | 'read-only'
export type StarterKey = 'web-api' | 'event-driven' | 'fabric' | 'enterprise'
  | 'aks-baseline' | 'container-apps-microservices' | 'web-queue-worker' | 'hub-spoke-network'
  | 'saas-deployment-stamps' | 'file-claim-check' | 'azure-data-warehouse'
export type ExportOptions = { format: 'svg' | 'png' | 'markdown'; scale: 1 | 2; transparent: boolean; includeMarkdown?: boolean; selectionIds?: string[]; background?: 'diagram' | 'white'; aspect?: 'content' | '16:9'; includeGrid?: boolean }
export type ExportSceneOptions = Pick<ExportOptions, 'selectionIds' | 'background' | 'aspect' | 'includeGrid'>
/** DGM-151C/152 whole-page document exports. Never carries a selection: pages and workbooks export whole. */
export type DocumentExportOptions =
  | { scope: 'page'; format: 'json' | 'pdf' | 'vsdx'; background?: 'diagram' | 'white'; includeGrid?: boolean; transparent?: boolean; scale?: 1 | 2 }
  | { scope: 'workbook'; format: 'json' | 'zip' | 'pdf' | 'vsdx'; imageFormat?: 'svg' | 'png'; background?: 'diagram' | 'white'; includeGrid?: boolean; transparent?: boolean; scale?: 1 | 2 }
/** DGM-151B editor-side workbook operations; the session supplies IDs and owns history. */
export type WorkbookUiCommand =
  | { type: 'newWorkbook' }
  | { type: 'addPage'; title?: string }
  | { type: 'renamePage'; pageId: string; title: string }
  | { type: 'reorderPages'; pageIds: string[] }
  | { type: 'workbookMetadata'; patch: { title?: string; description?: string } }
/** Preview is a local draft, or null when finished/cancelled; each call invalidates pending layout. */
export interface EditorProps {
  document: Diagram
  canUndo: boolean
  canRedo: boolean
  readOnly: boolean
  saveState: SaveState
  backupDirty: boolean
  message: string
  isArranging: boolean
  isExporting: boolean
  onCommand(command: DocumentCommand): void
  /** Editor-local geometry operation; never serialized or accepted by external command surfaces. */
  onBoundaryOperation?(operation: (document: Diagram) => Diagram): void
  onUndo(): void
  onRedo(): void
  onNew(): void
  onChooseStarter(key: StarterKey): boolean
  onOpen(): void
  onSaveAs?(): void
  onRecent?(id?: string): void
  onImport(): void
  onSaveJson(): void
  onArrange(direction: Direction, options?: import('./layout.ts').LayoutOptions): void
  onExport(options: ExportOptions): void
  onCopyImage?(options: ExportOptions): void
  /** DGM-151C page/workbook document export (JSON, image ZIP, PDF, Visio). */
  onExportDocument?(options: DocumentExportOptions): void
  /** False in the browser build: PDF needs the desktop print host. */
  pdfAvailable?: boolean
  onPreviewChange(document: Diagram | null): void
  onPresentationChange?(presenting: boolean): void
  /** Internal, session-only: open the New diagram picker once for a fresh workspace (Blank default). */
  starterOffer?: boolean
  /** Internal: called once the editor has shown the offered startup picker. */
  onStarterOffered?(): void
  /** Desktop-only live interaction guard; registering it does not change editor state. */
  onMcpGuard?(guard: (() => string | null) | null): void
  /** DGM-151 persisted root; document remains the active page. Absent in plain-diagram harnesses. */
  root?: import('./workbook.ts').WorkspaceDocument
  /** Session-only navigation state; never persisted in the root. */
  activePageId?: string
  /** Navigation only: no history, revision or dirty-state change. */
  onSelectPage?(pageId: string): void
  /** Returns false when the session refused or the user cancelled the operation. */
  onWorkbookCommand?(command: WorkbookUiCommand): boolean
  /** Test-fixture seam for retained DGM-148 segment-editing regressions; production stays disabled. */
  enableExperimentalSegmentEditing?: boolean
}