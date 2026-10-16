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

const profileRoot = 'C:\\isolated\\unique-profile'
const launcher = { pid: 100, parentPid: 1, created: '2026-10-16T18:00:00.000Z', started: '1000', exitSeen: false, ExecutablePath: 'C:\\candidate\\portable.exe', CommandLine: `C:\\candidate\\portable.exe --user-data-dir=${profileRoot}` }
const runtime = { pid: 101, parentPid: 100, created: '2026-10-16T18:00:01.000Z', started: '2000', exitSeen: false, ExecutablePath: `${profileRoot}\\extract\\AzureDiagramStudio.exe`, CommandLine: `${profileRoot}\\extract\\AzureDiagramStudio.exe --user-data-dir=${profileRoot}` }
const launchIdentity = { launcherPid: launcher.pid, executablePath: launcher.ExecutablePath, profileRoot, launchedAt: Date.parse(launcher.created) }

test('should_retain_recorded_ancestry_when_a_missing_or_exited_launcher_has_a_late_runtime', () => {
  for (const processes of [[runtime], [{ ...launcher, exitSeen: true }, runtime]]) {
    const selected = driver.desktopProcessCandidates(processes, new Map([[launcher.pid, launcher]]), launchIdentity)
    assert.ok(selected.some(record => record.pid === runtime.pid))
  }
})

test('should_exclude_unrelated_reused_older_and_profile_lookalike_processes_when_claiming_late_children', () => {
  const foreign = [
    { ...runtime, pid: 102, parentPid: 900 },
    { ...runtime, pid: 103, CommandLine: `${runtime.CommandLine}-lookalike` },
    { ...runtime, pid: 104, CommandLine: `observer -Command "echo --user-data-dir=${profileRoot}"` },
    { ...runtime, pid: 105, ExecutablePath: 'C:\\unrelated\\AzureDiagramStudio.exe' },
    { ...runtime, pid: 106, created: '2026-10-16T17:59:59.000Z' },
  ]
  assert.deepEqual(driver.desktopProcessCandidates(foreign, new Map([[launcher.pid, launcher]]), launchIdentity), [])
  assert.deepEqual(driver.desktopProcessCandidates([{ ...launcher, created: runtime.created }, runtime], new Map([[launcher.pid, launcher]]), launchIdentity), [])
  assert.deepEqual(driver.desktopProcessCandidates([{ ...runtime, created: '2026-10-16T18:00:02.000Z' }], new Map([[launcher.pid, launcher], [runtime.pid, runtime]]), launchIdentity), [])
})

test('should_keep_executable_and_start_ticks_in_cleanup_identity_when_a_pid_is_reused', () => {
  assert.equal(driver.processCleanupState(runtime, [{ ...runtime, started: 'different' }]).exited, true)
  assert.equal(driver.processCleanupState(runtime, [{ ...runtime, ExecutablePath: 'C:\\other.exe' }]).exited, true)
})

test('should_reflect_only_owned_pids_when_collecting_windows_handle_identity', async () => {
  const commands = []
  const execute = async (file, args, options) => { commands.push({ file, command: args.at(-1), options }); return { stdout: JSON.stringify({ observer: 'managed-wmi-v1', records: [] }), stderr: '' } }
  await driver.observeWindowsProcesses(undefined, {}, execute)
  await driver.observeWindowsProcesses([100, 101], {}, execute)
  assert.match(commands[0].command, /SELECT ProcessId,ParentProcessId,CreationDate,Name,CommandLine,ExecutablePath FROM Win32_Process/)
  assert.doesNotMatch(commands[0].command, /System\.Diagnostics\.Process\b|StartTime|HasExited/)
  assert.match(commands[1].command, /WHERE ProcessId = 100 OR ProcessId = 101/)
  assert.match(commands[1].command, /StartTime.*HasExited/)
  assert.ok(commands.every(command => command.options.timeout === 10000 && command.options.maxBuffer === 4000000))
  for (const command of commands) {
    assert.match(command.command, /System\.Management\.ManagementObjectSearcher/)
    assert.match(command.command, /SpecifyKind.*DateTimeKind\]::Local/)
    assert.match(command.command, /\.Dispose\(\)/)
    assert.doesNotMatch(command.command, /Get-CimInstance|Import-Module|Get-WmiObject|Add-Type/)
  }
})

