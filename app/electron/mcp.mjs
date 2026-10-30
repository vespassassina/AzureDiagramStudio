import { createServer } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { mutationTools, validateMutation, outputTools, validateOutputOperation } from './mcp-schema.mjs'

export const DEFAULT_MCP_PORT = 37431
export const MCP_VERSIONS = Object.freeze(['2025-06-18', '2025-03-26'])
const MAX_BODY_BYTES = 64 * 1024
const MAX_IN_FLIGHT = 8
const REQUEST_TIMEOUT_MS = 5000
const ARRANGE_TIMEOUT_MS = 15000
const emptySchema = { type: 'object', properties: {}, additionalProperties: false }
const tools = [
  { name: 'get_document', description: 'Read the current committed diagram (not unfinished editor drafts).', inputSchema: emptySchema },
  { name: 'search_catalog', description: 'Search the existing selectable component catalog by label, category, aliases and keywords.', inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 200 }, limit: { type: 'integer', minimum: 1, maximum: 100, default: 25 } }, required: ['query'], additionalProperties: false } },
  { name: 'list_templates', description: 'List the existing starting diagram identities without opening or modifying them.', inputSchema: emptySchema },
  { name: 'get_app_info', description: 'Read the running desktop app version and read-only access scope.', inputSchema: emptySchema },
].map(tool => ({ ...tool, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } })).concat(mutationTools, outputTools)
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value, allowed) => record(value) && Object.keys(value).every(key => allowed.includes(key))
const empty = value => value === undefined || (record(value) && Object.keys(value).length === 0)
const failure = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
const content = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] })

// Pseudocode: validate the RPC envelope and each method's parameters before
// reading a single immutable store snapshot. Notifications never get RPC replies.
async function dispatch(message, store, version, mutate, signal, beginArrangement) {
  const validId = typeof message?.id === 'string' || (typeof message?.id === 'number' && Number.isSafeInteger(message.id))
  const notification = record(message) && !Object.hasOwn(message, 'id')
  if (!exact(message, ['jsonrpc', 'id', 'method', 'params']) || message.jsonrpc !== '2.0' ||
      typeof message.method !== 'string' || (!notification && !validId) ||
      (message.params !== undefined && !record(message.params))) return failure(null, -32600, 'Invalid Request')
  if (notification) return null
  const { id, method, params } = message
  const invalid = () => failure(id, -32602, 'Invalid params')
  const result = value => ({ jsonrpc: '2.0', id, result: value })
  if (method === 'initialize') {
    if (!exact(params, ['protocolVersion', 'capabilities', 'clientInfo']) || typeof params.protocolVersion !== 'string' ||
        !record(params.capabilities) || !record(params.clientInfo) || typeof params.clientInfo.name !== 'string' ||
        typeof params.clientInfo.version !== 'string') return invalid()
    return result({ protocolVersion: MCP_VERSIONS.includes(params.protocolVersion) ? params.protocolVersion : MCP_VERSIONS[0], capabilities: { tools: {} }, serverInfo: { name: 'Azure Diagram Studio', version } })
  }
  if (method === 'ping') return empty(params) ? result({}) : invalid()
  if (method === 'tools/list') return empty(params) ? result({ tools }) : invalid()
  if (method !== 'tools/call') return failure(id, -32601, 'Method not found')
  if (!exact(params, ['name', 'arguments']) || !tools.some(tool => tool.name === params.name)) return invalid()
  if ([...mutationTools, ...outputTools].some(tool => tool.name === params.name)) {
    if (!validateMutation(params) && !validateOutputOperation(params)) return invalid()
    if (!store.available() || !mutate) return result({ content: [{ type: 'text', text: 'Current workspace is unavailable.' }], isError: true })
    if (params.name === 'arrange_diagram') beginArrangement()
    const outcome = await mutate(params, signal)
    return outcome.ok ? result(outcome.output ?? content(outcome.value)) : result({ content: [{ type: 'text', text: outcome.message }], isError: true })
  }
  const args = params.arguments === undefined ? {} : params.arguments
  if (params.name === 'search_catalog') {
    if (!exact(args, ['query', 'limit']) || typeof args.query !== 'string' || args.query.length > 200 ||
        (args.limit !== undefined && (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100))) return invalid()
  } else if (!empty(args)) return invalid()
  if (params.name === 'get_app_info') return result(content({ name: 'Azure Diagram Studio', version, readOnly: false }))
  const snapshot = store.get()
  if (!snapshot) return result({ content: [{ type: 'text', text: 'Current workspace is unavailable. Wait for recovery or reload the desktop app.' }], isError: true })
  if (params.name === 'get_document') return result(content({ document: snapshot.document, stateToken: snapshot.stateToken }))
  if (params.name === 'list_templates') return result(content({ templates: snapshot.templates }))
  const query = args.query.trim().toLocaleLowerCase('en')
  const entries = snapshot.catalog.filter(item => [item.label, item.subtitle, item.category, item.catalog, ...item.aliases, ...item.keywords].join('\n').toLocaleLowerCase('en').includes(query))
  return result(content({ entries: entries.slice(0, args.limit ?? 25), total: entries.length }))
}

