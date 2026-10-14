import { expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve('test-results/sprint-3-owner/115')

async function state(page: Page) {
  return page.evaluate(() => (window as any).__grid115)
}

async function mount(page: Page, spacing = 16, snap = true, readOnly = false) {
  await page.evaluate(async ({ spacing, snap, readOnly }) => {
    const load = new Function('path', 'return import(path)')
    const reactModule = await load('/node_modules/.vite/deps/react.js')
    const React = reactModule.default ?? reactModule
    const clientModule = await load('/node_modules/.vite/deps/react-dom_client.js')
    const { createRoot } = clientModule.default ?? clientModule
    const { default: Editor } = await load('/src/editor/Editor.tsx')
    const { createDocument, historyCommit, historyUndo, historyRedo } = await load('/src/model.ts')
    const { applyCommand } = await load('/src/document/commands.ts')
    const container = document.createElement('div')
    document.querySelector('#root')!.replaceWith(container)
    const root = createRoot(container)
    const entity = (id: string, kind: string, parentId: string | null, x: number, y: number, width: number, height: number) => ({ id, kind, parentId, x, y, width, height, label: id, color: 'teal', ...(kind === 'component' ? { icon: 'service' } : {}) })
    let history = { past: [], future: [], present: { ...createDocument('browser-grid', ''), backgroundColor: '#ffffff', grid: { visible: true, style: 'dots', spacing, snap, present: false, export: false }, entities: [entity('outer', 'boundary', null, 81, 83, 780, 620), entity('inner', 'boundary', 'outer', 25, 65, 500, 400), entity('child', 'component', 'inner', 35.5, 67.25, 220, 88), entity('peer', 'component', null, 973.5, 179.25, 220, 88)] } }
    const evidence: any = { document: history.present, commands: [], previews: [], errors: [] }
    ;(window as any).__grid115 = evidence
    const render = () => {
      evidence.document = history.present
      root.render(React.createElement(Editor, {
        document: history.present, canUndo: !!history.past.length, canRedo: !!history.future.length, readOnly, saveState: readOnly ? 'read-only' : 'saved', backupDirty: false, message: evidence.errors.at(-1) ?? '', isArranging: false, isExporting: false,
        onCommand(command: any) { evidence.commands.push(command); try { history = historyCommit(history, applyCommand(history.present, command)); render() } catch (error) { evidence.errors.push(String(error)); render() } },
        onPreviewChange(preview: any) { evidence.previews.push(preview) }, onUndo() { history = historyUndo(history); render() }, onRedo() { history = historyRedo(history); render() },
        onNew() {}, onOpen() {}, onImport() {}, onSaveJson() {}, onArrange() {}, onExport() {},
      }))
    }
    render()
  }, { spacing, snap, readOnly })
  await page.locator('.react-flow__node[data-id="child"]').waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.getByLabel('Close component library', { exact: true }).click()
  await page.getByLabel('Fit diagram', { exact: true }).click()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

async function drag(page: Page, id: string, dx: number, dy: number) {
  const node = page.locator(`.react-flow__node[data-id="${id}"]`)
  const bounds = await node.boundingBox()
  if (!bounds) throw new Error(`Missing node ${id}`)
  const x = bounds.x + 35, y = bounds.y + 22
  const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__node')?.getAttribute('data-id'), { x, y })
  expect(hit).toBe(id)
  await page.mouse.move(x, y)
  await page.mouse.down()
  await page.mouse.move(x + dx, y + dy, { steps: 12 })
  await page.mouse.up()
  await page.waitForFunction(() => (window as any).__grid115.commands.length > 0)
}

function absolute(document: any, id: string): { x: number; y: number } {
  const entity = document.entities.find((entity: any) => entity.id === id)
  const parent = entity.parentId ? absolute(document, entity.parentId) : { x: 0, y: 0 }
  return { x: parent.x + entity.x, y: parent.y + entity.y }
}

async function patternPhase(page: Page) {
  return page.evaluate(() => {
    const pattern = document.querySelector('.react-flow__background pattern')!
    const circle = pattern.querySelector('circle')
    const width = Number(pattern.getAttribute('width'))
    const height = Number(pattern.getAttribute('height'))
    const translation = pattern.getAttribute('patternTransform')!.match(/translate\(([^,]+),([^\)]+)\)/)!
    const viewport = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')!).transform)
    const center = circle ? { x: Number(circle.getAttribute('cx')), y: Number(circle.getAttribute('cy')) } : { x: width / 2, y: height / 2 }
    const phase = (value: number, spacing: number) => { const remainder = ((value % spacing) + spacing) % spacing; return Math.min(remainder, spacing - remainder) }
    return { x: phase(Number(pattern.getAttribute('x')) + Number(translation[1]) + center.x - viewport.e, width), y: phase(Number(pattern.getAttribute('y')) + Number(translation[2]) + center.y - viewport.f, height), gap: width / viewport.a }
  })
}

test('should_verify_grid_with_real_nested_pointer_gestures_and_export_pixels_in_source_browser', async () => {
  await mkdir(output, { recursive: true })
  const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  await server.listen()
  const address = server.httpServer!.address() as { port: number }
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const report: any[] = []
  try {
    for (const snap of [true, false]) {
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
      await page.emulateMedia({ reducedMotion: 'reduce' })
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      await page.goto(`http://127.0.0.1:${address.port}/src/editor/Editor.harness.html`)
      await mount(page, 16, snap)
      await expect.poll(async () => { const phase = await patternPhase(page); return Math.max(phase.x, phase.y) }).toBeLessThan(0.01)
      const phase = await patternPhase(page)
      expect(phase.x).toBeLessThan(0.01)
      expect(phase.y).toBeLessThan(0.01)
      expect(phase.gap).toBeCloseTo(16)
      const before = (await state(page)).document
      await drag(page, 'child', 47, 39)
      const childState = await state(page)
      await writeFile(resolve(output, `browser-pointer-${snap ? 'on' : 'off'}-probe.json`), JSON.stringify(childState, null, 2))
      await page.screenshot({ path: resolve(output, `browser-pointer-${snap ? 'on' : 'off'}-probe.png`) })
      expect(childState.errors).toEqual([])
      expect(childState.commands.at(-1).positions[0].id).toBe('child')
      const childAbsolute = absolute(childState.document, 'child')
      if (snap) { expect(childAbsolute.x % 16).toBe(0); expect(childAbsolute.y % 16).toBe(0) }
      else { expect(childAbsolute.x % 8).not.toBe(0); expect(childAbsolute.y % 8).not.toBe(0) }
      expect(childState.commands).toHaveLength(1)
      await page.keyboard.press('Control+z')
      await page.waitForFunction(before => JSON.stringify((window as any).__grid115.document) === JSON.stringify(before), before)
      await page.locator('.react-flow__node[data-id="outer"]').click({ position: { x: 38, y: 22 } })
      await page.keyboard.down('Shift')
      await page.locator('.react-flow__node[data-id="child"]').click({ position: { x: 60, y: 32 } })
      await page.keyboard.up('Shift')
      const prior = (await state(page)).commands.length
      await drag(page, 'outer', 39, 27)
      await page.waitForFunction(prior => (window as any).__grid115.commands.length > prior, prior)
      const grouped = await state(page)
      const inner = grouped.document.entities.find((entity: any) => entity.id === 'inner')
      const child = grouped.document.entities.find((entity: any) => entity.id === 'child')
      expect({ x: inner.x, y: inner.y }).toEqual({ x: 25, y: 65 })
      expect({ x: child.x, y: child.y }).toEqual({ x: 35.5, y: 67.25 })
      expect(grouped.commands.at(-1).positions).toHaveLength(1)
      if (snap) { expect(absolute(grouped.document, 'outer').x % 16).toBe(0); expect(absolute(grouped.document, 'outer').y % 16).toBe(0) }
      await page.locator('.react-flow__node[data-id="inner"]').click({ position: { x: 35, y: 22 } })
      const beforeResize = await state(page)
      const resizeHandle = page.locator('.react-flow__node[data-id="inner"] .react-flow__resize-control.bottom.right.handle')
      const handle = await resizeHandle.boundingBox()
      expect(handle).not.toBeNull()
      await page.mouse.move(handle!.x + handle!.width / 2, handle!.y + handle!.height / 2)
      await page.mouse.down()
      await page.mouse.move(handle!.x + handle!.width / 2 + 37, handle!.y + handle!.height / 2 + 29, { steps: 10 })
      await page.mouse.up()
      await page.waitForFunction(count => (window as any).__grid115.commands.length > count, beforeResize.commands.length)
      const resized = await state(page)
      expect(resized.errors).toEqual([])
      expect(resized.commands).toHaveLength(beforeResize.commands.length + 1)
      expect(resized.commands.at(-1).type).toBe('resize')
      expect(absolute(resized.document, 'child')).toEqual(absolute(beforeResize.document, 'child'))
      const resizedInner = resized.document.entities.find((entity: any) => entity.id === 'inner')
      const origin = absolute(resized.document, 'inner')
      if (snap) { expect((origin.x + resizedInner.width) % 16).toBe(0); expect((origin.y + resizedInner.height) % 16).toBe(0) }
      else expect(resizedInner.width % 8).not.toBe(0)
      await page.keyboard.press('Control+z')
      await page.waitForFunction(document => JSON.stringify((window as any).__grid115.document) === JSON.stringify(document), beforeResize.document)
      await page.locator('.react-flow__node[data-id="inner"]').click({ position: { x: 35, y: 22 } })
      const topLeft = page.locator('.react-flow__node[data-id="inner"] .react-flow__resize-control.top.left.handle')
      expect(await topLeft.isHidden()).toBe(true)
      expect(await page.locator('.react-flow__node[data-id="inner"] .react-flow__resize-control.top.line').isHidden()).toBe(true)
      expect(await page.locator('.react-flow__node[data-id="inner"] .react-flow__resize-control.left.line').isHidden()).toBe(true)
      expect(await page.locator('.react-flow__node[data-id="inner"] .react-flow__resize-control.bottom.right.handle').isVisible()).toBe(true)
      await page.screenshot({ path: resolve(output, `browser-nested-${snap ? 'on' : 'off'}.png`) })
      report.push({ case: `nested-pointer-${snap ? 'on' : 'off'}`, before, childAbsolute, after: grouped.document, resized: resized.document, commands: resized.commands, supportedResize: 'bottom/right/bottom-right', unsupportedCornersRemainHidden: true, phase, errors })
      expect(errors).toEqual([])
      await page.close()
    }

    for (const width of [1440, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      await page.goto(`http://127.0.0.1:${address.port}/src/editor/Editor.harness.html?blank`)
      await page.getByLabel('Document properties', { exact: true }).click()
      const settings = page.getByRole('group', { name: 'Grid settings', exact: true })
      for (const style of ['Dots', 'Lines']) for (const visible of [true, false]) for (const snap of [true, false]) {
        await settings.getByLabel(`${style} grid`, { exact: true }).click()
        await settings.getByLabel('Show grid', { exact: true }).setChecked(visible)
        await settings.getByLabel('Snap to grid', { exact: true }).setChecked(snap)
        expect(await page.locator('.react-flow__background').count()).toBe(visible ? 1 : 0)
        if (visible) {
          await expect.poll(async () => { const phase = await patternPhase(page); return Math.max(phase.x, phase.y) }).toBeLessThan(0.01)
          const phase = await patternPhase(page)
          expect(phase.x).toBeLessThan(0.01)
          expect(phase.y).toBeLessThan(0.01)
          expect(phase.gap).toBeCloseTo(8)
        }
      }
      await settings.getByLabel('Grid spacing', { exact: true }).fill('16')
      await settings.getByLabel('Grid spacing', { exact: true }).press('Tab')
      await settings.getByLabel('Show grid in Present', { exact: true }).check()
      await settings.getByLabel('Include grid in exports', { exact: true }).check()
      await page.screenshot({ path: resolve(output, `browser-controls-${width}.png`) })
      for (const label of ['Show grid', 'Snap to grid', 'Show grid in Present', 'Include grid in exports']) {
        const bounds = await settings.getByLabel(label, { exact: true }).locator('..').boundingBox()
        expect(bounds!.height).toBeGreaterThanOrEqual(44)
      }
      await page.getByLabel('Present', { exact: true }).click()
      expect(await page.locator('.react-flow__background').count()).toBe(1)
      await page.getByLabel('Exit presentation', { exact: true }).click()
      expect(await page.locator('.react-flow__background').count()).toBe(0)
      report.push({ case: `controls-${width}`, combinations: 8, presentIndependent: true })
      await page.close()
    }

    const readonlyPage = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await readonlyPage.emulateMedia({ reducedMotion: 'reduce' })
    await readonlyPage.goto(`http://127.0.0.1:${address.port}/src/editor/Editor.harness.html`)
    await mount(readonlyPage, 16, true, true)
    await readonlyPage.getByLabel('Document properties', { exact: true }).click()
    for (const label of ['Show grid', 'Snap to grid', 'Show grid in Present', 'Include grid in exports', 'Grid spacing', 'Dots grid', 'Lines grid']) expect(await readonlyPage.getByLabel(label, { exact: true }).isDisabled()).toBe(true)
    const readonlyBefore = await state(readonlyPage)
    await readonlyPage.getByLabel('Close properties', { exact: true }).click()
    const bounds = await readonlyPage.locator('.react-flow__node[data-id="child"]').boundingBox()
    await readonlyPage.mouse.move(bounds!.x + 30, bounds!.y + 20)
    await readonlyPage.mouse.down()
    await readonlyPage.mouse.move(bounds!.x + 60, bounds!.y + 50, { steps: 8 })
    await readonlyPage.mouse.up()
    expect((await state(readonlyPage)).document).toEqual(readonlyBefore.document)
    expect((await state(readonlyPage)).commands).toEqual([])
    report.push({ case: 'readonly-controls-and-pointer', blocked: 7, mutationCount: 0 })
    await readonlyPage.close()

    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://127.0.0.1:${address.port}/src/editor/Editor.harness.html?blank`)
    const pixels = await page.evaluate(async () => {
      const load = new Function('path', 'return import(path)')
      const { createDocument } = await load('/src/model.ts')
      const { buildScene } = await load('/src/scene.ts')
      const { exportSvg, exportPng } = await load('/src/export.ts')
      const results: any[] = []
      for (const style of ['dots', 'lines']) for (const scale of [1, 2]) for (const transparent of [true, false]) {
        const document = { ...createDocument('pixel-grid', ''), backgroundColor: '#101010', grid: { visible: false, style, spacing: 8, snap: false, present: false, export: true } }
        const scene = buildScene(document)
        const svg = await exportSvg(document, transparent)
        const source = await exportPng(document, scale, transparent)
        const image = new Image()
        const url = URL.createObjectURL(source)
        image.src = url
        await image.decode()
        const canvas = window.document.createElement('canvas')
        canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        const sample = (x: number, y: number) => Array.from(context.getImageData(x * scale, y * scale, 1, 1).data)
        const atGrid = sample(4, 4), between = sample(8, 8), nextGrid = sample(12, 12)
        results.push({ style, scale, transparent, minX: scene.minX, minY: scene.minY, atGrid, between, nextGrid, patternCount: (svg.match(/<pattern /g) ?? []).length, width: canvas.width, height: canvas.height, svg })
        URL.revokeObjectURL(url)
      }
      return results
    })
    for (const item of pixels) {
      expect(item.patternCount).toBe(1)
      expect(item.minX).toBe(-20)
      expect(item.minY).toBe(-20)
      expect(item.atGrid[3]).toBeGreaterThan(0)
      expect(item.nextGrid[3]).toBeGreaterThan(0)
      if (item.transparent) expect(item.between[3]).toBe(0)
      else expect(item.between).toEqual([16, 16, 16, 255])
      await writeFile(resolve(output, `pattern-${item.style}-${item.scale}-${item.transparent ? 'transparent' : 'opaque'}.svg`), item.svg)
    }
    report.push({ case: 'svg-png-zero-origin-negative-crop', pixels })
    await page.close()
    await writeFile(resolve(output, 'browser-report.json'), JSON.stringify({ status: 'passed', report }, null, 2))
  } catch (error) {
    for (const [index, page] of browser.contexts().flatMap(context => context.pages()).entries()) {
      await page.screenshot({ path: resolve(output, `browser-failure-${index}.png`) })
      const dom = await page.evaluate(() => ({ nodes: [...document.querySelectorAll('.react-flow__node')].map(node => ({ id: node.getAttribute('data-id'), class: node.className, bounds: node.getBoundingClientRect().toJSON(), handles: [...node.querySelectorAll('.react-flow__resize-control')].map(handle => ({ class: handle.className, display: getComputedStyle(handle).display })) })), state: (window as any).__grid115 }))
      await writeFile(resolve(output, `browser-failure-${index}.json`), JSON.stringify(dom, null, 2))
    }
    await writeFile(resolve(output, 'browser-report-failed.json'), JSON.stringify({ status: 'failed', error: String(error), report }, null, 2))
    throw error
  } finally {
    await browser.close()
    await server.close()
  }
}, 180_000)