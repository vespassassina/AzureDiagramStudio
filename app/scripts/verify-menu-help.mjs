import assert from 'node:assert/strict'
import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium, _electron } from '@playwright/test'
import { preview } from 'vite'
import { applicationCommand, clickApplicationCommand } from './application-menus.mjs'
import { readActiveDocument } from './startup-fixture.mjs'
import { createDocument } from '../src/model.ts'
import { desktopEnvironment } from './desktop-driver.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = path.resolve(root, process.env.DGM140_OUTPUT ?? path.join('test-results', 'dgm140-141-owner', `browser-${Date.now()}`))
assert.ok(output.startsWith(path.join(root, 'test-results') + path.sep))
const dist = path.resolve(root, process.env.DGM_SOURCE_DIST ?? 'dist')
const native = process.env.DGM140_RUNTIME === 'electron'
await mkdir(output, { recursive: true })
const source = path.join(output, 'source-app'), documents = path.join(output, 'owned-documents')
if (native) {
  await mkdir(path.join(source, 'electron'), { recursive: true })
  await mkdir(documents)
  await cp(dist, path.join(source, 'dist'), { recursive: true })
  for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'workspace.mjs', 'preload.cjs']) await cp(path.join(root, 'electron', name), path.join(source, 'electron', name))
  const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
  await writeFile(path.join(source, 'package.json'), JSON.stringify({ name: 'dgm140-source-only', type: 'module', version, main: 'bootstrap.mjs' }))
  await writeFile(path.join(source, 'bootstrap.mjs'), `
import { app, dialog } from 'electron'
app.setPath('documents', ${JSON.stringify(documents)})
globalThis.dgm140Saves = []
dialog.showSaveDialog = async (_window, options) => {
  globalThis.dgm140Saves.push(options)
  return { canceled: false, filePath: options.defaultPath }
}
await import('./electron/main.mjs')
`)
}
const fixture = { ...createDocument('dgm140-live', 'Menu and appearance'), description: '# Committed Markdown', entities: [
  { id: 'a', kind: 'component', label: 'API', x: 40, y: 120, width: 220, height: 88, color: 'teal', icon: 'service' },
  { id: 'b', kind: 'component', label: 'Store', x: 420, y: 120, width: 220, height: 88, color: 'teal', icon: 'database' },
], connections: [{ id: 'edge', from: 'a', to: 'b', label: 'Data', style: 'dashed', arrow: 'both' }] }
const input = path.join(output, 'fixture.json')
await writeFile(input, JSON.stringify(fixture))
const manifest = []
async function hashTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await hashTree(file)
    else manifest.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
  }
}
await hashTree(path.join(root, 'src')); await hashTree(dist)
if (native) await hashTree(source)
for (const file of [fileURLToPath(import.meta.url), path.join(root, 'scripts', 'application-menus.mjs'), input]) manifest.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
await writeFile(path.join(output, 'inputs.json'), JSON.stringify(manifest, null, 2))
const server = native ? null : await preview({ root, build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
const report = { started: new Date().toISOString(), runtime: native ? 'source Electron; save-dialog adapter mocked, not human-native' : 'Edge browser', dist, output, cells: [], errors: [], pids: [] }
let context, app
const saved = page => page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
async function openFile(page, file = input) {
  const expected = JSON.parse(await readFile(file, 'utf8'))
  const pending = page.waitForEvent('filechooser')
  await clickApplicationCommand(page, 'Open JSON')
  await (await pending).setFiles(file)
  await page.getByRole('textbox', { name: 'Document title', exact: true }).filter({ visible: true }).waitFor()
  await page.waitForFunction(expected => {
    if (document.querySelector('.canvas-heading h1')?.textContent !== expected.title) return false
    if (!expected.backgroundColor) return true
    const color = document.createElement('span')
    color.style.backgroundColor = expected.backgroundColor
    return document.querySelector('.canvas-surface')?.style.backgroundColor === color.style.backgroundColor
  }, expected)
  await saved(page)
}
async function captureOutput(page, action, filename) {
  const destination = path.join(output, filename)
  if (native) {
    const count = await app.evaluate(() => globalThis.dgm140Saves.length)
    await action()
    for (let attempt = 0; attempt < 160; attempt++) {
      const { options, calls } = await app.evaluate(() => ({ options: globalThis.dgm140Saves.at(-1), calls: globalThis.dgm140Saves.length }))
      if (options && calls > count) {
        await page.waitForFunction(() => document.querySelector('.export-button')?.getAttribute('aria-disabled') === 'false')
        try { const bytes = await readFile(options.defaultPath); await writeFile(destination, bytes); return bytes } catch (error) { if (error.code !== 'ENOENT') throw error }
      }
      await page.waitForTimeout(50)
    }
    throw new Error('Native output was not written')
  }
  const pending = page.waitForEvent('download')
  await action()
  await (await pending).saveAs(destination)
  return readFile(destination)
}
async function artwork(page, label) {
  const exported = {}
  for (const [format, extension] of [['SVG', 'svg'], ['PNG 1x', 'png']]) {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    exported[extension] = await captureOutput(page, () => page.getByRole('button', { name: `Export ${format}`, exact: true }).click(), `${label}.${extension}`)
  }
  const svg = exported.svg.toString('utf8')
  assert.ok(svg.includes('stroke-width="2.1"') && svg.includes('stroke-dasharray="6 5"') && svg.includes('marker-start='))
  assert.deepEqual([...exported.png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
  const pixels = await page.evaluate(async ({ svg, png }) => {
    const image = async (type, bytes) => {
      const img = new Image()
      img.src = `data:${type};base64,${bytes}`
      await img.decode()
      return img
    }
    const bitmap = await image('image/png', png), vector = await image('image/svg+xml', svg)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.naturalWidth; canvas.height = bitmap.naturalHeight
    const ctx = canvas.getContext('2d')
    ctx.drawImage(vector, 0, 0, canvas.width, canvas.height)
    const expected = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(bitmap, 0, 0)
    const actual = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    let differences = 0
    for (let index = 0; index < expected.length; index++) if (expected[index] !== actual[index]) differences++
    return { differences, width: canvas.width, height: canvas.height, background: [...actual.subarray(0, 4)] }
  }, { svg: exported.svg.toString('base64'), png: exported.png.toString('base64') })
  assert.equal(pixels.differences, 0, 'Actual PNG follows the shared exported SVG pixel-for-pixel')
  return pixels
}
async function geometry(page, selector) {
  return page.locator(selector).evaluate(element => {
    const box = element.getBoundingClientRect()
    return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height }
  })
}
function inside(box, width, height) {
  assert.ok(box.width > 0 && box.height > 0 && box.left >= 0 && box.top >= 0 && box.right <= width + 1 && box.bottom <= height + 1, JSON.stringify(box))
}
async function guide(page, outputLabel, width, height) {
  await clickApplicationCommand(page, 'Help')
  const dialog = page.getByRole('dialog', { name: 'UI guide', exact: true })
  const steps = []
  for (let index = 0; index < 11; index++) {
    const title = await dialog.getByRole('heading').textContent()
    assert.equal(await dialog.locator('.help-guide-progress > span').first().textContent(), `${index + 1}/11`)
    const selector = await page.locator('.help-guide-spotlight').getAttribute('data-guide-target')
    assert.ok(selector, `${title}: actual target required`)
    const target = await geometry(page, selector), spotlight = await geometry(page, '.help-guide-spotlight'), card = await geometry(page, '.help-guide')
    inside(spotlight, width, height); inside(card, width, height)
    assert.ok(Math.abs(spotlight.left - Math.max(4, target.left)) <= 1)
    assert.ok(Math.abs(spotlight.top - Math.max(4, target.top)) <= 1)
    assert.ok(Math.abs(spotlight.right - Math.min(width - 4, target.right)) <= 1)
    assert.ok(card.right <= spotlight.left || spotlight.right <= card.left || card.bottom <= spotlight.top || spotlight.bottom <= card.top, `${title}: callout covers anchor`)
    assert.equal(await dialog.locator('.help-guide-unavailable').count(), 0)
    await page.screenshot({ path: path.join(output, `${outputLabel}-help-${index + 1}.png`) })
    const content = dialog.getByRole('region', { name: 'Guide step', exact: true })
    assert.equal(await content.evaluate(element => element.scrollTop), 0)
    if (await content.evaluate(element => element.scrollHeight > element.clientHeight)) {
      await content.focus()
      await page.keyboard.press('End')
      await page.waitForFunction(() => {
        const element = document.querySelector('.help-guide-content')
        return element.scrollTop + element.clientHeight >= element.scrollHeight - 1
      })
      await page.screenshot({ path: path.join(output, `${outputLabel}-help-${index + 1}-read.png`) })
    }
    if (index > 0) {
      await dialog.getByRole('button', { name: 'Back', exact: true }).click()
      assert.equal(await dialog.locator('.help-guide-progress > span').first().textContent(), `${index}/11`)
      await dialog.getByRole('button', { name: 'Next', exact: true }).click()
      assert.equal(await dialog.getByRole('heading').textContent(), title)
    }
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('menuitem', { name: 'Settings menu', exact: true }).evaluate(element => element === document.activeElement), true)
    await clickApplicationCommand(page, 'Help')
    for (let replay = 0; replay < index; replay++) await dialog.getByRole('button', { name: 'Next', exact: true }).click()
    assert.equal(await dialog.getByRole('heading').textContent(), title)
    steps.push({ title, selector, target, spotlight, card, back: index > 0 })
    if (index < 10) await dialog.getByRole('button', { name: 'Next', exact: true }).click()
  }
  await dialog.getByRole('button', { name: 'Finish', exact: true }).click()
  assert.equal(await page.getByRole('menuitem', { name: 'Settings menu', exact: true }).evaluate(element => element === document.activeElement), true)
  return steps
}
try {
  for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 900], [390, 844], [720, 450]]) {
    const label = `${theme}-${width}x${height}`
    const profile = path.join(output, `profile-${label}`)
    await mkdir(profile)
    if (native) {
      app = await _electron.launch({ executablePath: path.join(root, 'node_modules', 'electron', 'dist', 'electron.exe'), args: [source, `--user-data-dir=${profile}`], cwd: source, env: desktopEnvironment(process.env, profile), timeout: 45000 })
      report.pids.push(app.process().pid)
      context = app.context()
    } else context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, viewport: { width, height }, acceptDownloads: true })
    const page = native ? await app.firstWindow() : await context.newPage()
    if (native) await page.setViewportSize({ width, height })
    page.on('pageerror', error => report.errors.push(`${label}: ${error.message}`))
    page.on('dialog', dialog => void dialog.accept())
    if (native) await page.waitForURL('ads://studio/')
    else await page.goto(server.resolvedUrls.local[0])
    await page.getByRole('dialog', { name: 'New diagram', exact: true }).getByRole('button', { name: 'Blank', exact: true }).click()
    if (await page.locator('html').getAttribute('data-theme') === theme) await clickApplicationCommand(page, `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`)
    await clickApplicationCommand(page, `Switch to ${theme} theme`)
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    assert.equal(await page.evaluate(() => localStorage.getItem('azure-diagram-studio.ui.theme')), theme)
    await openFile(page)
    const baseline = await readActiveDocument(page)
    assert.equal(await page.locator('.topbar .session-state').count(), 0)
    assert.deepEqual(await page.locator('.top-actions button').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))), ['Undo', 'Redo', 'Export', 'Present'])
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    const buttons = await page.locator('.topbar button').evaluateAll(elements => elements.map(element => {
      const { left, right, top, bottom, width, height } = element.getBoundingClientRect()
      return { left, right, top, bottom, width, height }
    }))
    for (const box of buttons) inside(box, width, height)
    for (const a of buttons) for (const b of buttons) if (a !== b) assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)
    await page.screenshot({ path: path.join(output, `${label}-workspace.png`) })
    assert.equal(await page.locator('.canvas-surface').evaluate(element => getComputedStyle(element).backgroundColor), theme === 'light' ? 'rgb(250, 248, 243)' : 'rgb(255, 255, 255)')
    const edge = page.locator('.react-flow__edge[data-id="edge"]')
    assert.equal(await edge.locator('path[stroke-width="2.1"]').count(), 1)
    assert.equal(await edge.locator('.react-flow__edge-interaction').getAttribute('stroke-width'), '20')
    const title = page.getByRole('textbox', { name: 'Document title', exact: true })
    await title.fill('Uncommitted title')
    for (const menu of ['File', 'View', 'Settings']) {
      await page.getByRole('menuitem', { name: `${menu} menu`, exact: true }).click()
      await page.keyboard.press('End'); await page.keyboard.press('Home'); await page.keyboard.press('Escape')
      assert.equal(await title.inputValue(), 'Uncommitted title')
      assert.deepEqual(await readActiveDocument(page), baseline)
    }
    await page.getByRole('menuitem', { name: 'File menu', exact: true }).focus()
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowRight')
    await page.getByRole('menu', { name: 'View', exact: true }).waitFor()
    await page.keyboard.press('ArrowLeft'); await page.keyboard.press('Escape')
    await page.getByRole('menuitem', { name: 'Settings menu', exact: true }).click()
    await page.locator('.wordmark').click()
    assert.equal(await page.getByRole('menu').count(), 0)
    assert.deepEqual(await readActiveDocument(page), baseline)
    await title.focus(); await page.keyboard.press('Escape')
    await clickApplicationCommand(page, 'New diagram')
    await page.getByRole('dialog', { name: 'New diagram', exact: true }).getByRole('button', { name: 'Close new diagram', exact: true }).click()
    assert.deepEqual(await readActiveDocument(page), baseline)
    await page.getByRole('menuitem', { name: 'View menu', exact: true }).click()
    await page.getByRole('menuitemcheckbox', { name: 'Show Markdown', exact: true }).click()
    const markdown = page.getByRole('textbox', { name: 'Architecture description (Markdown)', exact: true })
    await markdown.fill('# Uncommitted Markdown')
    const steps = await guide(page, label, width, height)
    assert.equal(await markdown.inputValue(), '# Uncommitted Markdown')
    assert.deepEqual(await readActiveDocument(page), baseline)
    await markdown.focus(); await page.keyboard.press('Escape')
    for (const name of ['Settings', 'About']) {
      await clickApplicationCommand(page, name)
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
      assert.equal(await page.getByRole('menuitem', { name: 'Settings menu', exact: true }).evaluate(element => element === document.activeElement), true)
    }
    if (native) {
      const bytes = await captureOutput(page, () => clickApplicationCommand(page, 'Save JSON'), `${label}-saved.json`)
      const options = await app.evaluate(() => globalThis.dgm140Saves.at(-1))
      assert.ok(options.defaultPath.startsWith(path.join(documents, 'AzureDiagramStudio') + path.sep))
      assert.deepEqual(JSON.parse(bytes.toString('utf8')), baseline)
    } else {
      const downloaded = page.waitForEvent('download')
      await clickApplicationCommand(page, 'Save JSON')
      const json = await downloaded
      await json.saveAs(path.join(output, `${label}-saved.json`))
      assert.deepEqual(JSON.parse(await readFile(path.join(output, `${label}-saved.json`), 'utf8')), baseline)
    }
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    assert.equal(await page.getByRole('menubar').count(), 0)
    assert.equal(await page.locator('.canvas-surface').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)')
    await page.getByRole('button', { name: 'Exit presentation', exact: true }).click()
    assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
    assert.deepEqual(await readActiveDocument(page), baseline)
    const defaultArtwork = await artwork(page, `${label}-default`)
    assert.deepEqual(defaultArtwork.background, [255, 255, 255, 255])
    const customFile = path.join(output, `${label}-custom.json`)
    await writeFile(customFile, JSON.stringify({ ...baseline, backgroundColor: '#123456' }))
    await openFile(page, customFile)
    assert.equal(await page.locator('.canvas-surface').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(18, 52, 86)')
    const customArtwork = await artwork(page, `${label}-custom`)
    assert.deepEqual(customArtwork.background, [18, 52, 86, 255])
    assert.equal((await readActiveDocument(page)).backgroundColor, '#123456')
    const whiteFile = path.join(output, `${label}-explicit-white.json`)
    await writeFile(whiteFile, JSON.stringify({ ...baseline, backgroundColor: '#ffffff' }))
    await openFile(page, whiteFile)
    assert.equal(await page.locator('.canvas-surface').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)')
    const skill = path.join(output, `${label}-skill.json`)
    await writeFile(skill, JSON.stringify({ title: 'Imported skill', nodes: [], edges: [] }))
    const chooser = page.waitForEvent('filechooser')
    await clickApplicationCommand(page, 'Import skill JSON')
    await (await chooser).setFiles(skill)
    await page.waitForFunction(() => document.querySelector('.canvas-heading h1')?.textContent === 'Imported skill')
    await saved(page)
    assert.equal((await readActiveDocument(page)).entities.length, 0)
    await clickApplicationCommand(page, 'New diagram')
    await page.getByRole('dialog', { name: 'New diagram', exact: true }).getByRole('button', { name: 'Blank', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.canvas-heading h1')?.textContent === 'Untitled architecture')
    await saved(page)
    assert.equal((await readActiveDocument(page)).entities.length, 0)
    report.cells.push({ theme, width, height, steps, defaultArtwork, customArtwork, importAndNew: true, explicitWhitePreserved: true, passed: true })
    if (app) { await app.close(); app = undefined } else await context.close()
    context = undefined
    console.log(`PASS ${label}: file/menu/draft/focus/11 guide anchors/back/Escape/paper/connection`)
  }
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.failure = error.stack
  const page = context?.pages().at(-1)
  if (page) { await page.screenshot({ path: path.join(output, 'failure.png') }); await writeFile(path.join(output, 'failure.html'), await page.content()) }
  throw error
} finally {
  report.finished = new Date().toISOString()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
  if (app) await app.close()
  else await context?.close()
  await server?.httpServer.close()
}
