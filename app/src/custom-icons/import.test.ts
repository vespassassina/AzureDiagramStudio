// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { File as NativeFile } from 'node:buffer'
import { afterEach, test, vi } from 'vitest'
import { importCustomIcon } from './import.ts'
import { MAX_RAW_ICON_BYTES, validateCustomIcon } from './contract.ts'
import { iconFixture, pngBytes } from './test-fixtures.ts'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function file(bytes: Uint8Array | string, name = 'image.png', type = 'image/png'): File {
  return new NativeFile([typeof bytes === 'string' ? bytes : Buffer.from(bytes)], name, { type }) as unknown as File
}

function nativeCanvas(width = 2, height = 1) {
  const close = vi.fn()
  const decode = vi.fn(async () => ({ width, height, close }))
  const drawImage = vi.fn()
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toDataURL: () => iconFixture(canvas.width, canvas.height).dataUrl }
  const create = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string, options?: ElementCreationOptions) => tag === 'canvas' ? canvas as unknown as HTMLCanvasElement : create(tag, options)) as typeof document.createElement)
  vi.stubGlobal('createImageBitmap', decode)
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL() { return 'blob:test' }
    static revokeObjectURL() { close() }
  })
  vi.stubGlobal('Image', class {
    naturalWidth = width
    naturalHeight = height
    src = ''
    async decode() { await decode() }
  })
  return { close, decode, drawImage, canvas }
}

test('should_decode_once_and_release_native_pixels_when_importing_a_real_png', async () => {
  const native = nativeCanvas()
  const result = await importCustomIcon(file(pngBytes()))
  assert.ok(validateCustomIcon(result).ok)
  assert.equal(result.name, 'image.png')
  assert.equal(native.decode.mock.calls.length, 1)
  assert.equal(native.close.mock.calls.length, 1)
  assert.equal(native.drawImage.mock.calls.length, 1)
})

test('should_downscale_aspect_without_metadata_when_source_is_larger_than_512', async () => {
  const native = nativeCanvas(1024, 512)
  const result = await importCustomIcon(file(pngBytes(1024, 512), 'x'.repeat(125)))
  assert.equal(result.width, 512)
  assert.equal(result.height, 256)
  assert.equal(result.name.length, 120)
  assert.equal(native.decode.mock.calls.length, 1)
  assert.deepEqual(Object.keys(result), ['name', 'dataUrl', 'width', 'height'])
})

test.each(['<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"/>', '<!DOCTYPE svg [<!ENTITY x "bad">]><svg/>', '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><foreignObject/></svg>', '<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>', '<svg xmlns="http://www.w3.org/2000/svg"><image href="https://evil/image.png"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><use href="data:image/png;base64,AAAA"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><rect fill="url(https://evil)"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><style>@import "https://evil";</style></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><rect style="fill:u\\72l(https://evil)"/></svg>', '<html/>', '<svg xmlns="http://www.w3.org/2000/svg"><g></svg>', '<svg xmlns="http://www.w3.org/2000/svg"><animate attributeName="href"/></svg>', '<svg xmlns="http://www.w3.org/2000/svg" width="100000" height="1"/>'])('should_reject_unsafe_xml_before_native_decode_when_svg_is_%s', async markup => {
  const native = nativeCanvas()
  await assert.rejects(importCustomIcon(file(markup, 'unsafe.svg', 'image/svg+xml')), /SVG|XML|source/i)
  assert.equal(native.decode.mock.calls.length, 0)
})

test('should_rasterize_only_sanitized_inert_markup_when_svg_is_valid', async () => {
  const native = nativeCanvas(100, 50)
  const result = await importCustomIcon(file('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 50"><rect width="100" height="50" fill="#ff0000" opacity="0.5"/></svg>', 'art.svg', 'image/svg+xml'))
  assert.equal(result.width, 100)
  assert.equal(result.height, 50)
  assert.ok(result.dataUrl.startsWith('data:image/png;base64,'))
  assert.equal(native.decode.mock.calls.length, 1)
})

test('should_reject_raw_caps_formats_signature_and_pixel_bombs_before_decoding', async () => {
  const native = nativeCanvas()
  const bomb = Buffer.from(pngBytes())
  bomb.writeUInt32BE(8192, 16)
  bomb.writeUInt32BE(8192, 20)
  for (const input of [file(new Uint8Array(MAX_RAW_ICON_BYTES + 1)), file('not an image'), file(pngBytes(), 'wrong.jpg', 'image/jpeg'), file('BM', 'image.bmp', 'image/bmp'), file(bomb)]) await assert.rejects(importCustomIcon(input), /2 MiB|format|PNG|dimension|pixel|supported/i)
  assert.equal(native.decode.mock.calls.length, 0)
})

test('should_release_decoded_pixels_when_rasterization_fails', async () => {
  const native = nativeCanvas()
  native.canvas.toDataURL = () => { throw new Error('canvas unavailable') }
  await assert.rejects(importCustomIcon(file(pngBytes())), /image|PNG|raster/i)
  assert.equal(native.close.mock.calls.length, 1)
})

test('should_use_conservative_svg_defaults_and_preserve_safe_inline_styles_when_dimensions_are_absent', async () => {
  const native = nativeCanvas(512, 512)
  const result = await importCustomIcon(file('<svg xmlns="http://www.w3.org/2000/svg"><rect width="32" height="16" style="fill:#ff0000;opacity:0.5"/></svg>', 'default.svg', 'image/svg+xml'))
  assert.deepEqual([result.width, result.height], [512, 512])
  assert.equal(native.close.mock.calls.length, 1)
})

test('should_reject_impossible_encoded_output_and_release_pixels_when_no_png_fits_the_cap', async () => {
  const native = nativeCanvas(512, 512)
  native.canvas.toDataURL = () => 'data:image/png;base64,' + 'A'.repeat(384 * 1024)
  await assert.rejects(importCustomIcon(file(pngBytes(512, 512))), /384 KiB/)
  assert.equal(native.close.mock.calls.length, 1)
  assert.equal(native.decode.mock.calls.length, 1)
})

test('should_revoke_svg_blob_urls_when_native_decode_rejects_the_image', async () => {
  const native = nativeCanvas()
  native.decode.mockRejectedValue(new Error('Native decode failed'))
  await assert.rejects(importCustomIcon(file('<svg xmlns="http://www.w3.org/2000/svg"/>', 'corrupt.svg', 'image/svg+xml')), /Native decode failed/)
  assert.equal(native.decode.mock.calls.length, 1)
  assert.equal(native.close.mock.calls.length, 1)
})

test('should_reject_source_pixel_bombs_in_every_supported_native_header_before_decoding', async () => {
  const native = nativeCanvas()
  const jpeg = Buffer.from([255,216,255,192,0,11,8,16,0,16,0,1,1,17,0,255,217])
  const gif = Buffer.from([71,73,70,56,57,97,0,16,0,16,128,0,0,255,0,0,0,255,0])
  const webp = Buffer.alloc(30)
  webp.write('RIFF', 0)
  webp.writeUInt32LE(22, 4)
  webp.write('WEBPVP8X', 8)
  webp.writeUInt32LE(10, 16)
  webp[24] = 255
  webp[25] = 15
  webp[27] = 255
  webp[28] = 15
  for (const [bytes, type] of [[jpeg, 'image/jpeg'], [gif, 'image/gif'], [webp, 'image/webp']] as const) await assert.rejects(importCustomIcon(file(bytes, 'bomb', type)), /16000000-pixel/)
  assert.equal(native.decode.mock.calls.length, 0)
})