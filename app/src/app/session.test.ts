import { describe, expect, it, vi } from 'vitest'
import { createDocument, sampleDiagram } from '../model.ts'
import type { Diagram } from '../model.ts'
import type { DocumentStorage } from '../contracts.ts'
import { createSession, starterDocument, starterKeys } from './session.ts'
import type { SessionDependencies } from './session.ts'
import webApiSource from '../../../examples/azure-web-app.json?raw'
import eventSource from '../../../examples/event-driven.json?raw'
import fabricSource from '../../../examples/fabric-onelake.json?raw'
import enterpriseSource from '../../../examples/enterprise-integration.json?raw'
import { parseDocument } from '../document/index.ts'
import { alignmentPositions } from '../editor/interactions.ts'
import * as historyModel from '../model.ts'
import { computeLayout } from '../layout.ts'
import { routeFixedGeometry } from '../routing.ts'

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

describe('desktop workspace saves DGM138', () => {
  it('should_preserve_backup_marker_when_native_save_is_canceled_and_forward_identity', async () => {
    const h = await ready(sampleDiagram())
    const save = vi.fn(async () => false)
    h.dependencies.saveFile = save
    const dirty = h.session.getSnapshot().backupDirty
    await h.session.saveJson()
    expect(save).toHaveBeenCalledWith(expect.any(Blob), 'Commerce-platform.json', 'sample-commerce')
    expect(h.downloads).not.toHaveBeenCalled()
    expect(h.session.getSnapshot().backupDirty).toBe(dirty)
    expect(h.session.getSnapshot().message).toMatch(/canceled/i)
    save.mockResolvedValueOnce(true)
    await h.session.saveJson()
    expect(h.session.getSnapshot().backupDirty).toBe(false)
    h.session.stop()
  })
  it('should_forward_all_UI_exports_but_never_MCP_to_native_workspace_saves', async () => {
    const h = await ready(sampleDiagram())
    h.dependencies.saveFile = vi.fn(async () => false)
    vi.mocked(h.dependencies.exportPng).mockResolvedValue(new Blob([new Uint8Array([137,80,78,71,13,10,26,10])], { type: 'image/png' }))
    for (const [format, includeMarkdown] of [['svg', false], ['png', false], ['svg', true], ['markdown', false]] as const) {
      await h.session.exportImage({ format, includeMarkdown, scale: 1, transparent: false })
      expect(h.session.getSnapshot().message).toMatch(/canceled/i)
      expect(vi.mocked(h.dependencies.saveFile).mock.calls.at(-1)?.[2]).toBe('sample-commerce')
    }
    h.session.setMcpGuard(() => null)
    await h.session.mcpOutput({ name: 'snapshot_diagram', arguments: { stateToken: h.session.mcpState().stateToken } }, { deadline: Date.now() + 10000, active: () => true })
    expect(h.dependencies.saveFile).toHaveBeenCalledTimes(4)
    h.session.stop()
  })
})

