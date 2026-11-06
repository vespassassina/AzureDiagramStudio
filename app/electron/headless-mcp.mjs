import { mutationTools, outputTools, validateMutation, validateOutputOperation, validateWorkbookOperation, workbookTools } from './mcp-schema.mjs'
import { createReadStream } from 'node:fs'

const emptySchema = { type: 'object', properties: {}, additionalProperties: false }
const tools = [
  { name: 'get_document', inputSchema: emptySchema },
  { name: 'search_catalog', inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 200 }, limit: { type: 'integer', minimum: 1, maximum: 100 } }, required: ['query'], additionalProperties: false } },
  { name: 'list_templates', inputSchema: emptySchema },
  { name: 'get_app_info', inputSchema: emptySchema },
].concat(mutationTools, outputTools, workbookTools)
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)
const exact = (value, names) => record(value) && Object.keys(value).every(key => names.includes(key))
const validId = value => typeof value === 'string' || (typeof value === 'number' && Number.isSafeInteger(value))
const error = (id, code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
const result = (id, value) => ({ jsonrpc: '2.0', id, result: value })
const content = value => ({ content: [{ type: 'text', text: JSON.stringify(value) }] })

// Pseudocode: validate one bounded JSON-RPC frame, dispatch only the existing
// public MCP schema, serialize the reply as one line, and never write logs to
// stdout. One queue preserves state-token ordering across standard input.
async function dispatch(message, runtime, version) {
  const notification = record(message) && !Object.hasOwn(message, 'id')
  if (!exact(message, ['jsonrpc', 'id', 'method', 'params']) || message.jsonrpc !== '2.0' || typeof message.method !== 'string' ||
      (!notification && !validId(message.id)) || (message.params !== undefined && !record(message.params))) return error(null, -32600, 'Invalid Request')
  if (notification) return null
  const invalid = () => error(message.id, -32602, 'Invalid params')
  if (message.method === 'initialize') {
    const params = message.params
    if (!exact(params, ['protocolVersion', 'capabilities', 'clientInfo']) || typeof params.protocolVersion !== 'string' || !record(params.capabilities) ||
        !record(params.clientInfo) || typeof params.clientInfo.name !== 'string' || typeof params.clientInfo.version !== 'string') return invalid()
    return result(message.id, { protocolVersion: ['2025-06-18', '2025-03-26'].includes(params.protocolVersion) ? params.protocolVersion : '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'Azure Diagram Studio', version } })
  }
  if (message.method === 'ping') return message.params === undefined || (record(message.params) && !Object.keys(message.params).length) ? result(message.id, {}) : invalid()
  if (message.method === 'tools/list') return message.params === undefined || (record(message.params) && !Object.keys(message.params).length) ? result(message.id, { tools }) : invalid()
  if (message.method !== 'tools/call' || !exact(message.params, ['name', 'arguments']) || !tools.some(tool => tool.name === message.params.name)) return message.method === 'tools/call' ? invalid() : error(message.id, -32601, 'Method not found')
  const operation = { name: message.params.name, arguments: message.params.arguments }
  try {
    if (validateMutation(operation)) return result(message.id, content(await runtime.mutate(operation)))
    if (validateOutputOperation(operation)) return result(message.id, await runtime.output(operation))
    // DGM-151D: workbook tools share the worker session; exports return MCP content directly.
    if (validateWorkbookOperation(operation)) {
      const value = await runtime.workbook(operation)
      return result(message.id, operation.name === 'export_workbook' ? value : content(value))
    }
    const args = message.params.arguments ?? {}
    if (operation.name === 'get_document' && exact(args, [])) {
      // Legacy contract: active page document and its page-bound token only.
      const { document, stateToken } = await runtime.state()
      return result(message.id, content({ document, stateToken }))
    }
    if (operation.name === 'search_catalog' && exact(args, ['query', 'limit']) && typeof args.query === 'string' && args.query.length <= 200 &&
        (args.limit === undefined || Number.isInteger(args.limit) && args.limit >= 1 && args.limit <= 100)) {
      const catalog = await runtime.catalog(args.query)
      return result(message.id, content({ entries: catalog.entries.slice(0, args.limit ?? 25), total: catalog.total }))
    }
    if (operation.name === 'list_templates' && exact(args, [])) return result(message.id, content(await runtime.templates()))
    if (operation.name === 'get_app_info' && exact(args, [])) return result(message.id, content({ name: 'Azure Diagram Studio', version, readOnly: false }))
    return invalid()
  } catch (failure) {
    return result(message.id, { content: [{ type: 'text', text: failure instanceof Error ? failure.message : String(failure) }], isError: true })
  }
}

export async function runStdioMcp({ runtime, version, stop }) {
  const input = createReadStream(null, { fd: 0, autoClose: false })
  let closed = false, buffer = '', queued = Promise.resolve()
  let finish
  const completed = new Promise(resolve => { finish = resolve })
  const write = value => { if (!closed && value) process.stdout.write(`${JSON.stringify(value)}\n`) }
  const close = async code => {
    if (closed) return
    closed = true
    input.off('data', onData)
    input.off('end', onEnd)
    process.off('SIGINT', onInterrupt)
    await queued.catch(() => {})
    await stop()
    process.exitCode = code
    finish()
  }
  const accept = line => {
    if (Buffer.byteLength(line) > 64 * 1024) { write(error(null, -32600, 'Request exceeds 64 KiB')); return }
    queued = queued.then(async () => {
      let request
      try { request = JSON.parse(line) } catch { write(error(null, -32700, 'Parse error')); return }
      write(await dispatch(request, runtime, version))
    }).catch(() => write(error(null, -32603, 'Internal error')))
  }
  const onData = chunk => {
    buffer += chunk
    if (Buffer.byteLength(buffer) > 128 * 1024 && !buffer.includes('\n')) { buffer = ''; write(error(null, -32600, 'Request exceeds 64 KiB')); return }
    const lines = buffer.split(/\r?\n/)
    buffer = lines.pop()
    for (const line of lines) if (line) accept(line)
  }
  const onEnd = () => { void queued.finally(() => close(0)) }
  const onInterrupt = () => void close(0)
  input.setEncoding('utf8')
  input.on('data', onData)
  input.once('end', onEnd)
  process.once('SIGINT', onInterrupt)
  input.resume()
  await completed
}
