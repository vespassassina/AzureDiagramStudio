import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createServer, request as httpRequest } from 'node:http'
import { createMcpServer, DEFAULT_MCP_PORT } from '../mcp.mjs'
import { createSnapshotStore, createMutationBroker, registerMcpBridge, trustedSender } from '../mcp-bridge.mjs'

const document = { schemaVersion: 1, id: 'test', title: 'Committed', subtitle: '', revision: 3, direction: 'RIGHT', synthetic: false, legendVisible: true, legend: [], entities: [], connections: [] }
const metadata = { catalog: [{ icon: 'service', label: 'Service', subtitle: '', category: 'Software', catalog: 'software', aliases: ['app'], keywords: [] }], templates: [{ key: 'web-api', label: 'Web/API', sourceCue: 'Synthetic example' }] }
const snapshot = () => ({ document, stateToken: 'test:3', ...metadata })
const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) })

async function fixture(t, options = {}) {
  const store = createSnapshotStore()
  store.publish(JSON.stringify(snapshot()))
  const server = createMcpServer({ version: '0.3.0', store, port: 0, ...options })
  await server.start()
  t.after(() => server.stop())
  const address = server.status().address
  const request = (body, headers = {}, method = 'POST') => fetch(address, {
    method, headers: { authorization: `Bearer ${server.accessToken()}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', ...headers },
    ...(method === 'POST' ? { body: typeof body === 'string' ? body : JSON.stringify(body) } : {}),
  })
  return { server, store, request }
}

test('should_serve_real_stateless_MCP_versions_and_all_discovery_tools', async t => {
  const { request } = await fixture(t)
  for (const protocolVersion of ['2025-06-18', '2025-03-26', 'future']) {
    const response = await request(rpc('initialize', { protocolVersion, capabilities: {}, clientInfo: { name: 'test', version: '1' } }))
    const body = await response.json()
    assert.equal(body.result.protocolVersion, protocolVersion === 'future' ? '2025-06-18' : protocolVersion)
    assert.deepEqual(body.result.capabilities, { tools: {} })
    assert.equal(body.result.serverInfo.version, '0.3.0')
    assert.equal(response.headers.get('mcp-session-id'), null)
  }
  assert.equal((await request({ jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202)
  assert.deepEqual((await (await request(rpc('ping'))).json()).result, {})
  const tools = (await (await request(rpc('tools/list'))).json()).result.tools
  assert.deepEqual(tools.map(tool => tool.name), ['get_document', 'search_catalog', 'list_templates', 'get_app_info', 'create_diagram', 'edit_diagram', 'arrange_diagram', 'undo', 'redo', 'snapshot_diagram', 'export_diagram'])
  for (const tool of tools) {
    assert.equal(tool.inputSchema.type, 'object')
    assert.equal(tool.inputSchema.additionalProperties, false)
    for (const schema of tool.inputSchema.oneOf ?? [tool.inputSchema]) {
      assert.equal(schema.type, 'object')
      assert.equal(schema.additionalProperties, false)
    }
    assert.equal(tool.annotations.readOnlyHint, tools.indexOf(tool) < 4 || tools.indexOf(tool) >= 9)
  }
  for (const [name, args, expected] of [
    ['get_document', {}, { document, stateToken: 'test:3' }],
    ['search_catalog', { query: 'app' }, { entries: metadata.catalog, total: 1 }],
    ['list_templates', {}, { templates: metadata.templates }],
    ['get_app_info', {}, { name: 'Azure Diagram Studio', version: '0.3.0', readOnly: false }],
  ]) {
    const body = await (await request(rpc('tools/call', { name, arguments: args }))).json()
    assert.deepEqual(JSON.parse(body.result.content[0].text), expected)
  }
})

test('should_accept_optional_stacked_arrangement_and_reject_unknown_modes_DGM137', async t => {
  const operations = []
  const { request } = await fixture(t, { mutate: async operation => {
    operations.push(operation)
    return { ok: true, value: { document, stateToken: 'next' } }
  } })
  for (const direction of ['RIGHT', 'DOWN']) for (const arrangement of [undefined, 'standard', 'stacked']) {
    const args = { stateToken: 'test:3', direction, ...(arrangement ? { arrangement } : {}) }
    const response = await (await request(rpc('tools/call', { name: 'arrange_diagram', arguments: args }))).json()
    assert.ok(!response.error && !response.result.isError, JSON.stringify(response))
    assert.deepEqual(operations.at(-1), { name: 'arrange_diagram', arguments: args })
  }
  const accepted = operations.length
  for (const args of [
    { stateToken: 'test:3', direction: 'RIGHT', arrangement: 'dependency-levels' },
    { stateToken: 'test:3', arrangement: 'stacked' },
    { stateToken: 'test:3', direction: 'RIGHT', arrangement: 'stacked', extra: true },
  ]) {
    const result = await (await request(rpc('tools/call', { name: 'arrange_diagram', arguments: args }))).json()
    assert.ok(result.error || result.result.isError)
  }
  assert.equal(operations.length, accepted)
})

test('should_return_output_content_directly_over_authenticated_HTTP_and_validate_arguments_before_dispatch_DGM135', async t => {
  const calls = []
  const output = { content: [{ type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' }, { type: 'text', text: '{"stateToken":"test:3","mimeType":"image/png","filename":"Committed.png","byteLength":8}' }] }
  const { request } = await fixture(t, { mutate: async operation => { calls.push(operation); return { ok: true, output } } })
  for (const [name, args] of [
    ['snapshot_diagram', { stateToken: 'test:3' }],
    ['export_diagram', { stateToken: 'test:3', format: 'png', scale: 2, transparent: true, background: 'white', aspect: '16:9', includeGrid: true }],
  ]) assert.deepEqual((await (await request(rpc('tools/call', { name, arguments: args }))).json()).result, output)
  for (const [name, args] of [
    ['snapshot_diagram', {}], ['snapshot_diagram', { stateToken: 'test:3', path: 'a.png' }],
    ['export_diagram', { stateToken: 'test:3', format: 'json', transparent: false }],
    ['export_diagram', { stateToken: 'test:3', format: 'markdown', includeMarkdown: true }],
  ]) assert.equal((await (await request(rpc('tools/call', { name, arguments: args }))).json()).error.code, -32602)
  assert.equal(calls.length, 2)
})

test('should_dispatch_authenticated_writes_through_the_live_correlated_mutator_only', async t => {
  const operations = []
  const { request } = await fixture(t, { mutate: async operation => {
    operations.push(operation)
    return { ok: true, value: { document: { ...document, title: 'Edited through session' }, stateToken: 'test:4' } }
  } })
  const operation = { name: 'edit_diagram', arguments: { stateToken: 'test:3', commands: [{ type: 'metadata', patch: { title: 'Edited through session' } }] } }
  const result = await (await request(rpc('tools/call', operation))).json()
  assert.equal(JSON.parse(result.result.content[0].text).document.title, 'Edited through session')
  assert.deepEqual(operations, [operation])
  assert.equal((await (await request(rpc('tools/call', { ...operation, arguments: { ...operation.arguments, commands: [{ type: 'applyLayout' }] } }))).json()).error.code, -32602)
  assert.equal(operations.length, 1)
})

test('should_bound_concurrency_and_destroy_partial_work_on_shutdown', async t => {
  const { server, request } = await fixture(t)
  const sockets = []
  for (let index = 0; index < 8; index++) {
    const pending = httpRequest(server.status().address, { method: 'POST', headers: {
      authorization: `Bearer ${server.accessToken()}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream',
    } })
    pending.on('error', () => {})
    pending.write('{')
    sockets.push(pending)
  }
  await new Promise(resolve => setTimeout(resolve, 30))
  assert.equal((await request(rpc('ping'))).status, 429)
  await server.stop()
  for (const socket of sockets) socket.destroy()
  assert.equal(server.status().state, 'unavailable')
})

