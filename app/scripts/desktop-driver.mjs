import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import { createServer } from 'node:net'
import path from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { promisify } from 'node:util'
import { chromium } from '@playwright/test'

const execute = promisify(execFile)

export function desktopEnvironment(environment, profileRoot) {
  const safe = Object.fromEntries(Object.entries(environment).filter(([name]) => !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_PATH'].includes(name.toUpperCase()) && (!profileRoot || !['TEMP', 'TMP'].includes(name.toUpperCase()))))
  return profileRoot ? { ...safe, TEMP: profileRoot, TMP: profileRoot } : safe
}

export function inspectorTargets(targets, port) {
  return targets.filter(target => {
    if (target.type !== 'node') return false
    try {
      const url = new URL(target.webSocketDebuggerUrl)
      return url.protocol === 'ws:' && url.hostname === '127.0.0.1' && Number(url.port) === port && !url.username && !url.password
    } catch { return false }
  })
}

export function ownsInspectorListener(listener, owned) {
  return listener?.address === '127.0.0.1' && owned.has(listener.pid)
}

async function inspectorListener(port) {
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Get-NetTCPConnection -State Listen -LocalPort ${port} -ErrorAction Stop | Select-Object @{n='address';e={$_.LocalAddress}},@{n='pid';e={$_.OwningProcess}} | ConvertTo-Json -Compress`], { timeout: 10_000, windowsHide: true })
  const listeners = JSON.parse(stdout)
  return (Array.isArray(listeners) ? listeners : [listeners]).find(listener => listener.address === '127.0.0.1')
}

export function inspectorTransport(socket, timeout) {
  let sequence = 0
  let closed = false
  const requests = new Map()
  const events = new Map()
  const waiters = new Map()
  const scripts = new Map()
  const rejectAll = () => {
    closed = true
    for (const pending of requests.values()) { clearTimeout(pending.timer); pending.reject(new Error('Main inspector closed')) }
    requests.clear()
    for (const pending of waiters.values()) { clearTimeout(pending.timer); pending.reject(new Error('Main inspector closed')) }
    waiters.clear()
  }
  const receive = event => {
    let message
    try { message = JSON.parse(event.data) } catch { rejectAll(); return }
    if (message.method) {
      if (message.method === 'Debugger.scriptParsed') scripts.set(message.params.scriptId, message.params.url)
      if (message.method !== 'Debugger.paused') return
      const waiter = waiters.get(message.method)
      if (waiter) { clearTimeout(waiter.timer); waiters.delete(message.method); waiter.resolve(message.params) }
      else events.set(message.method, [...(events.get(message.method) ?? []), message.params])
      return
    }
    const pending = requests.get(message.id)
    if (!pending) return
    requests.delete(message.id)
    clearTimeout(pending.timer)
    const exception = message.result?.exceptionDetails
    if (message.error || exception) pending.reject(new Error(message.error?.message ?? exception.exception?.description ?? exception.text))
    else pending.resolve(message.result)
  }
  socket.addEventListener('message', receive)
  socket.addEventListener('close', rejectAll)
  socket.addEventListener('error', rejectAll)
  return {
    scriptUrl(id) { return scripts.get(id) },
    event(method) {
      if (closed) return Promise.reject(new Error('Main inspector closed'))
      const queued = events.get(method)
      if (queued?.length) return Promise.resolve(queued.shift())
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { waiters.delete(method); reject(new Error(`${method} timed out`)) }, timeout)
        waiters.set(method, { resolve, reject, timer })
      })
    },
    request(method, params) {
      if (closed) return Promise.reject(new Error('Main inspector closed'))
      const id = ++sequence
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => { requests.delete(id); reject(new Error(`${method} timed out`)) }, timeout)
        requests.set(id, { resolve, reject, timer })
        try { socket.send(JSON.stringify({ id, method, params })) } catch (error) { clearTimeout(timer); requests.delete(id); reject(error) }
      })
    },
    dispose() {
      rejectAll()
      socket.removeEventListener('message', receive)
      socket.removeEventListener('close', rejectAll)
      socket.removeEventListener('error', rejectAll)
    },
  }
}

export async function captureMainExports(transport, profileRoot) {
  await transport.request('Runtime.enable', {})
  await transport.request('Debugger.enable', {})
  await transport.request('Debugger.setBreakpointByUrl', { lineNumber: 0, urlRegex: '/electron/main\\.mjs$' })
  await transport.request('Runtime.runIfWaitingForDebugger', {})
  for (let attempt = 0; attempt < 16; attempt++) {
    const paused = await transport.event('Debugger.paused')
    const frame = paused.callFrames.find(frame => /\/electron\/main\.mjs$/.test(frame.url || transport.scriptUrl?.(frame.location?.scriptId) || ''))
    if (!frame) { await transport.request('Debugger.resume', {}); continue }
    const captured = await transport.request('Debugger.evaluateOnCallFrame', { callFrameId: frame.callFrameId, expression: `app.setPath('appData', ${JSON.stringify(profileRoot)}); app.whenReady().then(() => session.defaultSession.enableNetworkEmulation({ offline: true })); ({ app, BrowserWindow, session })`, returnByValue: false })
    if (!captured.result?.objectId) throw new Error('Bundled main-module Electron imports were not available')
    await transport.request('Debugger.resume', {})
    await transport.request('Debugger.disable', {})
    return captured.result.objectId
  }
  throw new Error('Bundled Electron main module did not reach its startup breakpoint')
}

export function ownedProcessTree(processes, roots) {
  const owned = new Set(roots)
  let changed = true
  while (changed) {
    changed = false
    for (const process of processes) {
      if (!owned.has(process.pid) && owned.has(process.parentPid)) { owned.add(process.pid); changed = true }
    }
  }
  return processes.filter(process => owned.has(process.pid))
}

export function processCleanupState(record, processes) {
  const current = processes.find(current => current.pid === record.pid)
  const matches = current?.created === record.created && current?.CommandLine === record.CommandLine && (!record.ExecutablePath || current?.ExecutablePath === record.ExecutablePath) && (!record.started || current?.started === record.started)
  return { pid: record.pid, created: record.created, exited: !matches || current.exitSeen === true, reason: !current ? 'absent' : !matches ? 'identity-changed' : current.exitSeen ? 'exit-seen' : 'live' }
}

export function desktopProcessCandidates(processes, owned, { launcherPid, executablePath, profileRoot, launchedAt }) {
  const canonical = value => path.win32.normalize(value).toLowerCase()
  const same = (left, right) => left.created === right.created && left.CommandLine === right.CommandLine && left.ExecutablePath === right.ExecutablePath
  const ancestry = new Map([...owned].filter(([pid, record]) => {
    const current = processes.find(process => process.pid === pid)
    return !current || same(record, current)
  }))
  const selected = new Map()
  let changed = true
  while (changed) {
    changed = false
    for (const record of processes) {
      if (selected.has(record.pid) || !record.ExecutablePath || !record.CommandLine || !Number.isFinite(Date.parse(record.created))) continue
      const profile = /(?:^|\s)(?:"--user-data-dir=([^"]*)"|--user-data-dir="([^"]*)"|--user-data-dir=([^\s"]+))(?=\s|$)/.exec(record.CommandLine)
      if (!profile || canonical(profile[1] ?? profile[2] ?? profile[3]) !== canonical(profileRoot)) continue
      const previous = owned.get(record.pid)
      if (previous && !same(previous, record)) continue
      const parent = ancestry.get(record.parentPid)
      const launcher = record.pid === launcherPid && canonical(record.ExecutablePath) === canonical(executablePath) && Date.parse(record.created) >= launchedAt
      const descendant = parent && Date.parse(record.created) >= Date.parse(parent.created) && canonical(record.ExecutablePath).startsWith(canonical(profileRoot) + '\\')
      if (!launcher && !descendant) continue
      selected.set(record.pid, record)
      ancestry.set(record.pid, record)
      changed = true
    }
  }
  return [...selected.values()]
}

export async function cleanupDesktopProcesses({ owned, diagnostics, snapshot, terminate }) {
  diagnostics.cleanupErrors ??= []
  for (let attempt = 0; attempt < 3; attempt++) {
    let current
    try { current = await snapshot() } catch (error) {
      diagnostics.cleanupErrors.push({ phase: 'observe', attempt: attempt + 1, message: error.message })
      continue
    }
    const live = [...owned.values()].reverse().filter(record => !processCleanupState(record, current).exited)
    for (const record of live) {
      try { await terminate(record, attempt) } catch (error) { diagnostics.cleanupErrors.push({ pid: record.pid, attempt: attempt + 1, message: error.message }) }
    }
  }
  const remaining = await snapshot()
  diagnostics.cleanup = [...owned.values()].map(record => processCleanupState(record, remaining))
  if (diagnostics.cleanup.some(record => !record.exited)) throw new Error('Owned desktop test processes remain after cleanup')
}

export async function closePreservingFailure(application, original) {
  try { await application?.close() } catch (cleanupError) {
    if (!original) throw cleanupError
    original.cleanupError = cleanupError.stack ?? String(cleanupError)
  }
  if (original) throw original
}

export function windowsProcessCommand(pids, expected) {
  if (pids?.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) throw new Error('Invalid owned process identifier')
  if (expected && (pids?.length !== 1 || pids[0] !== expected.pid || !/^\d+$/.test(expected.started ?? '') || !expected.ExecutablePath || !expected.CommandLine || !Number.isFinite(Date.parse(expected.created)))) throw new Error('Owned process handle identity is unavailable; refusing termination')
  const literal = value => `'${value.replaceAll("'", "''")}'`
  const filter = pids ? ` WHERE ${pids.map(pid => `ProcessId = ${pid}`).join(' OR ')}` : ''
  const terminate = expected ? `if ($record.ProcessId -eq ${expected.pid} -and $created -ceq ${literal(expected.created)} -and $record.CommandLine -ceq ${literal(expected.CommandLine)} -and $record.ExecutablePath -ceq ${literal(expected.ExecutablePath)} -and $started -ceq ${literal(expected.started)} -and -not $handle.HasExited) { $handle.Kill(); $null = $handle.WaitForExit(3000); $exitSeen = $handle.HasExited }` : ''
  const handles = pids ? `
        $started = $null; $exitSeen = $true
        $identityWatch = [System.Diagnostics.Stopwatch]::StartNew()
        try {
          $handle = [System.Diagnostics.Process]::GetProcessById($record.ProcessId)
          try {
            $started = $handle.StartTime.ToUniversalTime().Ticks.ToString(); $exitSeen = $handle.HasExited
            ${terminate}
          } finally { $handle.Dispose() }
        } catch [System.ArgumentException] { $exitSeen = $true }
        $identityMs += $identityWatch.Elapsed.TotalMilliseconds
        $item.started = $started; $item.exitSeen = $exitSeen` : ''
  return `$ErrorActionPreference = 'Stop'
$watch = [System.Diagnostics.Stopwatch]::StartNew()
$null = [System.Reflection.Assembly]::LoadWithPartialName('System.Management')
$assemblyMs = $watch.Elapsed.TotalMilliseconds
$watch.Restart()
$searcher = [System.Management.ManagementObjectSearcher]::new('SELECT ProcessId,ParentProcessId,CreationDate,Name,CommandLine,ExecutablePath FROM Win32_Process${filter}')
$records = [System.Collections.Generic.List[object]]::new()
$identityMs = 0.0
try {
  $rows = $searcher.Get()
  try {
    foreach ($record in $rows) {
      try {
        $created = if ($record.CreationDate) { [DateTime]::SpecifyKind([System.Management.ManagementDateTimeConverter]::ToDateTime($record.CreationDate), [DateTimeKind]::Local).ToString('o') } else { $null }
        $item = @{ pid = $record.ProcessId; parentPid = $record.ParentProcessId; created = $created; Name = $record.Name; CommandLine = $record.CommandLine; ExecutablePath = $record.ExecutablePath }${handles}
        $records.Add($item)
      } finally { $record.Dispose() }
    }
  } finally { $rows.Dispose() }
} finally { $searcher.Dispose() }
ConvertTo-Json -Compress -Depth 4 -InputObject @{ observer = 'managed-wmi-v1'; records = @($records.ToArray()); timings = @{ assemblyMs = $assemblyMs; queryMs = $watch.Elapsed.TotalMilliseconds - $identityMs; identityMs = $identityMs } }`
}

function windowsProcessRecords(stdout, pids) {
  const invalid = () => { throw new Error('Invalid Windows process observation response') }
  let parsed
  try { parsed = JSON.parse(stdout) } catch { invalid() }
  if (parsed?.observer !== 'managed-wmi-v1' || !parsed.records || typeof parsed.records !== 'object') invalid()
  const records = Array.isArray(parsed.records) ? parsed.records : [parsed.records]
  const seen = new Set()
  const normalized = records.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) invalid()
    const fields = Object.fromEntries(Object.entries(record).map(([key, value]) => [key.toLowerCase(), value]))
    if (!Number.isSafeInteger(fields.pid) || fields.pid < 0 || !Number.isSafeInteger(fields.parentpid) || fields.parentpid < 0 || seen.has(fields.pid) || (pids && !pids.includes(fields.pid))) invalid()
    if (!['created', 'commandline', 'executablepath'].every(key => key in fields && (fields[key] === null || typeof fields[key] === 'string'))) invalid()
    if (pids && (!(fields.started === null || /^\d+$/.test(fields.started ?? '')) || typeof fields.exitseen !== 'boolean')) invalid()
    seen.add(fields.pid)
    return { pid: fields.pid, parentPid: fields.parentpid, created: fields.created, ...('name' in fields ? { Name: fields.name } : {}), CommandLine: fields.commandline, ExecutablePath: fields.executablepath, ...('started' in fields ? { started: fields.started, exitSeen: fields.exitseen } : {}) }
  })
  return { records: normalized, timings: parsed.timings }
}

