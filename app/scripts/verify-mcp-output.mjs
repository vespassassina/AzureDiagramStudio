import assert from 'node:assert/strict'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron } from '@playwright/test'
import { desktopEnvironment } from './desktop-driver.mjs'
import { clickApplicationCommand } from './application-menus.mjs'
import { parseDocument } from '../src/document/index.ts'

// Source-only acceptance. Build into OUTPUT/source-app/dist first. Every run
// requires a fresh profile/receipt, never a normal profile or published package.
const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.resolve(root, process.env.DGM135_OUTPUT ?? path.join('test-results', 'dgm135-owner', `runtime-${Date.now()}`))
assert.ok(output.startsWith(`${path.join(root, 'test-results')}${path.sep}`), 'Evidence must stay inside app/test-results')
const source = path.join(output, 'source-app'), profile = path.join(output, 'profile')
await mkdir(output, { recursive: true })
await mkdir(profile) // Refuse to reuse a profile, including a failed first run.
await mkdir(path.join(source, 'electron'), { recursive: true })
for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'workspace.mjs', 'preload.cjs']) await cp(path.join(root, 'electron', name), path.join(source, 'electron', name))
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'dgm135-source-acceptance', type: 'module', version: metadata.version, main: 'electron/main.mjs' }))
const report = { started: new Date().toISOString(), source, profile, checks: [], outputs: [], errors: [] }
const manifest = []
async function hashTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await hashTree(file)
    else manifest.push({ path: path.relative(root, file), sha256: hash(await readFile(file)) })
  }
}
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
await hashTree(path.join(root, 'src'))
await hashTree(path.join(source, 'electron'))
await hashTree(path.join(source, 'dist'))
manifest.push({ path: 'scripts\\verify-mcp-output.mjs', sha256: hash(await readFile(fileURLToPath(import.meta.url))) })
for (const name of ['application-menus.mjs', 'desktop-driver.mjs']) manifest.push({ path: `scripts\\${name}`, sha256: hash(await readFile(path.join(root, 'scripts', name))) })
await writeFile(path.join(output, 'inputs.json'), JSON.stringify(manifest, null, 2))
let app, page, address, token, sequence = 0, downloads = 0, dialogs = 0
const check = name => { report.checks.push(name); console.log(`PASS ${name}`) }
async function rpc(method, params) {
  const response = await fetch(address, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method, params }), signal: AbortSignal.timeout(8000) })
  assert.equal(response.status, 200)
  return response.json()
}
async function tool(name, args = {}) {
  const body = await rpc('tools/call', { name, arguments: args })
  assert.equal(body.error, undefined, JSON.stringify(body.error))
  return body.result
}
function value(result) { assert.notEqual(result.isError, true, result.content[0].text); return JSON.parse(result.content[0].text) }
const read = async () => value(await tool('get_document'))
async function mutation(name, args = {}) { return value(await tool(name, { stateToken: (await read()).stateToken, ...args })) }
async function waitReady() {
  for (let index = 0; index < 120; index++) {
    const result = await tool('get_document')
    if (!result.isError) return value(result)
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('Renderer snapshot did not become available')
}
async function bytes(result, stateToken, label) {
  assert.notEqual(result.isError, true, result.content[0].text)
  assert.equal(result.content.length, 2)
  const [payload, metadata] = result.content
  const meta = JSON.parse(metadata.text)
  assert.deepEqual(Object.keys(meta).sort(), ['byteLength', 'filename', 'mimeType', 'stateToken'])
  assert.equal(meta.stateToken, stateToken)
  const data = payload.type === 'image' ? Buffer.from(payload.data, 'base64') :
    payload.resource.blob !== undefined ? Buffer.from(payload.resource.blob, 'base64') : Buffer.from(payload.resource.text, 'utf8')
  assert.equal(data.length, meta.byteLength)
  assert.equal(payload.mimeType ?? payload.resource.mimeType, meta.mimeType)
  if (payload.resource) assert.equal(payload.resource.uri, `diagrammer://exports/${encodeURIComponent(stateToken)}/${meta.filename}`)
  assert.ok(Buffer.byteLength(JSON.stringify({ ok: true, output: result })) <= 8 * 1024 * 1024)
  await writeFile(path.join(output, `${label}-${meta.filename}`), data)
  report.outputs.push({ label, ...meta, sha256: hash(data) })
  return { data, meta }
}
async function decodePng(data) {
  assert.deepEqual([...data.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  const dimensions = await page.evaluate(async base64 => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, data.toString('base64'))
  assert.ok(dimensions.width > 0 && dimensions.height > 0)
  return dimensions
}
try {
  app = await _electron.launch({ executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), args: [source, `--user-data-dir=${profile}`], cwd: source, env: desktopEnvironment(process.env, profile), timeout: 45000 })
  report.pid = app.process().pid
  page = await app.firstWindow()
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()) })
  page.on('download', () => downloads++)
  page.on('dialog', dialog => { dialogs++; void dialog.accept() })
  await page.waitForURL('ads://studio/')
  await page.getByRole('main', { name: 'Architecture canvas' }).waitFor()
  const starter = page.getByRole('dialog', { name: 'New diagram', exact: true })
  await starter.waitFor()
  await starter.getByRole('button', { name: 'Blank', exact: true }).click()
  await clickApplicationCommand(page, 'Settings')
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await settings.getByText('Running on this device.', { exact: true }).waitFor()
  const previousClipboard = await app.evaluate(({ clipboard }) => clipboard.readText())
  try {
    await settings.getByRole('button', { name: 'Copy MCP address', exact: true }).click()
    address = await app.evaluate(({ clipboard }) => clipboard.readText())
    await settings.getByText('MCP address copied.', { exact: true }).waitFor()
    await settings.getByRole('button', { name: 'Copy access token', exact: true }).click()
    token = await app.evaluate(({ clipboard }) => clipboard.readText())
  } finally { await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), previousClipboard) }
  assert.equal((await fetch(address)).status, 401)
  const tools = (await rpc('tools/list', {})).result.tools
  await writeFile(path.join(output, 'tools.json'), JSON.stringify(tools, null, 2))
  assert.ok(tools.some(tool => tool.name === 'snapshot_diagram'))
  const modalState = await waitReady()
  assert.equal((await tool('snapshot_diagram', { stateToken: modalState.stateToken })).isError, true)
  await settings.getByRole('button', { name: 'Done', exact: true }).click()
  check('authenticated source Electron discovery, unchanged anonymous rejection and modal guard')
  await mutation('create_diagram')
  const description = '# MCP architecture\n\nExact Unicode: 世界 — café.\n'
  const entity = (id, x, parentId, kind = 'component') => ({ id, kind, label: id, color: 'teal', x, y: 80, width: kind === 'boundary' ? 1000 : 220, height: kind === 'boundary' ? 500 : 88, ...(parentId ? { parentId } : {}) })
  await mutation('edit_diagram', { commands: [
    { type: 'metadata', patch: { title: 'DGM135 MCP architecture', description } },
    ...[entity('boundary', 0, undefined, 'boundary'), entity('API', 30, 'boundary'), entity('Database', 320, 'boundary')].map(entity => ({ type: 'addEntity', entity })),
    { type: 'connect', connection: { id: 'flow', from: 'API', to: 'Database', label: 'requests', style: 'solid', arrow: 'forward' } },
  ] })
  const arranged = await mutation('arrange_diagram', { direction: 'RIGHT', arrangement: 'stacked' })
  assert.ok(arranged.document.connections[0].points.length > 1)
  const first = await bytes(await tool('snapshot_diagram', { stateToken: arranged.stateToken }), arranged.stateToken, 'before-edit')
  report.snapshotDimensions = await decodePng(first.data)
  check('HTTP create -> edit -> real stacked ELK -> full PNG snapshot independently decoded')
  const edited = await mutation('edit_diagram', { commands: [{ type: 'updateEntity', id: 'API', patch: { label: 'Edited API via authenticated MCP' } }] })
  assert.equal((await tool('snapshot_diagram', { stateToken: arranged.stateToken })).isError, true)
  await page.locator('.react-flow__node[data-id="API"]').click()
  await page.locator('.react-flow__node[data-id="API"].selected').waitFor()
  const dialogsBeforeOutput = dialogs
  const snapshot = await bytes(await tool('snapshot_diagram', { stateToken: edited.stateToken }), edited.stateToken, 'after-edit')
  report.editedSnapshotDimensions = await decodePng(snapshot.data)
  assert.notEqual(hash(snapshot.data), hash(first.data))
  const uiBefore = await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme, selected: [...document.querySelectorAll('.selected')].map(element => element.className),
    camera: document.querySelector('.react-flow__viewport')?.getAttribute('style'),
    undo: document.querySelector('[aria-label="Undo"]')?.getAttribute('disabled'),
    preferences: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
  }))
  const exports = new Map()
  for (const format of ['svg', 'png', 'json', 'markdown']) {
    const exported = await bytes(await tool('export_diagram', { stateToken: edited.stateToken, format }), edited.stateToken, `export-${format}`)
    exports.set(format, exported)
    if (format === 'png') { await decodePng(exported.data); assert.equal(hash(exported.data), hash(snapshot.data)) }
    if (format === 'svg') {
      const svg = await page.evaluate(text => {
        const document = new DOMParser().parseFromString(text, 'image/svg+xml')
        return { root: document.documentElement.localName, errors: document.querySelectorAll('parsererror').length, text: [...document.querySelectorAll('text')].map(element => element.textContent).join(' ') }
      }, exported.data.toString('utf8'))
      assert.equal(svg.root, 'svg'); assert.equal(svg.errors, 0)
      assert.ok(svg.text.includes('Edited API via authenticated MCP'))
    }
    if (format === 'json') {
      const parsed = parseDocument(exported.data.toString('utf8'))
      assert.equal(parsed.ok, true)
      assert.deepEqual(parsed.value, edited.document)
    }
    if (format === 'markdown') {
      const markdown = exported.data.toString('utf8')
      assert.ok(markdown.startsWith(description))
      const png = Buffer.from(/data:image\/png;base64,([A-Za-z0-9+/=]+)\)/.exec(markdown)[1], 'base64')
      assert.equal(hash(png), hash(snapshot.data))
      await decodePng(png)
      await writeFile(path.join(output, 'inline.png'), png)
    }
  }
  for (const format of ['svg', 'png', 'json']) {
    const zip = await bytes(await tool('export_diagram', { stateToken: edited.stateToken, format, includeMarkdown: true }), edited.stateToken, `zip-${format}`)
    const filename = path.join(output, `zip-${format}-${zip.meta.filename}`)
    const decoded = JSON.parse(execFileSync('python', ['-c', 'import sys,zipfile,json,base64; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n:base64.b64encode(z.read(n)).decode() for n in z.namelist()}))', filename], { encoding: 'utf8' }))
    const members = Object.keys(decoded)
    assert.equal(members.length, 2)
    const diagram = members.find(name => name.endsWith(`.${format}`)), markdown = members.find(name => name.endsWith('.md'))
    assert.equal(hash(Buffer.from(decoded[diagram], 'base64')), hash(exports.get(format).data))
    assert.equal(Buffer.from(decoded[markdown], 'base64').toString('utf8'), description)
  }
  assert.deepEqual(await read(), edited)
  assert.deepEqual(await page.evaluate(() => ({
    theme: document.documentElement.dataset.theme, selected: [...document.querySelectorAll('.selected')].map(element => element.className),
    camera: document.querySelector('.react-flow__viewport')?.getAttribute('style'),
    undo: document.querySelector('[aria-label="Undo"]')?.getAttribute('disabled'),
    preferences: Object.fromEntries(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])),
  })), uiBefore)
  assert.equal(downloads, 0)
  assert.equal(dialogs, dialogsBeforeOutput)
  check('all native exports, inline PNG and three same-state ZIPs decoded with Python zipfile; no downloads/state/camera/selection/theme changes')
  for (const args of [
    { format: 'png', scale: 2, transparent: true },
    { format: 'png', background: 'white', aspect: '16:9', includeGrid: true },
    { format: 'svg', background: 'white', aspect: '16:9', includeGrid: false },
    { format: 'markdown', scale: 2, transparent: true },
  ]) {
    const options = await bytes(await tool('export_diagram', { stateToken: edited.stateToken, ...args }), edited.stateToken, `options-${report.outputs.length}`)
    if (args.format === 'png') {
      const dimensions = await decodePng(options.data)
      if (args.scale === 2) {
        assert.deepEqual(dimensions, { width: report.editedSnapshotDimensions.width * 2, height: report.editedSnapshotDimensions.height * 2 })
        const alpha = await page.evaluate(async base64 => {
          const image = new Image()
          image.src = `data:image/png;base64,${base64}`
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
          const context = canvas.getContext('2d')
          context.drawImage(image, 0, 0)
          return context.getImageData(0, 0, 1, 1).data[3]
        }, options.data.toString('base64'))
        assert.equal(alpha, 0)
      }
      if (args.aspect === '16:9') assert.ok(Math.abs(dimensions.width / dimensions.height - 16 / 9) < 0.01)
    }
  }
  for (const args of [{ format: 'json', scale: 1 }, { format: 'markdown', includeMarkdown: true }, { format: 'png', path: 'forbidden' }]) {
    assert.equal((await rpc('tools/call', { name: 'export_diagram', arguments: { stateToken: edited.stateToken, ...args } })).error.code, -32602)
  }
  const title = page.getByRole('textbox', { name: 'Document title', exact: true })
  await title.fill('Uncommitted UI draft')
  assert.equal((await tool('snapshot_diagram', { stateToken: edited.stateToken })).isError, true)
  assert.deepEqual(await read(), edited)
  await title.press('Escape')
  await page.getByRole('main', { name: 'Architecture canvas' }).click({ position: { x: 30, y: 120 } })
  check('normal image options plus invalid input, stale-token and unfinished-draft rejection')
  // Reads must not add history. Undo still reverses the single preceding edit.
  const undone = await mutation('undo')
  assert.deepEqual(undone.document, arranged.document)
  const redone = await mutation('redo')
  assert.deepEqual(redone.document, edited.document)
  await page.waitForFunction(() => document.querySelector('.save-label')?.textContent === 'Saved on this device')
  await page.reload()
  await page.getByRole('main', { name: 'Architecture canvas' }).waitFor()
  const recovered = await waitReady()
  assert.deepEqual(recovered.document, redone.document)
  assert.notEqual(recovered.stateToken, redone.stateToken)
  assert.equal((await tool('snapshot_diagram', { stateToken: redone.stateToken })).isError, true)
  const fresh = await bytes(await tool('snapshot_diagram', { stateToken: recovered.stateToken }), recovered.stateToken, 'after-reload')
  assert.equal(hash(fresh.data), hash(snapshot.data))
  check('exports leave history/autosave intact; actual reload rejects prior-generation tokens and renders freshly')
  await page.screenshot({ path: path.join(output, 'source-app.png') })
  assert.deepEqual(report.errors, [])
  report.status = 'passed'
} catch (error) {
  report.status = 'failed'; report.failure = error.stack
  if (page) await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  throw error
} finally {
  if (app) await app.close()
  report.finished = new Date().toISOString()
  report.downloads = downloads
  report.dialogs = dialogs
  report.closed = true
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
}
