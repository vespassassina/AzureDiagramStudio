// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { URL as FileURL } from 'node:url'
import { inflateSync } from 'node:zlib'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ReactFlowProvider } from '@xyflow/react'
import { test } from 'vitest'
import type { EditorProps } from './contracts.ts'
import { createDocument } from './model.ts'
import EditorSurface from './editor/EditorSurface.tsx'

const asset = (path: string) => readFileSync(new FileURL(`../public/${path}`, import.meta.url))
const iconSizes = [16, 24, 32, 48, 64, 128, 256]

// Decode every PNG scanline, undo its filter, then count visible brand colors.
// Validate chunk CRCs too: a plausible directory must not mask corrupt icon bytes.
function pngPixels(bytes: Buffer, size: number) {
  assert.deepEqual(bytes.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  assert.equal(bytes.readUInt32BE(16), size)
  assert.equal(bytes.readUInt32BE(20), size)
  assert.equal(bytes[24], 8)
  assert.equal(bytes[25], 6)
  assert.equal(bytes[28], 0)
  const compressed: Buffer[] = []
  const chunks: string[] = []
  let offset = 8
  while (offset < bytes.length) {
    const length = bytes.readUInt32BE(offset)
    const type = bytes.toString('ascii', offset + 4, offset + 8)
    chunks.push(type)
    const payload = bytes.subarray(offset + 4, offset + 8 + length)
    let crc = 0xffffffff
    for (const byte of payload) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    assert.equal(bytes.readUInt32BE(offset + 8 + length), (crc ^ 0xffffffff) >>> 0)
    if (type === 'IDAT') compressed.push(bytes.subarray(offset + 8, offset + 8 + length))
    offset += length + 12
  }
  assert.equal(offset, bytes.length)
  assert.deepEqual(chunks, ['IHDR', 'IDAT', 'IEND'], 'No timestamps or platform-specific metadata')
  const scanlines = inflateSync(Buffer.concat(compressed))
  assert.equal(scanlines.length, size * (size * 4 + 1))
  const pixels = Buffer.alloc(size * size * 4)
  for (let row = 0; row < size; row++) {
    const filter = scanlines[row * (size * 4 + 1)]
    assert.ok(filter <= 4)
    for (let column = 0; column < size * 4; column++) {
      const index = row * size * 4 + column
      const left = column >= 4 ? pixels[index - 4] : 0
      const above = row ? pixels[index - size * 4] : 0
      const diagonal = row && column >= 4 ? pixels[index - size * 4 - 4] : 0
      const estimate = left + above - diagonal
      const distances = [Math.abs(estimate - left), Math.abs(estimate - above), Math.abs(estimate - diagonal)]
      const paeth = distances[0] <= distances[1] && distances[0] <= distances[2] ? left : distances[1] <= distances[2] ? above : diagonal
      const predictor = [0, left, above, Math.floor((left + above) / 2), paeth][filter]
      pixels[index] = (scanlines[row * (size * 4 + 1) + column + 1] + predictor) & 255
    }
  }
  let ink = 0, white = 0, blue = 0, teal = 0, transparent = 0
  for (let index = 0; index < pixels.length; index += 4) {
    const [red, green, blueChannel, alpha] = pixels.subarray(index, index + 4)
    if (!alpha) transparent++
    if (alpha < 128) continue
    if (red > 230 && green > 230 && blueChannel > 230) white++
    else ink++
    if (blueChannel > green * 1.15 && blueChannel > red * 1.8) blue++
    if (green > red * 1.8 && green > blueChannel * 1.05) teal++
  }
  for (const [color, count] of Object.entries({ ink, white, blue, teal, transparent })) assert.ok(count > size * size * .015, `Visible ${color} at ${size}px`)
  return pixels
}

// Validate classic Windows header, bottom-up BGRA bytes and transparent mask.
// Compare with the separately decoded PNG so every entry has the same artwork.
function assertDib(bytes: Buffer, size: number, expected: Buffer) {
  const maskStride = Math.ceil(size / 32) * 4
  const pixelLength = size * size * 4
  assert.equal(bytes.length, 40 + pixelLength + maskStride * size)
  assert.equal(bytes.readUInt32LE(0), 40)
  assert.equal(bytes.readInt32LE(4), size)
  assert.equal(bytes.readInt32LE(8), size * 2)
  assert.equal(bytes.readUInt16LE(12), 1)
  assert.equal(bytes.readUInt16LE(14), 32)
  assert.equal(bytes.readUInt32LE(16), 0)
  assert.equal(bytes.readUInt32LE(20), pixelLength + maskStride * size)
  const actual = Buffer.alloc(pixelLength)
  const mask = Buffer.alloc(maskStride * size)
  for (let row = 0; row < size; row++) {
    for (let column = 0; column < size; column++) {
      const target = (row * size + column) * 4
      const source = 40 + ((size - row - 1) * size + column) * 4
      actual[target] = bytes[source + 2]
      actual[target + 1] = bytes[source + 1]
      actual[target + 2] = bytes[source]
      actual[target + 3] = bytes[source + 3]
      if (!expected[target + 3]) mask[(size - row - 1) * maskStride + Math.floor(column / 8)] |= 0x80 >>> (column % 8)
    }
  }
  assert.deepEqual(actual, expected)
  assert.deepEqual(bytes.subarray(40 + pixelLength), mask)
}

test('should_show_exact_product_name_when_editor_header_is_rendered', () => {
  const noop = () => {}
  const props: EditorProps = { document: createDocument('brand-only'), readOnly: false, saveState: 'saved', backupDirty: false, canUndo: false, canRedo: false, isArranging: false, isExporting: false, message: '', onCommand: noop, onPreviewChange: noop, onUndo: noop, onRedo: noop, onArrange: noop, onNew: noop, onOpen: noop, onImport: noop, onSaveJson: noop, onExport: noop, onChooseStarter: () => false }
  const container = document.createElement('div')
  container.innerHTML = renderToStaticMarkup(createElement(ReactFlowProvider, null, createElement(EditorSurface, props)))
  const brand = container.querySelector('.wordmark')!
  assert.equal(brand.textContent, 'Azure Diagram Studio')
  assert.equal(brand.getAttribute('aria-label'), 'Azure Diagram Studio')
  const image = brand.querySelector('img')!
  assert.equal(image.getAttribute('src'), './branding/logo.svg')
  assert.equal(image.getAttribute('alt'), '')
  assert.equal(brand.querySelector('svg'), null, 'Only the product mark changes; tool icons stay Lucide')
})

test('should_use_local_svg_and_ico_favicons_when_document_head_is_loaded', () => {
  const html = document.createElement('html')
  html.innerHTML = readFileSync(new FileURL('../index.html', import.meta.url), 'utf8')
  assert.equal(html.querySelector('title')?.textContent, 'Azure Diagram Studio')
  assert.equal(html.querySelector('meta[name="theme-color"]')?.getAttribute('content'), '#117865')
  assert.deepEqual([...html.querySelectorAll('link[rel="icon"]')].map(link => [link.getAttribute('type'), link.getAttribute('href')]), [['image/svg+xml', './favicon.svg'], ['image/x-icon', './favicon.ico']])
})

test('should_preserve_original_self_contained_svg_when_brand_sources_are_read', () => {
  const logo = asset('branding/logo.svg').toString('utf8')
  const favicon = asset('favicon.svg').toString('utf8')
  assert.equal(favicon, logo)
  assert.match(logo, /viewBox="0 0 64 64"/)
  assert.match(logo, /<title[^>]*>Azure Diagram Studio<\/title>/)
  assert.match(logo, /<desc[^>]*>Original.*three.*nodes/i)
  assert.equal((logo.match(/data-tile=/g) ?? []).length, 3)
  assert.doesNotMatch(logo, /<(?:image|script|foreignObject)|(?:href|url\()|microsoft|fabric|timestamp|date=/i)
})

test('should_decode_nonblank_deterministic_pngs_when_brand_rasters_are_opened', () => {
  for (const size of [16, 32, 256, 512]) pngPixels(asset(`branding/logo-${size}.png`), size)
})

test('should_expose_valid_windows_entries_with_png_large_frame_when_ico_is_read', () => {
  for (const file of ['branding/app-icon.ico', 'favicon.ico']) {
    const bytes = asset(file)
    assert.equal(bytes.readUInt16LE(0), 0)
    assert.equal(bytes.readUInt16LE(2), 1)
    assert.equal(bytes.readUInt16LE(4), iconSizes.length)
    let nextOffset = 6 + iconSizes.length * 16
    for (const [index, size] of iconSizes.entries()) {
      const entry = 6 + index * 16
      assert.equal(bytes[entry] || 256, size)
      assert.equal(bytes[entry + 1] || 256, size)
      assert.equal(bytes[entry + 2], 0)
      assert.equal(bytes[entry + 3], 0)
      assert.equal(bytes.readUInt16LE(entry + 4), 1)
      assert.equal(bytes.readUInt16LE(entry + 6), 32)
      const length = bytes.readUInt32LE(entry + 8)
      assert.equal(bytes.readUInt32LE(entry + 12), nextOffset)
      const frame = bytes.subarray(nextOffset, nextOffset + length)
      const png = asset(`branding/logo-${size}.png`)
      const expected = pngPixels(png, size)
      if (size === 256) {
        pngPixels(frame, size)
        assert.deepEqual(frame, png)
      } else assertDib(frame, size, expected)
      nextOffset += length
    }
    assert.equal(nextOffset, bytes.length, 'No missing frames or trailing bytes')
  }
  assert.deepEqual(asset('favicon.ico'), asset('branding/app-icon.ico'))
})

test('should_include_uncompressed_frames_when_legacy_windows_packagers_read_icon', () => {
  const bytes = asset('branding/app-icon.ico')
  for (let index = 0; index < iconSizes.length - 1; index++) {
    const offset = bytes.readUInt32LE(6 + index * 16 + 12)
    assert.equal(bytes.readUInt32LE(offset), 40, 'Small icon frames carry a Windows BITMAPINFOHEADER for NSIS/legacy readers')
  }
  const offset = bytes.readUInt32LE(6 + (iconSizes.length - 1) * 16 + 12)
  assert.deepEqual(bytes.subarray(offset, offset + 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), 'The large frame remains PNG-backed')
})