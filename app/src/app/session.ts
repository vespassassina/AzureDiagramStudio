import { applyCommand, importSkillSpec, parseDocument, validateDocument } from '../document/index.ts'
import { createDocument, historyCommit, historyRedo, historyUndo } from '../model.ts'
import type { Diagram, Direction, History } from '../model.ts'
import type { DocumentCommand, DocumentStorage, ExportOptions, ExportSceneOptions, SaveState, StarterKey } from '../contracts.ts'
import type { LayoutResult } from '../layout.ts'
import { starterCatalog } from './starters.ts'
import type { McpMutationResult, McpOperation } from './mcp-contract.ts'
import { validateMutation } from '../../electron/mcp-schema.mjs'

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
  layout(document: Diagram, direction: Direction): LayoutJob
  download(blob: Blob, filename: string): void | Promise<void>
  confirmReplace(): boolean
  newId(): string
  exportSvg(document: Diagram, transparent: boolean, includeGrid?: boolean, options?: ExportSceneOptions): Promise<string>
  exportPng(document: Diagram, scale: 1 | 2, transparent: boolean, includeGrid?: boolean, options?: ExportSceneOptions): Promise<Blob>
  copyImage?(png: Promise<Blob>): Promise<void>
}
export type SessionSnapshot = {
  document: Diagram; canUndo: boolean; canRedo: boolean; readOnly: boolean
  saveState: SaveState; backupDirty: boolean; message: string; isArranging: boolean; isExporting: boolean
    // Session-only UI intent: the first owned load found no saved diagram. Never persisted.
    starterOffer: boolean
  }
  type Runtime = { storage: DocumentStorage; release?: () => void; queue: Promise<void>; stopped: boolean; owns: boolean; load: number }
type InputFile = { name: string; size: number; text(): Promise<string> }
const canonical = (document: Diagram) => JSON.stringify(document)
const describe = (error: unknown) => error instanceof Error ? error.message : String(error)
const filename = (document: Diagram) => (document.title.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'architecture')

