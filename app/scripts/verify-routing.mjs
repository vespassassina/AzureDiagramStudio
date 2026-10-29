import assert from 'node:assert/strict'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron } from '@playwright/test'
import { desktopEnvironment } from './desktop-driver.mjs'
import { clickApplicationCommand } from './application-menus.mjs'
import { absolutePosition, entityTextGeometry } from '../src/model.ts'
import { PROFILE_NAME } from '../electron/policy.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
assert.ok(process.env.DGM142_OUTPUT, 'Build into DGM142_OUTPUT/source-app/dist first')
const output = path.resolve(root, process.env.DGM142_OUTPUT)
assert.ok(output.startsWith(path.join(root, 'test-results') + path.sep))
const source = path.join(output, 'source-app'), profile = path.join(output, 'profile'), workspace = path.join(output, 'workspace')
await mkdir(profile)
await mkdir(workspace)
await mkdir(path.join(profile, PROFILE_NAME))
await writeFile(path.join(profile, PROFILE_NAME, 'workspace-settings.json'), JSON.stringify({ version: 1, root: workspace }))
await mkdir(path.join(source, 'electron'), { recursive: true })
for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'workspace.mjs', 'preload.cjs']) await cp(path.join(root, 'electron', name), path.join(source, 'electron', name))
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'dgm142-owned-routing-check', type: 'module', version: metadata.version, main: 'electron/main.mjs' }))
await cp(fileURLToPath(import.meta.url), path.join(output, 'runner.mjs'))
const manifest = []
async function hashTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await hashTree(file)
    else manifest.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
  }
}
await hashTree(path.join(root, 'src'))
await hashTree(path.join(source, 'electron'))
await hashTree(path.join(source, 'dist'))
for (const name of ['scripts\\verify-routing.mjs', 'scripts\\application-menus.mjs', 'scripts\\desktop-driver.mjs', 'package.json', '..\\examples\\fabric-onelake.json']) {
  const file = path.resolve(root, name)
  manifest.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
}
await writeFile(path.join(output, 'inputs.json'), JSON.stringify(manifest, null, 2))
const report = { started: new Date().toISOString(), source, profile, modes: [], errors: [], workers: [], routingQuality: 'not yet asserted' }
let app, page, address, token, sequence = 0
async function tool(name, args = {}) {
  const response = await fetch(address, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name, arguments: args } }), signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.error, undefined)
  assert.notEqual(body.result.isError, true, body.result.content?.[0]?.text)
  return body.result
}
const read = async () => JSON.parse((await tool('get_document')).content[0].text)
const mutate = async (name, args = {}) => JSON.parse((await tool(name, { stateToken: (await read()).stateToken, ...args })).content[0].text)
async function waitChanged(token) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const state = await read()
    if (state.stateToken !== token) return state
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('Actual Auto-arrange did not publish')
}
async function saveBytes(result, file) {
  const [payload, metadata] = result.content
  const meta = JSON.parse(metadata.text)
  const data = payload.type === 'image' ? Buffer.from(payload.data, 'base64') : payload.resource.blob !== undefined ? Buffer.from(payload.resource.blob, 'base64') : Buffer.from(payload.resource.text)
  assert.equal(data.length, meta.byteLength)
  await writeFile(path.join(output, file), data)
  return data
}
function assertQuality(document, direction, arrangement, compact = true) {
  if (process.env.DGM143_SIZING === '1' && compact && arrangement === 'stacked') {
    const margins = document.entities.filter(entity => entity.kind === 'boundary').map(parent => {
      const children = document.entities.filter(entity => entity.parentId === parent.id && ['component', 'boundary'].includes(entity.kind))
      const top = Math.min(...children.map(child => child.y)) - entityTextGeometry(parent).textBottom
      const bottom = parent.height - Math.max(...children.map(child => child.y + child.height))
      const left = Math.min(...children.map(child => child.x))
      const right = parent.width - Math.max(...children.map(child => child.x + child.width))
      assert.ok(top >= 18 && top <= 48 && bottom >= 24 && bottom <= 48, `${parent.id}: measured vertical content margins ${top}/${bottom}`)
      assert.ok(left >= 24 && left <= 48 && right >= 24 && right <= 48, `${parent.id}: measured horizontal content margins ${left}/${right}`)
      return { id: parent.id, top, bottom, left, right }
    })
    const roots = document.entities.filter(entity => !entity.parentId && ['component', 'boundary'].includes(entity.kind))
    const axis = direction === 'DOWN' ? 'x' : 'y', cross = direction === 'DOWN' ? 'y' : 'x', size = direction === 'DOWN' ? 'width' : 'height'
    const gaps = roots.slice(1).map((entity, index) => entity[axis] - roots[index][axis] - roots[index][size])
    assert.ok(roots.every(entity => entity[cross] === roots[0][cross]), 'exact root transverse alignment')
    assert.ok(gaps.every(gap => gap === gaps[0] && gap > 0 && gap <= 160), `DGM143 compact positive equal root gaps: ${gaps}`)
    report.compactSizing ??= {}
    report.compactSizing[direction] = { margins, gaps }
  }
  if (document.entities.length === 2 && document.connections.length === 50 && document.connections.every(edge => edge.sourceSide === 'right' && edge.targetSide === 'left' && !edge.label)) {
    const from = document.entities.find(entity => entity.id === document.connections[0].from)
    const to = document.entities.find(entity => entity.id === document.connections[0].to)
    const cut = (from.x + from.width + to.x) / 2
    const crossings = document.connections.map(edge => {
      const ys = edge.points.slice(1).flatMap((b, i) => {
        const a = edge.points[i]
        return a.y === b.y && Math.min(a.x, b.x) < cut && Math.max(a.x, b.x) > cut ? [a.y] : []
      })
      assert.equal(ys.length, 1, `${edge.id}: one actual middle crossing`)
      return ys[0]
    }).sort((a, b) => a - b)
    for (let i = 1; i < crossings.length; i++) assert.ok(crossings[i] - crossings[i - 1] >= 2.1 - 1e-9, 'all fifty middle channels distinguishable, not short staircase proxies')
  }
  const spans = edge => edge.points.slice(1).flatMap((b, i) => {
    const a = edge.points[i], horizontal = a.y === b.y
    const low = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
    const high = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
    return high - low > 64 ? [{ horizontal, axis: horizontal ? a.y : a.x, low: low + 16, high: high - 16 }] : []
  })
  for (let i = 0; i < document.connections.length; i++) for (let j = 0; j < i; j++) {
    const a = document.connections[i], b = document.connections[j]
    if ([a.from, a.to].sort().join(':') !== [b.from, b.to].sort().join(':')) continue
    for (const x of spans(a)) for (const y of spans(b)) {
      if (x.horizontal === y.horizontal && Math.min(x.high, y.high) - Math.max(x.low, y.low) >= 32) assert.ok(Math.abs(x.axis - y.axis) >= 2.1 - 1e-9, `${a.id}/${b.id}: sustained parallel middle spans merge at 2.1px stroke`)
    }
  }
  const top = Math.min(...document.entities.filter(entity => entity.kind === 'boundary' && !entity.parentId).map(entity => entity.y))
  for (const edge of document.connections) {
    const points = edge.points
    const from = document.entities.find(entity => entity.id === edge.from), to = document.entities.find(entity => entity.id === edge.to)
    if (arrangement === 'stacked' && compact) {
      if (direction === 'DOWN') assert.ok(points.every(point => point.y >= top), `${edge.id}: no excursion above root group hull`)
      const forward = direction === 'DOWN' ? to.y > from.y : to.x > from.x
      if (from.parentId === to.parentId && forward) {
        const length = points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0)
        const direct = Math.abs(points[0].x - points.at(-1).x) + Math.abs(points[0].y - points.at(-1).y)
        assert.ok(length <= direct + 160, `${edge.id}: feasible local route, not a detour`)
      }
    }
    for (const entity of document.entities.filter(entity => entity.id !== edge.from && entity.id !== edge.to && ['component', 'boundary'].includes(entity.kind))) {
      const origin = absolutePosition(document, entity.id)
      const bottom = origin.y + (entity.kind === 'boundary' ? entityTextGeometry(entity).textBottom + 18 : entity.height)
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        const hit = Math.abs(a.x - b.x) < 1e-9
          ? a.x > origin.x + 1e-9 && a.x < origin.x + entity.width - 1e-9 && Math.max(a.y, b.y) > origin.y + 1e-9 && Math.min(a.y, b.y) < bottom - 1e-9
          : Math.abs(a.y - b.y) < 1e-9 && a.y > origin.y + 1e-9 && a.y < bottom - 1e-9 && Math.max(a.x, b.x) > origin.x + 1e-9 && Math.min(a.x, b.x) < origin.x + entity.width - 1e-9
        assert.equal(hit, false, `${edge.id}: clear ${entity.id} ${entity.kind === 'boundary' ? 'header' : 'interior'}`)
      }
    }
  }
}
try {
  app = await _electron.launch({ executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), args: [source, `--user-data-dir=${profile}`], cwd: source, env: desktopEnvironment(process.env, profile), timeout: 45000 })
  report.pid = app.process().pid
  report.versions = { hostNode: process.version, ...await app.evaluate(() => process.versions) }
  page = await app.firstWindow()
  page.on('worker', worker => {
    const receipt = { url: worker.url(), created: Date.now(), closed: null }
    report.workers.push(receipt)
    worker.on('close', () => { receipt.closed = Date.now() })
  })
  page.on('dialog', dialog => void dialog.accept())
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()) })
  await page.waitForURL('ads://studio/')
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.getByRole('dialog', { name: 'New diagram', exact: true }).getByRole('button', { name: 'Fabric', exact: true }).click()
  await clickApplicationCommand(page, 'Settings')
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await settings.getByText('Running on this device.', { exact: true }).waitFor()
  const clipboardBefore = await app.evaluate(({ clipboard }) => clipboard.readText())
  try {
    await settings.getByRole('button', { name: 'Copy MCP address', exact: true }).click()
    address = await app.evaluate(({ clipboard }) => clipboard.readText())
    await settings.getByText('MCP address copied.', { exact: true }).waitFor()
    await settings.getByRole('button', { name: 'Copy access token', exact: true }).click()
    token = await app.evaluate(({ clipboard }) => clipboard.readText())
  } finally { await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), clipboardBefore) }
  await settings.getByRole('button', { name: 'Done', exact: true }).click()
  const original = await read()
  await writeFile(path.join(output, 'actual-starter.json'), JSON.stringify(original.document, null, 2))
  const fixtures = [{ prefix: '', document: original.document }]
  for (const [prefix, inputFile] of [['complex-', process.env.DGM142_FIXTURE_FILE], ['parallel-', process.env.DGM142_PARALLEL_FILE]]) {
    if (!inputFile) continue
    const file = path.resolve(root, inputFile)
    assert.ok(file.startsWith(path.join(root, 'test-results') + path.sep))
    const input = JSON.parse(await readFile(file, 'utf8'))
    fixtures.push({ prefix, document: input.strictFixture ?? input })
  }
  async function importFixture(document, filename) {
    const file = path.join(output, filename)
    await writeFile(file, JSON.stringify(document, null, 2))
    const before = await read(), chooser = page.waitForEvent('filechooser')
    await clickApplicationCommand(page, 'Open JSON')
    await (await chooser).setFiles(file)
    const imported = await waitChanged(before.stateToken)
    assert.equal(imported.document.entities.length, document.entities.length)
    assert.equal(imported.document.connections.length, document.connections.length)
    return imported
  }
  for (const fixture of fixtures) {
  const baseline = fixture.prefix ? await importFixture(fixture.document, `${fixture.prefix}input.json`) : original
  for (const [label, direction, arrangement] of [
    ['Horizontal', 'RIGHT', 'standard'], ['Vertical', 'DOWN', 'standard'],
    ['Horizontal groups stacked vertically', 'RIGHT', 'stacked'], ['Vertical groups side by side', 'DOWN', 'stacked'],
  ]) {
    const name = `${fixture.prefix}${direction}-${arrangement}`
    const before = await read()
    await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
    await page.getByRole('menuitem', { name: label, exact: true }).click()
    const arranged = await waitChanged(before.stateToken)
    await writeFile(path.join(output, `${name}.json`), JSON.stringify(arranged.document, null, 2))
    await page.getByRole('menubar', { name: 'Application menus' }).getByRole('menuitem', { name: 'View menu', exact: true }).click()
    await page.getByRole('menu', { name: 'View', exact: true }).getByRole('menuitem', { name: 'Fit diagram', exact: true }).click()
    await page.waitForTimeout(600)
    await page.screenshot({ path: path.join(output, `${name}-editor.png`) })
    const snapshot = await saveBytes(await tool('snapshot_diagram', { stateToken: arranged.stateToken }), `${name}-snapshot.png`)
    const png = await saveBytes(await tool('export_diagram', { stateToken: arranged.stateToken, format: 'png' }), `${name}-export.png`)
    assert.deepEqual(png, snapshot)
    const svg = (await saveBytes(await tool('export_diagram', { stateToken: arranged.stateToken, format: 'svg' }), `${name}-export.svg`)).toString()
    const rendered = await page.evaluate(svg => {
      const svgDocument = new DOMParser().parseFromString(svg, 'image/svg+xml')
      return {
        editor: [...document.querySelectorAll('.react-flow__edge path[stroke-width="2.1"]')].map(element => element.getAttribute('d')),
        exported: [...svgDocument.querySelectorAll('path')].map(element => element.getAttribute('d')),
        strokes: [...document.querySelectorAll('.react-flow__edge path[stroke-width="2.1"]')].map(element => getComputedStyle(element).strokeWidth),
        editorArrows: [...document.querySelectorAll('.react-flow__edge path[stroke-width="2.1"][marker-end]')].length,
        exportArrows: [...svgDocument.querySelectorAll('path[stroke-width="2.1"][marker-end]')].length,
        text: [...svgDocument.querySelectorAll('text')].map(element => element.textContent).join(' '),
      }
    }, svg)
    for (const route of rendered.editor) assert.ok(rendered.exported.includes(route), 'Actual SVG and editor share routed path')
    assert.equal(rendered.editor.length, arranged.document.connections.length)
    assert.ok(rendered.strokes.every(stroke => stroke === '2.1px'))
    const arrows = arranged.document.connections.filter(edge => edge.arrow === 'forward' || edge.arrow === 'both').length
    assert.equal(rendered.editorArrows, arrows)
    assert.equal(rendered.exportArrows, arrows)
    for (const edge of arranged.document.connections) assert.ok(rendered.text.includes(edge.label), `${edge.id}: final export label preserved`)
    if (process.env.DGM142_CAPTURE_ONLY !== '1') assertQuality(arranged.document, direction, arrangement, !fixture.prefix)
    assert.deepEqual((await mutate('undo')).document, before.document)
    assert.deepEqual((await mutate('redo')).document, arranged.document)
    await mutate('undo')
    const http = await mutate('arrange_diagram', { direction, arrangement })
    assert.deepEqual(http.document.entities, arranged.document.entities, 'UI and HTTP use same geometry')
    assert.deepEqual(http.document.connections.map(({ routeRevision, ...edge }) => edge), arranged.document.connections.map(({ routeRevision, ...edge }) => edge), 'UI and HTTP routes')
    assert.deepEqual((await mutate('undo')).document, before.document)
    report.modes.push({ label, direction, arrangement, prefix: fixture.prefix, ui: true, http: true, exactUndoRedo: true, sameSvgPaths: true, samePngSnapshot: true })
    console.log(`PASS captured ${name}`)
  }
  assert.deepEqual(await read().then(state => state.document), baseline.document)
  }
  if (process.env.DGM142_DENSE_FILE) {
    report.workersBeforeCancellation = page.workers().map(worker => worker.url())
    const file = path.resolve(root, process.env.DGM142_DENSE_FILE)
    assert.ok(file.startsWith(path.join(root, 'test-results') + path.sep))
    const dense = JSON.parse(await readFile(file, 'utf8')).fixture
    const before = await importFixture(dense, 'domain-max-input.json')
    const created = page.waitForEvent('worker')
    const cancellation = new AbortController()
    const pending = fetch(address, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name: 'arrange_diagram', arguments: { stateToken: before.stateToken, direction: 'RIGHT' } } }), signal: cancellation.signal }).then(() => 'unexpected completion', error => error.name)
    const worker = await created
    assert.ok(worker.url().includes('layout-worker'))
    assert.equal(await page.getByRole('button', { name: 'Auto-arrange', exact: true }).isDisabled(), true, 'actual dense job is still pending')
    assert.equal(await page.getByRole('button', { name: 'Present', exact: true }).isDisabled(), true, 'existing UI guard is preserved')
    const started = Date.now()
    cancellation.abort()
    assert.equal(await pending, 'AbortError')
    await page.waitForFunction(() => !document.querySelector('[aria-label="Auto-arrange"]').disabled)
    assert.deepEqual((await read()).document, before.document, 'cancelled actual worker never commits')
    for (let attempt = 0; page.workers().length && attempt < 100; attempt++) await page.waitForTimeout(20)
    const remainingWorkerCountAfterCancellation = page.workers().length
    const cancelMilliseconds = Date.now() - started
    const retryStarted = Date.now()
    const retry = await mutate('arrange_diagram', { direction: 'RIGHT' })
    assert.equal(retry.document.connections.length, 150)
    assertQuality(retry.document, 'RIGHT', 'standard', false)
    assert.deepEqual((await mutate('undo')).document, before.document)
    report.cancellation = { actualWorkerPending: true, authenticatedRequestDisconnectCancelledWithoutCommit: true, existingPresentationGuardPreserved: true, workerGone: remainingWorkerCountAfterCancellation === 0, remainingWorkerCountAfterCancellation, cancelMilliseconds, retryMilliseconds: Date.now() - retryStarted, retryConnections: 150, exactUndo: true }
    await writeFile(path.join(output, 'domain-max-retry.json'), JSON.stringify(retry.document, null, 2))
    // Collect the independent retry/history evidence even if earlier completed
    // jobs left targets behind. Preserve the original cancellation-time oracle.
    assert.equal(remainingWorkerCountAfterCancellation, 0)
  }
  assert.deepEqual(report.errors, [])
  if (process.env.DGM142_CAPTURE_ONLY === '1') report.routingQuality = 'CAPTURE ONLY — no routing-quality pass claimed'
  else {
    report.routingQuality = 'FAIL unless every stored actual UI/HTTP case meets quality assertions'
    for (const { direction, arrangement, prefix } of report.modes) {
      const document = JSON.parse(await readFile(path.join(output, `${prefix}${direction}-${arrangement}.json`), 'utf8'))
      assertQuality(document, direction, arrangement, !prefix)
    }
    report.routingQuality = 'PASS'
  }
} catch (error) {
  report.failure = error.stack
  if (page && !page.isClosed()) report.liveWorkersAtFailure = page.workers().map(worker => worker.url())
  if (page && !page.isClosed()) {
    const cdp = await app.context().newCDPSession(page)
    report.workerTargetsAtFailure = (await cdp.send('Target.getTargets')).targetInfos.filter(target => target.type === 'worker')
    await cdp.detach()
  }
  if (page && !page.isClosed()) report.liveWorkerProbes = await Promise.all(page.workers().map(worker => Promise.race([
    worker.evaluate(() => performance.now()).then(time => ({ url: worker.url(), reachable: true, time }), error => ({ url: worker.url(), reachable: false, error: error.message })),
    new Promise(resolve => setTimeout(() => resolve({ url: worker.url(), probeTimedOut: true }), 500)),
  ])))
  if (page && !page.isClosed()) report.failureStatus = await page.evaluate(() => [...document.querySelectorAll('[role="status"],.statusbar')].map(element => element.textContent))
  throw error
} finally {
  if (app) await app.close()
  report.finished = new Date().toISOString()
  report.ownedAppClosed = true
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
}
