import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import os from 'node:os'
import { chromium } from '@playwright/test'
import { qualityFixtures } from '../src/fixtures.ts'
import { assertCatalogSearch, catalogCoverage, verifyCatalogPalette } from './verify-catalog.mjs'

const url = process.env.DGM_V1_URL ?? 'http://127.0.0.1:5174/'
const output = fileURLToPath(new URL('../test-results/v1/', import.meta.url))
const fixtures = qualityFixtures()
const reports = []
const errors = []
const warnings = []
const resourceFailures = []
const downloads = []
const lifecycle = []
const closingContexts = new WeakSet()
const artifactPrefix = process.env.DGM_V1_CASE ? `${process.env.DGM_V1_CASE.replace(/[^a-z0-9]/gi, '-')}-` : ''
let sequence = 0
let browser
let activeCheck
let closingBrowser = false
let runnerFailure
let performanceReport
const hardware = { platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryGiB: os.totalmem() / 1024 ** 3 }
const fixtureHash = createHash('sha256').update(await readFile(new URL('../src/fixtures.ts', import.meta.url))).digest('hex')

function recordLifecycle(event, details = {}) {
  const entry = { at: new Date().toISOString(), event, check: activeCheck, ...details }
  lifecycle.push(entry)
  console.error(`BROWSER_LIFECYCLE ${JSON.stringify(entry)}`)
}

