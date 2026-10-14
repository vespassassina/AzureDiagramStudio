import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { absolutePosition, createDocument, entityTextGeometry, sampleDiagram } from '../src/model.ts'
import { painterOrder } from '../src/order.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../test-results/sprint-2/', import.meta.url))
const report = { date: new Date().toISOString(), scope: 'Independent Sprint 2 production verification; no implementation or spec repairs', cases: [], errors: [], requests: [] }
let server
let browser
let base
let sequence = 0
const button = (page, name) => page.getByRole('button', { name, exact: true })
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))

async function saved(page) {
  await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
}

async function durable(page) {
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

async function download(page, action, label) {
  const pending = page.waitForEvent('download')
  await action()
  const file = await pending
  const path = `${output}/${++sequence}-${label}-${file.suggestedFilename()}`
  await file.saveAs(path)
  assert.equal(await file.failure(), null)
  return { path, bytes: await readFile(path) }
}

async function json(page, label) {
  return JSON.parse((await download(page, () => button(page, 'Save JSON').click(), label)).bytes.toString())
}

async function svg(page, label) {
  await button(page, 'Export').click()
  return download(page, () => button(page, 'Export SVG').click(), label)
}

async function open(page, document) {
  const chooser = page.waitForEvent('filechooser')
  await button(page, 'Open JSON').click()
  await (await chooser).setFiles({ name: 'sprint2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(document)) })
  await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title, document.title)
  await saved(page)
  assert.deepEqual(await durable(page), document)
}

async function closePanels(page) {
  for (const name of ['Close component library', 'Close properties']) if (await button(page, name).isVisible()) await button(page, name).click()
}

async function properties(page) {
  if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await button(page, 'Open properties').click()
}

async function fit(page, selected = false) {
  await button(page, selected ? 'Fit selection' : 'Fit diagram').click()
  await page.waitForFunction(() => !document.querySelector('.react-flow__viewport')?.classList.contains('react-flow__viewport-animating'))
  await page.evaluate(() => new Promise(resolve => {
    let previous = '', stable = 0
    const next = () => {
      const current = document.querySelector('.react-flow__viewport')?.style.transform
      stable = current === previous ? stable + 1 : 0
      previous = current
      if (stable >= 18) resolve(); else requestAnimationFrame(next)
    }
    requestAnimationFrame(next)
  }))
}

async function select(page, id, real = true) {
  const node = page.locator(`.react-flow__node[data-id="${id}"]`)
  if (real) {
    const point = await node.evaluate(element => {
      const rect = element.getBoundingClientRect()
      for (let y = 2; y < Math.min(rect.height, 40); y += 2) for (let x = 2; x < Math.min(rect.width, 40); x += 2) {
        if (document.elementFromPoint(rect.left + x, rect.top + y)?.closest('.react-flow__node') === element) return { x, y }
      }
      return null
    })
    assert.ok(point, `A real hit-tested selection point must exist for ${id}`)
    await node.click({ position: point })
  }
  else await node.dispatchEvent('click', { bubbles: true })
  await frames(page)
}

async function state(page) {
  return page.evaluate(() => ({
    camera: document.querySelector('.react-flow__viewport')?.style.transform,
    library: document.querySelector('.library')?.classList.contains('open'),
    inspector: document.querySelector('.inspector')?.classList.contains('open'),
    pin: document.querySelector('button[aria-label="Unpin component library"]')?.getAttribute('aria-pressed') ?? null,
    tool: document.querySelector('.tool-rail .icon-button.active')?.getAttribute('aria-label'),
    selected: [...document.querySelectorAll('.react-flow__node.selected')].map(node => node.dataset.id),
    edges: [...document.querySelectorAll('.react-flow__edge.selected')].map(edge => edge.dataset.id),
    focus: document.activeElement?.getAttribute('aria-label'),
    undo: document.querySelector('button[aria-label="Undo"]')?.disabled,
    redo: document.querySelector('button[aria-label="Redo"]')?.disabled,
  }))
}

async function bounds(page, label, touch = false) {
  const rail = []
  for (const control of await page.locator('.tool-rail button').all()) {
    const disabled = await control.isDisabled()
    await control.scrollIntoViewIfNeeded()
    if (!disabled) await control.focus()
    await frames(page)
    const measured = await control.evaluate(element => {
      const box = node => { const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } }
      const container = element.closest('.tool-rail')
      return { name: element.getAttribute('aria-label'), control: box(element), container: box(container), scrollTop: container.scrollTop, focused: document.activeElement === element, described: element.hasAttribute('aria-describedby'), disabled: element.disabled, overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight, width: innerWidth, height: innerHeight }
    })
    assert.equal(measured.overflow, false, `${label}: page overflow reaching ${measured.name}`)
    if (!disabled) {
      assert.equal(measured.focused, true, `${label}: rail focus ${measured.name}`)
      assert.equal(measured.described, true, `${label}: rail focus description ${measured.name}`)
    }
    const { control: rect, container } = measured
    assert.ok(rect.left >= Math.max(0, container.left) - .5 && rect.top >= Math.max(0, container.top) - .5 && rect.right <= Math.min(measured.width, container.right) + .5 && rect.bottom <= Math.min(measured.height, container.bottom) + .5, `${label}: unreachable rail ${JSON.stringify(measured)}`)
    if (touch) assert.ok(rect.width >= 44 && rect.height >= 44, `${label}: rail touch target ${JSON.stringify(measured)}`)
    rail.push(measured)
  }
  const result = await page.evaluate(() => {
    const box = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } }
    const controls = [...document.querySelectorAll('.topbar button, .canvas-toolbar button, .zoom-controls button, .mobile-controls button, .canvas-selection-toolbar button, .presentation-controls button, .panel-heading button')]
      .filter(element => element.getClientRects().length && !element.closest('[inert]')).map(element => ({ name: element.getAttribute('aria-label'), ...box(element) }))
    return { width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth, controls, heading: box(document.querySelector('.canvas-heading')), toolbar: document.querySelector('.canvas-toolbar') ? box(document.querySelector('.canvas-toolbar')) : null, canvas: box(document.querySelector('.canvas-surface')) }
  })
  await page.screenshot({ path: `${output}/${label}.png` })
  assert.equal(result.overflow, false, `${label}: page overflow`)
  for (const control of result.controls) {
    assert.ok(control.left >= -.5 && control.top >= -.5 && control.right <= result.width + .5 && control.bottom <= result.height + .5, `${label}: clipped ${JSON.stringify(control)}`)
    if (touch) assert.ok(control.width >= 44 && control.height >= 44, `${label}: touch target ${JSON.stringify(control)}`)
  }
  if (result.toolbar) assert.ok(!intersects(result.heading, result.toolbar), `${label}: heading overlaps arrangement toolbar`)
  for (const [index, first] of result.controls.entries()) for (const second of result.controls.slice(index + 1)) assert.ok(!intersects(first, second), `${label}: controls overlap ${first.name}/${second.name}`)
  return { ...result, rail }
}

