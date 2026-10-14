import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { catalogCoverage, verifyCatalogPalette } from './verify-catalog.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.DGM_FOUNDATION_OUTPUT ?? fileURLToPath(new URL('../test-results/foundation/', import.meta.url))
const server = process.env.DGM_FOUNDATION_URL ? null : await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
const url = process.env.DGM_FOUNDATION_URL ?? server.resolvedUrls.local[0]
let browser

async function canonical(page, label) {
  await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
  return jsonCopy(page, label)
}

async function jsonCopy(page, label) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save JSON', exact: true }).click()
  const file = await pending
  const path = `${output}/${label}.json`
  await file.saveAs(path)
  assert.equal(await file.failure(), null)
  return JSON.parse(await readFile(path, 'utf8'))
}

async function saveCopyLayout(page, label, saveLabel, backupLabel) {
  await page.waitForFunction(() => document.fonts.status === 'loaded')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  const measurements = await page.evaluate(() => {
    const box = element => { const bounds = element.getBoundingClientRect(); return { left: bounds.left, right: bounds.right, top: bounds.top, bottom: bounds.bottom, width: bounds.width, height: bounds.height } }
    const visible = element => element.getClientRects().length && !element.closest('[inert]') && getComputedStyle(element).visibility !== 'hidden'
    const states = [...document.querySelectorAll('.save-label, .backup-state, .session-state, .inspector-footer, .statusbar [role="status"]')].filter(visible).map(element => {
      const range = document.createRange(); range.selectNodeContents(element)
      return { text: element.textContent, bounds: box(element), textBounds: [...range.getClientRects()].filter(rect => rect.width && rect.height).map(rect => ({ left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom })), clipped: element.scrollWidth > element.clientWidth + 1 || element.scrollHeight > element.clientHeight + 1 }
    })
    const controls = [...document.querySelectorAll('.topbar button')].filter(visible).map(element => ({ label: element.getAttribute('aria-label'), ...box(element) }))
    const footer = [...document.querySelectorAll('.statusbar > span')].filter(visible).map(box)
    return { width: innerWidth, height: innerHeight, overflow: document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight, states, controls, footer }
  })
  await page.screenshot({ path: `${output}/${label}.png` })
  await writeFile(`${output}/${label}.json`, JSON.stringify(measurements, null, 2))
  assert.equal(await page.locator('.save-label').textContent(), saveLabel)
  assert.equal(await page.locator('.backup-state').textContent(), backupLabel)
  assert.equal(measurements.overflow, false, `${label}: page overflow`)
  for (const state of measurements.states) {
    assert.equal(state.clipped, false, `${label}: clipped state ${state.text}`)
    for (const rect of state.textBounds) assert.ok(rect.left >= -1 && rect.right <= measurements.width + 1 && rect.top >= state.bounds.top - 1 && rect.bottom <= state.bounds.bottom + 1, `${label}: text outside state bounds ${JSON.stringify(state)}`)
  }
  for (const control of measurements.controls) assert.ok(control.left >= 0 && control.right <= measurements.width + 1 && control.top >= 0 && control.bottom <= measurements.height + 1, `${label}: unreachable action ${control.label}`)
  for (const group of [measurements.footer, measurements.controls]) for (let first = 0; first < group.length; first++) for (let second = first + 1; second < group.length; second++) {
    const before = group[first], after = group[second]
    const overlapWidth = Math.min(before.right, after.right) - Math.max(before.left, after.left)
    const overlapHeight = Math.min(before.bottom, after.bottom) - Math.max(before.top, after.top)
    assert.ok(overlapWidth <= 1 || overlapHeight <= 1, `${label}: overlapping states/actions`)
  }
}

function positions(document) {
  return document.entities.map(({ id, x, y, width, height }) => ({ id, x, y, width, height }))
}

function semantics(document) {
  const { revision, direction, entities, connections, ...metadata } = document
  return {
    ...metadata,
    entities: entities.map(entity => {
      if (entity.kind !== 'component' && entity.kind !== 'boundary') return entity
      const { x, y, width, height, ...content } = entity
      return content
    }),
    connections: connections.map(({ points, labelPosition, routeRevision, ...content }) => content),
  }
}

