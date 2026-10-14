import { describe, expect, it, vi } from 'vitest'
import { createDocument, sampleDiagram } from '../model.ts'
import type { Diagram } from '../model.ts'
import type { DocumentStorage } from '../contracts.ts'
import { createSession } from './session.ts'
import type { SessionDependencies } from './session.ts'
import webApiSource from '../../../examples/azure-web-app.json?raw'
import eventSource from '../../../examples/event-driven.json?raw'
import fabricSource from '../../../examples/fabric-onelake.json?raw'
import enterpriseSource from '../../../examples/enterprise-integration.json?raw'
import { parseDocument } from '../document/index.ts'
import { alignmentPositions } from '../editor/interactions.ts'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
async function settle() { for (let count = 0; count < 12; count++) await Promise.resolve() }
function harness(initial: Diagram | null = null) {
  let writable!: (value: boolean) => void
  const storage: DocumentStorage = { load: vi.fn(async () => initial), save: vi.fn(async () => {}), close: vi.fn() }
  const release = vi.fn()
  const downloads = vi.fn(async (_blob: Blob, _filename: string) => {})
  const jobs: ReturnType<typeof deferred<{ diagram: Diagram; revision: number }>>[] = []
  const cancel = vi.fn()
  const dependencies: SessionDependencies = {
    createStorage: () => storage,
    watchLock: callback => { writable = callback; callback(false); return release },
    layout: vi.fn(() => { const job = deferred<{ diagram: Diagram; revision: number }>(); jobs.push(job); return { promise: job.promise, cancel } }),
    download: downloads,
    confirmReplace: vi.fn(() => true),
    newId: () => 'new-document',
    exportSvg: vi.fn(async () => '<svg/>'),
    exportPng: vi.fn(async () => new Blob()),
  }
  const session = createSession(dependencies)
  session.start()
  return { session, storage, dependencies, release, downloads, jobs, cancel, writable: (value: boolean) => writable(value) }
}
async function ready(initial: Diagram | null = null) { const host = harness(initial); host.writable(true); await settle(); return host }

