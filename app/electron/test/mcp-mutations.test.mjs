import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMutationBroker } from '../mcp-bridge.mjs'
import { validateMutation, mutationTools } from '../mcp-schema.mjs'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

const operation = { name: 'edit_diagram', arguments: { stateToken: 'state:1', commands: [{ type: 'metadata', patch: { title: 'Edited' } }] } }
const arrangeOperation = { name: 'arrange_diagram', arguments: { stateToken: 'state:1', direction: 'DOWN' } }
test('should_validate_exact_bounded_mutation_schemas_and_reject_client_layout', () => {
  assert.equal(mutationTools.length, 5)
  assert.equal(validateMutation(operation), true)
  for (const value of [
    { ...operation, arguments: { ...operation.arguments, extra: true } },
    { ...operation, arguments: { commands: operation.arguments.commands } },
    { ...operation, arguments: { ...operation.arguments, commands: [] } },
    { ...operation, arguments: { ...operation.arguments, commands: [{ type: 'applyLayout', result: {} }] } },
    { ...operation, arguments: { ...operation.arguments, commands: [{ type: 'metadata', patch: { secret: true } }] } },
    { name: 'create_diagram', arguments: { stateToken: 'test', path: 'file' } },
  ]) assert.equal(validateMutation(value), false)
})
test('should_correlate_serialize_and_reject_expired_disconnected_reload_requests', async () => {
  const sent = []
  const broker = createMutationBroker({ send: value => sent.push(value), timeout: 30 })
  const pending = broker.request(operation)
  assert.equal(sent.length, 1)
  assert.equal((await broker.request(operation)).ok, false)
  assert.equal(broker.complete('wrong', { ok: false, message: 'forged' }), false)
  assert.equal(broker.complete(sent[0].id, { ok: false, message: 'busy' }), true)
  assert.deepEqual(await pending, { ok: false, message: 'busy' })
  const expired = broker.request(operation)
  await new Promise(resolve => setTimeout(resolve, 50))
  assert.equal((await expired).ok, false)
  assert.equal(broker.complete(sent[1].id, { ok: true, value: {} }), false)
  const unloaded = broker.request(operation)
  broker.clear('Renderer reloaded.')
  assert.deepEqual(await unloaded, { ok: false, message: 'Renderer reloaded.' })
  assert.equal(broker.complete(sent[2].id, { ok: true, value: {} }), false)
  const controller = new AbortController()
  const disconnected = broker.request(operation, controller.signal)
  controller.abort()
  assert.equal((await disconnected).ok, false)
})

test('should_keep_default_arrangement_active_until_the_native_layout_deadline_and_preserve_explicit_override', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const sent = [], canceled = []
  const broker = createMutationBroker({ send: value => sent.push(value), cancel: id => canceled.push(id) })
  const started = Date.now()
  const pending = broker.request(arrangeOperation)
  assert.equal(sent[0].deadline, started + 15_000)
  t.mock.timers.tick(4_000)
  assert.equal(broker.active(sent[0].id), true)
  assert.equal(broker.complete(sent[0].id, { ok: false, message: 'Layout rejected.' }), true)
  assert.deepEqual(await pending, { ok: false, message: 'Layout rejected.' })

  const expiring = broker.request(arrangeOperation)
  const expiringId = sent[1].id
  t.mock.timers.tick(15_000)
  assert.deepEqual(await expiring, { ok: false, message: 'MCP operation timed out.' })
  assert.deepEqual(canceled, [expiringId])
  assert.equal(broker.active(expiringId), false)
  assert.equal(broker.complete(expiringId, { ok: false, message: 'Late layout result.' }), false)

  const controller = new AbortController()
  const disconnected = broker.request(arrangeOperation, controller.signal)
  const disconnectedId = sent[2].id
  controller.abort()
  assert.deepEqual(await disconnected, { ok: false, message: 'MCP client disconnected.' })
  assert.equal(broker.complete(disconnectedId, { ok: false, message: 'Late disconnect result.' }), false)

  const unloaded = broker.request(arrangeOperation)
  const unloadedId = sent[3].id
  broker.clear('Renderer reloaded.')
  assert.deepEqual(await unloaded, { ok: false, message: 'Renderer reloaded.' })
  assert.equal(broker.complete(unloadedId, { ok: false, message: 'Late unload result.' }), false)

  const retry = broker.request(arrangeOperation)
  assert.equal(broker.complete(sent[4].id, { ok: false, message: 'Retry accepted.' }), true)
  assert.deepEqual(await retry, { ok: false, message: 'Retry accepted.' })

  const overriddenSent = []
  const overridden = createMutationBroker({ send: value => overriddenSent.push(value), timeout: 30 })
  const overridePending = overridden.request(arrangeOperation)
  assert.equal(overriddenSent[0].deadline, Date.now() + 30)
  t.mock.timers.tick(30)
  assert.deepEqual(await overridePending, { ok: false, message: 'MCP operation timed out.' })
})

test('should_expose_only_fixed_sandbox_preload_operations_and_dispose_mutation_listeners', async () => {
  let exposed, workspace
  const invocations = [], listeners = new Map()
  const electron = {
    contextBridge: { exposeInMainWorld: (name, value) => { if (name === 'desktopWorkspace') workspace = value; else { assert.equal(name, 'desktopMcp'); exposed = value } } },
    ipcRenderer: {
      invoke: (...args) => { invocations.push(args); return Promise.resolve(true) },
      on: (name, callback) => listeners.set(name, callback),
      removeListener: (name, callback) => { assert.equal(listeners.get(name), callback); listeners.delete(name) },
    },
  }
  runInNewContext(await readFile(new URL('../preload.cjs', import.meta.url), 'utf8'), { require: name => { assert.equal(name, 'electron'); return electron } })
  assert.deepEqual(Object.keys(exposed), ['status', 'copyAddress', 'copyToken', 'publishSnapshot', 'onMutation', 'mutationActive', 'completeMutation'])
  assert.equal(Object.isFrozen(exposed), true)
  assert.deepEqual(Object.keys(workspace), ['read', 'choose', 'reset', 'save'])
  assert.equal(Object.isFrozen(workspace), true)
  await workspace.read(); await workspace.choose(); await workspace.reset(); await workspace.save({ bounded: true })
  assert.deepEqual(invocations.splice(0), [['workspace:read'], ['workspace:choose'], ['workspace:reset'], ['workspace:save', { bounded: true }]])
  await exposed.copyToken()
  assert.deepEqual(invocations, [['mcp:copy-token']])
  let received, canceled
  const dispose = exposed.onMutation(value => { received = value }, id => { canceled = id })
  listeners.get('mcp:mutation')({}, { id: 'correlated' })
  listeners.get('mcp:cancel')({}, 'correlated')
  assert.equal(received.id, 'correlated')
  assert.equal(canceled, 'correlated')
  dispose()
  assert.equal(listeners.size, 0)
})

test('should_stage_exact_nine_shell_files_including_workspace_and_preload_without_source_or_dependencies', async () => {
  const source = await readFile(new URL('../../scripts/stage-desktop.mjs', import.meta.url), 'utf8')
  const names = /for \(const name of (\[[^\n]+\])\)/.exec(source)?.[1]
  assert.ok(names)
  const files = runInNewContext(names)
  assert.deepEqual([...files], ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'workspace.mjs', 'preload.cjs'])
  assert.match(source, /no npm dependencies or source tests/)
})
