// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { EditorProps } from '../contracts.ts'
import { createDocument, sampleDiagram, type Diagram } from '../model.ts'
import App from '../App.tsx'
import { starterCatalog } from './starters.ts'
import { starterDocument } from './session.ts'

const host = vi.hoisted(() => ({ realEditor: false, props: undefined as EditorProps | undefined, leases: [] as ((owns: boolean) => void)[], release: vi.fn(), close: vi.fn(), save: vi.fn(async () => {}), load: vi.fn(async (): Promise<Diagram | null> => null), download: vi.fn(), confirmReplace: vi.fn(() => true), layout: vi.fn(), exportPng: vi.fn(async () => new Blob(['png'], { type: 'image/png' })), copyImage: vi.fn(async (_png: Promise<Blob>) => {}) }))
vi.mock('../editor/Editor.tsx', async importOriginal => {
  const { default: Editor } = await importOriginal<typeof import('../editor/Editor.tsx')>()
  return { default: (props: EditorProps) => { host.props = props; return host.realEditor ? <Editor {...props} /> : <div>{props.document?.title}</div> } }
})
vi.mock('@xyflow/react', async importOriginal => ({
  ...await importOriginal<typeof import('@xyflow/react')>(),
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => children,
  ReactFlow: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Background: () => null,
  useReactFlow: () => ({ getViewport: () => ({ x: 17, y: 23, zoom: .75 }), setViewport: vi.fn(async () => true), screenToFlowPosition: (point: { x: number; y: number }) => point, zoomIn: vi.fn(), zoomOut: vi.fn() }),
  useViewport: () => ({ x: 17, y: 23, zoom: .75 }),
  useStoreApi: () => ({ getState: () => ({ cancelConnection: vi.fn() }) }),
}))
vi.mock('./browser.ts', () => ({ browserDependencies: {
  createStorage: () => ({ load: host.load, save: host.save, close: host.close }),
  watchLock: (callback: (owns: boolean) => void) => { host.leases.push(callback); callback(false); return host.release },
  download: host.download, confirmReplace: host.confirmReplace, newId: () => 'new-document', layout: host.layout,
  exportPng: host.exportPng, copyImage: host.copyImage,
} }))
afterEach(() => { cleanup(); vi.clearAllMocks(); host.load.mockImplementation(async () => null); host.leases.length = 0; host.realEditor = false })