export async function observeWindowsProcesses(pids, diagnostics, run = execute, timeout = 10_000, expected) {
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 10_000) throw new Error('Invalid Windows process observation deadline')
  if (pids?.length === 0) return []
  const command = windowsProcessCommand(pids, expected)
  const observation = { startedUtc: new Date().toISOString(), phase: diagnostics.phase, scope: pids ? 'owned-identity' : 'ancestry', pids, observer: 'managed-wmi-v1', timeoutMs: timeout }
  const start = performance.now()
  const summary = text => ({ bytes: Buffer.byteLength(text ?? ''), sha256: createHash('sha256').update(text ?? '').digest('hex'), redacted: true })
  let output
  try {
    output = await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout, maxBuffer: 4_000_000, windowsHide: true })
    const { records, timings } = windowsProcessRecords(output.stdout, pids)
    observation.records = records.length
    if (timings) observation.timings = Object.fromEntries(['assemblyMs', 'queryMs', 'identityMs'].filter(key => Number.isFinite(timings[key]) && timings[key] >= 0).map(key => [key, timings[key]]))
    return records
  } catch (error) {
    observation.error = { name: error.name, code: error.code ?? null, killed: error.killed ?? null, signal: error.signal ?? null, errno: error.errno ?? null, syscall: error.syscall ?? null, stdout: summary(error.stdout ?? output?.stdout), stderr: summary(error.stderr ?? output?.stderr) }
    throw error
  } finally {
    observation.endedUtc = new Date().toISOString()
    observation.durationMs = performance.now() - start
    ;(diagnostics.processObservations ??= []).push(observation)
  }
}