describe('DGM-040 integrated session', () => {
  it('should_commit_one_alignment_move_and_restore_exact_routes_by_undo_redo_DGM110', async () => {
    const document = {
      ...createDocument('alignment-session'),
      entities: [
        { id: 'a', kind: 'component' as const, label: 'a', subtitle: '', icon: 'service', color: 'teal', parentId: null, layer: 'foreground' as const, x: 80, y: 120, width: 240, height: 88 },
        { id: 'b', kind: 'component' as const, label: 'b', subtitle: '', icon: 'service', color: 'teal', parentId: null, layer: 'foreground' as const, x: 440, y: 240, width: 320, height: 104 },
      ],
      connections: [{ id: 'ab', from: 'a', to: 'b', label: '', style: 'solid' as const, arrow: 'forward' as const, points: [{ x: 320, y: 164 }, { x: 440, y: 292 }], labelPosition: { x: 380, y: 228 }, routeRevision: 0 }],
    }
    const host = await ready(document)
    const positions = alignmentPositions(document, ['b', 'a'], 'align-top')!

    host.session.command({ type: 'move', positions })
    const accepted = host.session.getSnapshot()
    expect(accepted.document.revision).toBe(document.revision + 1)
    expect(accepted.document.entities.find(entity => entity.id === 'b')).toMatchObject({ x: 440, y: 120 })
    expect(accepted.document.connections[0]).toMatchObject({ id: 'ab', from: 'a', to: 'b' })
    for (const key of ['points', 'routeRevision', 'labelPosition']) expect(accepted.document.connections[0]).not.toHaveProperty(key)
    expect(accepted.canUndo).toBe(true)

    host.session.undo()
    expect(host.session.getSnapshot().document).toEqual(document)
    host.session.redo()
    expect(host.session.getSnapshot().document).toEqual(accepted.document)
    await host.session.stop()
  })
  it.each([
    ['web-api', webApiSource], ['event-driven', eventSource],
    ['fabric', fabricSource], ['enterprise', enterpriseSource],
  ] as const)('should_create_independent_native_copy_when_each_starter_is_chosen_DGM109_%s', async (key, source) => {
    const host = await ready(sampleDiagram())
    let sequence = 0
    host.dependencies.newId = () => `starter-copy-${++sequence}`
    const parsed = parseDocument(source)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) throw new Error('Invalid frozen example')
    expect(host.session.openStarter(key)).toBe(true)
    const first = host.session.getSnapshot().document
    expect(first).toEqual({ ...parsed.value, id: 'starter-copy-1' })
    expect(host.session.getSnapshot().backupDirty).toBe(true)
    expect(host.session.getSnapshot().canUndo).toBe(false)
    expect(host.session.openStarter(key)).toBe(true)
    const second = host.session.getSnapshot().document
    expect(second).toEqual({ ...parsed.value, id: 'starter-copy-2' })
    expect(second.entities).not.toBe(first.entities)
    expect(second.connections).not.toBe(first.connections)
    first.entities[0].label = 'Only the first copy'
    expect(second.entities).toEqual(parsed.value.entities)
    expect(parseDocument(source)).toEqual(parsed)
    expect(host.dependencies.layout).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_preserve_replacement_entry_when_starter_confirmation_is_declined_DGM109', async () => {
    const host = await ready(sampleDiagram())
    host.session.command({ type: 'metadata', patch: { title: 'Keep this draft' } })
    host.session.command({ type: 'metadata', patch: { subtitle: 'Redo must remain' } })
    host.session.undo()
    const before = host.session.getSnapshot()
    vi.mocked(host.dependencies.confirmReplace).mockReturnValue(false)

    expect(host.session.openStarter('web-api')).toBe(false)
    expect(host.dependencies.confirmReplace).toHaveBeenCalledExactlyOnceWith()
    expect(host.session.getSnapshot().document).toBe(before.document)
    expect(host.session.getSnapshot().backupDirty).toBe(before.backupDirty)
    expect(host.session.getSnapshot().canUndo).toBe(before.canUndo)
    expect(host.session.getSnapshot().canRedo).toBe(before.canRedo)
    host.session.redo()
    expect(host.session.getSnapshot().document.subtitle).toBe('Redo must remain')
    await host.session.stop()
  })
  it('should_reject_invalid_or_unwritable_starters_without_prompt_or_autosave_DGM109', async () => {
    vi.useFakeTimers()
    try {
      const host = await ready(sampleDiagram())
      const before = host.session.getSnapshot().document
      expect(host.session.openStarter('unknown' as import('../contracts.ts').StarterKey)).toBe(false)
      host.dependencies.newId = () => ''
      expect(host.session.openStarter('web-api')).toBe(false)
      host.session.presentation(true)
      expect(host.session.openStarter('web-api')).toBe(false)
      host.session.presentation(false)
      host.writable(false)
      expect(host.session.openStarter('web-api')).toBe(false)
      await vi.advanceTimersByTimeAsync(500)
      expect(host.dependencies.confirmReplace).not.toHaveBeenCalled()
      expect(host.storage.save).not.toHaveBeenCalled()
      expect(host.session.getSnapshot().document).toBe(before)
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_keep_pending_file_and_layout_results_stale_after_a_starter_replaces_work_DGM109', async () => {
    const host = await ready(sampleDiagram())
    const text = deferred<string>()
    const opening = host.session.openFile({ name: 'pending.json', size: 1, text: () => text.promise }, 'open')
    const arranging = host.session.arrange('DOWN')
    await settle()
    expect(host.jobs).toHaveLength(1)
    expect(host.session.openStarter('fabric')).toBe(true)
    const starter = host.session.getSnapshot().document
    text.resolve(JSON.stringify(createDocument('old-file', 'Old file')))
    host.jobs[0].resolve({ diagram: { ...starter, direction: 'DOWN' }, revision: starter.revision })
    await Promise.all([opening, arranging])
    expect(host.session.getSnapshot().document).toBe(starter)
    expect(host.session.getSnapshot().canUndo).toBe(false)
    expect(host.dependencies.confirmReplace).toHaveBeenCalledExactlyOnceWith()
    await host.session.stop()
  })
  it.each([false, true])('should_preserve_json_marker_when_download_callback_rejects_with_dirty_%s_DGM111', async dirty => {
    const host = await ready(sampleDiagram())
    await host.session.saveJson()
    if (dirty) host.session.command({ type: 'metadata', patch: { title: 'Newer JSON work' } })
    const before = host.session.getSnapshot()
    host.downloads.mockRejectedValueOnce(new Error('Callback rejected'))
    await host.session.saveJson()
    const after = host.session.getSnapshot()
    expect(after.document).toBe(before.document)
    expect(after.canUndo).toBe(before.canUndo)
    expect(after.canRedo).toBe(before.canRedo)
    expect(after.backupDirty).toBe(dirty)
    expect(after.message).toBe('JSON download failed: Callback rejected')
    expect(after.saveState).toBe(before.saveState)
    if (dirty) {
      host.session.undo()
      expect(host.session.getSnapshot().backupDirty).toBe(false)
      host.session.redo()
      expect(host.session.getSnapshot().document).toBe(before.document)
      expect(host.session.getSnapshot().backupDirty).toBe(true)
    }
    await host.session.stop()
  })
  it('should_preserve_existing_clean_marker_policy_when_blank_or_native_open_replaces_work_DGM111', async () => {
    const host = await ready(sampleDiagram())
    expect(host.session.getSnapshot().backupDirty).toBe(true)
    host.session.newDocument()
    const blank = host.session.getSnapshot()
    expect(blank.document).toEqual(createDocument('new-document'))
    expect(blank.backupDirty).toBe(false)
    expect(blank.canUndo).toBe(false)
    expect(host.downloads).not.toHaveBeenCalled()
    const opened = createDocument('opened', 'Native JSON')
    await host.session.openFile({ name: 'native.json', size: 1, text: async () => JSON.stringify(opened) }, 'open')
    expect(host.session.getSnapshot().document).toEqual(opened)
    expect(host.session.getSnapshot().backupDirty).toBe(false)
    expect(host.session.getSnapshot().canUndo).toBe(false)
    expect(host.downloads).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it.each([false, true])('should_leave_editable_json_marker_unchanged_when_images_export_or_copy_with_dirty_%s_DGM111', async dirty => {
    const host = await ready(sampleDiagram())
    if (!dirty) await host.session.saveJson()
    host.dependencies.copyImage = vi.fn(async png => { await png })
    const before = host.session.getSnapshot()
    for (const format of ['svg', 'png'] as const) {
      await host.session.exportImage({ format, scale: 1, transparent: false })
      expect(host.session.getSnapshot().backupDirty).toBe(dirty)
    }
    await host.session.copyImage({ format: 'png', scale: 1, transparent: false })
    expect(host.session.getSnapshot().backupDirty).toBe(dirty)
    expect(host.session.getSnapshot().document).toBe(before.document)
    expect(host.session.getSnapshot().canUndo).toBe(before.canUndo)
    expect(host.session.getSnapshot().canRedo).toBe(before.canRedo)
    expect(host.storage.save).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_preserve_replacement_guards_when_new_open_or_import_is_requested_DGM111', async () => {
    const host = await ready(sampleDiagram())
    host.session.command({ type: 'metadata', patch: { title: 'Keep this work' } })
    host.session.command({ type: 'metadata', patch: { subtitle: 'Redo retained' } })
    host.session.undo()
    const before = host.session.getSnapshot()
    vi.mocked(host.dependencies.confirmReplace).mockReturnValue(false)
    host.session.newDocument()
    await host.session.openFile({ name: 'native.json', size: 1, text: async () => JSON.stringify(createDocument('replacement')) }, 'open')
    const importing = host.session.openFile({ name: 'skill.json', size: 1, text: async () => JSON.stringify({ title: 'Imported', nodes: [], edges: [] }) }, 'import')
    await settle()
    expect(host.dependencies.confirmReplace).toHaveBeenCalledTimes(2)
    const imported = vi.mocked(host.dependencies.layout).mock.calls[0][0]
    host.jobs[0].resolve({ diagram: imported, revision: imported.revision })
    await importing
    expect(host.dependencies.confirmReplace).toHaveBeenCalledTimes(3)
    const after = host.session.getSnapshot()
    expect(after.document).toBe(before.document)
    expect(after.backupDirty).toBe(before.backupDirty)
    expect(after.canUndo).toBe(before.canUndo)
    expect(after.canRedo).toBe(before.canRedo)
    host.session.redo()
    expect(host.session.getSnapshot().document.subtitle).toBe('Redo retained')
    host.session.undo()
    expect(host.session.getSnapshot().document).toBe(before.document)
    await host.session.stop()
  })
  it('should_start_lazy_clipboard_write_before_png_resolves_guard_duplicates_and_keep_snapshot_during_readonly_present', async () => {
    const host = await ready(sampleDiagram()), capture = deferred<Blob>(), clipboard = deferred<void>()
    vi.mocked(host.dependencies.exportPng).mockReturnValueOnce(capture.promise)
    host.dependencies.copyImage = vi.fn(() => clipboard.promise)
    const original = host.session.getSnapshot().document, json = JSON.stringify(original)
    const options = { format: 'png' as const, scale: 2 as const, transparent: true, selectionIds: ['app'], aspect: '16:9' as const, includeGrid: true }
    const pending = host.session.copyImage(options)
    expect(host.dependencies.copyImage).toHaveBeenCalledExactlyOnceWith(capture.promise)
    expect(host.session.getSnapshot().message).not.toMatch(/copied/i)
    await host.session.copyImage(options)
    expect(host.dependencies.exportPng).toHaveBeenCalledTimes(1)
    host.session.command({ type: 'metadata', patch: { title: 'Newer source' } })
    const newer = host.session.getSnapshot().document
    host.writable(false); host.session.presentation(true)
    const blob = new Blob(['pixels'], { type: 'image/png' })
    capture.resolve(blob); clipboard.resolve(); await pending
    expect(host.session.getSnapshot().message).toMatch(/copied/i)
    expect(host.session.getSnapshot().document).toBe(newer); expect(JSON.stringify(original)).toBe(json)
    expect(host.dependencies.exportPng).toHaveBeenCalledWith(original, 2, true, undefined, expect.objectContaining({ selectionIds: ['app'], aspect: '16:9', includeGrid: true }))
    expect(host.downloads).not.toHaveBeenCalled()
    await host.session.copyImage({ format: 'png', scale: 1, transparent: false })
    expect(vi.mocked(host.dependencies.exportPng).mock.calls.at(-1)![0]).toBe(newer)
    await host.session.stop()
  })
  it.each(['unavailable', 'denied'] as const)('should_download_png_truthfully_when_clipboard_is_%s_without_history_or_save', async reason => {
    const host = await ready(sampleDiagram()), blob = new Blob(['png'], { type: 'image/png' })
    vi.mocked(host.dependencies.exportPng).mockResolvedValue(blob)
    if (reason === 'denied') host.dependencies.copyImage = vi.fn(async () => { throw new Error('Permission denied') })
    const before = host.session.getSnapshot()
    await host.session.copyImage({ format: 'png', scale: 1, transparent: false })
    expect(host.downloads).toHaveBeenCalledExactlyOnceWith(blob, 'Commerce-platform.png')
    expect(host.session.getSnapshot().message).toMatch(/not copied.*PNG downloaded/i)
    expect(host.session.getSnapshot().document).toBe(before.document)
    expect(host.session.getSnapshot().canUndo).toBe(false); expect(host.storage.save).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_report_capture_failure_without_copied_or_downloaded_status_and_wait_for_download_errors', async () => {
    const host = await ready(sampleDiagram())
    vi.mocked(host.dependencies.exportPng).mockRejectedValueOnce(new Error('PNG is too large'))
    host.dependencies.copyImage = vi.fn(async png => { await png })
    await host.session.copyImage({ format: 'png', scale: 2, transparent: false, aspect: '16:9' })
    expect(host.session.getSnapshot().message).toMatch(/too large/i)
    expect(host.session.getSnapshot().message).not.toMatch(/copied|downloaded/i)
    expect(host.downloads).not.toHaveBeenCalled()
    host.dependencies.copyImage = undefined
    host.downloads.mockRejectedValueOnce(new Error('disk denied'))
    await host.session.copyImage({ format: 'png', scale: 1, transparent: false })
    expect(host.session.getSnapshot().message).toMatch(/disk denied/)
    expect(host.session.getSnapshot().message).not.toMatch(/copied|downloaded/i)
    await host.session.stop()
  })
  it('should_keep_copy_pending_until_real_clipboard_promise_and_snapshot_options_even_if_the_caller_changes_them', async () => {
    const host = await ready(sampleDiagram()), clipboard = deferred<void>(), capture = deferred<Blob>()
    vi.mocked(host.dependencies.exportPng).mockReturnValueOnce(capture.promise)
    host.dependencies.copyImage = vi.fn(() => clipboard.promise)
    const selectionIds = ['app']
    const options = { format: 'png' as const, scale: 1 as const, transparent: false, selectionIds, aspect: '16:9' as const }
    const pending = host.session.copyImage(options)
    selectionIds.push('db')
    expect(vi.mocked(host.dependencies.exportPng).mock.calls[0][4]!.selectionIds).toEqual(['app'])
    capture.resolve(new Blob(['png'], { type: 'image/png' })); await settle()
    expect(host.session.getSnapshot().isExporting).toBe(true)
    expect(host.session.getSnapshot().message).not.toMatch(/copied/i)
    clipboard.reject(new Error('Permission denied')); await pending
    expect(host.session.getSnapshot().message).toMatch(/not copied.*downloaded/i)
    expect(host.session.getSnapshot().isExporting).toBe(false)
    await host.session.stop()
  })
  it('should_download_original_export_snapshot_and_filename_when_source_and_options_change_during_capture', async () => {
    const host = await ready(sampleDiagram()), capture = deferred<string>()
    vi.mocked(host.dependencies.exportSvg).mockReturnValueOnce(capture.promise)
    const original = host.session.getSnapshot().document
    const options: import('../contracts.ts').ExportOptions = { format: 'svg', scale: 1, transparent: false, selectionIds: ['app'], aspect: '16:9' }
    const pending = host.session.exportImage(options)
    options.format = 'png'; options.selectionIds!.push('db')
    host.session.command({ type: 'metadata', patch: { title: 'Newer' } })
    const newer = host.session.getSnapshot().document
    capture.resolve('<svg/>'); await pending
    expect(host.dependencies.exportSvg).toHaveBeenCalledExactlyOnceWith(original, false, undefined, { selectionIds: ['app'], aspect: '16:9' })
    expect(host.downloads.mock.calls[0][1]).toBe('Commerce-platform.svg')
    expect(await host.downloads.mock.calls[0][0].text()).toBe('<svg/>')
    expect(host.session.getSnapshot().document).toBe(newer)
    await host.session.stop()
  })
  it.each(['open', 'import'] as const)('should_reject_delayed_%s_file_during_present_and_keep_it_stale_after_exit', async kind => {
    const host = await ready(sampleDiagram())
    const before = host.session.getSnapshot().document
    const text = deferred<string>()
    const opening = host.session.openFile({ name: 'pending.json', size: 1, text: () => text.promise }, kind)
    host.session.presentation(true)
    text.resolve(JSON.stringify(kind === 'open' ? createDocument('replacement') : { title: 'Imported', nodes: [{ id: 'service', label: 'Service' }], edges: [] }))
    await opening
    expect(host.session.getSnapshot().document).toBe(before)
    expect(host.session.getSnapshot().canUndo).toBe(false)
    expect(host.dependencies.confirmReplace).not.toHaveBeenCalled()
    expect(host.dependencies.layout).not.toHaveBeenCalled()
    host.session.presentation(false)
    expect(host.session.getSnapshot().document).toBe(before)
    await host.session.stop()
  })
  it('should_keep_delayed_file_stale_when_present_exits_before_file_resolves', async () => {
    const host = await ready(sampleDiagram())
    const before = host.session.getSnapshot().document
    const text = deferred<string>()
    const opening = host.session.openFile({ name: 'pending.json', size: 1, text: () => text.promise }, 'open')
    host.session.presentation(true)
    host.session.presentation(false)
    text.resolve(JSON.stringify(createDocument('replacement')))
    await opening
    expect(host.session.getSnapshot().document).toBe(before)
    expect(host.dependencies.confirmReplace).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_block_all_present_mutations_preserve_history_and_export_only_canonical_content', async () => {
    const host = await ready(sampleDiagram())
    host.session.command({ type: 'metadata', patch: { title: 'First' } })
    const first = host.session.getSnapshot().document
    host.session.command({ type: 'metadata', patch: { title: 'Second' } })
    const second = host.session.getSnapshot().document
    host.session.undo()
    host.session.preview({ ...first, title: 'Prior preview' })
    const before = host.session.getSnapshot()
    host.session.presentation(true)
    host.session.command({ type: 'metadata', patch: { title: 'Forbidden' } })
    host.session.newDocument(); host.session.undo(); host.session.redo()
    await host.session.arrange('DOWN')
    const text = vi.fn(async () => JSON.stringify(createDocument('replacement')))
    await host.session.openFile({ name: 'new.json', size: 1, text }, 'open')
    await host.session.openFile({ name: 'new.json', size: 1, text }, 'import')
    host.session.preview({ ...first, title: 'Forbidden preview' })
    expect(host.session.getSnapshot()).toBe(before)
    expect(text).not.toHaveBeenCalled()
    expect(host.dependencies.layout).not.toHaveBeenCalled()
    expect(host.dependencies.confirmReplace).not.toHaveBeenCalled()
    await host.session.exportImage({ format: 'svg', scale: 1, transparent: true })
    await host.session.saveJson()
    expect(host.dependencies.exportSvg).toHaveBeenCalledExactlyOnceWith(first, true)
    expect(JSON.parse(await host.downloads.mock.calls[1][0].text())).toEqual(first)
    expect(JSON.stringify(first)).not.toContain('presenting')
    host.session.presentation(false)
    host.session.redo()
    expect(host.session.getSnapshot().document).toBe(second)
    host.session.undo()
    expect(host.session.getSnapshot().document).toBe(first)
    await host.session.stop()
  })
  it.each(['arrange', 'import'] as const)('should_cancel_pending_%s_layout_on_present_entry_even_after_exit', async kind => {
    const host = await ready(sampleDiagram())
    const before = host.session.getSnapshot().document
    const pending = kind === 'arrange' ? host.session.arrange('DOWN') : host.session.openFile({ name: 'skill.json', size: 1, text: async () => JSON.stringify({ title: 'Imported', nodes: [], edges: [] }) }, 'import')
    await settle()
    expect(host.jobs).toHaveLength(1)
    host.session.presentation(true)
    expect(host.cancel).toHaveBeenCalledOnce()
    expect(host.session.getSnapshot().isArranging).toBe(false)
    host.session.presentation(false)
    host.jobs[0].resolve({ diagram: { ...before, direction: 'DOWN' }, revision: before.revision })
    await pending
    expect(host.session.getSnapshot().document).toBe(before)
    expect(host.dependencies.confirmReplace).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_finish_preexisting_autosave_queue_during_present_without_ownership_sideeffects', async () => {
    vi.useFakeTimers()
    try {
      const host = await ready(sampleDiagram())
      const save = deferred<void>()
      vi.mocked(host.storage.save).mockReturnValueOnce(save.promise)
      host.session.command({ type: 'metadata', patch: { title: 'First' } })
      await vi.advanceTimersByTimeAsync(500)
      host.session.command({ type: 'metadata', patch: { title: 'Second' } })
      const before = host.session.getSnapshot().document
      const loads = vi.mocked(host.storage.load).mock.calls.length
      host.session.presentation(true)
      await vi.advanceTimersByTimeAsync(500)
      expect(host.storage.save).toHaveBeenCalledTimes(1)
      save.resolve()
      await settle()
      expect(host.storage.save).toHaveBeenCalledTimes(2)
      expect(vi.mocked(host.storage.save).mock.calls[1][0]).toBe(before)
      expect(host.session.getSnapshot().saveState).toBe('saved')
      expect(host.session.getSnapshot().readOnly).toBe(false)
      expect(host.session.getSnapshot().backupDirty).toBe(true)
      expect(host.session.getSnapshot().document).toBe(before)
      expect(host.storage.load).toHaveBeenCalledTimes(loads)
      expect(host.release).not.toHaveBeenCalled()
      expect(host.storage.close).not.toHaveBeenCalled()
      host.session.command({ type: 'metadata', patch: { title: 'Still blocked' } })
      expect(host.session.getSnapshot().document).toBe(before)
      host.session.presentation(false)
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_finish_initial_owned_load_and_save_missing_document_while_presenting', async () => {
    vi.useFakeTimers()
    try {
      const host = harness()
      host.session.presentation(true)
      host.writable(true)
      await settle()
      const before = host.session.getSnapshot().document
      expect(host.session.getSnapshot().readOnly).toBe(false)
      expect(host.session.getSnapshot().saveState).toBe('saving')
      await vi.advanceTimersByTimeAsync(500)
      expect(host.storage.save).toHaveBeenCalledExactlyOnceWith(before)
      expect(host.session.getSnapshot().saveState).toBe('saved')
      host.session.command({ type: 'metadata', patch: { title: 'Still blocked' } })
      expect(host.session.getSnapshot().document).toBe(before)
      host.session.presentation(false)
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_preserve_changed_lock_on_present_exit_and_reload_under_reacquired_ownership', async () => {
    const host = await ready(sampleDiagram())
    host.session.presentation(true)
    host.writable(false)
    const before = host.session.getSnapshot().document
    host.session.presentation(false)
    expect(host.session.getSnapshot().readOnly).toBe(true)
    host.session.command({ type: 'metadata', patch: { title: 'Forbidden' } })
    expect(host.session.getSnapshot().document).toBe(before)
    host.session.presentation(true)
    const load = deferred<Diagram | null>()
    vi.mocked(host.storage.load).mockReturnValueOnce(load.promise)
    host.writable(true)
    host.session.presentation(false)
    expect(host.session.getSnapshot().readOnly).toBe(true)
    host.session.newDocument()
    expect(host.dependencies.confirmReplace).not.toHaveBeenCalled()
    const durable = createDocument('durable', 'Latest durable')
    load.resolve(durable)
    await settle()
    expect(host.session.getSnapshot().document).toBe(durable)
    expect(host.session.getSnapshot().readOnly).toBe(false)
    host.session.command({ type: 'metadata', patch: { title: 'Allowed' } })
    expect(host.session.getSnapshot().document.title).toBe('Allowed')
    await host.session.stop()
  })
  it('should_not_rerender_controlled_editor_when_only_preview_generation_changes', async () => {
    const { session } = await ready()
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)
    const before = session.getSnapshot()
    session.preview(null)
    session.preview({ ...before.document, title: 'Local draft' })
    session.preview(null)
    expect(session.getSnapshot()).toBe(before)
    expect(listener).not.toHaveBeenCalled()
    unsubscribe()
    await session.stop()
  })
  it('should_wait_for_ownership_and_latest_load_before_accepting_commands', async () => {
    const host = harness()
    await settle()
    expect(host.session.getSnapshot().document.title).toBe('Commerce platform')
    expect(host.session.getSnapshot().readOnly).toBe(true)
    host.session.command({ type: 'metadata', patch: { title: 'Rejected' } })
    const latest = deferred<Diagram | null>()
    vi.mocked(host.storage.load).mockReturnValueOnce(latest.promise)
    host.writable(true)
    expect(host.session.getSnapshot().readOnly).toBe(true)
    latest.resolve(createDocument('latest', 'Durable latest'))
    await settle()
    expect(host.session.getSnapshot().document.title).toBe('Durable latest')
    expect(host.session.getSnapshot().readOnly).toBe(false)
    expect(host.storage.save).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_commit_domain_commands_atomically_and_keep_100_undo_transactions', async () => {
    const { session } = await ready()
    const initial = session.getSnapshot().document
    session.command({ type: 'remove', entityIds: ['missing'], connectionIds: [] })
    expect(session.getSnapshot().document).toBe(initial)
    expect(session.getSnapshot().message).not.toBe('')
    for (let count = 0; count < 105; count++) session.command({ type: 'metadata', patch: { title: `Edit ${count}` } })
    for (let count = 0; count < 100; count++) session.undo()
    expect(session.getSnapshot().document.title).toBe('Edit 4')
    expect(session.getSnapshot().canUndo).toBe(false)
    session.redo()
    expect(session.getSnapshot().document.title).toBe('Edit 5')
    await session.stop()
  })
  it('should_guard_every_mutation_callback_when_read_only', async () => {
    const { session, dependencies } = harness()
    await settle()
    const initial = session.getSnapshot().document
    session.command({ type: 'metadata', patch: { title: 'No' } })
    session.undo(); session.redo(); session.newDocument(); session.arrange('DOWN')
    await session.openFile({ name: 'valid.json', size: 1, text: async () => JSON.stringify(createDocument('open')) }, 'open')
    session.preview(sampleDiagram())
    expect(session.getSnapshot().document).toBe(initial)
    expect(dependencies.confirmReplace).not.toHaveBeenCalled()
    await session.saveJson()
    await session.exportImage({ format: 'svg', scale: 1, transparent: true })
    expect(dependencies.download).toHaveBeenCalledTimes(2)
    await session.stop()
  })
  it('should_preserve_corrupt_durable_data_and_fail_closed_after_load_error', async () => {
    const host = harness()
    vi.mocked(host.storage.load).mockRejectedValue(new Error('Saved document is invalid'))
    host.writable(true)
    await settle()
    expect(host.session.getSnapshot().readOnly).toBe(true)
    expect(host.session.getSnapshot().saveState).toBe('error')
    expect(host.session.getSnapshot().message).toContain('JSON')
    host.session.newDocument()
    expect(host.storage.save).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_debounce_500ms_and_report_only_the_latest_successful_durable_write', async () => {
    vi.useFakeTimers()
    try {
      const host = await ready()
      const first = deferred<void>()
      vi.mocked(host.storage.save).mockReturnValueOnce(first.promise)
      host.session.command({ type: 'metadata', patch: { title: 'First' } })
      await vi.advanceTimersByTimeAsync(499)
      expect(host.storage.save).not.toHaveBeenCalled()
      await vi.advanceTimersByTimeAsync(1)
      expect(host.storage.save).toHaveBeenCalledTimes(1)
      host.session.command({ type: 'metadata', patch: { title: 'Second' } })
      await vi.advanceTimersByTimeAsync(500)
      expect(host.storage.save).toHaveBeenCalledTimes(1)
      first.resolve()
      await settle()
      expect(host.storage.save).toHaveBeenCalledTimes(2)
      expect(vi.mocked(host.storage.save).mock.calls[1][0].title).toBe('Second')
      expect(host.session.getSnapshot().saveState).toBe('saved')
      expect(host.session.getSnapshot().backupDirty).toBe(true)
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_keep_editing_and_json_download_available_when_save_fails', async () => {
    vi.useFakeTimers()
    try {
      const host = await ready()
      vi.mocked(host.storage.save).mockRejectedValueOnce(new Error('QuotaExceededError'))
      host.session.command({ type: 'metadata', patch: { title: 'Unsaved' } })
      await vi.advanceTimersByTimeAsync(500)
      expect(host.session.getSnapshot().saveState).toBe('error')
      expect(host.session.getSnapshot().readOnly).toBe(false)
      expect(host.session.getSnapshot().message).toBe('Browser save failed: QuotaExceededError. Download JSON now; free storage and edit again to retry.')
      const failedDocument = host.session.getSnapshot().document
      await host.session.saveJson()
      expect(host.downloads).toHaveBeenCalled()
      expect(host.session.getSnapshot().document).toBe(failedDocument)
      expect(host.session.getSnapshot().canUndo).toBe(true)
      host.session.command({ type: 'metadata', patch: { subtitle: 'Retry' } })
      await vi.advanceTimersByTimeAsync(500)
      expect(host.session.getSnapshot().saveState).toBe('saved')
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_finish_inflight_writes_before_release_and_close_during_cleanup', async () => {
    vi.useFakeTimers()
    try {
      const host = await ready()
      const save = deferred<void>()
      vi.mocked(host.storage.save).mockReturnValueOnce(save.promise)
      host.session.command({ type: 'metadata', patch: { title: 'In flight' } })
      await vi.advanceTimersByTimeAsync(500)
      const stopped = host.session.stop()
      expect(host.release).not.toHaveBeenCalled()
      expect(host.storage.close).not.toHaveBeenCalled()
      save.resolve()
      await stopped
      expect(host.release).toHaveBeenCalledOnce()
      expect(host.storage.close).toHaveBeenCalledOnce()
    } finally { vi.useRealTimers() }
  })
  it('should_cancel_queued_ownership_and_ignore_late_load_after_strictmode_cleanup', async () => {
    const host = harness()
    const old = deferred<Diagram | null>()
    vi.mocked(host.storage.load).mockReturnValueOnce(old.promise)
    host.writable(true)
    await host.session.stop()
    old.resolve(createDocument('old'))
    await settle()
    expect(host.release).toHaveBeenCalledOnce()
    expect(host.storage.close).toHaveBeenCalledOnce()
    expect(host.session.getSnapshot().readOnly).toBe(true)
  })
  it('should_preserve_document_and_history_when_replacement_is_cancelled_or_invalid', async () => {
    const host = await ready()
    host.session.command({ type: 'metadata', patch: { title: 'Current' } })
    const before = host.session.getSnapshot().document
    vi.mocked(host.dependencies.confirmReplace).mockReturnValue(false)
    host.session.newDocument()
    await host.session.openFile({ name: 'valid.json', size: 1, text: async () => JSON.stringify(createDocument('other')) }, 'open')
    expect(host.session.getSnapshot().document).toBe(before)
    expect(host.session.getSnapshot().canUndo).toBe(true)
    for (const file of [{ name: 'bad.txt', size: 1, text: async () => '{}' }, { name: 'huge.json', size: 5 * 1024 * 1024 + 1, text: async () => '{}' }, { name: 'bad.json', size: 1, text: async () => '{' }]) {
      await host.session.openFile(file, 'open')
      expect(host.session.getSnapshot().document).toBe(before)
      expect(host.session.getSnapshot().message).not.toBe('')
    }
    await host.session.stop()
  })
  it('should_roundtrip_exact_json_and_reset_history_only_after_validated_open', async () => {
    const host = await ready()
    host.session.command({ type: 'metadata', patch: { subtitle: 'Backed up' } })
    const before = host.session.getSnapshot().document
    await host.session.saveJson()
    expect(host.session.getSnapshot().backupDirty).toBe(false)
    const blob = host.downloads.mock.calls[0][0] as Blob
    expect(JSON.parse(await blob.text())).toEqual(before)
    host.session.command({ type: 'metadata', patch: { title: 'Changed since backup' } })
    await host.session.openFile({ name: 'backup.json', size: blob.size, text: () => blob.text() }, 'open')
    expect(host.session.getSnapshot().document).toEqual(before)
    expect(host.session.getSnapshot().backupDirty).toBe(false)
    expect(host.session.getSnapshot().canUndo).toBe(false)
    await host.session.stop()
  })
  it('should_not_clear_backup_dirty_when_work_changes_during_download', async () => {
    const host = await ready()
    const downloaded = deferred<void>()
    host.downloads.mockReturnValueOnce(downloaded.promise)
    const saving = host.session.saveJson()
    host.session.command({ type: 'metadata', patch: { title: 'Newer' } })
    const newer = host.session.getSnapshot()
    downloaded.resolve()
    await saving
    expect(host.session.getSnapshot().backupDirty).toBe(true)
    expect(host.session.getSnapshot().document).toBe(newer.document)
    expect(host.session.getSnapshot().canUndo).toBe(newer.canUndo)
    expect(host.session.getSnapshot().canRedo).toBe(newer.canRedo)
    host.session.undo()
    expect(host.session.getSnapshot().document.title).not.toBe('Newer')
    host.session.redo()
    expect(host.session.getSnapshot().document).toBe(newer.document)
    await host.session.stop()
  })
  it('should_discard_layout_after_edit_undo_revision_reuse_and_every_preview_notification', async () => {
    const host = await ready()
    const before = host.session.getSnapshot().document
    host.session.arrange('DOWN')
    host.session.command({ type: 'metadata', patch: { title: 'intervening' } })
    host.session.undo()
    host.jobs[0].resolve({ diagram: { ...before, direction: 'DOWN' }, revision: before.revision })
    await settle()
    expect(host.session.getSnapshot().document).toBe(before)
    host.session.arrange('DOWN')
    host.session.preview(null)
    host.jobs[1].resolve({ diagram: { ...before, direction: 'DOWN' }, revision: before.revision })
    await settle()
    expect(host.session.getSnapshot().document).toBe(before)
    expect(host.cancel).toHaveBeenCalled()
    await host.session.stop()
  })
  it('should_commit_layout_once_stamp_routes_and_allow_retry_after_worker_failure', async () => {
    const host = await ready()
    host.session.arrange('DOWN')
    host.jobs[0].reject(new Error('Worker timeout'))
    await settle()
    expect(host.session.getSnapshot().isArranging).toBe(false)
    expect(host.session.getSnapshot().message).toContain('retry')
    const before = host.session.getSnapshot().document
    host.session.arrange('DOWN')
    host.jobs[1].resolve({ diagram: { ...before, direction: 'DOWN' }, revision: before.revision })
    await settle()
    expect(host.session.getSnapshot().document.revision).toBe(before.revision + 1)
    expect(host.session.getSnapshot().document.direction).toBe('DOWN')
    host.session.undo()
    expect(host.session.getSnapshot().document).toBe(before)
    await host.session.stop()
  })
  it('should_layout_import_before_commit_show_warnings_and_discard_stale_import', async () => {
    const host = await ready()
    const skill = { title: 'Imported', nodes: [{ id: 'service', label: 'Service', icon: 'unrecognized' }], edges: [] }
    const opening = host.session.openFile({ name: 'skill.json', size: 1, text: async () => JSON.stringify(skill) }, 'import')
    await settle()
    expect(host.jobs).toHaveLength(1)
    host.session.command({ type: 'metadata', patch: { title: 'Newer work' } })
    host.jobs[0].resolve({ diagram: createDocument('imported'), revision: 0 })
    await opening
    expect(host.session.getSnapshot().document.title).toBe('Newer work')
    const next = host.session.openFile({ name: 'skill.json', size: 1, text: async () => JSON.stringify(skill) }, 'import')
    await settle()
    const imported = vi.mocked(host.dependencies.layout).mock.calls[1][0]
    host.jobs[1].resolve({ diagram: imported, revision: imported.revision })
    await next
    expect(host.session.getSnapshot().document.title).toBe('Imported')
    expect(host.session.getSnapshot().message).toContain('icon')
    expect(host.session.getSnapshot().backupDirty).toBe(true)
    await host.session.stop()
  })
  it('should_export_current_preview_but_download_only_canonical_json', async () => {
    const host = await ready()
    const canonical = host.session.getSnapshot().document
    const draft = { ...canonical, title: 'Preview' }
    host.session.preview(draft)
    await host.session.exportImage({ format: 'svg', scale: 1, transparent: true })
    expect(host.dependencies.exportSvg).toHaveBeenCalledWith(draft, true)
    await host.session.saveJson()
    expect(JSON.parse(await (host.downloads.mock.calls[1][0] as Blob).text())).toEqual(canonical)
    await host.session.stop()
  })
})