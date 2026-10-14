import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = process.env.DGM116_RUN ? pathToFileURL(`${process.env.DGM116_RUN}/`) : new URL('../test-results/branding/', import.meta.url)

test('should_render_three_filled_connected_nodes_without_inset_bars_when_original_brand_is_rasterized', async () => {
  const source = await readFile(new URL('../public/branding/logo.svg', import.meta.url))
  const evidence = new URL(`${process.env.DGM116_STAGE ?? 'current'}/`, output)
  await mkdir(evidence, { recursive: true })
  await writeFile(new URL('logo.svg', evidence), source)
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    await page.route('**/*', route => route.abort())
    await page.setContent('<canvas></canvas>')
    const report = await page.evaluate(async svg => {
      const document = new DOMParser().parseFromString(svg, 'image/svg+xml')
      const root = document.documentElement
      const labels = (root.getAttribute('aria-labelledby') ?? '').split(/\s+/).map(id => document.getElementById(id)?.textContent)
      const badge = root.querySelector('rect:not([data-tile])')
      const nodes = [...root.querySelectorAll('[data-tile]')].map(node => ({ tile: node.getAttribute('data-tile'), tag: node.localName, fill: node.getAttribute('fill'), x: Number(node.getAttribute('x')), y: Number(node.getAttribute('y')), width: Number(node.getAttribute('width')), height: Number(node.getAttribute('height')) }))
      const paths = [...root.querySelectorAll('path')].map(path => ({ commands: path.getAttribute('d'), fill: path.getAttribute('fill'), stroke: path.getAttribute('stroke'), width: Number(path.getAttribute('stroke-width')) }))
      const image = new Image()
      image.src = `data:image/svg+xml;base64,${btoa(svg)}`
      await image.decode()
      const canvas = window.document.querySelector('canvas')
      const context = canvas.getContext('2d', { willReadFrequently: true })
      const renders = []
      for (const size of [16, 32, 256]) {
        canvas.width = size
        canvas.height = size
        context.clearRect(0, 0, size, size)
        context.drawImage(image, 0, 0, size, size)
        const pixels = context.getImageData(0, 0, size, size).data
        const at = (column, row) => [...pixels.slice((row * size + column) * 4, (row * size + column) * 4 + 4)]
        let opaque = 0
        let white = 0
        let blue = 0
        const bounds = { left: size, top: size, right: -1, bottom: -1 }
        const foreground = new Set()
        for (let row = 0; row < size; row++) {
          for (let column = 0; column < size; column++) {
            const [red, green, blueChannel, alpha] = at(column, row)
            if (alpha >= 250) opaque++
            const isWhite = alpha >= 200 && red >= 220 && green >= 220 && blueChannel >= 220
            const isBlue = alpha >= 200 && red < 80 && green >= 70 && green <= 150 && blueChannel >= 170
            if (isWhite) white++
            if (isBlue) blue++
            if (isWhite || isBlue) {
              foreground.add(row * size + column)
              bounds.left = Math.min(bounds.left, column)
              bounds.top = Math.min(bounds.top, row)
              bounds.right = Math.max(bounds.right, column)
              bounds.bottom = Math.max(bounds.bottom, row)
            }
          }
        }
        const nodeCenters = nodes.map(node => ({ tile: node.tile, fill: node.fill, pixel: at(Math.floor((node.x + node.width / 2) * size / 64), Math.floor((node.y + node.height / 2) * size / 64)) }))
        const visited = new Set()
        const pending = foreground.size ? [foreground.values().next().value] : []
        while (pending.length) {
          const index = pending.pop()
          if (visited.has(index)) continue
          visited.add(index)
          const row = Math.floor(index / size)
          const column = index % size
          for (const [nextColumn, nextRow] of [[column - 1, row], [column + 1, row], [column, row - 1], [column, row + 1]]) {
            if (nextColumn < 0 || nextColumn >= size || nextRow < 0 || nextRow >= size) continue
            const next = nextRow * size + nextColumn
            if (foreground.has(next) && !visited.has(next)) pending.push(next)
          }
        }
        const perimeterClear = Array.from({ length: size }, (_, index) => [at(index, 0), at(index, size - 1), at(0, index), at(size - 1, index)]).flat().every(pixel => pixel[3] === 0)
        renders.push({ size, opaque, white, blue, bounds, nodeCenters, perimeterClear, foregroundPixels: foreground.size, connectedPixels: visited.size })
      }
      return { parserErrors: document.querySelectorAll('parsererror').length, namespace: root.namespaceURI, viewBox: root.getAttribute('viewBox'), role: root.getAttribute('role'), labels, badge: { x: Number(badge?.getAttribute('x')), y: Number(badge?.getAttribute('y')), width: Number(badge?.getAttribute('width')), height: Number(badge?.getAttribute('height')), rx: Number(badge?.getAttribute('rx')), fill: badge?.getAttribute('fill') }, tags: [...root.querySelectorAll('*')].map(element => element.localName), unsafeAttributes: [...root.querySelectorAll('*'), root].flatMap(element => [...element.attributes].filter(attribute => /^on/i.test(attribute.name) || /href|style/i.test(attribute.name)).map(attribute => attribute.name)), nodes, paths, renders }
    }, source.toString('utf8'))
    await writeFile(new URL('raster-report.json', evidence), `${JSON.stringify(report, null, 2)}\n`)
    const imageUrl = `data:image/svg+xml;base64,${source.toString('base64')}`
    for (const size of [16, 32, 256]) {
      await page.setViewportSize({ width: size, height: size })
      await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:${size}px;height:${size}px}</style><img src="${imageUrl}">`)
      await page.locator('img').evaluate(image => image.decode())
      await page.screenshot({ path: fileURLToPath(new URL(`logo-${size}.png`, evidence)), omitBackground: true })
    }
    await page.setViewportSize({ width: 760, height: 380 })
    const rasters = new Map(await Promise.all([16, 32, 256].map(async size => [size, `data:image/png;base64,${(await readFile(new URL(`logo-${size}.png`, evidence))).toString('base64')}`])))
    const sheetStyle = '<style>html,body{margin:0;background:#e9ecef;color:#182825;font:16px Georgia}main{display:flex;align-items:center;justify-content:space-around;height:380px}figure{margin:0;display:flex;align-items:center;flex-direction:column;gap:20px}img{display:block}figcaption{height:24px}small{font-size:14px}h2{font-size:18px;margin:0;padding:12px 24px}</style>'
    const sheet = images => `<main>${[16, 32, 256].map(size => `<figure><img src="${images.get(size)}" width="${size}" height="${size}"><figcaption>${size}px</figcaption>${size < 256 ? `<img src="${images.get(size)}" width="128" height="128" style="image-rendering:pixelated"><small>${128 / size}x inspection</small>` : ''}</figure>`).join('')}</main>`
    await page.setContent(`${sheetStyle}${sheet(rasters)}`)
    await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
    await page.screenshot({ path: fileURLToPath(new URL('contact-sheet.png', evidence)) })
    if (process.env.DGM116_RUN && process.env.DGM116_STAGE !== 'before') {
      const before = new Map(await Promise.all([16, 32, 256].map(async size => [size, `data:image/png;base64,${(await readFile(new URL(`before/logo-${size}.png`, output))).toString('base64')}`])))
      await page.setViewportSize({ width: 760, height: 856 })
      await page.setContent(`${sheetStyle}<h2>Before</h2>${sheet(before)}<h2>After</h2>${sheet(rasters)}`)
      await page.locator('img').evaluateAll(images => Promise.all(images.map(image => image.decode())))
      await page.screenshot({ path: fileURLToPath(new URL('before-after.png', evidence)) })
    }
    assert.equal(report.parserErrors, 0)
    assert.equal(report.namespace, 'http://www.w3.org/2000/svg')
    assert.equal(report.viewBox, '0 0 64 64')
    assert.equal(report.role, 'img')
    assert.equal(report.labels[0], 'Azure Diagram Studio')
    assert.match(report.labels[1], /Original architecture mark/)
    assert.deepEqual(report.badge, { x: 4, y: 4, width: 56, height: 56, rx: 16, fill: '#117865' })
    assert.deepEqual(report.unsafeAttributes, [])
    assert.ok(report.tags.every(tag => ['title', 'desc', 'rect', 'path'].includes(tag)), 'Self-contained original vector primitives only')
    assert.equal(report.nodes.length, 3)
    assert.deepEqual(report.nodes.map(node => node.tile), ['source', 'left', 'right'])
    assert.deepEqual(report.nodes.map(node => node.fill), ['#ffffff', '#ffffff', '#246acf'])
    for (const node of report.nodes) {
      assert.equal(node.tag, 'rect')
      assert.ok(node.x >= 10 && node.y >= 10 && node.x + node.width <= 54 && node.y + node.height <= 54, 'Nodes sit comfortably inside the teal badge')
    }
    assert.equal(report.tags.filter(tag => tag === 'rect').length, 4, 'One badge and three solid nodes')
    assert.equal(report.paths.length, 1, 'Only the graph connector remains; tiny inset bars are absent')
    assert.equal(report.paths[0].fill, 'none')
    assert.equal(report.paths[0].stroke, '#ffffff')
    assert.ok(report.paths[0].width >= 4, 'Connector remains visible at 16px')
    assert.match(report.paths[0].commands, /^[\d\s.,MmHhVv+-]+$/, 'Connector uses only orthogonal segments')
    for (const render of report.renders) {
      assert.ok(render.opaque > render.size * render.size / 2, `Nonblank badge at ${render.size}px`)
      assert.ok(render.white >= 6 && render.blue >= 2, `White graph and distinct blue accent survive at ${render.size}px`)
      assert.equal(render.perimeterClear, true, `Transparent exterior at ${render.size}px`)
      assert.ok(render.bounds.left > 0 && render.bounds.top > 0 && render.bounds.right < render.size - 1 && render.bounds.bottom < render.size - 1, `Unclipped graph at ${render.size}px`)
      for (const node of render.nodeCenters) assert.deepEqual(node.pixel, node.fill === '#ffffff' ? [255, 255, 255, 255] : [36, 106, 207, 255], `Solid ${node.tile} center at ${render.size}px`)
      assert.equal(render.connectedPixels, render.foregroundPixels, `Three nodes and connector form one continuous graph at ${render.size}px`)
    }
    const luminance = channels => channels.map(channel => channel / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4).reduce((total, channel, index) => total + channel * [.2126, .7152, .0722][index], 0)
    const whiteLuminance = luminance([255, 255, 255])
    assert.ok((whiteLuminance + .05) / (luminance([17, 120, 101]) + .05) >= 4.5, 'White connector contrasts with teal')
    assert.ok((whiteLuminance + .05) / (luminance([36, 106, 207]) + .05) >= 4.5, 'White outline contrasts with blue')
    console.log(JSON.stringify({ topology: 'three solid connected nodes, no inset bars', renders: report.renders }, null, 2))
  } finally {
    await browser.close()
  }
})

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
      assert.equal(await brand.count(), 1)
      assert.equal(await brand.isVisible(), true)
      assert.equal(await brand.getAttribute('aria-label'), 'Azure Diagram Studio')
      assert.equal(await brand.innerText(), 'Azure Diagram Studio')
      assert.equal(await brand.locator('.brand-name').innerText(), 'Azure Diagram Studio')
      assert.equal(await brand.locator('img').count(), 1)
      assert.equal(await brand.locator('img').getAttribute('alt'), '')
      assert.equal(await brand.locator('img').evaluate(image => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0), true)
      const geometry = await brand.evaluate(element => {
        const box = node => { const rect = node.getBoundingClientRect(); return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height } }
        const text = element.querySelector('.brand-name')
        const range = document.createRange()
        range.selectNodeContents(text)
        return { brand: box(element), icon: box(element.querySelector('img')), text: box(text), header: box(element.parentElement), siblings: [...element.parentElement.children].filter(child => child !== element).map(box), lines: [...range.getClientRects()].map(rect => ({ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom })), overflow: element.scrollWidth > element.clientWidth, textOverflow: text.scrollWidth > text.clientWidth, fontSize: getComputedStyle(text).fontSize, pageOverflow: document.documentElement.scrollWidth > innerWidth, bodyOverflow: document.body.scrollWidth > innerWidth }
      })
      await page.screenshot({ path: fileURLToPath(new URL(`header-${width}.png`, output)) })
      reports.push({ width, title: await page.title(), geometry, foreignRequests })
      await writeFile(new URL('header-report.json', output), `${JSON.stringify({ browser: browser.version(), reports }, null, 2)}\n`)
      const inside = (child, parent) => child.left >= parent.left - .5 && child.top >= parent.top - .5 && child.right <= parent.right + .5 && child.bottom <= parent.bottom + .5
      assert.equal(geometry.icon.width, width === 390 ? 28 : 36)
      assert.equal(geometry.icon.height, width === 390 ? 28 : 36)
      assert.ok(geometry.text.width > 0 && geometry.text.height > 0)
      assert.ok(geometry.brand.width >= geometry.icon.width + geometry.text.width - .5, 'Brand slot fits both icon and complete text')
      assert.ok(geometry.brand.width <= geometry.header.width, 'Brand slot stays within header width')
      assert.equal(geometry.overflow, false)
      assert.equal(geometry.textOverflow, false)
      assert.equal(geometry.pageOverflow, false)
      assert.equal(geometry.bodyOverflow, false)
      assert.ok(inside(geometry.brand, geometry.header))
      assert.ok(inside(geometry.icon, geometry.brand))
      assert.ok(inside(geometry.text, geometry.brand))
      assert.ok(geometry.icon.right <= geometry.text.left + .5, 'Icon and text do not overlap')
      assert.ok(geometry.lines.length > 0, 'Complete brand has rendered text')
      assert.ok(geometry.lines.every(line => inside(line, geometry.brand)), `Every word is inside its brand parent: ${JSON.stringify(geometry)}`)
      assert.ok(geometry.lines.every(line => line.left >= geometry.icon.right - .5), 'No word overlaps the icon')
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
  for (const size of [16, 24, 32, 48, 64, 128, 256, 512]) {
    const png = first.get(`branding/logo-${size}.png`)
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    assert.equal(png.toString('ascii', 12, 16), 'IHDR')
    assert.equal(png.readUInt32BE(16), size)
    assert.equal(png.readUInt32BE(20), size)
  }
  const ico = first.get('branding/app-icon.ico')
  assert.deepEqual(ico, first.get('favicon.ico'))
  assert.equal(ico.readUInt16LE(0), 0)
  assert.equal(ico.readUInt16LE(2), 1)
  assert.equal(ico.readUInt16LE(4), 7)
  let offset = 6 + 7 * 16
  for (const [index, size] of [16, 24, 32, 48, 64, 128, 256].entries()) {
    const entry = 6 + index * 16
    assert.equal(ico[entry] || 256, size)
    assert.equal(ico[entry + 1] || 256, size)
    assert.equal(ico.readUInt16LE(entry + 4), 1)
    assert.equal(ico.readUInt16LE(entry + 6), 32)
    assert.equal(ico.readUInt32LE(entry + 12), offset)
    const length = ico.readUInt32LE(entry + 8)
    assert.ok(length > 0 && offset + length <= ico.length)
    if (size === 256) assert.deepEqual(ico.subarray(offset, offset + length), first.get('branding/logo-256.png'))
    else {
      assert.equal(ico.readUInt32LE(offset), 40)
      assert.equal(ico.readInt32LE(offset + 4), size)
      assert.equal(ico.readInt32LE(offset + 8), size * 2)
    }
    offset += length
  }
  assert.equal(offset, ico.length)
  console.log(JSON.stringify(Object.fromEntries([...first].map(([path, bytes]) => [path, { bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') }])), null, 2))
})