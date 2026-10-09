import { applyCommand, importSkillSpec, parseDocument } from '../document/index.ts'
import { createDocument, historyCommit, historyRedo, historyUndo, sampleDiagram } from '../model.ts'
import type { Diagram, Direction, History } from '../model.ts'
import type { DocumentCommand, DocumentStorage, ExportOptions, SaveState } from '../contracts.ts'
import type { LayoutResult } from '../layout.ts'

export type LayoutJob = { promise: Promise<LayoutResult>; cancel(): void }
export type SessionDependencies = {
  createStorage(): DocumentStorage
  watchLock(callback: (writable: boolean) => void): () => void
  layout(document: Diagram, direction: Direction): LayoutJob
  download(blob: Blob, filename: string): void | Promise<void>
  confirmReplace(): boolean
  newId(): string
  exportSvg(document: Diagram, transparent: boolean): Promise<string>
  exportPng(document: Diagram, scale: 1 | 2, transparent: boolean): Promise<Blob>
}
export type SessionSnapshot = {
  document: Diagram; canUndo: boolean; canRedo: boolean; readOnly: boolean
  saveState: SaveState; backupDirty: boolean; message: string; isArranging: boolean; isExporting: boolean
}
type Runtime = { storage: DocumentStorage; release?: () => void; queue: Promise<void>; stopped: boolean; owns: boolean; load: number }
type InputFile = { name: string; size: number; text(): Promise<string> }
const canonical = (document: Diagram) => JSON.stringify(document)
const describe = (error: unknown) => error instanceof Error ? error.message : String(error)
const filename = (document: Diagram) => (document.title.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'architecture')