function intersects(first, second) {
  return Math.min(first.right, second.right) - Math.max(first.left, second.left) > 1 && Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top) > 1
}

async function fitted(page, ids) {
  const result = await page.evaluate(ids => {
    const box = element => { const rect = element.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom } }
    return { canvas: box(document.querySelector('.canvas-surface')), nodes: [...document.querySelectorAll('.react-flow__node')].filter(node => !ids || ids.includes(node.dataset.id)).map(node => ({ id: node.dataset.id, ...box(node) })), chrome: [...document.querySelectorAll('[data-fit-chrome]')].filter(element => element.getClientRects().length).map(box) }
  }, ids ?? null)
  if (ids) assert.deepEqual(result.nodes.map(node => node.id).sort(), [...ids].sort(), 'Every selected descendant must be included in framing checks')
  for (const node of result.nodes) {
    assert.ok(node.left >= result.canvas.left - .5 && node.right <= result.canvas.right + .5 && node.top >= result.canvas.top - .5 && node.bottom <= result.canvas.bottom + .5, `Unframed ${node.id}: ${JSON.stringify(result)}`)
    for (const chrome of result.chrome) assert.ok(!intersects(node, chrome), `Fit obscures ${node.id}: ${JSON.stringify(result)}`)
  }
  return result
}

