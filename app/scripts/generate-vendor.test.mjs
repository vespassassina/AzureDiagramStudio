import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { build } from 'vite'

const registryDirectory = new URL('../src/vendor-icons/', import.meta.url)
const evidenceDirectory = new URL('../test-results/vendors/', import.meta.url)
const assets = JSON.parse(await readFile(new URL('assets.generated.json', registryDirectory), 'utf8'))
const catalog = JSON.parse(await readFile(new URL('catalog.generated.json', registryDirectory), 'utf8'))
const definitions = JSON.parse(await readFile(new URL('definitions.json', registryDirectory), 'utf8'))
const hash = bytes => createHash('sha256').update(bytes).digest('hex')

test('should_reproduce_exact_bundled_bytes_when_the_offline_generator_is_checked', () => {
  const result = spawnSync(process.execPath, [fileURLToPath(new URL('./generate-vendor.mjs', import.meta.url)), '--check'], { encoding: 'utf8' })
  assert.equal(result.status, 0, result.stderr)
  assert.match(result.stdout, /Verified 17 original named integration badges; 0 official logos/)
})

test('should_bundle_both_static_exports_without_svg_module_fanout_or_runtime_fetches', async () => {
  const result = await build({
    root: fileURLToPath(new URL('../', import.meta.url)),
    configFile: false,
    logLevel: 'silent',
    build: {
      write: false,
      emptyOutDir: false,
      lib: {
        entry: { catalog: fileURLToPath(new URL('catalog.ts', registryDirectory)), assets: fileURLToPath(new URL('assets.ts', registryDirectory)) },
        formats: ['es'],
      },
    },
  })
  const outputs = Array.isArray(result) ? result : [result]
  const chunks = outputs.flatMap(output => output.output).filter(output => output.type === 'chunk')
  assert.ok(chunks.length >= 2 && chunks.length <= 3)
  const source = chunks.map(chunk => chunk.code).join('\n')
  assert.doesNotMatch(source, /fetch\(|https?:\/\/[^\s"']+\.svg|import\.meta\.glob/)
  for (const item of catalog) assert.ok(source.includes(item.icon), item.icon)
  assert.ok(chunks.some(chunk => chunk.exports.includes('vendorLibrary')))
  assert.ok(chunks.some(chunk => chunk.exports.includes('vendorAssets')))
})

test('should_render_each_named_badge_and_svg_png_exports_when_the_browser_is_offline', async () => {
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const context = await browser.newContext({ offline: true, viewport: { width: 1040, height: 900 } })
    const requests = []
    context.on('request', request => {
      if (/^https?:/i.test(request.url())) requests.push(request.url())
    })
    await context.route('**/*', route => route.abort())
    const page = await context.newPage()
    await page.setContent('<!doctype html><html><head><title>Vendor badge offline evidence</title></head><body></body></html>')
    const result = await page.evaluate(async ({ assets, catalog, definitions }) => {
      const loadImage = source => new Promise((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = () => reject(new Error('Embedded vendor image did not decode'))
        image.src = source
      })
      const countInk = (context, x, y, width, height) => {
        const pixels = context.getImageData(x, y, width, height).data
        let count = 0
        for (let offset = 0; offset < pixels.length; offset += 4) {
          if (pixels[offset + 3] > 128 && pixels[offset] < 140 && pixels[offset + 1] < 140 && pixels[offset + 2] < 140) count++
        }
        return count
      }
      const metrics = []
      const images = []
      for (const item of catalog) {
        const image = await loadImage(assets[item.icon])
        images.push(image)
        const definition = definitions.find(candidate => `vendor-${candidate.key}` === item.icon)
        for (const size of [16, 35, 64]) {
          const canvas = document.createElement('canvas')
          canvas.width = canvas.height = size
          const context = canvas.getContext('2d')
          context.drawImage(image, 0, 0, size, size)
          const left = Math.floor(size * 12 / 64)
          const top = Math.floor(size * 17 / 64)
          const width = Math.floor(size * 40 / 64)
          const height = Math.floor(size * 27 / 64)
          const glyphInk = countInk(context, left, top, width, height)
          const fontSize = definition.glyph.length === 3 ? 25 : 30
          context.font = `700 ${fontSize}px monospace`
          const textWidth = context.measureText(definition.glyph).width
          metrics.push({ icon: item.icon, size, glyph: definition.glyph, glyphInk, textWidth, fontPixels: fontSize * size / 64 })
        }
      }
      const columns = 4
      const tileWidth = 240
      const tileHeight = 144
      const width = columns * tileWidth
      const height = Math.ceil(catalog.length / columns) * tileHeight
      const tiles = catalog.map((item, index) => {
        const x = index % columns * tileWidth
        const y = Math.floor(index / columns) * tileHeight
        const label = item.label.replace(/&/g, '&amp;').replace(/</g, '&lt;')
        return `<g><image x="${x + 16}" y="${y + 12}" width="35" height="35" href="${assets[item.icon]}"/><image x="${x + 68}" y="${y + 12}" width="16" height="16" href="${assets[item.icon]}"/><image x="${x + 112}" y="${y + 12}" width="64" height="64" href="${assets[item.icon]}"/><text x="${x + 16}" y="${y + 98}" font-size="17" font-family="monospace" fill="#252a2c">${label}</text><text x="${x + 16}" y="${y + 120}" font-size="11" font-family="monospace" fill="#62696c">Named integration badge</text></g>`
      }).join('')
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="white"/>${tiles}</svg>`
      const composite = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      context.drawImage(composite, 0, 0)
      const exportedGlyphs = catalog.map((item, index) => {
        const x = index % columns * tileWidth + 16 + Math.floor(35 * 12 / 64)
        const y = Math.floor(index / columns) * tileHeight + 12 + Math.floor(35 * 17 / 64)
        return { icon: item.icon, glyphInk: countInk(context, x, y, Math.floor(35 * 40 / 64), Math.floor(35 * 27 / 64)) }
      })
      const png = canvas.toDataURL('image/png')
      const preview = document.createElement('div')
      preview.style.display = 'grid'
      preview.style.gridTemplateColumns = 'repeat(auto-fit, minmax(220px, 1fr))'
      preview.style.gap = '24px'
      preview.style.fontFamily = 'monospace'
      preview.style.color = '#252a2c'
      const previews = []
      for (const item of catalog) {
        const tile = document.createElement('div')
        const row = document.createElement('div')
        row.style.display = 'flex'
        row.style.alignItems = 'center'
        row.style.gap = '16px'
        row.style.height = '76px'
        for (const size of [35, 16, 64]) {
          const image = document.createElement('img')
          image.src = assets[item.icon]
          image.alt = `${item.label}: named integration badge`
          image.width = image.height = size
          row.append(image)
          previews.push(image)
        }
        const label = document.createElement('div')
        label.textContent = item.label
        label.style.fontSize = '17px'
        const subtitle = document.createElement('div')
        subtitle.textContent = item.subtitle
        subtitle.style.fontSize = '11px'
        subtitle.style.marginTop = '8px'
        tile.append(row, label, subtitle)
        preview.append(tile)
      }
      document.body.style.margin = '16px'
      document.body.append(preview)
      await Promise.all(previews.map(image => image.decode()))
      return { metrics, exportedGlyphs, svg, png, width, height }
    }, { assets, catalog, definitions })
    for (const metric of result.metrics) {
      assert.ok(metric.glyphInk >= (metric.size === 16 ? 8 : 35), JSON.stringify(metric))
      assert.ok(metric.textWidth <= 48, JSON.stringify(metric))
    }
    for (const metric of result.exportedGlyphs) assert.ok(metric.glyphInk >= 35, JSON.stringify(metric))
    assert.deepEqual(requests, [], 'Offline rendering attempted a remote request')
    const png = Buffer.from(result.png.split(',')[1], 'base64')
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    assert.equal(png.readUInt32BE(16), result.width)
    assert.equal(png.readUInt32BE(20), result.height)
    await mkdir(evidenceDirectory, { recursive: true })
    await writeFile(new URL('vendor-contact-sheet.svg', evidenceDirectory), result.svg)
    await writeFile(new URL('vendor-contact-sheet.png', evidenceDirectory), png)
    await page.screenshot({ path: fileURLToPath(new URL('vendor-desktop.png', evidenceDirectory)), fullPage: true })
    await page.setViewportSize({ width: 390, height: 844 })
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('img')].every(image => image.getBoundingClientRect().width === image.width)), true)
    await page.screenshot({ path: fileURLToPath(new URL('vendor-mobile.png', evidenceDirectory)), fullPage: true })
    const report = { scope: 'Isolated vendor registry, not editor/desktop integration', vendorCount: catalog.length, requestedKeys: catalog.slice(0, 7).map(item => item.icon), classification: 'Named integration badge', officialLogos: 0, sizes: [16, 35, 64], remoteRequests: requests, metrics: result.metrics, exportedGlyphs: result.exportedGlyphs, svgSha256: hash(result.svg), pngSha256: hash(png), sourceHashes: Object.fromEntries(catalog.map(item => [item.icon, item.source.sha256])) }
    await writeFile(new URL('vendor-report.json', evidenceDirectory), `${JSON.stringify(report, null, 2)}\n`)
    console.log(`PASS: ${catalog.length} badges at 16/35/64px, ${result.exportedGlyphs.length} SVG/PNG export glyphs, zero remote requests.`)
  } finally {
    await browser.close()
  }
})