test('should_reject_auth_origin_host_path_media_versions_and_preflight_without_CORS', async t => {
  const { request, server } = await fixture(t)
  assert.match(server.accessToken(), /^[a-f0-9]{64}$/)
  assert.doesNotMatch(JSON.stringify(server.status()), new RegExp(server.accessToken()))
  for (const [headers, expected] of [
    [{ authorization: '' }, 401], [{ authorization: 'Bearer wrong' }, 401],
    [{ origin: 'https://evil.example' }, 403], [{ origin: 'null' }, 403],
    [{ host: 'evil.example' }, 403], [{ host: 'localhost:123' }, 403],
    [{ 'content-type': 'text/plain' }, 415], [{ 'mcp-protocol-version': 'future' }, 400],
    [{ accept: 'text/html' }, 406],
  ]) {
    if (headers.host) {
      // Fetch owns Host in current Node. Use real HTTP for the rebinding probe.
      const response = await new Promise((resolve, reject) => {
        const probe = httpRequest(server.status().address, { method: 'POST', headers: { ...headers, authorization: `Bearer ${server.accessToken()}` } }, response => { response.resume(); resolve(response) })
        probe.on('error', reject); probe.end()
      })
      assert.equal(response.statusCode, expected, JSON.stringify(headers))
      assert.equal(response.headers['access-control-allow-origin'], undefined)
    } else {
      const response = await request(rpc('ping'), headers)
      assert.equal(response.status, expected, JSON.stringify(headers))
      assert.equal(response.headers.get('access-control-allow-origin'), null)
    }
  }
  assert.equal((await request(null, {}, 'GET')).status, 405)
  assert.equal((await request(null, {}, 'OPTIONS')).status, 405)
  assert.equal((await fetch(server.status().address + '?token=wrong')).status, 401)
  assert.equal((await fetch(server.status().address + '/other', { headers: { authorization: `Bearer ${server.accessToken()}` } })).status, 404)
})

