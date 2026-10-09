import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../test-results/theme/', import.meta.url))
const preferenceKey = 'azure-diagram-studio.ui.theme'
const server = await createServer({ root, server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
let browser
const report = { cases: [], errors: [] }

async function snapshot(page) {
  return page.evaluate(() => ({ document: window.__themeHarness.document, evidence: window.__themeHarness.evidence, tiles: [...document.querySelectorAll('.architecture-tile > svg')].map(svg => svg.outerHTML), backup: document.querySelector('.backup-state').textContent, save: document.querySelector('.save-label').textContent }))
}

async function measure(page) {
  return page.evaluate(() => {
    function luminance(color) {
      const channels = color.match(/[\d.]+/g).slice(0, 3).map(value => {
        const channel = Number(value) / 255
        return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4
      })
      return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722
    }
    function contrast(foreground, background) {
      const first = luminance(foreground), second = luminance(background)
      return (Math.max(first, second) + .05) / (Math.min(first, second) + .05)
    }
    function background(element) {
      for (let current = element; current; current = current.parentElement) {
        const color = getComputedStyle(current).backgroundColor
        if (color !== 'rgba(0, 0, 0, 0)' && color !== 'transparent') return color
      }
      return getComputedStyle(document.documentElement).backgroundColor
    }
    const textSelectors = ['.brand-name', '.session-state', '.breadcrumb', '.canvas-heading h1', '.canvas-kicker', '.diagram-meta', '.tabs button', '.tabs span', '.catalog-group-toggle', '.catalog-group-label small', '.catalog-group-count', '.library-label strong', '.library-label small', '.library-category', '.library-bottom button', '.no-results', '.inspector-kind', '.property > span', '.property input', '.property select', '.property textarea', '.property-toggle', '.readout > span', '.readout > strong', '.document-summary', '.document-summary strong', '.inspector-footer', '.statusbar', '.canvas-legend', '.zoom-controls > span:not(.separator)', '.arrange-button', '.menu-title', '.export-menu strong', '.export-menu small', '.export-option']
    const text = textSelectors.flatMap(selector => [...document.querySelectorAll(selector)].filter(element => element.getClientRects().length && !element.closest('[inert]')).map(element => ({ selector, color: getComputedStyle(element).color, background: background(element), ratio: contrast(getComputedStyle(element).color, background(element)) })))
    const controls = [...document.querySelectorAll('.icon-button:not(:disabled), .direction-control button:not(:disabled), .export-button:not(:disabled)')].filter(element => element.getClientRects().length && !element.closest('[inert]')).map(element => ({ label: element.getAttribute('aria-label'), ratio: contrast(getComputedStyle(element).color, background(element)) }))
    const fields = [...document.querySelectorAll('.property input:not([type=checkbox]), .property select, .property textarea, .library-search')].filter(element => element.getClientRects().length && !element.closest('[inert]')).map(element => ({ label: element.getAttribute('aria-label') ?? element.className, ratio: contrast(getComputedStyle(element).borderTopColor, background(element)) }))
    const toggle = document.querySelector('.theme-toggle').getBoundingClientRect()
    const wordmark = document.querySelector('.brand-name').getBoundingClientRect()
    const header = document.querySelector('.topbar').getBoundingClientRect()
    const canvas = document.querySelector('.canvas-surface')
    return { text, controls, fields, overflow: document.documentElement.scrollWidth > innerWidth, toggle: { x: toggle.x, y: toggle.y, width: toggle.width, height: toggle.height, right: toggle.right, bottom: toggle.bottom }, brandFits: wordmark.left >= 0 && wordmark.right <= header.right && wordmark.bottom <= header.bottom, canvas: getComputedStyle(canvas).backgroundColor, root: getComputedStyle(document.documentElement).backgroundColor, grid: getComputedStyle(document.querySelector('.react-flow__background-pattern')).fill, edge: contrast('rgb(108, 133, 135)', getComputedStyle(canvas).backgroundColor) }
  })
}

async function inspect(page, name, viewport) {
  const measurements = await measure(page)
  assert.equal(measurements.overflow, false, `${name}: page overflow`)
  assert.equal(measurements.brandFits, true, `${name}: brand clipped`)
  assert.ok(measurements.toggle.width >= 28 && measurements.toggle.right <= viewport.width && measurements.toggle.bottom <= viewport.height, `${name}: theme control does not fit`)
  for (const item of measurements.text) assert.ok(item.ratio >= 4.5, `${name}: ${item.selector} text contrast ${item.ratio.toFixed(2)}`)
  for (const item of [...measurements.controls, ...measurements.fields]) assert.ok(item.ratio >= 3, `${name}: ${item.label} control contrast ${item.ratio.toFixed(2)}`)
  assert.ok(measurements.edge >= 3, `${name}: default connection contrast`)
  await page.screenshot({ path: `${output}/${name}.png` })
  report.cases.push({ name, measurements })
}

try {
  await mkdir(output, { recursive: true })
  await server.listen()
  const base = `${server.resolvedUrls.local[0]}src/theme/Theme.harness.html`
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    for (const readOnly of [false, true]) {
      const context = await browser.newContext({ viewport, colorScheme: 'dark' })
      const page = await context.newPage()
      const pageErrors = []
      page.on('pageerror', error => pageErrors.push(error.message))
      await page.goto(`${base}${readOnly ? '?readonly' : ''}`)
      await page.getByRole('button', { name: 'Switch to light theme', exact: true }).waitFor()
      await page.locator('.react-flow__node').first().waitFor()
      await page.evaluate(() => document.fonts.ready)
      assert.equal(await page.locator('.brand-icon').evaluate(image => image.complete && image.naturalWidth > 0), true, 'Harness must resolve the real brand asset')
      assert.equal(await page.evaluate(() => localStorage.getItem('azure-diagram-studio.ui.theme')), null, 'System initialization must not persist')
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
      const before = await snapshot(page)
      await page.evaluate(() => { window.__themeNodes = [...document.querySelectorAll('.architecture-tile > svg')] })
      const svgBefore = await page.evaluate(() => window.__themeHarness.svg())
      const pngBefore = await page.evaluate(() => window.__themeHarness.png())
      const label = `${viewport.width}-${readOnly ? 'readonly' : 'writable'}`
      assert.equal((await measure(page)).canvas, 'rgb(24, 28, 28)', 'Dark canvas must use the neutral theme token')
      await inspect(page, `${label}-dark`, viewport)
      await page.getByRole('button', { name: 'Switch to light theme', exact: true }).focus()
      await page.keyboard.press('Enter')
      await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).waitFor()
      assert.deepEqual(await snapshot(page), before, 'Theme must not change document, artwork, backup, save state or callbacks')
      assert.equal(await page.evaluate(() => window.__themeNodes.every((node, index) => node === document.querySelectorAll('.architecture-tile > svg')[index])), true, 'Theme must retain exact artwork DOM nodes')
      assert.equal(await page.evaluate(() => window.__themeHarness.svg()), svgBefore, 'Native SVG export bytes must be theme independent')
      assert.deepEqual(await page.evaluate(() => window.__themeHarness.png()), pngBefore, 'Native PNG export bytes must be theme independent')
      assert.equal(await page.evaluate(() => localStorage.getItem('azure-diagram-studio.ui.theme')), 'light')
      await inspect(page, `${label}-light`, viewport)
      await page.reload()
      await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).waitFor()
      await page.emulateMedia({ colorScheme: 'light' })
      await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
      await page.emulateMedia({ colorScheme: 'dark' })
      assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark')
      await page.getByRole('button', { name: 'Export', exact: true }).click()
      await inspect(page, `${label}-dark-menu`, viewport)
      await page.getByRole('button', { name: 'Close export menu' }).click()
      if (viewport.width <= 640) await page.getByRole('button', { name: 'Open component library' }).click()
      const computeGroup = page.getByRole('button', { name: 'Azure / Microsoft: Compute & Apps (10)', exact: true })
      if (await computeGroup.getAttribute('aria-expanded') !== 'true') await computeGroup.click()
      await page.getByLabel('Search components').fill('App Service')
      await inspect(page, `${label}-dark-library`, viewport)
      await page.getByLabel('Search components').fill('')
      if (viewport.width <= 640) {
        await page.getByRole('button', { name: 'Close component library', exact: true }).click()
        await page.getByRole('button', { name: 'Open properties', exact: true }).click()
      }
      await inspect(page, `${label}-dark-inspector`, viewport)
      assert.deepEqual(pageErrors, [])
      await context.close()
      console.log(`PASS: ${label}: initial system, explicit persistence, keyboard toggle, unchanged native exports/artwork/document, contrast and fit`)
    }
  }
  for (const scenario of ['invalid', 'denied-read', 'denied-write']) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })
    await context.addInitScript(({ scenario, key }) => {
      if (scenario === 'invalid') localStorage.setItem(key, 'not-a-theme')
      if (scenario === 'denied-read') Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('Denied', 'SecurityError') } })
      if (scenario === 'denied-write') Storage.prototype.setItem = () => { throw new DOMException('Denied', 'QuotaExceededError') }
    }, { scenario, key: preferenceKey })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto(`${base}?readonly`)
    await page.getByRole('button', { name: 'Switch to light theme' }).waitFor()
    const before = await snapshot(page)
    await page.getByRole('button', { name: 'Switch to light theme' }).click()
    const button = page.getByRole('button', { name: 'Switch to dark theme' })
    await button.waitFor()
    assert.deepEqual(await snapshot(page), before)
    if (scenario !== 'invalid') {
      assert.equal(await button.getAttribute('data-preference-error'), 'true')
      assert.match(await button.getAttribute('aria-description'), /only to this session/)
    }
    assert.deepEqual(errors, [])
    report.cases.push({ name: scenario, passed: true })
    await context.close()
    console.log(`PASS: ${scenario}: safe read-only theme action, no fake save`)
  }
  report.browser = browser.version()
  console.log(`PASS: ${report.cases.length} theme cases; evidence: test-results/theme/`)
} catch (error) {
  report.errors.push(error instanceof Error ? error.stack : String(error))
  throw error
} finally {
  await writeFile(`${output}/browser-report.json`, JSON.stringify(report, null, 2))
  await browser?.close()
  await server.close()
}