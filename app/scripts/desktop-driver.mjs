import { execFile, spawn } from 'node:child_process'
import { createServer } from 'node:net'
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
  const matches = current?.created === record.created && current?.CommandLine === record.CommandLine
  return { pid: record.pid, created: record.created, exited: !matches || current.exitSeen === true, reason: !current ? 'absent' : !matches ? 'identity-changed' : current.exitSeen ? 'exit-seen' : 'live' }
}

export async function closePreservingFailure(application, original) {
  try { await application?.close() } catch (cleanupError) {
    if (!original) throw cleanupError
    original.cleanupError = cleanupError.stack ?? String(cleanupError)
  }
  if (original) throw original
}

async function windowsProcesses() {
  const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', "@(Get-CimInstance Win32_Process | Select-Object @{n='pid';e={$_.ProcessId}},@{n='parentPid';e={$_.ParentProcessId}},@{n='created';e={$_.CreationDate.ToString('o')}},Name,CommandLine,@{n='started';e={try {$handle=[System.Diagnostics.Process]::GetProcessById($_.ProcessId); try {$handle.StartTime.ToUniversalTime().Ticks.ToString()} finally {$handle.Dispose()}} catch {$null}}},@{n='exitSeen';e={try {$handle=[System.Diagnostics.Process]::GetProcessById($_.ProcessId); try {$handle.HasExited} finally {$handle.Dispose()}} catch {$true}}}) | ConvertTo-Json -Compress"], { timeout: 10_000, maxBuffer: 4_000_000, windowsHide: true })
  return JSON.parse(stdout || '[]')
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

// Portable NSIS launchers detach instead of forwarding Electron's stderr.
// Attach to test-supplied loopback ports, never add an inspector in the shell.
export async function launchDesktop({ executablePath, cwd, env, profileRoot, timeout = 60_000 }) {
  const inspectorPort = await freePort()
  const browserPort = await freePort()
  let log = ''
  const child = spawn(executablePath, [`--inspect-brk=127.0.0.1:${inspectorPort}`, `--remote-debugging-port=${browserPort}`, '--remote-debugging-address=127.0.0.1', `--user-data-dir=${profileRoot}`], { cwd, env: desktopEnvironment(env ?? process.env, profileRoot), stdio: ['ignore', 'pipe', 'pipe'] })
  console.log(`DESKTOP launcher PID ${child.pid}; verifier PID ${process.pid}; inspector ${inspectorPort}`)
  child.stdout.on('data', bytes => { log += bytes.toString() })
  child.stderr.on('data', bytes => { log += bytes.toString() })
  let spawnError
  child.on('error', error => { spawnError = error })
  const owned = new Map()
  const diagnostics = { executablePath, profileRoot, launcherPid: child.pid, inspectorPort, browserPort, targets: [], processes: [], cleanup: [] }
  let socket, transport, browser, electronObject
  let cleaned = false
  const deadline = Date.now() + timeout
  const track = async () => {
    if (process.platform !== 'win32') return
    const processes = await windowsProcesses()
    const roots = new Set([...owned.values()].filter(record => !processCleanupState(record, processes).exited).map(record => record.pid))
    if (child.exitCode === null && child.pid && !owned.has(child.pid)) roots.add(child.pid)
    for (const record of ownedProcessTree(processes, roots)) {
      if (record.pid === process.pid) throw new Error('Refusing to track the verifier as a desktop child')
      if (!record.CommandLine?.toLowerCase().includes(profileRoot.toLowerCase()) || record.exitSeen) continue
      const previous = owned.get(record.pid)
      if (!previous || previous.created === record.created) {
        if (!previous) console.log(`DESKTOP owned PID ${record.pid}: ${record.Name}`)
        owned.set(record.pid, record)
      }
    }
    diagnostics.processes = [...owned.values()]
  }
  const cleanup = async () => {
    if (cleaned) return
    transport?.dispose()
    socket?.close()
    await browser?.close().catch(() => {})
    await track()
    if (process.platform !== 'win32') { if (child.exitCode === null) child.kill(); return }
    diagnostics.cleanupErrors = []
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await windowsProcesses()
      const live = [...owned.values()].reverse().filter(record => !processCleanupState(record, current).exited)
      if (!live.length) break
      for (const record of live) {
        console.log(`DESKTOP cleanup PID ${record.pid}: ${record.Name}; attempt ${attempt + 1}`)
        const commandLine = record.CommandLine.replaceAll("'", "''")
        const command = `$record = Get-CimInstance Win32_Process -Filter 'ProcessId = ${record.pid}'; if ($record -and $record.CreationDate.ToString('o') -eq '${record.created}' -and $record.CommandLine -ceq '${commandLine}') { $handle = [System.Diagnostics.Process]::GetProcessById(${record.pid}); try { if (-not $handle.HasExited -and $handle.StartTime.ToUniversalTime().Ticks.ToString() -eq '${record.started}') { $handle.Kill(); $null = $handle.WaitForExit(3000) } } finally { $handle.Dispose() } }`
        try { await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command], { timeout: 10_000, windowsHide: true }) }
        catch (error) { diagnostics.cleanupErrors.push({ pid: record.pid, message: error.message }) }
      }
      await delay(100)
    }
    const remaining = await windowsProcesses()
    diagnostics.cleanup = [...owned.values()].map(record => processCleanupState(record, remaining))
    if (diagnostics.cleanup.some(record => !record.exited)) throw new Error('Owned desktop test processes remain after cleanup')
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
        await track()
        if (!ownsInspectorListener(listener, new Set([child.pid, ...owned.keys()]))) throw new Error('Inspector listener does not belong to this desktop test')
        socket = await connectInspector(target.webSocketDebuggerUrl, Math.min(3000, Math.max(1, deadline - Date.now())))
        const candidate = inspectorTransport(socket, Math.min(10_000, Math.max(1, deadline - Date.now())))
        diagnostics.targets.push({ type: target.type, title: target.title, url: target.url, listener })
        transport = candidate
        break
      }
      if (!transport) await delay(100)
    }
    if (!transport) throw new Error(`Portable Electron main inspector did not open: ${log}`)
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
    return {
      evaluate, diagnostics,
      async firstWindow() { return context.pages()[0] ?? await context.waitForEvent('page', { timeout: Math.max(1, deadline - Date.now()) }) },
      async close() {
        await evaluate(({ app }) => { setImmediate(() => app.quit()); return true }).catch(() => {})
        await cleanup()
      },
    }
  } catch (error) {
    error.diagnostics = diagnostics
    await closePreservingFailure({ close: cleanup }, error)
  }
}