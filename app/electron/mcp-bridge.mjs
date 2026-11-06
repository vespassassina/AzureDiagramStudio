import { STUDIO_URL } from './policy.mjs'
import { randomUUID } from 'node:crypto'
import { validateMutation, validateOutputOperation, validateWorkbookOperation } from './mcp-schema.mjs'
import { validMcpPort } from './mcp-port-settings.mjs'
export const MAX_OUTPUT_BYTES = 8 * 1024 * 1024
const outputMime = { png: 'image/png', svg: 'image/svg+xml', json: 'application/json', markdown: 'text/markdown', zip: 'application/zip', pdf: 'application/pdf', vsdx: 'application/vnd.ms-visio.drawing' }
const binaryFormats = new Set(['png', 'zip', 'pdf', 'vsdx'])
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
    const workbook = operation.name === 'export_workbook'
    const format = operation.name === 'snapshot_diagram' ? 'png' : operation.arguments.includeMarkdown ? 'zip' : operation.arguments.format
    const metaKeys = workbook ? ['stateToken', 'scope', 'ownerId', 'mimeType', 'filename', 'byteLength'] : ['stateToken', 'mimeType', 'filename', 'byteLength']
    const extension = format === 'markdown' ? 'md' : format
    if (!outputExact(meta, metaKeys) || meta.stateToken !== operation.arguments.stateToken ||
        (workbook && (meta.scope !== operation.arguments.scope || !string(meta.ownerId, 128) || (meta.scope === 'page' && meta.ownerId !== operation.arguments.pageId))) ||
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
      const resource = payload.resource, binary = binaryFormats.has(format)
      if (!outputExact(resource, ['uri', 'mimeType', binary ? 'blob' : 'text']) || resource.mimeType !== meta.mimeType ||
          resource.uri !== `diagrammer://exports/${encodeURIComponent(meta.stateToken)}/${meta.filename}`) return false
      if (binary) bytes = decodeOutput(resource.blob)
      else {
        if (typeof resource.text !== 'string') return false
        bytes = Buffer.from(resource.text, 'utf8')
        if (format === 'svg' && !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s/>]/.test(resource.text)) return false
        if (format === 'json' && !(workbook && operation.arguments.scope === 'workbook' ? validRoot(JSON.parse(resource.text)) : validDocument(JSON.parse(resource.text)))) return false
        if (format === 'markdown') {
          const embedded = /!\[Diagram\]\(data:image\/png;base64,([A-Za-z0-9+/]+=*)\)\n$/.exec(resource.text)
          if (!embedded || !pngSignature(decodeOutput(embedded[1]))) return false
        }
      }
    }
    if (!bytes || bytes.length !== meta.byteLength) return false
    if (format === 'png' && !pngSignature(bytes)) return false
    if ((format === 'zip' || format === 'vsdx') && !Buffer.from([80, 75, 3, 4]).equals(bytes.subarray(0, 4))) return false
    if (format === 'pdf' && bytes.subarray(0, 5).toString('latin1') !== '%PDF-') return false
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
const backgroundColor = value => typeof value === 'string' && (/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value) || value === 'transparent')
const normalizedGridColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
const stateStyleId = value => typeof value === 'string' && /^[A-Za-z][A-Za-z0-9_-]{0,63}$/.test(value)
const opaqueColor = value => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value)
const legacyStates = new Set(['live', 'planned', 'not-connected', 'synthetic'])
function validPaint(value, connector = false) {
  const keys = connector ? ['stroke', 'textColor', 'strokeWidth', 'lineStyle'] : ['fill', 'stroke', 'textColor', 'strokeWidth', 'lineStyle']
  return exact(value, keys) && Object.entries(value).every(([key, item]) =>
    ['fill', 'stroke', 'textColor'].includes(key) ? opaqueColor(item) :
      key === 'strokeWidth' ? finite(item) && item >= .5 && item <= 12 :
        key === 'lineStyle' ? ['solid', 'dashed', 'dotted'].includes(item) : false)
}
function validStateStyles(value) {
  if (!Array.isArray(value) || value.length > 64) return undefined
  const ids = new Set()
  for (const style of value) {
    if (!exact(style, ['id', 'name', 'meaning', 'box', 'connector']) || !stateStyleId(style.id) || ids.has(style.id) ||
        !string(style.name, 80) || !style.name || style.name.trim() !== style.name || !string(style.meaning, 1000) ||
        (style.box !== undefined && !validPaint(style.box)) || (style.connector !== undefined && !validPaint(style.connector, true))) return undefined
    ids.add(style.id)
  }
  return ids
}

