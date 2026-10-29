import assert from 'node:assert/strict'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import type { Browser, Page } from '@playwright/test'
import { createServer } from 'vite'
import type { ViteDevServer } from 'vite'
import { afterAll, beforeAll, test } from 'vitest'
import { validateCustomIcon } from './contract.ts'
import { iconFixture, pngBytes, pngChunk } from './test-fixtures.ts'

let server: ViteDevServer
let browser: Browser
let baseUrl: string
const pendingRequests = new Map<object, string | undefined>()
const connections = new Set<object>()

function lifecycle(stage: string) {
  console.info('DGM144 custom-icon lifecycle', JSON.stringify({
    stage, at: new Date().toISOString(), workerPid: process.pid,
    browserConnected: browser?.isConnected(),
    pages: browser?.contexts().flatMap(context => context.pages()).length,
    serverListening: server?.httpServer?.listening,
    pendingRequests: [...pendingRequests.values()], connections: connections.size,
  }))
}

async function preparePage(page: Page) {
  await page.goto(`${baseUrl}custom-icon-foundation`)
  const script = await page.addScriptTag({ type: 'module', content: 'import { importCustomIcon } from "/src/custom-icons/import.ts"; globalThis.__importCustomIcon = importCustomIcon;' })
  await page.waitForFunction(() => '__importCustomIcon' in globalThis)
  await script.evaluate(element => element.parentNode?.removeChild(element))
}

beforeAll(async () => {
  server = await createServer({
    root: fileURLToPath(new URL('../../', import.meta.url)), configFile: false, logLevel: 'error', server: { host: '127.0.0.1', port: 0 }, optimizeDeps: { include: ['dompurify'] },
    plugins: [{ name: 'custom-icon-foundation-test', configureServer(instance) {
      instance.middlewares.use('/custom-icon-foundation', (_request, response) => {
        response.setHeader('Content-Type', 'text/html')
        response.end('<!doctype html><html><head><title>Custom icon foundation test</title></head><body></body></html>')
      })
    } }],
  })
  server.httpServer!.on('connection', socket => {
    connections.add(socket)
    socket.once('close', () => connections.delete(socket))
  })
  server.httpServer!.on('request', (request, response) => {
    pendingRequests.set(request, request.url)
    response.once('close', () => pendingRequests.delete(request))
  })
  await server.listen()
  baseUrl = server.resolvedUrls!.local[0]
  browser = await chromium.launch({ channel: 'msedge', headless: true })
}, 60000)

afterAll(async () => {
  lifecycle('browser-close-start')
  await browser?.close()
  lifecycle('browser-close-complete; server-close-start')
  await server?.close()
  lifecycle('server-close-complete')
})

test('should_decode_real_png_jpeg_webp_once_and_preserve_aspect_alpha_when_native_edge_imports', async () => {
  const page = await browser.newPage()
  const remote: string[] = []
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(baseUrl)) remote.push(request.url()) })
  try {
    await preparePage(page)
    const results = await page.evaluate(async () => {
      const { __importCustomIcon: importCustomIcon } = globalThis as typeof globalThis & { __importCustomIcon: typeof import('./import.ts').importCustomIcon }
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 512
      const context = canvas.getContext('2d')!
      context.fillStyle = 'rgba(255,0,0,0.5)'
      context.fillRect(0, 0, 512, 512)
      const original = globalThis.createImageBitmap.bind(globalThis)
      let decodes = 0
      globalThis.createImageBitmap = ((blob: ImageBitmapSource, options?: ImageBitmapOptions) => { decodes++; return original(blob, options) }) as typeof createImageBitmap
      const outputs = []
      for (const type of ['image/png', 'image/jpeg', 'image/webp']) {
        const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), type))
        const icon = await importCustomIcon(new File([blob], `native.${type.split('/')[1]}`, { type }))
        const snapshot = await original(await (await fetch(icon.dataUrl)).blob())
        const pixels = document.createElement('canvas')
        pixels.width = icon.width
        pixels.height = icon.height
        const drawing = pixels.getContext('2d')!
        drawing.drawImage(snapshot, 0, 0)
        outputs.push({ type, icon, left: [...drawing.getImageData(40, 40, 1, 1).data], right: [...drawing.getImageData(400, 40, 1, 1).data], frozen: Object.isFrozen(icon) })
        snapshot.close()
      }
      return { outputs, decodes }
    })
    assert.equal(results.decodes, 3)
    for (const output of results.outputs) {
      assert.ok(validateCustomIcon(output.icon).ok)
      assert.equal(output.icon.width, 512)
      assert.equal(output.icon.height, 256)
      assert.equal(output.frozen, true)
      if (output.type !== 'image/jpeg') {
        assert.ok(Math.abs(output.left[3] - 128) <= 1)
        assert.equal(output.right[3], 0)
      }
    }
    assert.deepEqual(remote, [])
  } finally { await page.close() }
}, 60000)