describe('DGM-040 root integration', () => {
  it.each(['error', 'resize-notification', 'unhandledrejection', 'pagehide'])('should_keep_fail_closed_mcp_invalidation_for_%s_DGM142', async kind => {
    const unsubscribe = vi.fn()
    const bridge = {
      status: vi.fn(), copyAddress: vi.fn(), copyToken: vi.fn(), publishSnapshot: vi.fn(async (_snapshot: string | null) => ({ ok: true as const })),
      onMutation: vi.fn(() => unsubscribe), mutationActive: vi.fn(async () => true), completeMutation: vi.fn(async () => true),
    }
    window.desktopMcp = bridge
    try {
      render(<App />)
      await act(async () => { host.leases.at(-1)!(true) })
      expect(bridge.publishSnapshot.mock.calls.at(-1)?.[0]).not.toBeNull()
      act(() => window.dispatchEvent(kind === 'error' || kind === 'resize-notification'
        ? new ErrorEvent('error', { message: kind === 'resize-notification' ? 'ResizeObserver loop completed with undelivered notifications.' : 'Renderer failed' })
        : new Event(kind)))
      expect(bridge.publishSnapshot).toHaveBeenLastCalledWith(null)
      expect(unsubscribe).toHaveBeenCalledOnce()
      const count = bridge.publishSnapshot.mock.calls.length
      act(() => host.props!.onCommand({ type: 'metadata', patch: { title: 'No stale snapshot publication' } }))
      expect(bridge.publishSnapshot).toHaveBeenCalledTimes(count)
    } finally { cleanup(); delete window.desktopMcp }
  })
  it('should_forward_transient_arrangement_options_from_editor_to_session_DGM137', async () => {
    host.load.mockImplementation(async () => sampleDiagram())
    render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    const document = host.props!.document
    host.layout.mockReturnValueOnce({ promise: Promise.resolve({ diagram: document, revision: document.revision }), cancel: vi.fn() })
    await act(async () => { host.props!.onArrange('RIGHT', { arrangement: 'stacked' }) })
    expect(host.layout).toHaveBeenCalledExactlyOnceWith(document, 'RIGHT', { arrangement: 'stacked' })
  })
  it.each([false, true])('should_distinguish_local_save_and_keep_json_available_when_storage_rejects_%s_DGM111', async rejects => {
    vi.useFakeTimers()
    try {
      host.realEditor = true
      // Explicit recovered-work fixture (DGM-127): production no longer defaults to the sample.
      host.load.mockImplementation(async () => sampleDiagram())
      if (rejects) host.save.mockRejectedValueOnce(new Error('QuotaExceededError'))
      const view = render(<App />)
      await act(async () => { host.leases.at(-1)!(true) })
      const title = view.getByLabelText('Document title')
      fireEvent.change(title, { target: { value: 'Current editable work' } })
      fireEvent.blur(title)
      const before = host.props!.document
      expect(view.container.querySelector('.save-label')?.textContent).toBe('Saving locally')
      await act(async () => { await vi.advanceTimersByTimeAsync(500) })
      expect(view.container.querySelector('.save-label')?.textContent).toBe(rejects ? 'Local save failed' : 'Saved on this device')
      expect(view.container.querySelector('.backup-state')?.textContent).toBe('Editable JSON copy needed')
      expect(host.props!.document).toBe(before)
      expect(host.props!.canUndo).toBe(true)
      expect(host.props!.readOnly).toBe(false)
      if (rejects) expect(view.getByRole('status').textContent).toBe('Browser save failed: QuotaExceededError. Download JSON now; free storage and edit again to retry.')
      fireEvent.click(view.getByRole('menuitem', { name: 'File menu' }))
      await act(async () => { fireEvent.click(view.getByRole('menuitem', { name: 'Save JSON' })) })
      expect(host.download).toHaveBeenCalledOnce()
      expect(host.props!.document).toBe(before)
      expect(host.props!.canUndo).toBe(true)
      expect(view.container.querySelector('.backup-state')?.textContent).toBe('No newer JSON changes')
    } finally { cleanup(); vi.useRealTimers() }
  })
  it.each([
    ['Open JSON', 'Open document file', 'cancel'],
    ['Open JSON', 'Open document file', 'empty'],
    ['Import skill JSON', 'Import skill file', 'cancel'],
    ['Import skill JSON', 'Import skill file', 'empty'],
  ] as const)('should_leave_document_unchanged_when_%s_picker_is_%s_%s_DGM111', async (action, picker, outcome) => {
    host.realEditor = true
    const view = render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    fireEvent.click(view.getByRole('dialog', { name: 'New diagram' }).querySelector<HTMLButtonElement>('[aria-label="Blank"]')!)
    const title = view.getByLabelText('Document title')
    fireEvent.change(title, { target: { value: 'Finalized before picker' } })
    const input = view.getByLabelText(picker) as HTMLInputElement
    const click = vi.spyOn(input, 'click')
    fireEvent.click(view.getByRole('menuitem', { name: 'File menu' }))
    fireEvent.click(view.getByRole('menuitem', { name: action }))
    expect(click).toHaveBeenCalledOnce()
    expect(host.props!.document.title).toBe('Finalized before picker')
    const before = host.props!
    await act(async () => {
      if (outcome === 'cancel') input.dispatchEvent(new Event('cancel', { bubbles: true }))
      else fireEvent.change(input, { target: { files: [] } })
    })
    expect(host.props!.document).toBe(before.document)
    expect(host.props!.canUndo).toBe(before.canUndo)
    expect(host.props!.canRedo).toBe(before.canRedo)
    expect(host.props!.backupDirty).toBe(before.backupDirty)
    expect(view.container.querySelector('.backup-state')?.textContent).toBe('Editable JSON copy needed')
    expect(host.confirmReplace).not.toHaveBeenCalled()
    expect(host.layout).not.toHaveBeenCalled()
  })
  it('should_wire_real_session_copy_callback_without_document_history_or_storage_mutation', async () => {
    render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    const before = host.props!.document
    await act(async () => { host.props!.onCopyImage!({ format: 'png', scale: 1, transparent: false, aspect: '16:9' }) })
    expect(host.copyImage).toHaveBeenCalledOnce()
    expect(host.copyImage.mock.calls[0][0]).toBeInstanceOf(Promise)
    expect(host.props!.message).toMatch(/copied/i)
    expect(host.props!.document).toBe(before); expect(host.props!.canUndo).toBe(false)
    expect(host.download).not.toHaveBeenCalled(); expect(host.save).not.toHaveBeenCalled()
  })
  it.each(['during', 'after'] as const)('should_reject_shell_file_read_resolving_%s_real_editor_presentation', async timing => {
    host.realEditor = true
    const view = render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    const before = host.props!.document
    let resolve!: (text: string) => void
    const pending = new Promise<string>(complete => { resolve = complete })
    const file = new File(['pending'], 'pending.json', { type: 'application/json' })
    const text = vi.fn(() => pending)
    Object.defineProperty(file, 'text', { value: text })
    fireEvent.change(view.getByLabelText('Open document file'), { target: { files: [file] } })
    expect(text).toHaveBeenCalledOnce()
    fireEvent.click(view.getByRole('button', { name: 'Present' }))
    expect(view.getByRole('button', { name: 'Exit presentation' })).toBeTruthy()
    if (timing === 'after') fireEvent.click(view.getByRole('button', { name: 'Exit presentation' }))
    await act(async () => resolve(JSON.stringify(createDocument('late', 'Late replacement'))))
    expect(host.props!.document).toBe(before)
    expect(host.confirmReplace).not.toHaveBeenCalled()
    expect(host.props!.canUndo).toBe(false)
    if (timing === 'during') {
      expect(view.getByRole('button', { name: 'Exit presentation' })).toBeTruthy()
      fireEvent.keyDown(window, { key: 'Escape' })
    }
    act(() => host.props!.onCommand({ type: 'metadata', patch: { title: 'Allowed after exit' } }))
    expect(host.props!.document.title).toBe('Allowed after exit')
  })
  it('should_guard_stale_shell_callbacks_and_hidden_pickers_during_real_present_and_preserve_lock_on_exit', async () => {
    host.realEditor = true
    const view = render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    act(() => host.props!.onCommand({ type: 'metadata', patch: { title: 'First' } }))
    act(() => host.props!.onCommand({ type: 'metadata', patch: { title: 'Second' } }))
    act(() => host.props!.onUndo())
    const callbacks = host.props!
    const open = view.getByLabelText('Open document file') as HTMLInputElement
    const imported = view.getByLabelText('Import skill file') as HTMLInputElement
    const openClick = vi.spyOn(open, 'click')
    const importClick = vi.spyOn(imported, 'click')
    fireEvent.click(view.getByRole('button', { name: 'Present' }))
    act(() => {
      callbacks.onCommand({ type: 'metadata', patch: { title: 'Forbidden' } })
      callbacks.onNew(); callbacks.onUndo(); callbacks.onRedo(); callbacks.onArrange('DOWN')
      callbacks.onOpen(); callbacks.onImport()
      callbacks.onPreviewChange({ ...callbacks.document, title: 'Forbidden preview' })
    })
    const file = new File(['hidden'], 'hidden.json')
    const text = vi.fn(async () => JSON.stringify(createDocument('hidden')))
    Object.defineProperty(file, 'text', { value: text })
    await act(async () => {
      fireEvent.change(open, { target: { files: [file] } })
      fireEvent.change(imported, { target: { files: [file] } })
    })
    expect(host.props!.document).toBe(callbacks.document)
    expect(host.props!.canUndo).toBe(true)
    expect(host.props!.canRedo).toBe(true)
    expect(openClick).not.toHaveBeenCalled()
    expect(importClick).not.toHaveBeenCalled()
    expect(text).not.toHaveBeenCalled()
    expect(host.layout).not.toHaveBeenCalled()
    expect(host.confirmReplace).not.toHaveBeenCalled()
    act(() => host.leases.at(-1)!(false))
    fireEvent.keyDown(window, { key: 'Escape' })
    act(() => callbacks.onCommand({ type: 'metadata', patch: { title: 'Still locked' } }))
    expect(host.props!.readOnly).toBe(true)
    expect(host.props!.document).toBe(callbacks.document)
  })
  it('should_exit_real_present_after_ownership_reload_and_allow_edits_only_after_latest_load', async () => {
    host.realEditor = true
    const view = render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    fireEvent.click(view.getByRole('button', { name: 'Present' }))
    act(() => host.leases.at(-1)!(false))
    let resolve!: (document: null) => void
    host.load.mockReturnValueOnce(new Promise<null>(complete => { resolve = complete }))
    act(() => host.leases.at(-1)!(true))
    expect(host.props!.readOnly).toBe(true)
    act(() => host.props!.onNew())
    expect(host.confirmReplace).not.toHaveBeenCalled()
    await act(async () => resolve(null))
    expect(view.queryByRole('button', { name: 'Exit presentation' })).toBeNull()
    expect(host.props!.readOnly).toBe(false)
    act(() => host.props!.onCommand({ type: 'metadata', patch: { title: 'Recovered' } }))
    expect(host.props!.document.title).toBe('Recovered')
  })
  it('should_render_controlled_editor_and_wait_for_lock_under_strictmode', async () => {
    host.load.mockImplementation(async () => sampleDiagram())
    render(<StrictMode><App /></StrictMode>)
    await waitFor(() => expect(host.leases).toHaveLength(2))
    await waitFor(() => expect(host.props?.document.title).toBe('Commerce platform'))
    expect(host.props?.readOnly).toBe(true)
    await act(async () => { host.leases[1](true) })
    expect(host.props?.readOnly).toBe(false)
    expect(host.release).toHaveBeenCalledOnce()
    expect(host.close).toHaveBeenCalledOnce()
    act(() => host.props?.onCommand({ type: 'metadata', patch: { title: 'Integrated' } }))
    expect(host.props?.document.title).toBe('Integrated')
    expect(host.props?.canUndo).toBe(true)
    act(() => host.props?.onUndo())
    expect(host.props?.document.title).toBe('Commerce platform')
  })
  it('should_open_file_picker_without_dropping_current_work_or_prompting_prematurely', async () => {
    const view = render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    act(() => host.props?.onCommand({ type: 'metadata', patch: { title: 'Keep this' } }))
    act(() => host.props?.onOpen())
    expect(host.props?.document.title).toBe('Keep this')
    expect(host.confirmReplace).not.toHaveBeenCalled()
    const input = view.getByLabelText('Open document file') as HTMLInputElement
    expect(input.accept).toBe('.json,application/json')
    await act(async () => { input.dispatchEvent(new Event('cancel', { bubbles: true })) })
    expect(host.props?.document.title).toBe('Keep this')
    const file = new File(['valid'], 'roundtrip.json', { type: 'application/json' })
    Object.defineProperty(file, 'text', { value: async () => JSON.stringify(createDocument('portable', 'Opened')) })
    Object.defineProperty(input, 'files', { configurable: true, value: [file] })
    await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(host.props?.document.title).toBe('Opened')
    expect(host.props?.backupDirty).toBe(false)
    expect(host.confirmReplace).toHaveBeenCalledOnce()
  })
  it('should_surface_async_lock_failure_and_disable_all_mutation_callbacks', async () => {
    host.load.mockImplementation(async () => sampleDiagram())
    render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    const error = Object.assign(new Error('Ownership rejected'), { name: 'PersistenceError', operation: 'Web Locks ownership' })
    act(() => window.dispatchEvent(new ErrorEvent('error', { error, message: error.message, cancelable: true })))
    expect(host.props?.readOnly).toBe(true)
    expect(host.props?.message).toContain('lock failed')
    act(() => host.props?.onNew())
    expect(host.props?.document.title).toBe('Commerce platform')
    expect(host.confirmReplace).not.toHaveBeenCalled()
  })
})

