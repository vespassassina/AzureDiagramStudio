import { validateDocument } from '../document/index.ts'
import type { Diagram } from '../model.ts'
import { searchableLibrary } from '../catalog/presentation.ts'
import { starterCatalog } from './starters.ts'
import { validateMutation, validateOutputOperation } from '../../electron/mcp-schema.mjs'
import type { McpDocumentState, McpRequest, McpMutationResult, McpOperation, McpOutputOperation, McpOutputResult } from './mcp-contract.ts'

export type McpStatus = { state: 'running' | 'unavailable' | 'error'; address?: string; snapshotAvailable: boolean; message?: string }
export type McpActionResult = { ok: true } | { ok: false; message: string }
export interface DesktopMcp {
  status(): Promise<McpStatus>
  copyAddress(): Promise<McpActionResult>
  copyToken(): Promise<McpActionResult>
  publishSnapshot(text: string | null): Promise<McpActionResult>
  onMutation?(callback: (request: McpRequest) => void, canceled: (id: string) => void): () => void
  mutationActive?(id: string): Promise<boolean>
  completeMutation?(id: string, text: string): Promise<boolean>
}
declare global { interface Window { desktopMcp?: DesktopMcp } }

const metadata = {
  catalog: searchableLibrary.map(({ icon, label, subtitle, category, catalog, aliases, keywords }) => ({ icon, label, subtitle, category, catalog, aliases: aliases ?? [], keywords: keywords ?? [] })),
  templates: starterCatalog.map(({ key, label, sourceCue, reference }) => ({ key, label, sourceCue, ...(reference ? { reference } : {}) })),
}
type SessionSource = { getSnapshot(): { document: Diagram; saveState: string }; subscribe(listener: () => void): () => void; mcpState?(): McpDocumentState; mcpReady?(): boolean }

// Pseudocode: observe only canonical session snapshots; clear while unavailable;
// validate each new committed document; send static metadata only on recovery;
// never observe editor preview/drafts; clear on unmount or page unload.
export function publishMcpSession(session: SessionSource, bridge: DesktopMcp) {
  let previous: Diagram | undefined
  let available = false
  function send(text: string | null) {
    void bridge.publishSnapshot(text).then(result => {
      if (!result.ok) { available = false; previous = undefined; console.error('Desktop MCP snapshot unavailable') }
    }).catch(() => { available = false; previous = undefined; console.error('Desktop MCP bridge unavailable') })
  }
  function publish() {
    const snapshot = session.getSnapshot()
    if (snapshot.saveState === 'loading' || snapshot.saveState === 'error' || session.mcpReady?.() === false) {
      previous = undefined; available = false; send(null); return
    }
    if (previous === snapshot.document && available) return
    const result = validateDocument(snapshot.document)
    if (!result.ok) { previous = undefined; available = false; send(null); return }
    send(JSON.stringify({ document: result.value, stateToken: session.mcpState?.().stateToken ?? 'unavailable', ...(!available ? metadata : {}) }))
    previous = snapshot.document; available = true
  }
  const unsubscribe = session.subscribe(publish)
  publish()
  return () => { unsubscribe(); previous = undefined; available = false; send(null) }
}

type MutationSession = {
  mcpMutate(operation: McpOperation, context: { deadline: number; active(): boolean }): Promise<McpMutationResult>
  mcpOutput?(operation: McpOutputOperation, context: { deadline: number; active(): boolean }): Promise<McpOutputResult>
}
export function listenMcpMutations(session: MutationSession, bridge: DesktopMcp) {
  if (!bridge.onMutation || !bridge.completeMutation || !bridge.mutationActive) return () => {}
  let live = true
  const pending = new Map<string, { active: boolean }>()
  const unsubscribe = bridge.onMutation(request => {
    if (!request || typeof request !== 'object' || Object.keys(request).length !== 3 ||
        typeof request.id !== 'string' || !request.id || request.id.length > 200 ||
        !Number.isSafeInteger(request.deadline) || Date.now() >= request.deadline ||
        (!validateMutation(request.operation) && !validateOutputOperation(request.operation)) || pending.has(request.id)) return
    const state = { active: true }
    pending.set(request.id, state)
    void (async () => {
      try {
        if (!await bridge.mutationActive!(request.id) || !live || !state.active || Date.now() >= request.deadline) return
        const context = { deadline: request.deadline, active: () => live && state.active }
        const operation = request.operation
        const result = operation.name === 'snapshot_diagram' || operation.name === 'export_diagram'
          ? await session.mcpOutput?.(operation, context) ?? { ok: false, message: 'Output unavailable.' }
          : await session.mcpMutate(operation, context)
        if (live && state.active) await bridge.completeMutation!(request.id, JSON.stringify(result))
      } catch { console.error('Desktop MCP mutation bridge unavailable') }
      finally { pending.delete(request.id) }
    })()
  }, id => { const state = pending.get(id); if (state) state.active = false })
  return () => { live = false; for (const state of pending.values()) state.active = false; unsubscribe() }
}
