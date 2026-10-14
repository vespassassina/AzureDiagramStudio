import { expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import { build, preview } from 'vite'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createDocument } from '../model.ts'

const output = resolve('test-results/sprint-3-owner/108')
const fixture = { ...createDocument('direct-edit', 'Direct editing'), synthetic: false, legendVisible: false,
  entities: [
    { id: 'parent', kind: 'boundary', layer: 'background', label: 'Boundary', x: -60, y: 40, width: 660, height: 320, color: 'teal' },
    { id: 'child', kind: 'component', parentId: 'parent', label: 'Child label', x: 40, y: 90, width: 220, height: 88, color: 'azure', icon: 'azure-app' },
    { id: 'target', kind: 'component', parentId: 'parent', label: 'Target label', x: 360, y: 90, width: 220, height: 88, color: 'amber', icon: 'azure-sql' },
    { id: 'note', kind: 'text', label: 'Architecture note', x: -20, y: 440, width: 400, height: 60, color: 'gray' },
  ], connections: [{ id: 'link', from: 'child', to: 'target', label: 'Link label', style: 'solid', arrow: 'forward' }] }

async function settled(page: Page) {
  await page.evaluate(() => document.fonts.ready)
  await page.evaluate(() => new Promise<void>(resolveSettled => {
    let previous: string | undefined = '', stable = 0
    const next = () => {
      const current = document.querySelector<HTMLElement>('.react-flow__viewport')?.style.transform
      stable = current === previous ? stable + 1 : 0
      previous = current
      if (stable >= 18) resolveSettled(); else requestAnimationFrame(next)
    }
    requestAnimationFrame(next)
  }))
}