// The renderer runs the existing full domain validator. At the IPC boundary
// independently require the known JSON shape and bounded sizes; retain parsed,
// private JSON only, never references, hooks, paths or executable operations.
export function validDocument(value) {
  if (!exact(value, ['schemaVersion', 'id', 'title', 'subtitle', 'description', 'backgroundColor', 'grid', 'stateStyles', 'synthetic', 'legendVisible', 'legend', 'revision', 'direction', 'entities', 'connections']) ||
      ![1, 2].includes(value.schemaVersion) || !string(value.id) || !string(value.title) || !string(value.subtitle) ||
      (value.description !== undefined && !string(value.description, MAX_DOCUMENT_BYTES)) ||
      (value.backgroundColor !== undefined && !backgroundColor(value.backgroundColor)) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || !['RIGHT', 'DOWN'].includes(value.direction) ||
      typeof value.synthetic !== 'boolean' || typeof value.legendVisible !== 'boolean' ||
      !Array.isArray(value.entities) || value.entities.length > 10000 || !Array.isArray(value.connections) || value.connections.length > 20000 ||
      !Array.isArray(value.legend) || value.legend.length > 1000 ||
      (value.stateStyles !== undefined && value.schemaVersion !== 2)) return false
  const stateIds = value.stateStyles === undefined ? legacyStates : validStateStyles(value.stateStyles)
  if (!stateIds) return false
  if (value.grid !== undefined && (!exact(value.grid, ['visible', 'style', 'spacing', 'snap', 'present', 'export', 'color']) ||
      !['dots', 'lines'].includes(value.grid.style) || !finite(value.grid.spacing) ||
      !['visible', 'snap', 'present', 'export'].every(key => typeof value.grid[key] === 'boolean') ||
      (value.grid.color !== undefined && (!normalizedGridColor(value.grid.color) || value.schemaVersion !== 2)))) return false
  if (!value.legend.every(item => exact(item, ['label', 'color', 'dashed']) && string(item.label) && string(item.color) && (item.dashed === undefined || typeof item.dashed === 'boolean'))) return false
  if (!value.entities.every(item => exact(item, ['id', 'kind', 'label', 'subtitle', 'parentId', 'layer', 'order', 'x', 'y', 'width', 'height', 'color', 'icon', 'customIcon', 'status']) &&
      string(item.id) && ['component', 'boundary', 'text', 'rectangle'].includes(item.kind) && string(item.label) && string(item.color) &&
      ['x', 'y', 'width', 'height'].every(key => finite(item[key])) &&
      ['subtitle', 'icon', 'status', 'layer'].every(key => item[key] === undefined || string(item[key])) &&
      (item.parentId === undefined || item.parentId === null || string(item.parentId)) &&
      (item.order === undefined || finite(item.order)) &&
      (item.status === undefined || (value.schemaVersion === 1 ? legacyStates.has(item.status) : stateIds.has(item.status))) &&
      (item.customIcon === undefined || (exact(item.customIcon, ['name', 'dataUrl', 'width', 'height']) &&
        string(item.customIcon.name) && string(item.customIcon.dataUrl, MAX_DOCUMENT_BYTES) && item.customIcon.dataUrl.startsWith('data:image/png;base64,') &&
        finite(item.customIcon.width) && finite(item.customIcon.height))))) return false
  const entityIds = new Set(value.entities.map(item => item.id))
  if (entityIds.size !== value.entities.length) return false
  return value.connections.every(item => exact(item, ['id', 'from', 'to', 'label', 'style', 'arrow', 'sourceSide', 'targetSide', 'sourceOffset', 'targetOffset', 'routeRevision', 'labelPosition', 'points', 'status']) &&
    // DGM-155 exact anchors are schema-v2 normalized offsets.
    ['sourceOffset', 'targetOffset'].every(key => item[key] === undefined || (value.schemaVersion === 2 && finite(item[key]) && item[key] >= 0 && item[key] <= 1)) &&
    ['id', 'from', 'to', 'label'].every(key => string(item[key])) && ['solid', 'dashed'].includes(item.style) &&
    entityIds.has(item.from) && entityIds.has(item.to) && item.from !== item.to &&
    ['forward', 'both', 'none'].includes(item.arrow) && ['sourceSide', 'targetSide'].every(key => item[key] === undefined || ['auto', 'top', 'right', 'bottom', 'left'].includes(item[key])) &&
    (item.status === undefined || (value.schemaVersion === 2 && stateIds.has(item.status))) &&
    (item.routeRevision === undefined || Number.isSafeInteger(item.routeRevision)) && (item.labelPosition === undefined || point(item.labelPosition)) &&
    (item.points === undefined || (Array.isArray(item.points) && item.points.length <= 10000 && item.points.every(point))))
}

