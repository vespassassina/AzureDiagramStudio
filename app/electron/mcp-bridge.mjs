import { STUDIO_URL } from './policy.mjs'
import { randomUUID } from 'node:crypto'
import { validateMutation } from './mcp-schema.mjs'

const MAX_SNAPSHOT_BYTES = 8 * 1024 * 1024
const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const string = (value, max = 4096) => typeof value === 'string' && value.length <= max
const strings = value => Array.isArray(value) && value.length <= 100 && value.every(item => string(item))
const exact = (value, keys) => record(value) && Object.keys(value).every(key => keys.includes(key))
const finite = value => typeof value === 'number' && Number.isFinite(value)
const point = value => exact(value, ['x', 'y']) && finite(value.x) && finite(value.y)

// The renderer runs the existing full domain validator. At the IPC boundary
// independently require the known JSON shape and bounded sizes; retain parsed,
// private JSON only, never references, hooks, paths or executable operations.
function validDocument(value) {
  if (!exact(value, ['schemaVersion', 'id', 'title', 'subtitle', 'description', 'backgroundColor', 'grid', 'synthetic', 'legendVisible', 'legend', 'revision', 'direction', 'entities', 'connections']) ||
      value.schemaVersion !== 1 || !string(value.id) || !string(value.title) || !string(value.subtitle) ||
      (value.description !== undefined && !string(value.description, MAX_DOCUMENT_BYTES)) ||
      (value.backgroundColor !== undefined && !string(value.backgroundColor, 100)) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || !['RIGHT', 'DOWN'].includes(value.direction) ||
      typeof value.synthetic !== 'boolean' || typeof value.legendVisible !== 'boolean' ||
      !Array.isArray(value.entities) || value.entities.length > 10000 || !Array.isArray(value.connections) || value.connections.length > 20000 ||
      !Array.isArray(value.legend) || value.legend.length > 1000) return false
  if (value.grid !== undefined && (!exact(value.grid, ['visible', 'style', 'spacing', 'snap', 'present', 'export']) ||
      !['dots', 'lines'].includes(value.grid.style) || !finite(value.grid.spacing) ||
      !['visible', 'snap', 'present', 'export'].every(key => typeof value.grid[key] === 'boolean'))) return false
  if (!value.legend.every(item => exact(item, ['label', 'color', 'dashed']) && string(item.label) && string(item.color) && (item.dashed === undefined || typeof item.dashed === 'boolean'))) return false
  if (!value.entities.every(item => exact(item, ['id', 'kind', 'label', 'subtitle', 'parentId', 'layer', 'order', 'x', 'y', 'width', 'height', 'color', 'icon', 'customIcon', 'status']) &&
      string(item.id) && ['component', 'boundary', 'text', 'rectangle'].includes(item.kind) && string(item.label) && string(item.color) &&
      ['x', 'y', 'width', 'height'].every(key => finite(item[key])) &&
      ['subtitle', 'icon', 'status', 'layer'].every(key => item[key] === undefined || string(item[key])) &&
      (item.parentId === undefined || item.parentId === null || string(item.parentId)) &&
      (item.order === undefined || finite(item.order)) &&
      (item.customIcon === undefined || (exact(item.customIcon, ['name', 'dataUrl', 'width', 'height']) &&
        string(item.customIcon.name) && string(item.customIcon.dataUrl, MAX_DOCUMENT_BYTES) && item.customIcon.dataUrl.startsWith('data:image/png;base64,') &&
        finite(item.customIcon.width) && finite(item.customIcon.height))))) return false
  return value.connections.every(item => exact(item, ['id', 'from', 'to', 'label', 'style', 'arrow', 'sourceSide', 'targetSide', 'routeRevision', 'labelPosition', 'points']) &&
    ['id', 'from', 'to', 'label'].every(key => string(item[key])) && ['solid', 'dashed'].includes(item.style) &&
    ['forward', 'both', 'none'].includes(item.arrow) && ['sourceSide', 'targetSide'].every(key => item[key] === undefined || ['auto', 'top', 'right', 'bottom', 'left'].includes(item[key])) &&
    (item.routeRevision === undefined || Number.isSafeInteger(item.routeRevision)) && (item.labelPosition === undefined || point(item.labelPosition)) &&
    (item.points === undefined || (Array.isArray(item.points) && item.points.length <= 10000 && item.points.every(point))))
}

export function createSnapshotStore() {
  let document, stateToken, catalog, templates
  const clear = () => { document = undefined; stateToken = undefined; catalog = undefined; templates = undefined }
  function publish(text) {
    if (text === null) { clear(); return }
    try {
      if (typeof text !== 'string' || text.length > MAX_SNAPSHOT_BYTES || Buffer.byteLength(text) > MAX_SNAPSHOT_BYTES) throw new Error('Invalid snapshot size')
      const value = JSON.parse(text)
      if (!exact(value, ['document', 'stateToken', 'catalog', 'templates']) || !string(value.stateToken, 200) || !value.stateToken ||
          !validDocument(value.document) || Buffer.byteLength(JSON.stringify(value.document)) > MAX_DOCUMENT_BYTES) throw new Error('Invalid document snapshot')
      if ((value.catalog === undefined) !== (value.templates === undefined)) throw new Error('Incomplete metadata')
      if (value.catalog !== undefined) {
        if (!Array.isArray(value.catalog) || value.catalog.length > 5000 || !value.catalog.every(item =>
          exact(item, ['icon', 'label', 'subtitle', 'category', 'catalog', 'aliases', 'keywords']) &&
          ['icon', 'label', 'subtitle', 'category', 'catalog'].every(key => string(item[key])) &&
          strings(item.aliases) && strings(item.keywords))) throw new Error('Invalid catalog')
        if (!Array.isArray(value.templates) || value.templates.length > 100 || !value.templates.every(item =>
          exact(item, ['key', 'label', 'sourceCue', 'reference']) && ['key', 'label', 'sourceCue'].every(key => string(item[key])) &&
          (item.reference === undefined || string(item.reference)))) throw new Error('Invalid templates')
        catalog = value.catalog; templates = value.templates
      }
      if (!catalog || !templates) throw new Error('Metadata unavailable')
      document = value.document
      stateToken = value.stateToken
    } catch (error) { clear(); throw error }
  }
  return { publish, clear, available: () => !!document && !!catalog && !!templates, get: () => document && catalog && templates ? { document, stateToken, catalog, templates } : undefined }
}