test('should_rasterize_real_inert_svg_and_first_gif_frame_without_live_markup_or_remote_requests', async () => {
  const page = await browser.newPage()
  const remote: string[] = []
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(baseUrl)) remote.push(request.url()) })
  try {
    await preparePage(page)
    const result = await page.evaluate(async () => {
      const { __importCustomIcon: importCustomIcon } = globalThis as typeof globalThis & { __importCustomIcon: typeof import('./import.ts').importCustomIcon }
      const markup = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 90"><rect x="10" y="5" width="160" height="80" fill="#ff0000" opacity="0.5"/></svg>'
      const create = URL.createObjectURL.bind(URL)
      const revoke = URL.revokeObjectURL.bind(URL)
      const urls: string[] = []
      const revoked: string[] = []
      URL.createObjectURL = blob => { const url = create(blob); urls.push(url); return url }
      URL.revokeObjectURL = url => { revoked.push(url); revoke(url) }
      const svg = await importCustomIcon(new File([markup], 'art.svg', { type: 'image/svg+xml' }))
      const gif = new Uint8Array([71,73,70,56,57,97,1,0,1,0,128,0,0,255,0,0,0,255,0,33,249,4,0,1,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,33,249,4,0,1,0,0,0,44,0,0,0,0,1,0,1,0,0,2,2,76,1,0,59])
      const stills = []
      for (let index = 0; index < 4; index++) stills.push(await importCustomIcon(new File([gif], 'animated.gif', { type: 'image/gif' })))
      const pixel = async (dataUrl: string, x: number, y: number) => {
        const image = new Image()
        image.src = dataUrl
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        return [...context.getImageData(x, y, 1, 1).data]
      }
      return { svg, stills, first: await pixel(stills[0].dataUrl, 0, 0), transparent: await pixel(svg.dataUrl, 0, 0), translucent: await pixel(svg.dataUrl, 80, 40), liveMarkup: document.querySelectorAll('svg,script,img').length, urls, revoked }
    })
    assert.ok(validateCustomIcon(result.svg).ok)
    assert.deepEqual([result.svg.width, result.svg.height], [180, 90])
    assert.equal(result.liveMarkup, 0)
    assert.equal(result.transparent[3], 0)
    assert.ok(Math.abs(result.translucent[3] - 128) <= 1)
    assert.deepEqual(result.first, [255, 0, 0, 255])
    assert.equal(new Set(result.stills.map(icon => icon.dataUrl)).size, 1)
    assert.deepEqual(result.urls, result.revoked)
    assert.deepEqual(remote, [])
  } finally { await page.close() }
}, 60000)

test('should_shrink_noisy_png_to_encoded_budget_and_reject_corrupt_inputs_when_native_edge_imports', async () => {
  const page = await browser.newPage()
  try {
    await preparePage(page)
    const result = await page.evaluate(async () => {
      const { __importCustomIcon: importCustomIcon } = globalThis as typeof globalThis & { __importCustomIcon: typeof import('./import.ts').importCustomIcon }
      const canvas = document.createElement('canvas')
      canvas.width = 512
      canvas.height = 512
      const context = canvas.getContext('2d')!
      const pixels = context.createImageData(512, 512)
      let seed = 123456
      for (let index = 0; index < pixels.data.length; index++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; pixels.data[index] = seed >>> 24 }
      context.putImageData(pixels, 0, 0)
      const blob = await new Promise<Blob>(resolve => canvas.toBlob(value => resolve(value!), 'image/png'))
      const icon = await importCustomIcon(new File([blob], 'noise.png', { type: 'image/png' }))
      const errors = []
      for (const [data, type] of [['not an image', 'image/png'], ['<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', 'image/svg+xml'], ['<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.invalid/remote.svg#x"/></svg>', 'image/svg+xml']]) {
        try { await importCustomIcon(new File([data], 'invalid', { type })); errors.push('accepted') }
        catch (error) { errors.push((error as Error).message) }
      }
      return { icon, errors }
    })
    assert.ok(validateCustomIcon(result.icon).ok)
    assert.ok(result.icon.width < 512)
    assert.equal(result.icon.width, result.icon.height)
    assert.ok(result.icon.dataUrl.length <= 384 * 1024)
    assert.ok(result.errors.every(error => error.includes('Could not import image')))
  } finally { await page.close() }
}, 60000)