test('should_use_a_fresh_bounded_one_shot_when_the_observer_starts_cold', async () => {
  const calls = []
  const diagnostics = {}
  const run = async (file, args, options) => {
    calls.push({ file, args, options })
    return { stdout: JSON.stringify({ observer: 'managed-wmi-v1', records: [runtime], timings: { assemblyMs: 1, queryMs: 2, identityMs: 3 } }), stderr: '' }
  }
  for (let round = 0; round < 3; round++) assert.deepEqual(await driver.observeWindowsProcesses([runtime.pid], diagnostics, run), [runtime])
  assert.equal(calls.length, 3)
  assert.ok(calls.every(call => call.file === 'powershell.exe' && call.args.includes('-NonInteractive') && call.options.timeout === 10000))
  assert.ok(diagnostics.processObservations.every(observation => observation.observer === 'managed-wmi-v1' && observation.timings.queryMs === 2))
})

test('should_normalize_case_insensitive_windows_fields_without_enumerating_other_pids', async () => {
  const record = Object.fromEntries(Object.entries(runtime).map(([key, value]) => [key.toUpperCase(), value]))
  const run = async () => ({ stdout: JSON.stringify({ observer: 'managed-wmi-v1', records: record }), stderr: '' })
  assert.deepEqual(await driver.observeWindowsProcesses([runtime.pid], {}, run), [runtime])
  for (const records of [[runtime, runtime], [{ ...runtime, pid: 999 }]]) {
    await assert.rejects(driver.observeWindowsProcesses([runtime.pid], {}, async () => ({ stdout: JSON.stringify({ observer: 'managed-wmi-v1', records }), stderr: '' })), /Invalid Windows process observation/)
  }
})

test('should_reject_missing_incomplete_or_unframed_observer_output_instead_of_claiming_absence', async () => {
  for (const stdout of ['', ' ', '{"observer":"managed-wmi-v1","records":[', 'null', '[]', '{"observer":"managed-wmi-v1"}', '{"observer":"managed-wmi-v1","records":null}', '{"observer":"managed-wmi-v1","records":[{"pid":101}]}']) {
    const diagnostics = {}
    await assert.rejects(driver.observeWindowsProcesses([101], diagnostics, async () => ({ stdout, stderr: 'private diagnostics' })), /Invalid Windows process observation/)
    assert.equal(diagnostics.processObservations.length, 1)
    assert.equal(diagnostics.processObservations[0].error.stdout.bytes, Buffer.byteLength(stdout))
    assert.doesNotMatch(JSON.stringify(diagnostics), /private diagnostics/)
  }
})

test('should_preserve_timeout_and_child_exit_receipts_without_retrying_or_leaving_a_transport', async () => {
  for (const properties of [{ code: null, killed: true, signal: 'SIGTERM' }, { code: 7, killed: false, signal: null }, { code: 'ENOENT', errno: -4058, syscall: 'spawn powershell.exe' }]) {
    const original = Object.assign(new Error('observer failed'), properties, { stdout: 'private partial output', stderr: 'private error' })
    const diagnostics = {}
    let calls = 0
    await assert.rejects(driver.observeWindowsProcesses([101], diagnostics, async () => { calls++; throw original }), error => error === original)
    assert.equal(calls, 1)
    const receipt = diagnostics.processObservations[0]
    for (const [key, value] of Object.entries(properties)) assert.equal(receipt.error[key], value)
    assert.equal(receipt.error.stdout.bytes, Buffer.byteLength(original.stdout))
    assert.ok(receipt.durationMs >= 0 && receipt.startedUtc && receipt.endedUtc)
    assert.doesNotMatch(JSON.stringify(diagnostics), /private/)
  }
})

