// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { saveWorkspaceDiagram, saveWorkspaceExport } from './workspace.ts'
import { download } from '../export.ts'
vi.mock('../export.ts', () => ({ download: vi.fn() }))
afterEach(() => { delete window.desktopWorkspace; vi.clearAllMocks() })
it('should_retain_browser_downloads_without_a_desktop_bridge', async () => {
  const blob = new Blob(['{}'], { type: 'application/json' })
  expect(await saveWorkspaceExport(blob, 'a.json', 'document-id')).toBe(true)
  expect(download).toHaveBeenCalledExactlyOnceWith(blob, 'a.json')
})
it('should_dispatch_only_fixed_bytes_identity_and_name_and_return_native_cancellation', async () => {
  const save = vi.fn(async () => false)
  window.desktopWorkspace = { read: vi.fn(), choose: vi.fn(), reset: vi.fn(), save, saveDiagram: vi.fn(), saveDiagramAs: vi.fn() }
  const blob = new Blob(['{}'], { type: 'application/json' })
  // jsdom's Blob lacks arrayBuffer; this fixture keeps the real adapter's
  // byte conversion under test without changing the app or browser runtime.
  Object.defineProperty(blob, 'arrayBuffer', { value: async () => new TextEncoder().encode('{}').buffer })
  expect(await saveWorkspaceExport(blob, 'a.json', 'document-id')).toBe(false)
  expect(save).toHaveBeenCalledWith({ documentId: 'document-id', filename: 'a.json', mimeType: 'application/json', bytes: new Uint8Array([123, 125]) })
  expect(download).not.toHaveBeenCalled()
})
it('should_use_only_fixed_default_or_save_as_diagram_bridge_operations_DGM159', async () => {
  const saveDiagram = vi.fn(async () => ({ saved: true, filename: 'Kept name.json' }))
  const saveDiagramAs = vi.fn(async () => ({ saved: false }))
  window.desktopWorkspace = { read: vi.fn(), choose: vi.fn(), reset: vi.fn(), save: vi.fn(), saveDiagram, saveDiagramAs }
  const blob = new Blob(['{}'], { type: 'application/json' })
  Object.defineProperty(blob, 'arrayBuffer', { value: async () => new TextEncoder().encode('{}').buffer })
  expect(await saveWorkspaceDiagram(blob, 'Diagram name.json')).toEqual({ saved: true, filename: 'Kept name.json' })
  expect(await saveWorkspaceDiagram(blob, 'Diagram name.json', true)).toEqual({ saved: false })
  expect(saveDiagram).toHaveBeenCalledOnce()
  expect(saveDiagramAs).toHaveBeenCalledOnce()
})
