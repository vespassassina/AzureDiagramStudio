import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { createDocument, absolutePosition } from '../src/model.ts'
import { qualityFixtures } from '../src/fixtures.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = `${root}test-results/sprint-3-verifier`
const report = { date: new Date().toISOString(), role: 'Independent verifier', production: true, cases: [], errors: [], remoteRequests: [], resources: [] }
const button = (page, name) => page.getByRole('button', { name, exact: true })
const frames = page => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
let sequence = 0
let server
let browser
let base

function fixture(overrides = {}) {
  return { ...createDocument('sprint3-independent', 'Independent Sprint 3'), subtitle: 'Production verification', synthetic: true, legendVisible: true,
    backgroundColor: '#ffffff', grid: { visible: false, style: 'dots', spacing: 16, snap: false, present: false, export: false },
    entities: [
      { id: 'outer', kind: 'boundary', parentId: null, label: 'Outer boundary', x: -81.25, y: 43.5, width: 780, height: 500, color: 'teal', layer: 'background' },
      { id: 'inner', kind: 'boundary', parentId: 'outer', label: 'Nested boundary', x: 25.5, y: 64.75, width: 560, height: 330, color: 'amber', layer: 'background' },
      { id: 'child', kind: 'component', layer: 'foreground', parentId: 'inner', label: 'Child service', x: 35.5, y: 67.25, width: 220, height: 88, color: 'teal', icon: 'azure-app', status: 'live' },
      { id: 'target', kind: 'component', layer: 'foreground', parentId: 'inner', label: 'Target service', x: 310.5, y: 67.25, width: 220, height: 88, color: 'amber', icon: 'azure-sql', status: 'planned' },
      { id: 'nested-note', kind: 'text', layer: 'foreground', parentId: 'inner', label: 'Nested annotation', x: 60.25, y: 210.5, width: 360, height: 60, color: 'gray' },
      { id: 'note', kind: 'text', layer: 'foreground', parentId: null, label: 'Outside annotation', x: -40.25, y: 630.5, width: 440, height: 60, color: 'gray' },
      { id: 'excluded', kind: 'component', layer: 'foreground', parentId: null, label: 'Excluded service', x: 940, y: 90, width: 220, height: 88, color: '#bd1636', icon: 'azure-api' },
    ], connections: [
      { id: 'internal-link', from: 'child', to: 'target', label: 'Internal flow', style: 'solid', arrow: 'forward' },
      { id: 'external-link', from: 'target', to: 'excluded', label: 'External flow', style: 'dashed', arrow: 'both' },
    ], ...overrides }
}

