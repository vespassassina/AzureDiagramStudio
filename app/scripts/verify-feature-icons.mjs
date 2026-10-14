import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { qualityFixtures } from '../src/fixtures.ts'
import { createHash } from 'node:crypto'
import os from 'node:os'
import { assertCatalogSearch, catalogCoverage } from './verify-catalog.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = fileURLToPath(new URL('../test-results/feature-icons/', import.meta.url))
const vendors = JSON.parse(await readFile(new URL('../src/vendor-icons/catalog.generated.json', import.meta.url), 'utf8'))
const microsoft = JSON.parse(await readFile(new URL('../src/microsoft-icons/catalog.generated.json', import.meta.url), 'utf8'))
const registry = [...vendors, ...microsoft]
const registeredAssets = { ...JSON.parse(await readFile(new URL('../src/vendor-icons/assets.generated.json', import.meta.url), 'utf8')), ...JSON.parse(await readFile(new URL('../src/microsoft-icons/assets.generated.json', import.meta.url), 'utf8')) }
const report = { cases: [], errors: [], externalRequests: [] }
let server
let browser
let sequence = 0

async function backup(page, label) {
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Save JSON', exact: true }).click()
  const download = await pending
  const path = `${output}/${++sequence}-${label}.json`
  await download.saveAs(path)
  assert.equal(await download.failure(), null)
  return JSON.parse(await readFile(path, 'utf8'))
}

async function open(page, diagram) {
  const pending = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open JSON', exact: true }).click()
  await (await pending).setFiles({ name: 'mixed-icons.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(diagram)) })
  await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title, diagram.title)
  await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
}

async function upload(page, file, action = 'Import custom icon') {
  const pending = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: action, exact: true }).click()
  await (await pending).setFiles(file)
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Import custom icon"]').disabled)
}

async function inspectFit(page, name, viewport) {
  const measurements = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('.tool-rail button, .top-actions button, .property button, .tabs button')].filter(element => element.getClientRects().length && !element.closest('[inert]')).map(element => {
      const rect = element.getBoundingClientRect()
      return { name: element.getAttribute('aria-label') ?? element.textContent, left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom }
    })
    return { overflow: document.documentElement.scrollWidth > innerWidth, railControls: [...document.querySelectorAll('.tool-rail button')].map(element => element.getAttribute('aria-label')), theme: document.documentElement.getAttribute('data-theme'), controls }
  })
  assert.equal(measurements.overflow, false, name)
  for (const control of measurements.controls) assert.ok(control.left >= -.5 && control.right <= viewport.width + .5 && control.top >= -.5 && control.bottom <= viewport.height + .5, `${name}: clipped ${control.name}`)
  await page.screenshot({ path: `${output}/${name}.png` })
  return measurements
}

async function picture(page, format, label) {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const pending = page.waitForEvent('download')
  await page.getByRole('button', { name: format === 'svg' ? 'Export SVG' : 'Export PNG 1x', exact: true }).click()
  const download = await pending
  const path = `${output}/${label}.${format}`
  await download.saveAs(path)
  assert.equal(await download.failure(), null)
  return readFile(path)
}

async function customPixels(page, icon) {
  return page.evaluate(async dataUrl => {
    const image = new Image()
    image.src = dataUrl
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return { width: canvas.width, height: canvas.height, firstPixel: [...context.getImageData(0, 0, 1, 1).data] }
  }, icon.dataUrl)
}

