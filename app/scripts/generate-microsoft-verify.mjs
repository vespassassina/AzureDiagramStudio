import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = new URL('../test-results/microsoft-apps/', import.meta.url)
const loader = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' })
let microsoftLibrary
let microsoftAssets
try {
  microsoftLibrary = (await loader.ssrLoadModule('/src/microsoft-icons/catalog.ts')).microsoftLibrary
  microsoftAssets = (await loader.ssrLoadModule('/src/microsoft-icons/assets.ts')).microsoftAssets
} finally { await loader.close() }

const escapeXml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
const component = item => renderToStaticMarkup(createElement('svg', { xmlns: 'http://www.w3.org/2000/svg', width: 35, height: 35, viewBox: '0 0 35 35' }, createElement('image', { href: microsoftAssets[item.icon], width: 35, height: 35, preserveAspectRatio: 'xMidYMid meet' })))
const svgUrl = source => `data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}`
const svgComponents = microsoftLibrary.map(item => svgUrl(component(item)))
const rows = microsoftLibrary.map((item, index) => `<section data-icon="${item.icon}"><div class="artwork"><img alt="${escapeXml(item.label)}" src="${microsoftAssets[item.icon]}"><img alt="${escapeXml(item.label)} SVG component" src="${svgComponents[index]}"></div><h2>${escapeXml(item.label)}</h2><p>${escapeXml(item.subtitle)}</p></section>`).join('')
const html = `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Microsoft Apps: offline artwork verification</title><style>*{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f6f5;color:#252a2c;font-family:Georgia,serif}h1{font-size:24px;margin:0 0 8px}header p{font-size:14px;margin:0 0 24px}.grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:0;border-top:1px solid #bec8c3}section{padding:20px 12px;min-height:142px;border-bottom:1px solid #bec8c3}h2{font-size:15px;line-height:1.4;margin:12px 0 4px;overflow-wrap:anywhere}p{font-size:12px;line-height:1.5;margin:0;color:#535c58}.artwork{display:flex;gap:18px;height:35px}img{width:35px;height:35px;object-fit:contain}canvas{display:none}@media(max-width:600px){body{padding:16px}.grid{grid-template-columns:repeat(2,minmax(0,1fr))}h1{font-size:22px}}</style><header><h1>Microsoft Apps</h1><p>14 products. Left: direct artwork; right: embedded SVG component. 5 official architecture icons; 9 original named badges. No Microsoft endorsement.</p></header><main class="grid">${rows}</main></html>`
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="680" viewBox="0 0 1120 680"><rect width="1120" height="680" fill="#ffffff"/><text x="24" y="32" font-family="Georgia" font-size="24" fill="#252a2c">Microsoft Apps: 5 official icons / 9 original named badges</text>${microsoftLibrary.map((item, index) => {
  const horizontal = 24 + index % 4 * 274
  const vertical = 64 + Math.floor(index / 4) * 140
  return `<g transform="translate(${horizontal},${vertical})"><image href="${microsoftAssets[item.icon]}" width="35" height="35" preserveAspectRatio="xMidYMid meet"/><text y="58" font-family="Georgia" font-size="14" fill="#252a2c">${escapeXml(item.label)}</text><text y="80" font-family="Georgia" font-size="12" fill="#535c58">${escapeXml(item.subtitle)}</text></g>`
}).join('')}</svg>`

await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const reports = []
try {
  for (const [name, viewport] of [['desktop', { width: 1280, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
    const context = await browser.newContext({ viewport, offline: true })
    const page = await context.newPage()
    const network = []
    const errors = []
    context.on('request', request => { if (/^https?:/i.test(request.url())) network.push(request.url()) })
    page.on('pageerror', error => errors.push(error.message))
    await context.route('**/*', route => route.abort())
    try {
      await page.setContent(html)
      await page.locator('img').evaluateAll(async images => { await Promise.all(images.map(image => image.decode())) })
      const pixels = await page.evaluate(async ({ items, assets, components }) => {
        const load = async source => { const image = new Image(); image.src = source; await image.decode(); return image }
        const counts = image => {
          const canvas = document.createElement('canvas')
          canvas.width = 35
          canvas.height = 35
          const paint = canvas.getContext('2d', { willReadFrequently: true })
          paint.drawImage(image, 0, 0, 35, 35)
          const pixels = paint.getImageData(0, 0, 35, 35).data
          let ink = 0
          for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset + 3] > 24 && Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 235) ink++
          return { ink, png: canvas.toDataURL('image/png') }
        }
        const results = []
        for (const [index, item] of items.entries()) {
          const direct = counts(await load(assets[item.icon]))
          const svg = counts(await load(components[index]))
          const png = counts(await load(svg.png))
          results.push({ icon: item.icon, directInk: direct.ink, svgInk: svg.ink, pngInk: png.ink, png: svg.png })
        }
        return results
      }, { items: microsoftLibrary, assets: microsoftAssets, components: svgComponents })
      for (const item of pixels) {
        for (const field of ['directInk', 'svgInk', 'pngInk']) assert.ok(item[field] >= 30, `${name} ${item.icon} ${field}: ${item[field]}`)
        assert.equal(item.svgInk, item.pngInk, `${item.icon}: lossless SVG component to PNG`)
        if (name === 'desktop') await writeFile(new URL(`${item.icon}-35px.png`, output), Buffer.from(item.png.split(',')[1], 'base64'))
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${name}: horizontal overflow`)
      const fit = await page.locator('section').evaluateAll(elements => elements.every(element => [...element.querySelectorAll('h2,p')].every(text => text.scrollWidth <= text.clientWidth)))
      assert.ok(fit, `${name}: text fits`)
      assert.deepEqual(network, [], `${name}: no external requests`)
      assert.deepEqual(errors, [], `${name}: no browser errors`)
      await page.screenshot({ path: fileURLToPath(new URL(`contact-sheet-${name}.png`, output)), fullPage: true })
      reports.push({ viewport: name, offline: true, freshContext: true, componentSize: 35, networkRequests: network.length, pixels: pixels.map(({ png, ...item }) => item) })
      if (name === 'desktop') {
        const sheetPng = await page.evaluate(async source => { const image = new Image(); image.src = source; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; canvas.getContext('2d').drawImage(image, 0, 0); return canvas.toDataURL('image/png') }, svgUrl(sheet))
        await writeFile(new URL('contact-sheet.png', output), Buffer.from(sheetPng.split(',')[1], 'base64'))
      }
    } finally { await context.close() }
  }
} finally { await browser.close() }
await writeFile(new URL('contact-sheet.html', output), html)
await writeFile(new URL('contact-sheet.svg', output), sheet)
await writeFile(new URL('browser-report.json', output), `${JSON.stringify({ scope: 'Isolated Microsoft registry only; shared scene/editor integration not exercised', products: microsoftLibrary.length, official: 5, originalBadges: 9, reports }, null, 2)}\n`)
console.log(`PASS: ${microsoftLibrary.length} products x 3 rendering paths x 2 fresh offline viewports; nonblank 35px artwork, lossless PNG, no network, no overflow. Evidence: ${fileURLToPath(output)}`)