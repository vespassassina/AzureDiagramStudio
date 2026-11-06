import { workerLayout } from './app/browser.ts'
import { createSession } from './app/session.ts'
import { searchableLibrary } from './catalog/presentation.ts'
import { exportPng, exportSvg, rasterizeIcon } from './export.ts'
import { starterCatalog } from './app/starters.ts'
import { validateDocument } from './document/index.ts'
import { validateMutation, validateOutputOperation, validateWorkbookOperation } from '../electron/mcp-schema.mjs'
import { MAX_WORKBOOK_BYTES } from './workbook.ts'
import type { PdfJob } from './app/workbook-output.ts'
import type { DocumentStorage } from './contracts.ts'
import type { McpOperation, McpOutputOperation, McpWorkbookOperation } from './app/mcp-contract.ts'

declare global {
  interface Window {
    headlessRuntime: {
      ready(): void
      respond(id: string, result: unknown): void
      onRequest(callback: (request: unknown) => void): () => void
      renderPdf(job: PdfJob): Promise<Uint8Array>
    }
  }
}

const metadata = {
  catalog: searchableLibrary.map(({ icon, label, subtitle, category, catalog, aliases, keywords }) => ({ icon, label, subtitle, category, catalog, aliases: aliases ?? [], keywords: keywords ?? [] })),
  templates: starterCatalog.map(({ key, label, sourceCue, reference }) => ({ key, label, sourceCue, ...(reference ? { reference } : {}) })),
}
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const deadline = () => Date.now() + 15_000
// Whole-workbook PDF/Visio rendering needs more than a single-page export.
const workbookDeadline = () => Date.now() + 65_000
type WorkerRequest = { id: string; kind: string; query?: unknown; text?: unknown; operation?: unknown; pageId?: unknown }

function memoryStorage(): DocumentStorage {
  return { load: async () => null, save: async () => {}, close: () => {} }
}

const session = createSession({
  createStorage: memoryStorage,
  watchLock: callback => { callback(true); return () => {} },
  layout: workerLayout,
  download: () => { throw new Error('Headless workers do not download files.') },
  confirmReplace: () => true,
  newId: () => `headless-${crypto.randomUUID()}`,
  exportSvg,
  exportPng,
  renderPdf: job => window.headlessRuntime.renderPdf(job),
  rasterizeIcon,
})
session.setMcpGuard(() => null)
session.start()

async function ready() {
  if (session.mcpReady()) return
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => { unsubscribe(); reject(new Error('Headless session startup timed out.')) }, 5_000)
    const unsubscribe = session.subscribe(() => {
      if (session.mcpReady()) { clearTimeout(timer); unsubscribe(); resolve() }
      if (session.getSnapshot().saveState === 'error') { clearTimeout(timer); unsubscribe(); reject(new Error(session.getSnapshot().message)) }
    })
  })
}

async function load(text: unknown) {
  // Workbook roots may reach 64 MiB; a standalone Diagram stays bounded at 5 MiB by the shared parser.
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_WORKBOOK_BYTES) throw new Error('JSON files must be at most 64 MiB')
  const opened = await session.openFile({ name: 'input.json', size: new TextEncoder().encode(text).byteLength, text: async () => text }, 'open')
  if (!opened) throw new Error(session.getSnapshot().message || 'Input diagram could not be opened.')
  return state()
}

// The active page keeps the legacy {document, stateToken} contract; workbook-aware
// callers also receive the full persisted root and the root/page token summary.
async function state() {
  const snapshot = session.getSnapshot()
  const validated = validateDocument(snapshot.document)
  if (!validated.ok) throw new Error('Committed document is invalid.')
  const workbook = await session.mcpWorkbook({ name: 'get_workbook', arguments: {} }, { deadline: deadline(), active: () => true })
  if (!workbook.ok || !('value' in workbook)) throw new Error(workbook.ok ? 'Workbook state unavailable.' : workbook.message)
  return { document: validated.value, stateToken: session.mcpState().stateToken, root: snapshot.root, workbook: workbook.value }
}

async function execute(request: unknown) {
  if (!request || typeof request !== 'object' || Array.isArray(request) || typeof (request as WorkerRequest).kind !== 'string') throw new Error('Invalid headless worker request.')
  const command = request as WorkerRequest
  await ready()
  if (command.kind === 'state') return state()
  if (command.kind === 'catalog') {
    const query = typeof command.query === 'string' ? command.query.trim().toLocaleLowerCase('en') : ''
    const entries = metadata.catalog.filter(item => !query || [item.label, item.subtitle, item.category, item.catalog, ...item.aliases, ...item.keywords].join('\n').toLocaleLowerCase('en').includes(query))
    return { entries, total: entries.length }
  }
  if (command.kind === 'templates') return { templates: metadata.templates }
  if (command.kind === 'load') return load(command.text)
  if (command.kind === 'mutate') {
    if (!validateMutation(command.operation)) throw new Error('Invalid mutation arguments.')
    const result = await session.mcpMutate(command.operation as McpOperation, { deadline: deadline(), active: () => true })
    if (!result.ok) throw new Error(result.message)
    return result.value
  }
  if (command.kind === 'output') {
    if (!validateOutputOperation(command.operation)) throw new Error('Invalid output arguments.')
    const result = await session.mcpOutput(command.operation as McpOutputOperation, { deadline: deadline(), active: () => true })
    if (!result.ok) throw new Error(result.message)
    return result.output
  }
  if (command.kind === 'select') {
    if (typeof command.pageId !== 'string' || !session.selectPage(command.pageId)) throw new Error(`Unknown page: ${String(command.pageId).slice(0, 128)}`)
    return state()
  }
  if (command.kind === 'workbook') {
    if (!validateWorkbookOperation(command.operation)) throw new Error('Invalid workbook arguments.')
    const result = await session.mcpWorkbook(command.operation as McpWorkbookOperation, { deadline: workbookDeadline(), active: () => true })
    if (!result.ok) throw new Error(result.message)
    return 'output' in result ? result.output : result.value
  }
  throw new Error('Unsupported headless worker request.')
}

window.headlessRuntime.onRequest(async request => {
  const id = request && typeof request === 'object' && !Array.isArray(request) ? (request as Partial<WorkerRequest>).id : undefined
  if (typeof id !== 'string' || !id) return
  try { window.headlessRuntime.respond(id, { ok: true, value: await execute(request) }) }
  catch (error) { window.headlessRuntime.respond(id, { ok: false, message: message(error) }) }
})
window.headlessRuntime.ready()
