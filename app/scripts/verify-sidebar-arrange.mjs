import assert from 'node:assert/strict'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { _electron } from '@playwright/test'
import { desktopEnvironment } from './desktop-driver.mjs'
import { clickApplicationCommand } from './application-menus.mjs'
import { readActiveDocument } from './startup-fixture.mjs'
import { absolutePosition, createDocument, entityTextGeometry } from '../src/model.ts'
import { PROFILE_NAME } from '../electron/policy.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.resolve(root, process.env.DGM137_OUTPUT ?? path.join('test-results', 'dgm137-owner', new Date().toISOString().replace(/[:.]/g, '-')))
const source = path.join(output, 'source-app')
const profile = path.join(output, 'profile')
await mkdir(path.join(source, 'electron'), { recursive: true })
await mkdir(profile, { recursive: true })
await cp(fileURLToPath(import.meta.url), path.join(output, 'runner.mjs'))
const workspace = path.join(output, 'workspace')
await mkdir(workspace, { recursive: true })
await mkdir(path.join(profile, PROFILE_NAME), { recursive: true })
await writeFile(path.join(profile, PROFILE_NAME, 'workspace-settings.json'), JSON.stringify({ version: 1, root: workspace }))
for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'workspace.mjs', 'preload.cjs']) await cp(path.join(root, 'electron', name), path.join(source, 'electron', name))
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'dgm137-source-verification', type: 'module', version: metadata.version, main: 'electron/main.mjs' }))
const report = { started: new Date().toISOString(), source, profile, workspace, http: [], cells: [], errors: [] }
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
for (const name of ['application-menus.mjs', 'desktop-driver.mjs', 'startup-fixture.mjs']) manifest.push({ path: `scripts\\${name}`, sha256: createHash('sha256').update(await readFile(path.join(root, 'scripts', name))).digest('hex') })
const node = (id, parentId, kind = 'component') => ({ id, parentId: parentId ?? null, kind, label: id, color: 'teal', x: 30, y: 80, width: kind === 'boundary' ? 1000 : 220, height: kind === 'boundary' ? 700 : 88 })
const fixture = {
  ...createDocument('dgm137-live', 'DGM137 live geometry'), description: '# Stored Markdown',
  entities: [
    node('a', null, 'boundary'), node('a1', 'a'), node('a2', 'a'),
    node('nested', 'a', 'boundary'), node('n1', 'nested'), node('n2', 'nested'),
    node('b', null, 'boundary'), node('b1', 'b'), node('b2', 'b'), node('root-node'),
    node('note', 'a', 'text'),
  ],
  connections: [
    ['ea', 'a1', 'a2'], ['en', 'n1', 'n2'], ['eb', 'b1', 'b2'],
    ['cross', 'a2', 'b1'], ['nested-cross', 'n2', 'b2'], ['root-edge', 'b2', 'root-node'],
  ].map(([id, from, to]) => ({ id, from, to, label: id, style: 'solid', arrow: 'forward', ...(id === 'cross' ? { sourceSide: 'right', targetSide: 'top' } : {}) })),
}
const strictFixture = structuredClone(fixture)
strictFixture.entities.splice(7, 0,
  node('nested-sibling', 'a', 'boundary'), { ...node('s1', 'nested-sibling'), width: 310, height: 120 }, { ...node('s2', 'nested-sibling'), width: 180, height: 90 },
  { ...node('d1', 'nested-sibling'), width: 200, height: 150 }, { ...node('d2', 'nested-sibling'), width: 260, height: 100 },
)
strictFixture.entities.push(node('disconnected', null, 'boundary'), { ...node('z1', 'disconnected'), width: 410, height: 180 }, node('z2', 'disconnected'))
strictFixture.connections.push(...[
  ['sibling-edge', 's1', 's2'], ['deep-edge', 'd1', 'd2'], ['sibling-cross', 'n2', 's1'],
  ['cycle-back', 'root-node', 'd1'], ['inside-cycle', 'a2', 'a1'], ['sibling-cycle', 's2', 'n1'],
].map(([id, from, to]) => ({ id, from, to, label: id, style: 'solid', arrow: 'forward', ...(id === 'cycle-back' ? { sourceSide: 'bottom', targetSide: 'left' } : {}) })))
await writeFile(path.join(output, 'fixtures.json'), JSON.stringify({ fixture, strictFixture }, null, 2))
for (const file of [path.join(output, 'runner.mjs'), path.join(output, 'fixtures.json'), path.join(profile, PROFILE_NAME, 'workspace-settings.json')]) {
  manifest.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
}
await writeFile(path.join(output, 'inputs.json'), JSON.stringify(manifest, null, 2))
const modes = [
  ['Horizontal', 'RIGHT', 'standard'], ['Vertical', 'DOWN', 'standard'],
  ['Horizontal groups stacked vertically', 'RIGHT', 'stacked'], ['Vertical groups side by side', 'DOWN', 'stacked'],
]

