import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createMutationBroker } from '../mcp-bridge.mjs'
import { validateMutation, mutationTools } from '../mcp-schema.mjs'
import { readFile } from 'node:fs/promises'
import { runInNewContext } from 'node:vm'

const operation = { name: 'edit_diagram', arguments: { stateToken: 'state:1', commands: [{ type: 'metadata', patch: { title: 'Edited' } }] } }
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

test('should_expose_only_fixed_sandbox_preload_operations_and_dispose_mutation_listeners', async () => {
  let exposed
  const invocations = [], listeners = new Map()
  const electron = {
    contextBridge: { exposeInMainWorld: (name, value) => { assert.equal(name, 'desktopMcp'); exposed = value } },
    ipcRenderer: {
      invoke: (...args) => { invocations.push(args); return Promise.resolve(true) },
      on: (name, callback) => listeners.set(name, callback),
      removeListener: (name, callback) => { assert.equal(listeners.get(name), callback); listeners.delete(name) },
    },
  }
  runInNewContext(await readFile(new URL('../preload.cjs', import.meta.url), 'utf8'), { require: name => { assert.equal(name, 'electron'); return electron } })
  assert.deepEqual(Object.keys(exposed), ['status', 'copyAddress', 'copyToken', 'publishSnapshot', 'onMutation', 'mutationActive', 'completeMutation'])
  assert.equal(Object.isFrozen(exposed), true)
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

test('should_stage_exact_eight_shell_files_including_preload_without_source_or_dependencies', async () => {
  const source = await readFile(new URL('../../scripts/stage-desktop.mjs', import.meta.url), 'utf8')
  const names = /for \(const name of (\[[^\n]+\])\)/.exec(source)?.[1]
  assert.ok(names)
  const files = runInNewContext(names)
  assert.deepEqual([...files], ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'preload.cjs'])
  assert.match(source, /no npm dependencies or source tests/)
})