// A single in-flight mutation avoids hidden reordering. IDs/deadlines belong to
// main, are invalidated on unload and never accepted after expiry/cancellation.
export function createMutationBroker({ send, cancel = () => {}, timeout = 4000 }) {
  let pending
  function clear(message = 'Workspace unavailable.') {
    if (!pending) return
    const request = pending
    pending = undefined
    clearTimeout(request.timer)
    request.removeAbort()
    try { cancel(request.id) } catch { /* The renderer may already be destroyed. */ }
    request.resolve({ ok: false, message })
  }
  function request(operation, signal) {
    if (!validateMutation(operation)) return Promise.resolve({ ok: false, message: 'Invalid mutation arguments.' })
    if (pending) return Promise.resolve({ ok: false, message: 'Another MCP mutation is in progress.' })
    if (signal?.aborted) return Promise.resolve({ ok: false, message: 'MCP client disconnected.' })
    return new Promise(resolve => {
      const id = randomUUID(), deadline = Date.now() + timeout
      const aborted = () => clear('MCP client disconnected.')
      const timer = setTimeout(() => clear('MCP mutation timed out.'), timeout)
      pending = { id, deadline, resolve, timer, removeAbort: () => signal?.removeEventListener('abort', aborted) }
      signal?.addEventListener('abort', aborted, { once: true })
      try { send({ id, deadline, operation }) }
      catch { clear('Renderer unavailable.') }
    })
  }
  function complete(id, result) {
    if (!pending || pending.id !== id || Date.now() >= pending.deadline) return false
    const request = pending
    pending = undefined
    clearTimeout(request.timer); request.removeAbort()
    request.resolve(result)
    return true
  }
  return { request, complete, clear, active: id => pending?.id === id && Date.now() < pending.deadline }
}

// Pseudocode: compare identities, destruction state and exact trusted URLs;
// recheck identities after property access so replaced/detached frames fail shut.
export function trustedSender(window, event) {
  try {
    const contents = window.webContents, frame = contents.mainFrame
    return event.sender === contents && event.senderFrame === frame &&
      window.isDestroyed() === false && contents.isDestroyed() === false &&
      frame.isDestroyed() === false && frame.detached === false &&
      contents.getURL() === STUDIO_URL && frame.url === STUDIO_URL &&
      window.webContents === contents && contents.mainFrame === frame &&
      window.isDestroyed() === false && contents.isDestroyed() === false &&
      frame.isDestroyed() === false && frame.detached === false
  } catch { return false }
}

export function registerMcpBridge({ ipcMain, clipboard, window, server, store, broker }) {
  function handle(channel, action) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trustedSender(window, event)) throw new Error('Untrusted MCP bridge sender')
      return action(...args)
    })
  }
  handle('mcp:status', () => server.status())
  function copy(kind) {
    if (server.status().state !== 'running') return { ok: false, message: 'Local MCP server is unavailable.' }
    try { clipboard.writeText(kind === 'address' ? server.status().address : server.accessToken()); return { ok: true } }
    catch { return { ok: false, message: 'Clipboard copy failed. Try again.' } }
  }
  handle('mcp:copy-address', () => copy('address'))
  handle('mcp:copy-token', () => copy('token'))
  handle('mcp:publish', text => {
    try { store.publish(text); return { ok: true } }
    catch { return { ok: false, message: 'Workspace snapshot unavailable.' } }
  })
  handle('mcp:mutation-active', id => typeof id === 'string' && broker?.active(id) === true)
  handle('mcp:mutation-result', (id, text) => {
    if (!broker || typeof id !== 'string' || typeof text !== 'string' || text.length > MAX_SNAPSHOT_BYTES || Buffer.byteLength(text) > MAX_SNAPSHOT_BYTES) return false
    try {
      const result = JSON.parse(text)
      if (!record(result) || typeof result.ok !== 'boolean') return false
      if (!result.ok && (!exact(result, ['ok', 'message']) || !string(result.message))) return false
      if (result.ok && (!exact(result, ['ok', 'value']) || !exact(result.value, ['document', 'stateToken']) || !validDocument(result.value.document) ||
          Buffer.byteLength(JSON.stringify(result.value.document)) > MAX_DOCUMENT_BYTES || !string(result.value.stateToken, 200))) return false
      return broker.complete(id, result)
    } catch { return false }
  })
  const clear = () => { store.clear(); broker?.clear('Renderer unavailable or reloaded.') }
  for (const event of ['did-start-loading', 'render-process-gone', 'destroyed']) window.webContents.on(event, clear)
  window.webContents.on('did-fail-load', (_event, _code, _message, _url, isMainFrame) => { if (isMainFrame) clear() })
}