describe('MCP captured outputs DGM135', () => {
  const context = () => ({ deadline: Date.now() + 10000, active: () => true })
  const png = () => new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' })
  it('should_return_all_formats_and_packages_without_session_side_effects', async () => {
    const h = await ready({ ...sampleDiagram(), description: '# Exact description\n世界' })
    h.session.setMcpGuard(() => null)
    vi.mocked(h.dependencies.exportPng).mockImplementation(async () => png())
    const before = h.session.mcpState(), snapshot = h.session.getSnapshot()
    for (const format of ['png', 'svg', 'json', 'markdown'] as const) {
      for (const includeMarkdown of format === 'markdown' ? [false] : [false, true]) {
        const result = await h.session.mcpOutput({ name: 'export_diagram', arguments: { stateToken: before.stateToken, format, includeMarkdown } }, context())
        expect(result.ok).toBe(true)
        if (result.ok) {
          const meta = JSON.parse(result.output.content[1].text)
          expect(meta.stateToken).toBe(before.stateToken)
          expect(meta.filename).toMatch(includeMarkdown ? /\.zip$/ : new RegExp(`\\.${format === 'markdown' ? 'md' : format}$`))
          if (format === 'json' && !includeMarkdown) expect(JSON.parse(result.output.content[0].resource!.text!)).toEqual(before.document)
          if (format === 'markdown') expect(result.output.content[0].resource!.text).toContain('![Diagram](data:image/png;base64,')
        }
      }
    }
    expect(h.session.mcpState()).toEqual(before)
    expect(h.session.getSnapshot()).toBe(snapshot)
    expect(h.downloads).not.toHaveBeenCalled()
    h.session.stop()
  })
  it('should_reject_changed_state_busy_drafts_expiry_and_concurrent_operations_without_late_output', async () => {
    const h = await ready(sampleDiagram())
    h.session.setMcpGuard(() => null)
    const state = h.session.mcpState()
    const operation = { name: 'snapshot_diagram' as const, arguments: { stateToken: state.stateToken } }
    const capture = deferred<Blob>()
    vi.mocked(h.dependencies.exportPng).mockReturnValueOnce(capture.promise)
    const pending = h.session.mcpOutput(operation, context())
    expect((await h.session.mcpOutput(operation, context())).ok).toBe(false)
    expect((await h.session.mcpMutate({ name: 'undo', arguments: operation.arguments }, context())).ok).toBe(false)
    h.session.command({ type: 'metadata', patch: { title: 'Edited during render' } })
    capture.resolve(png())
    expect(await pending).toEqual({ ok: false, message: expect.stringMatching(/Stale|changed/) })
    h.session.setMcpGuard(() => 'draft')
    expect((await h.session.mcpOutput({ ...operation, arguments: { stateToken: h.session.mcpState().stateToken } }, context())).ok).toBe(false)
    h.session.setMcpGuard(() => null)
    expect((await h.session.mcpOutput(operation, { deadline: 0, active: () => true })).ok).toBe(false)
    expect(h.downloads).not.toHaveBeenCalled()
    h.session.stop()
  })
  it('should_use_normal_image_options_and_reject_oversize_before_returning_bytes', async () => {
    const h = await ready(sampleDiagram())
    h.session.setMcpGuard(() => null)
    vi.mocked(h.dependencies.exportPng).mockImplementation(async () => png())
    const { stateToken, document } = h.session.mcpState()
    expect((await h.session.mcpOutput({ name: 'snapshot_diagram', arguments: { stateToken } }, context())).ok).toBe(true)
    expect(h.dependencies.exportPng).toHaveBeenLastCalledWith(document, 1, false, undefined, { background: 'diagram', aspect: 'content' })
    expect((await h.session.mcpOutput({ name: 'export_diagram', arguments: { stateToken, format: 'png', scale: 2, transparent: true, background: 'white', aspect: '16:9', includeGrid: false } }, context())).ok).toBe(true)
    expect(h.dependencies.exportPng).toHaveBeenLastCalledWith(document, 2, true, undefined, { background: 'white', aspect: '16:9', includeGrid: false })
    const large = new Blob([new Uint8Array(8 * 1024 * 1024)], { type: 'image/png' })
    const encode = vi.spyOn(large, 'arrayBuffer')
    vi.mocked(h.dependencies.exportPng).mockResolvedValueOnce(large)
    expect(await h.session.mcpOutput({ name: 'snapshot_diagram', arguments: { stateToken } }, context())).toEqual({ ok: false, message: expect.stringMatching(/8 MiB/) })
    expect(encode).not.toHaveBeenCalled()
    h.session.stop()
  })
  it('should_recheck_disconnect_deadline_guard_and_runtime_after_async_render', async () => {
    for (const boundary of ['disconnect', 'deadline', 'guard', 'stop', 'preview'] as const) {
      const h = await ready(sampleDiagram())
      h.session.setMcpGuard(() => null)
      const capture = deferred<Blob>()
      vi.mocked(h.dependencies.exportPng).mockReturnValueOnce(capture.promise)
      let active = true
      const ctx = { deadline: Date.now() + 10000, active: () => active }
      const pending = h.session.mcpOutput({ name: 'snapshot_diagram', arguments: { stateToken: h.session.mcpState().stateToken } }, ctx)
      if (boundary === 'disconnect') active = false
      if (boundary === 'deadline') ctx.deadline = 0
      if (boundary === 'guard') h.session.setMcpGuard(() => 'modal')
      if (boundary === 'stop') h.session.stop()
      if (boundary === 'preview') h.session.preview(h.session.getSnapshot().document)
      capture.resolve(png())
      expect((await pending).ok, boundary).toBe(false)
      expect(h.downloads).not.toHaveBeenCalled()
      h.session.stop()
    }
  })
  it('should_allow_settled_read_only_output_without_taking_ownership', async () => {
    const h = await ready(sampleDiagram())
    h.session.setMcpGuard(() => null)
    h.writable(false)
    await settle()
    const before = h.session.mcpState()
    const result = await h.session.mcpOutput({ name: 'export_diagram', arguments: { stateToken: before.stateToken, format: 'json' } }, context())
    expect(result.ok).toBe(true)
    expect(h.session.getSnapshot().readOnly).toBe(true)
    expect(h.session.mcpState()).toEqual(before)
    h.session.stop()
  })
})