async function parity(page, document, label) {
  const vector = await svg(page, label)
  const result = await page.evaluate(({ source, expected }) => {
    const parsed = new DOMParser().parseFromString(source, 'image/svg+xml')
    const groups = [...parsed.documentElement.children].filter(element => element.tagName === 'g' && element.hasAttribute('transform'))
    const labels = groups.map(group => [...group.querySelectorAll('text')].map(text => text.textContent).join(''))
    const same = groups.map((group, index) => {
      const canvas = document.querySelector(`.react-flow__node[data-id="${expected[index].id}"] .architecture-tile > svg`)
      const normalized = new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${canvas.innerHTML}</svg>`, 'image/svg+xml')
      return group.innerHTML === normalized.documentElement.innerHTML
    })
    const nodeRanks = expected.map(entity => ({ id: entity.id, z: Number(getComputedStyle(document.querySelector(`.react-flow__node[data-id="${entity.id}"]`)).zIndex) }))
    const edgeRanks = [...document.querySelectorAll('.react-flow__edge')].map(edge => ({ id: edge.dataset.id, z: Number(getComputedStyle(edge.closest('svg')).zIndex) }))
    return { labels, same, nodeRanks, edgeRanks, parserError: parsed.querySelector('parsererror')?.textContent, pointerInExport: /presentation-pointer|tool-rail|react-flow__/.test(source) }
  }, { source: vector.bytes.toString(), expected: painterOrder(document.entities).entities })
  assert.equal(result.parserError, undefined)
  assert.ok(result.same.every(Boolean), `Shared SVG markup mismatch: ${JSON.stringify(result)}`)
  const paint = painterOrder(document.entities)
  for (const node of result.nodeRanks) assert.equal(node.z, paint.nodeZIndices.get(node.id), `${node.id} actual canvas z`)
  for (const edge of result.edgeRanks) assert.equal(edge.z, paint.connectionZIndex, `${edge.id} actual canvas connection stratum`)
  assert.equal(result.pointerInExport, false)
  return { ...result, path: vector.path }
}

async function check(name, callback, options = {}) {
  if (process.env.DGM_S2_CASE && !name.includes(process.env.DGM_S2_CASE)) return
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce', ...options })
  const page = await context.newPage()
  page.setDefaultTimeout(10000)
  page.on('dialog', dialog => dialog.accept())
  page.on('pageerror', error => { if (!error.message.startsWith('ResizeObserver loop')) report.errors.push({ name, error: error.message }) })
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) report.requests.push(request.url()) })
  try {
    await page.goto(base)
    await page.waitForFunction(() => document.querySelector('button[aria-label="New diagram"]')?.disabled === false)
    await saved(page)
    await page.evaluate(() => document.fonts.ready)
    const evidence = await callback(page, context)
    const status = name.startsWith('Diagnostic ') ? 'CAPTURED' : 'PASS'
    report.cases.push({ name, status, evidence })
    console.log(`${status} ${name}`)
  } catch (error) {
    await page.screenshot({ path: `${output}/failure-${name.replace(/[^a-z0-9]/gi, '-')}.png` }).catch(() => {})
    report.cases.push({ name, status: 'FAIL', error: error.stack, url: page.url() })
    console.error(`FAIL ${name}: ${error.message}`)
  } finally { await context.close() }
}

function geometry(document) {
  return { entities: document.entities.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })), connections: document.connections.map(({ routeRevision, ...connection }) => connection) }
}

async function arrange(page) {
  const before = await durable(page)
  await button(page, 'Auto-arrange').click()
  await page.waitForFunction(revision => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device' && !document.querySelector('button[aria-label="Auto-arrange"]').disabled && !/failed|Layout may change only/.test(document.querySelector('[role="status"]')?.textContent ?? '') && revision !== undefined, before.revision)
  const result = await durable(page)
  assert.equal(result.revision, before.revision + 1, 'A real worker layout must commit exactly once')
  return result
}

try {
  await mkdir(output, { recursive: true })
  server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  base = server.resolvedUrls.local[0]
  report.url = base
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  report.browser = browser.version()
  report.production = true
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 720, height: 450 }]) {
    await check(`Workspace ${viewport.width}x${viewport.height}`, async page => {
      const compact = viewport.width <= 900
      const initial = await state(page)
      assert.equal(initial.inspector, false)
      assert.equal(initial.library, viewport.width > 640)
      assert.equal(await button(page, 'Fit selection').isDisabled(), true)
      const screenshots = []
      for (const theme of ['light', 'dark']) {
        if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
        screenshots.push(await bounds(page, `${viewport.width}-${theme}-workspace`, viewport.width === 390))
        const fitButton = button(page, 'Fit diagram')
        await fitButton.focus()
        assert.equal(await fitButton.getAttribute('aria-describedby') !== null, true)
        await page.screenshot({ path: `${output}/${viewport.width}-${theme}-focus.png` })
      }
      await closePanels(page)
      await fit(page)
      const before = await json(page, `${viewport.width}-navigation-before`)
      await fitted(page)
      await select(page, 'platform')
      if (compact) await properties(page)
      await closePanels(page)
      await fit(page, true)
      const selectedFrame = ['platform', 'application', 'data', 'gateway', 'app', 'sql', 'storage']
      const selectionFit = await fitted(page, selectedFrame)
      await button(page, 'Pan tool').click()
      const panPath = await page.evaluate(() => {
        const canvas = document.querySelector('.canvas-surface').getBoundingClientRect()
        const oldPoint = { x: canvas.left + canvas.width * .7, y: canvas.top + canvas.height * .7 }
        const oldTarget = document.elementFromPoint(oldPoint.x, oldPoint.y)
        for (let y = canvas.top + 32; y < canvas.bottom - 50; y += 12) for (let x = canvas.left + 32; x < canvas.right - 50; x += 12) {
          const points = Array.from({ length: 6 }, (_, index) => ({ x: x + index * 5, y: y + index * 5 }))
          if (points.every(point => document.elementFromPoint(point.x, point.y)?.classList.contains('react-flow__pane'))) return { points, oldPoint, oldTarget: oldTarget?.getAttribute('class'), allHitsPane: true }
        }
        return null
      })
      assert.ok(panPath, 'A hit-tested blank pane drag path must exist')
      const priorPan = (await state(page)).camera
      await page.mouse.move(panPath.points[0].x, panPath.points[0].y)
      await page.mouse.down(); await page.mouse.move(panPath.points[5].x, panPath.points[5].y, { steps: 5 }); await page.mouse.up()
      assert.notEqual((await state(page)).camera, priorPan)
      assert.deepEqual(await json(page, `${viewport.width}-navigation-after`), before)
      await button(page, 'Open component library').click()
      const camera = (await state(page)).camera
      if (!compact) await button(page, 'Pin component library').click()
      await button(page, 'Open properties').click()
      const panels = await state(page)
      assert.equal(panels.library, !compact)
      assert.equal(panels.inspector, true)
      assert.equal(panels.camera, camera)
      if (!compact) {
        await page.setViewportSize({ width: 390, height: 844 })
        assert.equal((await state(page)).library && (await state(page)).inspector, false)
        await closePanels(page)
        await page.setViewportSize(viewport)
      }
      await closePanels(page)
      await fit(page)
      await button(page, 'Present').focus()
      const snapshot = await state(page)
      await button(page, 'Present').press('Enter')
      await button(page, 'Exit presentation').waitFor()
      const presentationFit = await fitted(page, selectedFrame)
      await bounds(page, `${viewport.width}-present`, viewport.width === 390)
      assert.equal(await page.locator('.react-flow__background').count(), 0)
      assert.equal(await page.locator('.tile-selected, .react-flow__handle, .react-flow__resize-control').count(), 0)
      await button(page, 'Presentation pointer').focus()
      await button(page, 'Presentation pointer').press('Enter')
      await page.getByRole('img', { name: 'Presentation pointer position' }).press('ArrowRight')
      await page.screenshot({ path: `${output}/${viewport.width}-present-pointer.png` })
      await page.keyboard.press('Escape')
      const restored = await state(page)
      assert.deepEqual(restored, snapshot)
      assert.deepEqual(await json(page, `${viewport.width}-present-restored`), before)
      return { initial, screenshots, panels, selectionFit, presentationFit, panPath, panChangedCamera: true, exactNavigationNonMutation: true, exactRestore: true, reducedMotion: true, zoomEquivalence: viewport.width === 720 ? '1440x900 physical at 200% equivalent CSS layout with DPR2; native browser chrome zoom not exercised' : null }
    }, { viewport, hasTouch: viewport.width === 390, deviceScaleFactor: viewport.width === 720 ? 2 : 1 })
  }

  await check('Order F1 nested bands routes SVG canvas parity', async page => {
    const document = sampleDiagram()
    document.id = 'sprint2-order'; document.title = 'Ordering parity'
    document.entities.push({ id: 'background', kind: 'rectangle', label: 'Background probe', x: 0, y: 0, width: 250, height: 100, layer: 'background', color: 'rose', parentId: null })
    await open(page, document)
    await closePanels(page); await fit(page)
    await select(page, 'background', false); await properties(page)
    await button(page, 'Send to bottom').click(); await frames(page)
    assert.deepEqual(await json(page, 'F1-noop'), document)
    assert.equal(await button(page, 'Undo').isDisabled(), true)
    await closePanels(page)
    const arranged = await arrange(page)
    await fit(page)
    await select(page, 'application', false); await properties(page)
    const before = await parity(page, arranged, 'order-before')
    await button(page, 'Bring to top').click(); await saved(page)
    const changed = await json(page, 'ordered')
    assert.equal(changed.revision, arranged.revision + 1)
    assert.deepEqual(changed.entities.map(({ order, ...entity }) => entity), arranged.entities.map(({ order, ...entity }) => entity))
    assert.deepEqual(changed.connections, arranged.connections.map(connection => ({ ...connection, routeRevision: changed.revision })))
    const after = await parity(page, changed, 'order-after')
    await button(page, 'Undo').click(); await saved(page)
    assert.deepEqual(await json(page, 'order-exact-undo'), arranged)
    await page.screenshot({ path: `${output}/order-selected.png` })
    return { f1ExactNoop: true, before, after, routeGeometryPreserved: true, exactUndo: true }
  })

  await check('Overlapping nested boundaries canvas pixels selection parity', async page => {
    const document = sampleDiagram()
    document.title = 'Overlapping groups'
    document.entities = document.entities.map(entity => entity.id === 'data' ? { ...entity, x: 80, y: 100 } : entity)
    await open(page, document); await closePanels(page); await fit(page)
    const evidence = []
    for (const selection of [null, 'data', 'application', null]) {
      if (selection) await select(page, selection, false)
      else await page.locator('.react-flow__pane').dispatchEvent('click', { bubbles: true })
      await closePanels(page); await fit(page)
      const rectangle = await page.locator('.react-flow__node[data-id="gateway"]').boundingBox()
      const point = { x: Math.floor(rectangle.x + rectangle.width * .85), y: Math.floor(rectangle.y + rectangle.height * .85) }
      const image = await page.screenshot({ path: `${output}/overlap-${selection ?? 'deselected'}.png` })
      const pixel = await page.evaluate(async ({ image, point }) => {
        const bitmap = new Image(); bitmap.src = `data:image/png;base64,${image}`; await bitmap.decode()
        const canvas = document.createElement('canvas'); canvas.width = bitmap.naturalWidth; canvas.height = bitmap.naturalHeight
        const context = canvas.getContext('2d'); context.drawImage(bitmap, 0, 0)
        return [...context.getImageData(point.x, point.y, 1, 1).data]
      }, { image: image.toString('base64'), point })
      assert.deepEqual(pixel, [255, 255, 255, 255], 'Tile fill remains above both overlapping boundary fills')
      evidence.push({ selection, pixel, parity: await parity(page, document, `overlap-${selection ?? 'none'}`) })
    }
    assert.deepEqual(await json(page, 'overlap-nonmutation'), document)
    return evidence
  })

  for (const viewport of [{ width: 390, height: 844 }, { width: 720, height: 450 }]) await check(`Diagnostic blocked viewport ${viewport.width}`, async page => {
    const observations = []
    const measure = () => page.evaluate(() => {
      const boxes = selector => [...document.querySelectorAll(selector)].filter(element => element.getClientRects().length && !element.closest('[inert]')).map(element => {
        const rect = element.getBoundingClientRect(), style = getComputedStyle(element)
        return { name: element.getAttribute('aria-label') ?? element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor }
      })
      return { controls: boxes('button'), text: boxes('.canvas-heading h1, .diagram-meta, .brand-name'), pageOverflow: document.documentElement.scrollWidth > innerWidth, camera: document.querySelector('.react-flow__viewport')?.style.transform }
    })
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
      await closePanels(page); await fit(page)
      await button(page, 'Fit diagram').focus()
      await page.screenshot({ path: `${output}/${viewport.width}-${theme}-blocked-focus.png` })
      observations.push({ theme, view: 'editor', ...await measure() })
      await button(page, 'Present').focus(); await button(page, 'Present').press('Enter')
      await button(page, 'Exit presentation').waitFor()
      await page.screenshot({ path: `${output}/${viewport.width}-${theme}-blocked-present.png` })
      observations.push({ theme, view: 'Present', ...await measure() })
      await page.keyboard.press('Escape')
    }
    const title = page.getByLabel('Document title', { exact: true })
    await title.fill('Long title '.repeat(10)); await title.press('Tab'); await saved(page)
    await button(page, 'Document properties').click()
    const subtitle = page.getByLabel('Document subtitle', { exact: true })
    await subtitle.fill('Long subtitle '.repeat(14)); await subtitle.press('Tab'); await saved(page)
    await closePanels(page); await fit(page)
    await page.screenshot({ path: `${output}/${viewport.width}-long-title-editor.png` })
    await button(page, 'Present').click(); await button(page, 'Exit presentation').waitFor()
    await page.screenshot({ path: `${output}/${viewport.width}-long-title-present.png` })
    observations.push({ view: 'Long title Present', ...await measure() })
    return { acceptance: 'NOT PASSED: diagnostic frames only; earlier mobile/zoom defects remain', observations }
  }, { viewport, hasTouch: viewport.width === 390, deviceScaleFactor: viewport.width === 720 ? 2 : 1 })

  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 720, height: 450 }]) await check(`Long title Present fit ${viewport.width}`, async page => {
    const title = page.getByLabel('Document title', { exact: true })
    await title.fill('Long title '.repeat(10)); await title.press('Tab'); await saved(page)
    await button(page, 'Document properties').click()
    const subtitle = page.getByLabel('Document subtitle', { exact: true })
    await subtitle.fill('Long subtitle '.repeat(14)); await subtitle.press('Tab'); await saved(page)
    await closePanels(page); await fit(page)
    await button(page, 'Present').click(); await button(page, 'Exit presentation').waitFor()
    await page.evaluate(async () => { for (let index = 0; index < 20; index++) await new Promise(resolve => requestAnimationFrame(resolve)) })
    await page.screenshot({ path: `${output}/${viewport.width}-long-title-settled-present.png` })
    return fitted(page)
  }, { viewport, deviceScaleFactor: viewport.width === 720 ? 2 : 1 })

  await check('Diagnostic measured light dark contrast', async page => {
    const results = []
    for (const theme of ['light', 'dark']) {
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
      await page.waitForFunction(theme => document.documentElement.getAttribute('data-theme') === theme, theme)
      await page.evaluate(async () => { for (let index = 0; index < 20; index++) await new Promise(resolve => requestAnimationFrame(resolve)) })
      const measurement = await page.evaluate(() => {
        const parse = value => value.startsWith('#') ? value.slice(1).match(/../g).map(channel => parseInt(channel, 16)) : value.match(/[\d.]+/g).slice(0, 3).map(Number)
        const luminance = channels => channels.map(channel => { const value = channel / 255; return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4 }).reduce((sum, value, index) => sum + value * [.2126, .7152, .0722][index], 0)
        const contrast = (first, second) => { const values = [luminance(parse(first)), luminance(parse(second))].sort((left, right) => right - left); return (values[0] + .05) / (values[1] + .05) }
        const canvas = getComputedStyle(document.querySelector('.canvas-surface')).backgroundColor
        const note = document.querySelector('.react-flow__node[data-id="note"] svg text').getAttribute('fill')
        const heading = getComputedStyle(document.querySelector('.canvas-heading h1')).color
        const focus = getComputedStyle(document.querySelector('.zoom-controls')).color
        return { canvas, annotation: note, annotationRatio: contrast(note, canvas), heading, headingRatio: contrast(heading, canvas), focus }
      })
      results.push({ theme, ...measurement })
    }
    return { criterion: 'Measured observation; 4.5:1 is normal-text WCAG guidance, not a silently altered acceptance threshold', results }
  })

  for (const long of [false, true]) await check(`Layout ${long ? 'long' : 'short'} headers repeated worker`, async page => {
    const bases = []
    for (const size of [300, 3000]) {
      const document = { ...createDocument(`header-${size}`, `Header ${long ? 'long' : 'short'} ${size}`), entities: [
        { id: 'parent', kind: 'boundary', label: long ? 'W'.repeat(120) : 'Azure subscription', subtitle: long ? 'W'.repeat(200) : 'Production boundary', x: 0, y: 0, width: size, height: size, color: 'azure', parentId: null, layer: 'foreground' },
        { id: 'child', kind: 'component', label: 'Service', x: 24, y: 210, width: 220, height: 88, color: 'teal', parentId: 'parent', layer: 'foreground' },
      ] }
      await open(page, document); await closePanels(page)
      const directions = {}
      for (const direction of ['RIGHT', 'DOWN', 'RIGHT']) {
        if (direction !== (await durable(page)).direction) { await button(page, direction === 'RIGHT' ? 'Right layout' : 'Down layout').click(); await saved(page) }
        let arranged = await arrange(page)
        if (directions[direction]) assert.deepEqual(geometry(arranged), directions[direction])
        directions[direction] = geometry(arranged)
        for (let index = 0; index < 10; index++) {
          arranged = await arrange(page)
          assert.deepEqual(geometry(arranged), directions[direction])
        }
        const parent = arranged.entities.find(entity => entity.id === 'parent')
        const child = arranged.entities.find(entity => entity.id === 'child')
        const gap = child.y - entityTextGeometry(parent).textBottom
        assert.ok(gap >= 18 && gap <= 32, `Isolated header gap=${gap}`)
        await fit(page)
        const textBounds = await page.locator('.react-flow__node[data-id="parent"] svg text').evaluateAll(texts => texts.map(text => { const box = text.getBBox(); return { right: box.x + box.width, bottom: box.y + box.height } }))
        assert.ok(textBounds.every(box => box.right <= parent.width && box.bottom < child.y), 'Actual native SVG text fits parent and clears child')
        await parity(page, arranged, `header-${long}-${size}-${direction}`)
        await page.screenshot({ path: `${output}/header-${long}-${size}-${direction}.png` })
      }
      bases.push(directions)
    }
    assert.deepEqual(bases[0], bases[1])
    return { repeatedLayouts: 66, directions: ['RIGHT', 'DOWN', 'RIGHT'], exactCompactOversizedConvergence: true }
  })

  await check('Nested annotations production layout exact undo', async page => {
    const document = sampleDiagram()
    document.title = 'Nested annotations'
    document.entities = document.entities.map(entity => entity.id === 'note' ? { ...entity, parentId: 'application', x: -40, y: -20 } : entity)
    document.entities.push({ id: 'nested-rectangle', kind: 'rectangle', label: 'Anchored annotation', parentId: 'data', x: 170, y: 390, width: 240, height: 110, color: 'gray', layer: 'background' })
    await open(page, document); await closePanels(page)
    const annotations = document.entities.filter(entity => ['text', 'rectangle'].includes(entity.kind))
    const evidence = []
    for (const direction of ['RIGHT', 'DOWN']) {
      if (direction !== (await durable(page)).direction) { await button(page, 'Down layout').click(); await saved(page) }
      const before = await durable(page)
      const arranged = await arrange(page)
      for (const annotation of annotations) {
        assert.deepEqual(absolutePosition(arranged, annotation.id), absolutePosition(document, annotation.id))
        assert.deepEqual({ ...arranged.entities.find(entity => entity.id === annotation.id), x: annotation.x, y: annotation.y }, annotation)
      }
      await fit(page); await parity(page, arranged, `annotations-${direction}`)
      await page.screenshot({ path: `${output}/annotations-${direction}.png` })
      await button(page, 'Undo').click(); await saved(page)
      assert.deepEqual(await json(page, `annotation-undo-${direction}`), before)
      evidence.push({ direction, absoluteAnnotationPreservation: true, exactUndo: true })
    }
    return evidence
  })

  await check('Present mutation guards draft autosave pointer fullscreen restore', async (page, context) => {
    await closePanels(page); await fit(page)
    await select(page, 'gateway'); await properties(page)
    await page.getByLabel('Hex color', { exact: true }).fill('#abcd')
    await button(page, 'Present').click()
    assert.equal(await button(page, 'Exit presentation').count(), 0)
    assert.equal(await page.getByLabel('Hex color', { exact: true }).getAttribute('aria-invalid'), 'true')
    await page.getByLabel('Hex color', { exact: true }).press('Escape')
    await page.getByLabel('Component label', { exact: true }).fill('Accepted presentation draft')
    await button(page, 'Present').click()
    await button(page, 'Exit presentation').waitFor()
    await page.waitForFunction(() => document.querySelector('h1')?.textContent === 'Commerce platform')
    await page.keyboard.press('Escape'); await saved(page)
    const committed = await json(page, 'draft-committed')
    assert.equal(committed.entities.find(entity => entity.id === 'gateway').label, 'Accepted presentation draft')
    await page.keyboard.press('Control+c')
    await page.getByLabel('Component label', { exact: true }).focus()
    const snapshot = await state(page)
    const vectorBefore = await svg(page, 'present-export-before')
    await page.getByLabel('Component label', { exact: true }).focus()
    await button(page, 'Present').click(); await button(page, 'Exit presentation').waitFor()
    const markup = await page.locator('.architecture-tile > svg').evaluateAll(nodes => nodes.map(node => node.innerHTML))
    const keys = ['Delete', 'Backspace', 'ArrowRight', 'ArrowDown', 'Control+x', 'Control+v', 'Control+d', 'Control+z', 'Control+y', 'Control+Shift+z']
    for (const key of keys) await page.keyboard.press(key)
    const data = await page.evaluateHandle(() => { const transfer = new DataTransfer(); transfer.setData('application/diagrammer', JSON.stringify({ icon: 'azure-app', label: 'Forbidden', color: 'azure' })); return transfer })
    await page.locator('.canvas-surface').dispatchEvent('drop', { dataTransfer: data, clientX: 600, clientY: 400 }); await data.dispose()
    await page.getByLabel('Open document file', { exact: true }).setInputFiles({ name: 'hidden.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createDocument('forbidden'))) })
    await page.getByLabel('Import skill file', { exact: true }).setInputFiles({ name: 'hidden.json', mimeType: 'application/json', buffer: Buffer.from('{}') })
    const nodeBox = await page.locator('.react-flow__node[data-id="gateway"]').boundingBox()
    await page.mouse.move(nodeBox.x + 20, nodeBox.y + 20); await page.mouse.down(); await page.mouse.move(nodeBox.x + 80, nodeBox.y + 60, { steps: 8 }); await page.mouse.up()
    await button(page, 'Presentation pointer').click()
    const pointer = page.getByRole('img', { name: 'Presentation pointer position' })
    const oldPointer = await pointer.getAttribute('style')
    await pointer.press('ArrowRight'); assert.notEqual(await pointer.getAttribute('style'), oldPointer)
    await button(page, 'Zoom in').click(); await frames(page)
    assert.deepEqual(await durable(page), committed)
    assert.deepEqual(await page.locator('.architecture-tile > svg').evaluateAll(nodes => nodes.map(node => node.innerHTML)), markup)
    await page.locator('.canvas-surface').evaluate(element => { element.requestFullscreen = async () => { throw new Error('Verifier denied fullscreen') } })
    await button(page, 'Fullscreen presentation').click()
    await page.getByRole('status').filter({ hasText: 'Fullscreen unavailable' }).waitFor()
    await page.screenshot({ path: `${output}/present-mutation-fullscreen-denied.png` })
    await page.keyboard.press('Escape')
    assert.deepEqual(await state(page), snapshot)
    assert.deepEqual(await json(page, 'present-mutations-restored'), committed)
    const vectorAfter = await svg(page, 'present-export-after')
    assert.deepEqual(vectorAfter.bytes, vectorBefore.bytes)
    await page.locator('.canvas-surface').evaluate(element => { delete element.requestFullscreen })
    await button(page, 'Present').click(); await button(page, 'Fullscreen presentation').click()
    await page.waitForFunction(() => !!document.fullscreenElement)
    await page.screenshot({ path: `${output}/present-fullscreen.png` })
    await page.evaluate(() => document.exitFullscreen())
    await button(page, 'Present').waitFor()
    assert.equal(await page.locator('.app-shell.presenting').count(), 0)
    const observer = await context.newPage()
    await observer.goto(base)
    await observer.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Read-only')
    await button(observer, 'Present').click(); await observer.keyboard.press('Escape')
    assert.equal(await button(observer, 'New diagram').isDisabled(), true)
    await observer.keyboard.press('Delete'); await observer.keyboard.press('Control+v')
    assert.deepEqual(await durable(observer), committed)
    await observer.close()
    return { keys, hiddenShellPickers: true, dropDragGuard: true, pointerSessionOnly: true, exactRestore: true, exactExport: true, draftCommitAndRejection: true, realFullscreenEntryAndFullscreenchangeExit: true, denialFallback: true, readOnlyExit: true }
  })

  await check('Present delayed file icon requests and empty document', async page => {
    const before = await json(page, 'pending-before')
    await page.evaluate(() => {
      const original = File.prototype.text
      File.prototype.text = async function () { const result = await original.call(this); await new Promise(resolve => { window.__s2ReleaseFile = resolve }); return result }
    })
    await page.getByLabel('Open document file', { exact: true }).setInputFiles({ name: 'pending.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(createDocument('stale', 'Stale replacement'))) })
    await page.waitForFunction(() => typeof window.__s2ReleaseFile === 'function')
    await button(page, 'Present').click(); await button(page, 'Exit presentation').waitFor()
    await page.evaluate(() => window.__s2ReleaseFile()); await frames(page)
    await page.keyboard.press('Escape')
    assert.deepEqual(await json(page, 'pending-file-stale'), before)
    await page.evaluate(() => {
      const original = HTMLImageElement.prototype.decode
      HTMLImageElement.prototype.decode = async function () { await original.call(this); await new Promise(resolve => { window.__s2ReleaseImage = resolve }) }
    })
    await page.getByLabel('Import icon file', { exact: true }).setInputFiles({ name: 'icon.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><path fill="red" d="M0 0h32v32H0z"/></svg>') })
    await page.waitForFunction(() => typeof window.__s2ReleaseImage === 'function')
    await button(page, 'Present').click(); await button(page, 'Exit presentation').waitFor()
    await page.keyboard.press('Escape')
    await page.evaluate(() => window.__s2ReleaseImage()); await frames(page)
    assert.deepEqual(await json(page, 'pending-icon-stale-after-exit'), before)
    await button(page, 'New diagram').click(); await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 0)
    await saved(page)
    const empty = await json(page, 'empty-before')
    await button(page, 'Present').click()
    assert.equal(await button(page, 'Fit diagram').isDisabled(), true)
    await page.screenshot({ path: `${output}/empty-present.png` })
    await button(page, 'Exit presentation').click()
    assert.deepEqual(await json(page, 'empty-after'), empty)
    return { pendingFileInvalidated: true, pendingImageInvalidatedAfterExit: true, emptyNonMutation: true }
  })

  if (!process.env.DGM_S2_CASE || process.env.DGM_S2_CASE === 'Performance') {
    await browser.close()
    const performance = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, [fileURLToPath(new URL('./verify-v1.mjs', import.meta.url))], { cwd: root, env: { ...process.env, DGM_V1_URL: base, DGM_V1_CASE: 'Production stress' } })
      let stdout = '', stderr = ''
      child.stdout.on('data', data => { stdout += data })
      child.stderr.on('data', data => { stderr += data })
      child.on('error', reject)
      child.on('close', status => resolve({ status, stdout, stderr }))
    })
    await writeFile(`${output}/performance-run.log`, `${performance.stdout}\n${performance.stderr}`)
    const source = fileURLToPath(new URL('../test-results/v1/focused-Production-stress.json', import.meta.url))
    const evidence = JSON.parse(await readFile(source, 'utf8'))
    await writeFile(`${output}/performance.json`, JSON.stringify(evidence, null, 2))
    report.cases.push({ name: 'Unmodified V1 100entity 150edge production performance', status: performance.status === 0 && evidence.reports.length === 1 && evidence.reports.every(item => item.passed) ? 'PASS' : 'FAIL', exit: performance.status, evidence: evidence.performance, failures: evidence.reports.filter(item => !item.passed) })
    console.log(`PERFORMANCE exit=${performance.status}; p95=${evidence.performance?.p95Milliseconds}; maxLayout=${Math.max(...(evidence.performance?.layoutMilliseconds ?? []))}`)
  }
} catch (error) {
  report.runnerError = error.stack
  process.exitCode = 1
} finally {
  try { await browser?.close() } catch (error) { report.cleanupError = error.stack }
  if (server) await new Promise(resolve => server.httpServer.close(resolve))
  report.closed = true
  report.passed = report.cases.filter(item => item.status === 'PASS').length
  report.failed = report.cases.filter(item => item.status === 'FAIL').length
  const name = process.env.DGM_S2_CASE ? `focused-${process.env.DGM_S2_CASE.replace(/[^a-z0-9]/gi, '-')}.json` : 'browser-report.json'
  await writeFile(`${output}/${name}`, JSON.stringify(report, null, 2))
  console.log(`Edge ${report.browser}; ${report.passed} passed/${report.failed} failed; ${report.errors.length} page errors; ${report.requests.length} external requests; server and browser closed. Evidence ${output}/${name}`)
  if (report.failed || report.runnerError || report.cleanupError || report.errors.length || report.requests.length) process.exitCode = 1
}