describe('DGM-127 fresh startup picker', () => {
  async function fresh(strict = false) {
    host.realEditor = true
    const view = render(strict ? <StrictMode><App /></StrictMode> : <App />)
    await waitFor(() => expect(host.leases.length).toBeGreaterThan(0))
    expect(host.props!.document.entities).toEqual([])
    expect(host.props!.document.title).not.toBe('Commerce platform')
    expect(view.queryByRole('dialog')).toBeNull()
    await act(async () => { host.leases.at(-1)!(true) })
    return view
  }
  it.each([false, true])('should_open_shared_picker_once_over_empty_canvas_with_Blank_focused_strict_%s_DGM127', async strict => {
    const view = await fresh(strict)
    const dialogs = view.getAllByRole('dialog', { name: 'New diagram' })
    expect(dialogs).toHaveLength(1)
    expect(dialogs[0].querySelectorAll('.starter-choice')).toHaveLength(12)
    expect(document.activeElement).toBe(view.getByRole('button', { name: 'Blank' }))
    expect(host.props!.document.entities).toEqual([])
    expect(host.props!.document.connections).toEqual([])
    expect(host.props!.readOnly).toBe(false)
    expect(host.props!.starterOffer).toBe(false)
  })
  it.each(['Blank', 'Escape', 'Close', 'backdrop'] as const)('should_close_onto_empty_writable_canvas_without_prompt_when_%s_DGM127', async action => {
    const view = await fresh()
    const before = host.props!.document
    const dialog = view.getByRole('dialog', { name: 'New diagram' })
    if (action === 'Blank') fireEvent.click(view.getByRole('button', { name: 'Blank' }))
    if (action === 'Escape') fireEvent.keyDown(dialog, { key: 'Escape' })
    if (action === 'Close') fireEvent.click(view.getByRole('button', { name: 'Close new diagram' }))
    if (action === 'backdrop') fireEvent.click(view.getByRole('button', { name: 'Dismiss new diagram choices' }))
    expect(view.queryByRole('dialog')).toBeNull()
    expect(host.props!.document.entities).toEqual([])
    expect(host.props!.document.connections).toEqual([])
    expect(host.props!.document.title).toBe(before.title)
    expect(host.props!.readOnly).toBe(false)
    expect(host.confirmReplace).not.toHaveBeenCalled()
    act(() => host.props!.onCommand({ type: 'metadata', patch: { title: 'Usable' } }))
    expect(host.props!.document.title).toBe('Usable')
    expect(view.queryByRole('dialog')).toBeNull()
  })
  it('should_open_first_template_from_fresh_picker_without_discard_prompt_DGM127', async () => {
    const view = await fresh()
    const choice = starterCatalog[0]
    fireEvent.click(view.getByRole('button', { name: choice.label }))
    expect(host.confirmReplace).not.toHaveBeenCalled()
    expect(view.queryByRole('dialog')).toBeNull()
    expect(host.props!.document).toEqual({ ...starterDocument(choice.key), id: 'new-document' })
    expect(host.props!.backupDirty).toBe(true)
  })
  it('should_recover_saved_work_without_opening_picker_and_not_reopen_on_reacquisition_DGM127', async () => {
    host.realEditor = true
    const saved = sampleDiagram()
    host.load.mockResolvedValue(saved as never)
    const view = render(<App />)
    await act(async () => { host.leases.at(-1)!(true) })
    expect(host.props!.document).toBe(saved)
    expect(view.queryByRole('dialog')).toBeNull()
    host.load.mockReset(); host.load.mockResolvedValue(null)
    act(() => host.leases.at(-1)!(false))
    await act(async () => { host.leases.at(-1)!(true) })
    expect(view.queryByRole('dialog')).toBeNull()
    act(() => host.leases.at(-1)!(false))
    await act(async () => { host.leases.at(-1)!(true) })
    expect(view.queryByRole('dialog')).toBeNull()
  })
  it('should_not_open_picker_while_loading_read_only_or_failed_DGM127', async () => {
    host.realEditor = true
    const view = render(<App />)
    await waitFor(() => expect(host.leases.length).toBeGreaterThan(0))
    expect(view.queryByRole('dialog')).toBeNull()
    host.load.mockRejectedValueOnce(new Error('Corrupt'))
    await act(async () => { host.leases.at(-1)!(true) })
    expect(host.props!.saveState).toBe('error')
    expect(view.queryByRole('dialog')).toBeNull()
    expect(host.save).not.toHaveBeenCalled()
  })
})