test('should_bound_and_validate_every_JSONRPC_and_tool_argument', async t => {
  const { request } = await fixture(t)
  assert.equal((await (await request('{')).json()).error.code, -32700)
  for (const input of [[], null, {}, rpc('ping', {}, null), { ...rpc('ping'), jsonrpc: '1.0' }]) {
    assert.equal((await (await request(input)).json()).error.code, -32600)
  }
  for (const input of [
    rpc('tools/call', { name: 'get_document', arguments: { path: 'secret' } }),
    rpc('tools/call', { name: 'search_catalog', arguments: { query: 1 } }),
    rpc('tools/call', { name: 'search_catalog', arguments: { query: 'x', limit: 101 } }),
    rpc('tools/call', { name: 'unknown', arguments: {} }),
    rpc('tools/list', { cursor: 'not-supported' }),
    rpc('initialize', { protocolVersion: '2025-06-18' }),
  ]) assert.equal((await (await request(input)).json()).error.code, -32602)
  assert.equal((await (await request(rpc('exec'))).json()).error.code, -32601)
  assert.equal((await request('x'.repeat(65537))).status, 413)
  assert.equal((await request({ jsonrpc: '2.0', method: 'unknown' })).status, 202)
})

test('should_return_latest_snapshot_and_unavailable_after_clear_or_invalid_publication', async t => {
  const { request, store } = await fixture(t)
  store.publish(JSON.stringify({ document: { ...document, title: 'New committed title', revision: 4 }, stateToken: 'test:4' }))
  const call = () => request(rpc('tools/call', { name: 'get_document' })).then(response => response.json())
  assert.equal(JSON.parse((await call()).result.content[0].text).document.title, 'New committed title')
  store.clear()
  assert.equal((await call()).result.isError, true)
  store.publish(JSON.stringify(snapshot()))
  assert.throws(() => store.publish(JSON.stringify({ document: { title: 'not a diagram' } })))
  assert.equal((await call()).result.isError, true)
  assert.throws(() => store.publish('x'.repeat(8 * 1024 * 1024 + 1)))
  assert.throws(() => store.publish(JSON.stringify({ ...snapshot(), document: { ...document, ignored: 'x'.repeat(5 * 1024 * 1024) } })))
})

test('should_fallback_only_for_occupied_port_and_stop_listener_and_rotate_token', async t => {
  assert.equal(Number.isInteger(DEFAULT_MCP_PORT), true)
  const blocker = createServer()
  await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => blocker.close(resolve)))
  const { server } = await fixture(t, { port: blocker.address().port })
  assert.notEqual(new URL(server.status().address).port, String(blocker.address().port))
  const address = server.status().address
  const other = createMcpServer({ version: 'test', store: createSnapshotStore(), port: 0 })
  assert.notEqual(other.accessToken(), server.accessToken())
  await server.stop()
  assert.equal(server.status().state, 'unavailable')
  await assert.rejects(fetch(address))
})

test('should_surface_listen_failure_without_credentials_or_crashing_the_owner', async () => {
  const logs = []
  const server = createMcpServer({ version: 'test', store: createSnapshotStore(), port: -1, log: (...args) => logs.push(args) })
  await server.start()
  assert.equal(server.status().state, 'error')
  assert.equal(server.status().address, undefined)
  assert.match(server.status().message, /could not start/)
  assert.doesNotMatch(JSON.stringify(logs), new RegExp(server.accessToken()))
  assert.deepEqual(logs, [['Local MCP server failed', { code: 'listen-failed' }]])
  await server.stop()
})

