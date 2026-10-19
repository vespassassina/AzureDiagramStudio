import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { selectConnection } from './verify-catalog.mjs'
import { ensureStartupSample, readActiveDocument } from './startup-fixture.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.DGM_CATALOG_OUTPUT
let server, browser, url

before(async () => {
  server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  url = server.resolvedUrls.local[0]
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  if (output) await mkdir(output, { recursive: true })
})
after(async () => {
  await browser?.close()
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
})

test('should_select_exact_short_route_when_legacy_centerline_samples_are_obstructed', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto(url)
    await ensureStartupSample(page)
    const before = await readActiveDocument(page)
    await page.getByRole('button', { name: 'Close component library', exact: true }).click()
    await page.locator('.react-flow__node[data-id="app"]').click({ position: { x: 20, y: 20 } })
    if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
    await page.getByRole('button', { name: 'Close properties', exact: true }).click()
    const samples = await page.locator('.react-flow__edge[data-id="route"] .react-flow__edge-interaction').evaluate(path => {
      return [.23, .5, .75, .9, .1].map(fraction => {
        const local = path.getPointAtLength(path.getTotalLength() * fraction)
        const screen = new DOMPoint(local.x, local.y).matrixTransform(path.getScreenCTM())
        const hit = document.elementFromPoint(screen.x, screen.y)
        return { fraction, x: screen.x, y: screen.y, tag: hit?.tagName, class: hit?.getAttribute('class'), selectable: hit?.closest('.react-flow__edge') === path.closest('.react-flow__edge') }
      })
    })
    if (output) await writeFile(`${output}/short-route-samples.json`, JSON.stringify(samples, null, 2))
    assert.ok(samples.every(sample => !sample.selectable), 'Retain the original obstructed five-point scenario')
    await selectConnection(page)
    assert.deepEqual(await page.locator('.react-flow__edge.selected').evaluateAll(edges => edges.map(edge => edge.dataset.id)), ['route'])
    assert.equal(await page.locator('.react-flow__node.selected').count(), 0)
    assert.equal(await page.getByLabel('Insertion component', { exact: true }).isVisible(), true)
    assert.deepEqual(await readActiveDocument(page), before, 'Selection leaves canonical geometry/history content unchanged')
    if (output) await page.screenshot({ path: `${output}/short-route-selected.png` })
  } finally { await context.close() }
})

test('should_fail_explicitly_when_route_has_no_unobstructed_supported_target', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto(url)
    await ensureStartupSample(page)
    // Pan the real canvas until the route is outside the viewport; do not hide or remove targets.
    const pane = page.locator('.react-flow__pane')
    const point = await pane.evaluate(element => {
      const box = element.getBoundingClientRect()
      for (let y = box.top + 30; y < box.bottom - 30; y += 30) {
        for (let x = box.left + 30; x < box.right - 30; x += 30) {
          if (document.elementFromPoint(x, y) === element) return { x, y }
        }
      }
    })
    assert.ok(point)
    await page.mouse.move(point.x, point.y)
    await page.mouse.down({ button: 'middle' })
    await page.mouse.move(point.x + 3000, point.y + 2000, { steps: 12 })
    await page.mouse.up({ button: 'middle' })
    await assert.rejects(selectConnection(page), /A visible route point is available for real connection selection/)
    assert.equal(await page.locator('.react-flow__edge.selected').count(), 0)
  } finally { await context.close() }
})

test('should_fail_explicitly_when_requested_route_is_missing', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto(url)
    await page.getByRole('dialog', { name: 'New diagram', exact: true }).waitFor()
    await page.keyboard.press('Escape')
    await page.waitForFunction(() => document.querySelector('.starter-dialog') === null)
    await assert.rejects(selectConnection(page), /Exactly one route connection must be rendered/)
    assert.equal(await page.locator('.react-flow__edge.selected, .react-flow__node.selected').count(), 0)
  } finally { await context.close() }
})
