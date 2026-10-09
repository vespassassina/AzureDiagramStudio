import { describe, expect, it, vi } from 'vitest'
import { createDocument, sampleDiagram } from '../model.ts'
import type { Diagram } from '../model.ts'
import type { DocumentStorage } from '../contracts.ts'
import { createSession } from './session.ts'
import type { SessionDependencies } from './session.ts'

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
      await host.session.saveJson()
      expect(host.downloads).toHaveBeenCalled()
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
    downloaded.resolve()
    await saving
    expect(host.session.getSnapshot().backupDirty).toBe(true)
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