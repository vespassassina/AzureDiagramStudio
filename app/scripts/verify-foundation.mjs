import assert from 'node:assert/strict'
import { mkdir, readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { catalogCoverage, verifyCatalogPalette } from './verify-catalog.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../test-results/foundation/', import.meta.url))
const server = process.env.DGM_FOUNDATION_URL ? null : await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
const url = process.env.DGM_FOUNDATION_URL ?? server.resolvedUrls.local[0]
let browser

async function canonical(page, label) {
  await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved')
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save JSON', exact: true }).click()
  const file = await pending
  const path = `${output}/${label}.json`
  await file.saveAs(path)
  assert.equal(await file.failure(), null)
  return JSON.parse(await readFile(path, 'utf8'))
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
        if (document.querySelector('button[aria-label="Auto-arrange"]').disabled || document.querySelector('.statusbar .save-label')?.textContent !== 'Saved') return false
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
  console.log(`Edge ${browser.version()}; archive ${coverage.total} keys (${coverage.azure} Azure + ${coverage.fabric} Fabric + ${coverage.software} Software + ${coverage.vendors} Vendors + ${coverage.microsoft} Microsoft Apps), ${coverage.selection} current choices, ${coverage.azureMenuGroups} Azure / Microsoft menus, all 24 legacy keys/glyphs; screenshots: test-results/foundation/`)
} finally {
  await browser?.close()
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
}