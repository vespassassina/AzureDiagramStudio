import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { deflateSync } from 'node:zlib'
import { chromium } from '@playwright/test'

const publicRoot = new URL('../public/', import.meta.url)
export const iconSizes = [16, 24, 32, 48, 64, 128, 256]

// Encode canonical PNG chunks from raw Edge pixels, with no browser metadata.
// Fixed scanline filters and compression keep cached outputs byte-repeatable.
function chunk(type, data) {
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const result = Buffer.alloc(data.length + 12)
  result.writeUInt32BE(data.length)
  body.copy(result, 4)
  let crc = 0xffffffff
  for (const byte of body) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  result.writeUInt32BE((crc ^ 0xffffffff) >>> 0, result.length - 4)
  return result
}

function encodePng(size, pixels) {
  assert.equal(pixels.length, size * size * 4)
  const header = Buffer.alloc(13)
  header.writeUInt32BE(size, 0)
  header.writeUInt32BE(size, 4)
  header[8] = 8
  header[9] = 6
  const stride = size * 4
  const scanlines = Buffer.alloc((stride + 1) * size)
  for (let row = 0; row < size; row++) pixels.copy(scanlines, row * (stride + 1) + 1, row * stride, (row + 1) * stride)
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(scanlines, { level: 9 })), chunk('IEND', Buffer.alloc(0))])
}

// Write a classic 32-bit DIB and padded AND mask for small NSIS/legacy frames.
// Reverse rows for Windows, preserve alpha, and mask only fully clear pixels.
function encodeDib(size, pixels) {
  const maskStride = Math.ceil(size / 32) * 4
  const pixelLength = size * size * 4
  const dib = Buffer.alloc(40 + pixelLength + maskStride * size)
  dib.writeUInt32LE(40, 0)
  dib.writeInt32LE(size, 4)
  dib.writeInt32LE(size * 2, 8)
  dib.writeUInt16LE(1, 12)
  dib.writeUInt16LE(32, 14)
  dib.writeUInt32LE(pixelLength + maskStride * size, 20)
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const source = (row * size + column) * 4
      const target = 40 + ((size - row - 1) * size + column) * 4
      dib[target] = pixels[source + 2]
      dib[target + 1] = pixels[source + 1]
      dib[target + 2] = pixels[source]
      dib[target + 3] = pixels[source + 3]
      if (!pixels[source + 3]) dib[40 + pixelLength + (size - row - 1) * maskStride + Math.floor(column / 8)] |= 0x80 >>> (column % 8)
    }
  }
  return dib
}

// Pack ascending DIB frames plus a 256px PNG into Windows ICONDIR entries.
// A dimension byte of zero means 256; offsets point to complete frame streams.
function encodeIco(pngs, pixels) {
  const frames = iconSizes.map(size => size === 256 ? pngs.get(size) : encodeDib(size, pixels.get(size)))
  const directory = Buffer.alloc(6 + iconSizes.length * 16)
  directory.writeUInt16LE(1, 2)
  directory.writeUInt16LE(iconSizes.length, 4)
  let offset = directory.length
  for (const [index, size] of iconSizes.entries()) {
    const entry = 6 + index * 16
    const frame = frames[index]
    directory[entry] = size === 256 ? 0 : size
    directory[entry + 1] = size === 256 ? 0 : size
    directory.writeUInt16LE(1, entry + 4)
    directory.writeUInt16LE(32, entry + 6)
    directory.writeUInt32LE(frame.length, entry + 8)
    directory.writeUInt32LE(offset, entry + 12)
    offset += frame.length
  }
  return Buffer.concat([directory, ...frames])
}

// Read the original vector; rasterize each size directly in offline Edge.
// Encode PNGs and ICO once, then optionally write only the owned brand paths.
export async function generateBrand({ write = true } = {}) {
  const source = await readFile(new URL('branding/logo.svg', publicRoot))
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  const pngs = new Map()
  const pixels = new Map()
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 })
    await page.route('**/*', route => route.abort())
    await page.setContent('<canvas></canvas>')
    for (const size of [...iconSizes, 512]) {
      const raw = await page.evaluate(async ({ svg, size }) => {
        const image = new Image()
        image.src = `data:image/svg+xml;base64,${svg}`
        await image.decode()
        const canvas = document.querySelector('canvas')
        canvas.width = size
        canvas.height = size
        const context = canvas.getContext('2d', { willReadFrequently: true })
        context.drawImage(image, 0, 0, size, size)
        const pixels = context.getImageData(0, 0, size, size).data
        let binary = ''
        for (let offset = 0; offset < pixels.length; offset += 8192) binary += String.fromCharCode(...pixels.subarray(offset, offset + 8192))
        return btoa(binary)
      }, { svg: source.toString('base64'), size })
      const rgba = Buffer.from(raw, 'base64')
      pixels.set(size, rgba)
      pngs.set(size, encodePng(size, rgba))
    }
  } finally {
    await browser.close()
  }
  const ico = encodeIco(pngs, pixels)
  const artifacts = new Map([['favicon.svg', source], ...[...pngs].map(([size, bytes]) => [`branding/logo-${size}.png`, bytes]), ['branding/app-icon.ico', ico], ['favicon.ico', ico]])
  if (write) {
    await mkdir(new URL('branding/', publicRoot), { recursive: true })
    for (const [path, bytes] of artifacts) await writeFile(new URL(path, publicRoot), bytes)
  }
  return artifacts
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const artifacts = await generateBrand()
  for (const [path, bytes] of artifacts) console.log(`${path}: ${bytes.length} bytes`)
}