function assertLayout(document, direction, arrangement, original) {
  const byId = new Map(document.entities.map(entity => [entity.id, entity]))
  const order = (ids, axis) => {
    const size = axis === 'x' ? 'width' : 'height'
    for (let index = 1; index < ids.length; index++) assert.ok(byId.get(ids[index])[axis] >= byId.get(ids[index - 1])[axis] + byId.get(ids[index - 1])[size], `${ids}: ordered and disjoint on ${axis}`)
  }
  for (const ids of [['a1', 'a2'], ['b1', 'b2'], ['n1', 'n2']]) order(ids, direction === 'RIGHT' ? 'x' : 'y')
  order(['a', 'b', 'root-node'], (direction === 'RIGHT') !== (arrangement === 'stacked') ? 'x' : 'y')
  if (arrangement === 'stacked') {
    const rootUnits = document.entities.filter(entity => !entity.parentId && ['component', 'boundary'].includes(entity.kind))
    const shared = (units, axis) => assert.ok(units.every(unit => Math.abs(unit[axis] - units[0][axis]) < 0.001), `No stagger on ${axis}: ${JSON.stringify(units.map(({ id, x, y }) => ({ id, x, y })))}`)
    shared(rootUnits, direction === 'RIGHT' ? 'x' : 'y')
    const axis = direction === 'RIGHT' ? 'y' : 'x'
    const size = axis === 'x' ? 'width' : 'height'
    order(rootUnits.map(unit => unit.id), axis)
    const gaps = rootUnits.slice(1).map((unit, index) => unit[axis] - rootUnits[index][axis] - rootUnits[index][size])
    assert.ok(gaps.every(gap => Math.abs(gap - gaps[0]) < 0.001), `Uniform root gaps: ${gaps}`)
    for (const boundary of document.entities.filter(entity => entity.kind === 'boundary')) {
      const children = document.entities.filter(entity => entity.parentId === boundary.id && ['component', 'boundary'].includes(entity.kind))
      order(children.map(unit => unit.id), direction === 'RIGHT' ? 'x' : 'y')
      shared(children, direction === 'RIGHT' ? 'y' : 'x')
    }
  }
  for (const entity of document.entities.filter(entity => entity.parentId && entity.kind !== 'text')) {
    const parent = byId.get(entity.parentId)
    assert.ok(entity.x >= 0 && entity.y >= entityTextGeometry(parent).textBottom + 18)
    assert.ok(entity.x + entity.width <= parent.width && entity.y + entity.height <= parent.height)
  }
  assert.deepEqual(absolutePosition(document, 'note'), absolutePosition(original, 'note'))
  for (const edge of document.connections) {
    assert.ok(edge.points.length >= 2 && edge.labelPosition && Number.isFinite(edge.labelPosition.x))
    for (let index = 1; index < edge.points.length; index++) assert.ok(edge.points[index].x === edge.points[index - 1].x || edge.points[index].y === edge.points[index - 1].y, `${edge.id}: orthogonal route`)
    for (const [id, point, side] of [[edge.from, edge.points[0], edge.sourceSide], [edge.to, edge.points.at(-1), edge.targetSide]]) {
      const entity = byId.get(id), origin = absolutePosition(document, id)
      const near = (a, b) => Math.abs(a - b) < 0.1
      assert.ok(point.x >= origin.x - 0.1 && point.x <= origin.x + entity.width + 0.1 && point.y >= origin.y - 0.1 && point.y <= origin.y + entity.height + 0.1)
      assert.ok(near(point.x, origin.x) || near(point.x, origin.x + entity.width) || near(point.y, origin.y) || near(point.y, origin.y + entity.height))
      if (side === 'right') assert.ok(near(point.x, origin.x + entity.width))
      if (side === 'top') assert.ok(near(point.y, origin.y))
      if (side === 'left') assert.ok(near(point.x, origin.x))
      if (side === 'bottom') assert.ok(near(point.y, origin.y + entity.height))
    }
  }
}

