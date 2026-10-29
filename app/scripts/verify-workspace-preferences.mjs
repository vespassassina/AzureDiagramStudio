import assert from 'node:assert/strict'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron } from '@playwright/test'
import { desktopEnvironment } from './desktop-driver.mjs'
import { clickApplicationCommand } from './application-menus.mjs'
import { favoritesBeforeRestart, favoritesAfterRestart, favoritesStorageFailures } from './favorites-acceptance.mjs'

// Source-Electron + actual sandbox IPC + actual file writes, with ONLY native
// dialog adapters mocked. This does not claim human-native dialog acceptance.
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.resolve(root, process.env.DGM138_OUTPUT ?? path.join('test-results', 'dgm138-owner', `runtime-${Date.now()}`))
assert.ok(output.startsWith(path.join(root, 'test-results') + path.sep))
const source = path.join(output, 'source-app'), profile = path.join(output, 'profile')
await mkdir(output, { recursive: true })
await mkdir(profile)
await mkdir(path.join(source, 'electron'), { recursive: true })
for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'workspace.mjs', 'preload.cjs']) await cp(path.join(root, 'electron', name), path.join(source, 'electron', name))
const documents = path.join(output, 'owned-documents'), custom = path.join(output, 'custom-root')
await mkdir(documents); await mkdir(custom)
await writeFile(path.join(source, 'bootstrap.mjs'), `
import { app, dialog } from 'electron'
app.setPath('documents', ${JSON.stringify(documents)})
globalThis.nativeAdapter = { calls: [], folder: null, cancel: false, override: null }
dialog.showOpenDialog = async () => ({ canceled: !globalThis.nativeAdapter.folder, filePaths: globalThis.nativeAdapter.folder ? [globalThis.nativeAdapter.folder] : [] })
dialog.showSaveDialog = async (_window, options) => {
  const adapter = globalThis.nativeAdapter
  adapter.calls.push(options)
  return { canceled: adapter.cancel, filePath: adapter.override ?? options.defaultPath }
}
await import('./electron/main.mjs')
`)
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'dgm138-source', type: 'module', version: metadata.version, main: 'bootstrap.mjs' }))
const report = { started: new Date().toISOString(), nativeDialogs: 'mocked dispatch; NOT human acceptance', pids: [], checks: [], errors: [] }
const manifest = []
async function hashTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await hashTree(file)
    else manifest.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
  }
}
await hashTree(path.join(root, 'src')); await hashTree(source)
manifest.push({ path: path.relative(root, fileURLToPath(import.meta.url)), sha256: createHash('sha256').update(await readFile(fileURLToPath(import.meta.url))).digest('hex') })
for (const name of ['favorites-acceptance.mjs', 'desktop-driver.mjs', 'application-menus.mjs']) manifest.push({ path: `scripts\\${name}`, sha256: createHash('sha256').update(await readFile(path.join(root, 'scripts', name))).digest('hex') })
await writeFile(path.join(output, 'inputs.json'), JSON.stringify(manifest, null, 2))
let app, page, address, token, sequence = 0
let favoritePreference
const verifyFavorites = process.env.DGM139_ACCEPTANCE === '1'
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
async function launch() {
  app = await _electron.launch({ executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), args: [source, `--user-data-dir=${profile}`], cwd: source, env: desktopEnvironment(process.env, profile), timeout: 45000 })
  report.pids.push(app.process().pid)
  page = await app.firstWindow()
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()) })
  page.on('dialog', dialog => void dialog.accept())
  await page.waitForURL('ads://studio/')
  await page.getByRole('main', { name: 'Architecture canvas' }).waitFor()
}
async function settings() {
  await clickApplicationCommand(page, 'Settings')
  return page.getByRole('dialog', { name: 'Settings', exact: true })
}
async function credentials(dialog) {
  await dialog.getByText('Running on this device.', { exact: true }).waitFor()
  const previous = await app.evaluate(({ clipboard }) => clipboard.readText())
  try {
    await dialog.getByRole('button', { name: 'Copy MCP address', exact: true }).click()
    address = await app.evaluate(({ clipboard }) => clipboard.readText())
    await dialog.getByRole('button', { name: 'Copy access token', exact: true }).click()
    token = await app.evaluate(({ clipboard }) => clipboard.readText())
  } finally { await app.evaluate(({ clipboard }, value) => clipboard.writeText(value), previous) }
}
async function tool(name, args = {}) {
  const response = await fetch(address, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name, arguments: args } }), signal: AbortSignal.timeout(8000) })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.error, undefined, JSON.stringify(body))
  assert.notEqual(body.result.isError, true, JSON.stringify(body))
  return body.result
}
async function current() { return JSON.parse((await tool('get_document')).content[0].text) }
async function waitSaved() {
  await page.waitForFunction(() => document.body.textContent.includes('Saved on this device'))
}
async function nativeCalls() { return app.evaluate(() => globalThis.nativeAdapter.calls) }
async function save() {
  const count = (await nativeCalls()).length
  await clickApplicationCommand(page, 'Save JSON')
  for (let i = 0; i < 100; i++) {
    const calls = await nativeCalls()
    if (calls.length > count) {
      await page.waitForTimeout(100)
      return calls.at(-1).defaultPath
    }
    await page.waitForTimeout(30)
  }
  throw new Error('Native save adapter not dispatched')
}
try {
  await launch()
  await page.getByRole('dialog', { name: 'New diagram', exact: true }).getByRole('button', { name: 'Blank', exact: true }).click()
  let dialog = await settings()
  assert.equal(await dialog.getByLabel('Current workspace root').textContent(), path.join(documents, 'AzureDiagramStudio'))
  assert.deepEqual(await readdir(documents), [])
  await dialog.getByRole('button', { name: 'Choose folder', exact: true }).click()
  await dialog.getByText(/Folder selection canceled/).waitFor()
  await app.evaluate((_electron, folder) => { globalThis.nativeAdapter.folder = folder }, custom)
  await dialog.getByRole('button', { name: 'Choose folder', exact: true }).click()
  await dialog.getByText('Workspace root saved for this app profile.', { exact: true }).waitFor()
  assert.equal(await dialog.getByLabel('Current workspace root').textContent(), custom)
  await credentials(dialog)
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await waitSaved()
  check('OS Documents default, lazy settings, canceled chooser, explicit custom preference')
  const before = await current()
  if (verifyFavorites) {
    favoritePreference = await favoritesBeforeRestart(page, output, 'desktop')
    // Reload changes the lifetime token, but not the canonical document.
    assert.deepEqual((await current()).document, before.document)
    const state = await current()
    await favoritesStorageFailures(page, favoritePreference)
    assert.deepEqual((await current()).document, state.document)
    check('Favorites peer category, pointer/keyboard/search, close/reopen, reload and explicit storage failures without diagram changes')
  }
  const firstPath = await save()
  assert.equal(path.dirname(path.dirname(firstPath)), custom)
  assert.deepEqual(JSON.parse(await readFile(firstPath, 'utf8')), before.document)
  const idDirectory = `workspace-${createHash('sha256').update(before.document.id).digest('hex')}`
  assert.equal(path.basename(path.dirname(firstPath)), idDirectory)
  const edited = JSON.parse((await tool('edit_diagram', { stateToken: (await current()).stateToken, commands: [{ type: 'metadata', patch: { title: 'Renamed' } }] })).content[0].text)
  const renamedPath = await save()
  assert.equal(path.dirname(renamedPath), path.dirname(firstPath))
  assert.equal(path.basename(renamedPath), 'Renamed.json')
  await app.evaluate(() => { globalThis.nativeAdapter.cancel = true })
  await save()
  await page.getByText('Save canceled. No file was written.', { exact: true }).waitFor()
  await app.evaluate((_electron, file) => { globalThis.nativeAdapter.cancel = false; globalThis.nativeAdapter.override = file }, path.join(output, 'explicit-override.json'))
  await save()
  assert.deepEqual(JSON.parse(await readFile(path.join(output, 'explicit-override.json'), 'utf8')), edited.document)
  await app.evaluate(() => { globalThis.nativeAdapter.override = null })
  check('actual UI Save JSON -> typed IPC -> stable native defaults, cancel and explicit override')
  for (const [action, extension, companion] of [['Export SVG', 'svg', false], ['Export PNG 1x', 'png', false], ['Export SVG', 'zip', true], ['Export Markdown 1x', 'md', false]]) {
    const count = (await nativeCalls()).length
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const exportDialog = page.getByRole('dialog', { name: 'Export diagram', exact: true })
    if (companion) await exportDialog.getByRole('checkbox', { name: 'Include Markdown', exact: true }).check()
    if (extension === 'md') await exportDialog.getByRole('radio', { name: 'Markdown with embedded PNG', exact: true }).check()
    await exportDialog.getByRole('button', { name: action, exact: true }).click()
    for (let i = 0; (await nativeCalls()).length === count && i < 100; i++) await page.waitForTimeout(50)
    const calls = await nativeCalls()
    assert.equal(calls.length, count + 1)
    const file = calls.at(-1).defaultPath
    assert.equal(file, path.join(path.dirname(firstPath), `Renamed.${extension}`))
    for (let i = 0; i < 100; i++) {
      try { assert.ok((await readFile(file)).length > 0); break } catch (error) { if (i === 99) throw error; await page.waitForTimeout(50) }
    }
  }
  check('actual UI SVG, PNG, Markdown companion ZIP and embedded Markdown -> native defaults and real files')
  const beforeOutput = await current(), callsBeforeOutput = (await nativeCalls()).length, filesBeforeOutput = await readdir(custom)
  const outputResult = await tool('export_diagram', { stateToken: beforeOutput.stateToken, format: 'json' })
  assert.equal(outputResult.content[0].type, 'resource')
  assert.deepEqual(await current(), beforeOutput)
  assert.equal((await nativeCalls()).length, callsBeforeOutput)
  assert.deepEqual(await readdir(custom), filesBeforeOutput)
  check('authenticated HTTP MCP export remains in-memory, no native dialog or workspace directory')
  await waitSaved()
  await page.screenshot({ path: path.join(output, 'desktop.png') })
  await app.close(); app = undefined
  await launch()
  dialog = await settings()
  await dialog.getByLabel('Current workspace root').waitFor()
  assert.equal(await dialog.getByLabel('Current workspace root').textContent(), custom)
  await credentials(dialog)
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  assert.deepEqual((await current()).document, edited.document)
  assert.equal(await save(), renamedPath)
  if (verifyFavorites) {
    const state = await current()
    await favoritesAfterRestart(page, favoritePreference)
    assert.deepEqual(await current(), state)
    check('actual same-profile desktop restart retains Favorites without HTTP document/token/history contamination')
  }
  check('actual same-profile desktop restart retains custom root, canonical recovery and stable workspace')
  dialog = await settings()
  await dialog.getByRole('button', { name: 'Reset to default', exact: true }).click()
  await dialog.getByText('Workspace root saved for this app profile.', { exact: true }).waitFor()
  assert.equal(await dialog.getByLabel('Current workspace root').textContent(), path.join(documents, 'AzureDiagramStudio'))
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  const resetPath = await save()
  assert.equal(path.dirname(path.dirname(resetPath)), path.join(documents, 'AzureDiagramStudio'))
  assert.deepEqual(JSON.parse(await readFile(renamedPath, 'utf8')), edited.document)
  check('explicit reset changes subsequent native destination without moving old files')
  await app.close(); app = undefined
  await launch()
  dialog = await settings()
  await dialog.getByLabel('Current workspace root').waitFor()
  assert.equal(await dialog.getByLabel('Current workspace root').textContent(), path.join(documents, 'AzureDiagramStudio'))
  await credentials(dialog)
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  const firstNew = JSON.parse((await tool('create_diagram', { stateToken: (await current()).stateToken })).content[0].text)
  const firstNewPath = await save()
  const secondNew = JSON.parse((await tool('create_diagram', { stateToken: firstNew.stateToken })).content[0].text)
  const secondNewPath = await save()
  assert.equal(firstNew.document.title, secondNew.document.title)
  assert.notEqual(firstNew.document.id, secondNew.document.id)
  assert.notEqual(path.dirname(firstNewPath), path.dirname(secondNewPath))
  assert.equal(path.dirname(path.dirname(firstNewPath)), path.join(documents, 'AzureDiagramStudio'))
  check('actual second restart preserves explicit reset; equal-title new documents receive distinct workspace defaults')
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.passed = false; report.failure = error.stack
  console.error(error)
  process.exitCode = 1
} finally {
  if (app) await app.close()
  report.finished = new Date().toISOString()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
}
