import { expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve('test-results/sprint-3-owner/105')

async function fixture(page: Page) {
  const source = await page.evaluate(async () => {
    const load = new Function('path', 'return import(path)')
    const { createDocument } = await load('/src/model.ts')
    return { ...createDocument('slide-browser', 'Meeting handoff'), subtitle: 'Scoped snapshot', synthetic: true, backgroundColor: '#101010', legendVisible: true,
      grid: { visible: false, snap: false, style: 'lines', spacing: 16, present: false, export: false },
      entities: [
        { id: 'parent', kind: 'boundary', label: 'Parent', x: -60.25, y: 40.5, width: 560, height: 340, color: 'teal' },
        { id: 'included', parentId: 'parent', kind: 'component', label: 'Included', x: 55.5, y: 95.25, width: 220, height: 88, color: 'teal', icon: 'azure-app', status: 'live' },
        { id: 'excluded', kind: 'component', label: 'Excluded', x: 750, y: 40, width: 220, height: 88, color: '#bd1636', icon: 'azure-sql', status: 'planned' },
      ] }
  })
  const validation = await page.evaluate(async source => {
    const load = new Function('path', 'return import(path)')
    const { validateDocument } = await load('/src/document/validation.ts')
    return validateDocument(source)
  }, source)
  if (!validation.ok) throw new Error(`Invalid browser fixture: ${JSON.stringify(validation.errors)}`)
  await page.getByLabel('Open document file').setInputFiles({ name: 'slide.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) })
  await page.getByLabel('Document title').filter({ visible: true }).waitFor()
  try { await expect.poll(() => page.getByLabel('Document title').inputValue()).toBe('Meeting handoff') }
  catch (error) { throw new Error(`Import status: ${await page.getByRole('status').textContent()}`, { cause: error }) }
  await page.locator('.react-flow__node[data-id="included"]').waitFor()
  await page.getByLabel('Fit diagram', { exact: true }).click()
  await page.evaluate(() => document.fonts.ready)
  return source
}

async function pngPixels(page: Page, base64: string) {
  return page.evaluate(async data => {
    const blob = await (await fetch(`data:image/png;base64,${data}`)).blob()
    const image = await createImageBitmap(blob)
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d')!; context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, image.width, image.height).data
    let ink = 0, alpha = 0
    for (let offset = 0; offset < pixels.length; offset += 4) {
      if (pixels[offset + 3]) alpha++
      if (pixels[offset + 3] && (pixels[offset] !== pixels[0] || pixels[offset + 1] !== pixels[1] || pixels[offset + 2] !== pixels[2])) ink++
    }
    const result = { width: image.width, height: image.height, corner: Array.from(pixels.slice(0, 4)), ink, alpha }
    image.close(); return result
  }, base64)
}

test('should_verify_real_App_clipboard_grant_denial_fallback_and_scoped_slide_pixels_on_desktop_and_mobile', async () => {
  await mkdir(output, { recursive: true })
  const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  await server.listen()
  const origin = `http://127.0.0.1:${(server.httpServer!.address() as { port: number }).port}`
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const report: unknown[] = []
  try {
    for (const width of [1440, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], acceptDownloads: true })
      const page = await context.newPage(), errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('dialog', dialog => void dialog.accept())
      await page.goto(origin)
      await expect.poll(() => page.getByLabel('New diagram', { exact: true }).isEnabled()).toBe(true)
      const source = await fixture(page)
      if (await page.getByLabel('Close component library', { exact: true }).isVisible()) await page.getByLabel('Close component library', { exact: true }).click()
      const node = page.locator('.react-flow__node[data-id="included"]')
      await node.focus(); await node.press('Enter')
      await page.getByRole('button', { name: 'Export', exact: true }).click()
      const dialog = page.getByRole('dialog', { name: 'Export diagram' })
      await dialog.getByRole('radio', { name: 'Selection', exact: true }).check()
      await dialog.getByRole('radio', { name: '16:9', exact: true }).check()
      const preview = dialog.getByRole('img', { name: 'Export preview' })
      const markup = await preview.innerHTML()
      expect(markup).toContain('Included'); expect(markup).not.toContain('Excluded')
      expect(markup).not.toContain('@font-face'); expect(markup.length).toBeLessThan(150_000)
      for (const forbidden of ['<script', '<foreignObject', 'href="http']) expect(markup).not.toContain(forbidden)
      const controls = await dialog.locator('button, .export-segments label, .export-grid').evaluateAll(elements => elements.map(element => {
        const bounds = element.getBoundingClientRect()
        return { height: bounds.height, width: bounds.width, left: bounds.left, right: bounds.right, text: element.textContent }
      }))
      for (const control of controls) { expect(control.height).toBeGreaterThanOrEqual(44); expect(control.width).toBeGreaterThanOrEqual(44); expect(control.left).toBeGreaterThanOrEqual(0); expect(control.right).toBeLessThanOrEqual(width) }
      await page.screenshot({ path: resolve(output, `dialog-${width}.png`) })
      await dialog.getByRole('button', { name: 'Copy image' }).click()
      await page.getByRole('status').filter({ hasText: /^Image copied\.$/ }).waitFor()
      const copied = await page.evaluate(async () => {
        const items = await navigator.clipboard.read(), blob = await items[0].getType('image/png')
        const bytes = new Uint8Array(await blob.arrayBuffer())
        let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte)
        return btoa(binary)
      })
      await writeFile(resolve(output, `clipboard-${width}.png`), Buffer.from(copied, 'base64'))
      const copiedPixels = await pngPixels(page, copied)
      expect(copiedPixels.width / copiedPixels.height).toBe(16 / 9)
      expect(copiedPixels.corner).toEqual([16, 16, 16, 255]); expect(copiedPixels.ink).toBeGreaterThan(1000)
      await page.getByRole('button', { name: 'Export', exact: true }).click()
      await dialog.getByRole('radio', { name: 'White', exact: true }).check()
      await dialog.getByRole('checkbox', { name: 'Include grid' }).check()
      const pngDownload = page.waitForEvent('download')
      await dialog.getByRole('button', { name: 'Export PNG 2x' }).click()
      const downloaded = await pngDownload
      await downloaded.saveAs(resolve(output, `white-grid-2x-${width}.png`))
      const whiteBytes = await readFile((await downloaded.path())!)
      const whitePixels = await pngPixels(page, whiteBytes.toString('base64'))
      expect(whitePixels.width).toBe(copiedPixels.width * 2); expect(whitePixels.height).toBe(copiedPixels.height * 2)
      expect(whitePixels.corner).toEqual([255, 255, 255, 255])
      const direct = await page.evaluate(async source => {
        const load = new Function('path', 'return import(path)')
        const { exportPng, exportSvg } = await load('/src/export.ts')
        const { buildExportScene } = await load('/src/scene.ts')
        const options = { selectionIds: ['included'], aspect: '16:9', background: 'diagram', includeGrid: false }
        const scene = buildExportScene(source, options)
        const svg = await exportSvg(source, true, undefined, options)
        const blob = await exportPng(source, 1, true, undefined, options)
        let binary = ''; for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte)
        return { base64: btoa(binary), svg, x: scene.entities[0].absolute.x, y: scene.entities[0].absolute.y, background: scene.backgroundColor }
      }, source)
      expect(direct.x).toBe(-4.75); expect(direct.y).toBe(135.75)
      expect(direct.background).toBe('#101010'); expect(direct.svg).not.toContain('<pattern ')
      expect(direct.svg).toContain('@font-face'); expect(direct.svg).not.toContain('Excluded')
      await writeFile(resolve(output, `transparent-${width}.png`), Buffer.from(direct.base64, 'base64'))
      await writeFile(resolve(output, `scoped-${width}.svg`), direct.svg)
      const transparentPixels = await pngPixels(page, direct.base64)
      expect(transparentPixels.corner[3]).toBe(0); expect(transparentPixels.alpha).toBeGreaterThan(1000)
      expect(transparentPixels.alpha).toBeLessThan(transparentPixels.width * transparentPixels.height)
      await page.route(`${origin}/`, async route => {
        const response = await route.fetch()
        await route.fulfill({ response, headers: { ...response.headers(), 'permissions-policy': 'clipboard-write=()' } })
      })
      await page.reload()
      await expect.poll(() => page.getByLabel('New diagram', { exact: true }).isEnabled()).toBe(true)
      expect(await page.evaluate(() => (document as Document & { featurePolicy: { allowsFeature(name: string): boolean } }).featurePolicy.allowsFeature('clipboard-write'))).toBe(false)
      if (await page.getByLabel('Close component library', { exact: true }).isVisible()) await page.getByLabel('Close component library', { exact: true }).click()
      await page.getByLabel('Fit diagram', { exact: true }).click()
      await page.locator('.react-flow__node[data-id="included"]').focus()
      await page.locator('.react-flow__node[data-id="included"]').press('Enter')
      await page.getByRole('button', { name: 'Export', exact: true }).click()
      await dialog.getByRole('radio', { name: 'Selection', exact: true }).check()
      await dialog.getByRole('radio', { name: '16:9', exact: true }).check()
      await dialog.getByRole('radio', { name: 'Transparent background', exact: true }).check()
      const fallbackDownload = page.waitForEvent('download')
      await dialog.getByRole('button', { name: 'Copy image' }).click()
      const fallback = await fallbackDownload
      await fallback.saveAs(resolve(output, `denied-fallback-${width}.png`))
      await page.getByRole('status').filter({ hasText: /Image not copied.*PNG downloaded/ }).waitFor()
      expect((await pngPixels(page, (await readFile((await fallback.path())!)).toString('base64'))).corner[3]).toBe(0)
      expect(errors).toEqual([])
      report.push({ width, controls: controls.length, copiedPixels, whitePixels, transparentPixels, clipboard: 'real grant and browser policy denied fallback passed', nativeOffice: 'UNVERIFIED' })
      await context.close()
    }
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2))
  } finally { await browser.close(); await server.close() }
}, 120_000)