let app, page, address, token, sequence = 0
async function call(name, args = {}) {
  const response = await fetch(address, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', accept: 'application/json, text/event-stream' }, body: JSON.stringify({ jsonrpc: '2.0', id: ++sequence, method: 'tools/call', params: { name, arguments: args } }), signal: AbortSignal.timeout(20000) })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.equal(body.error, undefined, JSON.stringify(body.error))
  assert.notEqual(body.result.isError, true, body.result.content?.[0]?.text)
  return JSON.parse(body.result.content[0].text)
}
const read = () => call('get_document')
async function mutation(name, args = {}) { return call(name, { stateToken: (await read()).stateToken, ...args }) }
async function seedFixture(document) {
  await mutation('create_diagram')
  await mutation('edit_diagram', { commands: [
    { type: 'metadata', patch: { title: document.title, description: document.description } },
    ...document.entities.map(entity => ({ type: 'addEntity', entity })),
    ...document.connections.map(connection => ({ type: 'connect', connection })),
  ] })
}
async function waitFor(predicate) {
  for (let attempt = 0; attempt < 160; attempt++) {
    const state = await read()
    if (predicate(state)) return state
    await new Promise(resolve => setTimeout(resolve, 50))
  }
  throw new Error('Canonical live state did not reach expected value')
}
try {
  app = await _electron.launch({ executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), args: [source, `--user-data-dir=${profile}`], cwd: source, env: desktopEnvironment(process.env, profile), timeout: 45000 })
  report.pid = app.process().pid
  await app.evaluate(({ BrowserWindow }) => {
    globalThis.dgm137Lifecycle = []
    const contents = BrowserWindow.getAllWindows()[0].webContents
    for (const name of ['did-start-loading', 'did-finish-load', 'did-fail-load', 'render-process-gone']) contents.on(name, () => globalThis.dgm137Lifecycle.push({ name, time: Date.now(), url: contents.getURL() }))
  })
  page = await app.firstWindow()
  await page.evaluate(() => {
    window.dgm137Errors = []
    window.addEventListener('error', event => window.dgm137Errors.push({ message: event.message, name: event.error?.name }))
    window.addEventListener('unhandledrejection', event => window.dgm137Errors.push({ rejection: String(event.reason) }))
  })
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()) })
  page.on('dialog', dialog => void dialog.accept())
  await page.waitForURL('ads://studio/')
  await page.getByRole('main', { name: 'Architecture canvas' }).waitFor()
  const starter = page.getByRole('dialog', { name: 'New diagram', exact: true })
  await starter.waitFor()
  await starter.getByRole('button', { name: 'Blank', exact: true }).click()
  await clickApplicationCommand(page, 'Settings')
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true })
  await settings.getByText('Running on this device.', { exact: true }).waitFor()
  const previousClipboard = await app.evaluate(({ clipboard }) => clipboard.readText())
  await settings.getByRole('button', { name: 'Copy MCP address', exact: true }).click()
  address = await app.evaluate(({ clipboard }) => clipboard.readText())
  await settings.getByText('MCP address copied.', { exact: true }).waitFor()
  await settings.getByRole('button', { name: 'Copy access token', exact: true }).click()
  token = await app.evaluate(({ clipboard }) => clipboard.readText())
  await app.evaluate(({ clipboard }, text) => clipboard.writeText(text), previousClipboard)
  await settings.getByRole('button', { name: 'Done', exact: true }).click()
  await seedFixture(fixture)
  for (const [label, direction, arrangement] of modes) {
    const before = await read()
    const arranged = await mutation('arrange_diagram', { direction, ...(arrangement === 'stacked' ? { arrangement } : {}) })
    assertLayout(arranged.document, direction, arrangement, before.document)
    assert.notEqual(arranged.stateToken, before.stateToken)
    assert.deepEqual((await mutation('undo')).document, before.document)
    assert.deepEqual((await mutation('redo')).document, arranged.document)
    report.http.push({ label, document: arranged.document, currentTokenChanged: true, exactUndoRedo: true })
  }
  await seedFixture(strictFixture)
  for (const [label, direction, arrangement] of modes.slice(2)) {
    const before = await read()
    const arranged = await mutation('arrange_diagram', { direction, arrangement })
    assertLayout(arranged.document, direction, arrangement, before.document)
    assert.notEqual(arranged.stateToken, before.stateToken)
    assert.deepEqual((await mutation('undo')).document, before.document)
    assert.deepEqual((await mutation('redo')).document, arranged.document)
    report.http.push({ label, strictFixture: true, document: arranged.document, currentTokenChanged: true, exactUndoRedo: true })
  }
  await seedFixture(fixture)
  for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 900], [390, 844], [720, 450]]) {
    const cell = { theme, width, height, modes: [] }
    const label = `${theme}-${width}x${height}`
    await page.setViewportSize({ width, height })
    if (await page.locator('html').getAttribute('data-theme') !== theme) await clickApplicationCommand(page, `Switch to ${theme} theme`)
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    const sidebar = page.getByRole('button', { name: 'Sidebar', exact: true })
    const arrange = page.getByRole('button', { name: 'Auto-arrange', exact: true })
    assert.equal(await page.locator('.mobile-controls, .direction-control, .library-bottom').count(), 0)
    for (const name of ['Paste selection', 'Paste clipboard', 'Open Markdown', 'Document properties', 'Pin component library', 'Unpin component library']) assert.equal(await page.getByRole('button', { name, exact: true }).count(), 0)
    await sidebar.scrollIntoViewIfNeeded()
    const bounds = await sidebar.boundingBox()
    report.activeBounds = { label, bounds }
    assert.ok(bounds && Math.abs(bounds.width - bounds.height) < 0.1 && bounds.width >= 43.9, JSON.stringify({ label, bounds }))
    await sidebar.click({ trial: true })
    for (const [index, [mode, direction, arrangement]] of modes.entries()) {
      const before = await read()
      await arrange.click()
      await page.getByRole('menu', { name: 'Auto-arrange layouts' }).waitFor()
      assert.deepEqual(await read(), before)
      await page.keyboard.press('Escape')
      assert.deepEqual(await read(), before)
      assert.equal(await arrange.evaluate(element => element === document.activeElement), true)
      if (index % 2) {
        await arrange.focus(); await page.keyboard.press('ArrowDown')
        for (let count = 0; count < index; count++) await page.keyboard.press('ArrowDown')
        await page.keyboard.press('Enter')
      } else {
        await arrange.click()
        await page.getByRole('menuitem', { name: mode, exact: true }).click()
      }
      const current = await waitFor(state => state.stateToken !== before.stateToken)
      report.active = { label, mode, direction, arrangement, document: current.document }
      assertLayout(current.document, direction, arrangement, before.document)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      const restored = await waitFor(state => state.stateToken !== current.stateToken)
      assert.deepEqual(restored.document, before.document)
      cell.modes.push(mode)
    }
    if (await sidebar.getAttribute('aria-expanded') === 'true') await sidebar.click()
    const title = page.getByRole('textbox', { name: 'Document title', exact: true })
    const baseline = await read()
    await title.fill('Unfinished Sidebar title')
    await sidebar.click()
    assert.equal(await title.inputValue(), 'Unfinished Sidebar title')
    assert.deepEqual(await read(), baseline)
    await title.focus(); await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Show Markdown', exact: true }).click()
    const markdown = page.getByRole('textbox', { name: 'Architecture description (Markdown)', exact: true })
    const resize = page.getByRole('separator', { name: 'Resize right sidebar', exact: true })
    const panel = page.locator('.shared-sidebar')
    const oldWidth = (await panel.boundingBox()).width
    const waitForWidth = expected => page.waitForFunction(value =>
      Math.abs(document.querySelector('.shared-sidebar').getBoundingClientRect().width - value) < 0.1
      && Math.abs(Number(document.querySelector('[aria-label="Resize right sidebar"]').getAttribute('aria-valuenow')) - value) < 0.1, expected)
    await resize.focus()
    await page.keyboard.press('ArrowRight')
    await waitForWidth(oldWidth - 16)
    const smaller = (await panel.boundingBox()).width
    assert.ok(Math.abs(smaller - (oldWidth - 16)) < 0.1, `${label}: sidebar really resizes, ${oldWidth} → ${smaller}`)
    await page.keyboard.press('ArrowLeft')
    await waitForWidth(oldWidth)
    assert.ok(Math.abs((await panel.boundingBox()).width - oldWidth) < 0.1)
    await resize.scrollIntoViewIfNeeded()
    const handle = await resize.boundingBox()
    await page.mouse.move(handle.x + handle.width / 2, Math.max(handle.y + 10, 160))
    await page.mouse.down()
    await page.mouse.move(handle.x + handle.width / 2 + 30, Math.max(handle.y + 10, 160), { steps: 4 })
    assert.ok((await panel.boundingBox()).width < oldWidth - 20)
    await page.keyboard.press('Escape')
    await page.mouse.up()
    await waitForWidth(oldWidth)
    assert.ok(Math.abs((await panel.boundingBox()).width - oldWidth) < 0.1, 'Physical Escape restores pre-drag width')
    assert.deepEqual(await read(), baseline)
    for (const delta of [30, -30]) {
      const currentHandle = await resize.boundingBox()
      const x = currentHandle.x + currentHandle.width / 2
      const y = Math.max(currentHandle.y + 10, 160)
      await page.mouse.move(x, y); await page.mouse.down()
      await page.mouse.move(x + delta, y, { steps: 4 }); await page.mouse.up()
      await waitForWidth(delta > 0 ? oldWidth - 30 : oldWidth)
    }
    assert.ok(Math.abs((await panel.boundingBox()).width - oldWidth) < 0.1, 'Physical releases persist the resized width')
    assert.deepEqual(await read(), baseline)
    await markdown.fill('# Pending sidebar draft')
    await page.getByRole('button', { name: 'Show properties', exact: true }).click()
    await page.getByRole('button', { name: 'Show Markdown', exact: true }).click()
    assert.equal(await markdown.inputValue(), '# Pending sidebar draft')
    await page.getByRole('button', { name: 'Close Markdown', exact: true }).click()
    await sidebar.click()
    assert.equal(await markdown.inputValue(), '# Pending sidebar draft')
    assert.deepEqual(await read(), baseline)
    await markdown.focus(); await page.keyboard.press('Escape')
    await page.getByRole('button', { name: 'Close Markdown', exact: true }).click()
    await page.getByRole('button', { name: 'Add component', exact: true }).click()
    const library = page.locator('aside[aria-label="Component library"]')
    await library.scrollIntoViewIfNeeded()
    const search = library.getByRole('textbox', { name: 'Search components', exact: true })
    await search.fill('API Management')
    const beforeInsertion = await read()
    await library.getByRole('button', { name: 'Insert API Management', exact: true }).click()
    await arrange.scrollIntoViewIfNeeded()
    const point = await page.evaluate(() => {
      const pane = document.querySelector('.react-flow__pane')
      const box = pane.getBoundingClientRect()
      for (let y = Math.max(box.top + 10, 0); y < Math.min(box.bottom - 10, innerHeight); y += 12)
        for (let x = box.left + 10; x < Math.min(box.right - 10, innerWidth); x += 12)
          if (document.elementFromPoint(x, y) === pane) return { x, y }
      return null
    })
    assert.ok(point, 'A real uncovered canvas point is available for library placement')
    await page.mouse.click(point.x, point.y)
    const inserted = await waitFor(state => state.document.entities.length > beforeInsertion.document.entities.length)
    assert.ok((await library.getAttribute('class')).includes('open'))
    await page.getByRole('button', { name: 'Select tool', exact: true }).click()
    await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
    await sidebar.click()
    await page.getByRole('button', { name: 'Show properties', exact: true }).click()
    assert.ok((await library.getAttribute('class')).includes('open'))
    const geometry = await page.evaluate(() => {
      const box = selector => {
        const bounds = document.querySelector(selector).getBoundingClientRect()
        return { x: bounds.x, y: bounds.y, right: bounds.right, bottom: bounds.bottom, height: bounds.height }
      }
      return { library: box('.library'), picker: box('.library .library-list'), inspector: box('.inspector'), overflow: document.documentElement.scrollWidth > innerWidth }
    })
    assert.equal(geometry.overflow, false)
    assert.ok(Math.abs(geometry.picker.bottom - geometry.library.bottom) <= 3, 'Picker uses removed footer area')
    assert.ok(geometry.library.right <= geometry.inspector.x || geometry.inspector.right <= geometry.library.x || geometry.library.bottom <= geometry.inspector.y || geometry.inspector.bottom <= geometry.library.y, 'Open panels never overlap')
    await page.screenshot({ path: path.join(output, `${label}-panels.png`) })
    await page.getByRole('button', { name: 'Close properties', exact: true }).click()
    await library.getByRole('button', { name: 'Close component library', exact: true }).click()
    assert.ok(!(await library.getAttribute('class')).includes('open'))
    await page.getByRole('button', { name: 'Add component', exact: true }).click()
    assert.ok((await library.getAttribute('class')).includes('open'))
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    await page.getByRole('button', { name: 'Exit presentation', exact: true }).click()
    assert.ok((await library.getAttribute('class')).includes('open'))
    await clickApplicationCommand(page, 'Help')
    await page.keyboard.press('Escape')
    assert.ok((await library.getAttribute('class')).includes('open'))
    await search.fill('')
    await page.getByRole('button', { name: 'Select tool', exact: true }).click()
    await mutation('undo')
    assert.equal((await read()).document.entities.length, inserted.document.entities.length - 1)
    await arrange.scrollIntoViewIfNeeded()
    await page.screenshot({ path: path.join(output, `${label}-canvas.png`) })
    cell.geometry = geometry
    await library.getByRole('button', { name: 'Close component library', exact: true }).click()
    await seedFixture(strictFixture)
    cell.strictStacks = []
    for (const [index, [mode, direction, arrangement]] of modes.slice(2).entries()) {
      const before = await read()
      await arrange.scrollIntoViewIfNeeded()
      if (index) {
        await arrange.focus(); await page.keyboard.press('ArrowDown'); await page.keyboard.press('End'); await page.keyboard.press('Enter')
      } else {
        await arrange.click()
        await page.getByRole('menuitem', { name: mode, exact: true }).click()
      }
      const current = await waitFor(state => state.stateToken !== before.stateToken)
      assertLayout(current.document, direction, arrangement, before.document)
      await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
      await page.waitForFunction(() => {
        const canvas = document.querySelector('.react-flow').getBoundingClientRect()
        return [...document.querySelectorAll('.react-flow__node')].every(node => {
          const box = node.getBoundingClientRect()
          return box.left >= canvas.left - 1 && box.top >= canvas.top - 1 && box.right <= canvas.right + 1 && box.bottom <= canvas.bottom + 1
        })
      })
      const screen = await page.evaluate(() => ['a', 'b', 'root-node', 'disconnected'].map(id => {
        const box = document.querySelector(`.react-flow__node[data-id="${id}"]`).getBoundingClientRect()
        return { id, x: box.x, y: box.y, width: box.width, height: box.height }
      }))
      const sharedAxis = direction === 'RIGHT' ? 'x' : 'y'
      assert.ok(screen.every(box => Math.abs(box[sharedAxis] - screen[0][sharedAxis]) < 0.1), 'Rendered root units are collinear too')
      await page.screenshot({ path: path.join(output, `${label}-${direction}-strict-stack.png`) })
      await writeFile(path.join(output, `${label}-${direction}-geometry.json`), JSON.stringify(current.document, null, 2))
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      const restored = await waitFor(state => state.stateToken !== current.stateToken)
      assert.deepEqual(restored.document, before.document)
      cell.strictStacks.push({ mode, exactUndo: true, alignedAtEveryBoundary: true, screen })
    }
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme, 'Actual theme survives Present and strict layouts')
    await seedFixture(fixture)
    report.cells.push(cell)
    console.log(`PASS ${label}: four actual layouts, exact Undo, drafts, explicit library, freed area, panel separation`)
  }
  assert.deepEqual(report.errors, [])
  report.globalErrors = await page.evaluate(() => window.dgm137Errors)
  assert.deepEqual(report.globalErrors, [])
  report.passed = true
} catch (error) {
  report.failure = error.stack
  if (page && !page.isClosed()) {
    report.runtimeState = await page.evaluate(() => ({ status: document.querySelector('.statusbar')?.innerText, title: document.querySelector('[aria-label="Document title"]')?.value, globalErrors: window.dgm137Errors }))
    report.persisted = await readActiveDocument(page)
    report.lifecycle = await app.evaluate(() => globalThis.dgm137Lifecycle)
    await page.screenshot({ path: path.join(output, 'failure.png') })
  }
  throw error
} finally {
  if (app) await app.close()
  report.finished = new Date().toISOString()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
}
