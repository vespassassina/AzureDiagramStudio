import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import test from 'node:test'
import * as driver from '../../scripts/desktop-driver.mjs'

class Socket extends EventEmitter {
  addEventListener(name, listener) { this.on(name, listener) }
  removeEventListener(name, listener) { this.off(name, listener) }
  send(text) { this.sent = JSON.parse(text) }
}

test('should_remove_node_bootstrap_flags_when_launching_an_isolated_desktop', () => {
  const original = { PATH: 'system', ELECTRON_RUN_AS_NODE: '1', electron_run_as_node: '1', NODE_OPTIONS: '--inspect=9000', NODE_PATH: 'foreign', TEMP: 'temp' }
  assert.deepEqual(driver.desktopEnvironment(original), { PATH: 'system', TEMP: 'temp' })
  assert.equal(original.ELECTRON_RUN_AS_NODE, '1')
})

test('should_isolate_nsis_extraction_when_another_portable_profile_is_running', () => {
  const environment = driver.desktopEnvironment({ PATH: 'system', TEMP: 'shared', TMP: 'shared' }, 'C:/desktop-test-profile')
  assert.equal(environment.TEMP, 'C:/desktop-test-profile')
  assert.equal(environment.TMP, 'C:/desktop-test-profile')
})

test('should_select_only_loopback_node_targets_when_inspector_lists_helpers_first', () => {
  const targets = [
    { type: 'page', webSocketDebuggerUrl: 'ws://127.0.0.1:9000/page' },
    { type: 'node', webSocketDebuggerUrl: 'ws://remote.invalid:9000/node' },
    { type: 'node', webSocketDebuggerUrl: 'ws://127.0.0.1:9001/node' },
    { type: 'node', title: 'Electron', url: 'file:///app/electron/main.mjs', webSocketDebuggerUrl: 'ws://127.0.0.1:9000/main' },
  ]
  assert.deepEqual(driver.inspectorTargets(targets, 9000), [targets[3]])
})

test('should_require_owned_listener_pid_when_electron_is_paused_before_process_identity_initialization', () => {
  const owned = new Set([100, 101])
  assert.equal(driver.ownsInspectorListener({ address: '127.0.0.1', pid: 101 }, owned), true)
  assert.equal(driver.ownsInspectorListener({ address: '127.0.0.1', pid: 200 }, owned), false)
  assert.equal(driver.ownsInspectorListener({ address: '0.0.0.0', pid: 101 }, owned), false)
})

test('should_reject_runtime_exceptions_when_evaluating_main_process_code', async () => {
  const socket = new Socket()
  const transport = driver.inspectorTransport(socket, 100)
  const result = transport.request('Runtime.evaluate', { expression: 'probe' })
  socket.emit('message', { data: JSON.stringify({ id: socket.sent.id, result: { exceptionDetails: { exception: { description: 'wrong main origin' } } } }) })
  await assert.rejects(result, /wrong main origin/)
  transport.dispose()
})

test('should_bound_requests_and_reject_pending_calls_when_inspector_closes', async () => {
  const socket = new Socket()
  const transport = driver.inspectorTransport(socket, 20)
  await assert.rejects(transport.request('Runtime.evaluate', {}), /timed out/)
  const pending = transport.request('Runtime.evaluate', {})
  socket.emit('close')
  await assert.rejects(pending, /closed/)
  transport.dispose()
})

test('should_track_only_spawned_descendants_when_cleaning_up_failed_portable_launches', () => {
  const processes = [
    { pid: 10, parentPid: 1 }, { pid: 11, parentPid: 10 }, { pid: 12, parentPid: 11 },
    { pid: 20, parentPid: 1 }, { pid: 21, parentPid: 20 },
  ]
  assert.deepEqual(driver.ownedProcessTree(processes, new Set([10])), [processes[0], processes[1], processes[2]])
})

