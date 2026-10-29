import { STUDIO_URL } from './policy.mjs'
import { randomUUID } from 'node:crypto'
import { validateMutation, validateOutputOperation } from './mcp-schema.mjs'
export const MAX_OUTPUT_BYTES = 8 * 1024 * 1024
const outputMime = { png: 'image/png', svg: 'image/svg+xml', json: 'application/json', markdown: 'text/markdown', zip: 'application/zip' }
const outputExact = (value, keys) => exact(value, keys) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

// Pseudocode: bound the entire bridge envelope, correlate token and format,
// require exact inert content shapes, independently decode bytes/signatures,
// and reject mismatched metadata, noncanonical base64 or unsafe filenames.
export function validateOutput(value, operation) {
  try {
    if (Buffer.byteLength(JSON.stringify({ ok: true, output: value })) > MAX_OUTPUT_BYTES ||
        !outputExact(value, ['content']) || !Array.isArray(value.content) || value.content.length !== 2) return false
    const [payload, metadata] = value.content
    if (!outputExact(metadata, ['type', 'text']) || metadata.type !== 'text' || typeof metadata.text !== 'string' || metadata.text.length > 1024) return false
    const meta = JSON.parse(metadata.text)
    const format = operation.name === 'snapshot_diagram' ? 'png' : operation.arguments.includeMarkdown ? 'zip' : operation.arguments.format
    const extension = format === 'markdown' ? 'md' : format
    if (!outputExact(meta, ['stateToken', 'mimeType', 'filename', 'byteLength']) || meta.stateToken !== operation.arguments.stateToken ||
        meta.mimeType !== outputMime[format] || typeof meta.filename !== 'string' || meta.filename.length > 90 ||
        !/^[a-zA-Z0-9_-]+\.[a-z]+$/.test(meta.filename) || !meta.filename.endsWith(`.${extension}`) ||
        /^(con|prn|aux|nul|com[1-9]|lpt[1-9])\./i.test(meta.filename) ||
        !Number.isSafeInteger(meta.byteLength) || meta.byteLength <= 0 || meta.byteLength > MAX_OUTPUT_BYTES) return false
    let bytes
    if (format === 'png') {
      if (!outputExact(payload, ['type', 'mimeType', 'data']) || payload.type !== 'image' || payload.mimeType !== outputMime.png) return false
      bytes = decodeOutput(payload.data)
    } else {
      if (!outputExact(payload, ['type', 'resource']) || payload.type !== 'resource') return false
      const resource = payload.resource, binary = format === 'zip'
      if (!outputExact(resource, ['uri', 'mimeType', binary ? 'blob' : 'text']) || resource.mimeType !== meta.mimeType ||
          resource.uri !== `diagrammer://exports/${encodeURIComponent(meta.stateToken)}/${meta.filename}`) return false
      if (binary) bytes = decodeOutput(resource.blob)
      else {
        if (typeof resource.text !== 'string') return false
        bytes = Buffer.from(resource.text, 'utf8')
        if (format === 'svg' && !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s/>]/.test(resource.text)) return false
        if (format === 'json' && !validDocument(JSON.parse(resource.text))) return false
        if (format === 'markdown') {
          const embedded = /!\[Diagram\]\(data:image\/png;base64,([A-Za-z0-9+/]+=*)\)\n$/.exec(resource.text)
          if (!embedded || !pngSignature(decodeOutput(embedded[1]))) return false
        }
      }
    }
    if (!bytes || bytes.length !== meta.byteLength) return false
    if (format === 'png' && !pngSignature(bytes)) return false
    if (format === 'zip' && !Buffer.from([80, 75, 3, 4]).equals(bytes.subarray(0, 4))) return false
    return true
  } catch { return false }
}
function pngSignature(bytes) { return !!bytes && Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).equals(bytes.subarray(0, 8)) }
function decodeOutput(text) {
  if (typeof text !== 'string' || text.length > MAX_OUTPUT_BYTES || text.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(text)) return undefined
  const bytes = Buffer.from(text, 'base64')
  return bytes.toString('base64') === text ? bytes : undefined
}

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

// A single in-flight operation avoids hidden reordering. IDs/deadlines belong to
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
    if (!validateMutation(operation) && !validateOutputOperation(operation)) return Promise.resolve({ ok: false, message: 'Invalid MCP arguments.' })
    if (pending) return Promise.resolve({ ok: false, message: 'Another MCP operation is in progress.' })
    if (signal?.aborted) return Promise.resolve({ ok: false, message: 'MCP client disconnected.' })
    return new Promise(resolve => {
      const id = randomUUID(), deadline = Date.now() + timeout
      const aborted = () => clear('MCP client disconnected.')
      const timer = setTimeout(() => clear('MCP operation timed out.'), timeout)
      pending = { id, deadline, operation, resolve, timer, removeAbort: () => signal?.removeEventListener('abort', aborted) }
      signal?.addEventListener('abort', aborted, { once: true })
      try { send({ id, deadline, operation }) }
      catch { clear('Renderer unavailable.') }
    })
  }
  function complete(id, result) {
    if (!pending || pending.id !== id || Date.now() >= pending.deadline) return false
    if (validateOutputOperation(pending.operation) && result.ok && (!exact(result, ['ok', 'output']) || !validateOutput(result.output, pending.operation))) return false
    if (validateMutation(pending.operation) && result.ok && !exact(result, ['ok', 'value'])) return false
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
      if (result.ok && !Object.hasOwn(result, 'output') && (!exact(result, ['ok', 'value']) || !exact(result.value, ['document', 'stateToken']) || !validDocument(result.value.document) ||
          Buffer.byteLength(JSON.stringify(result.value.document)) > MAX_DOCUMENT_BYTES || !string(result.value.stateToken, 200))) return false
      return broker.complete(id, result)
    } catch { return false }
  })
  const clear = () => { store.clear(); broker?.clear('Renderer unavailable or reloaded.') }
  for (const event of ['did-start-loading', 'render-process-gone', 'destroyed']) window.webContents.on(event, clear)
  window.webContents.on('did-fail-load', (_event, _code, _message, _url, isMainFrame) => { if (isMainFrame) clear() })
}