describe('canonical arrangement modes DGM137', () => {
  it.each(['RIGHT', 'DOWN'] as const)('should_apply_real_%s_stacked_layout_as_one_exact_undo_for_UI_and_MCP', async direction => {
    for (const remote of [false, true]) {
      const original = sampleDiagram()
      const h = await ready(original)
      h.session.setMcpGuard(() => null)
      vi.mocked(h.dependencies.layout).mockImplementation((document, axis, options) => ({
        promise: computeLayout(document, axis, document.revision, undefined, options), cancel: h.cancel,
      }))
      const before = h.session.mcpState()
      if (remote) {
        const result = await h.session.mcpMutate({ name: 'arrange_diagram', arguments: { stateToken: before.stateToken, direction, arrangement: 'stacked' } }, { deadline: Date.now() + 10000, active: () => true })
        expect(result.ok).toBe(true)
      } else await h.session.arrange(direction, { arrangement: 'stacked' })
      expect(h.dependencies.layout).toHaveBeenCalledExactlyOnceWith(original, direction, { arrangement: 'stacked' })
      const arranged = h.session.mcpState()
      expect(arranged.stateToken, h.session.getSnapshot().message).not.toBe(before.stateToken)
      expect(arranged.document.direction).toBe(direction)
      expect(arranged.document.connections.every(edge => edge.points && edge.points.length > 1)).toBe(true)
      h.session.undo()
      expect(h.session.mcpState().document).toEqual(before.document)
      h.session.redo()
      expect(h.session.mcpState().document).toEqual(arranged.document)
      h.session.stop()
    }
  })
  it('should_cancel_stacked_work_and_reject_a_late_result_after_newer_preview_or_undo', async () => {
    const h = await ready(sampleDiagram())
    const original = h.session.mcpState()
    const pending = h.session.arrange('RIGHT', { arrangement: 'stacked' })
    h.session.preview({ ...original.document, title: 'Newer draft' })
    const computed = await computeLayout(original.document, 'RIGHT', original.document.revision, undefined, { arrangement: 'stacked' })
    h.jobs[0].resolve(computed)
    await pending
    expect(h.session.mcpState()).toEqual(original)
    expect(h.cancel).toHaveBeenCalled()
    h.session.stop()
  })
})

