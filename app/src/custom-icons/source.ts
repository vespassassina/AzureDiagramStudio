import { MAX_SOURCE_ICON_DIMENSION, MAX_SOURCE_ICON_PIXELS } from './contract.ts'

export type RasterSource = { mime: string; width: number; height: number; bytes: Uint8Array }

export function checkSourceDimensions(width: number, height: number): void {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_SOURCE_ICON_DIMENSION || height > MAX_SOURCE_ICON_DIMENSION || width * height > MAX_SOURCE_ICON_PIXELS) {
    throw new Error('Image source dimensions exceed the 16000000-pixel or 16384px limit; resize the original before importing')
  }
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(start, start + length))
}

function jpegDimensions(bytes: Uint8Array, view: DataView): { width: number; height: number } {
  let offset = 2
  while (offset + 4 <= bytes.length) {
    if (bytes[offset++] !== 255) break
    while (bytes[offset] === 255) offset++
    const marker = bytes[offset++]
    if (marker === 0xd9 || marker === 0xda || marker === 0) break
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue
    if (offset + 2 > bytes.length) break
    const length = view.getUint16(offset)
    if (length < 2 || offset + length > bytes.length) break
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (length < 8 || bytes[offset + 2] !== 8) break
      return { width: view.getUint16(offset + 5), height: view.getUint16(offset + 3) }
    }
    offset += length
  }
  throw new Error('JPEG has no valid bounded frame header; re-save the original image')
}

/** Skip GIF tables/extensions without decoding pixels; validate frame bounds; end the first complete image with a trailer to remove timing races. */
function firstGifFrame(bytes: Uint8Array, view: DataView, width: number, height: number): Uint8Array {
  let offset = 13 + ((bytes[10] & 128) ? 3 * (1 << ((bytes[10] & 7) + 1)) : 0)
  const skipBlocks = () => {
    while (offset < bytes.length) {
      const length = bytes[offset++]
      if (!length) return
      offset += length
      if (offset > bytes.length) break
    }
    throw new Error('GIF has a truncated data block')
  }
  while (offset < bytes.length) {
    const marker = bytes[offset++]
    if (marker === 0x21) {
      offset++
      skipBlocks()
      continue
    }
    if (marker !== 0x2c || offset + 9 > bytes.length) break
    const left = view.getUint16(offset, true)
    const top = view.getUint16(offset + 2, true)
    const frameWidth = view.getUint16(offset + 4, true)
    const frameHeight = view.getUint16(offset + 6, true)
    checkSourceDimensions(frameWidth, frameHeight)
    if (left + frameWidth > width || top + frameHeight > height) throw new Error('GIF first-frame dimensions exceed its canvas')
    const packed = bytes[offset + 8]
    offset += 9 + ((packed & 128) ? 3 * (1 << ((packed & 7) + 1)) : 0)
    const codeSize = bytes[offset++]
    if (codeSize < 2 || codeSize > 8) break
    skipBlocks()
    const still = new Uint8Array(offset + 1)
    still.set(bytes.subarray(0, offset))
    still[offset] = 0x3b
    return still
  }
  throw new Error('GIF has no valid first image frame; re-save the original image')
}

function webpDimensions(bytes: Uint8Array, view: DataView): { width: number; height: number } {
  if (view.getUint32(4, true) !== bytes.length - 8) throw new Error('WebP has an invalid RIFF length')
  const kind = ascii(bytes, 12, 4)
  const length = view.getUint32(16, true)
  if (length > bytes.length - 20) throw new Error('WebP has a truncated image header')
  if (kind === 'VP8X' && length === 10 && bytes.length >= 30) {
    const uint24 = (offset: number) => bytes[offset] + bytes[offset + 1] * 256 + bytes[offset + 2] * 65536
    return { width: uint24(24) + 1, height: uint24(27) + 1 }
  }
  if (kind === 'VP8L' && length >= 5 && bytes[20] === 0x2f) {
    const bits = view.getUint32(21, true)
    return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }
  }
  if (kind === 'VP8 ' && length >= 10 && ascii(bytes, 23, 3) === '\u009d\u0001*') return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff }
  throw new Error('WebP has no supported bounded frame header')
}

/** Sniff actual bytes, reject a conflicting declared MIME, and bound dimensions before the one native decode. BMP is intentionally unverified/unsupported. */
export function inspectRasterSource(bytes: Uint8Array, declaredMime: string): RasterSource {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let mime = ''
  let dimensions: { width: number; height: number }
  let source = bytes
  if (bytes.length >= 33 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte) && view.getUint32(8) === 13 && ascii(bytes, 12, 4) === 'IHDR') {
    mime = 'image/png'
    dimensions = { width: view.getUint32(16), height: view.getUint32(20) }
  } else if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 0xd8 && bytes[2] === 255) {
    mime = 'image/jpeg'
    dimensions = jpegDimensions(bytes, view)
  } else if (bytes.length >= 13 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) {
    mime = 'image/gif'
    dimensions = { width: view.getUint16(6, true), height: view.getUint16(8, true) }
    checkSourceDimensions(dimensions.width, dimensions.height)
    source = firstGifFrame(bytes, view, dimensions.width, dimensions.height)
  } else if (bytes.length >= 25 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    mime = 'image/webp'
    dimensions = webpDimensions(bytes, view)
  } else throw new Error('Unsupported or corrupt image format; choose SVG, PNG, JPEG, GIF or WebP')
  if (declaredMime && declaredMime !== mime && !(mime === 'image/jpeg' && declaredMime === 'image/jpg')) throw new Error('Image format does not match its declared media type; re-save the original image')
  checkSourceDimensions(dimensions.width, dimensions.height)
  return { mime, ...dimensions, bytes: source }
}