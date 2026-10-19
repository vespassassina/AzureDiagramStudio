import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer, preview } from 'vite'
import { allLibraryItems, azureLibrary, fabricLibrary, genericLibrary, vendorLibrary, microsoftLibrary } from '../src/catalog.ts'

const root = fileURLToPath(new URL('../', import.meta.url))
const policyLoader = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' })
let policy
try { policy = await policyLoader.ssrLoadModule('/src/catalog/presentation.ts') }
finally { await policyLoader.close() }
const { isSelectableIcon, legacyItem, menuGroups, searchGroups, selectionLibrary } = policy
const output = process.env.DGM_CATALOG_OUTPUT ?? fileURLToPath(new URL('../test-results/catalog/', import.meta.url))
const labels = { azure: 'Azure / Microsoft', software: 'Software' }
const sorted = items => [...items].sort()
const rows = page => page.locator('.library-item')
const editorialPins = [
  ['App Service', 'Azure Functions', 'Virtual Machines', 'AKS'],
  ['Virtual Network', 'Front Door', 'Application Gateway', 'Load Balancer'],
  ['Storage account', 'SQL Database', 'Cosmos DB', 'Azure Database for PostgreSQL'],
  ['Azure OpenAI', 'Azure Machine Learning', 'Azure AI Search', 'Azure Databricks'],
  ['API Management', 'Service Bus', 'Event Hubs', 'Logic Apps'],
  ['Microsoft Entra ID', 'Key Vault', 'Azure Monitor', 'Defender for Cloud'],
  ['OneLake', 'Lakehouse', 'Warehouse', 'Data pipeline'],
  ['microsoft-sharepoint', 'microsoft-teams', 'microsoft-m365', 'microsoft-copilot'].map(icon => microsoftLibrary.find(item => item.icon === icon).label),
]
export const expectedSearchIcons = query => searchGroups(query).flatMap(group => group.items.map(item => item.icon))

export async function assertCatalogSearch(page, query) {
  await page.getByLabel('Search components', { exact: true }).fill(query)
  const icons = await rows(page).evaluateAll(elements => elements.map(element => element.dataset.icon))
  assert.deepEqual(sorted(icons), sorted(expectedSearchIcons(query)), `Exact global results for ${query}`)
  assert.equal(new Set(icons).size, icons.length, `Unique global keys for ${query}`)
  assert.equal(await page.locator('.catalog-group-toggle[aria-expanded="false"]').count(), 0)
  await page.waitForFunction(() => [...document.querySelectorAll('.library img')].every(image => image.complete && image.naturalWidth > 0))
}

