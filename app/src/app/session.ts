import { applyCommand, importSkillSpec, parseDocument, validateDocument } from '../document/index.ts'
import { createDocument } from '../model.ts'
import type { Diagram, Direction } from '../model.ts'
import type { DocumentCommand, DocumentExportOptions, DocumentStorage, ExportOptions, ExportSceneOptions, SaveState, StarterKey, WorkbookUiCommand } from '../contracts.ts'
import {
  MAX_WORKBOOK_BYTES, activePage, addWorkbookPage, changedPageIds, createWorkbook, hasPage, isWorkbook, parseWorkspace, promoteWorkbook,
  reorderWorkbookPages, replaceWorkspacePage, updateWorkbookMetadata, validateWorkspace, workspaceCommit, workspaceHistory, workspacePages, workspaceRedo, workspaceUndo,
} from '../workbook.ts'
import type { WorkspaceDocument, WorkspaceHistory } from '../workbook.ts'
import type { LayoutResult } from '../layout.ts'
import { starterCatalog } from './starters.ts'
import type { McpMutationResult, McpOperation, McpOutputOperation, McpOutputResult, McpOutput, McpWorkbookOperation, McpWorkbookResult, McpWorkbookState } from './mcp-contract.ts'
import { validateMutation, validateOutputOperation, validateWorkbookOperation } from '../../electron/mcp-schema.mjs'
import { validateWorkbookEdit } from '../workbook-api.ts'
import type { WorkbookEditCommand } from '../workbook-api.ts'
import { buildDocumentExport } from './workbook-output.ts'
import type { DocumentExportRequest, PdfJob } from './workbook-output.ts'
import { createEmbeddedMarkdown, createExportZip, exportFilenameStem } from '../export-package.ts'

export const starterKeys: readonly StarterKey[] = starterCatalog.map(choice => choice.key)
export function starterDocument(key: StarterKey): Diagram {
  const choice = starterCatalog.find(candidate => candidate.key === key)
  if (!choice) throw new Error('Choose an available starting diagram')
  const parsed = parseDocument(choice.source)
  if (!parsed.ok) throw new Error(parsed.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))
  return parsed.value
}

export type LayoutJob = { promise: Promise<LayoutResult>; cancel(): void }
export type SessionDependencies = {
  createStorage(): DocumentStorage
  watchLock(callback: (writable: boolean) => void): () => void
  layout(document: Diagram, direction: Direction, options?: import('../layout.ts').LayoutOptions): LayoutJob
  download(blob: Blob, filename: string): void | Promise<void>
  saveFile?(blob: Blob, filename: string, documentId: string): Promise<boolean | { saved: boolean; recentError?: string }>
  saveDiagram?(blob: Blob, filename: string, saveAs?: boolean): Promise<{ saved: boolean; filename?: string; recentError?: string }>
  confirmReplace(): boolean
  newId(): string
  exportSvg(document: Diagram, transparent: boolean, includeGrid?: boolean, options?: ExportSceneOptions): Promise<string>
  exportPng(document: Diagram, scale: 1 | 2, transparent: boolean, includeGrid?: boolean, options?: ExportSceneOptions): Promise<Blob>
  copyImage?(png: Promise<Blob>): Promise<void>
  /** DGM-151C desktop-only structured PDF host; absent in the browser build. */
  renderPdf?(job: PdfJob): Promise<Uint8Array>
  /** DGM-152 icon rasterizer for offline Visio media. */
  rasterizeIcon?(dataUrl: string): Promise<Uint8Array>
}
export type SessionSnapshot = {
  /** Active page adapter: the existing editor contract keeps receiving one Diagram. */
  document: Diagram
  /** DGM-151 persisted root (Diagram or Workbook); Save/backup/recovery always use it. */
  root: WorkspaceDocument
  /** Session-only navigation; never persisted, never part of history. */
  activePageId: string
  canUndo: boolean; canRedo: boolean; readOnly: boolean
  saveState: SaveState; backupDirty: boolean; currentFilename: string; message: string; isArranging: boolean; isExporting: boolean
    // Session-only UI intent: the first owned load found no saved diagram. Never persisted.
    starterOffer: boolean
  }
  type Runtime = { storage: DocumentStorage; release?: () => void; queue: Promise<void>; stopped: boolean; owns: boolean; load: number }
type InputFile = { name: string; size: number; text(): Promise<string> }
const canonical = (document: WorkspaceDocument) => JSON.stringify(document)
const MAX_LEGACY_BYTES = 5 * 1024 * 1024
// Exact UTF-8 size only when the cheap upper bound (3 bytes/unit) could exceed limit.
const exceeds = (text: string, limit: number) => text.length * 3 > limit && (text.length > limit || new TextEncoder().encode(text).byteLength > limit)
const describe = (error: unknown) => error instanceof Error ? error.message : String(error)
const filename = (document: Diagram) => exportFilenameStem(document.title)