async function importFixture(page: Page, source = fixture, diagnostics?: { pageErrors: string[]; dialogMessages: string[] }) {
  await page.getByLabel('Open document file').setInputFiles({ name: 'direct.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) })
  try {
    await expect.poll(() => page.getByLabel('Document title').inputValue()).toBe(source.title)
  } catch (error) {
    try {
      const state = await page.evaluate(() => {
        const fileInput = document.querySelector<HTMLInputElement>('input[aria-label="Open document file"]')
        const newDiagram = document.querySelector<HTMLButtonElement>('button[aria-label="New diagram"]')
        return {
          readyState: document.readyState, visibilityState: document.visibilityState, fonts: document.fonts.status,
          title: document.querySelector<HTMLInputElement>('[aria-label="Document title"]')?.value,
          status: Array.from(document.querySelectorAll('[role="status"], [class*="status"], [data-save-state]')).map(element => ({
            text: element.textContent, markup: element.outerHTML,
          })),
          newDiagram: newDiagram ? { disabled: newDiagram.disabled, ariaDisabled: newDiagram.getAttribute('aria-disabled') } : null,
          fileInput: fileInput ? { disabled: fileInput.disabled, connected: fileInput.isConnected, accept: fileInput.accept,
            files: Array.from(fileInput.files ?? []).map(file => ({ name: file.name, size: file.size, type: file.type })) } : null,
        }
      })
      console.error('DGM-108 fixture import diagnostics', JSON.stringify({ expectedTitle: source.title, url: page.url(), ...diagnostics, ...state }, null, 2))
    } catch (diagnosticError) {
      console.error('DGM-108 fixture import diagnostics unavailable', diagnosticError)
    }
    throw error
  }
  if (await page.getByLabel('Close component library', { exact: true }).isVisible()) await page.getByLabel('Close component library', { exact: true }).click()
  if (await page.getByLabel('Close properties', { exact: true }).isVisible()) await page.getByLabel('Close properties', { exact: true }).click()
  await page.getByLabel('Fit diagram', { exact: true }).click()
  await settled(page)
  await expect.poll(() => page.locator('.react-flow__node[data-id="child"]').isVisible()).toBe(true)
}

async function canonical(page: Page) {
  const pending = page.waitForEvent('download')
  await page.getByLabel('Save JSON', { exact: true }).click()
  const download = await pending
  return JSON.parse(await readFile((await download.path())!, 'utf8')) as typeof fixture & { revision: number }
}

async function select(page: Page, id: string) {
  const node = page.locator(`.react-flow__node[data-id="${id}"]`)
  await node.focus(); await node.press('Enter')
  if (await page.getByLabel('Close properties', { exact: true }).isVisible()) await page.getByLabel('Close properties', { exact: true }).click()
  return node
}

test('should_verify_DGM108_production_Flow_labels_IME_history_commands_readonly_and_small_viewports', async () => {
  await mkdir(output, { recursive: true })
  const bundle = resolve(output, 'production')
  await build({ root: resolve('.'), logLevel: 'error', build: { outDir: bundle, emptyOutDir: false } })
  const server = await preview({ root: resolve('.'), logLevel: 'error', build: { outDir: bundle }, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  const origin = `http://127.0.0.1:${(server.httpServer.address() as { port: number }).port}`
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const report: unknown[] = []
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 720, height: 450 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, acceptDownloads: true })
      const page = await context.newPage(), errors: string[] = [], dialogMessages: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      page.on('dialog', dialog => { dialogMessages.push(dialog.message()); void dialog.accept() })
      await page.goto(origin)
      await expect.poll(() => page.getByLabel('New diagram', { exact: true }).isEnabled()).toBe(true)
      await importFixture(page, fixture, { pageErrors: errors, dialogMessages })
      const before = await canonical(page)
      const node = await select(page, 'child')
      await node.press('F2')
      const input = page.getByRole('textbox', { name: 'Inline component label', exact: true })
      await input.waitFor()
      expect(await input.evaluate(element => document.activeElement === element)).toBe(true)
      const alignment = await page.evaluate(() => {
        const text = document.querySelector<SVGTextElement>('.react-flow__node[data-id="child"] svg text')!
        const matrix = text.getScreenCTM()!, point = new DOMPoint(Number(text.getAttribute('x')), Number(text.getAttribute('y'))).matrixTransform(matrix)
        const bounds = document.querySelector('.inline-label')!.getBoundingClientRect()
        return { textX: point.x, textY: point.y, left: bounds.left, top: bounds.top, right: bounds.right }
      })
      expect(Math.abs(alignment.left - alignment.textX)).toBeLessThan(3)
      expect(alignment.top).toBeLessThan(alignment.textY)
      expect(alignment.right).toBeLessThanOrEqual(viewport.width)
      await page.screenshot({ path: resolve(output, `inline-${viewport.width}.png`) })
      const geometry = await node.getAttribute('style')
      await input.fill('Renamed child')
      expect(await node.getAttribute('style')).toBe(geometry)
      await input.press('Enter')
      await expect.poll(() => input.count()).toBe(0)
      const after = await canonical(page)
      expect(after.revision).toBe(before.revision + 1)
      expect(after.entities.find(entity => entity.id === 'child')!.label).toBe('Renamed child')
      await page.getByLabel('Undo', { exact: true }).click()
      const undone = await canonical(page)
      expect(undone.entities).toEqual(before.entities); expect(undone.connections).toEqual(before.connections)
      await writeFile(resolve(output, `flow-${viewport.width}.json`), JSON.stringify(await page.locator('.react-flow__node').evaluateAll(elements => elements.map(element => ({ id: element.getAttribute('data-id'), style: element.getAttribute('style'), bounds: element.getBoundingClientRect().toJSON() }))), null, 2))
      await page.screenshot({ path: resolve(output, `inline-ready-${viewport.width}.png`) })
      const nodeBounds = (await node.boundingBox())!
      const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__node')?.getAttribute('data-id'), { x: nodeBounds.x + nodeBounds.width / 2, y: nodeBounds.y + nodeBounds.height / 2 })
      expect(hit).toBe('child')
      await page.mouse.dblclick(nodeBounds.x + nodeBounds.width / 2, nodeBounds.y + nodeBounds.height / 2)
      await input.fill('Cancelled'); await input.press('Escape')
      expect((await canonical(page)).revision).toBe(undone.revision)
      const edge = page.locator('.react-flow__edge[data-id="link"]')
      await edge.focus(); await edge.press('Enter'); await edge.press('F2')
      const edgeInput = page.getByRole('textbox', { name: 'Inline connection label', exact: true })
      await edgeInput.waitFor()
      const edgeAlignment = await edgeInput.evaluate(element => {
        const text = document.querySelector<SVGTextElement>('.react-flow__edge[data-id="link"] text')!
        const point = new DOMPoint(Number(text.getAttribute('x')), Number(text.getAttribute('y'))).matrixTransform(text.getScreenCTM()!)
        const bounds = element.closest('.inline-label')!.getBoundingClientRect()
        return { textX: point.x, center: bounds.left + bounds.width / 2 }
      })
      if (viewport.width === 1440) expect(Math.abs(edgeAlignment.center - edgeAlignment.textX)).toBeLessThan(3)
      await edgeInput.press('Escape')
      if (await page.getByLabel('Close properties', { exact: true }).isVisible()) await page.getByLabel('Close properties', { exact: true }).click()
      const labelBounds = (await edge.locator('text').boundingBox())!
      await page.mouse.dblclick(labelBounds.x + labelBounds.width / 2, labelBounds.y + labelBounds.height / 2)
      await edgeInput.waitFor(); await edgeInput.fill('New edge'); await edgeInput.press('Enter')
      expect((await canonical(page)).connections[0].label).toBe('New edge')
      const note = await select(page, 'note')
      await page.getByLabel('Fit selection', { exact: true }).click()
      await settled(page)
      await note.press('F2')
      const textarea = page.getByRole('textbox', { name: 'Inline note text', exact: true })
      await textarea.waitFor(); await textarea.press('Escape')
      const noteBounds = (await note.locator('svg text').boundingBox())!
      const noteHit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__node')?.getAttribute('data-id'), { x: noteBounds.x + noteBounds.width / 2, y: noteBounds.y + noteBounds.height / 2 })
      expect(noteHit).toBe('note')
      await page.mouse.dblclick(noteBounds.x + noteBounds.width / 2, noteBounds.y + noteBounds.height / 2)
      await textarea.waitFor()
      await textarea.fill('First line'); await textarea.press('End'); await textarea.press('Enter'); await textarea.press('a')
      expect(await textarea.inputValue()).toBe('First line\na')
      await textarea.evaluate(element => {
        element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' }))
        element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true, isComposing: true, bubbles: true }))
      })
      expect(await textarea.count()).toBe(1)
      await textarea.evaluate(element => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'a' })))
      await textarea.press('Control+Enter')
      expect((await canonical(page)).entities.find(entity => entity.id === 'note')!.label).toBe('First line\na')
      const trigger = page.getByRole('button', { name: 'Commands', exact: true })
      await trigger.click()
      const dialog = page.getByRole('dialog', { name: 'Commands', exact: true })
      const search = dialog.getByRole('combobox', { name: 'Filter commands' })
      const controls = await dialog.locator('button, [role="option"], .command-filter').evaluateAll(elements => elements.map(element => {
        const bounds = element.getBoundingClientRect(); return { width: bounds.width, height: bounds.height, left: bounds.left, right: bounds.right }
      }))
      for (const control of controls) { expect(control.width).toBeGreaterThanOrEqual(44); expect(control.height).toBeGreaterThanOrEqual(44); expect(control.left).toBeGreaterThanOrEqual(0); expect(control.right).toBeLessThanOrEqual(viewport.width) }
      const triggerBounds = await trigger.boundingBox(); expect(triggerBounds!.width).toBeGreaterThanOrEqual(44); expect(triggerBounds!.height).toBeGreaterThanOrEqual(44)
      await page.screenshot({ path: resolve(output, `commands-${viewport.width}.png`) })
      await search.fill('Pan tool'); await search.press('ArrowDown'); await search.press('Enter')
      expect(await page.getByLabel('Pan tool', { exact: true }).getAttribute('aria-pressed')).toBe('true')
      await trigger.focus(); await trigger.press('Control+k'); await search.press('Escape')
      expect(await trigger.evaluate(element => document.activeElement === element)).toBe(true)
      await trigger.click(); await search.fill('Grid settings'); await search.press('Enter')
      expect(await page.getByLabel('Show grid', { exact: true }).evaluate(element => document.activeElement === element)).toBe(true)
      await page.getByLabel('Close properties', { exact: true }).click()
      await trigger.click(); await search.fill('Export'); await search.press('Enter')
      expect(await dialog.count()).toBe(0); expect(await page.getByRole('dialog').count()).toBe(1)
      await page.getByLabel('Cancel export', { exact: true }).click()
      await trigger.click(); await search.fill('Present'); await search.press('Enter')
      await page.getByLabel('Exit presentation', { exact: true }).waitFor()
      await page.getByLabel('Exit presentation', { exact: true }).press('Control+k')
      expect(await dialog.count()).toBe(0)
      await page.getByLabel('Exit presentation', { exact: true }).click()
      expect(errors).toEqual([])
      report.push({ ...viewport, alignment, edgeAlignment, controls: controls.length, inline: 'F2 node/edge/note, physical doubleclick node/edge/note, Escape, exact undo, multiline, IME passed', commands: 'keyboard, focus, tools, properties, export separation, Present guard passed', manual: 'Human 20-second rename, physical touch and native 200% remain unverified' })
      await context.close()
    }
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()
    await page.addInitScript(() => { Object.defineProperty(window, 'indexedDB', { get() { throw new Error('Readonly browser fixture') } }) })
    await page.goto(origin)
    await page.getByRole('button', { name: 'Commands', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Commands' })
    expect(await dialog.getByRole('option', { name: 'Undo', exact: true }).getAttribute('aria-disabled')).toBe('true')
    expect(await dialog.getByRole('option', { name: 'Add component', exact: true }).getAttribute('aria-disabled')).toBe('true')
    await dialog.getByRole('combobox').press('Escape')
    const node = page.locator('.react-flow__node').first()
    await node.focus(); await node.press('Enter'); await node.press('F2')
    expect(await page.getByRole('textbox', { name: /^Inline / }).count()).toBe(0)
    report.push({ readonly: 'storage failure disables menu mutations and F2' })
    await context.close()
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify(report, null, 2))
  } finally { await browser.close(); await new Promise<void>(resolveClose => server.httpServer.close(() => resolveClose())) }
}, 180_000)