export async function catalogCoverage() {
  const legacy = JSON.parse(await readFile(new URL('../src/catalog/legacy.json', import.meta.url), 'utf8'))
  const inventory = JSON.parse(await readFile(new URL('../src/catalog/inventory.json', import.meta.url), 'utf8'))
  assert.equal(legacy.length, 24)
  for (const [catalog, items] of [['azure', azureLibrary], ['fabric', fabricLibrary]]) {
    const archivedItems = items.filter(item => item.source.url === inventory.archives[catalog].url)
    const entries = new Set(archivedItems.flatMap(item => item.source.entries ?? [item.source.entry]))
    assert.equal(entries.size, inventory.archives[catalog].entryCount, `Every ${catalog} archive entry mapped`)
    assert.equal(archivedItems.length, inventory.archives[catalog].uniqueItemCount, `Every unique ${catalog} archive glyph mapped`)
    for (const item of items) {
      const bytes = await readFile(new URL(`../src/assets/${catalog}/${item.icon}.svg`, import.meta.url))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.source.sha256, `Official source glyph ${item.icon}`)
      assert.ok(item.label.length <= 120 && item.subtitle.length <= 200, `Direct placement fits document limits: ${item.icon}`)
    }
  }
  for (const old of legacy) {
    const item = azureLibrary.find(item => item.icon === old.icon)
    assert.ok(item, `Legacy key ${old.icon}`)
    for (const field of ['label', 'subtitle', 'color']) assert.equal(item[field], old[field])
    const bytes = await readFile(new URL(`../src/assets/azure/${old.icon}.svg`, import.meta.url))
    assert.equal(createHash('sha256').update(bytes).digest('hex'), old.sha256, `Unchanged legacy glyph ${old.icon}`)
  }
  assert.equal(new Set(allLibraryItems.map(item => item.icon)).size, allLibraryItems.length)
  assert.equal(azureLibrary.length + fabricLibrary.length + genericLibrary.length, 2235, 'All original raw keys remain')
  assert.equal(vendorLibrary.length, 17)
  assert.equal(microsoftLibrary.length, 14)
  for (const [directory, items] of [['vendor-icons', vendorLibrary], ['microsoft-icons', microsoftLibrary]]) {
    const registered = JSON.parse(await readFile(new URL(`../src/${directory}/catalog.generated.json`, import.meta.url), 'utf8'))
    const assets = JSON.parse(await readFile(new URL(`../src/${directory}/assets.generated.json`, import.meta.url), 'utf8'))
    assert.deepEqual(items, registered, `${directory}: exact registered provenance and keys`)
    assert.deepEqual(sorted(Object.keys(assets)), sorted(items.map(item => item.icon)), `${directory}: exact artwork mapping`)
    for (const item of items) {
      const uri = assets[item.icon]
      const separator = uri.indexOf(',')
      assert.match(uri.slice(0, separator), /^data:image\/(svg\+xml|png)(;charset=utf-8)?(;base64)?$/)
      const bytes = uri.slice(0, separator).endsWith(';base64') ? Buffer.from(uri.slice(separator + 1), 'base64') : Buffer.from(decodeURIComponent(uri.slice(separator + 1)))
      assert.equal(createHash('sha256').update(bytes).digest('hex'), item.source.sha256, `${directory}: exact source bytes ${item.icon}`)
      assert.equal(allLibraryItems.filter(candidate => candidate.icon === item.icon).length, 1)
      assert.equal(selectionLibrary.filter(candidate => candidate.icon === item.icon).length, 1)
    }
  }
  assert.equal(allLibraryItems.length, 2235 + vendorLibrary.length + microsoftLibrary.length)
  assert.equal(selectionLibrary.length, 665 + vendorLibrary.length + microsoftLibrary.length)
  return { azure: azureLibrary.length, fabric: fabricLibrary.length, software: genericLibrary.length, vendors: vendorLibrary.length, microsoft: microsoftLibrary.length, total: allLibraryItems.length, selection: selectionLibrary.length, azureMenuGroups: menuGroups('azure').length, archives: inventory.archives, legacy: legacy.map(item => item.icon) }
}

async function assertOptions(page, label) {
  const expected = searchGroups('').map(group => ({
    label: `${labels[group.catalog]}: ${group.label}`,
    icons: group.items.map(item => item.icon),
  }))
  const select = page.getByLabel(label, { exact: true })
  const current = await select.inputValue()
  const legacy = label === 'Component type' && !isSelectableIcon(current) ? legacyItem(current) : undefined
  assert.deepEqual(await select.locator('optgroup').evaluateAll(groups => groups.map(group => ({ label: group.label, icons: [...group.querySelectorAll('option')].map(option => option.value) }))), expected, `${label}: exact groups and deduplicated placements`)
  assert.deepEqual(sorted(await select.locator('option').evaluateAll(options => options.map(option => option.value))), sorted([...selectionLibrary.map(item => item.icon), ...(legacy ? [legacy.icon] : [])]), `${label}: exact selectable keys plus only the saved legacy value`)
  if (legacy) assert.equal(await select.locator('option:checked').textContent(), `${legacy.label} (Saved legacy icon)`)
}