export function createSession(dependencies: SessionDependencies) {
  const mcpLifetime = globalThis.crypto.randomUUID()
  let mcpGuard: (() => string | null) | null = null
  let mcpPending = false
  let mcpRecovered = false
  let fileJobs = 0
  // Non-mutating empty canvas while recovery runs; never the commerce sample.
  let history: WorkspaceHistory = workspaceHistory(createDocument('loading'))
  // Navigation state lives beside, never inside, the persisted root/history.
  let activePageId = history.present.id
  // Page navigation changes the MCP-visible page, so it is part of the opaque token.
  let navigation = 0
  let backup: string | null = null
  // A bundled starter/blank origin is distinct from a written JSON backup.
  // It exists only in memory and becomes invalid on every non-exact edit.
  let baseline: string | null = null
  let currentFilename = 'Diagram.json'
  let generation = 0
  let request = 0
  let runtime: Runtime | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  let preview: Diagram | null = null
  let layoutJob: LayoutJob | undefined
  let presenting = false
  // The startup picker is decided once, by the first successful owned load.
  let freshDecided = false
  let snapshot: SessionSnapshot = { document: activePage(history.present), root: history.present, activePageId, canUndo: false, canRedo: false, readOnly: true, saveState: 'loading', backupDirty: true, currentFilename, message: '', isArranging: false, isExporting: false, starterOffer: false }
  let serializedDocument = history.present
  let serialized = canonical(serializedDocument)
  const listeners = new Set<() => void>()
  function publish(patch: Partial<SessionSnapshot> = {}) {
    if (history.present !== serializedDocument) { serializedDocument = history.present; serialized = canonical(serializedDocument) }
    if (!hasPage(history.present, activePageId)) activePageId = activePage(history.present).id
    const next = { ...snapshot, document: activePage(history.present, activePageId), root: history.present, activePageId, canUndo: !!history.past.length, canRedo: !!history.future.length, backupDirty: backup !== serialized, currentFilename, ...patch }
    if ((Object.keys(next) as (keyof SessionSnapshot)[]).every(key => next[key] === snapshot[key])) return
    snapshot = next
    for (const listener of listeners) listener()
  }
  function writable() { return !!runtime && !runtime.stopped && runtime.owns && !snapshot.readOnly }
  function canMutate() { return writable() && !presenting }
  function invalidate() {
    request++
    layoutJob?.cancel(); layoutJob = undefined
    publish({ isArranging: false })
  }
  function presentation(active: boolean) {
    if (presenting === active) return
    presenting = active
    if (active) { preview = null; invalidate() }
  }
  function failure(error: unknown, prefix = '') { publish({ message: `${prefix}${describe(error)}` }) }

  // Queue immutable snapshots in command order. Old completions cannot mark newer work saved.
  function scheduleSave() {
    if (debounce) clearTimeout(debounce)
    const active = runtime
    if (!active || !writable()) return
    publish({ saveState: 'saving' })
    const document = history.present
    const version = generation
    debounce = setTimeout(() => {
      debounce = undefined
      active.queue = active.queue.then(async () => {
        try {
          await active.storage.save(document)
          if (runtime === active && !active.stopped && version === generation) publish({ saveState: 'saved' })
        } catch (error) {
          if (runtime === active && !active.stopped && version === generation) publish({ saveState: 'error', message: `Browser save failed: ${describe(error)}. Download JSON now; free storage and edit again to retry.` })
        }
      })
    }, 500)
  }
  // Pseudocode:
  //   1. ignore no-op history; refuse a root over the 64 MiB persisted bound
  //   2. undo/redo reveal: when the step changed pages but not the visible one,
  //      show the first affected page so the user sees what was reverted
  //   3. a stale active page (e.g. undone add) falls back to the first page
  //   4. bump the generation (stale async work), clear drafts, publish, autosave
  function accept(next: WorkspaceHistory, reveal = false) {
    if (next === history) return
    if (isWorkbook(next.present) && next.present !== serializedDocument) {
      // Reuse the serialization publish() needs anyway for the dirty indicator.
      const text = canonical(next.present)
      if (exceeds(text, MAX_WORKBOOK_BYTES)) throw new Error('Workbook exceeds the 64 MiB limit')
      serializedDocument = next.present; serialized = text
    }
    const before = history.present
    history = next; generation++; preview = null
    if (reveal) {
      const changed = changedPageIds(before, next.present)
      if (changed.length && !changed.includes(activePageId)) activePageId = changed[0]
    }
    if (!hasPage(history.present, activePageId)) activePageId = activePage(history.present).id
    invalidate(); publish({ message: '', starterOffer: false }); scheduleSave()
  }
  function currentPage() { return activePage(history.present, activePageId) }
  /** Page commands touch only the addressed page; other page objects stay shared. */
  function pageCommit(pageId: string, next: Diagram): WorkspaceHistory {
    return workspaceCommit(history, replaceWorkspacePage(history.present, pageId, next))
  }
  function command(command: DocumentCommand) {
    if (!canMutate()) return
    publish({ message: '' })
    try { accept(pageCommit(activePageId, applyCommand(currentPage(), command))) }
    catch (error) { failure(error) }
  }
  function boundaryOperation(operation: (document: Diagram) => Diagram) {
    if (!canMutate()) return
    publish({ message: '' })
    try { accept(pageCommit(activePageId, operation(currentPage()))) }
    catch (error) { failure(error) }
  }
  function defaultFilename(document: WorkspaceDocument) {
    const stem = exportFilenameStem(document.title).replace(/[\\/:*?"<>|]/g, '-').replace(/^\.+$/, 'Diagram')
    return `${stem || (isWorkbook(document) ? 'Workbook' : 'Diagram')}.json`
  }
  function replacementSafe() { return backup === serialized || baseline === serialized }
  function replace(document: WorkspaceDocument, backedUp: boolean, message = '', filename?: string, unchangedBaseline = false) {
    invalidate(); generation++; preview = null
    history = workspaceHistory(document)
    activePageId = activePage(document).id
    backup = backedUp ? canonical(document) : null
    baseline = unchangedBaseline ? canonical(document) : null
    currentFilename = filename ?? defaultFilename(document)
    publish({ message, starterOffer: false }); scheduleSave()
  }

  // Navigation only: no history, generation, revision or dirty-state change.
  // Allowed while presenting and read-only; pending layout/drafts belong to the
  // previous page, so they are invalidated rather than applied to the new one.
  function selectPage(pageId: string): boolean {
    if (!hasPage(history.present, pageId)) return false
    if (pageId === activePageId) return true
    preview = null
    invalidate()
    activePageId = pageId; navigation++
    publish({ message: '' })
    return true
  }

  // Pseudocode: refuse when not editable; generate IDs here (never in the UI);
  // build the next root purely; commit one history entry; newWorkbook uses the
  // guarded replace path and starts a pristine, unchanged baseline.
  function workbookCommand(operation: WorkbookUiCommand): boolean {
    if (!canMutate()) return false
    publish({ message: '' })
    try {
      const root = history.present
      if (operation.type === 'newWorkbook') {
        if (!replacementSafe() && !dependencies.confirmReplace()) return false
        replace(createWorkbook(dependencies.newId(), dependencies.newId()), false, '', undefined, true)
        return true
      }
      if (operation.type === 'addPage') {
        // Explicit promotion: the legacy Diagram becomes page one by identity.
        const book = isWorkbook(root) ? root : promoteWorkbook(dependencies.newId(), root)
        const page = createDocument(dependencies.newId())
        const title = operation.title?.trim().slice(0, 120)
        const next = addWorkbookPage(book, title ? { ...page, title } : page)
        accept(workspaceCommit(history, next))
        selectPage(page.id)
        return true
      }
      if (operation.type === 'renamePage') {
        const page = activePage(root, operation.pageId)
        if (page.id !== operation.pageId) throw new Error('Unknown workbook page')
        const title = operation.title.slice(0, 120)
        if (title === page.title) return true
        accept(pageCommit(page.id, applyCommand(page, { type: 'metadata', patch: { title } })))
        return true
      }
      if (!isWorkbook(root)) throw new Error('Add a page to create a workbook first')
      const next = operation.type === 'reorderPages' ? reorderWorkbookPages(root, operation.pageIds) : updateWorkbookMetadata(root, operation.patch)
      accept(workspaceCommit(history, next))
      return true
    } catch (error) {
      failure(error)
      return false
    }
  }

  // Initial read-only load is superseded by a fresh read under ownership before enabling any mutation.
  // Pseudocode:
  //   1. read storage; ignore the result when stopped, superseded or another runtime is current
  //   2. saved diagram (empty or not) -> recover it exactly, never offer the picker
  //   3. nothing saved -> new empty document; under ownership, decide once to offer the picker
  //      and treat the pristine blank as backed up so a first template choice needs no discard prompt
  async function load(active: Runtime, owns: boolean) {
    mcpRecovered = false
    const sequence = ++active.load
    publish({ readOnly: true, saveState: owns ? 'loading' : 'read-only', starterOffer: false })
    try {
      const document = await active.storage.load()
      if (active.stopped || runtime !== active || active.load !== sequence) return
      const fresh = document ?? createDocument(dependencies.newId())
      history = workspaceHistory(fresh)
      activePageId = activePage(fresh).id
      mcpRecovered = true
      generation++; preview = null
      backup = null
      baseline = owns && !document ? canonical(fresh) : null
      currentFilename = defaultFilename(fresh)
      const offer = owns && !document && !freshDecided
      if (owns) freshDecided = true
      publish({ readOnly: !owns, saveState: owns ? document ? 'saved' : 'saving' : 'read-only', message: owns ? '' : 'Another tab owns this workspace. Close it to edit here.', starterOffer: offer })
      if (owns && !document) scheduleSave()
    } catch (error) {
      if (active.stopped || runtime !== active || active.load !== sequence) return
      publish({ readOnly: true, saveState: 'error', message: `Cannot load browser storage: ${describe(error)}. Existing data was not overwritten. Download JSON; repair browser storage before reopening.` })
    }
  }
  function start() {
    if (runtime && !runtime.stopped) return
    publish({ readOnly: true, saveState: 'loading', message: '' })
    const active: Runtime = { storage: dependencies.createStorage(), queue: Promise.resolve(), stopped: false, owns: false, load: 0 }
    runtime = active
    try {
      active.release = dependencies.watchLock(owns => {
        if (active.stopped || runtime !== active) return
        active.owns = owns
        if (owns) { invalidate(); void load(active, true) }
        else {
          invalidate(); preview = null
          publish({ readOnly: true, saveState: 'read-only', starterOffer: false })
        }
      })
      if (!active.owns) void load(active, false)
    } catch (error) { lockError(error) }
  }
  function lockError(error: unknown) {
    mcpRecovered = false
    if (runtime) { runtime.owns = false; runtime.load++ }
    if (debounce) { clearTimeout(debounce); debounce = undefined }
    invalidate(); preview = null
    publish({ readOnly: true, saveState: 'error', starterOffer: false, message: `Workspace lock failed: ${describe(error)}. Download JSON and reopen this tab in Edge; close other Diagrammer tabs.` })
  }
  async function stop() {
    const active = runtime
    if (!active || active.stopped) return
    active.stopped = true; mcpRecovered = false; invalidate(); preview = null
    if (debounce) { clearTimeout(debounce); debounce = undefined }
    publish({ readOnly: true, starterOffer: false })
    try { await active.queue }
    finally {
      try { active.release?.() }
      finally { active.storage.close() }
    }
  }
  function newDocument() {
    if (!canMutate()) return
    publish({ message: '' })
    if (!replacementSafe() && !dependencies.confirmReplace()) return
    replace(createDocument(dependencies.newId()), false, '', undefined, true)
  }

  function openStarter(key: StarterKey): boolean {
    if (!canMutate()) return false
    const version = generation
    try {
      const bundled = starterDocument(key)
      const candidate = validateDocument({ ...bundled, id: dependencies.newId() })
      if (!candidate.ok) throw new Error(candidate.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))
      if (!canMutate() || generation !== version) return false
      if (!replacementSafe() && !dependencies.confirmReplace()) return false
      if (!canMutate() || generation !== version) return false
      replace(candidate.value, false, '', undefined, true)
      return true
    } catch (error) {
      failure(error, 'Start failed: ')
      return false
    }
  }

  // Validate, finish initial layout, then confirm replacement. Any newer command or file choice wins.
  // `expectedGeneration` lets a caller that read bytes asynchronously (Recent)
  // bind the open to the generation it started from: any accepted newer
  // document/command in between makes the late read stale (DGM-149 policy).
  async function openFile(file: InputFile, kind: 'open' | 'import', expectedGeneration?: number): Promise<boolean> {
    if (!canMutate()) return false
    if (expectedGeneration !== undefined && expectedGeneration !== generation) return false
    fileJobs++
    invalidate(); publish({ message: '' })
    const token = request
    const version = generation
    const current = () => canMutate() && token === request && version === generation
    // Open accepts a Diagram or Workbook root; Import stays a 5 MiB Diagram path.
    const limit = kind === 'open' ? MAX_WORKBOOK_BYTES : MAX_LEGACY_BYTES
    const limitText = kind === 'open' ? 'JSON files must be at most 64 MiB (diagrams 5 MiB)' : 'JSON files must be at most 5 MiB'
    try {
      if (!/\.json$/i.test(file.name)) throw new Error('Choose a .json file')
      if (file.size > limit) throw new Error(limitText)
      const text = await file.text()
      if (!current()) return false
      if (new TextEncoder().encode(text).byteLength > limit) throw new Error(limitText)
      let document: WorkspaceDocument
      let warnings: string[] | undefined
      if (kind === 'open') {
        const result = parseWorkspace(text)
        if (!result.ok) throw new Error(result.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))
        document = result.value; warnings = result.warnings
      } else {
        const result = importSkillSpec(JSON.parse(text))
        if (!result.ok) throw new Error(result.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))
        warnings = result.warnings
        const imported = result.value
        publish({ isArranging: true })
        layoutJob = dependencies.layout(imported, imported.direction)
        const computed = await layoutJob.promise
        if (!current()) return false
        document = applyCommand(imported, { type: 'applyLayout', expectedRevision: imported.revision, result: computed })
        layoutJob = undefined
        publish({ isArranging: false })
      }
      if (!current() || (!replacementSafe() && !dependencies.confirmReplace()) || !current()) return false
      replace(document, kind === 'open', warnings?.join('; ') ?? '', kind === 'open' ? file.name : undefined)
      return true
    } catch (error) {
      if (current()) failure(error, `${kind === 'open' ? 'Open' : 'Import'} failed: `)
      return false
    } finally {
      fileJobs--
      if (token === request) { layoutJob?.cancel(); layoutJob = undefined; publish({ isArranging: false }) }
    }
  }
  async function arrange(direction: Direction, options?: import('../layout.ts').LayoutOptions) {
    if (!canMutate()) return
    invalidate(); publish({ message: '', isArranging: true })
    const token = request
    const version = generation
    // Layout is bound to the page it was requested for; navigation invalidates it.
    const pageId = activePageId
    const document = currentPage()
    const active = runtime
    try {
      layoutJob = options ? dependencies.layout(preview ?? document, direction, options) : dependencies.layout(preview ?? document, direction)
      const result = await layoutJob.promise
      if (runtime !== active || !canMutate() || token !== request || version !== generation || pageId !== activePageId || document.revision !== currentPage().revision) return
      command({ type: 'applyLayout', expectedRevision: document.revision, result })
    } catch (error) {
      if (token === request && runtime === active && canMutate()) failure(error, 'Auto-arrange failed; retry: ')
    } finally {
      if (token === request) { layoutJob?.cancel(); layoutJob = undefined; publish({ isArranging: false }) }
    }
  }
  async function saveJson(saveAs = false) {
    publish({ message: '' })
    const document = history.present
    const version = generation
    try {
      const initialName = currentFilename || defaultFilename(document)
      // Save/Save As always write the complete root: every page plus workbook metadata.
      const text = JSON.stringify(document, null, 2)
      if (isWorkbook(document) && exceeds(text, MAX_WORKBOOK_BYTES)) throw new Error('Workbook exceeds the 64 MiB limit')
      // Legacy Diagram files keep the unchanged desktop 5 MiB save bound.
      if (!isWorkbook(document) && dependencies.saveDiagram && exceeds(text, MAX_LEGACY_BYTES)) throw new Error('Diagram exceeds desktop byte bounds.')
      const blob = new Blob([text], { type: 'application/json' })
      const saved = dependencies.saveDiagram
        ? await dependencies.saveDiagram(blob, initialName, saveAs)
        : (await dependencies.download(blob, initialName), { saved: true, filename: initialName })
      if (!saved || (typeof saved === 'object' && !saved.saved)) {
        publish({ message: 'Save canceled. No file was written.' })
        return
      }
      if (typeof saved === 'object' && saved.filename) currentFilename = saved.filename
      if (version === generation && document === history.present) {
        backup = canonical(document)
        publish({ message: typeof saved === 'object' && saved.recentError ? saved.recentError : '' })
      } else publish()
    } catch (error) { failure(error, `${saveAs ? 'Save As' : 'Save'} failed: `) }
  }
  async function saveOutput(blob: Blob, name: string, documentId: string) {
    if (!dependencies.saveFile) { await dependencies.download(blob, name); return true }
    const saved = await dependencies.saveFile(blob, name, documentId)
    if ((typeof saved === 'boolean' ? !saved : !saved.saved)) publish({ message: 'Save canceled. No file was written.' })
    return saved
  }
  async function exportImage(options: ExportOptions) {
    if (snapshot.isExporting) return
    const { format, scale, transparent, includeMarkdown = false } = options
    // Paired outputs must use committed data, never the transient draft preview.
    const document = includeMarkdown || format === 'markdown' ? currentPage() : preview ?? currentPage()
    const output = captureOptions(options)
    publish({ message: '', isExporting: true })
    try {
      if (format === 'markdown' && includeMarkdown) throw new Error('Include Markdown is not available for Markdown format.')
      const blob = format === 'svg' ? new Blob([await (output ? dependencies.exportSvg(document, transparent, undefined, output) : dependencies.exportSvg(document, transparent))], { type: 'image/svg+xml' }) : await (output ? dependencies.exportPng(document, scale, transparent, undefined, output) : dependencies.exportPng(document, scale, transparent))
      const description = document.description ?? ''
      if (format === 'markdown') await saveOutput(await createEmbeddedMarkdown(blob, description), `${exportFilenameStem(document.title)}.md`, document.id)
      else if (includeMarkdown) await saveOutput(await createExportZip(blob, `${exportFilenameStem(document.title)}.${format}`, description), `${exportFilenameStem(document.title)}.zip`, document.id)
      else await saveOutput(blob, `${filename(document)}.${format}`, document.id)
    } catch (error) { failure(error, 'Export failed: ') }
    finally { publish({ isExporting: false }) }
  }
  function captureOptions(options: ExportOptions): ExportSceneOptions | undefined {
    const { selectionIds, background, aspect, includeGrid } = options
    if (selectionIds === undefined && background === undefined && aspect === undefined && includeGrid === undefined) return undefined
    return { ...(selectionIds === undefined ? {} : { selectionIds: [...selectionIds] }), ...(background === undefined ? {} : { background }), ...(aspect === undefined ? {} : { aspect }), ...(includeGrid === undefined ? {} : { includeGrid }) }
  }
  async function copyImage(options: ExportOptions) {
    if (snapshot.isExporting) return
    const document = preview ?? currentPage()
    const output = captureOptions(options)
    publish({ message: '', isExporting: true })
    try {
      const png = output ? dependencies.exportPng(document, options.scale, options.transparent, undefined, output) : dependencies.exportPng(document, options.scale, options.transparent)
      let copying: Promise<{ ok: boolean }> = Promise.resolve({ ok: false })
      try {
        if (dependencies.copyImage) copying = Promise.resolve(dependencies.copyImage(png)).then(() => ({ ok: true }), () => ({ ok: false }))
      } catch { copying = Promise.resolve({ ok: false }) }
      const blob = await png
      if ((await copying).ok) publish({ message: 'Image copied.' })
      else {
        if (!await saveOutput(blob, `${filename(document)}.png`, document.id)) return
        publish({ message: 'Image not copied: clipboard unavailable or denied. PNG downloaded.' })
      }
    } catch (error) { failure(error, 'Copy image failed: ') }
    finally { publish({ isExporting: false }) }
  }
  // DGM-151C document exports (JSON/ZIP/PDF/Visio) for the page or workbook scope.
  // Pseudocode: capture the immutable committed root and the active page ID once
  // (roots/pages are never mutated in place, so later edits cannot leak in);
  // never use the transient draft preview or a selection; build through the
  // shared builder; save through the normal native/browser export path. Page
  // or workbook exports never clear the backup: only a complete-root Save does.
  async function exportDocument(options: DocumentExportOptions) {
    if (snapshot.isExporting) return
    const root = history.present, page = currentPage(), version = generation
    publish({ message: '', isExporting: true })
    try {
      let request: DocumentExportRequest
      if (options.scope === 'page') {
        request = { scope: 'page', pageId: page.id, format: options.format }
      } else request = { scope: 'workbook', format: options.format, ...(options.imageFormat ? { imageFormat: options.imageFormat } : {}) }
      const built = await buildDocumentExport(root, request, exportRenderers(), {
        ...(options.background ? { background: options.background } : {}), ...(options.includeGrid === undefined ? {} : { includeGrid: options.includeGrid }),
        ...(options.transparent === undefined ? {} : { transparent: options.transparent }), ...(options.scale ? { scale: options.scale } : {}),
      })
      // A workspace replaced while rendering must not receive a late save prompt.
      if (version !== generation) return
      await saveOutput(built.blob, built.filename, options.scope === 'page' ? page.id : root.id)
    } catch (error) { failure(error, 'Export failed: ') }
    finally { publish({ isExporting: false }) }
  }
  function exportRenderers() {
    return {
      exportSvg: dependencies.exportSvg, exportPng: dependencies.exportPng,
      ...(dependencies.renderPdf ? { renderPdf: dependencies.renderPdf } : {}),
      ...(dependencies.rasterizeIcon ? { rasterizeIcon: dependencies.rasterizeIcon } : {}),
    }
  }
  // MCP keeps its single-diagram contract on the active page; the token also
  // changes on navigation so a token read on one page cannot edit another.
  function mcpState() { return { document: currentPage(), stateToken: `${mcpLifetime}:${generation}.${navigation}` } }

  // Pseudocode: capture one validated canonical document/token and runtime;
  // refuse drafts or competing work without changing UI state; use normal output
  // renderers and shared packaging; budget before base64; recheck all guards
  // after async work and return bytes only, never downloads or cached images.
  async function mcpOutput(operation: McpOutputOperation, context: { deadline: number; active(): boolean }): Promise<McpOutputResult> {
    if (mcpPending) return { ok: false, message: 'Another MCP operation is in progress.' }
    if (!validateOutputOperation(operation)) return { ok: false, message: 'Invalid output arguments.' }
    const document = currentPage(), stateToken = operation.arguments.stateToken
    const activeRuntime = runtime, currentRequest = request
    const limit = 8 * 1024 * 1024
    function check() {
      if (!context.active() || Date.now() >= context.deadline) throw new Error('MCP request expired or disconnected.')
      if (stateToken !== mcpState().stateToken || document !== currentPage()) throw new Error('Stale stateToken. Read get_document before retrying.')
      if (!mcpRecovered || !runtime || runtime.stopped || runtime !== activeRuntime || snapshot.saveState === 'loading' || snapshot.saveState === 'error') throw new Error('Workspace unavailable.')
      if (request !== currentRequest || presenting || preview || fileJobs || snapshot.isExporting || snapshot.isArranging) throw new Error('Workspace is interaction-busy.')
      if (!mcpGuard) throw new Error('Editor interaction state unavailable.')
      const reason = mcpGuard()
      if (reason) throw new Error(`Workspace is interaction-busy: ${reason}`)
    }
    function bound(size: number) { if (size > limit) throw new Error('MCP export exceeds 8 MiB serialized response limit.') }
    try {
      check()
      const validated = validateDocument(document)
      if (!validated.ok) throw new Error('Invalid committed document.')
      mcpPending = true
      const args = operation.name === 'export_diagram' ? operation.arguments : undefined
      const format = args?.format ?? 'png'
      const options: ExportSceneOptions = { background: args?.background ?? 'diagram', aspect: args?.aspect ?? 'content', ...(args?.includeGrid === undefined ? {} : { includeGrid: args.includeGrid }) }
      let blob: Blob
      if (format === 'json') blob = new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' })
      else if (format === 'svg') blob = new Blob([await dependencies.exportSvg(document, args?.transparent ?? false, undefined, options)], { type: 'image/svg+xml' })
      else blob = await dependencies.exportPng(document, args?.scale ?? 1, args?.transparent ?? false, undefined, options)
      check()
      bound(blob.size)
      const stem = exportFilenameStem(document.title)
      let filename = `${stem}.${format === 'markdown' ? 'md' : format}`
      if (format === 'markdown') {
        bound((document.description?.length ?? 0) + 4 * Math.ceil(blob.size / 3) + 128)
        blob = await createEmbeddedMarkdown(blob, document.description)
      } else if (args?.includeMarkdown) {
        bound(blob.size + new TextEncoder().encode(document.description ?? '').length + 1024)
        blob = await createExportZip(blob, filename, document.description)
        filename = `${stem}.zip`
      }
      check()
      const mimeType = blob.type.split(';')[0]
      const binary = mimeType === 'image/png' || mimeType === 'application/zip'
      bound((binary ? 4 * Math.ceil(blob.size / 3) : blob.size) + 1024)
      let data: string
      if (binary) {
        const bytes = new Uint8Array(await blob.arrayBuffer())
        const chunks: string[] = []
        for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
        data = btoa(chunks.join(''))
      } else data = await blob.text()
      const output: McpOutput = { content: [
        mimeType === 'image/png' ? { type: 'image', mimeType, data } : {
          type: 'resource', resource: { uri: `diagrammer://exports/${encodeURIComponent(stateToken)}/${filename}`, mimeType, ...(binary ? { blob: data } : { text: data }) },
        },
        { type: 'text', text: JSON.stringify({ stateToken, mimeType, filename, byteLength: blob.size }) },
      ] }
      bound(new TextEncoder().encode(JSON.stringify({ ok: true, output })).length)
      check()
      return { ok: true, output }
    } catch (error) { return { ok: false, message: describe(error) } }
    finally { mcpPending = false }
  }

  // Pseudocode: reject stale/expired/interactive work; compute an entire pure
  // batch before a single accept; recheck guards at commit. Layout uses the
  // existing worker/cancellation epoch and rechecks after its async boundary.
  async function mcpMutate(operation: McpOperation, context: { deadline: number; active(): boolean }): Promise<McpMutationResult> {
    if (mcpPending) return { ok: false, message: 'Another MCP mutation is in progress.' }
    if (!validateMutation(operation)) return { ok: false, message: 'Invalid mutation arguments.' }
    const expected = operation.arguments.stateToken
    const currentRequest = request
    const activeRuntime = runtime
    function check(ownLayout = false) {
      if (!context.active() || Date.now() >= context.deadline) throw new Error('MCP request expired or disconnected.')
      if (expected !== mcpState().stateToken) throw new Error('Stale stateToken. Read get_document before retrying.')
      if (!canMutate() || snapshot.saveState === 'loading' || snapshot.saveState === 'error') throw new Error('Workspace unavailable or read-only.')
      if (runtime !== activeRuntime || (!ownLayout && request !== currentRequest)) throw new Error('Workspace operation changed.')
      if (presenting || preview || fileJobs || snapshot.isExporting || (!ownLayout && snapshot.isArranging)) throw new Error('Workspace is interaction-busy.')
      if (!mcpGuard) throw new Error('Editor interaction state unavailable.')
      const reason = mcpGuard()
      if (reason) throw new Error(`Workspace is interaction-busy: ${reason}`)
    }
    let remoteLayoutRequest: number | undefined
    let remoteDeadline: ReturnType<typeof setTimeout> | undefined
    try {
      check()
      mcpPending = true
      if (operation.name === 'edit_diagram') {
        const pageId = activePageId
        let next = currentPage()
        for (const command of operation.arguments.commands) next = applyCommand(next, command)
        const committed = pageCommit(pageId, next)
        check()
        accept(committed)
      } else if (operation.name === 'create_diagram') {
        // A workbook root holds other pages; replacing it here would silently
        // discard them. Refuse with guidance instead of guessing intent.
        if (isWorkbook(history.present)) throw new Error('create_diagram would replace every page of the open workbook. Use edit_workbook with addPage to add a page, or newWorkbook to start a new workbook explicitly.')
        const key = operation.arguments.template
        const candidate = key ? validateDocument({ ...starterDocument(key), id: dependencies.newId() }) : validateDocument(createDocument(dependencies.newId()))
        if (!candidate.ok) throw new Error('Invalid starting diagram.')
        check()
        if (!replacementSafe() && !dependencies.confirmReplace()) throw new Error('Diagram replacement canceled.')
        check()
        replace(candidate.value, false, '', undefined, true)
      } else if (operation.name === 'arrange_diagram') {
        const pageId = activePageId
        const document = currentPage()
        invalidate(); publish({ message: '', isArranging: true })
        remoteLayoutRequest = request
        layoutJob = operation.arguments.arrangement
          ? dependencies.layout(document, operation.arguments.direction, { arrangement: operation.arguments.arrangement })
          : dependencies.layout(document, operation.arguments.direction)
        const result = await Promise.race([layoutJob.promise, new Promise<never>((_resolve, reject) => {
          remoteDeadline = setTimeout(() => reject(new Error('MCP Auto-arrange timed out.')), Math.max(0, context.deadline - Date.now()))
        })])
        check(true)
        if (request !== remoteLayoutRequest) throw new Error('Auto-arrange superseded by newer work.')
        const next = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result })
        const committed = pageCommit(pageId, next)
        check(true)
        accept(committed)
      } else {
        const next = operation.name === 'undo' ? workspaceUndo(history) : workspaceRedo(history)
        if (next === history) throw new Error(`No ${operation.name} step is available.`)
        check()
        accept(next, true)
      }
      return { ok: true, value: mcpState() }
    } catch (error) {
      return { ok: false, message: describe(error) }
    } finally {
      if (remoteDeadline) clearTimeout(remoteDeadline)
      mcpPending = false
      if (remoteLayoutRequest !== undefined && request === remoteLayoutRequest) invalidate()
    }
  }
  // DGM-151D identity tokens. Roots and pages are immutable and structurally
  // shared, so an object serial changes exactly when that root/page changes:
  // an edit to page B leaves page A's token valid, while any root change
  // invalidates the root token. Navigation is not part of these tokens.
  const serials = new WeakMap<object, number>()
  let nextSerial = 0
  function serial(value: object) {
    let found = serials.get(value)
    if (found === undefined) { found = ++nextSerial; serials.set(value, found) }
    return found
  }
  const rootToken = (root: WorkspaceDocument) => `${mcpLifetime}:w${serial(root)}`
  const pageToken = (page: Diagram) => `${mcpLifetime}:p${serial(page)}:${page.id}`
  function workbookState(): McpWorkbookState {
    const root = history.present
    return {
      kind: isWorkbook(root) ? 'workbook' : 'diagram', id: root.id, title: root.title,
      ...(root.description ? { description: root.description } : {}), revision: root.revision,
      activePageId: currentPage().id, stateToken: rootToken(root),
      pages: workspacePages(root).map(page => ({ id: page.id, title: page.title, stateToken: pageToken(page) })),
    }
  }
  // Pseudocode (edit): validate shape; require the current root token; build the
  // next root purely (newWorkbook only as the first command, guarded like New;
  // addPage explicitly promotes a Diagram root; pageCommand touches only the
  // named page); recheck guards; commit ONE history entry. Export: capture the
  // immutable root once, accept the root token (or the page's own token for a
  // page scope), render via the shared builder, then recheck liveness/budget.
  async function mcpWorkbook(operation: McpWorkbookOperation, context: { deadline: number; active(): boolean }): Promise<McpWorkbookResult> {
    if (mcpPending) return { ok: false, message: 'Another MCP operation is in progress.' }
    if (!validateWorkbookOperation(operation)) return { ok: false, message: 'Invalid workbook arguments.' }
    const activeRuntime = runtime, currentRequest = request
    function available() {
      if (!context.active() || Date.now() >= context.deadline) throw new Error('MCP request expired or disconnected.')
      if (!mcpRecovered || !runtime || runtime.stopped || runtime !== activeRuntime || snapshot.saveState === 'loading' || snapshot.saveState === 'error') throw new Error('Workspace unavailable.')
    }
    function idle() {
      if (request !== currentRequest || presenting || preview || fileJobs || snapshot.isExporting || snapshot.isArranging) throw new Error('Workspace is interaction-busy.')
      if (!mcpGuard) throw new Error('Editor interaction state unavailable.')
      const reason = mcpGuard()
      if (reason) throw new Error(`Workspace is interaction-busy: ${reason}`)
    }
    try {
      if (operation.name === 'get_workbook') {
        available()
        const validated = validateWorkspace(history.present)
        if (!validated.ok) throw new Error('Invalid committed workbook.')
        return { ok: true, value: workbookState() }
      }
      if (operation.name === 'edit_workbook') return await editWorkbook(operation.arguments, available, idle)
      return await exportWorkbook(operation.arguments, available, idle)
    } catch (error) { return { ok: false, message: describe(error) } }
  }
  async function editWorkbook(args: { stateToken: string; commands: WorkbookEditCommand[] }, available: () => void, idle: () => void): Promise<McpWorkbookResult> {
    const expected = args.stateToken
    function check() {
      available()
      if (expected !== rootToken(history.present)) throw new Error('Stale stateToken. Read get_workbook before retrying.')
      if (!canMutate()) throw new Error('Workspace unavailable or read-only.')
      idle()
    }
    if (!validateWorkbookEdit(args.commands)) return { ok: false, message: 'Invalid workbook commands.' }
    check()
    mcpPending = true
    try {
      const [first, ...rest] = args.commands
      let replaced = false
      let root: WorkspaceDocument = history.present
      let select: string | undefined
      const commands = first.type === 'newWorkbook' ? rest : args.commands
      if (first.type === 'newWorkbook') {
        if (first.id === first.pageId) throw new Error('Workbook and page IDs must differ.')
        root = createWorkbook(first.id, first.pageId, first.title)
        replaced = true; select = first.pageId
      }
      for (const command of commands) {
        if (command.type === 'newWorkbook') throw new Error('newWorkbook must be the first command.')
        if (command.type === 'addPage') {
          const book = isWorkbook(root) ? root : promoteWorkbook(dependencies.newId(), root)
          if (hasPage(book, command.pageId) || book.id === command.pageId) throw new Error(`Page ID already exists: ${command.pageId}`)
          const page = createDocument(command.pageId)
          root = addWorkbookPage(book, command.title ? { ...page, title: command.title } : page)
          select = command.pageId
        } else if (command.type === 'renamePage' || command.type === 'pageCommand') {
          const page = activePage(root, command.pageId)
          if (page.id !== command.pageId) throw new Error(`Unknown page: ${command.pageId}`)
          const next = command.type === 'renamePage'
            ? (command.title === page.title ? page : applyCommand(page, { type: 'metadata', patch: { title: command.title } }))
            : applyCommand(page, command.command)
          root = replaceWorkspacePage(root, page.id, next)
        } else {
          if (!isWorkbook(root)) throw new Error('This document is a single diagram. Use addPage to make it a workbook first.')
          root = command.type === 'reorderPages' ? reorderWorkbookPages(root, command.pageIds) : updateWorkbookMetadata(root, { ...(command.title === undefined ? {} : { title: command.title }), ...(command.description === undefined ? {} : { description: command.description }) })
        }
      }
      const validated = validateWorkspace(root)
      if (!validated.ok) throw new Error(`Invalid workbook: ${validated.errors.map(error => `${error.path} ${error.message}`).join('; ')}`)
      if (replaced) {
        check()
        if (!replacementSafe() && !dependencies.confirmReplace()) throw new Error('Workbook replacement canceled.')
        check()
        // Starts a pristine baseline: the remaining commands are part of the new workbook's first state.
        replace(root, false, '', undefined, !commands.length)
      } else {
        check()
        if (root !== history.present) accept(workspaceCommit(history, root))
      }
      if (select && hasPage(history.present, select)) selectPage(select)
      return { ok: true, value: workbookState() }
    } finally { mcpPending = false }
  }
  async function exportWorkbook(args: { stateToken: string; scope: 'page'; pageId: string; format: 'json' | 'svg' | 'png' | 'markdown' | 'pdf' | 'vsdx' } | { stateToken: string; scope: 'workbook'; format: 'json' | 'zip' | 'pdf' | 'vsdx' }, available: () => void, idle: () => void): Promise<McpWorkbookResult> {
    const root = history.present, stateToken = args.stateToken
    const limit = 8 * 1024 * 1024
    available(); idle()
    let ownerId = root.id
    if (args.scope === 'page') {
      const page = activePage(root, args.pageId)
      if (page.id !== args.pageId) throw new Error(`Unknown page: ${args.pageId}`)
      if (stateToken !== rootToken(root) && stateToken !== pageToken(page)) throw new Error('Stale stateToken. Read get_workbook before retrying.')
      ownerId = page.id
    } else if (stateToken !== rootToken(root)) throw new Error('Stale stateToken. Read get_workbook before retrying.')
    const validated = validateWorkspace(root)
    if (!validated.ok) throw new Error('Invalid committed workbook.')
    mcpPending = true
    try {
      const request: DocumentExportRequest = args.scope === 'page' ? { scope: 'page', pageId: args.pageId, format: args.format } : { scope: 'workbook', format: args.format }
      const built = await buildDocumentExport(root, request, exportRenderers())
      available()
      const binary = built.mimeType !== 'application/json' && built.mimeType !== 'image/svg+xml' && built.mimeType !== 'text/markdown'
      if ((binary ? 4 * Math.ceil(built.blob.size / 3) : built.blob.size) + 1024 > limit) throw new Error('MCP export exceeds 8 MiB serialized response limit.')
      let data: string
      if (binary) {
        const bytes = new Uint8Array(await built.blob.arrayBuffer())
        const chunks: string[] = []
        for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
        data = btoa(chunks.join(''))
      } else data = await built.blob.text()
      const output: McpOutput = { content: [
        built.mimeType === 'image/png' ? { type: 'image', mimeType: built.mimeType, data } : {
          type: 'resource', resource: { uri: `diagrammer://exports/${encodeURIComponent(stateToken)}/${built.filename}`, mimeType: built.mimeType, ...(binary ? { blob: data } : { text: data }) },
        },
        { type: 'text', text: JSON.stringify({ stateToken, scope: args.scope, ownerId, mimeType: built.mimeType, filename: built.filename, byteLength: built.blob.size }) },
      ] }
      if (new TextEncoder().encode(JSON.stringify({ ok: true, output })).length > limit) throw new Error('MCP export exceeds 8 MiB serialized response limit.')
      available()
      return { ok: true, output }
    } finally { mcpPending = false }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    start, stop, command, boundaryOperation, newDocument, openStarter, openFile, saveJson, arrange, exportImage, exportDocument, copyImage, lockError, presentation, canMutate,
    reportError: (error: unknown, prefix = '') => failure(error, prefix),
    mcpState, mcpMutate, mcpOutput, mcpWorkbook, mcpReady: () => mcpRecovered, setMcpGuard: (guard: (() => string | null) | null) => { mcpGuard = guard },
    // The editor acknowledges the offer once it shows the picker, so remounts never reopen it.
    starterOffered: () => { publish({ starterOffer: false }) },
    undo: () => { if (canMutate()) accept(workspaceUndo(history), true) },
    redo: () => { if (canMutate()) accept(workspaceRedo(history), true) },
    selectPage, workbookCommand,
    /** Accepted-work epoch; async callers (Recent) capture it before reading bytes. */
    generation: () => generation,
    preview: (document: Diagram | null) => { if (presenting) return; invalidate(); preview = canMutate() ? document : null },
  }
}