test('should_reject_xml_instructions_dtd_events_and_remote_resources_before_native_edge_decode', async () => {
  const page = await browser.newPage()
  const remote: string[] = []
  page.on('request', request => { if (/^https?:/.test(request.url()) && !request.url().startsWith(baseUrl)) remote.push(request.url()) })
  try {
    await preparePage(page)
    const result = await page.evaluate(async () => {
      const { __importCustomIcon: importCustomIcon } = globalThis as typeof globalThis & { __importCustomIcon: typeof import('./import.ts').importCustomIcon }
      const nativeDecode = Image.prototype.decode
      let decodes = 0
      Image.prototype.decode = function () { decodes++; return nativeDecode.call(this) }
      const markups = [
        '<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>',
        '<?xml-stylesheet href="https://example.invalid/style.css"?><svg xmlns="http://www.w3.org/2000/svg"/>',
        '<!DOCTYPE svg [<!ENTITY image SYSTEM "file:///private">]><svg xmlns="http://www.w3.org/2000/svg"/>',
        '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject><div xmlns="http://www.w3.org/1999/xhtml"/></foreignObject></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>',
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="https://example.invalid/remote.svg#x"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><use href="&#104;ttps://example.invalid/remote.svg#x"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:url(https://example.invalid/image)"/></svg>',
        '<svg xmlns="http://www.w3.org/2000/svg"><image href="data:image/png;base64,AAAA"/></svg>',
        '<html><img src="https://example.invalid/image" onerror="alert(1)"/></html>',
        '<svg xmlns="http://www.w3.org/2000/svg"><g></svg>',
      ]
      const errors: string[] = []
      for (const markup of markups) {
        try { await importCustomIcon(new File([markup], 'unsafe.svg', { type: 'image/svg+xml' })); errors.push('accepted') }
        catch (error) { errors.push((error as Error).message) }
      }
      return { errors, decodes, liveMarkup: document.querySelectorAll('svg,script,img').length }
    })
    assert.equal(result.errors.length, 12)
    assert.ok(result.errors.every(error => error.startsWith('Could not import image.')))
    assert.equal(result.decodes, 0)
    assert.equal(result.liveMarkup, 0)
    assert.deepEqual(remote, [])
  } finally { await page.close() }
}, 60000)

test('should_reject_invalid_deflate_on_upload_when_structure_and_crc_alone_cannot_certify_pixels', async () => {
  const png = pngBytes()
  const corrupt = Buffer.concat([png.subarray(0, 33), pngChunk('IDAT', Buffer.from([120, 156, 7, 0, 0, 0, 0])), png.subarray(-12)])
  assert.ok(validateCustomIcon({ ...iconFixture(), dataUrl: `data:image/png;base64,${corrupt.toString('base64')}` }).ok)
  const page = await browser.newPage()
  try {
    await preparePage(page)
    const result = await page.evaluate(async bytes => {
      const { __importCustomIcon: importCustomIcon } = globalThis as typeof globalThis & { __importCustomIcon: typeof import('./import.ts').importCustomIcon }
      try { await importCustomIcon(new File([new Uint8Array(bytes)], 'corrupt.png', { type: 'image/png' })); return 'accepted' }
      catch (error) { return (error as Error).message }
    }, [...corrupt])
    assert.match(result, /^Could not import image\./)
  } finally { await page.close() }
}, 60000)