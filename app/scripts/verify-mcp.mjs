import assert from 'node:assert/strict'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { _electron } from '@playwright/test'
import { desktopEnvironment } from './desktop-driver.mjs'

// Source-only verification: use an already built isolated output, never replace
// dist, packaged releases or old profiles. Tokens remain in memory, not receipts.
const root = fileURLToPath(new URL('../', import.meta.url))
const evidence = path.resolve(root, process.env.DGM131_EVIDENCE_ROOT ?? path.join('test-results', 'dgm131-owner', 'source-smoke'))
const source = path.join(evidence, 'source-app')
const profile = path.join(root, 'test-results', `d131p-${Date.now()}`)
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const report = { startedUtc: new Date().toISOString(), startedLocal: new Date().toString(), version: metadata.version, source, profile, checks: [], errors: [] }
await mkdir(path.join(source, 'electron'), { recursive: true })
await mkdir(profile, { recursive: true })
for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'preload.cjs']) await cp(path.join(root, 'electron', name), path.join(source, 'electron', name))
await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'dgm131-source-smoke', type: 'module', version: metadata.version, main: 'electron/main.mjs' }))
const inputs = []
async function manifest(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await manifest(file)
    else if (/\.(?:tsx?|css|mjs|cjs|json)$/.test(entry.name)) inputs.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
  }
}
await manifest(path.join(root, 'src'))
await manifest(path.join(source, 'electron'))
await manifest(path.join(source, 'dist', 'assets'))
await writeFile(path.join(evidence, 'source-inputs.json'), JSON.stringify(inputs, null, 2))
let application, address, token
let sequence = 0
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
async function rpc(method, params) {
  const response = await fetch(address, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream', 'mcp-protocol-version': '2025-06-18' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, ...(params ? { params } : {}) }), signal: AbortSignal.timeout(8000) })
  assert.equal(response.status, 200)
  const value = await response.json()
  assert.equal(value.error, undefined, JSON.stringify(value.error))
  return value.result
}
async function tool(name, args = {}) { return rpc('tools/call', { name, arguments: args }) }
const value = result => { assert.notEqual(result.isError, true, result.content[0].text); return JSON.parse(result.content[0].text) }
const read = async () => value(await tool('get_document'))
async function waitDocument(predicate) {
  for (let attempt = 0; attempt < 100; attempt++) {
    const result = await tool('get_document')
    if (!result.isError) { const state = value(result); if (predicate(state)) return state }
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('Current document did not reach expected committed state')
}
async function mutate(name, args = {}) { const state = await read(); return value(await tool(name, { stateToken: state.stateToken, ...args })) }
try {
  application = await _electron.launch({
    executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: [source, `--user-data-dir=${profile}`], cwd: source, env: desktopEnvironment(process.env, profile), timeout: 45000,
  })
  const page = await application.firstWindow()
  page.on('pageerror', error => report.errors.push(error.message))
  let confirmation = 'accept', confirmations = 0
  page.on('dialog', dialog => { confirmations++; void (confirmation === 'accept' ? dialog.accept() : dialog.dismiss()) })
  await page.waitForURL('ads://studio/')
  await page.getByRole('main', { name: 'Architecture canvas' }).waitFor()
  const starter = page.getByRole('dialog', { name: 'New diagram', exact: true })
  if (await starter.isVisible()) await starter.getByRole('button', { name: 'Blank', exact: true }).click()
  const settings = () => page.getByRole('navigation', { name: 'Drawing tools' }).getByRole('button', { name: 'Settings', exact: true })
  await settings().click()
  const dialog = page.getByRole('dialog', { name: 'Settings', exact: true })
  await dialog.getByText('Running on this device.', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Copy MCP address', exact: true }).click()
  address = await application.evaluate(({ clipboard }) => clipboard.readText())
  assert.match(address, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/)
  await dialog.getByText('MCP address copied.', { exact: true }).waitFor()
  await dialog.getByRole('button', { name: 'Copy access token', exact: true }).click()
  token = await application.evaluate(({ clipboard }) => clipboard.readText())
  assert.match(token, /^[a-f0-9]{64}$/)
  assert.equal((await dialog.innerText()).includes(token), false)
  await dialog.getByText('Access token copied.', { exact: true }).waitFor()
  const runtime = await application.evaluate(({ app, BrowserWindow }) => ({ version: app.getVersion(), preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences() }))
  assert.equal(runtime.version, metadata.version)
  assert.equal(runtime.preferences.sandbox, true)
  assert.equal(runtime.preferences.contextIsolation, true)
  assert.equal(runtime.preferences.nodeIntegration, false)
  assert.equal(await page.evaluate(() => typeof Reflect.get(globalThis, 'require')), 'undefined')
  check('actual source Electron, sandboxed preload, real Settings address/token copies (secret not displayed)')
  assert.equal((await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'DGM131 source verifier', version: '1' } })).protocolVersion, '2025-06-18')
  assert.equal((await fetch(address)).status, 401)
  const initial = await waitDocument(() => true)
  assert.equal((await tool('edit_diagram', { stateToken: initial.stateToken, commands: [{ type: 'metadata', patch: { title: 'Modal must reject' } }] })).isError, true)
  check('authenticated HTTP initialize/discovery and Settings modal write guard')
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  const title = page.getByRole('textbox', { name: 'Document title', exact: true })
  await title.fill('Unfinished local draft')
  const draftRead = await read()
  assert.notEqual(draftRead.document.title, 'Unfinished local draft')
  assert.equal((await tool('edit_diagram', { stateToken: draftRead.stateToken, commands: [{ type: 'metadata', patch: { title: 'Must not overwrite draft' } }] })).isError, true)
  await settings().click()
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  assert.equal(await title.inputValue(), 'Unfinished local draft')
  await title.press('Enter')
  await page.getByRole('main', { name: 'Architecture canvas' }).click({ position: { x: 30, y: 120 } })
  await waitDocument(state => state.document.title === 'Unfinished local draft')
  check('unfinished UI title excluded/protected, Settings preserves it, normal Enter publishes committed edit')
  const catalog = value(await tool('search_catalog', { query: 'service', limit: 3 }))
  assert.ok(catalog.entries.length > 0)
  const templates = value(await tool('list_templates')).templates
  assert.ok(templates.some(template => template.key === 'web-api'))
  assert.equal(value(await tool('get_app_info')).version, metadata.version)
  check('catalog/template identities and running app version over HTTP')
  confirmation = 'dismiss'
  const beforeCancel = await read()
  assert.equal((await tool('create_diagram', { stateToken: beforeCancel.stateToken })).isError, true)
  assert.deepEqual(await read(), beforeCancel)
  confirmation = 'accept'
  await mutate('create_diagram', { template: 'web-api' })
  assert.ok((await read()).document.entities.length > 0)
  await mutate('create_diagram')
  assert.equal((await read()).document.entities.length, 0)
  check('real unsaved-work confirmation cancels atomically; template and blank use normal replacement')
  const component = (id, x, parentId) => ({ id, kind: 'component', label: id, icon: 'service', color: 'teal', x, y: 100, width: 240, height: 88, ...(parentId ? { parentId } : {}) })
  const beforeBatch = await read()
  const edited = await mutate('edit_diagram', { commands: [
    { type: 'metadata', patch: { title: 'MCP live diagram', description: '# Created through MCP\nNative history and persistence.' } },
    { type: 'addEntity', entity: { id: 'b', kind: 'boundary', label: 'Remote boundary', color: 'gray', x: 20, y: 50, width: 850, height: 500 } },
    { type: 'addEntity', entity: component('a', 50, 'b') },
    { type: 'addEntity', entity: component('z', 1000) },
    { type: 'addEntity', entity: { id: 't', kind: 'text', label: 'Remote text', color: 'gray', x: 20, y: 650, width: 240, height: 60 } },
    { type: 'addEntity', entity: { id: 'r', kind: 'rectangle', label: 'Remote rectangle', color: 'teal', x: 400, y: 650, width: 240, height: 80 } },
    { type: 'connect', connection: { id: 'e', from: 'a', to: 'z', label: 'Remote call', style: 'solid', arrow: 'forward' } },
  ] })
  assert.equal(edited.document.entities.length, 5)
  await title.waitFor()
  await page.waitForFunction(() => document.querySelector('[aria-label="Document title"]')?.value === 'MCP live diagram')
  const failed = await tool('edit_diagram', { stateToken: edited.stateToken, commands: [
    { type: 'metadata', patch: { title: 'Rollback this' } }, { type: 'resize', id: 'does-not-exist', width: 20, height: 20 },
  ] })
  assert.equal(failed.isError, true)
  assert.deepEqual(await read(), edited)
  await mutate('edit_diagram', { commands: [
    { type: 'updateEntity', id: 'a', patch: { label: 'Remote updated' } },
    { type: 'move', positions: [{ id: 'a', x: 100, y: 120 }] },
    { type: 'resize', id: 'b', width: 900, height: 550 },
    { type: 'updateConnection', id: 'e', patch: { style: 'dashed', label: 'Changed connection' } },
    { type: 'order', ids: ['z'], position: 'top' },
  ] })
  await mutate('undo')
  assert.deepEqual((await read()).document, edited.document)
  assert.equal((await tool('edit_diagram', { stateToken: edited.stateToken, commands: [{ type: 'metadata', patch: { title: 'ABA stale' } }] })).isError, true)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  await waitDocument(state => state.document.entities.length === 0)
  assert.deepEqual((await read()).document, beforeBatch.document)
  await page.getByRole('button', { name: 'Redo', exact: true }).click()
  await waitDocument(state => state.document.entities.length === 5)
  await mutate('redo')
  assert.equal((await read()).document.entities.find(entity => entity.id === 'a').label, 'Remote updated')
  check('atomic native edit batches, actual UI updates, whole-batch rollback, one-step UI Undo/Redo and ABA stale-token rejection')
  await mutate('edit_diagram', { commands: [
    { type: 'group', ids: ['z'], boundary: { id: 'g', kind: 'boundary', label: 'Group', color: 'gray', x: 950, y: 50, width: 400, height: 300 } },
    { type: 'reparent', ids: ['a'], parentId: null },
    { type: 'ungroup', boundaryIds: ['g'] },
    { type: 'remove', entityIds: ['r', 't', 'z'], connectionIds: ['e'] },
  ] })
  assert.deepEqual((await read()).document.entities.map(entity => entity.id).sort(), ['a', 'b'])
  await mutate('arrange_diagram', { direction: 'DOWN' })
  assert.equal((await read()).document.direction, 'DOWN')
  check('group/reparent/ungroup/order/remove and real Auto-arrange worker through canonical commands')
  await page.getByRole('button', { name: 'Present', exact: true }).click()
  const presenting = await read()
  assert.equal((await tool('edit_diagram', { stateToken: presenting.stateToken, commands: [{ type: 'metadata', patch: { title: 'Blocked in Present' } }] })).isError, true)
  await page.getByRole('button', { name: 'Exit presentation', exact: true }).click()
  check('Present interaction rejects remote mutation')
  const durable = await read()
  await page.waitForFunction(() => document.querySelector('.save-label')?.textContent === 'Saved on this device')
  await page.reload()
  await page.getByRole('main', { name: 'Architecture canvas' }).waitFor()
  const recovered = await waitDocument(state => state.document.title === durable.document.title)
  assert.deepEqual(recovered.document, durable.document)
  assert.notEqual(recovered.stateToken, durable.stateToken)
  assert.equal((await tool('undo', { stateToken: durable.stateToken })).isError, true)
  check('autosave survives actual reload, new renderer token invalidates earlier writes')
  await settings().click()
  for (const [width, height] of [[390, 844], [720, 450]]) {
    await page.setViewportSize({ width, height })
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme)
      const bounds = await dialog.boundingBox()
      assert.ok(bounds && bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= width + 1 && bounds.y + bounds.height <= height + 1)
      for (const name of ['Copy MCP address', 'Copy access token', 'Done']) {
        const button = dialog.getByRole('button', { name, exact: true })
        await button.scrollIntoViewIfNeeded()
        await button.click({ trial: true })
      }
      await page.screenshot({ path: path.join(evidence, `settings-${width}x${height}-${theme}.png`) })
    }
  }
  check('390x844 and 720x450 Settings reachable in both themes')
  await application.close()
  application = undefined
  await assert.rejects(fetch(address, { signal: AbortSignal.timeout(1000) }))
  check('owned app shutdown closes the real listener')
  const previousToken = token
  application = await _electron.launch({
    executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'),
    args: [source, `--user-data-dir=${profile}`], cwd: source, env: desktopEnvironment(process.env, profile), timeout: 45000,
  })
  const restarted = await application.firstWindow()
  await restarted.getByRole('main', { name: 'Architecture canvas' }).waitFor()
  await restarted.getByRole('navigation', { name: 'Drawing tools' }).getByRole('button', { name: 'Settings', exact: true }).click()
  const restartedSettings = restarted.getByRole('dialog', { name: 'Settings', exact: true })
  await restartedSettings.getByText('Running on this device.', { exact: true }).waitFor()
  await restartedSettings.getByRole('button', { name: 'Copy MCP address', exact: true }).click()
  address = await application.evaluate(({ clipboard }) => clipboard.readText())
  await restartedSettings.getByRole('button', { name: 'Copy access token', exact: true }).click()
  token = await application.evaluate(({ clipboard }) => clipboard.readText())
  assert.notEqual(token, previousToken)
  assert.equal((await fetch(address, { headers: { authorization: `Bearer ${previousToken}` } })).status, 401)
  assert.deepEqual((await waitDocument(() => true)).document, durable.document)
  check('actual app restart rotates bearer token, rejects old credential and recovers saved MCP edits')
  report.confirmations = confirmations
  assert.deepEqual(report.errors, [])
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'
  // Error text never includes Authorization/request bodies or the copied token.
  report.failure = String(error.message).replaceAll(token ?? '\0', '[REDACTED]')
  console.error(report.failure)
  process.exitCode = 1
} finally {
  if (application) await application.close()
  if (address) {
    let closed = false
    try { await fetch(address, { signal: AbortSignal.timeout(1000) }) } catch { closed = true }
    report.listenerClosed = closed
    if (!closed) { report.status = 'failed'; process.exitCode = 1 }
  }
  report.finishedUtc = new Date().toISOString()
  report.finishedLocal = new Date().toString()
  await writeFile(path.join(evidence, 'source-electron-smoke.json'), JSON.stringify(report, null, 2))
}