// Decode the actual exported picture and inspect each icon slot, not text or tile borders.
async function iconPixels(page, bytes, mime, entities, bounds) {
  return page.evaluate(async ({ data, mime, entities, bounds }) => {
    const image = new Image()
    image.src = `data:${mime};base64,${data}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    return entities.map(entity => {
      const pixels = context.getImageData(entity.x + 17 - bounds.x, entity.y + 24 - bounds.y, 28, 28).data
      let ink = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 3] && Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 180) ink++
      }
      return { id: entity.id, ink }
    })
  }, { data: bytes.toString('base64'), mime, entities, bounds })
}

try {
  await mkdir(output, { recursive: true })
  report.coverage = await catalogCoverage()
  assert.equal(vendors.length, 17)
  assert.equal(microsoft.length, 14)
  server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  const base = server.resolvedUrls.local[0]
  browser = await chromium.launch({ channel: 'msedge', headless: true })
  report.browser = browser.version()
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const context = await browser.newContext({ viewport, colorScheme: 'light' })
    const page = await context.newPage()
    page.on('dialog', dialog => dialog.accept())
    page.on('pageerror', error => { if (!error.message.startsWith('ResizeObserver loop')) report.errors.push(error.message) })
    page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) report.externalRequests.push(request.url()) })
    await page.goto(base)
    await page.waitForFunction(() => !document.querySelector('button[aria-label="New diagram"]')?.disabled)
    await page.evaluate(() => document.fonts.ready)
    assert.equal(await page.title(), 'Azure Diagram Studio')
    assert.equal(await page.getByLabel('Azure Diagram Studio', { exact: true }).innerText(), 'Azure Diagram Studio')
    const original = await backup(page, `${viewport.width}-original`)
    await page.getByRole('button', { name: 'New diagram', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 0)
    const blank = await backup(page, `${viewport.width}-blank`)
    const svgSource = '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="48"><path fill="#db2134" d="M0 0h48v48H0z"/><path fill="#117865" d="M48 0h48v48H48z"/></svg>'
    await upload(page, { name: 'wide.svg', mimeType: 'image/svg+xml', buffer: Buffer.from(svgSource) })
    const created = await backup(page, `${viewport.width}-created`)
    assert.equal(created.entities.length, 1)
    const entity = created.entities[0]
    assert.equal(entity.width, 220)
    assert.equal(entity.customIcon.name, 'wide.svg')
    assert.equal(entity.customIcon.width, 96)
    assert.equal(entity.customIcon.height, 48)
    assert.match(entity.customIcon.dataUrl, /^data:image\/png;base64,/)
    const customPngSha256 = createHash('sha256').update(Buffer.from(entity.customIcon.dataUrl.split(',')[1], 'base64')).digest('hex')
    assert.deepEqual(await customPixels(page, entity.customIcon), { width: 96, height: 48, firstPixel: [219, 33, 52, 255] })
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-create`), blank)
    await page.getByRole('button', { name: 'Redo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-redo-create`), created)
    await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
    await page.locator('.react-flow__node').first().click({ position: { x: 15, y: 15 } })
    if (viewport.width <= 900) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
    await page.getByAltText('Custom icon preview').waitFor()
    const fit = await inspectFit(page, `${viewport.width}-custom-light`, viewport)
    const source = await page.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 20
      const context = canvas.getContext('2d'); context.fillStyle = '#1741e0'; context.fillRect(0, 0, 40, 20)
      return ['image/png', 'image/jpeg', 'image/webp'].map(mime => ({ mime, data: canvas.toDataURL(mime).split(',')[1] }))
    })
    const files = source.map(({ mime, data }) => ({ name: `replace.${mime.split('/')[1]}`, mimeType: mime, buffer: Buffer.from(data, 'base64') }))
    files.push({ name: 'replace.gif', mimeType: 'image/gif', buffer: Buffer.from('47494638396101000100800000ff00000000ff21f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b', 'hex') })
    const rasterEvidence = []
    for (const file of files) {
      await upload(page, file, 'Replace component icon')
      const replaced = await backup(page, `${viewport.width}-${file.name}`)
      assert.equal(replaced.entities.length, 1)
      assert.equal(replaced.entities[0].customIcon.name, file.name)
      assert.equal(replaced.revision, created.revision + 1)
      assert.match(replaced.entities[0].customIcon.dataUrl, /^data:image\/png;base64,/)
      const pixels = await customPixels(page, replaced.entities[0].customIcon)
      assert.deepEqual([pixels.width, pixels.height], file.mimeType === 'image/gif' ? [1, 1] : [40, 20])
      if (file.mimeType === 'image/gif') assert.deepEqual(pixels.firstPixel, [255, 0, 0, 255], 'Animated GIF freezes its red first frame, not its blue second frame')
      rasterEvidence.push({ format: file.mimeType, ...pixels })
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      assert.deepEqual(await backup(page, `${viewport.width}-undo-${file.name}`), created)
      if (viewport.width <= 900 && !(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
    }
    const blocked = [
      { name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') },
      { name: 'external.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64"><image href="https://example.com/private.png" width="64" height="64"/></svg>') },
      { name: 'event.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" onload="alert(1)"><rect width="64" height="64"/></svg>') },
      { name: 'truncated.png', mimeType: 'image/png', buffer: Buffer.from(files[0].buffer.subarray(0, 33)) },
      { name: 'not-png.png', mimeType: 'image/png', buffer: Buffer.from('not a PNG') },
    ]
    for (const file of blocked) {
      await upload(page, file, 'Replace component icon')
      assert.match(await page.getByRole('status').textContent(), /Could not import image/, `${file.name}: rejected upload reports its failure`)
      assert.deepEqual(await backup(page, `${viewport.width}-${file.name}-preserved`), created)
    }
    await page.getByRole('button', { name: 'Clear custom icon', exact: true }).click()
    const cleared = await backup(page, `${viewport.width}-cleared`)
    const { customIcon: removedIcon, ...plainEntity } = entity
    assert.deepEqual(removedIcon, entity.customIcon)
    assert.deepEqual(cleared, { ...created, revision: created.revision + 1, entities: [plainEntity] })
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-clear`), created)
    await page.getByLabel('Component type', { exact: true }).selectOption('microsoft-teams')
    const builtin = await backup(page, `${viewport.width}-builtin`)
    assert.equal(builtin.entities[0].icon, 'microsoft-teams')
    assert.equal(builtin.entities[0].customIcon, undefined)
    assert.equal(builtin.entities.length, created.entities.length)
    assert.equal(builtin.revision, created.revision + 1)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-builtin`), created)
    await page.evaluate(() => {
      window.__featureOriginalBitmap = window.createImageBitmap
      window.createImageBitmap = async (...args) => {
        const bitmap = await window.__featureOriginalBitmap(...args)
        await new Promise(resolve => { window.__featureReleaseDecode = resolve })
        return bitmap
      }
    })
    await page.getByLabel('Import icon file', { exact: true }).setInputFiles(files[0])
    await page.waitForFunction(() => typeof window.__featureReleaseDecode === 'function')
    await page.getByLabel('Component label', { exact: true }).fill('Intervening edit')
    await page.getByLabel('Component label', { exact: true }).press('Tab')
    await page.evaluate(() => { window.__featureReleaseDecode(); window.createImageBitmap = window.__featureOriginalBitmap })
    await page.getByRole('status').filter({ hasText: 'Import again' }).waitFor()
    const intervening = await backup(page, `${viewport.width}-stale-import`)
    assert.equal(intervening.entities[0].label, 'Intervening edit')
    assert.deepEqual(intervening.entities[0].customIcon, entity.customIcon)
    assert.equal(intervening.revision, created.revision + 1)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-intervening`), created)
    await page.keyboard.press('Control+c')
    await page.getByRole('button', { name: 'New diagram', exact: true }).click()
    await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 0)
    await page.keyboard.press('Control+v')
    const pasted = await backup(page, `${viewport.width}-pasted-new-document`)
    assert.equal(pasted.entities.length, 1)
    assert.deepEqual(pasted.entities[0].customIcon, entity.customIcon)
    if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
    await page.getByRole('button', { name: 'Group objects', exact: true }).click()
    const grouped = await backup(page, `${viewport.width}-grouped-custom`)
    assert.equal(grouped.revision, pasted.revision + 1)
    assert.equal(grouped.entities.length, 2)
    const groupedCustom = grouped.entities.find(candidate => candidate.kind === 'component')
    const boundary = grouped.entities.find(candidate => candidate.kind === 'boundary')
    assert.equal(groupedCustom.parentId, boundary.id)
    assert.deepEqual(groupedCustom.customIcon, entity.customIcon)
    assert.deepEqual([groupedCustom.x + boundary.x, groupedCustom.y + boundary.y], [pasted.entities[0].x, pasted.entities[0].y])
    await page.getByRole('button', { name: 'Ungroup boundaries', exact: true }).click()
    const ungrouped = await backup(page, `${viewport.width}-ungrouped-custom`)
    assert.equal(ungrouped.revision, grouped.revision + 1)
    assert.equal(ungrouped.entities.length, 1)
    assert.deepEqual(ungrouped.entities[0].customIcon, entity.customIcon)
    assert.equal(ungrouped.entities[0].parentId, null)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-ungroup`), grouped)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-group`), pasted)
    const mixed = { ...created, title: `Mixed icons ${viewport.width}`, synthetic: true, legendVisible: false, entities: [
      ...registry.map((item, index) => ({ id: item.icon, kind: 'component', label: item.label, subtitle: item.subtitle, icon: item.icon, color: item.color, parentId: null, layer: 'foreground', width: 220, height: 120, x: index % 4 * 250, y: Math.floor(index / 4) * 140 })),
      { ...entity, id: 'custom', x: 750, y: 980, height: 120 },
    ], connections: [] }
    await open(page, mixed)
    assert.deepEqual(await backup(page, `${viewport.width}-mixed-roundtrip`), mixed)
    if (viewport.width <= 900 && await page.getByRole('button', { name: 'Close properties', exact: true }).isVisible()) await page.getByRole('button', { name: 'Close properties', exact: true }).click()
    await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
    await page.waitForFunction(() => !document.querySelector('button[aria-label="Auto-arrange"]').disabled)
    const arranged = await backup(page, `${viewport.width}-mixed-arranged`)
    assert.equal(arranged.revision, mixed.revision + 1)
    assert.deepEqual(arranged.entities.find(candidate => candidate.id === 'custom').customIcon, entity.customIcon)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-arrange`), mixed)
    await page.reload()
    await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
    assert.deepEqual(await backup(page, `${viewport.width}-reloaded`), mixed)
    const invalidMixed = structuredClone(mixed)
    const corruptPng = Buffer.from(entity.customIcon.dataUrl.split(',')[1], 'base64')
    corruptPng[corruptPng.length - 1] ^= 1
    invalidMixed.entities.find(candidate => candidate.id === 'custom').customIcon.dataUrl = `data:image/png;base64,${corruptPng.toString('base64')}`
    const invalidChooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: 'Open JSON', exact: true }).click()
    await (await invalidChooser).setFiles({ name: 'invalid-crc.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(invalidMixed)) })
    await page.getByRole('status').filter({ hasText: /customIcon|PNG|checksum|CRC/i }).waitFor()
    assert.deepEqual(await backup(page, `${viewport.width}-invalid-crc-preserved`), mixed)
    await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
    await page.locator('.react-flow__node[data-id="custom"]').click({ position: { x: 5, y: 5 } })
    if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
    await upload(page, { name: 'same-body.png', mimeType: 'image/png', buffer: Buffer.from(entity.customIcon.dataUrl.split(',')[1], 'base64') }, 'Replace component icon')
    const sameBody = await backup(page, `${viewport.width}-same-png-body`)
    assert.equal(sameBody.entities.length, mixed.entities.length)
    assert.equal(sameBody.revision, mixed.revision + 1)
    assert.deepEqual(sameBody.entities.find(candidate => candidate.id === 'custom').customIcon, { ...entity.customIcon, name: 'same-body.png' })
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-same-png-body`), mixed)
    if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
    await page.getByRole('button', { name: 'Clear custom icon', exact: true }).click()
    const reopenedClear = await backup(page, `${viewport.width}-clear-after-reload`)
    assert.equal(reopenedClear.revision, mixed.revision + 1)
    assert.equal(reopenedClear.entities.length, mixed.entities.length)
    assert.equal(reopenedClear.entities.find(candidate => candidate.id === 'custom').customIcon, undefined)
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-undo-clear-after-reload`), mixed)
    if (viewport.width <= 900 && await page.getByRole('button', { name: 'Close properties', exact: true }).isVisible()) await page.getByRole('button', { name: 'Close properties', exact: true }).click()
    const svg = await picture(page, 'svg', `${viewport.width}-mixed`)
    const png = await picture(page, 'png', `${viewport.width}-mixed`)
    const text = svg.toString()
    assert.equal((text.match(/<image /g) ?? []).length, 32)
    assert.ok(text.includes(entity.customIcon.dataUrl))
    const imageUris = await page.evaluate(source => [...new DOMParser().parseFromString(source, 'image/svg+xml').querySelectorAll('image')].map(image => image.getAttribute('href')), text)
    assert.deepEqual(imageUris.sort(), [...registry.map(item => registeredAssets[item.icon]), entity.customIcon.dataUrl].sort(), 'All native SVG and normalized PNG artwork retain their exact URI bytes')
    assert.equal(/foreignObject|<script|href="https?:|href="file:/i.test(text), false)
    const viewBox = /viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/.exec(text)
    const bounds = { x: Number(viewBox[1]), y: Number(viewBox[2]) }
    const svgInk = await iconPixels(page, svg, 'image/svg+xml', mixed.entities, bounds)
    const pngInk = await iconPixels(page, png, 'image/png', mixed.entities, bounds)
    for (const slot of [...svgInk, ...pngInk]) assert.ok(slot.ink > 5, `Blank exported artwork: ${slot.id}`)
    await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
    assert.deepEqual(await backup(page, `${viewport.width}-theme-unchanged`), mixed)
    assert.deepEqual(await picture(page, 'svg', `${viewport.width}-mixed-dark`), svg)
    assert.deepEqual(await picture(page, 'png', `${viewport.width}-mixed-dark`), png)
    await inspectFit(page, `${viewport.width}-mixed-dark`, viewport)
    if (!(await page.locator('.library').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open component library', exact: true }).click()
    const queries = [...new Set([...registry.map(item => item.label), ...registry.flatMap(item => item.aliases)])]
    for (const query of queries) await assertCatalogSearch(page, query)
    await inspectFit(page, `${viewport.width}-search-dark`, viewport)
    const readonly = await context.newPage()
    readonly.on('pageerror', error => report.errors.push(error.message))
    await readonly.goto(base)
    await readonly.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Read-only')
    assert.equal(await readonly.getByRole('button', { name: 'Import custom icon', exact: true }).isDisabled(), true)
    await readonly.getByLabel('Import icon file', { exact: true }).setInputFiles(files[0])
    assert.deepEqual(await backup(readonly, `${viewport.width}-readonly-unchanged`), mixed)
    await readonly.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
    assert.deepEqual(await backup(readonly, `${viewport.width}-readonly-theme`), mixed)
    await inspectFit(readonly, `${viewport.width}-readonly-light`, viewport)
    assert.deepEqual(await picture(readonly, 'svg', `${viewport.width}-readonly`), svg)
    assert.deepEqual(await picture(readonly, 'png', `${viewport.width}-readonly`), png)
    await readonly.close()
    report.cases.push({ viewport, passed: true, fit, imports: ['SVG', 'PNG', 'JPEG', 'GIF', 'WebP'], rasterEvidence, blockedFiles: blocked.map(file => file.name), invalidCanonicalPngCrcRejected: true, rejectedDocumentRevision: created.revision, clearRevision: cleared.revision, builtinRevision: builtin.revision, customPngSha256, samePngBodyAfterJsonReload: true, exactAliasQueries: queries, groupAndUngroupExactUndo: true, readonlyThemeAndExportBytesUnchanged: true, svgInk, pngInk, originalDocument: original.id })
    await context.close()
    console.log(`PASS ${viewport.width}: 5 imports/first GIF frame, 5 atomic rejections, actual clear/type counters, grouping/undo, same PNG body after JSON/reload, exact aliases, 32 SVG/PNG slots, light/dark and readonly bytes/fit`)
  }
  assert.equal(report.cases[0].customPngSha256, report.cases[1].customPngSha256, 'Fresh desktop/mobile contexts retain the same normalized PNG body')
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  page.on('dialog', dialog => dialog.accept())
  page.on('pageerror', error => report.errors.push(error.message))
  await page.goto(base)
  await page.waitForFunction(() => !document.querySelector('button[aria-label="New diagram"]')?.disabled)
  const stress = qualityFixtures().find(diagram => diagram.id === 'stress-v1')
  assert.equal(stress.entities.length, 100)
  assert.equal(stress.connections.length, 150)
  await open(page, stress)
  for (const name of ['Close component library', 'Close properties']) if (await page.getByRole('button', { name, exact: true }).isVisible()) await page.getByRole('button', { name, exact: true }).click()
  await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
  await page.locator('.react-flow__node[data-id="node-0"]').click({ position: { x: 10, y: 10 } })
  const edits = await page.evaluate(async () => {
    const times = []
    for (let index = 0; index < 20; index++) {
      const start = performance.now()
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      times.push(performance.now() - start)
    }
    return times
  })
  const layouts = await page.evaluate(async () => {
    const times = []
    const button = document.querySelector('button[aria-label="Auto-arrange"]')
    for (let index = 0; index < 10; index++) {
      const start = performance.now()
      button.click()
      await new Promise(resolve => requestAnimationFrame(resolve))
      while (button.disabled) await new Promise(resolve => requestAnimationFrame(resolve))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      times.push(performance.now() - start)
    }
    return times
  })
  assert.equal((await backup(page, 'stress-committed')).revision, stress.revision + 30)
  const p95 = [...edits].sort((before, after) => before - after)[Math.ceil(edits.length * .95) - 1]
  report.performance = { fixtureId: stress.id, fixtureSourceSha256: createHash('sha256').update(await readFile(new URL('../src/fixtures.ts', import.meta.url))).digest('hex'), hardware: { platform: os.platform(), architecture: os.arch(), cpu: os.cpus()[0]?.model }, browser: browser.version(), production: true, editMilliseconds: edits, p95Milliseconds: p95, layoutMilliseconds: layouts, editP95AtMost100ms: p95 <= 100, allLayoutsAtMost2s: layouts.every(value => value <= 2000), method: 'Original V1: DOM keyboard dispatch to two animation frames, ten actual worker layouts to enabled control plus two frames' }
  await writeFile(`${output}/performance.json`, JSON.stringify(report.performance, null, 2))
  assert.ok(p95 <= 100, `p95 ${p95.toFixed(2)}ms exceeds 100ms`)
  assert.ok(layouts.every(value => value <= 2000), `Layout maximum ${Math.max(...layouts).toFixed(2)}ms exceeds 2000ms`)
  console.log(`PASS original stress gates: p95 ${p95.toFixed(2)}ms; max layout ${Math.max(...layouts).toFixed(2)}ms`)
  await context.close()
  assert.deepEqual(report.errors, [])
  assert.deepEqual(report.externalRequests, [])
} catch (error) {
  report.errors.push(error.stack ?? String(error))
  process.exitCode = 1
  console.error(error)
} finally {
  await browser?.close()
  await new Promise(resolve => server?.httpServer ? server.httpServer.close(resolve) : resolve())
  await writeFile(`${output}/browser-report.json`, JSON.stringify(report, null, 2))
}