try {
  const coverage = await catalogCoverage()
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  await mkdir(output, { recursive: true })
  await verifySaveStates()
  await verifyStarterChoices()
  await verifyAlignmentActions()
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
    const page = await browser.newPage({ viewport })
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(url)
    await page.getByRole('heading', { name: 'Commerce platform', exact: true }).waitFor()
    await page.locator('.react-flow__node').first().waitFor()
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.locator('.react-flow__node').count(), 9)
    assert.equal(await page.locator('.react-flow__edge').count(), 4)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    if (viewport.width > 640) {
      const swatches = await page.locator('.swatch').evaluateAll(elements => elements.map(element => ({ width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height })))
      assert.ok(swatches.every(swatch => swatch.width === swatch.height && swatch.width >= 24), 'Semantic swatches must not collapse or distort')
      await verifyCatalogPalette(page)
      await page.waitForFunction(() => [...document.querySelectorAll('.library img')].every(image => image.complete && image.naturalWidth > 0))
      const before = await canonical(page, `${viewport.width}-before-arrange`)
      const renderedBefore = await page.locator('.react-flow__node').evaluateAll(nodes => JSON.stringify(nodes.map(node => [node.dataset.id, node.style.transform, node.style.width, node.style.height])))
      await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
      await page.waitForFunction(previous => {
        const status = document.querySelector('[role="status"]')?.textContent ?? ''
        if (/Auto-arrange failed|Layout may change only/.test(status)) throw new Error(status)
        if (document.querySelector('button[aria-label="Auto-arrange"]').disabled || document.querySelector('.statusbar .save-label')?.textContent !== 'Saved on this device') return false
        return JSON.stringify([...document.querySelectorAll('.react-flow__node')].map(node => [node.dataset.id, node.style.transform, node.style.width, node.style.height])) !== previous
      }, renderedBefore)
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const arranged = await canonical(page, `${viewport.width}-arranged`)
      assert.equal(arranged.revision, before.revision + 1, 'Auto-arrange commits exactly one transaction')
      assert.notDeepEqual(positions(arranged), positions(before), 'Auto-arrange must change actual entity geometry')
      assert.deepEqual(semantics(arranged), semantics(before), 'IDs, metadata, annotations, content and membership are preserved')
      assert.ok(arranged.connections.every(connection => connection.points.length >= 2 && connection.routeRevision === arranged.revision), 'Every connection has a current layout route')
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      assert.deepEqual(await canonical(page, `${viewport.width}-undo-arrange`), before, 'One undo restores exact canonical positions, sizes, routes and metadata')
    }
    await page.screenshot({ path: `${output}/${viewport.width}x${viewport.height}.png` })
    assert.deepEqual(errors, [])
    console.log(`PASS: ${viewport.width}x${viewport.height}: 9 nodes, 4 edges, local font/assets, no overflow/page errors${viewport.width > 640 ? ', changed geometry/preserved semantics/exact one-step undo' : ''}`)
    await page.close()
  }
  async function verifyStarterChoices() {
    const starters = new Map(await Promise.all([
      ['Web/API', '../../examples/azure-web-app.json'], ['Event-driven', '../../examples/event-driven.json'],
      ['Fabric', '../../examples/fabric-onelake.json'], ['Enterprise', '../../examples/enterprise-integration.json'],
    ].map(async ([label, source]) => [label, JSON.parse(await readFile(new URL(source, import.meta.url), 'utf8'))])))
    for (const [index, label] of ['Blank', ...starters.keys()].entries()) {
      const context = await browser.newContext({ viewport: index === 2 ? { width: 390, height: 844 } : { width: 1440, height: 900 }, reducedMotion: 'reduce' })
      try {
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(url)
        await page.waitForFunction(() => document.querySelector('.save-label')?.textContent === 'Saved on this device')
        const origin = page.getByRole('button', { name: 'New diagram', exact: true })
        if (label === 'Blank') {
          await origin.focus()
          await page.keyboard.press('Enter')
          await page.getByRole('dialog', { name: 'New diagram' }).waitFor()
          await page.keyboard.press('Escape')
          await page.waitForFunction(() => document.querySelector('.starter-dialog') === null)
          await page.waitForFunction(() => document.activeElement?.getAttribute('aria-label') === 'New diagram')
          assert.equal(await origin.evaluate(element => document.activeElement === element), true, 'Escape restores New diagram focus')
          assert.equal(await page.getByRole('dialog', { name: 'New diagram' }).count(), 0)
          await origin.click()
        } else await origin.click()
        const choice = page.getByRole('button', { name: label, exact: true })
        const confirmation = new Promise(resolve => page.once('dialog', async dialog => { await dialog.accept(); resolve() }))
        if (label === 'Web/API') { await choice.focus(); await page.keyboard.press('Enter') }
        else await choice.click()
        await confirmation
        await page.waitForFunction(() => document.querySelector('.starter-dialog') === null)
        const copy = await canonical(page, `DGM109-${label.toLowerCase().replace(/[^a-z]+/g, '-')}`)
        if (label === 'Blank') {
          assert.equal(copy.entities.length, 0)
          assert.equal(copy.connections.length, 0)
        } else {
          const source = starters.get(label)
          assert.notEqual(copy.id, source.id, `${label} must receive a fresh document ID`)
          assert.deepEqual({ ...copy, id: source.id }, source, `${label} must preserve native JSON exactly except document identity`)
        }
        assert.deepEqual(errors, [])
      } finally { await context.close() }
    }
    console.log('DGM-109: chooser Escape focus, Blank, keyboard Web/API and pointer native starters preserve exact source JSON with fresh document identities.')
  }
  async function verifyAlignmentActions() {
    async function selectVisibleNode(page, id) {
      const node = page.locator(`.react-flow__node[data-id="${id}"]`)
      const bounds = await node.boundingBox()
      assert.ok(bounds, `Expected ${id} to have visible bounds`)
      const candidates = [
        [4, 4],
        [bounds.width - 4, 4],
        [4, bounds.height - 4],
        [bounds.width - 4, bounds.height - 4],
      ]
      let point
      for (const [offsetX, offsetY] of candidates) {
        const candidate = { x: bounds.x + offsetX, y: bounds.y + offsetY }
        const { x, y } = candidate
        const hitId = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__node')?.getAttribute('data-id'), { x, y })
        if (hitId === id) {
          point = candidate
          break
        }
      }
      assert.ok(point, `Expected an unobstructed pointer target for ${id}`)
      await page.mouse.click(point.x, point.y)
    }
    const viewports = [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]
    for (const viewport of viewports) for (const theme of ['light', 'dark']) {
      const context = await browser.newContext({ viewport, reducedMotion: 'reduce', deviceScaleFactor: viewport.width === 390 ? 2 : 1 })
      try {
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(error.message))
        await page.goto(url)
        await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
        const confirmation = new Promise(resolve => page.once('dialog', async dialog => { await dialog.accept(); resolve() }))
        await page.getByRole('button', { name: 'New diagram', exact: true }).click()
        await page.getByRole('button', { name: 'Web/API', exact: true }).click()
        await confirmation
        await page.waitForFunction(() => document.querySelector('.starter-dialog') === null)
        if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
        await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme)
        const copy = await canonical(page, `DGM110-${viewport.width}x${viewport.height}-${theme}-before`)
        const roots = ['web-edge', 'web-apps'].map(id => copy.entities.find(entity => entity.id === id))
        assert.ok(roots.every(Boolean), 'DGM-110 requires its top-level Web/API sibling fixture')
        await selectVisibleNode(page, roots[0].id)
        await page.locator('.canvas-selection-toolbar').waitFor()
        await page.locator('.canvas-selection-toolbar').evaluate(element => { element.style.pointerEvents = 'none' })
        await page.keyboard.down('Shift')
        await selectVisibleNode(page, roots[1].id)
        await page.keyboard.up('Shift')
        await page.locator('.canvas-selection-toolbar').evaluate(element => { element.style.pointerEvents = '' })
        const alignmentLabels = ['Align left', 'Align center', 'Align top', 'Distribute horizontally', 'Distribute vertically']
        await page.waitForFunction(labels => [...document.querySelectorAll('button')].some(button => labels.includes(button.getAttribute('aria-label'))), alignmentLabels)
        const commands = page.getByRole('button', { name: 'Commands', exact: true })
        await commands.focus()
        assert.equal(await commands.evaluate(element => document.activeElement === element), true, 'Commands must remain keyboard-focusable')
        await commands.click()
        const actionLabel = (await Promise.all(alignmentLabels.map(async label => [label, await page.getByRole('option', { name: label, exact: true }).getAttribute('aria-disabled')]))).find(([, disabled]) => disabled === 'false')?.[0]
        const controlState = await Promise.all(alignmentLabels.map(async label => ({ label, disabled: await page.getByRole('button', { name: label, exact: true }).getAttribute('disabled'), reason: await page.getByRole('button', { name: label, exact: true }).getAttribute('aria-description') })))
        const selected = await page.locator('.react-flow__node.selected').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-id')))
        assert.ok(actionLabel, `Eligible production roots must enable an alignment action: ${JSON.stringify({ selected, controlState })}`)
        const action = page.getByRole('option', { name: actionLabel, exact: true })
        await action.click()
        const accepted = await canonical(page, `DGM110-${viewport.width}x${viewport.height}-${theme}-accepted`)
        assert.equal(accepted.revision, copy.revision + 1, 'Alignment commits one revision')
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        assert.deepEqual(await canonical(page, `DGM110-${viewport.width}x${viewport.height}-${theme}-undo`), copy, 'Undo restores the exact production alignment snapshot')
        await page.getByRole('button', { name: 'Redo', exact: true }).click()
        assert.deepEqual(await canonical(page, `DGM110-${viewport.width}x${viewport.height}-${theme}-redo`), accepted, 'Redo restores the accepted alignment snapshot')
        await commands.click()
        assert.equal(await page.getByRole('option', { name: actionLabel, exact: true }).getAttribute('aria-disabled'), 'true', 'Already-aligned roots must reject a no-op')
        await page.keyboard.press('Escape')
        assert.deepEqual(await canonical(page, `DGM110-${viewport.width}x${viewport.height}-${theme}-noop`), accepted, 'No-op alignment does not publish another revision')
        await page.locator('.react-flow__pane').click({ position: { x: 12, y: 12 } })
        const mixedRoots = ['web-data', 'web-site'].map(id => accepted.entities.find(entity => entity.id === id))
        assert.ok(mixedRoots.every(Boolean), 'DGM-110 requires its Web/API mixed-parent fixture')
        await selectVisibleNode(page, mixedRoots[0].id)
        await page.locator('.canvas-selection-toolbar').waitFor()
        await page.locator('.canvas-selection-toolbar').evaluate(element => { element.style.pointerEvents = 'none' })
        await page.keyboard.down('Shift')
        await selectVisibleNode(page, mixedRoots[1].id)
        await page.keyboard.up('Shift')
        await page.locator('.canvas-selection-toolbar').evaluate(element => { element.style.pointerEvents = '' })
        await commands.click()
        assert.equal(await page.getByRole('option', { name: actionLabel, exact: true }).getAttribute('aria-disabled'), 'true', 'Mixed-parent roots must remain disabled in production')
        await page.keyboard.press('Escape')
        await saveCopyLayout(page, `DGM110-${viewport.width}x${viewport.height}-${theme}-layout`, 'Saved on this device', 'No newer JSON changes')
        assert.deepEqual(errors, [])
      } finally { await context.close() }
    }
    console.log('DGM-110: production command-menu alignment, focus, one-step undo/redo, no-op rejection and bounds pass at required viewports/themes; nested containment remains covered by deterministic helper preflight.')
  }
  async function verifySaveStates() {
  let saveCases = 0
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1366, height: 768 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 720, height: 450 }]) for (const theme of ['light', 'dark']) {
    const label = `DGM111-${viewport.width}x${viewport.height}-${theme}`
    const options = { viewport, reducedMotion: 'reduce', deviceScaleFactor: viewport.width === 720 ? 2 : 1 }
    const context = await browser.newContext(options)
    try {
      const page = await context.newPage()
      const errors = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(url)
      await page.waitForFunction(() => document.querySelector('.save-label')?.textContent === 'Saved on this device')
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme)
      await saveCopyLayout(page, `${label}-local-json-needed`, 'Saved on this device', 'Editable JSON copy needed')
      const save = page.getByRole('button', { name: 'Save JSON', exact: true })
      await save.focus()
      assert.equal(await save.evaluate(element => document.activeElement === element && element.hasAttribute('aria-describedby')), true)
      const pending = page.waitForEvent('download')
      await page.keyboard.press('Enter')
      const file = await pending
      await file.saveAs(`${output}/${label}-keyboard-copy.json`)
      assert.equal(await file.failure(), null)
      const original = JSON.parse(await readFile(`${output}/${label}-keyboard-copy.json`, 'utf8'))
      await saveCopyLayout(page, `${label}-json-marker-current`, 'Saved on this device', 'No newer JSON changes')
      await page.keyboard.press('Tab')
      assert.equal(await page.evaluate(() => !!document.activeElement?.closest('.topbar') && document.activeElement.matches('button:enabled')), true)
      const readonly = await context.newPage()
      await readonly.goto(url)
      await readonly.waitForFunction(() => document.querySelector('.save-label')?.textContent === 'Read-only')
      await saveCopyLayout(readonly, `${label}-read-only`, 'Read-only', 'Editable JSON copy needed')
      assert.equal(await readonly.getByRole('button', { name: 'New diagram', exact: true }).isDisabled(), true)
      assert.equal(await readonly.getByRole('button', { name: 'Open JSON', exact: true }).isDisabled(), true)
      assert.deepEqual(await jsonCopy(readonly, `${label}-read-only-copy`), original)
      assert.deepEqual(errors, [])
      console.log(`PASS: ${label}: local/JSON independence, keyboard copy/focus, read-only JSON, state/action bounds${viewport.width === 720 ? '; 1440x900 at 200%-equivalent CSS layout/DPR2, native chrome zoom unverified' : ''}`)
      saveCases += 2
    } finally { await context.close() }
    const failureContext = await browser.newContext(options)
    try {
      await failureContext.addInitScript(() => {
        IDBObjectStore.prototype.put = function () { throw new DOMException('StoragequotaexceededwhilekeepingthiseditableworkavailableforJSONtransfer'.repeat(3), 'QuotaExceededError') }
      })
      const page = await failureContext.newPage()
      await page.goto(url)
      await page.waitForFunction(() => document.querySelector('.save-label')?.textContent === 'Local save failed')
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
      await page.waitForFunction(expected => document.documentElement.dataset.theme === expected, theme)
      assert.match(await page.getByRole('status').textContent(), /Download JSON now; free storage and edit again to retry/)
      await saveCopyLayout(page, `${label}-long-local-failure`, 'Local save failed', 'Editable JSON copy needed')
      const copy = await jsonCopy(page, `${label}-failure-copy`)
      assert.equal(copy.title, 'Commerce platform')
      await saveCopyLayout(page, `${label}-failure-json-current`, 'Local save failed', 'No newer JSON changes')
      console.log(`PASS: ${label}: long local failure wraps, JSON remains available without local-save success`)
      saveCases++
    } finally { await failureContext.close() }
  }
  console.log(`DGM-111: ${saveCases} production status scenarios; native cancellation, native browser zoom and human browser/desktop transfer remain unverified.`)
  }
  console.log(`Edge ${browser.version()}; archive ${coverage.total} keys (${coverage.azure} Azure + ${coverage.fabric} Fabric + ${coverage.software} Software + ${coverage.vendors} Vendors + ${coverage.microsoft} Microsoft Apps), ${coverage.selection} current choices, ${coverage.azureMenuGroups} Azure / Microsoft menus, all 24 legacy keys/glyphs; screenshots: test-results/foundation/`)
} finally {
  await browser?.close()
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
}