test('should_bound_observation_to_the_remaining_startup_budget_without_increasing_the_query_limit', async () => {
  const calls = []
  const run = async (file, args, options) => { calls.push(options); return { stdout: JSON.stringify({ observer: 'managed-wmi-v1', records: [] }), stderr: '' } }
  await driver.observeWindowsProcesses([101], {}, run, 123)
  assert.equal(calls[0].timeout, 123)
  for (const timeout of [0, -1, 10001, Infinity]) await assert.rejects(driver.observeWindowsProcesses([101], {}, run, timeout), /observation deadline/)
  assert.equal(calls.length, 1)
})

test('should_keep_exact_identity_checks_in_the_managed_termination_command', () => {
  const command = driver.windowsProcessCommand([runtime.pid], runtime)
  assert.match(command, /WHERE ProcessId = 101/)
  assert.match(command, /\$created -ceq/)
  assert.ok(command.includes(runtime.created))
  assert.ok(command.includes(runtime.CommandLine))
  assert.ok(command.includes(runtime.ExecutablePath))
  assert.match(command, /StartTime.*HasExited/)
  assert.match(command, /\$started -ceq '2000'/)
  assert.match(command, /\$handle\.Kill\(\)/)
  assert.match(command, /WaitForExit\(3000\)/)
  assert.doesNotMatch(command, /Get-CimInstance|Stop-Process|taskkill/)
  assert.throws(() => driver.windowsProcessCommand([runtime.pid], { ...runtime, started: null }), /handle identity/)
  assert.throws(() => driver.windowsProcessCommand([launcher.pid], runtime), /handle identity/)
})

test('should_capture_actual_query_error_properties_without_unrelated_command_lines_before_rethrow', async () => {
  const original = Object.assign(new Error('query stopped'), { code: null, killed: true, signal: 'SIGTERM', stdout: 'unrelated --secret=private', stderr: 'unrelated command secret' })
  const diagnostics = {}
  await assert.rejects(driver.observeWindowsProcesses(undefined, diagnostics, async () => { throw original }), error => error === original)
  const receipt = diagnostics.processObservations[0]
  assert.equal(receipt.error.killed, true)
  assert.equal(receipt.error.signal, 'SIGTERM')
  assert.equal(receipt.error.code, null)
  assert.equal(receipt.error.stdout.bytes, Buffer.byteLength(original.stdout))
  assert.equal(receipt.error.stderr.bytes, Buffer.byteLength(original.stderr))
  assert.ok(receipt.startedUtc && receipt.endedUtc && receipt.durationMs >= 0)
  assert.doesNotMatch(JSON.stringify(diagnostics), /private|unrelated command secret/)
})

test('should_discover_and_clean_a_late_child_when_startup_failed_and_the_root_disappeared', async () => {
  const owned = new Map([[launcher.pid, launcher]])
  const diagnostics = { cleanupErrors: [] }
  let round = 0
  let terminated = false
  const snapshot = async () => {
    round++
    const processes = round === 1 || terminated ? [] : [runtime]
    for (const record of driver.desktopProcessCandidates(processes, owned, launchIdentity)) owned.set(record.pid, record)
    return processes
  }
  await driver.cleanupDesktopProcesses({ owned, diagnostics, snapshot, terminate: async record => { assert.equal(record.pid, runtime.pid); terminated = true } })
  assert.equal(terminated, true)
  assert.ok(round >= 3)
  assert.ok(diagnostics.cleanup.every(record => record.exited))
})

test('should_preserve_startup_error_when_owned_cleanup_cannot_complete', async () => {
  const original = new Error('startup query failed')
  const diagnostics = { cleanupErrors: [] }
  const close = () => driver.cleanupDesktopProcesses({ owned: new Map([[runtime.pid, runtime]]), diagnostics, snapshot: async () => [runtime], terminate: async () => { throw new Error('identity observation failed') } })
  await assert.rejects(driver.closePreservingFailure({ close }, original), error => {
    assert.equal(error, original)
    assert.match(error.cleanupError, /remain/)
    assert.equal(diagnostics.cleanupErrors.length, 3)
    assert.equal(diagnostics.cleanup[0].exited, false)
    return true
  })
})