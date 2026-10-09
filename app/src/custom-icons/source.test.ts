import assert from 'node:assert/strict'
import { test } from 'vitest'
import { checkSourceDimensions, inspectRasterSource } from './source.ts'
import { pngBytes } from './test-fixtures.ts'

test('should_enforce_exact_16_million_pixel_bounds_when_source_dimensions_are_supplied', () => {
  checkSourceDimensions(4000, 4000)
  checkSourceDimensions(16384, 1)
  for (const [width, height] of [[4096, 4096], [4000, 4001], [16385, 1], [0, 1], [1.5, 2], [Infinity, 1]]) assert.throws(() => checkSourceDimensions(width, height), /dimension|pixel/)
})

test('should_read_png_jpeg_gif_and_webp_dimensions_before_any_native_decode', () => {
  const jpeg = Buffer.from([255,216,255,192,0,11,8,0,20,0,40,1,1,17,0,255,217])
  const gif = Buffer.from([71,73,70,56,57,97,1,0,1,0,128,0,0,255,0,0,0,255,0,44,0,0,0,0,1,0,1,0,0,2,2,68,1,0,59])
  const webp = Buffer.alloc(30)
  webp.write('RIFF', 0)
  webp.writeUInt32LE(22, 4)
  webp.write('WEBPVP8X', 8)
  webp.writeUInt32LE(10, 16)
  webp[24] = 39
  webp[27] = 19
  for (const [bytes, mime, width, height] of [[pngBytes(), 'image/png', 2, 1], [jpeg, 'image/jpeg', 40, 20], [gif, 'image/gif', 1, 1], [webp, 'image/webp', 40, 20]] as const) {
    const source = inspectRasterSource(bytes, mime)
    assert.deepEqual([source.mime, source.width, source.height], [mime, width, height])
  }
  assert.equal(inspectRasterSource(jpeg, 'image/jpg').mime, 'image/jpeg')
  assert.equal(inspectRasterSource(pngBytes(), '').mime, 'image/png')
})

test('should_reject_declared_format_mismatches_and_truncated_headers_when_bytes_are_untrusted', () => {
  for (const input of [Buffer.from('BM'), Buffer.from('GIF89a'), Buffer.from([255,216,255,192,0,64]), Buffer.alloc(25)]) assert.throws(() => inspectRasterSource(input, ''), /format|header/)
  assert.throws(() => inspectRasterSource(pngBytes(), 'image/jpeg'), /format/)
  const bomb = Buffer.from(pngBytes())
  bomb.writeUInt32BE(4096, 16)
  bomb.writeUInt32BE(4096, 20)
  assert.throws(() => inspectRasterSource(bomb, 'image/png'), /pixel|dimension/)
})

test('should_reject_gif_frame_bounds_when_the_logical_canvas_would_hide_oversized_pixels', () => {
  const bytes = Buffer.from([71,73,70,56,57,97,1,0,1,0,128,0,0,255,0,0,0,255,0,44,0,0,0,0,255,255,255,255,0,2,2,68,1,0,59])
  assert.throws(() => inspectRasterSource(bytes, 'image/gif'), /dimension|pixel/)
})