async function saved(page) { await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device') }
async function durable(page) {
  await saved(page)
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('diagrammer-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('documents', 'readonly')
      const read = transaction.objectStore('documents').get('active-document')
      read.onsuccess = () => resolve(read.result)
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => database.close()
    }
  }))
}
async function download(page, action, label) {
  const pending = page.waitForEvent('download')
  await action()
  const file = await pending
  const path = `${output}/${++sequence}-${label}-${file.suggestedFilename()}`
  await file.saveAs(path)
  assert.equal(await file.failure(), null)
  return { path, bytes: await readFile(path) }
}
async function canonical(page, label) { return JSON.parse((await download(page, () => button(page, 'Save JSON').click(), label)).bytes.toString()) }
async function closePanels(page) {
  for (const name of ['Close component library', 'Close properties']) if (await button(page, name).isVisible()) await button(page, name).click()
}
async function fit(page, selection = false) {
  await button(page, selection ? 'Fit selection' : 'Fit diagram').click()
  await settled(page)
}
async function settled(page) {
  await page.evaluate(() => new Promise(resolve => {
    let previous = '', stable = 0
    const next = () => {
      const current = document.querySelector('.react-flow__viewport')?.style.transform
      stable = current === previous ? stable + 1 : 0
      previous = current
      if (stable >= 18) resolve(); else requestAnimationFrame(next)
    }
    requestAnimationFrame(next)
  }))
}
async function open(page, source) {
  await page.getByLabel('Open document file').setInputFiles({ name: 'sprint3.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(source)) })
  await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title, source.title)
  await saved(page)
  assert.deepEqual(await durable(page), source)
  await closePanels(page)
  if (source.entities.length) await fit(page)
}
async function select(page, id, edge = false) {
  const element = page.locator(`.react-flow__${edge ? 'edge' : 'node'}[data-id="${id}"]`)
  await element.focus(); await element.press('Enter')
  await closePanels(page)
  await frames(page)
  return element
}
async function properties(page) { await button(page, 'Document properties').click() }
async function library(page) {
  if (!(await page.locator('.library').evaluate(element => element.classList.contains('open')))) await button(page, 'Open component library').click()
}
async function panePoint(page) {
  return page.evaluate(() => {
    const rect = document.querySelector('.canvas-surface').getBoundingClientRect()
    for (let y = rect.bottom - 16; y >= rect.top + 16; y -= 12) for (let x = rect.right - 16; x >= rect.left + 16; x -= 12) if (document.elementFromPoint(x, y)?.classList.contains('react-flow__pane')) return { x: x + .375, y: y + .625 }
    throw new Error('No unobstructed pane target')
  })
}
async function field(page, name, value) { const input = page.getByLabel(name, { exact: true }); await input.fill(value); await input.press('Tab'); await saved(page) }
async function exportFile(page, options, label) {
  await button(page, 'Export').click()
  const dialog = page.getByRole('dialog', { name: 'Export diagram' })
  for (const name of [options.selection ? 'Selection' : 'All', options.aspect ?? 'Content', options.transparent ? 'Transparent background' : options.background ?? 'Diagram']) await dialog.getByRole('radio', { name, exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'Include grid' }).setChecked(options.grid ?? false)
  return download(page, () => button(dialog, options.svg ? 'Export SVG' : `Export PNG ${options.scale ?? 1}x`).click(), label)
}
async function pixels(page, bytes) {
  return page.evaluate(async base64 => {
    const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
    const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
    const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data
    let alpha = 0, ink = 0
    for (let offset = 0; offset < data.length; offset += 4) {
      if (data[offset + 3]) alpha++
      if (data[offset + 3] && (data[offset] !== data[0] || data[offset + 1] !== data[1] || data[offset + 2] !== data[2])) ink++
    }
    const result = { width: image.width, height: image.height, corner: [...data.slice(0, 4)], alpha, ink }
    image.close(); return result
  }, bytes.toString('base64'))
}
async function phase(page) {
  return page.evaluate(() => {
    const pattern = document.querySelector('.react-flow__background pattern')
    const circle = pattern.querySelector('circle')
    const width = Number(pattern.getAttribute('width')), height = Number(pattern.getAttribute('height'))
    const translation = pattern.getAttribute('patternTransform').match(/translate\(([^,]+),([^\)]+)\)/)
    const matrix = new DOMMatrix(getComputedStyle(document.querySelector('.react-flow__viewport')).transform)
    const center = circle ? { x: Number(circle.getAttribute('cx')), y: Number(circle.getAttribute('cy')) } : { x: width / 2, y: height / 2 }
    const distance = (value, spacing) => { const remainder = ((value % spacing) + spacing) % spacing; return Math.min(remainder, spacing - remainder) }
    return { x: distance(Number(pattern.getAttribute('x')) + Number(translation[1]) + center.x - matrix.e, width), y: distance(Number(pattern.getAttribute('y')) + Number(translation[2]) + center.y - matrix.f, height), spacing: width / matrix.a }
  })
}
async function pointerPoint(page, id) {
  return page.locator(`.react-flow__node[data-id="${id}"]`).evaluate(element => {
    const rect = element.getBoundingClientRect()
    const horizontalInset = Math.min(16, rect.width / 10)
    const headerHeight = Math.min(rect.height, 44 * rect.height / element.offsetHeight)
    const verticalInset = Math.min(12, headerHeight / 4)
    for (const vertical of [0, .25, .5, .75, 1]) for (const horizontal of [0, .125, .25, .375, .5, .625, .75, .875, 1]) {
      const x = rect.left + horizontalInset + horizontal * (rect.width - 2 * horizontalInset)
      const y = rect.top + verticalInset + vertical * (headerHeight - 2 * verticalInset)
      const hit = document.elementFromPoint(x, y)
      if (hit?.closest('.react-flow__node') === element && !hit.closest('.react-flow__handle, .react-flow__resize-control')) return { x, y }
    }
    throw new Error(`No unobstructed physical target for ${element.dataset.id}`)
  })
}
async function drag(page, id, dx, dy) {
  const before = await durable(page), point = await pointerPoint(page, id)
  await page.mouse.move(point.x, point.y); await page.mouse.down()
  await page.mouse.move(point.x + dx, point.y + dy, { steps: 12 }); await page.mouse.up()
  await page.waitForFunction(revision => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device' && !document.querySelector('button[aria-label="Undo"]').disabled, before.revision)
  const after = await durable(page); assert.equal(after.revision, before.revision + 1)
  return after
}
async function contrastMeasurements(page, vector, source) {
  return page.evaluate(({ vector, source }) => {
    const svg = new DOMParser().parseFromString(vector, 'image/svg+xml')
    const groups = [...svg.documentElement.children].filter(element => element.tagName === 'g' && element.hasAttribute('transform'))
    const parse = color => { const hex = color.slice(1); return hex.length === 3 ? [...hex].map(value => parseInt(value + value, 16)) : [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16)) }
    const luminance = channels => { const linear = channels.map(value => { const channel = value / 255; return channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4 }); return linear[0] * .2126 + linear[1] * .7152 + linear[2] * .0722 }
    const ratio = (first, second) => { const front = luminance(first), back = luminance(second); return (Math.max(front, back) + .05) / (Math.min(front, back) + .05) }
    const absolute = entity => { const parent = source.entities.find(item => item.id === entity.parentId); const origin = parent ? absolute(parent) : { x: 0, y: 0 }; return { x: origin.x + entity.x, y: origin.y + entity.y } }
    const results = []
    for (const id of ['outer', 'inner', 'nested-note', 'note']) {
      const entity = source.entities.find(item => item.id === id)
      const canvas = document.querySelector(`.react-flow__node[data-id="${id}"] .architecture-tile > svg`)
      const group = groups.find(group => [...group.querySelectorAll('text')].some(text => text.textContent.includes(entity.label)))
      if (!group || group.innerHTML !== new DOMParser().parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${canvas.innerHTML}</svg>`, 'image/svg+xml').documentElement.innerHTML) throw new Error(`Canvas/export markup mismatch for ${id}`)
      const text = canvas.querySelector('text'), point = absolute(entity)
      point.x += Number(text.getAttribute('x')); point.y += Number(text.getAttribute('y'))
      let background = parse(source.backgroundColor)
      for (const painted of groups) {
        const label = painted.querySelector('text')?.textContent
        const shape = source.entities.find(item => item.label === label)
        if (!shape) continue
        const origin = absolute(shape), rect = painted.querySelector('rect')
        if (rect && ['boundary', 'rectangle'].includes(shape.kind) && point.x >= origin.x && point.y >= origin.y && point.x <= origin.x + shape.width && point.y <= origin.y + shape.height) {
          const alpha = Number(rect.getAttribute('fill-opacity') ?? 1), foreground = parse(rect.getAttribute('fill'))
          background = foreground.map((value, index) => Math.round(value * alpha + background[index] * (1 - alpha)))
        }
        if (shape.id === id) break
      }
      results.push({ id, fill: text.getAttribute('fill'), background, ratio: ratio(parse(text.getAttribute('fill')), background), markupParity: true })
    }
    return results
  }, { vector, source })
}
async function directChecks(page, viewport, theme) {
  const original = fixture()
  await open(page, original)
  if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
  const renamed = []
  for (const [id, kind, edge] of [['child', 'component', false], ['internal-link', 'connection', true], ['note', 'note', false]]) {
    await open(page, original)
    const target = await select(page, id, edge)
    await fit(page, !edge)
    await target.focus(); await target.press('F2')
    const input = page.getByRole('textbox', { name: `Inline ${kind === 'note' ? 'note text' : `${kind} label`}`, exact: true })
    await input.waitFor()
    assert.equal(await input.evaluate(element => document.activeElement === element), true)
    await page.screenshot({ path: `${output}/${viewport.width}-${theme}-inline-${kind}.png` })
    await input.fill('Cancelled label'); await input.press('Escape')
    assert.deepEqual(await durable(page), original)
    await closePanels(page)
    const label = edge ? target.locator('text') : target.locator('svg text').first()
    const rect = await label.boundingBox(); assert.ok(rect)
    const hit = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest('.react-flow__node, .react-flow__edge')?.getAttribute('data-id'), { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })
    assert.equal(hit, id, `Physical doubleclick target for ${id}`)
    await page.mouse.dblclick(rect.x + rect.width / 2, rect.y + rect.height / 2)
    await input.waitFor()
    await input.fill('Renamed label'); await input.press('Home'); await input.press('Delete')
    assert.equal(await input.count(), 1)
    assert.deepEqual(await durable(page), original)
    await input.press('Control+k'); assert.equal(await page.getByRole('dialog', { name: 'Commands', exact: true }).count(), 0)
    await input.fill(kind === 'note' ? 'First line' : `Renamed ${kind}`)
    if (kind === 'note') { await input.press('End'); await input.press('Enter'); await input.press('a'); assert.equal(await input.inputValue(), 'First line\na') }
    await input.evaluate(element => {
      element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
      element.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: element.tagName === 'TEXTAREA', isComposing: true, bubbles: true }))
    })
    assert.equal(await input.count(), 1); assert.deepEqual(await durable(page), original)
    await input.evaluate(element => element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'a' })))
    await input.press(kind === 'note' ? 'Control+Enter' : 'Enter'); await saved(page)
    const changed = await durable(page)
    assert.equal(changed.revision, original.revision + 1)
    assert.equal((edge ? changed.connections : changed.entities).find(item => item.id === id).label, kind === 'note' ? 'First line\na' : `Renamed ${kind}`)
    assert.deepEqual(changed.entities.map(({ label, ...item }) => item), original.entities.map(({ label, ...item }) => kind === 'note' && item.id === id ? { ...item, height: 61 } : item))
    await button(page, 'Undo').click(); assert.deepEqual(await canonical(page, `${viewport.width}-${theme}-${kind}-undo`), original)
    await target.focus(); await target.press('F2'); await input.fill('Blur commit')
    await button(page, 'Commands').click(); await saved(page)
    assert.equal((await durable(page)).revision, original.revision + 1)
    assert.equal((edge ? (await durable(page)).connections : (await durable(page)).entities).find(item => item.id === id).label, 'Blur commit')
    await page.getByRole('dialog', { name: 'Commands', exact: true }).getByRole('combobox').press('Escape')
    await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
    renamed.push({ kind, F2: true, physicalDoubleclick: true, enter: true, escape: true, blurOneCommit: true, IME: true, deleteIsInputOnly: true, exactUndo: true })
  }
  await closePanels(page)
  const trigger = button(page, 'Commands'), dialog = page.getByRole('dialog', { name: 'Commands', exact: true })
  await trigger.click()
  const search = dialog.getByRole('combobox', { name: 'Filter commands' })
  await search.fill('Pan tool'); await search.press('ArrowDown'); await search.press('Enter')
  assert.equal(await button(page, 'Pan tool').getAttribute('aria-pressed'), 'true')
  await trigger.focus(); await trigger.press('Control+k'); await search.press('Escape')
  assert.equal(await trigger.evaluate(element => document.activeElement === element), true)
  await trigger.click(); await search.fill('Grid settings'); await search.press('Enter')
  assert.equal(await page.getByLabel('Show grid', { exact: true }).evaluate(element => document.activeElement === element), true)
  await closePanels(page)
  await trigger.click(); await search.fill('Export'); await search.press('Enter')
  assert.equal(await dialog.count(), 0); assert.equal(await page.getByRole('dialog', { name: 'Export diagram' }).count(), 1)
  await button(page, 'Cancel export').click()
  await trigger.click(); await search.fill('Present'); await search.press('Enter'); await settled(page)
  await button(page, 'Exit presentation').press('Control+k'); assert.equal(await dialog.count(), 0)
  await button(page, 'Exit presentation').press('F2'); assert.equal(await page.locator('.inline-label').count(), 0)
  await button(page, 'Exit presentation').click()
  assert.deepEqual(await canonical(page, `${viewport.width}-${theme}-commands-invariant`), original)
  await select(page, 'child'); await page.locator('.react-flow__node[data-id="child"]').press('F2')
  await page.getByRole('textbox', { name: 'Inline component label' }).fill('Stale draft')
  await page.getByLabel('Open document file').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture({ id: 'replacement', title: 'New document' }))) })
  await saved(page); assert.equal(await page.locator('.inline-label').count(), 0)
  assert.equal((await durable(page)).entities.find(item => item.id === 'child').label, 'Child service')
  return { viewport, theme, renamed, commands: 'filtered keyboard dispatch, focus return, property/export separation, Present guard', staleDraftCanceled: true, commandStateOutsideJSON: true }
}

async function exportChecks(page, context, viewport, theme) {
  const original = fixture({ backgroundColor: '#101010' })
  await open(page, original)
  if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
  await select(page, 'outer'); await fit(page, true)
  const content = await exportFile(page, { selection: true, svg: true }, `${viewport.width}-${theme}-selection-content`)
  const wide = await exportFile(page, { selection: true, svg: true, aspect: '16:9' }, `${viewport.width}-${theme}-selection-wide`)
  const scope = await page.evaluate(({ content, wide }) => {
    const first = new DOMParser().parseFromString(content, 'image/svg+xml'), second = new DOMParser().parseFromString(wide, 'image/svg+xml')
    const groups = svg => [...svg.documentElement.children].filter(element => element.tagName === 'g' && element.hasAttribute('transform')).map(element => ({ transform: element.getAttribute('transform'), markup: element.innerHTML }))
    return { content: groups(first), wide: groups(second), contentViewBox: first.documentElement.getAttribute('viewBox'), wideViewBox: second.documentElement.getAttribute('viewBox'), externalReferences: /<script|foreignObject|(?:href|xlink:href)="(?:https?:|\/)/.test(wide), fontEmbedded: wide.includes('@font-face') }
  }, { content: content.bytes.toString(), wide: wide.bytes.toString() })
  assert.equal(scope.content.length, 5); assert.deepEqual(scope.wide, scope.content)
  assert.equal(scope.externalReferences, false); assert.equal(scope.fontEmbedded, true)
  for (const value of ['Outer boundary', 'Nested boundary', 'Child service', 'Target service', 'Nested annotation', 'Internal flow']) assert.ok(wide.bytes.toString().includes(value))
  for (const value of ['Excluded service', 'External flow', 'Outside annotation']) assert.ok(!wide.bytes.toString().includes(value))
  const box = scope.wideViewBox.split(/\s+/).map(Number); assert.ok(Math.abs(box[2] / box[3] - 16 / 9) < 1e-10)
  await button(page, 'Export').click()
  const dialog = page.getByRole('dialog', { name: 'Export diagram' })
  const preview = await dialog.getByRole('img', { name: 'Export preview' }).innerHTML()
  assert.ok(preview.includes('Internal flow') && !preview.includes('External flow'))
  assert.ok(!preview.includes('@font-face') && preview.length < 150000)
  const controls = await dialog.locator('button:not(.export-backdrop), .export-segments label, .export-grid').evaluateAll(elements => elements.map(element => ({ label: element.getAttribute('aria-label') ?? element.textContent, ...element.getBoundingClientRect().toJSON() })))
  for (const control of controls) assert.ok(control.width >= 44 && control.height >= 44 && control.left >= 0 && control.right <= viewport.width, `Export control clipped: ${JSON.stringify(control)}`)
  await page.screenshot({ path: `${output}/${viewport.width}-${theme}-export-preview.png` })
  await button(dialog, 'Copy image').click()
  await page.getByRole('status').filter({ hasText: /^Image copied\.$/ }).waitFor()
  const copied = await page.evaluate(async () => {
    const items = await navigator.clipboard.read(), blob = await items[0].getType('image/png')
    let binary = ''; for (const byte of new Uint8Array(await blob.arrayBuffer())) binary += String.fromCharCode(byte)
    return btoa(binary)
  })
  const bytes = Buffer.from(copied, 'base64'); await writeFile(`${output}/${viewport.width}-${theme}-clipboard-real.png`, bytes)
  const clipboard = await pixels(page, bytes)
  assert.equal(clipboard.width / clipboard.height, 16 / 9); assert.deepEqual(clipboard.corner, [16, 16, 16, 255]); assert.ok(clipboard.ink > 1000)
  const whiteFile = await exportFile(page, { selection: true, aspect: '16:9', background: 'White', scale: 2, grid: true }, `${viewport.width}-${theme}-white-grid-2x`)
  const transparentFile = await exportFile(page, { selection: true, aspect: '16:9', transparent: true, grid: true }, `${viewport.width}-${theme}-transparent-grid-1x`)
  const white = await pixels(page, whiteFile.bytes), transparent = await pixels(page, transparentFile.bytes)
  assert.equal(white.width, clipboard.width * 2); assert.equal(white.height, clipboard.height * 2)
  assert.deepEqual(white.corner, [255, 255, 255, 255]); assert.ok(transparent.alpha > 1000 && transparent.alpha < transparent.width * transparent.height)
  const gridVector = await exportFile(page, { selection: true, aspect: '16:9', transparent: true, grid: true, svg: true }, `${viewport.width}-${theme}-transparent-grid-vector`)
  assert.ok(gridVector.bytes.toString().includes('<pattern '))
  assert.deepEqual(await canonical(page, `${viewport.width}-${theme}-export-invariant`), original)
  await page.route(`${base}`, async route => {
    const response = await route.fetch()
    await route.fulfill({ response, headers: { ...response.headers(), 'permissions-policy': 'clipboard-write=()' } })
  })
  await page.reload(); await saved(page); await closePanels(page)
  assert.equal(await page.evaluate(() => document.featurePolicy.allowsFeature('clipboard-write')), false)
  await select(page, 'outer'); await fit(page, true)
  await button(page, 'Export').click()
  await dialog.getByRole('radio', { name: 'Selection', exact: true }).check(); await dialog.getByRole('radio', { name: 'Transparent background', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'Include grid' }).uncheck()
  const fallbackFile = await download(page, () => button(dialog, 'Copy image').click(), `${viewport.width}-${theme}-clipboard-denied-fallback`)
  await page.getByRole('status').filter({ hasText: /Image not copied.*PNG downloaded/ }).waitFor()
  const fallback = await pixels(page, fallbackFile.bytes); assert.equal(fallback.corner[3], 0)
  assert.deepEqual(await canonical(page, `${viewport.width}-${theme}-fallback-invariant`), original)
  return { viewport, theme, scope, controls: controls.length, clipboard, white, transparent, fallback, clipboardGrant: 'actual PNG read', clipboardDenied: 'browser permissions policy, real PNG download, no false success', nativeTeamsOffice: 'MANUAL UNVERIFIED', JSONAndHistoryUnchanged: true }
}

async function readOnlyChecks(page, context, viewport, theme) {
  const original = fixture()
  await open(page, original)
  const readonly = await context.newPage(); readonly.setDefaultTimeout(12000)
  readonly.on('pageerror', error => report.errors.push({ name: `Readonly ${viewport.width} ${theme}`, error: error.message }))
  await readonly.goto(base)
  await readonly.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Read-only')
  if (await readonly.locator('html').getAttribute('data-theme') !== theme) await readonly.getByRole('button', { name: /Switch to .* theme/ }).click()
  await closePanels(readonly); await properties(readonly)
  const guarded = ['Background hex color', 'Diagram background color', 'Show grid', 'Snap to grid', 'Show grid in Present', 'Include grid in exports', 'Grid spacing']
  for (const name of guarded) assert.equal(await readonly.getByLabel(name, { exact: true }).isDisabled(), true)
  for (const name of ['Dots grid', 'Lines grid', 'Reset diagram background']) assert.equal(await button(readonly, name).isDisabled(), true)
  await closePanels(readonly); await fit(readonly)
  const node = await select(readonly, 'child'); await node.focus(); await node.press('F2'); await node.press('Delete'); await node.press('ArrowRight')
  assert.equal(await readonly.locator('.inline-label').count(), 0)
  await button(readonly, 'Commands').click()
  const dialog = readonly.getByRole('dialog', { name: 'Commands', exact: true })
  const disabled = []
  for (const name of ['Undo', 'Redo', 'Add component', 'Delete selection', 'Duplicate selection']) {
    const option = dialog.getByRole('option', { name, exact: true })
    assert.equal(await option.getAttribute('aria-disabled'), 'true'); disabled.push(name)
  }
  await dialog.getByRole('combobox').fill('Delete selection'); await dialog.getByRole('combobox').press('Enter')
  assert.equal(await dialog.count(), 1); await dialog.getByRole('combobox').press('Escape')
  await button(readonly, 'Present').click(); await settled(readonly)
  await button(readonly, 'Exit presentation').press('Control+k'); await button(readonly, 'Exit presentation').press('F2')
  assert.equal(await readonly.locator('.inline-label').count(), 0); assert.equal(await readonly.getByRole('dialog').count(), 0)
  await readonly.screenshot({ path: `${output}/${viewport.width}-${theme}-readonly-present.png` })
  await button(readonly, 'Exit presentation').click()
  assert.deepEqual(await canonical(readonly, `${viewport.width}-${theme}-readonly-json`), original)
  const vector = await exportFile(readonly, { svg: true }, `${viewport.width}-${theme}-readonly-export`)
  assert.ok(vector.bytes.toString().includes('Child service'))
  assert.deepEqual(await durable(page), original)
  await readonly.close()
  return { viewport, theme, actualOriginLock: true, guardedControls: guarded.length + 3, disabledCommands: disabled, presentMutationBlocked: true, readonlyExportAllowed: true, JSONUnchanged: true }
}

async function gridPixelChecks(page) {
  const results = []
  for (const style of ['dots', 'lines']) for (const scale of [1, 2]) for (const transparent of [true, false]) {
    const source = fixture({ title: '', subtitle: '', synthetic: false, legendVisible: false, entities: [], connections: [], backgroundColor: '#101010', grid: { visible: false, style, spacing: 8, snap: false, present: false, export: true } })
    await open(page, source)
    const vector = await exportFile(page, { svg: true, grid: true, transparent }, `grid-${style}-${scale}-${transparent}-vector`)
    const file = await exportFile(page, { scale, grid: true, transparent }, `grid-${style}-${scale}-${transparent}-png`)
    const measurement = await page.evaluate(async ({ base64, scale, vector }) => {
      const image = await createImageBitmap(await (await fetch(`data:image/png;base64,${base64}`)).blob())
      const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      const sample = (x, y) => [...context.getImageData(x * scale, y * scale, 1, 1).data]
      const svg = new DOMParser().parseFromString(vector, 'image/svg+xml'), pattern = svg.querySelector('pattern')
      const result = { grid: sample(4, 4), nextGrid: sample(12, 12), between: sample(8, 8), viewBox: svg.documentElement.getAttribute('viewBox'), pattern: { width: pattern.getAttribute('width'), x: pattern.getAttribute('x'), y: pattern.getAttribute('y'), units: pattern.getAttribute('patternUnits') }, patternCount: svg.querySelectorAll('pattern').length, width: image.width, height: image.height }
      image.close(); return result
    }, { base64: file.bytes.toString('base64'), scale, vector: vector.bytes.toString() })
    assert.equal(measurement.patternCount, 1); assert.equal(measurement.pattern.units, 'userSpaceOnUse')
    assert.equal(measurement.pattern.x, '0'); assert.equal(measurement.pattern.y, '0'); assert.equal(measurement.pattern.width, '8')
    assert.deepEqual(measurement.viewBox.split(/\s+/).slice(0, 2).map(Number), [-20, -20])
    assert.ok(measurement.grid[3] > 0 && measurement.nextGrid[3] > 0)
    if (transparent) assert.equal(measurement.between[3], 0)
    else assert.deepEqual(measurement.between, [16, 16, 16, 255])
    assert.deepEqual(await canonical(page, `grid-${style}-${scale}-${transparent}-invariant`), source)
    results.push({ style, scale, transparent, measurement })
  }
  return { combinations: results, absoluteZeroOrigin: true, negativeCrop: true, alphaBetweenGrid: true, nativePattern: true }
}

async function backgroundControlChecks(page) {
  const original = fixture()
  await open(page, original); await properties(page)
  const native = page.getByLabel('Diagram background color', { exact: true })
  await native.fill('#203344'); await native.fill('#304455'); await native.press('Tab'); await saved(page)
  const changed = await durable(page); assert.equal(changed.revision, original.revision + 1); assert.equal(changed.backgroundColor, '#304455')
  await field(page, 'Background hex color', 'url(https://invalid.example/image)')
  assert.deepEqual(await durable(page), changed)
  await page.getByLabel('Background hex color', { exact: true }).press('Escape')
  await button(page, 'Reset diagram background').click(); await saved(page)
  assert.equal(Object.hasOwn(await durable(page), 'backgroundColor'), false)
  assert.equal(await page.locator('.canvas-surface').evaluate(element => getComputedStyle(element).backgroundColor), 'rgb(255, 255, 255)')
  await button(page, 'Undo').click(); assert.deepEqual(await durable(page), changed)
  await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
  return { nativeTwoDraftsOneCommit: true, invalidURLRejected: true, resetOmitsField: true, exactUndo: true }
}

async function originalStress() {
  const previous = `${root}test-results/v1`
  const archived = `${output}/pre-run-performance`
  await mkdir(archived, { recursive: true })
  const names = ['Production-stress-performance.json', 'focused-Production-stress.json', 'stress-production.png']
  for (const name of names) {
    try { await writeFile(`${archived}/${name}`, await readFile(`${previous}/${name}`)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [`${root}scripts/verify-v1.mjs`], { cwd: root, env: { ...process.env, DGM_V1_URL: base, DGM_V1_CASE: 'Production stress' }, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    child.stdout.on('data', chunk => { stdout += chunk; process.stdout.write(chunk) })
    child.stderr.on('data', chunk => { stderr += chunk; process.stderr.write(chunk) })
    child.on('error', reject)
    child.on('exit', code => resolve({ code, stdout, stderr }))
  })
  await writeFile(`${output}/original-stress.stdout.log`, result.stdout)
  await writeFile(`${output}/original-stress.stderr.log`, result.stderr)
  for (const name of names) {
    try { await writeFile(`${output}/${name}`, await readFile(`${previous}/${name}`)) }
    catch (error) { if (error.code !== 'ENOENT') throw error }
  }
  const childReport = JSON.parse(await readFile(`${output}/focused-Production-stress.json`, 'utf8'))
  report.originalStress = { exit: result.code, runnerUnmodified: true, report: childReport }
  assert.equal(result.code, 0, 'Original performance runner must exit successfully; its failed report is retained')
  assert.equal(childReport.reports.length, 1); assert.equal(childReport.reports[0].passed, true)
  assert.equal(childReport.performance.fixtureId, 'stress-v1')
  assert.equal(childReport.performance.editMilliseconds.length, 20); assert.equal(childReport.performance.layoutMilliseconds.length, 10)
  assert.ok(childReport.performance.p95Milliseconds <= 100)
  assert.ok(childReport.performance.layoutMilliseconds.every(value => value <= 2000))
  assert.equal(childReport.errors.length, 0); assert.equal(childReport.resourceFailures.length, 0)
  return { runner: 'unchanged verify-v1.mjs', fixtureEntities: 100, fixtureEdges: 150, acceptedCommits: 30, performance: childReport.performance }
}

async function integrity() {
  const result = {}
  const walk = async directory => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = `${directory}/${entry.name}`
      if (entry.isDirectory()) await walk(path)
      else result[path.replace(root, '')] = createHash('sha256').update(await readFile(path)).digest('hex')
    }
  }
  for (const directory of ['src', 'electron', '../docs/specs']) await walk(`${root}${directory}`)
  for (const name of ['package.json', 'package-lock.json', 'vite.config.ts', 'vitest.config.ts', 'scripts/verify-v1.mjs', 'scripts/verify-sprint2.mjs', '../docs/lessons.md']) result[name] = createHash('sha256').update(await readFile(`${root}${name}`)).digest('hex')
  return result
}
async function check(name, callback, settings = {}) {
  if (process.env.DGM_S3_CASE && !name.includes(process.env.DGM_S3_CASE)) return
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, acceptDownloads: true, reducedMotion: 'reduce', ...settings })
  const page = await context.newPage(); page.setDefaultTimeout(12000)
  page.on('dialog', dialog => void dialog.accept())
  page.on('pageerror', error => { if (!error.message.startsWith('ResizeObserver loop')) report.errors.push({ name, error: error.message }) })
  page.on('request', request => { if (/^https?:/.test(request.url()) && new URL(request.url()).origin !== new URL(base).origin) report.remoteRequests.push(request.url()) })
  page.on('response', response => { if (response.status() >= 400) report.resources.push({ url: response.url(), status: response.status() }) })
  try {
    await page.goto(base)
    await page.waitForFunction(() => document.querySelector('button[aria-label="New diagram"]')?.disabled === false)
    await saved(page); await page.evaluate(() => document.fonts.ready)
    const evidence = await callback(page, context)
    report.cases.push({ name, status: 'PASS', evidence }); console.log(`PASS ${name}`)
  } catch (error) {
    await page.screenshot({ path: `${output}/failure-${name.replace(/[^a-z0-9]/gi, '-')}.png` }).catch(() => {})
    await writeFile(`${output}/failure-${name.replace(/[^a-z0-9]/gi, '-')}.html`, await page.content()).catch(() => {})
    report.cases.push({ name, status: 'FAIL', error: error.stack }); console.error(`FAIL ${name}: ${error.message}`)
  } finally { await context.close() }
}

try {
  await mkdir(output, { recursive: true })
  const baseline = await integrity()
  await writeFile(`${output}/protected-baseline.json`, JSON.stringify(baseline, null, 2))
  server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  base = server.resolvedUrls.local[0]; report.url = base
  browser = await chromium.launch({ channel: 'msedge', headless: true }); report.browser = browser.version()
  report.build = Object.fromEntries(await Promise.all((await readdir(`${root}dist/assets`)).filter(name => /^(index-|elk-worker)/.test(name)).map(async name => [name, createHash('sha256').update(await readFile(`${root}dist/assets/${name}`)).digest('hex')])))
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 720, height: 450 }]) for (const theme of ['light', 'dark']) {
    await check(`Background ${viewport.width} ${theme}`, async page => {
      await open(page, fixture())
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
      await frames(page)
      assert.equal(await page.locator('html').getAttribute('data-theme'), theme)
      const original = await canonical(page, `${viewport.width}-${theme}-background-before`)
      const outputs = []
      for (const color of ['#101010', '#ff0000', '#ffff00']) {
        await properties(page)
        await field(page, 'Background hex color', color)
        const changed = await durable(page)
        assert.equal(changed.backgroundColor, color); assert.equal(changed.revision, original.revision + 1)
        assert.deepEqual(changed.entities, original.entities); assert.deepEqual(changed.connections, original.connections)
        await closePanels(page)
        const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16))
        assert.equal(await page.locator('.canvas-surface').evaluate(element => getComputedStyle(element).backgroundColor), `rgb(${rgb.join(', ')})`)
        await page.screenshot({ path: `${output}/${viewport.width}-${theme}-${color.slice(1)}-canvas.png` })
        await button(page, 'Present').click()
        assert.equal(await page.locator('.canvas-surface').evaluate(element => getComputedStyle(element).backgroundColor), `rgb(${rgb.join(', ')})`)
        assert.equal(await page.locator('.react-flow__background').count(), 0)
        await page.screenshot({ path: `${output}/${viewport.width}-${theme}-${color.slice(1)}-present.png` })
        await button(page, 'Exit presentation').click()
        const opaque = await exportFile(page, {}, `${viewport.width}-${theme}-${color.slice(1)}-opaque`)
        const transparent = await exportFile(page, { transparent: true, scale: 2 }, `${viewport.width}-${theme}-${color.slice(1)}-transparent`)
        const first = await pixels(page, opaque.bytes), second = await pixels(page, transparent.bytes)
        assert.deepEqual(first.corner, [...rgb, 255]); assert.equal(second.corner[3], 0)
        assert.equal(second.width, first.width * 2); assert.equal(second.height, first.height * 2)
        assert.ok(first.ink > 1000 && second.alpha > 1000 && second.alpha < second.width * second.height)
        const vector = await exportFile(page, { svg: true }, `${viewport.width}-${theme}-${color.slice(1)}-vector`)
        const contrast = await contrastMeasurements(page, vector.bytes.toString(), changed)
        for (const item of contrast) assert.ok(item.ratio >= 4.5, `${item.id} contrast ${item.ratio} on ${color}`)
        assert.deepEqual(await canonical(page, `${viewport.width}-${theme}-background-after-export`), changed)
        await page.reload(); await saved(page)
        assert.deepEqual(await durable(page), changed)
        await open(page, original)
        await properties(page); await field(page, 'Background hex color', color)
        await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        await closePanels(page)
        outputs.push({ color, opaque: first, transparent: second, contrast, exactUndo: true, reload: true })
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
      return { viewport, theme, outputs, geometryAndRoutesUnchanged: true }
    }, { viewport, deviceScaleFactor: viewport.width === 720 ? 2 : 1, hasTouch: viewport.width === 390 })
    await check(`Grid ${viewport.width} ${theme}`, async page => {
      await open(page, fixture())
      if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
      const combinations = []
      await properties(page)
      for (const style of ['Dots', 'Lines']) for (const visible of [true, false]) for (const snap of [true, false]) {
        await button(page, `${style} grid`).click()
        await page.getByLabel('Show grid', { exact: true }).setChecked(visible)
        await page.getByLabel('Snap to grid', { exact: true }).setChecked(snap)
        await saved(page); await frames(page)
        assert.equal(await page.locator('.react-flow__background').count(), visible ? 1 : 0)
        let measured = null
        if (visible) { measured = await phase(page); assert.ok(measured.x < .01 && measured.y < .01); assert.ok(Math.abs(measured.spacing - 16) < .001) }
        assert.deepEqual((await durable(page)).entities, fixture().entities)
        combinations.push({ style, visible, snap, phase: measured })
      }
      await field(page, 'Grid spacing', '15.5')
      assert.equal(await page.getByLabel('Grid spacing', { exact: true }).getAttribute('aria-invalid'), 'true')
      assert.equal((await durable(page)).grid.spacing, 16)
      await page.getByLabel('Grid spacing', { exact: true }).press('Escape')
      await page.getByLabel('Show grid in Present', { exact: true }).check()
      await page.getByLabel('Include grid in exports', { exact: true }).check()
      await saved(page)
      const settings = await canonical(page, `${viewport.width}-${theme}-grid-settings`)
      await closePanels(page); await button(page, 'Present').click()
      await settled(page)
      assert.equal(await page.locator('.react-flow__background').count(), 1)
      const presentPhase = await phase(page); assert.ok(presentPhase.x < .01 && presentPhase.y < .01, `Settled Present grid phase: ${JSON.stringify(presentPhase)}`)
      await page.screenshot({ path: `${output}/${viewport.width}-${theme}-grid-present.png` })
      await button(page, 'Exit presentation').click()
      assert.equal(await page.locator('.react-flow__background').count(), 0)
      await page.reload(); await saved(page); assert.deepEqual(await durable(page), settings)
      const gestures = []
      for (const snap of [true, false]) {
        const original = fixture({ grid: { visible: true, style: 'dots', spacing: 16, snap, present: false, export: false } })
        await open(page, original)
        await select(page, 'child')
        const moved = await drag(page, 'child', 47, 39), point = absolutePosition(moved, 'child')
        if (snap) { assert.equal(Math.abs(point.x % 16), 0); assert.equal(Math.abs(point.y % 16), 0) }
        else assert.ok(point.x % 8 !== 0 && point.y % 8 !== 0)
        await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        await select(page, 'outer')
        const grouped = await drag(page, 'outer', 39, 27)
        for (const id of ['inner', 'child', 'target', 'nested-note']) {
          const before = original.entities.find(item => item.id === id), after = grouped.entities.find(item => item.id === id)
          assert.equal(after.x, before.x); assert.equal(after.y, before.y)
        }
        await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        const node = await select(page, 'child'); await node.focus()
        await node.press('ArrowRight'); await saved(page)
        const nudged = await durable(page), nudgedPoint = absolutePosition(nudged, 'child'), beforePoint = absolutePosition(original, 'child')
        assert.ok(nudgedPoint.x === (snap ? Math.round((beforePoint.x + 16) / 16) * 16 : beforePoint.x + 8))
        await node.press('Shift+ArrowRight'); await saved(page)
        assert.equal(absolutePosition(await durable(page), 'child').x, nudgedPoint.x + 64)
        await button(page, 'Undo').click(); await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        const parent = await select(page, 'outer'); await parent.focus()
        await parent.press('Control+c'); await parent.press('Control+v'); await saved(page)
        const pasted = await durable(page), added = pasted.entities.filter(item => !original.entities.some(before => before.id === item.id))
        assert.equal(added.length, 5)
        const pastedRoot = added.find(item => item.label === 'Outer boundary'), pastedPoint = absolutePosition(pasted, pastedRoot.id)
        if (snap) { assert.equal(Math.abs(pastedPoint.x % 16), 0); assert.equal(Math.abs(pastedPoint.y % 16), 0) }
        for (const id of ['inner', 'child', 'target', 'nested-note']) {
          const before = original.entities.find(item => item.id === id), after = added.find(item => item.label === before.label)
          assert.equal(after.x, before.x); assert.equal(after.y, before.y)
        }
        assert.equal(pasted.connections.length, original.connections.length + 1)
        await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        await select(page, 'inner'); await fit(page, true)
        const handle = await page.locator('.react-flow__node[data-id="inner"] .react-flow__resize-control.bottom.right.handle').boundingBox()
        assert.ok(handle)
        await page.mouse.move(handle.x + handle.width / 2, handle.y + handle.height / 2); await page.mouse.down()
        await page.mouse.move(handle.x + handle.width / 2 + 37, handle.y + handle.height / 2 + 29, { steps: 12 }); await page.mouse.up(); await saved(page)
        const resized = await durable(page), size = resized.entities.find(item => item.id === 'inner'), origin = absolutePosition(resized, 'inner')
        assert.equal(resized.revision, original.revision + 1)
        assert.deepEqual(absolutePosition(resized, 'child'), absolutePosition(original, 'child'))
        if (snap) { assert.equal(Math.abs((origin.x + size.width) % 16), 0); assert.equal(Math.abs((origin.y + size.height) % 16), 0) }
        await page.screenshot({ path: `${output}/${viewport.width}-${theme}-grid-${snap ? 'on' : 'off'}-resize.png` })
        await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        await library(page)
        const search = page.locator('.library').getByRole('textbox', { name: 'Search components' })
        await search.fill('APIM')
        const dropPoint = await panePoint(page), pane = await page.locator('.react-flow__pane').boundingBox()
        await page.locator('.library-item[data-icon="azure-api"]').first().dragTo(page.locator('.react-flow__pane'), { targetPosition: { x: dropPoint.x - pane.x, y: dropPoint.y - pane.y } })
        await saved(page)
        const dropped = await durable(page), drop = dropped.entities.find(item => !original.entities.some(before => before.id === item.id))
        assert.ok(drop, 'Real palette drag must insert one component'); assert.equal(drop.parentId, null)
        if (snap) { assert.equal(Math.abs(drop.x % 16), 0); assert.equal(Math.abs(drop.y % 16), 0) }
        else assert.ok(drop.x % 8 !== 0 || drop.y % 8 !== 0)
        await closePanels(page); await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        gestures.push({ snap, moved: point, nudged: nudgedPoint, pastedRoot: pastedPoint, resized: { width: size.width, height: size.height }, exactUndo: true })
      }
      return { viewport, theme, combinations, presentPhase, gestures, reload: true }
    }, { viewport, deviceScaleFactor: viewport.width === 720 ? 2 : 1, hasTouch: viewport.width === 390 })
      await check(`Search and quick-add ${viewport.width} ${theme}`, async page => {
        const original = fixture({ grid: { visible: true, style: 'dots', spacing: 16, snap: true, present: false, export: false } })
        await open(page, original)
        if (await page.locator('html').getAttribute('data-theme') !== theme) await page.getByRole('button', { name: /Switch to .* theme/ }).click()
        await library(page)
        const search = page.locator('.library').getByRole('textbox', { name: 'Search components' })
        for (const [query, icon] of [['APIM', 'azure-api'], ['AAD', 'azure-entra'], ['Entra ID', 'azure-entra'], ['ACA', 'azure-container-apps']]) {
          await search.fill(query)
          assert.equal(await page.locator('.library .library-item').first().getAttribute('data-icon'), icon)
        }
        await search.fill('APIM'); await search.press('ArrowDown')
        assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-icon')), 'azure-api')
        await page.keyboard.press('ArrowUp'); await page.keyboard.press('Escape')
        assert.equal(await search.evaluate(element => document.activeElement === element), true)
        assert.deepEqual(await durable(page), original)
        assert.equal(await page.getByRole('region', { name: 'Recent components' }).count(), 0)
        await search.fill('APIM')
        await button(page.locator('.library'), 'Add API Management to favorites').focus(); await page.keyboard.press('Enter')
        await search.press('Escape')
        assert.equal(await page.getByRole('region', { name: 'Favorite components' }).count(), 1)
        assert.deepEqual(await durable(page), original)
        await search.fill('APIM'); await search.press('Enter'); await closePanels(page)
        assert.deepEqual(await durable(page), original)
        await page.locator('.canvas-surface').focus(); await page.keyboard.press('Escape')
        await library(page); await search.press('Escape')
        assert.equal(await page.getByRole('region', { name: 'Recent components' }).count(), 0)
        await search.fill('APIM'); await search.press('Enter'); await closePanels(page)
        const target = await panePoint(page)
        await page.mouse.click(target.x, target.y); await saved(page)
        const inserted = await durable(page), added = inserted.entities.find(item => !original.entities.some(before => before.id === item.id))
        assert.equal(added.icon, 'azure-api'); assert.equal(inserted.revision, original.revision + 1)
        assert.equal(Math.abs(added.x % 16), 0); assert.equal(Math.abs(added.y % 16), 0)
        await library(page); await search.press('Escape')
        assert.equal(await page.getByRole('region', { name: 'Recent components' }).count(), 1)
        await button(page, 'Clear favorite components').click()
        assert.equal(await page.getByRole('region', { name: 'Favorite components' }).count(), 0)
        await button(page, 'Clear recent components').click()
        assert.equal(await page.getByRole('region', { name: 'Recent components' }).count(), 0)
        await closePanels(page); await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        await select(page, 'internal-link', true); await library(page)
        await search.fill('APIM'); await search.press('Enter'); await closePanels(page)
        assert.deepEqual(await durable(page), original)
        await page.locator('.canvas-surface').focus(); await page.keyboard.press('Escape')
        const directions = []
        for (const [index, side] of ['left', 'right', 'top', 'bottom'].entries()) {
          await select(page, 'child'); await fit(page, true)
          const trigger = button(page, `Add connected component ${side}`)
          const bounds = await trigger.boundingBox(); assert.ok(bounds.width >= 44 && bounds.height >= 44)
          await trigger.click()
          const picker = page.getByRole('dialog', { name: /Child service/ })
          await picker.getByRole('textbox', { name: 'Search components' }).press('Escape')
          assert.deepEqual(await durable(page), original)
          const start = performance.now()
          await trigger.click(); await picker.getByRole('textbox', { name: 'Search components' }).fill('APIM')
          assert.equal(await picker.locator('.library-item').first().getAttribute('data-icon'), 'azure-api')
          await page.screenshot({ path: `${output}/${viewport.width}-${theme}-${side}-picker.png` })
          if (index % 2) await picker.getByRole('textbox', { name: 'Search components' }).press('Enter')
          else await button(picker, 'Insert API Management').click()
          await saved(page)
          const connected = await canonical(page, `${viewport.width}-${theme}-${side}-added`)
          const entity = connected.entities.find(item => !original.entities.some(before => before.id === item.id))
          const edge = connected.connections.find(item => !original.connections.some(before => before.id === item.id))
          assert.equal(connected.revision, original.revision + 1)
          assert.equal(entity.parentId, 'inner'); assert.equal(entity.icon, 'azure-api')
          assert.equal(edge.from, 'child'); assert.equal(edge.to, entity.id); assert.equal(edge.sourceSide, side)
          assert.equal(edge.targetSide, { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[side])
          assert.equal(connected.entities.length, original.entities.length + 1); assert.equal(connected.connections.length, original.connections.length + 1)
          for (const before of original.entities.filter(item => !['inner', 'outer'].includes(item.id))) {
            assert.deepEqual(absolutePosition(connected, before.id), absolutePosition(original, before.id))
            const after = connected.entities.find(item => item.id === before.id)
            assert.deepEqual({ ...after, x: before.x, y: before.y }, before)
          }
          const point = absolutePosition(connected, entity.id)
          assert.equal(Math.abs(point.x % 16), 0); assert.equal(Math.abs(point.y % 16), 0)
          const elapsedMs = performance.now() - start
          await fit(page); await page.screenshot({ path: `${output}/${viewport.width}-${theme}-${side}-added.png` })
          await button(page, 'Undo').click(); assert.deepEqual(await canonical(page, `${viewport.width}-${theme}-${side}-undo`), original)
          directions.push({ side, activation: index % 2 ? 'Enter' : 'pointer', elapsedMs, addedPoint: point, ancestorOrigins: connected.entities.filter(item => ['inner', 'outer'].includes(item.id)).map(item => ({ id: item.id, x: item.x, y: item.y })), stationaryContents: true, exactUndo: true })
        }
        await select(page, 'inner'); await fit(page, true)
        await button(page, 'Add connected component right').click()
        const picker = page.getByRole('dialog', { name: /Nested boundary/ })
        await picker.getByRole('textbox', { name: 'Search components' }).fill('APIM'); await picker.getByRole('textbox', { name: 'Search components' }).press('Enter'); await saved(page)
        const inside = await durable(page), entity = inside.entities.find(item => !original.entities.some(before => before.id === item.id))
        assert.equal(entity.parentId, 'inner'); assert.ok(entity.y >= 48)
        await button(page, 'Undo').click(); assert.deepEqual(await durable(page), original)
        await select(page, 'child'); await fit(page, true); await button(page, 'Add connected component right').click()
        await page.getByLabel('Open document file').setInputFiles({ name: 'replacement.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture({ id: 'replacement', title: 'Replacement diagram' }))) })
        await saved(page)
        assert.equal(await page.getByRole('dialog').count(), 0)
        const replacement = await durable(page); assert.equal(replacement.id, 'replacement'); assert.equal(replacement.entities.length, original.entities.length)
        await page.reload(); await saved(page); await library(page)
        assert.equal(await page.getByRole('region', { name: 'Favorite components' }).count(), 0)
        assert.equal(await page.getByRole('region', { name: 'Recent components' }).count(), 0)
        return { viewport, theme, aliases: 4, keyboardFavorites: true, confirmedOnlyRecents: true, selectedEdgeNoImplicitInsertion: true, directions, boundaryChild: true, staleCanceled: true, sessionOnly: true }
      }, { viewport, deviceScaleFactor: viewport.width === 720 ? 2 : 1, hasTouch: viewport.width === 390 })
    }
  for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }, { width: 720, height: 450 }]) for (const theme of ['light', 'dark']) {
    const settings = { viewport, deviceScaleFactor: viewport.width === 720 ? 2 : 1, hasTouch: viewport.width === 390 }
    await check(`Direct editing ${viewport.width} ${theme}`, page => directChecks(page, viewport, theme), settings)
    await check(`Export clipboard ${viewport.width} ${theme}`, (page, context) => exportChecks(page, context, viewport, theme), { ...settings, permissions: ['clipboard-read', 'clipboard-write'] })
    await check(`Readonly ${viewport.width} ${theme}`, (page, context) => readOnlyChecks(page, context, viewport, theme), settings)
  }
  await check('Grid PNG pixels zero-origin negative-crop 1x 2x', gridPixelChecks)
  await check('Background native hex reset one-undo', backgroundControlChecks)
  await check('Production stress original unchanged 100 entities 150 edges', originalStress)
  const after = await integrity()
  report.protectedFiles = Object.keys(baseline).length
  report.protectedChanges = Object.keys({ ...baseline, ...after }).filter(name => baseline[name] !== after[name])
  assert.deepEqual(report.protectedChanges, [])
} finally {
  await browser?.close()
  if (server) await new Promise(resolve => server.httpServer.close(resolve))
  report.cleanup = { ownedBrowserClosed: !browser?.isConnected(), ownedPreviewClosed: !server?.httpServer.listening, existingPortsUntouched: [5174, 5186, 5198] }
  report.totals = { pass: report.cases.filter(item => item.status === 'PASS').length, fail: report.cases.filter(item => item.status === 'FAIL').length, total: report.cases.length }
  const prefix = process.env.DGM_S3_CASE ? `focused-${process.env.DGM_S3_CASE.replace(/[^a-z0-9]/gi, '-')}-` : ''
  await writeFile(`${output}/${prefix}browser-report.json`, JSON.stringify(report, null, 2))
  console.log(`SPRINT3_TOTAL ${JSON.stringify(report.totals)}; cleanup=${JSON.stringify(report.cleanup)}`)
  if (report.totals.fail || report.errors.length || report.resources.length || report.remoteRequests.length) process.exitCode = 1
}