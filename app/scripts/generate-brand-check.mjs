import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = new URL('../test-results/branding/', import.meta.url)

test('should_fit_complete_accessible_brand_when_desktop_and_mobile_headers_render', async () => {
  const server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true } })
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const reports = []
  try {
    await mkdir(output, { recursive: true })
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } })
      const page = await context.newPage()
      const foreignRequests = []
      const url = server.resolvedUrls.local[0]
      page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(url).origin) foreignRequests.push(request.url()) })
      await page.goto(url)
      await page.locator('.wordmark').waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.title(), 'Azure Diagram Studio')
      const brand = page.getByLabel('Azure Diagram Studio', { exact: true })
      assert.equal(await brand.innerText(), 'Azure Diagram Studio')
      assert.equal(await brand.locator('img').evaluate(image => image.complete && image.naturalWidth > 0), true)
      const geometry = await brand.evaluate(element => {
        const box = node => { const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } }
        const text = element.querySelector('.brand-name')
        const range = document.createRange()
        range.selectNodeContents(text)
        return { brand: box(element), text: box(text), header: box(element.parentElement), siblings: [...element.parentElement.children].filter(child => child !== element).map(box), lines: [...range.getClientRects()].map(rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })), overflow: element.scrollWidth > element.clientWidth, fontSize: getComputedStyle(text).fontSize, pageOverflow: document.documentElement.scrollWidth > innerWidth }
      })
      await page.screenshot({ path: fileURLToPath(new URL(`header-${width}.png`, output)) })
      reports.push({ width, title: await page.title(), geometry, foreignRequests })
      await writeFile(new URL('header-report.json', output), `${JSON.stringify({ browser: browser.version(), reports }, null, 2)}\n`)
      const inside = (child, parent) => child.left >= parent.left - .5 && child.top >= parent.top - .5 && child.right <= parent.right + .5 && child.bottom <= parent.bottom + .5
      assert.equal(geometry.brand.width, width === 390 ? 128 : 242)
      assert.equal(geometry.overflow, false)
      assert.equal(geometry.pageOverflow, false)
      assert.ok(inside(geometry.brand, geometry.header))
      assert.ok(inside(geometry.text, geometry.brand))
      assert.ok(geometry.lines.every(line => inside(line, geometry.brand)), `Every word is inside its brand parent: ${JSON.stringify(geometry)}`)
      assert.ok(new Set(geometry.lines.map(line => line.top)).size <= 2, 'At most two lines')
      for (const sibling of geometry.siblings) assert.ok(geometry.brand.right <= sibling.left + .5 || geometry.brand.left >= sibling.right - .5 || geometry.brand.bottom <= sibling.top + .5 || geometry.brand.top >= sibling.bottom - .5, 'No header occlusion')
      for (const path of ['favicon.svg', 'favicon.ico', 'branding/logo.svg']) {
        const response = await page.request.get(new URL(path, url).href)
        assert.equal(response.status(), 200)
        assert.deepEqual(await response.body(), await readFile(new URL(`../public/${path}`, import.meta.url)))
      }
      assert.deepEqual(foreignRequests, [])
      await context.close()
    }
    await writeFile(new URL('header-report.json', output), `${JSON.stringify({ browser: browser.version(), reports }, null, 2)}\n`)
  } finally {
    await browser.close()
    await new Promise(resolve => server.httpServer.close(resolve))
  }
})

test('should_match_cached_bytes_when_original_svg_is_generated_twice', async () => {
  const { generateBrand } = await import('./generate-brand.mjs')
  const first = await generateBrand({ write: false })
  const second = await generateBrand({ write: false })
  assert.deepEqual([...first.keys()], [...second.keys()])
  for (const [path, bytes] of first) {
    assert.deepEqual(bytes, second.get(path), `Repeatable ${path}`)
    assert.deepEqual(bytes, await readFile(new URL(`../public/${path}`, import.meta.url)), `Cached artifact ${path}`)
  }
  console.log(JSON.stringify(Object.fromEntries([...first].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }])), null, 2))
})