test('should_capture_existing_electron_imports_before_app_startup_when_inspector_origin_has_no_loader', async () => {
  const calls = []
  const pauses = [
    { callFrames: [{ callFrameId: 'bootstrap', url: 'node:electron/js2c/browser_init' }] },
    { callFrames: [{ callFrameId: 'main', url: 'file:///temp/resources/app.asar/electron/main.mjs' }] },
  ]
  const transport = {
    request: async (method, params) => {
      calls.push({ method, params })
      return method === 'Debugger.evaluateOnCallFrame' ? { result: { objectId: 'existing-imports' } } : {}
    },
    event: async () => pauses.shift(),
  }
  assert.equal(await driver.captureMainExports(transport, 'C:/isolated-profile'), 'existing-imports')
  const capture = calls.find(call => call.method === 'Debugger.evaluateOnCallFrame')
  assert.equal(capture.params.callFrameId, 'main')
  assert.match(capture.params.expression, /app\.setPath\('appData'/)
  assert.match(capture.params.expression, /C:\/isolated-profile/)
  assert.match(capture.params.expression, /app, BrowserWindow, session/)
  assert.doesNotMatch(capture.params.expression, /require\(|import\(|globalThis|ipc/)
  assert.deepEqual(calls.slice(-2).map(call => call.method), ['Debugger.resume', 'Debugger.disable'])
})

test('should_accept_exited_handles_when_cim_retains_a_zombie_launcher', () => {
  const record = { pid: 10, created: 'first', CommandLine: 'owned profile' }
  assert.deepEqual(driver.processCleanupState(record, [{ ...record, exitSeen: true }]), { pid: 10, created: 'first', exited: true, reason: 'exit-seen' })
})

test('should_not_claim_or_terminate_reused_pids_when_process_identity_changes', () => {
  const record = { pid: 10, created: 'first', CommandLine: 'owned profile' }
  assert.equal(driver.processCleanupState(record, [{ ...record, created: 'second' }]).exited, true)
  assert.equal(driver.processCleanupState(record, [{ ...record, CommandLine: 'user application' }]).exited, true)
  assert.equal(driver.processCleanupState(record, [{ ...record, exitSeen: false }]).exited, false)
})

test('should_preserve_original_assertion_separately_when_cleanup_also_fails', async () => {
  const original = new Error('original assertion')
  await assert.rejects(driver.closePreservingFailure({ close: async () => { throw new Error('cleanup failure') } }, original), error => {
    assert.equal(error, original)
    assert.equal(error.message, 'original assertion')
    assert.match(error.cleanupError, /cleanup failure/)
    return true
  })
})

test('should_cancel_pending_inspector_requests_when_first_window_setup_fails', async () => {
  const socket = new Socket()
  const transport = driver.inspectorTransport(socket, 100)
  const request = assert.rejects(transport.request('Runtime.callFunctionOn', {}), /closed/)
  const event = assert.rejects(transport.event('Debugger.paused'), /closed/)
  transport.dispose()
  await Promise.all([request, event])
  assert.equal(socket.listenerCount('message'), 0)
})

test('should_queue_debugger_events_when_pause_arrives_before_waiter', async () => {
  const socket = new Socket()
  const transport = driver.inspectorTransport(socket, 100)
  socket.emit('message', { data: JSON.stringify({ method: 'Debugger.paused', params: { callFrames: [] } }) })
  assert.deepEqual(await transport.event('Debugger.paused'), { callFrames: [] })
  transport.dispose()
})

test('should_apply_chromium_offline_state_before_reloading_the_packaged_window', async () => {
  const calls = []
  const page = {
    waitForURL: async (url, options) => { calls.push(['ready', url, options]) },
    reload: async options => { calls.push(['reload', options]) },
  }
  const context = {
    setOffline: async offline => { calls.push(['offline', offline]) },
    pages: () => [page],
    newCDPSession: async selected => {
      assert.equal(selected, page)
      return { send: async (method, params) => { calls.push(['cdp', method, params]) } }
    },
  }
  assert.equal(await driver.offlineWindow(context, 5000), page)
  assert.deepEqual(calls, [
    ['ready', 'ads://studio/', { waitUntil: 'domcontentloaded', timeout: 5000 }],
    ['offline', true],
    ['reload', { waitUntil: 'domcontentloaded', timeout: 5000 }],
    ['cdp', 'Network.enable', undefined],
    ['cdp', 'Network.overrideNetworkState', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }],
  ])
})