export async function selectConnection(page) {
  const picker = page.getByRole('dialog').filter({ has: page.getByRole('button', { name: 'Cancel component picker', exact: true }) })
  if (await picker.isVisible()) {
    await picker.press('Escape')
    await picker.waitFor({ state: 'detached' })
  }
  await closePanels(page)
  const edge = page.locator('.react-flow__edge[data-id="route"]')
  assert.equal(await edge.count(), 1, 'Exactly one route connection must be rendered for real connection selection')
  // Clear the previous component selection through the canvas. Its quick-action
  // toolbar otherwise covers this short route; this must not mutate the fixture.
  const background = await page.locator('.react-flow__pane').evaluate(pane => {
    const box = pane.getBoundingClientRect()
    for (let y = box.top + 2; y < box.bottom; y += 32) {
      for (let x = box.left + 2; x < box.right; x += 32) {
        if (document.elementFromPoint(x, y) === pane) return { x, y }
      }
    }
  })
  assert.ok(background, 'A visible canvas point is available to clear prior selection')
  await page.mouse.click(background.x, background.y)
  await page.waitForFunction(() => !document.querySelector('.react-flow__node.selected, .react-flow__edge.selected'))
  const point = await edge.evaluate(edge => {
    const selectable = (x, y) => {
      const hit = document.elementFromPoint(x, y)
      return hit?.closest('.react-flow__edge') === edge && !hit.closest('.react-flow__edgeupdater')
    }
    // Labels bubble clicks to the same EdgeWrapper selection handler as the stroke.
    // Probe their actual painted area: the selected-node toolbar can cover the center.
    for (const label of edge.querySelectorAll('text')) {
      const box = label.getBoundingClientRect()
      for (let y = box.top + 1; y < box.bottom; y += 2) {
        for (let x = box.left + 1; x < box.right; x += 2) {
          if (selectable(x, y)) return { x, y }
        }
      }
    }
    const path = edge.querySelector('.react-flow__edge-interaction')
    const length = path.getTotalLength()
    for (let distance = 0; distance <= length; distance += 1) {
      const local = path.getPointAtLength(distance)
      const screen = new DOMPoint(local.x, local.y).matrixTransform(path.getScreenCTM())
      if (selectable(screen.x, screen.y)) return { x: screen.x, y: screen.y }
    }
  })
  assert.ok(point, 'A visible route point is available for real connection selection')
  await page.mouse.click(point.x, point.y)
  await page.waitForFunction(() => {
    const selected = [...document.querySelectorAll('.react-flow__edge.selected')]
    return selected.length === 1 && selected[0].dataset.id === 'route' && !document.querySelector('.react-flow__node.selected')
  })
  if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
}