function bridgeFixture(broker) {
  const callbacks = {}, handlers = new Map(), copied = []
  const frame = { url: 'ads://studio/', detached: false, isDestroyed: () => false }
  const contents = { mainFrame: frame, getURL: () => 'ads://studio/', isDestroyed: () => false, on: (name, callback) => { callbacks[name] = callback } }
  const window = { webContents: contents, isDestroyed: () => false }
  const event = { sender: contents, senderFrame: frame }
  const store = createSnapshotStore()
  const server = { status: () => ({ state: 'running', address: 'http://127.0.0.1:123/mcp', snapshotAvailable: store.available() }), accessToken: () => 'private-token' }
  registerMcpBridge({ ipcMain: { handle: (name, callback) => handlers.set(name, callback) }, clipboard: { writeText: value => copied.push(value) }, window, server, store, broker })
  return { callbacks, handlers, copied, window, contents, frame, event, store }
}

test('should_trust_only_registered_live_exact_main_frame_and_expose_narrow_copy_actions', async () => {
  const f = bridgeFixture()
  assert.equal(trustedSender(f.window, f.event), true)
  assert.deepEqual([...f.handlers.keys()], ['mcp:status', 'mcp:copy-address', 'mcp:copy-token', 'mcp:publish', 'mcp:mutation-active', 'mcp:mutation-result'])
  await f.handlers.get('mcp:copy-address')(f.event)
  await f.handlers.get('mcp:copy-token')(f.event)
  assert.deepEqual(f.copied, ['http://127.0.0.1:123/mcp', 'private-token'])
  assert.doesNotMatch(JSON.stringify(await f.handlers.get('mcp:status')(f.event)), /private-token/)
  for (const event of [{}, { ...f.event, sender: {} }, { ...f.event, senderFrame: {} }]) {
    assert.equal(trustedSender(f.window, event), false)
    await assert.rejects(async () => f.handlers.get('mcp:copy-token')(event))
  }
  for (const url of ['https://evil/', 'ads://studio.evil/', 'ads://user@studio/', 'ads://studio:1/', 'ads://studio/foreign']) {
    f.frame.url = url
    assert.equal(trustedSender(f.window, f.event), false)
  }
  f.frame.url = 'ads://studio/'
  f.frame.detached = true
  assert.equal(trustedSender(f.window, f.event), false)
})

test('should_clear_snapshots_on_reload_failure_crash_and_destruction', async () => {
  const f = bridgeFixture()
  for (const name of ['did-start-loading', 'render-process-gone', 'destroyed']) {
    f.store.publish(JSON.stringify(snapshot()))
    f.callbacks[name]()
    assert.equal(f.store.available(), false)
  }
  f.store.publish(JSON.stringify(snapshot()))
  f.callbacks['did-fail-load']({}, -2, '', 'ads://studio/', true)
  assert.equal(f.store.available(), false)
  assert.deepEqual(await f.handlers.get('mcp:publish')(f.event, JSON.stringify(snapshot())), { ok: true })
  assert.equal(f.store.available(), true)
  assert.deepEqual(await f.handlers.get('mcp:publish')(f.event, null), { ok: true })
  assert.equal(f.store.available(), false)
})

test('should_validate_correlated_output_IPC_and_cancel_old_renderer_generation_DGM135', async () => {
  let sent
  const broker = createMutationBroker({ send: request => { sent = request } })
  const f = bridgeFixture(broker)
  const operation = { name: 'snapshot_diagram', arguments: { stateToken: 'test:3' } }
  const pending = broker.request(operation), id = sent.id
  const result = { ok: true, output: { content: [
    { type: 'image', mimeType: 'image/png', data: 'iVBORw0KGgo=' },
    { type: 'text', text: '{"stateToken":"test:3","mimeType":"image/png","filename":"Committed.png","byteLength":8}' },
  ] } }
  const complete = f.handlers.get('mcp:mutation-result')
  assert.throws(() => complete({ ...f.event, senderFrame: {} }, id, JSON.stringify(result)), /Untrusted/)
  for (const text of ['{}', '{', JSON.stringify({ ...result, extra: true }), JSON.stringify({ ok: true, output: { content: [] } }), 'x'.repeat(8 * 1024 * 1024 + 1)]) assert.equal(complete(f.event, id, text), false)
  assert.equal(complete(f.event, 'wrong-id', JSON.stringify(result)), false)
  assert.equal(complete(f.event, id, JSON.stringify(result)), true)
  assert.deepEqual(await pending, result)
  const reloading = broker.request(operation), oldId = sent.id
  f.callbacks['did-start-loading']()
  assert.equal((await reloading).ok, false)
  assert.equal(complete(f.event, oldId, JSON.stringify(result)), false)
})