export function createSession(dependencies: SessionDependencies) {
  const mcpLifetime = globalThis.crypto.randomUUID()
  let mcpGuard: (() => string | null) | null = null
  let mcpPending = false
  let mcpRecovered = false
  let fileJobs = 0
  // Non-mutating empty canvas while recovery runs; never the commerce sample.
  let history: History = { past: [], present: createDocument('loading'), future: [] }
  let backup: string | null = null
  let generation = 0
  let request = 0
  let runtime: Runtime | undefined
  let debounce: ReturnType<typeof setTimeout> | undefined
  let preview: Diagram | null = null
  let layoutJob: LayoutJob | undefined
  let presenting = false
  // The startup picker is decided once, by the first successful owned load.
  let freshDecided = false
  let snapshot: SessionSnapshot = { document: history.present, canUndo: false, canRedo: false, readOnly: true, saveState: 'loading', backupDirty: true, message: '', isArranging: false, isExporting: false, starterOffer: false }
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
  function accept(next: History) {
    if (next === history) return
    history = next; generation++; preview = null
    invalidate(); publish({ message: '', starterOffer: false }); scheduleSave()
  }
  function command(command: DocumentCommand) {
    if (!canMutate()) return
    publish({ message: '' })
    try { accept(historyCommit(history, applyCommand(history.present, command))) }
    catch (error) { failure(error) }
  }
  function replace(document: Diagram, backedUp: boolean, message = '') {
    invalidate(); generation++; preview = null
    history = { past: [], present: document, future: [] }
    backup = backedUp ? canonical(document) : null
    publish({ message, starterOffer: false }); scheduleSave()
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
      history = { past: [], present: fresh, future: [] }
      mcpRecovered = true
      generation++; preview = null
      backup = owns && !document ? canonical(fresh) : null
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
    if (snapshot.backupDirty && !dependencies.confirmReplace()) return
    replace(createDocument(dependencies.newId()), true)
  }

  function openStarter(key: StarterKey): boolean {
    if (!canMutate()) return false
    const version = generation
    try {
      const bundled = starterDocument(key)
      const candidate = validateDocument({ ...bundled, id: dependencies.newId() })
      if (!candidate.ok) throw new Error(candidate.errors.map(issue => `${issue.path}: ${issue.message}`).join('; '))
      if (!canMutate() || generation !== version) return false
      if (snapshot.backupDirty && !dependencies.confirmReplace()) return false
      if (!canMutate() || generation !== version) return false
      replace(candidate.value, false)
      return true
    } catch (error) {
      failure(error, 'Start failed: ')
      return false
    }
  }

  // Validate, finish initial layout, then confirm replacement. Any newer command or file choice wins.
  async function openFile(file: InputFile, kind: 'open' | 'import') {
    if (!canMutate()) return
    fileJobs++
    invalidate(); publish({ message: '' })
    const token = request
    const version = generation
    const current = () => canMutate() && token === request && version === generation
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
      fileJobs--
      if (token === request) { layoutJob?.cancel(); layoutJob = undefined; publish({ isArranging: false }) }
    }
  }
  async function arrange(direction: Direction) {
    if (!canMutate()) return
    invalidate(); publish({ message: '', isArranging: true })
    const token = request
    const version = generation
    const document = history.present
    const active = runtime
    try {
      layoutJob = dependencies.layout(preview ?? document, direction)
      const result = await layoutJob.promise
      if (runtime !== active || !canMutate() || token !== request || version !== generation || document.revision !== history.present.revision) return
      command({ type: 'applyLayout', expectedRevision: document.revision, result })
    } catch (error) {
      if (token === request && runtime === active && canMutate()) failure(error, 'Auto-arrange failed; retry: ')
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
    const { format, scale, transparent } = options
    const output = captureOptions(options)
    publish({ message: '', isExporting: true })
    try {
      const blob = format === 'svg' ? new Blob([await (output ? dependencies.exportSvg(document, transparent, undefined, output) : dependencies.exportSvg(document, transparent))], { type: 'image/svg+xml' }) : await (output ? dependencies.exportPng(document, scale, transparent, undefined, output) : dependencies.exportPng(document, scale, transparent))
      await dependencies.download(blob, `${filename(document)}.${format}`)
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
    const document = preview ?? history.present
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
        await dependencies.download(blob, `${filename(document)}.png`)
        publish({ message: 'Image not copied: clipboard unavailable or denied. PNG downloaded.' })
      }
    } catch (error) { failure(error, 'Copy image failed: ') }
    finally { publish({ isExporting: false }) }
  }
  function mcpState() { return { document: history.present, stateToken: `${mcpLifetime}:${generation}` } }

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
        let next = history.present
        for (const command of operation.arguments.commands) next = applyCommand(next, command)
        const committed = historyCommit(history, next)
        check()
        accept(committed)
      } else if (operation.name === 'create_diagram') {
        const key = operation.arguments.template
        const candidate = key ? validateDocument({ ...starterDocument(key), id: dependencies.newId() }) : validateDocument(createDocument(dependencies.newId()))
        if (!candidate.ok) throw new Error('Invalid starting diagram.')
        check()
        if (snapshot.backupDirty && !dependencies.confirmReplace()) throw new Error('Diagram replacement canceled.')
        check()
        replace(candidate.value, !key)
      } else if (operation.name === 'arrange_diagram') {
        const document = history.present
        invalidate(); publish({ message: '', isArranging: true })
        remoteLayoutRequest = request
        layoutJob = dependencies.layout(document, operation.arguments.direction)
        const result = await Promise.race([layoutJob.promise, new Promise<never>((_resolve, reject) => {
          remoteDeadline = setTimeout(() => reject(new Error('MCP Auto-arrange timed out.')), Math.max(0, context.deadline - Date.now()))
        })])
        check(true)
        if (request !== remoteLayoutRequest) throw new Error('Auto-arrange superseded by newer work.')
        const next = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result })
        const committed = historyCommit(history, next)
        check(true)
        accept(committed)
      } else {
        const next = operation.name === 'undo' ? historyUndo(history) : historyRedo(history)
        if (next === history) throw new Error(`No ${operation.name} step is available.`)
        check()
        accept(next)
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
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } },
    start, stop, command, newDocument, openStarter, openFile, saveJson, arrange, exportImage, copyImage, lockError, presentation, canMutate,
    mcpState, mcpMutate, mcpReady: () => mcpRecovered, setMcpGuard: (guard: (() => string | null) | null) => { mcpGuard = guard },
    // The editor acknowledges the offer once it shows the picker, so remounts never reopen it.
    starterOffered: () => { publish({ starterOffer: false }) },
    undo: () => { if (canMutate()) accept(historyUndo(history)) },
    redo: () => { if (canMutate()) accept(historyRedo(history)) },
    preview: (document: Diagram | null) => { if (presenting) return; invalidate(); preview = canMutate() ? document : null },
  }
}