export async function verifyCatalogPalette(page) {
  const legacy = JSON.parse(await readFile(new URL('../src/catalog/legacy.json', import.meta.url), 'utf8'))
  const groups = menuGroups('azure')
  const initial = groups.find(group => group.items.some(item => item.icon === 'azure-app'))
  assert.ok(initial && initial.items.length >= 8 && initial.items.length <= 12)
  assert.equal(groups.length, 8)
  assert.deepEqual(groups.map(group => group.id), ['azure-compute', 'azure-networking', 'azure-storage-data', 'azure-ai-analytics', 'azure-integration', 'azure-security-management', 'azure-fabric', 'azure-microsoft-apps'])
  assert.deepEqual(await page.getByRole('tab').allTextContents(), ['azure', 'software'].map(catalog => `${labels[catalog]}${selectionLibrary.filter(item => catalog === 'azure' ? item.catalog !== 'software' : item.catalog === 'software').length}`))
  assert.deepEqual(await rows(page).evaluateAll(elements => elements.map(element => element.dataset.icon)), initial.items.map(item => item.icon), 'Only curated Compute menu mounts in policy order')
  assert.deepEqual(initial.items.slice(0, 4).map(item => item.icon), ['azure-app', 'azure-function', 'azure-vm', 'azure-aks'])
  assert.deepEqual(await page.locator('.catalog-group-toggle').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))), groups.map(group => `${labels.azure}: ${group.label} (${group.items.length})`), 'Exact compact policy counts')
  assert.ok((await page.locator('.catalog-group-toggle').evaluateAll(elements => elements.map(element => element.querySelectorAll('svg').length))).every(count => count === 2), 'Every header has a familiar icon and a chevron')
  for (const [index, group] of groups.entries()) {
    assert.deepEqual(group.items.slice(0, 4).map(item => item.label), editorialPins[index], `${group.label}: editorial top four`)
    assert.deepEqual(group.items.slice(4).map(item => item.label), [...group.items.slice(4)].sort((before, after) => before.label.localeCompare(after.label, 'en', { sensitivity: 'base', numeric: true })).map(item => item.label), `${group.label}: alphabetical tail`)
  }
  const state = () => page.locator('.catalog-group-toggle').evaluateAll(elements => elements.map(element => [element.getAttribute('aria-label'), element.getAttribute('aria-expanded')]))
  const before = await state()
  const header = page.getByRole('button', { name: `${labels.azure}: ${initial.label} (${initial.items.length})`, exact: true })
  const rowsId = await header.getAttribute('aria-controls')
  await header.focus(); await header.press('Enter')
  assert.equal(await header.getAttribute('aria-expanded'), 'false')
  assert.equal(await page.evaluate(id => document.getElementById(id) === null, rowsId), true, 'Closed rows are unmounted')
  await header.press('Space')
  assert.deepEqual(await state(), before)
  const closed = groups.find(group => group.id !== initial.id)
  const second = page.getByRole('button', { name: `${labels.azure}: ${closed.label} (${closed.items.length})`, exact: true })
  await second.click()
  assert.equal(await header.getAttribute('aria-expanded'), 'true')
  assert.equal(await second.getAttribute('aria-expanded'), 'true')
  const expanded = await state()
  for (const query of new Set(['OneLake', 'Lakehouse', 'KQL', 'pipeline', 'PostgreSQL', 'Entra', closed.label, ...legacy.map(item => item.label)])) await assertCatalogSearch(page, query)
  await page.getByLabel('Search components', { exact: true }).fill('')
  assert.deepEqual(await state(), expanded, 'Clearing restores previous open groups')
  await second.click()
  const fabric = groups.find(group => group.label === 'Microsoft Fabric')
  assert.ok(fabric)
  const fabricHeader = page.getByRole('button', { name: `${labels.azure}: ${fabric.label} (${fabric.items.length})`, exact: true })
  assert.equal(await fabricHeader.getAttribute('aria-expanded'), 'false')
  await fabricHeader.click()
  const fabricRows = await fabricHeader.getAttribute('aria-controls')
  assert.deepEqual(await page.evaluate(id => [...document.getElementById(id).querySelectorAll('.library-item')].map(element => element.dataset.icon), fabricRows), fabric.items.map(item => item.icon))
  assert.deepEqual(fabric.items.slice(0, 4).map(item => item.label.toLowerCase()), ['onelake', 'lakehouse', 'warehouse', 'data pipeline'])
  await fabricHeader.click()
  await page.getByRole('tab', { name: /^Software/ }).click()
  assert.deepEqual(menuGroups('software').map(group => group.id), ['software-components', 'software-vendors'])
  assert.deepEqual(await page.locator('.catalog-group-toggle').evaluateAll(elements => elements.map(element => element.getAttribute('aria-label'))), menuGroups('software').map(group => `${labels.software}: ${group.label} (${group.items.length})`))
  assert.deepEqual(await rows(page).evaluateAll(elements => elements.map(element => element.dataset.icon)), menuGroups('software').flatMap(group => group.items.map(item => item.icon)))
  await assertCatalogSearch(page, 'OneLake')
  const oneLake = selectionLibrary.find(item => item.label === 'OneLake')
  assert.equal(await page.locator(`.library-item[data-icon="${oneLake.icon}"]`).count(), 1, 'The preferred OneLake glyph appears exactly once among legitimate canonical matches')
  await assertCatalogSearch(page, 'Bonsai')
  assert.equal(await rows(page).count(), 0)
  assert.equal(await page.getByText('No matching components', { exact: true }).count(), 1)
  const menuKeys = new Set(groups.flatMap(group => group.items.map(item => item.icon)))
  const longtail = selectionLibrary.find(item => item.catalog === 'azure' && !menuKeys.has(item.icon))
  assert.ok(longtail)
  await assertCatalogSearch(page, longtail.label)
  assert.equal(await page.locator(`.library-item[data-icon="${longtail.icon}"]`).count(), 1)
  await page.getByRole('tab', { name: /^Azure/ }).click()
  await closePanels(page)
  await selectNode(page, 'app')
  if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
  await assertOptions(page, 'Component type')
  await selectConnection(page)
  await assertOptions(page, 'Insertion component')
  await closePanels(page)
  await page.locator('.react-flow__pane').click({ position: { x: 2, y: 2 } })
  await library(page)
}