async function check(name, callback) {
  if (process.env.DGM_V1_CASE && !name.includes(process.env.DGM_V1_CASE)) return
  if (!browser?.isConnected()) {
    reports.push({ name, passed: false, unverified: true, error: 'Browser is disconnected; this check was not executed' })
    console.error(`UNVERIFIED ${name}: browser is disconnected`)
    return
  }
  activeCheck = name
  recordLifecycle('check-start')
  try { const evidence = await callback(); reports.push({ name, passed: true, evidence }); console.log(`PASS ${name}`) }
  catch (error) { reports.push({ name, passed: false, error: error.stack }); console.error(`FAIL ${name}: ${error.message}`) }
  finally { activeCheck = undefined }
}
async function closeContext(context) {
  closingContexts.add(context)
  recordLifecycle('context-close-request', { connected: browser.isConnected() })
  if (browser.isConnected()) await context.close()
}
async function newPage(context, viewport = { width: 1440, height: 900 }) {
  context.on('close', () => recordLifecycle('context-close', { requested: closingContexts.has(context) }))
  context.on('page', page => {
    page.on('crash', () => {
      errors.push(`Page crashed during ${activeCheck}: ${page.url()}`)
      recordLifecycle('page-crash', { url: page.url() })
    })
    page.on('close', () => recordLifecycle('page-close', { url: page.url(), requested: closingContexts.has(context) || closingBrowser }))
    page.on('framenavigated', frame => { if (frame === page.mainFrame()) recordLifecycle('page-navigation', { url: frame.url() }) })
  })
  const page = await context.newPage()
  await page.setViewportSize(viewport)
  page.on('pageerror', error => {
    if (error.message.startsWith('ResizeObserver loop')) warnings.push(error.message)
    else errors.push(error.message)
  })
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('response', response => { if (response.status() >= 400) resourceFailures.push({ url: response.url(), status: response.status() }) })
  const dialogs = []
  let accept = true
  page.on('dialog', async dialog => { dialogs.push(dialog.message()); await (accept ? dialog.accept() : dialog.dismiss()) })
  page.dialogs = dialogs
  page.acceptReplacement = value => { accept = value }
  await page.goto(url)
  assert.equal(await page.title(), 'Azure Diagram Studio')
  await page.locator('.react-flow__node').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  return page
}
async function writable(page) { await page.getByRole('button', { name: 'New diagram', exact: true }).waitFor(); await page.waitForFunction(() => !document.querySelector('button[aria-label="New diagram"]').disabled) }
async function saved(page) { await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device') }
async function durable(page) {
  await saved(page)
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('diagrammer-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('documents', 'readonly')
      const read = transaction.objectStore('documents').get('active-document')
      read.onsuccess = () => resolve(read.result)
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => database.close()
    }
  }))
}
async function panelsClosed(page) {
  for (const name of ['Close component library', 'Close properties']) if (await page.getByRole('button', { name, exact: true }).isVisible()) await page.getByRole('button', { name, exact: true }).click()
}
async function library(page) { if (!(await page.locator('.library').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open component library', exact: true }).click() }
async function properties(page) { if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click() }
async function node(page, id) {
  const target = page.locator(`.react-flow__node[data-id="${id}"]`)
  const box = await target.boundingBox()
  assert.ok(box)
  await target.click({ position: { x: Math.min(20, box.width / 2), y: Math.min(20, box.height / 2) } })
}
async function edge(page, id) {
  const point = await page.locator(`.react-flow__edge[data-id="${id}"] .react-flow__edge-interaction`).evaluate(path => {
    const point = path.getPointAtLength(path.getTotalLength() * .23)
    const screen = new DOMPoint(point.x, point.y).matrixTransform(path.getScreenCTM())
    return { x: screen.x, y: screen.y }
  })
  await page.mouse.click(point.x, point.y)
}
async function field(page, name, value) { await page.getByLabel(name, { exact: true }).fill(value); await page.getByLabel(name, { exact: true }).press('Tab') }
async function download(page, action, label) {
  const pending = page.waitForEvent('download')
  await action()
  const file = await pending
  const path = `${output}/${artifactPrefix}${++sequence}-${label}-${file.suggestedFilename()}`
  await file.saveAs(path)
  assert.equal(await file.failure(), null)
  downloads.push(path)
  return { path, bytes: await readFile(path) }
}
async function json(page, label = 'backup') {
  const file = await download(page, () => page.getByRole('button', { name: 'Save JSON', exact: true }).click(), label)
  return { ...file, document: JSON.parse(file.bytes.toString()) }
}

function geometry(document) {
  return document.entities.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
}

function layoutSemantics(document) {
  const { revision, entities, connections, ...metadata } = document
  return {
    ...metadata,
    entities: entities.map(entity => {
      const { x, y, ...content } = entity
      if (entity.kind === 'text' || entity.kind === 'rectangle') return content
      const { width, height, ...semantic } = content
      return semantic
    }),
    connections: connections.map(({ points, labelPosition, routeRevision, ...content }) => content),
  }
}

function absoluteAnnotations(document) {
  const entities = new Map(document.entities.map(entity => [entity.id, entity]))
  return document.entities.filter(entity => entity.kind === 'text' || entity.kind === 'rectangle').map(entity => {
    let x = entity.x
    let y = entity.y
    let parentId = entity.parentId
    const ancestors = []
    while (parentId) {
      assert.ok(!ancestors.includes(parentId), `Cyclic parent chain for ${entity.id}`)
      const parent = entities.get(parentId)
      assert.equal(parent?.kind, 'boundary', `Missing boundary for ${entity.id}`)
      ancestors.push(parentId)
      x += parent.x; y += parent.y; parentId = parent.parentId
    }
    return { id: entity.id, kind: entity.kind, x, y, width: entity.width, height: entity.height, ancestors }
  })
}

async function arrangeCompletion(page) {
  const previous = await page.locator('.react-flow__node').evaluateAll(nodes => JSON.stringify(nodes.map(node => [node.dataset.id, node.style.transform, node.style.width, node.style.height])))
  await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
  await page.waitForFunction(previous => {
    if (document.querySelector('button[aria-label="Auto-arrange"]').disabled || document.querySelector('.statusbar .save-label')?.textContent !== 'Saved on this device') return false
    const failed = /Auto-arrange failed|Layout may change only/.test(document.querySelector('[role="status"]')?.textContent ?? '')
    const current = JSON.stringify([...document.querySelectorAll('.react-flow__node')].map(node => [node.dataset.id, node.style.transform, node.style.width, node.style.height]))
    return failed || current !== previous
  }, previous)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  assert.equal(await page.locator('.statusbar .save-label').textContent(), 'Saved on this device')
  return await page.getByRole('status').textContent()
}

async function open(page, document, kind = 'open', name = 'document.json') {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: kind === 'open' ? 'Open JSON' : 'Import skill JSON', exact: true }).click()
  await (await chooser).setFiles({ name, mimeType: 'application/json', buffer: Buffer.isBuffer(document) ? document : Buffer.from(JSON.stringify(document)) })
}
async function opened(page, title) { await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title, title); await saved(page) }
async function bounds(page, viewport) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
  const controls = await page.locator('.topbar button, .tool-rail button, .canvas-toolbar button, .zoom-controls button, .mobile-controls button, .canvas-selection-toolbar button').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect()
    return { label: button.getAttribute('aria-label'), x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height }
  }))
  for (const item of controls.filter(item => item.width && item.height)) assert.ok(item.x >= -.5 && item.y >= -.5 && item.right <= viewport.width + .5 && item.bottom <= viewport.height + .5, `Clipped control: ${JSON.stringify(item)}`)
}
async function exportFile(page, format, scale, transparent, label) {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  await page.getByLabel('Transparent background', { exact: true }).setChecked(transparent)
  return download(page, () => page.getByRole('button', { name: format === 'svg' ? 'Export SVG' : `Export PNG ${scale}x`, exact: true }).click(), label)
}
async function pixels(page, bytes, mime) {
  return page.evaluate(async ({ base64, mime }) => {
    const image = new Image()
    image.src = `data:${mime};base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let ink = 0
    for (let index = 0; index < data.length; index += 4) if (data[index + 3] > 0 && (data[index] < 220 || data[index + 1] < 220 || data[index + 2] < 220)) ink++
    return { width: canvas.width, height: canvas.height, corner: [...data.slice(0, 4)], ink }
  }, { base64: bytes.toString('base64'), mime })
}
async function quality(page, viewport, label) {
  await panelsClosed(page)
  await bounds(page, viewport)
  await page.screenshot({ path: `${output}/${viewport.width}-${label}-editor.png` })
  const svg = await exportFile(page, 'svg', 1, true, `${viewport.width}-${label}`)
  const source = svg.bytes.toString()
  assert.ok(!/<script|foreignObject|<image[^>]+(?:href|xlink:href)=["'](?:https?:|\/)/i.test(source), 'SVG is native and self-contained')
  assert.ok(source.includes('data:') && source.includes('@font-face'), 'Font/assets embedded')
  const vector = await pixels(page, svg.bytes, 'image/svg+xml')
  assert.ok(vector.ink > 50, 'Export must render actual content')
  const png1 = await exportFile(page, 'png', 1, false, `${viewport.width}-${label}-1x`)
  const png2 = await exportFile(page, 'png', 2, true, `${viewport.width}-${label}-2x`)
  const first = await pixels(page, png1.bytes, 'image/png')
  const second = await pixels(page, png2.bytes, 'image/png')
  assert.equal(second.width, first.width * 2); assert.equal(second.height, first.height * 2)
  assert.deepEqual(first.corner, [255, 255, 255, 255]); assert.equal(second.corner[3], 0)
  assert.ok(first.ink > 50 && second.ink > first.ink)
  const preview = await page.context().newPage()
  await preview.setViewportSize(viewport)
  for (const [format, file] of [['svg', svg], ['png', png2]]) {
    await preview.setContent(`<style>body{margin:0;background:#e9edef}img{max-width:100%;height:auto}</style><img src="data:image/${format === 'svg' ? 'svg+xml' : 'png'};base64,${file.bytes.toString('base64')}">`)
    await preview.locator('img').evaluate(image => image.decode())
    await preview.screenshot({ path: `${output}/${viewport.width}-${label}-${format}.png`, fullPage: true })
  }
  await preview.close()
  return { vector, png1: first, png2: second }
}

await mkdir(output, { recursive: true })
try {
  const coverage = await catalogCoverage()
  console.log(`Catalog archive: ${coverage.total} keys (${coverage.azure} Azure, ${coverage.fabric} Fabric, ${coverage.software} Software, ${coverage.vendors} Vendors, ${coverage.microsoft} Microsoft Apps); ${coverage.selection} current choices in ${coverage.azureMenuGroups} Azure / Microsoft menus; all 24 legacy keys and glyphs unchanged`)
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  recordLifecycle('browser-launched', { version: browser.version() })
  browser.on('disconnected', () => {
    recordLifecycle('browser-disconnected', { requested: closingBrowser })
    if (!closingBrowser) errors.push(`Browser disconnected before suite teardown during ${activeCheck ?? 'between checks'}`)
  })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    await check(`Integrated ${viewport.width}x${viewport.height} workflow and SVG/PNG`, async () => {
      const context = await browser.newContext({ acceptDownloads: true })
      try {
        const page = await newPage(context, viewport)
        await writable(page)
        const initial = await durable(page)
        assert.equal(initial.id, 'sample-commerce'); assert.equal(initial.synthetic, true)
        assert.equal(initial.entities.length, 9)
        await library(page)
        await verifyCatalogPalette(page)
        assert.deepEqual(await durable(page), initial, 'Compact menus and global search preserve canonical content')
        await quality(page, viewport, 'commerce')
        await library(page)
        await assertCatalogSearch(page, 'PostgreSQL')
        await page.getByLabel('Search components', { exact: true }).fill('')
        await page.getByRole('button', { name: 'Insert App Service', exact: true }).click()
        await panelsClosed(page)
        const pane = await page.locator('.react-flow__pane').boundingBox()
        await page.locator('.react-flow__pane').click({ position: { x: pane.width * .6, y: pane.height * .7 } })
        let document = await durable(page)
        const added = document.entities.at(-1)
        assert.equal(added.icon, 'azure-app'); assert.equal(added.x % 8, 0)
        await properties(page)
        await field(page, 'Component label', 'Order API')
        await page.getByLabel('Component status', { exact: true }).selectOption('planned')
        await field(page, 'Hex color', '#236789')
        document = await durable(page)
        assert.equal(document.entities.at(-1).label, 'Order API')
        assert.equal(document.entities.at(-1).status, 'planned')
        assert.equal(document.entities.at(-1).color, '#236789')
        await panelsClosed(page)
        await node(page, 'note'); await properties(page)
        await field(page, 'Note text', 'Integration note\n\nComplete plain text retained.')
        await page.getByRole('button', { name: 'Send to background', exact: true }).click()
        document = await durable(page)
        assert.equal(document.entities.find(entity => entity.id === 'note').layer, 'background')
        await panelsClosed(page)
        await page.getByRole('button', { name: 'Document properties', exact: true }).click()
        await field(page, 'Document subtitle', 'Explicitly synthetic integration fixture')
        await panelsClosed(page)
        const backed = await json(page, `${viewport.width}-roundtrip`)
        assert.equal(await page.locator('.backup-state').textContent(), 'No newer JSON changes')
        await field(page, 'Document title', 'Changed since JSON backup')
        await saved(page)
        assert.equal(await page.locator('.backup-state').textContent(), 'Editable JSON copy needed')
        await open(page, backed.bytes)
        await opened(page, backed.document.title)
        assert.deepEqual(await durable(page), backed.document)
        assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled(), true)
        assert.ok(page.dialogs.length > 0)
        await page.reload(); await writable(page)
        assert.deepEqual(await durable(page), backed.document)

        if (viewport.width === 1440) {
          await panelsClosed(page)
          await node(page, 'users')
          await page.keyboard.down('Control'); await node(page, added.id); await page.keyboard.up('Control')
          await page.keyboard.press('Control+c'); await page.keyboard.press('Control+v')
          document = await durable(page)
          assert.equal(document.entities.length, backed.document.entities.length + 2)
          const pasted = document.entities.slice(-2)
          const positions = pasted.map(entity => entity.x)
          await page.keyboard.press('ArrowRight')
          document = await durable(page)
          assert.deepEqual(document.entities.slice(-2).map(entity => entity.x), positions.map(value => value + 8))
          await page.getByRole('button', { name: 'Group selection', exact: true }).click()
          document = await durable(page)
          const boundary = document.entities.find(entity => !backed.document.entities.some(previous => previous.id === entity.id) && entity.kind === 'boundary')
          assert.ok(boundary)
          assert.ok(pasted.every(entity => document.entities.find(item => item.id === entity.id).parentId === boundary.id))
          await page.getByRole('button', { name: 'Ungroup selection', exact: true }).click()
          await saved(page)
          for (let count = 0; count < 4; count++) await page.getByRole('button', { name: 'Undo', exact: true }).click()
          assert.deepEqual(await durable(page), backed.document)
          await panelsClosed(page); await node(page, added.id); await properties(page)
          const beforeParent = await durable(page)
          await page.getByLabel('Parent boundary', { exact: true }).selectOption('platform')
          document = await durable(page)
          assert.equal(document.entities.find(entity => entity.id === added.id).parentId, 'platform')
          await page.getByRole('button', { name: 'Undo', exact: true }).click()
          assert.deepEqual(await durable(page), beforeParent)
          await panelsClosed(page); await edge(page, 'route'); await properties(page)
          await page.getByLabel('Insertion component', { exact: true }).selectOption('azure-service-bus')
          await page.getByRole('button', { name: 'Insert on connection', exact: true }).click()
          document = await durable(page)
          assert.equal(document.connections.length, backed.document.connections.length + 1)
          assert.ok(!document.connections.some(connection => connection.id === 'route'))
          assert.ok(document.connections.some(connection => connection.label === 'Route'))
          await page.getByRole('button', { name: 'Undo', exact: true }).click()
          assert.deepEqual(await durable(page), backed.document)
          await panelsClosed(page); await node(page, 'gateway')
          await page.keyboard.press('Delete')
          document = await durable(page)
          assert.ok(!document.connections.some(connection => connection.from === 'gateway' || connection.to === 'gateway'))
          await page.getByRole('button', { name: 'Undo', exact: true }).click()
          assert.deepEqual(await durable(page), backed.document)
          const geometry = await durable(page)
          await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
          await page.waitForFunction(() => !document.querySelector('button[aria-label="Auto-arrange"]').disabled)
          document = await durable(page)
          assert.equal(document.revision, geometry.revision + 1)
          assert.ok(document.connections.every(connection => connection.routeRevision === document.revision))
          await page.getByRole('button', { name: 'Undo', exact: true }).click()
          assert.deepEqual(await durable(page), geometry)
        }
        await quality(page, viewport, 'edited')
        const nested = fixtures.find(document => document.id === 'nested-cross-links-v1')
        await open(page, nested); await opened(page, nested.title)
        await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
        await quality(page, viewport, 'long-status')
        const annotations = fixtures.find(document => document.id === 'annotations-v1')
        await open(page, annotations); await opened(page, annotations.title)
        await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
        const outputs = await quality(page, viewport, 'negative-text')
        return { fixtureIds: ['sample-commerce', 'nested-cross-links-v1', 'annotations-v1'], exactReloadAndJson: true, outputs, dialogs: page.dialogs }
      } finally { await closeContext(context) }
    })
  }

  for (const direction of ['RIGHT', 'DOWN']) {
    await check(`Nested annotations ${direction} production auto-arrange and exact undo`, async () => {
      const context = await browser.newContext({ acceptDownloads: true })
      try {
        const page = await newPage(context); await writable(page); await saved(page)
        await panelsClosed(page); await node(page, 'note'); await properties(page)
        await page.getByLabel('Parent boundary', { exact: true }).selectOption('application')
        assert.equal((await durable(page)).entities.find(entity => entity.id === 'note').parentId, 'application')
        await panelsClosed(page)
        await page.getByRole('button', { name: 'Add rectangle', exact: true }).click()
        const placement = await page.locator('.react-flow__pane').evaluate(pane => {
          const bounds = pane.getBoundingClientRect()
          for (const vertical of [.75, .55, .35, .15]) {
            for (const horizontal of [.85, .65, .45, .25, .1]) {
              const x = bounds.width * horizontal
              const y = bounds.height * vertical
              if (document.elementFromPoint(bounds.x + x, bounds.y + y) === pane) return { x, y }
            }
          }
          throw new Error('No unobstructed canvas point for rectangle placement')
        })
        await page.locator('.react-flow__pane').click({ position: placement })
        const rectangle = (await durable(page)).entities.at(-1)
        assert.equal(rectangle.kind, 'rectangle', 'Rectangle is created through the production drawing tool')
        await properties(page)
        await field(page, 'Component label', 'Nested rectangle regression')
        await page.getByLabel('Parent boundary', { exact: true }).selectOption('application')
        assert.equal((await durable(page)).entities.find(entity => entity.id === rectangle.id).parentId, 'application')
        await panelsClosed(page)
        await page.getByRole('button', { name: direction === 'RIGHT' ? 'Right layout' : 'Down layout', exact: true }).click()
        await saved(page)
        const before = await json(page, `nested-${direction}-before`)
        assert.equal(before.document.direction, direction)
        assert.deepEqual(before.document, await durable(page), 'Before JSON is the actual canonical durable document')
        const annotationsBefore = absoluteAnnotations(before.document)
        assert.deepEqual(annotationsBefore.map(entity => entity.kind).sort(), ['rectangle', 'text'])
        assert.ok(annotationsBefore.every(entity => entity.ancestors.join('/') === 'application/platform'), 'Both annotations are nested two boundaries deep via UI reparenting')
        const message = await arrangeCompletion(page)
        const result = await json(page, `nested-${direction}-result`)
        await page.screenshot({ path: `${output}/${artifactPrefix}nested-${direction}-result.png` })
        assert.equal(result.document.revision, before.document.revision + 1, `Auto-arrange must commit once, not reject the rebased annotations: ${message}`)
        assert.deepEqual(result.document, await durable(page), 'Result JSON is the actual saved canonical layout')
        assert.notDeepEqual(geometry(result.document), geometry(before.document), 'Production application must change actual entity geometry')
        assert.deepEqual(layoutSemantics(result.document), layoutSemantics(before.document), 'Document metadata, IDs, content, membership and annotation sizes are unchanged')
        assert.ok(result.document.connections.every(connection => connection.points.length >= 2 && connection.routeRevision === result.document.revision), 'Every connection receives a current route')
        const annotationsAfter = absoluteAnnotations(result.document)
        for (const original of annotationsBefore) {
          const arranged = annotationsAfter.find(entity => entity.id === original.id)
          assert.ok(arranged)
          assert.ok(Math.abs(arranged.x - original.x) <= 1e-6 && Math.abs(arranged.y - original.y) <= 1e-6, `${original.kind} ${original.id} absolute position must remain unchanged across the complete parent chain`)
          assert.deepEqual({ ...arranged, x: original.x, y: original.y }, original)
          const previousLocal = before.document.entities.find(entity => entity.id === original.id)
          const currentLocal = result.document.entities.find(entity => entity.id === original.id)
          assert.notDeepEqual([currentLocal.x, currentLocal.y], [previousLocal.x, previousLocal.y], `${original.kind} is actually rebased, not merely left in place locally`)
        }
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        await saved(page)
        const undone = await json(page, `nested-${direction}-undo`)
        assert.deepEqual(undone.document, before.document, 'One undo restores exact canonical positions, sizes, routes, revision and metadata')
        assert.deepEqual(await durable(page), before.document)
        return { direction, annotationKinds: ['text', 'rectangle'], annotationsBefore, annotationsAfter, canonical: { before: before.path, result: result.path, undo: undone.path }, appliedThroughProductionUi: true, exactOneStepUndo: true }
      } finally { await closeContext(context) }
    })
  }

  await check('Blank document create/connect/annotate/drag/resize and atomic undo', async () => {
    const context = await browser.newContext({ acceptDownloads: true })
    try {
      const page = await newPage(context); await writable(page); await saved(page)
      await json(page, 'before-new')
      await page.getByRole('button', { name: 'New diagram', exact: true }).click()
      await saved(page)
      assert.equal(await page.locator('.react-flow__node').count(), 0)
      assert.equal(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled(), true)
      const clickAt = async (x, y) => {
        const pane = await page.locator('.react-flow__pane').boundingBox()
        await page.locator('.react-flow__pane').click({ position: { x: pane.width * x, y: pane.height * y } })
      }
      await library(page)
      await page.getByRole('tab', { name: /Software/ }).click()
      await page.getByRole('button', { name: 'Insert Service', exact: true }).click()
      await panelsClosed(page); await clickAt(.25, .4)
      let document = await durable(page)
      const service = document.entities.at(-1)
      assert.equal(service.icon, 'service')
      await library(page); await page.getByRole('tab', { name: /Azure/ }).click()
      await assertCatalogSearch(page, 'SQL Database')
      await page.locator('.library-item[data-icon="azure-sql"]').first().click()
      await panelsClosed(page); await clickAt(.65, .5)
      document = await durable(page)
      const database = document.entities.at(-1)
      await page.getByRole('button', { name: 'Connect components', exact: true }).click()
      await node(page, service.id); await node(page, database.id)
      document = await durable(page)
      assert.equal(document.connections.length, 1)
      assert.equal(document.connections[0].from, service.id); assert.equal(document.connections[0].to, database.id)
      await panelsClosed(page); await edge(page, document.connections[0].id); await properties(page)
      await field(page, 'Connection label', 'Commands')
      await page.getByLabel('Connection line', { exact: true }).selectOption('dashed')
      await page.getByLabel('Connection direction', { exact: true }).selectOption('both')
      await page.getByLabel('Source side', { exact: true }).selectOption('bottom')
      document = await durable(page)
      assert.equal(document.connections[0].label, 'Commands'); assert.equal(document.connections[0].arrow, 'both')
      await panelsClosed(page)
      for (const [tool, point, kind] of [['Add boundary', [.15, .72], 'boundary'], ['Add text', [.5, .73], 'text'], ['Add rectangle', [.78, .72], 'rectangle']]) {
        await page.getByRole('button', { name: tool, exact: true }).click()
        await clickAt(...point)
        assert.equal((await durable(page)).entities.at(-1).kind, kind)
      }
      await panelsClosed(page); await node(page, service.id)
      const beforeDrag = await durable(page)
      const box = await page.locator(`.react-flow__node[data-id="${service.id}"]`).boundingBox()
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
      await page.mouse.down(); await page.mouse.move(box.x + box.width / 2 + 32, box.y + box.height / 2 + 16, { steps: 8 }); await page.mouse.up()
      document = await durable(page)
      assert.equal(document.revision, beforeDrag.revision + 1)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      assert.deepEqual(await durable(page), beforeDrag)
      await panelsClosed(page)
      await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
      const rectangle = document.entities.find(entity => entity.kind === 'rectangle')
      await node(page, rectangle.id)
      await panelsClosed(page)
      await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
      const beforeResize = await durable(page)
      const resizeHandle = page.locator(`.react-flow__node[data-id="${rectangle.id}"] .react-flow__resize-control.handle.bottom.right`)
      await resizeHandle.hover()
      const handle = await resizeHandle.boundingBox()
      await page.screenshot({ path: `${output}/blank-before-resize.png` })
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.outerHTML.slice(0, 700), { x: handle.x + handle.width / 2, y: handle.y + handle.height / 2 })
      await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2)
      await page.mouse.down(); await page.mouse.move(handle.x + 28, handle.y + 28, { steps: 8 }); await page.mouse.up()
      assert.equal((await durable(page)).revision, beforeResize.revision + 1, `Resize handle hit-test: ${hit}`)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      assert.deepEqual(await durable(page), beforeResize)
      const backup = await json(page, 'new-document')
      await page.reload(); await writable(page)
      assert.deepEqual(await durable(page), backup.document)
      await page.screenshot({ path: `${output}/blank-created.png` })
      return { documentId: backup.document.id, entities: backup.document.entities.length, connections: backup.document.connections.length }
    } finally { await closeContext(context) }
  })

  await check('File validation/cancellation/import warnings and initial worker layout', async () => {
    const context = await browser.newContext({ acceptDownloads: true })
    try {
      const page = await newPage(context); await writable(page)
      await field(page, 'Document title', 'Protected work'); await saved(page)
      const before = await durable(page)
      page.acceptReplacement(false)
      await page.getByRole('button', { name: 'New diagram', exact: true }).click()
      assert.deepEqual(await durable(page), before)
      const chooser = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: 'Open JSON', exact: true }).click()
      await (await chooser).setFiles([])
      assert.deepEqual(await durable(page), before)
      await open(page, fixtures[0]); await page.waitForFunction(() => document.querySelector('input[aria-label="Document title"]').value === 'Protected work')
      assert.deepEqual(await durable(page), before)
      for (const [name, buffer, message] of [
        ['wrong.txt', Buffer.from('{}'), '.json'], ['oversize.json', Buffer.alloc(5 * 1024 * 1024 + 1, 32), '5 MiB'],
        ['malformed.json', Buffer.from('{'), 'Open failed'], ['version.json', Buffer.from(JSON.stringify({ ...before, schemaVersion: 2 })), 'schemaVersion'],
        ['dangling.json', Buffer.from(JSON.stringify({ ...before, connections: [{ id: 'bad', from: 'missing', to: 'users', label: '', style: 'solid', arrow: 'forward' }] })), 'from'],
      ]) {
        await open(page, buffer, 'open', name)
        await page.getByRole('status').filter({ hasText: message }).waitFor()
        assert.deepEqual(await durable(page), before)
      }
      page.acceptReplacement(true)
      const skill = { title: 'Skill integration', synthetic: true, groups: [{ id: 'group', label: 'Owned boundary', nodes: [{ id: 'api', label: 'API', icon: 'unknown', status: 'planned' }, { id: 'store', label: 'Data', icon: 'database' }] }], edges: [{ id: 'flow', from: 'api', to: 'store', label: 'Read', style: 'dashed', arrow: 'both' }] }
      await open(page, skill, 'import'); await opened(page, skill.title)
      const imported = await durable(page)
      assert.equal(imported.entities.find(entity => entity.id === 'api').icon, 'service')
      assert.equal(imported.entities.find(entity => entity.id === 'store').status, undefined)
      assert.equal(imported.entities.find(entity => entity.id === 'api').parentId, 'group')
      assert.ok(imported.connections[0].points.length >= 2)
      assert.equal(imported.connections[0].routeRevision, imported.revision)
      assert.ok((await page.getByRole('status').textContent()).includes('Unknown icon'))
      assert.equal(await page.locator('.backup-state').textContent(), 'Editable JSON copy needed')
      await page.screenshot({ path: `${output}/import-warnings.png` })
      return { importedId: imported.id, prompts: page.dialogs }
    } finally { await closeContext(context) }
  })

  await check('Read-only queued tab adopts latest durable snapshot before ownership', async () => {
    const context = await browser.newContext({ acceptDownloads: true })
    try {
      const first = await newPage(context); await writable(first); await saved(first)
      const second = await newPage(context)
      assert.equal(await second.getByRole('button', { name: 'New diagram', exact: true }).isDisabled(), true)
      assert.equal(await second.getByLabel('Document title', { exact: true }).isDisabled(), true)
      await second.keyboard.press('Delete'); await second.keyboard.press('Control+z')
      await exportFile(second, 'svg', 1, false, 'readonly')
      await json(second, 'readonly')
      await field(first, 'Document title', 'Owner latest durable')
      const latest = await durable(first)
      await second.screenshot({ path: `${output}/queued-readonly.png` })
      await first.close(); await writable(second)
      assert.deepEqual(await durable(second), latest)
      await field(second, 'Document title', 'Ownership transferred')
      assert.equal((await durable(second)).title, 'Ownership transferred')
      return { readOnlyExports: true, exactTransferSnapshot: true }
    } finally { await closeContext(context) }
  })

  await check('Quota failure keeps editing/JSON available and successful retry becomes Saved', async () => {
    const context = await browser.newContext({ acceptDownloads: true })
    await context.addInitScript(() => {
      const put = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args) {
        if (sessionStorage.getItem('fail-save') === 'yes') throw new DOMException('Injected storage full', 'QuotaExceededError')
        return put.apply(this, args)
      }
    })
    try {
      const page = await newPage(context); await writable(page); await saved(page)
      await page.evaluate(() => sessionStorage.setItem('fail-save', 'yes'))
      await field(page, 'Document title', 'Quota protected work')
      await page.getByRole('status').filter({ hasText: 'Browser save failed' }).waitFor()
      assert.equal(await page.getByLabel('Document title', { exact: true }).isDisabled(), false)
      const backup = await json(page, 'quota-fallback')
      assert.equal(backup.document.title, 'Quota protected work')
      assert.equal(await page.locator('.save-label').textContent(), 'Local save failed')
      await page.screenshot({ path: `${output}/quota-failure.png` })
      await page.evaluate(() => sessionStorage.removeItem('fail-save'))
      await field(page, 'Document subtitle', 'Recovered')
      assert.equal((await durable(page)).subtitle, 'Recovered')
      return { failedSaveNotMarkedSaved: true, downloadedCurrentWork: true, retry: true }
    } finally { await closeContext(context) }
  })

  await check('Malformed durable storage is visible and never overwritten', async () => {
    const context = await browser.newContext({ acceptDownloads: true })
    await context.addInitScript(() => {
      const original = IDBObjectStore.prototype.get
      IDBObjectStore.prototype.get = function (...args) {
        const request = original.apply(this, args)
        return new Proxy(request, {
          get(target, property) { if (property === 'result') return { schemaVersion: 999, sentinel: 'preserve me' }; const value = Reflect.get(target, property, target); return typeof value === 'function' ? value.bind(target) : value },
          set(target, property, value) { return Reflect.set(target, property, value, target) },
        })
      }
      const originalPut = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (...args) { sessionStorage.setItem('corrupt-overwritten', 'yes'); return originalPut.apply(this, args) }
    })
    try {
      const page = await newPage(context)
      await page.getByRole('status').filter({ hasText: 'Existing data was not overwritten' }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'New diagram', exact: true }).isDisabled(), true)
      await json(page, 'load-error-fallback')
      assert.equal(await page.evaluate(() => sessionStorage.getItem('corrupt-overwritten')), null)
      await page.screenshot({ path: `${output}/corrupt-storage.png` })
      return { failClosed: true, puts: 0 }
    } finally { await closeContext(context) }
  })

  await check('Stale worker results, preview ownership and retry after real worker error', async () => {
    const context = await browser.newContext({ acceptDownloads: true })
    await context.addInitScript(() => {
      const NativeWorker = window.Worker
      window.Worker = class extends NativeWorker {
        postMessage(message, ...rest) {
          if (sessionStorage.getItem('delay-layout') === 'yes') setTimeout(() => { try { super.postMessage(message, ...rest) } catch {} }, 250)
          else super.postMessage(message, ...rest)
          if (sessionStorage.getItem('fail-layout') === 'yes') queueMicrotask(() => this.dispatchEvent(new ErrorEvent('error', { message: 'Injected worker failure' })))
        }
      }
    })
    try {
      const page = await newPage(context); await writable(page); await saved(page)
      const before = await durable(page)
      await page.evaluate(() => sessionStorage.setItem('delay-layout', 'yes'))
      await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
      await field(page, 'Document title', 'Intervening work')
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      assert.deepEqual(await durable(page), before)
      await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
      await page.getByLabel('Document title', { exact: true }).fill('Cancelled preview')
      await page.getByLabel('Document title', { exact: true }).press('Escape')
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      assert.deepEqual((await json(page, 'preview-cancel')).document, before)
      await page.evaluate(() => { sessionStorage.removeItem('delay-layout'); sessionStorage.setItem('fail-layout', 'yes') })
      await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
      await page.getByRole('status').filter({ hasText: 'Auto-arrange failed; retry' }).waitFor()
      assert.equal(await page.getByRole('button', { name: 'Auto-arrange', exact: true }).isEnabled(), true)
      await page.evaluate(() => sessionStorage.removeItem('fail-layout'))
      await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
      await page.waitForFunction(() => !document.querySelector('button[aria-label="Auto-arrange"]').disabled)
      const arranged = await durable(page)
      assert.equal(arranged.revision, before.revision + 1)
      return { editUndoRevisionReuse: true, draftCancellation: true, actualWorkerRetry: true }
    } finally { await closeContext(context) }
  })

  await check('Production stress p95 command-to-next-paint and ten worker layouts', async () => {
    const context = await browser.newContext({ acceptDownloads: true })
    try {
      const page = await newPage(context); await writable(page); await saved(page)
      const stress = fixtures.find(document => document.id === 'stress-v1')
      assert.equal(stress.entities.length, 100); assert.equal(stress.connections.length, 150)
      await open(page, stress); await opened(page, stress.title); await panelsClosed(page)
      await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
      await node(page, 'node-0')
      const edits = await page.evaluate(async () => {
        const times = []
        for (let index = 0; index < 20; index++) {
          const start = performance.now()
          window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          times.push(performance.now() - start)
        }
        return times
      })
      const layouts = await page.evaluate(async () => {
        const times = []
        const button = document.querySelector('button[aria-label="Auto-arrange"]')
        for (let index = 0; index < 10; index++) {
          const start = performance.now()
          button.click()
          await new Promise(resolve => requestAnimationFrame(resolve))
          while (button.disabled) await new Promise(resolve => requestAnimationFrame(resolve))
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
          times.push(performance.now() - start)
        }
        return times
      })
      const document = await durable(page)
      assert.equal(document.revision, stress.revision + 30, '20 edits and 10 accepted layouts really committed')
      const p95 = [...edits].sort((before, after) => before - after)[Math.ceil(edits.length * .95) - 1]
      performanceReport = { fixtureId: stress.id, fixtureSourceSha256: fixtureHash, hardware, browser: browser.version(), viewport: { width: 1440, height: 900 }, production: true, method: 'DOM keyboard command dispatch to two requestAnimationFrame callbacks; worker layout click to enabled button plus two frames', editMilliseconds: edits, p95Milliseconds: p95, layoutMilliseconds: layouts, allLayoutsAtMost2s: layouts.every(value => value <= 2000), editP95AtMost100ms: p95 <= 100 }
      await page.screenshot({ path: `${output}/stress-production.png` })
      await writeFile(`${output}/${artifactPrefix}performance.json`, JSON.stringify(performanceReport, null, 2))
      assert.ok(p95 <= 100, `p95 ${p95.toFixed(2)}ms exceeds 100ms`)
      assert.ok(layouts.every(value => value <= 2000), `Layout maximum ${Math.max(...layouts).toFixed(2)}ms exceeds 2000ms`)
      return performanceReport
    } finally { await closeContext(context) }
  })
  await check('No unexpected production browser errors', () => assert.deepEqual(errors, []))
} catch (error) {
  runnerFailure = error.stack
  recordLifecycle('runner-failure', { error: runnerFailure })
  throw error
} finally {
  closingBrowser = true
  recordLifecycle('browser-close-request', { connected: browser?.isConnected() ?? false })
  try { await browser?.close() }
  catch (error) {
    errors.push(`Browser teardown failed: ${error.message}`)
    recordLifecycle('browser-close-failure', { error: error.stack })
    process.exitCode = 1
  }
  const reportName = process.env.DGM_V1_CASE ? `focused-${process.env.DGM_V1_CASE.replace(/[^a-z0-9]/gi, '-')}.json` : 'browser-report.json'
  await writeFile(`${output}/${reportName}`, JSON.stringify({ url, browser: browser?.version(), fixtureSourceSha256: fixtureHash, hardware, reports, performance: performanceReport, errors, resourceFailures, warnings, downloads, lifecycle, runnerFailure, manualUnverified: ['PowerPoint SVG/PNG insertion', 'PO-observed novice five-minute recreation'], scope: 'DGM-040 integration evidence, not independent DGM-050 or PO sprint acceptance' }, null, 2))
}
console.log(`Artifacts: ${output}; ${reports.filter(report => report.passed).length}/${reports.length} checks pass. V1 server remains running at ${url}`)
if (reports.some(report => !report.passed)) process.exitCode = 1