export function createSession(dependencies: SessionDependencies) {
  let history: History = { past: [], present: sampleDiagram(), future: [] }
  let backup: string | null = null
  let generation = 0
  let request = 0
  let runtime: Runtime | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  let preview: Diagram | null = null
  let layoutJob: LayoutJob | undefined
  let snapshot: SessionSnapshot = { document: history.present, canUndo: false, canRedo: false, readOnly: true, saveState: 'loading', backupDirty: true, message: '', isArranging: false, isExporting: false }
  let serializedDocument = history.present
  let serialized = canonical(serializedDocument)
  const listeners = new Set<() => void>()
  function publish(patch: Partial<SessionSnapshot> = {}) {
    if (history.present !== serializedDocument) { serializedDocument = history.present; serialized = canonical(serializedDocument) }
    const next = { ...snapshot, document: history.present, canUndo: !!history.past.length, canRedo: !!history.future.length, backupDirty: backup !== serialized, ...patch }
    if ((Object.keys(next) as (keyof SessionSnapshot)[]).every(key => next[key] === snapshot[key])) return
    snapshot = next
    for (const listener of listeners) listener()
  }
  function writable() { return !!runtime && !runtime.stopped && runtime.owns && !snapshot.readOnly }
  function invalidate() {
    request++
    layoutJob?.cancel(); layoutJob = undefined
    publish({ isArranging: false })
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
  function accept(next: History) {
    if (next === history) return
    history = next; generation++; preview = null
    invalidate(); publish({ message: '' }); scheduleSave()
  }
  function command(command: DocumentCommand) {
    if (!writable()) return
    publish({ message: '' })
    try { accept(historyCommit(history, applyCommand(history.present, command))) }
    catch (error) { failure(error) }
  }
  function replace(document: Diagram, backedUp: boolean, message = '') {
    invalidate(); generation++; preview = null
    history = { past: [], present: document, future: [] }
    backup = backedUp ? canonical(document) : null
    publish({ message }); scheduleSave()
  }

  // Initial read-only load is superseded by a fresh read under ownership before enabling any mutation.
  async function load(active: Runtime, owns: boolean) {
    const sequence = ++active.load
    publish({ readOnly: true, saveState: owns ? 'loading' : 'read-only' })
    try {
      const document = await active.storage.load()
      if (active.stopped || runtime !== active || active.load !== sequence) return
      history = { past: [], present: document ?? sampleDiagram(), future: [] }
      generation++; backup = null; preview = null
      publish({ readOnly: !owns, saveState: owns ? document ? 'saved' : 'saving' : 'read-only', message: owns ? '' : 'Another tab owns this workspace. Close it to edit here.' })
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
          publish({ readOnly: true, saveState: 'read-only' })
        }
      })
      if (!active.owns) void load(active, false)
    } catch (error) { lockError(error) }
  }
  function lockError(error: unknown) {
    if (runtime) { runtime.owns = false; runtime.load++ }
    if (debounce) { clearTimeout(debounce); debounce = undefined }
    invalidate(); preview = null
    publish({ readOnly: true, saveState: 'error', message: `Workspace lock failed: ${describe(error)}. Download JSON and reopen this tab in Edge; close other Diagrammer tabs.` })
  }
  async function stop() {
    const active = runtime
    if (!active || active.stopped) return
    active.stopped = true; invalidate(); preview = null
    if (debounce) { clearTimeout(debounce); debounce = undefined }
    publish({ readOnly: true })
    try { await active.queue }
    finally {
      try { active.release?.() }
      finally { active.storage.close() }
    }
  }
  function newDocument() {
    if (!writable()) return
    publish({ message: '' })
    if (snapshot.backupDirty && !dependencies.confirmReplace()) return
    replace(createDocument(dependencies.newId()), true)
  }

  // Validate, finish initial layout, then confirm replacement. Any newer command or file choice wins.
  async function openFile(file: InputFile, kind: 'open' | 'import') {
    if (!writable()) return
    invalidate(); publish({ message: '' })
    const token = request
    const version = generation
    const current = () => writable() && token === request && version === generation
    try {
      if (!/\.json$/i.test(file.name)) throw new Error('Choose a .json file')
      if (file.size > 5 * 1024 * 1024) throw new Error('JSON files must be at most 5 MiB')
      const text = await file.text()
      if (!current()) return
      if (new TextEncoder().encode(text).byteLength > 5 * 1024 * 1024) throw new Error('JSON files must be at most 5 MiB')
      const result = kind === 'open' ? parseDocument(text) : importSkillSpec(JSON.parse(text))
      if (!result.ok) throw new Error(result.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))
      let document = result.value
      if (kind === 'import') {
        publish({ isArranging: true })
        layoutJob = dependencies.layout(document, document.direction)
        const computed = await layoutJob.promise
        if (!current()) return
        document = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result: computed })
        layoutJob = undefined
        publish({ isArranging: false })
      }
      if (!current() || (snapshot.backupDirty && !dependencies.confirmReplace()) || !current()) return
      replace(document, kind === 'open', result.warnings?.join('; ') ?? '')
    } catch (error) {
      if (current()) failure(error, `${kind === 'open' ? 'Open' : 'Import'} failed: `)
    } finally {
      if (token === request) { layoutJob?.cancel(); layoutJob = undefined; publish({ isArranging: false }) }
    }
  }
  async function arrange(direction: Direction) {
    if (!writable()) return
    invalidate(); publish({ message: '', isArranging: true })
    const token = request
    const version = generation
    const document = history.present
    const active = runtime
    try {
      layoutJob = dependencies.layout(preview ?? document, direction)
      const result = await layoutJob.promise
      if (runtime !== active || !writable() || token !== request || version !== generation || document.revision !== history.present.revision) return
      command({ type: 'applyLayout', expectedRevision: document.revision, result })
    } catch (error) {
      if (token === request && runtime === active && writable()) failure(error, 'Auto-arrange failed; retry: ')
    } finally {
      if (token === request) { layoutJob?.cancel(); layoutJob = undefined; publish({ isArranging: false }) }
    }
  }
  async function saveJson() {
    publish({ message: '' })
    const document = history.present
    const version = generation
    try {
      await dependencies.download(new Blob([JSON.stringify(document, null, 2)], { type: 'application/json' }), `${filename(document)}.json`)
      if (version === generation && document === history.present) { backup = canonical(document); publish() }
    } catch (error) { failure(error, 'JSON download failed: ') }
  }
  async function exportImage(options: ExportOptions) {
    if (snapshot.isExporting) return
    const document = preview ?? history.present
    publish({ message: '', isExporting: true })
    try {
      const blob = options.format === 'svg' ? new Blob([await dependencies.exportSvg(document, options.transparent)], { type: 'image/svg+xml' }) : await dependencies.exportPng(document, options.scale, options.transparent)
      await dependencies.download(blob, `${filename(document)}.${options.format}`)
    } catch (error) { failure(error, 'Export failed: ') }
    finally { publish({ isExporting: false }) }
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    start, stop, command, newDocument, openFile, saveJson, arrange, exportImage, lockError,
    undo: () => { if (writable()) accept(historyUndo(history)) },
    redo: () => { if (writable()) accept(historyRedo(history)) },
    preview: (document: Diagram | null) => { invalidate(); preview = writable() ? document : null },
  }
}