// DGM-151D: a full workspace root. A legacy Diagram root stays valid; a
// workbook must carry 1..100 independently valid pages with unique IDs.
function validRoot(value) {
  if (!record(value) || !Object.hasOwn(value, 'kind')) return validDocument(value)
  if (!exact(value, ['kind', 'schemaVersion', 'id', 'title', 'description', 'revision', 'pages']) || value.kind !== 'workbook' || value.schemaVersion !== 1 ||
      !string(value.id, 128) || !string(value.title, 120) || (value.description !== undefined && !string(value.description, 60000)) ||
      !Number.isSafeInteger(value.revision) || value.revision < 0 || !Array.isArray(value.pages) || value.pages.length < 1 || value.pages.length > 100) return false
  const ids = new Set(value.pages.map(page => page?.id))
  return ids.size === value.pages.length && value.pages.every(page => validDocument(page) && Buffer.byteLength(JSON.stringify(page)) <= MAX_DOCUMENT_BYTES)
}
const validDocumentState = value => exact(value, ['document', 'stateToken']) && validDocument(value.document) &&
  Buffer.byteLength(JSON.stringify(value.document)) <= MAX_DOCUMENT_BYTES && string(value.stateToken, 200)
const workbookToken = value => string(value, 200) && value.length > 0
function validWorkbookState(value) {
  return exact(value, ['kind', 'id', 'title', 'description', 'revision', 'activePageId', 'stateToken', 'pages']) &&
    ['diagram', 'workbook'].includes(value.kind) && string(value.id, 128) && string(value.title) && (value.description === undefined || string(value.description, 60000)) &&
    Number.isSafeInteger(value.revision) && value.revision >= 0 && string(value.activePageId, 128) && workbookToken(value.stateToken) &&
    Array.isArray(value.pages) && value.pages.length >= 1 && value.pages.length <= 100 &&
    value.pages.every(page => exact(page, ['id', 'title', 'stateToken']) && string(page.id, 128) && string(page.title) && workbookToken(page.stateToken)) &&
    value.pages.some(page => page.id === value.activePageId)
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
export function createMutationBroker({ send, cancel = () => {}, timeout }) {
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
    if (!validateMutation(operation) && !validateOutputOperation(operation) && !validateWorkbookOperation(operation)) return Promise.resolve({ ok: false, message: 'Invalid MCP arguments.' })
    if (pending) return Promise.resolve({ ok: false, message: 'Another MCP operation is in progress.' })
    if (signal?.aborted) return Promise.resolve({ ok: false, message: 'MCP client disconnected.' })
    return new Promise(resolve => {
      // Whole-workbook rendering (PDF/Visio/ZIP) shares the arrange budget.
      const budget = timeout === undefined ? operation.name === 'arrange_diagram' || operation.name === 'export_workbook' ? 15_000 : 4_000 : timeout
      const id = randomUUID(), deadline = Date.now() + budget
      const aborted = () => clear('MCP client disconnected.')
      const timer = setTimeout(() => clear('MCP operation timed out.'), budget)
      pending = { id, deadline, operation, resolve, timer, removeAbort: () => signal?.removeEventListener('abort', aborted) }
      signal?.addEventListener('abort', aborted, { once: true })
      try { send({ id, deadline, operation }) }
      catch { clear('Renderer unavailable.') }
    })
  }
  function complete(id, result) {
    if (!pending || pending.id !== id || Date.now() >= pending.deadline) return false
    if (validateOutputOperation(pending.operation) && result.ok && (!exact(result, ['ok', 'output']) || !validateOutput(result.output, pending.operation))) return false
    if (validateMutation(pending.operation) && result.ok && (!exact(result, ['ok', 'value']) || !validDocumentState(result.value))) return false
    if (validateWorkbookOperation(pending.operation) && result.ok && (pending.operation.name === 'export_workbook'
      ? !exact(result, ['ok', 'output']) || !validateOutput(result.output, pending.operation)
      : !exact(result, ['ok', 'value']) || !validWorkbookState(result.value))) return false
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

export function registerMcpBridge({ ipcMain, clipboard, window, server, store, broker, settings }) {
  function handle(channel, action) {
    ipcMain.handle(channel, (event, ...args) => {
      if (!trustedSender(window, event)) throw new Error('Untrusted MCP bridge sender')
      return action(...args)
    })
  }
  handle('mcp:status', () => server.status())
  function copyAddress() {
    if (server.status().state !== 'running') return { ok: false, message: 'Local MCP server is unavailable.' }
    try { clipboard.writeText(server.status().address); return { ok: true } }
    catch { return { ok: false, message: 'Clipboard copy failed. Try again.' } }
  }
  handle('mcp:read-port', () => settings.readPort())
  handle('mcp:save-port', port => {
    if (!validMcpPort(port)) throw new Error('Invalid MCP port.')
    return settings.savePort(port)
  })
  handle('mcp:copy-address', copyAddress)
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
      // Per-operation result shapes are validated by broker.complete against the pending request.
      return broker.complete(id, result)
    } catch { return false }
  })
  const clear = () => { store.clear(); broker?.clear('Renderer unavailable or reloaded.') }
  for (const event of ['did-start-loading', 'render-process-gone', 'destroyed']) window.webContents.on(event, clear)
  window.webContents.on('did-fail-load', (_event, _code, _message, _url, isMainFrame) => { if (isMainFrame) clear() })
}
