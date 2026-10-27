import { describe, expect, it, vi } from 'vitest'
import { createDocument } from '../model.ts'
import type { DesktopMcp } from './mcp.ts'
import { listenMcpMutations, publishMcpSession } from './mcp.ts'
import type { McpMutationRequest, McpMutationResult } from './mcp-contract.ts'
import { searchableLibrary } from '../catalog/presentation.ts'
import { starterCatalog } from './starters.ts'

describe('committed desktop MCP publisher DGM131', () => {
  it('should_publish_valid_committed_changes_and_static_existing_metadata_once_not_drafts', async () => {
    let snapshot = { document: createDocument('test'), saveState: 'loading' as string }
    let notify = () => {}
    const bridge: DesktopMcp = { status: vi.fn(), copyAddress: vi.fn(), copyToken: vi.fn(), publishSnapshot: vi.fn(async () => ({ ok: true as const })) }
    const stop = publishMcpSession({ getSnapshot: () => snapshot, subscribe: listener => { notify = listener; return () => {} } }, bridge)
    expect(bridge.publishSnapshot).toHaveBeenLastCalledWith(null)
    snapshot = { ...snapshot, saveState: 'saved' }; notify()
    const first = JSON.parse(vi.mocked(bridge.publishSnapshot).mock.calls.at(-1)![0]!)
    expect(first.document).toEqual(snapshot.document)
    expect(first.catalog.map((item: { icon: string }) => item.icon)).toEqual(searchableLibrary.map(item => item.icon))
    expect(first.templates.map((item: { key: string }) => item.key)).toEqual(starterCatalog.map(item => item.key))
    const calls = vi.mocked(bridge.publishSnapshot).mock.calls.length
    notify()
    expect(bridge.publishSnapshot).toHaveBeenCalledTimes(calls)
    snapshot = { document: { ...snapshot.document, title: 'Committed edit', revision: 1 }, saveState: 'saving' }; notify()
    expect(JSON.parse(vi.mocked(bridge.publishSnapshot).mock.calls.at(-1)![0]!)).toEqual({ document: snapshot.document, stateToken: 'unavailable' })
    snapshot = { ...snapshot, saveState: 'error' }; notify()
    expect(bridge.publishSnapshot).toHaveBeenLastCalledWith(null)
    snapshot = { ...snapshot, saveState: 'read-only' }; notify()
    expect(JSON.parse(vi.mocked(bridge.publishSnapshot).mock.calls.at(-1)![0]!).catalog).toHaveLength(searchableLibrary.length)
    stop()
    expect(bridge.publishSnapshot).toHaveBeenLastCalledWith(null)
  })
  it('should_publish_unavailable_when_existing_domain_validation_rejects_a_document', () => {
    const bridge: DesktopMcp = { status: vi.fn(), copyAddress: vi.fn(), copyToken: vi.fn(), publishSnapshot: vi.fn(async () => ({ ok: true as const })) }
    const stop = publishMcpSession({ getSnapshot: () => ({ document: { ...createDocument('invalid'), revision: -1 }, saveState: 'saved' }), subscribe: () => () => {} }, bridge)
    expect(bridge.publishSnapshot).toHaveBeenLastCalledWith(null)
    stop()
  })
  it('should_cancel_renderer_request_on_unload_and_not_complete_a_late_mutation', async () => {
    let receive: (request: McpMutationRequest) => void = () => {}
    let cancel: (id: string) => void = () => {}
    let context: { deadline: number; active(): boolean } | undefined
    let resolve!: (result: McpMutationResult) => void
    const pending = new Promise<McpMutationResult>(yes => { resolve = yes })
    const bridge: DesktopMcp = {
      status: vi.fn(), copyAddress: vi.fn(), copyToken: vi.fn(), publishSnapshot: vi.fn(),
      onMutation: (callback, canceled) => { receive = callback; cancel = canceled; return vi.fn() },
      mutationActive: vi.fn(async () => true), completeMutation: vi.fn(async () => true),
    }
    const stop = listenMcpMutations({ mcpMutate: (_operation, ctx) => { context = ctx; return pending } }, bridge)
    receive({ id: 'one', deadline: Date.now() + 1000, operation: { name: 'undo', arguments: { stateToken: 'test' } } })
    await Promise.resolve()
    expect(context?.active()).toBe(true)
    cancel('one')
    expect(context?.active()).toBe(false)
    stop()
    resolve({ ok: false, message: 'Canceled' })
    await Promise.resolve(); await Promise.resolve()
    expect(bridge.completeMutation).not.toHaveBeenCalled()
  })
})