async function library(page) {
  if (!(await page.locator('.library').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open component library', exact: true }).click()
}
async function closePanels(page) {
  for (const name of ['Close component library', 'Close properties']) if (await page.getByRole('button', { name, exact: true }).isVisible()) await page.getByRole('button', { name, exact: true }).click()
}
async function selectNode(page, id) {
  const target = page.locator(`.react-flow__node[data-id="${id}"]`)
  const box = await target.boundingBox()
  assert.ok(box && box.width > 0 && box.height > 0)
  await target.click({ position: { x: Math.min(20, box.width / 2), y: Math.min(20, box.height / 2) } })
}
async function saved(page) { await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device') }
async function download(page, action, name) {
  const pending = page.waitForEvent('download')
  await action()
  const file = await pending
  const path = `${output}/${name}`
  await file.saveAs(path)
  assert.equal(await file.failure(), null)
  return { path, bytes: await readFile(path) }
}
async function json(page, name) { await saved(page); const file = await download(page, () => page.getByRole('button', { name: 'Save JSON', exact: true }).click(), name); return { ...file, document: JSON.parse(file.bytes) } }
function absoluteRect(document, entity) {
  let x = entity.x, y = entity.y, parentId = entity.parentId
  const ancestors = new Set([entity.id])
  while (parentId) {
    assert.ok(!ancestors.has(parentId), `Acyclic parent chain for ${entity.id}`)
    ancestors.add(parentId)
    const parent = document.entities.find(candidate => candidate.id === parentId)
    assert.equal(parent?.kind, 'boundary')
    x += parent.x; y += parent.y; parentId = parent.parentId
  }
  return { x, y, right: x + entity.width, bottom: y + entity.height }
}
async function openFixture(page, fixture) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open JSON', exact: true }).click()
  await (await chooser).setFiles({ name: 'catalog-separated-probe.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(fixture)) })
  await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title, fixture.title)
  await saved(page)
}
function separatedFixture(document, ids, width) {
  const fixture = structuredClone(document)
  fixture.title = `Catalog separated probe ${width}`
  const original = fixture.entities.filter(entity => !ids.includes(entity.id))
  const right = Math.max(...original.map(entity => absoluteRect(fixture, entity).right))
  let y = 64
  for (const id of ids) {
    const entity = fixture.entities.find(candidate => candidate.id === id)
    entity.parentId = null; entity.x = Math.ceil((right + 160) / 8) * 8; entity.y = y
    y = Math.ceil((y + entity.height + 96) / 8) * 8
  }
  const retired = allLibraryItems.find(item => /bonsai/i.test(item.label) && !isSelectableIcon(item.icon))
  const variant = allLibraryItems.find(item => item.catalog === 'fabric' && /onelake/i.test(item.label) && !isSelectableIcon(item.icon))
  assert.ok(retired && variant)
  fixture.entities.find(entity => entity.id === 'app').icon = retired.icon
  fixture.entities.find(entity => entity.id === 'gateway').icon = variant.icon
  for (const id of ids) {
    const probe = fixture.entities.find(entity => entity.id === id)
    const box = absoluteRect(fixture, probe)
    for (const other of fixture.entities.filter(entity => entity.id !== id && entity.kind === 'component')) {
      const target = absoluteRect(fixture, other)
      assert.ok(box.x - target.right >= 64 || target.x - box.right >= 64 || box.y - target.bottom >= 64 || target.y - box.bottom >= 64, `Non-overlapping probe ${id} and ${other.id} with a 64px minimum gap`)
    }
  }
  return fixture
}
async function place(page, item, method, index, width) {
  await library(page)
  await assertCatalogSearch(page, item.label)
  const row = page.locator(`.library-item[data-icon="${item.icon}"]`).first()
  const count = await page.locator('.react-flow__node').count()
  if (method !== 'drag') { await row.click(); await closePanels(page) }
  const target = await page.locator('.react-flow__pane').evaluate((pane, index) => {
    const box = pane.getBoundingClientRect()
    const candidates = [{ x: box.width * .87, y: box.height * (.3 + index * .1) }]
    for (let y = 80; y < box.height - 80; y += 40) for (let x = box.width - 40; x > 40; x -= 40) candidates.push({ x, y })
    return candidates.find(point => document.elementFromPoint(box.x + point.x, box.y + point.y) === pane)
  }, index)
  assert.ok(target, 'A visible canvas point is available for real placement')
  if (method === 'drag') await row.dragTo(page.locator('.react-flow__pane'), { targetPosition: target })
  else await page.locator('.react-flow__pane').click({ position: target })
  await page.waitForFunction(count => document.querySelectorAll('.react-flow__node').length === count + 1, count)
  await saved(page)
  await closePanels(page)
  const placed = await json(page, `${width}-${index}-${item.icon}-ui-placement.json`)
  assert.equal(placed.document.entities.at(-1).icon, item.icon, `${method} placement retains the actual target icon before fixture arrangement`)
  assert.equal(placed.document.entities.at(-1).label, item.label)
  return placed.document.entities.at(-1).id
}
async function pixels(page, bytes, mime, regions = []) {
  return page.evaluate(async ({ base64, mime, regions }) => {
    const image = new Image()
    image.src = `data:${mime};base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const ink = region => {
      const bytes = context.getImageData(Math.round(region.x), Math.round(region.y), region.width, region.height).data
      let ink = 0
      for (let offset = 0; offset < bytes.length; offset += 4) if (bytes[offset + 3] > 0 && Math.min(bytes[offset], bytes[offset + 1], bytes[offset + 2]) < 220) ink++
      return ink
    }
    return { width: canvas.width, height: canvas.height, regions: regions.map(ink) }
  }, { base64: bytes.toString('base64'), mime, regions })
}
async function exportIcons(page, width) {
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const svg = await download(page, () => page.getByRole('button', { name: 'Export SVG', exact: true }).click(), `${width}-icons.svg`)
  assert.ok(!/<script|foreignObject|<image[^>]+(?:href|xlink:href)=["'](?:https?:|\/)/i.test(svg.bytes.toString()), 'SVG is native and self-contained')
  assert.ok(svg.bytes.toString().includes('@font-face'), 'SVG embeds its font')
  const regions = await page.evaluate(async source => {
    const svg = new DOMParser().parseFromString(source, 'image/svg+xml').documentElement
    const viewBox = svg.getAttribute('viewBox').split(' ').map(Number)
    const images = [...svg.querySelectorAll('image')]
    const regions = []
    for (const element of images) {
      const href = element.getAttribute('href')
      if (!href.startsWith('data:image/svg+xml')) throw new Error('External or missing glyph')
      const image = new Image(); image.src = href; await image.decode()
      if (!image.naturalWidth || !image.naturalHeight) throw new Error('Blank glyph dimensions')
      const canvas = document.createElement('canvas'); canvas.width = 28; canvas.height = 28
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0, 28, 28)
      const bytes = context.getImageData(0, 0, 28, 28).data
      let ink = 0
      for (let offset = 0; offset < bytes.length; offset += 4) if (bytes[offset + 3] > 0 && Math.min(bytes[offset], bytes[offset + 1], bytes[offset + 2]) < 220) ink++
      if (ink <= 5) throw new Error('Blank embedded official glyph')
      let x = Number(element.getAttribute('x')), y = Number(element.getAttribute('y'))
      const parentChain = []
      for (let parent = element.parentElement; parent && parent !== svg; parent = parent.parentElement) {
        const transform = parent.getAttribute('transform') ?? ''
        const translates = /translate\(\s*([-+.\deE]+)[ ,]+([-+.\deE]+)\s*\)/g
        if (transform.replace(translates, '').trim()) throw new Error(`Unsupported icon parent transform: ${transform}`)
        for (const position of transform.matchAll(translates)) { x += Number(position[1]); y += Number(position[2]); parentChain.push([Number(position[1]), Number(position[2])]) }
      }
      const region = { x: x - viewBox[0], y: y - viewBox[1], width: Number(element.getAttribute('width')), height: Number(element.getAttribute('height')), parentChain }
      if (region.x < 0 || region.y < 0 || region.x + region.width > viewBox[2] || region.y + region.height > viewBox[3]) throw new Error('Icon region outside the complete parent-chain bounds')
      regions.push(region)
    }
    return regions
  }, svg.bytes.toString())
  assert.ok(regions.length >= 3)
  const vector = await pixels(page, svg.bytes, 'image/svg+xml', regions)
  assert.ok(vector.regions.every(count => count > 5), `Every embedded official SVG icon has ink: ${JSON.stringify(vector.regions)}`)
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const png = await download(page, () => page.getByRole('button', { name: 'Export PNG 1x', exact: true }).click(), `${width}-icons.png`)
  const bitmap = await pixels(page, png.bytes, 'image/png', regions)
  assert.deepEqual([bitmap.width, bitmap.height], [vector.width, vector.height])
  assert.ok(bitmap.regions.every(count => count > 5), `Every official icon region survives PNG export: ${JSON.stringify(bitmap.regions)}`)
  assert.deepEqual(bitmap.regions, vector.regions, 'PNG preserves every official SVG glyph region')
  return { vector, bitmap, regions }
}

async function main() {
  const coverage = await catalogCoverage()
  await mkdir(output, { recursive: true })
  let server, browser
  const reports = []
  try {
    if (!process.env.DGM_CATALOG_URL) server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
    const url = process.env.DGM_CATALOG_URL ?? server.resolvedUrls.local[0]
    browser = await chromium.launch({ channel: 'msedge', headless: true })
    for (const viewport of [{ width: 1440, height: 900 }, { width: 1280, height: 720 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, acceptDownloads: true })
      const failures = []
      try {
        const page = await context.newPage()
        page.on('pageerror', error => { if (!error.message.startsWith('ResizeObserver loop')) failures.push(error.message) })
        page.on('response', response => { if (response.status() >= 400) failures.push(`${response.status()} ${response.url()}`) })
        page.on('requestfailed', request => failures.push(request.url()))
        page.on('dialog', dialog => dialog.accept())
        await page.goto(url); await saved(page)
        await library(page)
        await page.evaluate(() => document.fonts.ready)
        assert.equal(await page.locator('.library').evaluate(element => element.scrollWidth <= element.clientWidth), true)
        await page.screenshot({ path: `${output}/${viewport.width}-grouped-sidebar.png` })
        const before = await json(page, `${viewport.width}-before.json`)
        await verifyCatalogPalette(page)
        assert.deepEqual((await json(page, `${viewport.width}-menus.json`)).document, before.document, 'Menus/search never change document or geometry')
        await library(page)
        const longest = menuGroups('azure').reduce((left, right) => left.label.length > right.label.length ? left : right)
        await assertCatalogSearch(page, longest.label)
        assert.equal(await page.locator('.library').evaluate(element => element.scrollWidth <= element.clientWidth), true)
        assert.equal(await page.locator('.library-list').evaluate(element => element.scrollWidth <= element.clientWidth), true)
        await page.screenshot({ path: `${output}/${viewport.width}-long-category.png` })
        await page.getByLabel('Search components', { exact: true }).fill('')
        await closePanels(page)
        const longType = selectionLibrary.reduce((left, right) => left.label.length > right.label.length ? left : right)
        const items = [selectionLibrary.find(item => /^onelake$/i.test(item.label)), selectionLibrary.find(item => /^lakehouse$/i.test(item.label)), selectionLibrary.find(item => item.catalog === 'azure' && !coverage.legacy.includes(item.icon)), selectionLibrary.find(item => item.icon === 'service'), longType]
        assert.ok(items.every(Boolean))
        const placedIds = []
        for (const [index, item] of items.entries()) placedIds.push(await place(page, item, index % 2 ? 'drag' : 'click', index, viewport.width))
        await page.getByRole('button', { name: 'Open properties', exact: true }).click()
        const type = page.getByLabel('Component type', { exact: true })
        await type.selectOption(longType.icon)
        assert.equal(await type.inputValue(), longType.icon)
        assert.equal(await page.locator('.inspector').evaluate(element => element.scrollWidth <= element.clientWidth), true)
        await page.screenshot({ path: `${output}/${viewport.width}-long-type.png` })
        await type.selectOption(items[3].icon)
        await type.selectOption(items.at(-1).icon)
        await closePanels(page)
        const placed = await json(page, `${viewport.width}-placed.json`)
        assert.deepEqual(placed.document.entities.slice(-items.length).map(entity => ({ icon: entity.icon, label: entity.label, color: entity.color })), items.map(item => ({ icon: item.icon, label: item.label, color: item.color })))
        await page.getByRole('button', { name: 'Undo', exact: true }).click()
        assert.equal(await page.getByLabel('Component type', { exact: true }).inputValue(), items[3].icon)
        await page.getByRole('button', { name: 'Redo', exact: true }).click(); await saved(page)
        assert.deepEqual((await json(page, `${viewport.width}-redo.json`)).document, placed.document)
        await page.getByRole('button', { name: 'Copy selection', exact: true }).click()
        await page.getByRole('button', { name: 'Paste selection', exact: true }).click()
        const copied = await json(page, `${viewport.width}-copied.json`)
        const pasted = copied.document.entities.at(-1)
        assert.equal(copied.document.entities.length, placed.document.entities.length + 1)
        assert.equal(pasted.icon, longType.icon)
        assert.ok(!placedIds.includes(pasted.id))
        placedIds.push(pasted.id)
        const fixture = separatedFixture(copied.document, placedIds, viewport.width)
        await openFixture(page, fixture)
        const backup = await json(page, `${viewport.width}-separated-fixture.json`)
        assert.deepEqual(backup.document, fixture)
        await page.screenshot({ path: `${output}/${viewport.width}-separated-fixture.png` })
        await page.reload(); await saved(page)
        assert.deepEqual((await json(page, `${viewport.width}-reloaded.json`)).document, backup.document)
        await page.getByLabel('Document title', { exact: true }).fill('Catalog Open JSON probe')
        await page.getByLabel('Document title', { exact: true }).press('Tab'); await saved(page)
        const chooser = page.waitForEvent('filechooser')
        await page.getByRole('button', { name: 'Open JSON', exact: true }).click()
        await (await chooser).setFiles(backup.path)
        await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title, backup.document.title)
        await saved(page)
        assert.deepEqual((await json(page, `${viewport.width}-opened.json`)).document, backup.document)
        const exported = await exportIcons(page, viewport.width)
        for (const id of ['app', 'gateway']) {
          await closePanels(page)
          await selectNode(page, id)
          if (!(await page.locator('.inspector').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
          await assertOptions(page, 'Component type')
          assert.equal(await page.getByLabel('Component type', { exact: true }).inputValue(), fixture.entities.find(entity => entity.id === id).icon)
        }
        await library(page); await assertCatalogSearch(page, 'OneLake')
        const readonly = await context.newPage()
        await readonly.goto(url)
        await readonly.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Read-only')
        await library(readonly); await assertCatalogSearch(readonly, 'OneLake')
        assert.equal(await readonly.locator('.library-item').first().isDisabled(), true)
        assert.equal(await readonly.locator('.library-item').first().getAttribute('draggable'), 'false')
        await readonly.getByLabel('Search components', { exact: true }).fill('')
        const toggle = readonly.locator('.catalog-group-toggle').first()
        const expanded = await toggle.getAttribute('aria-expanded')
        await toggle.focus(); await toggle.press('Enter'); assert.notEqual(await toggle.getAttribute('aria-expanded'), expanded)
        await toggle.press('Space'); assert.equal(await toggle.getAttribute('aria-expanded'), expanded)
        await closePanels(readonly)
        await selectNode(readonly, 'app')
        if (!(await readonly.locator('.inspector').evaluate(element => element.classList.contains('open')))) await readonly.getByRole('button', { name: 'Open properties', exact: true }).click()
        await assertOptions(readonly, 'Component type')
        assert.equal(await readonly.getByLabel('Component type', { exact: true }).isDisabled(), true)
        await selectConnection(readonly)
        await assertOptions(readonly, 'Insertion component')
        assert.equal(await readonly.getByLabel('Insertion component', { exact: true }).isDisabled(), true)
        assert.equal(await readonly.getByRole('button', { name: 'Insert on connection', exact: true }).isDisabled(), true)
        await closePanels(readonly)
        const transfer = await readonly.evaluateHandle(icon => { const data = new DataTransfer(); data.setData('application/diagrammer', JSON.stringify({ icon })); return data }, items[0].icon)
        await readonly.locator('.canvas-surface').dispatchEvent('drop', { dataTransfer: transfer, clientX: 100, clientY: 200 }); await transfer.dispose()
        await readonly.keyboard.press('Delete'); await readonly.keyboard.press('Control+z')
        assert.equal(await readonly.locator('.react-flow__node').count(), backup.document.entities.length)
        const readonlyBackup = await download(readonly, () => readonly.getByRole('button', { name: 'Save JSON', exact: true }).click(), `${viewport.width}-readonly.json`)
        assert.deepEqual(JSON.parse(readonlyBackup.bytes), backup.document, 'Readonly drops/keys never change canonical content')
        await library(readonly); await assertCatalogSearch(readonly, 'OneLake')
        await readonly.screenshot({ path: `${output}/${viewport.width}-readonly.png` })
        assert.equal(await readonly.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        assert.deepEqual(failures, [])
        reports.push({ viewport, passed: true, exported, readOnly: true, probeIds: placedIds, minimumProbeGap: 64, fixture: backup.path })
        console.log(`PASS catalog ${viewport.width}: exact inventory/selectors, toggle/unmount/search/state, click/drag/undo, JSON/reload, icon pixels, readonly`)
      } catch (error) {
        reports.push({ viewport, passed: false, error: error.stack })
        await writeFile(`${output}/browser-report.json`, JSON.stringify({ coverage, browser: browser.version(), reports }, null, 2))
        throw error
      } finally { if (browser.isConnected()) await context.close() }
    }
    await writeFile(`${output}/browser-report.json`, JSON.stringify({ coverage, browser: browser.version(), reports }, null, 2))
  } finally {
    await browser?.close()
    if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main()