describe('paired committed exports DGM136', () => {
  it('should_capture_pairing_flag_and_scene_options_before_the_caller_changes_them', async () => {
    const h = await ready({ ...createDocument('capture'), description: 'Committed' })
    const pending = deferred<string>()
    vi.mocked(h.dependencies.exportSvg).mockReturnValueOnce(pending.promise)
    const options = { format: 'svg' as const, scale: 1 as const, transparent: false, includeMarkdown: true, selectionIds: ['a'], includeGrid: true }
    const exporting = h.session.exportImage(options)
    options.includeMarkdown = false
    options.selectionIds.push('b')
    options.includeGrid = false
    pending.resolve('<svg/>')
    await exporting
    expect(h.downloads.mock.calls[0][1]).toMatch(/\.zip$/)
    expect(h.dependencies.exportSvg).toHaveBeenCalledWith(expect.anything(), false, undefined, { selectionIds: ['a'], includeGrid: true })
    await h.session.stop()
  })
  it('should_capture_committed_image_description_and_name_before_async_work_and_ignore_preview', async () => {
    const original = { ...createDocument('pair', 'Before'), description: '# Committed\r\n世界' }
    const h = await ready(original)
    const pending = deferred<string>()
    vi.mocked(h.dependencies.exportSvg).mockReturnValueOnce(pending.promise)
    h.session.preview({ ...original, title: 'Draft', description: 'Uncommitted' })
    const exporting = h.session.exportImage({ format: 'svg', scale: 1, transparent: false, includeMarkdown: true })
    expect(h.dependencies.exportSvg).toHaveBeenCalledWith(original, false)
    h.session.command({ type: 'metadata', patch: { title: 'After', description: 'Changed' } })
    pending.resolve('<svg/>')
    await exporting
    const [blob, name] = h.downloads.mock.calls[0]
    expect(name).toBe('Before.zip')
    expect(blob.type).toBe('application/zip')
    const bytes = Buffer.from(await blob.arrayBuffer())
    expect(bytes.includes(Buffer.from('# Committed\r\n世界'))).toBe(true)
    expect(bytes.includes(Buffer.from('Uncommitted'))).toBe(false)
    expect(h.session.getSnapshot().isExporting).toBe(false)
    await h.session.stop()
  })
  it('should_export_embedded_markdown_with_png_options_and_reject_double_wrapping_or_invalid_output', async () => {
    const original = { ...createDocument('embedded', 'Title'), description: 'Exact\r\n' }
    const h = await ready(original)
    vi.mocked(h.dependencies.exportPng).mockResolvedValue(new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' }))
    const options = { format: 'markdown' as const, scale: 2 as const, transparent: true, aspect: '16:9' as const, includeGrid: true }
    await h.session.exportImage(options)
    expect(h.dependencies.exportPng).toHaveBeenCalledWith(original, 2, true, undefined, { aspect: '16:9', includeGrid: true })
    expect(h.downloads.mock.calls[0][1]).toBe('Title.md')
    expect(await h.downloads.mock.calls[0][0].text()).toMatch(/^Exact\r\n\n\n!\[Diagram\]\(data:image\/png;base64,/)
    await h.session.exportImage({ ...options, includeMarkdown: true })
    expect(h.downloads).toHaveBeenCalledTimes(1)
    expect(h.session.getSnapshot().message).toMatch(/Export failed/)
    vi.mocked(h.dependencies.exportPng).mockResolvedValue(new Blob())
    await h.session.exportImage({ ...options, format: 'png', includeMarkdown: true })
    expect(h.downloads).toHaveBeenCalledTimes(1)
    expect(h.session.getSnapshot().document).toEqual(original)
    expect(h.session.getSnapshot().canUndo).toBe(false)
    await h.session.stop()
  })
})

describe('MCP canonical mutations DGM131', () => {
  const context = () => ({ deadline: Date.now() + 3000, active: () => true })
  it('should_commit_atomic_batch_as_one_undo_autosave_and_reject_invalid_whole_batch', async () => {
    const h = await ready(createDocument('remote'))
    h.session.setMcpGuard(() => null)
    const before = h.session.mcpState()
    const invalid = await h.session.mcpMutate({ name: 'edit_diagram', arguments: { stateToken: before.stateToken, commands: [
      { type: 'metadata', patch: { title: 'Must rollback' } }, { type: 'remove', entityIds: ['missing'], connectionIds: [] },
    ] } }, context())
    expect(invalid.ok).toBe(false)
    expect(h.session.mcpState()).toEqual(before)
    const changed = await h.session.mcpMutate({ name: 'edit_diagram', arguments: { stateToken: before.stateToken, commands: [
      { type: 'metadata', patch: { title: 'Remote' } }, { type: 'metadata', patch: { description: '# Remote description' } },
    ] } }, context())
    expect(changed.ok).toBe(true)
    expect(h.session.getSnapshot().document.title).toBe('Remote')
    const token = h.session.mcpState().stateToken
    h.session.undo()
    expect(h.session.getSnapshot().document).toEqual(before.document)
    expect(h.session.mcpState().stateToken).not.toBe(before.stateToken)
    const stale = await h.session.mcpMutate({ name: 'redo', arguments: { stateToken: before.stateToken } }, context())
    expect(stale.ok).toBe(false)
    expect(token).not.toBe(h.session.mcpState().stateToken)
    await h.session.stop()
  })
  it('should_reject_readonly_loading_present_drafts_busy_expired_and_disconnected_without_change', async () => {
    const h = await ready(createDocument('guard'))
    h.session.setMcpGuard(() => null)
    const before = h.session.mcpState()
    const operation = { name: 'edit_diagram' as const, arguments: { stateToken: before.stateToken, commands: [{ type: 'metadata' as const, patch: { title: 'Rejected' } }] } }
    for (const reason of ['Unfinished draft', 'IME composition', 'Modal', 'Gesture']) {
      h.session.setMcpGuard(() => reason)
      expect((await h.session.mcpMutate(operation, context())).ok).toBe(false)
    }
    h.session.setMcpGuard(() => null)
    expect((await h.session.mcpMutate(operation, { deadline: Date.now() - 1, active: () => true })).ok).toBe(false)
    expect((await h.session.mcpMutate(operation, { deadline: Date.now() + 1000, active: () => false })).ok).toBe(false)
    h.session.presentation(true)
    expect((await h.session.mcpMutate(operation, context())).ok).toBe(false)
    h.session.presentation(false)
    h.writable(false)
    expect((await h.session.mcpMutate(operation, context())).ok).toBe(false)
    expect(h.session.getSnapshot().document).toBe(before.document)
    await h.session.stop()
  })
  it('should_use_normal_confirmation_and_replacement_history_for_blank_and_template', async () => {
    const h = await ready(sampleDiagram())
    h.session.setMcpGuard(() => null)
    const before = h.session.mcpState()
    vi.mocked(h.dependencies.confirmReplace).mockReturnValueOnce(false)
    expect((await h.session.mcpMutate({ name: 'create_diagram', arguments: { stateToken: before.stateToken } }, context())).ok).toBe(false)
    expect(h.session.mcpState()).toEqual(before)
    expect((await h.session.mcpMutate({ name: 'create_diagram', arguments: { stateToken: before.stateToken, template: 'web-api' } }, context())).ok).toBe(true)
    expect(h.session.getSnapshot().document.title).toBe(starterDocument('web-api').title)
    expect(h.session.getSnapshot().canUndo).toBe(false)
    expect((await h.session.mcpMutate({ name: 'create_diagram', arguments: { stateToken: h.session.mcpState().stateToken } }, context())).ok).toBe(true)
    expect(h.session.getSnapshot().document.entities).toEqual([])
    await h.session.stop()
  })
  it('should_recheck_token_guards_and_deadline_after_real_layout_before_committing', async () => {
    const h = await ready(sampleDiagram())
    h.session.setMcpGuard(() => null)
    let active = true
    const pending = h.session.mcpMutate({ name: 'arrange_diagram', arguments: { stateToken: h.session.mcpState().stateToken, direction: 'DOWN' } }, { deadline: Date.now() + 3000, active: () => active })
    await settle()
    h.session.command({ type: 'metadata', patch: { title: 'New UI wins' } })
    active = false
    h.jobs[0].resolve({ diagram: { ...sampleDiagram(), direction: 'DOWN' }, revision: sampleDiagram().revision })
    expect((await pending).ok).toBe(false)
    expect(h.session.getSnapshot().document.title).toBe('New UI wins')
    expect(h.cancel).toHaveBeenCalled()
    await h.session.stop()
  })
  it('should_cancel_expired_layout_without_late_commit_and_serialize_mutations', async () => {
    vi.useFakeTimers()
    try {
      const h = await ready(sampleDiagram())
      h.session.setMcpGuard(() => null)
      const before = h.session.mcpState()
      const pending = h.session.mcpMutate({ name: 'arrange_diagram', arguments: { stateToken: before.stateToken, direction: 'DOWN' } }, { deadline: Date.now() + 50, active: () => true })
      expect((await h.session.mcpMutate({ name: 'undo', arguments: { stateToken: before.stateToken } }, context())).ok).toBe(false)
      await vi.advanceTimersByTimeAsync(51)
      expect((await pending).ok).toBe(false)
      h.jobs[0].resolve({ diagram: { ...sampleDiagram(), direction: 'DOWN' }, revision: sampleDiagram().revision })
      await settle()
      expect(h.session.mcpState()).toEqual(before)
      expect(h.cancel).toHaveBeenCalled()
      await h.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_clear_recovery_availability_while_loading_and_after_stop', async () => {
    const h = harness(createDocument('recovered'))
    expect(h.session.mcpReady()).toBe(false)
    await settle()
    expect(h.session.mcpReady()).toBe(true)
    await h.session.stop()
    expect(h.session.mcpReady()).toBe(false)
  })
  it('should_reject_write_during_async_open_without_canceling_that_user_operation', async () => {
    const h = await ready(createDocument('current'))
    h.session.setMcpGuard(() => null)
    const text = deferred<string>()
    const open = h.session.openFile({ name: 'user.json', size: 10, text: () => text.promise }, 'open')
    const before = h.session.mcpState()
    expect((await h.session.mcpMutate({ name: 'create_diagram', arguments: { stateToken: before.stateToken } }, context())).ok).toBe(false)
    text.resolve(JSON.stringify(createDocument('user-file')))
    await open
    expect(h.session.getSnapshot().document.id).toBe('user-file')
    await h.session.stop()
  })
  it('should_recheck_deadline_after_pure_history_preparation_before_commit', async () => {
    vi.useFakeTimers()
    const original = historyModel.historyCommit
    try {
      const h = await ready(createDocument('deadline'))
      h.session.setMcpGuard(() => null)
      const before = h.session.mcpState()
      const spy = vi.spyOn(historyModel, 'historyCommit').mockImplementation((history, next) => {
        vi.setSystemTime(Date.now() + 1000)
        return original(history, next)
      })
      const result = await h.session.mcpMutate({ name: 'edit_diagram', arguments: { stateToken: before.stateToken, commands: [{ type: 'metadata', patch: { title: 'Too late' } }] } }, { deadline: Date.now() + 50, active: () => true })
      expect(result.ok).toBe(false)
      expect(h.session.mcpState()).toEqual(before)
      spy.mockRestore()
      await h.session.stop()
    } finally { vi.restoreAllMocks(); vi.useRealTimers() }
  })
})

describe('DGM-127 fresh startup and unified picker intent', () => {
  it('should_show_empty_nonmutating_loading_canvas_without_sample_when_recovery_is_pending_DGM127', async () => {
    const host = harness()
    const load = deferred<Diagram | null>()
    vi.mocked(host.storage.load).mockReturnValue(load.promise)
    const loading = host.session.getSnapshot()
    expect(loading.document.entities).toEqual([])
    expect(loading.document.connections).toEqual([])
    expect(loading.document.title).not.toBe('Commerce platform')
    expect(loading.readOnly).toBe(true)
    expect(loading.starterOffer).toBe(false)
    host.session.command({ type: 'metadata', patch: { title: 'Rejected' } })
    expect(host.session.getSnapshot().document).toBe(loading.document)
    await host.session.stop()
  })
  it('should_establish_fresh_empty_document_and_offer_picker_once_when_owned_load_finds_nothing_DGM127', async () => {
    vi.useFakeTimers()
    try {
      const host = await ready()
      const fresh = host.session.getSnapshot()
      expect(fresh.document.entities).toEqual([])
      expect(fresh.document.connections).toEqual([])
      expect(fresh.document.id).toBe('new-document')
      expect(fresh.readOnly).toBe(false)
      expect(fresh.backupDirty).toBe(false)
      expect(fresh.canUndo).toBe(false)
      expect(fresh.starterOffer).toBe(true)
      host.session.starterOffered()
      expect(host.session.getSnapshot().starterOffer).toBe(false)
      host.session.starterOffered()
      expect(host.session.getSnapshot().document).toBe(fresh.document)
      await vi.advanceTimersByTimeAsync(500)
      expect(host.storage.save).toHaveBeenCalledExactlyOnceWith(fresh.document)
      expect(Object.keys(vi.mocked(host.storage.save).mock.calls[0][0])).not.toContain('starterOffer')
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it.each(['nonempty', 'empty'] as const)('should_recover_exact_saved_%s_document_without_offering_picker_DGM127', async kind => {
    const saved = kind === 'nonempty' ? sampleDiagram() : createDocument('saved-empty', 'Saved empty')
    const host = await ready(saved)
    expect(host.session.getSnapshot().document).toBe(saved)
    expect(host.session.getSnapshot().starterOffer).toBe(false)
    expect(host.storage.save).not.toHaveBeenCalled()
    host.writable(false)
    host.writable(true)
    await settle()
    expect(host.session.getSnapshot().document).toBe(saved)
    expect(host.session.getSnapshot().starterOffer).toBe(false)
    await host.session.stop()
  })
  it('should_never_offer_picker_when_read_only_failed_or_lock_errors_DGM127', async () => {
    const readOnly = harness()
    await settle()
    expect(readOnly.session.getSnapshot().readOnly).toBe(true)
    expect(readOnly.session.getSnapshot().starterOffer).toBe(false)
    await readOnly.session.stop()
    const failed = harness()
    vi.mocked(failed.storage.load).mockRejectedValue(new Error('Saved document is invalid'))
    failed.writable(true)
    await settle()
    expect(failed.session.getSnapshot().saveState).toBe('error')
    expect(failed.session.getSnapshot().starterOffer).toBe(false)
    expect(failed.storage.save).not.toHaveBeenCalled()
    await failed.session.stop()
    const locked = await ready()
    expect(locked.session.getSnapshot().starterOffer).toBe(true)
    locked.session.lockError(new Error('Ownership rejected'))
    expect(locked.session.getSnapshot().starterOffer).toBe(false)
    await locked.session.stop()
  })
  it('should_not_reoffer_after_reacquisition_late_load_or_any_accepted_change_DGM127', async () => {
    const host = await ready()
    host.session.starterOffered()
    host.writable(false)
    expect(host.session.getSnapshot().starterOffer).toBe(false)
    host.writable(true)
    await settle()
    expect(host.session.getSnapshot().starterOffer).toBe(false)
    const edited = await ready()
    edited.session.command({ type: 'metadata', patch: { title: 'Started editing' } })
    expect(edited.session.getSnapshot().starterOffer).toBe(false)
    const late = harness()
    const first = deferred<Diagram | null>(), second = deferred<Diagram | null>()
    vi.mocked(late.storage.load).mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    late.writable(true); late.writable(false); late.writable(true)
    first.resolve(null)
    await settle()
    expect(late.session.getSnapshot().starterOffer).toBe(false)
    expect(late.session.getSnapshot().readOnly).toBe(true)
    second.resolve(null)
    await settle()
    expect(late.session.getSnapshot().starterOffer).toBe(true)
    await Promise.all([host.session.stop(), edited.session.stop(), late.session.stop()])
  })
  it('should_open_first_template_or_blank_from_pristine_fresh_document_without_discard_prompt_DGM127', async () => {
    const host = await ready()
    host.dependencies.newId = () => 'template-copy'
    expect(host.session.openStarter('web-api')).toBe(true)
    expect(host.dependencies.confirmReplace).not.toHaveBeenCalled()
    expect(host.session.getSnapshot().document).toEqual({ ...starterDocument('web-api'), id: 'template-copy' })
    expect(host.session.getSnapshot().starterOffer).toBe(false)
    const blank = await ready()
    blank.session.newDocument()
    expect(blank.dependencies.confirmReplace).not.toHaveBeenCalled()
    expect(blank.session.getSnapshot().document.entities).toEqual([])
    const dirty = await ready()
    dirty.session.command({ type: 'metadata', patch: { title: 'Real work' } })
    vi.mocked(dirty.dependencies.confirmReplace).mockReturnValue(false)
    const before = dirty.session.getSnapshot()
    expect(dirty.session.openStarter('web-api')).toBe(false)
    expect(dirty.dependencies.confirmReplace).toHaveBeenCalledOnce()
    expect(dirty.session.getSnapshot().document).toBe(before.document)
    expect(dirty.session.getSnapshot().canUndo).toBe(true)
    await Promise.all([host.session.stop(), blank.session.stop(), dirty.session.stop()])
  })
})

describe('DGM-040 integrated session', () => {
  it.each(starterKeys)('should_preserve_detached_guide_through_edit_undo_save_reload_and_reselection_DGM123_%s', async key => {
    vi.useFakeTimers()
    try {
      const host = await ready(sampleDiagram())
      let sequence = 0
      host.dependencies.newId = () => `guided-copy-${++sequence}`
      const bundled = starterDocument(key)
      expect(host.session.openStarter(key)).toBe(true)
      const first = host.session.getSnapshot().document
      expect(first).toEqual({ ...bundled, id: 'guided-copy-1' })
      expect(host.session.getSnapshot().canUndo).toBe(false)
      host.session.command({ type: 'metadata', patch: { description: '# Original user edit\n\nLiteral Markdown' } })
      const accepted = host.session.getSnapshot().document
      expect(accepted.entities).toEqual(first.entities)
      expect(accepted.connections.map(({ routeRevision: _revision, ...connection }) => connection)).toEqual(first.connections.map(({ routeRevision: _revision, ...connection }) => connection))
      expect(accepted.connections.every(connection => connection.routeRevision === undefined || connection.routeRevision === accepted.revision)).toBe(true)
      host.session.undo()
      expect(host.session.getSnapshot().document).toEqual(first)
      host.session.redo()
      expect(host.session.getSnapshot().document).toEqual(accepted)
      await vi.advanceTimersByTimeAsync(500)
      expect(host.storage.save).toHaveBeenCalledExactlyOnceWith(accepted)
      await host.session.saveJson()
      const [blob] = host.downloads.mock.calls[0]
      expect(JSON.parse(await blob.text())).toEqual(accepted)
      await host.session.openFile({ name: 'guided.json', size: blob.size, text: () => blob.text() }, 'open')
      expect(host.session.getSnapshot().document).toEqual(accepted)
      const reloaded = await ready(JSON.parse(await blob.text()) as Diagram)
      expect(reloaded.session.getSnapshot().document.description).toBe(accepted.description)
      await reloaded.session.stop()
      expect(host.session.openStarter(key)).toBe(true)
      const second = host.session.getSnapshot().document
      expect(second).toEqual({ ...bundled, id: 'guided-copy-2' })
      first.entities[0].label = 'Mutation of first copy only'
      first.description = '# Changed old copy'
      expect(second.entities).toEqual(bundled.entities)
      expect(starterDocument(key)).toEqual(bundled)
      expect(second.entities).not.toBe(first.entities)
      expect(second.connections).not.toBe(first.connections)
      expect(host.dependencies.layout).not.toHaveBeenCalled()
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_save_open_reload_and_undo_redo_literal_description_DGM122', async () => {
    vi.useFakeTimers()
    try {
      const initial = sampleDiagram()
      const host = await ready(initial)
      const description = '  # Architecture\r\n\r\n- **API**\n\t\u6f22\u5b57 \ud83d\ude00  '.repeat(300)
      host.session.preview({ ...initial, description: 'Uncommitted draft' })
      expect(host.session.getSnapshot().document).toBe(initial)
      host.session.command({ type: 'metadata', patch: { description } })
      const accepted = host.session.getSnapshot().document
      expect(accepted.description).toBe(description)
      expect(accepted.entities).toEqual(initial.entities)
      host.session.undo()
      expect(host.session.getSnapshot().document).toEqual(initial)
      expect(host.session.getSnapshot().canUndo).toBe(false)
      host.session.redo()
      expect(host.session.getSnapshot().document).toEqual(accepted)
      await vi.advanceTimersByTimeAsync(500)
      expect(host.storage.save).toHaveBeenCalledExactlyOnceWith(accepted)
      await host.session.saveJson()
      const [blob] = host.downloads.mock.calls[0]
      expect(JSON.parse(await blob.text())).toEqual(accepted)
      expect(host.session.getSnapshot().backupDirty).toBe(false)
      host.session.command({ type: 'metadata', patch: { description: 'Replace me' } })
      await host.session.openFile({ name: 'description.json', size: blob.size, text: () => blob.text() }, 'open')
      expect(host.session.getSnapshot().document).toEqual(accepted)
      expect(host.session.getSnapshot().canUndo).toBe(false)
      const reopened = await ready(JSON.parse(JSON.stringify(accepted)) as Diagram)
      expect(reopened.session.getSnapshot().document).toEqual(accepted)
      await reopened.session.stop()
      host.session.command({ type: 'metadata', patch: { description: undefined } })
      expect(Object.hasOwn(host.session.getSnapshot().document, 'description')).toBe(false)
      host.session.undo()
      expect(host.session.getSnapshot().document.description).toBe(description)
      await host.session.stop()
    } finally { vi.useRealTimers() }
  })
  it('should_reject_invalid_description_commands_and_native_files_atomically_DGM122', async () => {
    const initial = { ...sampleDiagram(), description: '# Stored' }
    const host = await ready(initial)
    for (const description of [null, 1, {}, 'x'.repeat(20001)]) {
      host.session.command({ type: 'metadata', patch: { description } } as unknown as import('../contracts.ts').DocumentCommand)
      expect(host.session.getSnapshot().document).toBe(initial)
      expect(host.session.getSnapshot().message).toContain('description')
      await host.session.openFile({ name: 'invalid.json', size: 1, text: async () => JSON.stringify({ ...initial, description }) }, 'open')
      expect(host.session.getSnapshot().document).toBe(initial)
      expect(host.session.getSnapshot().canUndo).toBe(false)
      expect(host.session.getSnapshot().message).toContain('description')
    }
    expect(host.storage.save).not.toHaveBeenCalled()
    await host.session.stop()
  })
  it.each(['loading', 'read-only', 'Present'])('should_block_description_mutation_when_session_is_%s_DGM122', async mode => {
    const initial = { ...sampleDiagram(), description: '# Stored' }
    const host = mode === 'loading' ? harness(initial) : await ready(initial)
    if (mode === 'read-only') host.writable(false)
    if (mode === 'Present') host.session.presentation(true)
    const before = host.session.getSnapshot().document
    host.session.command({ type: 'metadata', patch: { description: '# Forbidden' } })
    expect(host.session.getSnapshot().document).toBe(before)
    expect(host.session.getSnapshot().canUndo).toBe(false)
    expect(host.storage.save).not.toHaveBeenCalled()
    await host.session.stop()
  })
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
    // DGM-127: no saved diagram shows an empty document while read-only, never the sample.
    expect(host.session.getSnapshot().document.title).toBe('Untitled architecture')
    expect(host.session.getSnapshot().document.entities).toEqual([])
    expect(host.session.getSnapshot().starterOffer).toBe(false)
    expect(host.session.getSnapshot().readOnly).toBe(true)
    host.session.command({ type: 'metadata', patch: { title: 'Rejected' } })
    expect(host.session.getSnapshot().document.title).toBe('Untitled architecture')
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
  it('should_leave_document_history_and_autosave_untouched_when_the_real_router_rejects_a_trapped_port_DGM142', async () => {
    const document = createDocument('trapped')
    document.entities = [
      { id: 'a', kind: 'component', label: 'a', color: 'azure', x: 0, y: 0, width: 220, height: 88 },
      { id: 'wall', kind: 'component', label: 'wall', color: 'azure', x: 220, y: 0, width: 220, height: 88 },
      { id: 'b', kind: 'component', label: 'b', color: 'azure', x: 600, y: 0, width: 220, height: 88 },
    ]
    document.connections = [{ id: 'trapped-edge', from: 'a', to: 'b', sourceSide: 'right', targetSide: 'left', label: 'Flow', style: 'solid', arrow: 'forward' }]
    const host = await ready(document), before = host.session.getSnapshot()
    vi.mocked(host.storage.save).mockClear()
    host.dependencies.layout = input => ({
      promise: Promise.resolve().then(() => ({ diagram: routeFixedGeometry(input).diagram, revision: input.revision })),
      cancel: vi.fn(),
    })
    await host.session.arrange('RIGHT')
    expect(host.session.getSnapshot().document).toBe(before.document)
    expect(host.session.getSnapshot().canUndo).toBe(before.canUndo)
    expect(host.session.getSnapshot().canRedo).toBe(before.canRedo)
    expect(host.session.getSnapshot().message).toContain('trapped-edge')
    expect(host.storage.save).not.toHaveBeenCalled()
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