async function connectInspector(address, timeout) {
  const socket = new WebSocket(address)
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => { socket.close(); reject(new Error('Inspector connection timed out')) }, timeout)
    socket.addEventListener('open', () => { clearTimeout(timer); resolve() }, { once: true })
    socket.addEventListener('error', () => { clearTimeout(timer); socket.close(); reject(new Error('Inspector connection failed')) }, { once: true })
  })
  return socket
}

async function freePort() {
  const server = createServer()
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  const port = server.address().port
  await new Promise(resolve => server.close(resolve))
  return port
}

export async function offlineWindow(context, timeout) {
  const page = context.pages()[0] ?? await context.waitForEvent('page', { timeout })
  await page.waitForURL('ads://studio/', { waitUntil: 'domcontentloaded', timeout })
  await context.setOffline(true)
  await page.reload({ waitUntil: 'domcontentloaded', timeout })
  const network = await context.newCDPSession(page)
  await network.send('Network.enable')
  await network.send('Network.overrideNetworkState', { offline: true, latency: 0, downloadThroughput: -1, uploadThroughput: -1 })
  return page
}

// Portable NSIS launchers detach instead of forwarding Electron's stderr.
// Attach to test-supplied loopback ports, never add an inspector in the shell.
export async function launchDesktop({ executablePath, cwd, env, profileRoot, timeout = 60_000 }) {
  const inspectorPort = await freePort()
  const browserPort = await freePort()
  let log = ''
  const launchedAt = Date.now()
  const child = spawn(executablePath, [`--inspect-brk=127.0.0.1:${inspectorPort}`, `--remote-debugging-port=${browserPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profileRoot}`], { cwd, env: desktopEnvironment(env ?? process.env, profileRoot), stdio: ['ignore', 'pipe', 'pipe'] })
  console.log(`DESKTOP launcher PID ${child.pid}; verifier PID ${process.pid}; inspector ${inspectorPort}`)
  child.stdout.on('data', bytes => { log += bytes.toString() })
  child.stderr.on('data', bytes => { log += bytes.toString() })
  let spawnError
  child.on('error', error => { spawnError = error })
  const owned = new Map()
  const diagnostics = { executablePath, profileRoot, launcherPid: child.pid, inspectorPort, browserPort, phase: 'process-observation', targets: [], processes: [], cleanup: [] }
  child.once('exit', (code, signal) => { diagnostics.launcherExit = { code, signal }; diagnostics.launcherOutput = log })
  let socket, transport, browser, electronObject
  let cleaned = false
  const deadline = Date.now() + timeout
  const observationBudget = () => diagnostics.phase === 'cleanup' ? 10_000 : Math.min(10_000, deadline - Date.now())
  const track = async () => {
    if (process.platform !== 'win32') return []
    const processes = await observeWindowsProcesses(undefined, diagnostics, execute, observationBudget())
    const candidates = desktopProcessCandidates(processes, owned, { launcherPid: child.pid, executablePath, profileRoot, launchedAt })
    for (const record of candidates) {
      if (record.pid === process.pid) throw new Error('Refusing to track the verifier as a desktop child')
      const previous = owned.get(record.pid)
      if (!previous) console.log(`DESKTOP owned PID ${record.pid}: ${record.Name}`)
      owned.set(record.pid, { ...record, started: previous?.started, exitSeen: previous?.exitSeen })
    }
    diagnostics.processes = [...owned.values()]
    const identities = await observeWindowsProcesses(candidates.map(record => record.pid), diagnostics, execute, observationBudget())
    for (const record of identities) {
      const previous = owned.get(record.pid)
      if (!previous || record.created !== previous.created || record.CommandLine !== previous.CommandLine || record.ExecutablePath !== previous.ExecutablePath) continue
      if (previous.started && record.started && previous.started !== record.started) continue
      owned.set(record.pid, record)
    }
    diagnostics.processes = [...owned.values()]
    return identities
  }
  const cleanup = async () => {
    if (cleaned) return
    transport?.dispose()
    socket?.close()
    await browser?.close().catch(() => {})
    if (process.platform !== 'win32') { if (child.exitCode === null) child.kill(); return }
    diagnostics.phase = 'cleanup'
    await cleanupDesktopProcesses({ owned, diagnostics, snapshot: track, terminate: async (record, attempt) => {
        if (!record.started || !record.ExecutablePath) throw new Error('Owned process handle identity is unavailable; refusing termination')
        console.log(`DESKTOP cleanup PID ${record.pid}: ${record.Name}; attempt ${attempt + 1}`)
        await observeWindowsProcesses([record.pid], diagnostics, execute, 10_000, record)
      } })
    cleaned = true
  }
  const evaluate = async (callback, argument) => {
    const result = await transport.request('Runtime.callFunctionOn', { objectId: electronObject, functionDeclaration: `function(argument) { return (${callback.toString()})(this, argument) }`, arguments: [{ value: argument }], awaitPromise: true, returnByValue: true })
    return result.result?.value
  }
  try {
    while (Date.now() < deadline && !transport) {
      if (spawnError) throw spawnError
      await track()
      let targets = []
      try { targets = await (await fetch(`http://127.0.0.1:${inspectorPort}/json/list`, { signal: AbortSignal.timeout(1000) })).json() } catch {}
      for (const target of inspectorTargets(targets, inspectorPort)) {
        const listener = process.platform === 'win32' ? await inspectorListener(inspectorPort) : { address: '127.0.0.1', pid: child.pid }
        const current = await track()
        const liveOwned = [...owned.values()].filter(record => record.started && record.exitSeen === false && !processCleanupState(record, current).exited).map(record => record.pid)
        if (!ownsInspectorListener(listener, new Set(process.platform === 'win32' ? liveOwned : [child.pid]))) throw new Error('Inspector listener does not belong to this desktop test')
        socket = await connectInspector(target.webSocketDebuggerUrl, Math.min(3000, Math.max(1, deadline - Date.now())))
        const candidate = inspectorTransport(socket, Math.min(10_000, Math.max(1, deadline - Date.now())))
        diagnostics.targets.push({ type: target.type, title: target.title, url: target.url, listener })
        transport = candidate
        break
      }
      if (!transport) await delay(100)
    }
    if (!transport) throw new Error(`Portable Electron main inspector did not open; launcher exit ${JSON.stringify(diagnostics.launcherExit ?? 'still running')}: ${log}`)
    diagnostics.phase = 'runtime-inspector'
    electronObject = await captureMainExports(transport, profileRoot)
    await evaluate(({ app }) => app.whenReady().then(() => true))
    const runtime = await evaluate(() => ({ pid: process.pid, type: process.type, executable: process.execPath, versions: process.versions, argv: process.argv }))
    diagnostics.targets.at(-1).runtime = runtime
    if (runtime.type !== 'browser' || !runtime.versions.electron || runtime.pid !== diagnostics.targets.at(-1).listener.pid) throw new Error('Inspector target is not the owned Electron main process')
    browser = await chromium.connectOverCDP(`http://127.0.0.1:${browserPort}`, { timeout: Math.max(1, deadline - Date.now()) })
    const downloads = await browser.newBrowserCDPSession()
    await downloads.send('Browser.setDownloadBehavior', { behavior: 'default' })
    await downloads.detach()
    const context = browser.contexts()[0]
    diagnostics.phase = 'connected'
    return {
      evaluate, diagnostics,
      async firstWindow() { return offlineWindow(context, Math.max(1, deadline - Date.now())) },
      async close() {
        await evaluate(({ app }) => { setImmediate(() => app.quit()); return true }).catch(() => {})
        await cleanup()
      },
    }
  } catch (error) {
    diagnostics.failurePhase = diagnostics.phase
    error.diagnostics = diagnostics
    await closePreservingFailure({ close: cleanup }, error)
  }
}