// Pseudocode: own one loopback listener and secret for this launch; authenticate
// before routing; reject browser origins and rebinding; bound reads/work/time;
// dispatch a stateless JSON response; on stop destroy pending sockets promptly.
export function createMcpServer({ version, store, mutate, port = DEFAULT_MCP_PORT, log = console.error }) {
  const token = randomBytes(32).toString('hex')
  const expectedAuth = Buffer.from(`Bearer ${token}`)
  let state = 'unavailable', address, server, starting, inFlight = 0
  const sockets = new Set()
  function status() { return { state, ...(address ? { address } : {}), snapshotAvailable: store.available(), ...(state === 'error' ? { message: 'Local MCP server could not start. Restart the app to retry.' } : {}) } }
  function respond(response, statusCode, body) {
    response.writeHead(statusCode, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...(statusCode === 405 ? { allow: 'POST' } : {}) })
    response.end(body === undefined ? undefined : JSON.stringify(body))
  }
  async function handle(request, response) {
    const auth = Buffer.from(request.headers.authorization ?? '')
    if (auth.length !== expectedAuth.length || !timingSafeEqual(auth, expectedAuth)) { respond(response, 401, { error: 'Bearer authorization required' }); return }
    if (request.headers.host !== new URL(address).host || request.headers.origin !== undefined || request.headers['sec-fetch-site'] === 'cross-site') { respond(response, 403, { error: 'Local non-browser clients only' }); return }
    if (request.url !== '/mcp') { respond(response, 404, { error: 'Not found' }); return }
    if (request.method !== 'POST') { respond(response, 405, { error: 'Use POST; server push is not supported' }); return }
    if (!/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(request.headers['content-type'] ?? '')) { respond(response, 415, { error: 'application/json required' }); return }
    const accept = (request.headers.accept ?? '').split(',').map(value => value.trim().split(';')[0])
    if (!accept.includes('application/json') || !accept.includes('text/event-stream')) { respond(response, 406, { error: 'Accept application/json and text/event-stream' }); return }
    if (request.headers['mcp-protocol-version'] !== undefined && !MCP_VERSIONS.includes(request.headers['mcp-protocol-version'])) { respond(response, 400, { error: 'Unsupported MCP protocol version' }); return }
    if (Number(request.headers['content-length'] ?? 0) > MAX_BODY_BYTES) { respond(response, 413, { error: 'Request body exceeds 64 KiB' }); return }
    if (inFlight >= MAX_IN_FLIGHT) { respond(response, 429, { error: 'Too many requests' }); return }
    inFlight++
    const controller = new AbortController()
    response.once('close', () => { if (!response.writableEnded) controller.abort() })
    let timer, arrangement
    const expire = () => { controller.abort(); if (!response.writableEnded) respond(response, 408, { error: 'Request timed out' }); request.destroy() }
    const armTimeout = timeout => { clearTimeout(timer); timer = setTimeout(expire, timeout) }
    const beginArrangement = () => {
      arrangement = true
      request.socket.setTimeout(ARRANGE_TIMEOUT_MS)
      armTimeout(ARRANGE_TIMEOUT_MS)
    }
    armTimeout(REQUEST_TIMEOUT_MS)
    try {
      let bytes = 0
      const chunks = []
      for await (const chunk of request) {
        bytes += chunk.length
        if (bytes > MAX_BODY_BYTES) { respond(response, 413, { error: 'Request body exceeds 64 KiB' }); return }
        chunks.push(chunk)
      }
      let message
      try { message = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { respond(response, 200, failure(null, -32700, 'Parse error')); return }
      const reply = await dispatch(message, store, version, mutate, controller.signal, beginArrangement)
      if (!response.writableEnded && !response.destroyed) respond(response, reply ? 200 : 202, reply ?? undefined)
    } catch {
      if (!response.writableEnded && !response.destroyed) respond(response, 400, { error: 'Request interrupted' })
    } finally {
      clearTimeout(timer)
      if (arrangement && !request.socket.destroyed) request.socket.setTimeout(REQUEST_TIMEOUT_MS)
      inFlight--
    }
  }
  async function listen(listenPort) {
    await new Promise((resolve, reject) => {
      const error = failure => { server.off('listening', ready); reject(failure) }
      const ready = () => { server.off('error', error); resolve() }
      server.once('error', error); server.once('listening', ready)
      server.listen(listenPort, '127.0.0.1')
    })
  }
  async function start() {
    if (state === 'running') return
    if (starting) return starting
    starting = (async () => {
      server = createServer({ maxHeaderSize: 8192, headersTimeout: REQUEST_TIMEOUT_MS, requestTimeout: REQUEST_TIMEOUT_MS, keepAliveTimeout: 1000 }, (request, response) => void handle(request, response))
      server.maxConnections = 32
      server.on('connection', socket => { sockets.add(socket); socket.once('close', () => sockets.delete(socket)); socket.setTimeout(REQUEST_TIMEOUT_MS, () => socket.destroy()) })
      try {
        try { await listen(port) } catch (error) { if (error.code !== 'EADDRINUSE') throw error; await listen(0) }
        address = `http://127.0.0.1:${server.address().port}/mcp`
        state = 'running'
        server.on('error', () => { state = 'error'; address = undefined; store.clear(); log('Local MCP server failed', { code: 'listener-error' }) })
      } catch {
        state = 'error'; address = undefined
        log('Local MCP server failed', { code: 'listen-failed' })
      }
    })()
    try { await starting } finally { starting = undefined }
  }
  async function stop() {
    if (starting) await starting
    state = 'unavailable'; address = undefined; store.clear()
    for (const socket of sockets) socket.destroy()
    if (server?.listening) await new Promise(resolve => server.close(resolve))
  }
  return { start, stop, status, accessToken: () => token }
}
