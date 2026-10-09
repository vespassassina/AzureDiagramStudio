export type CustomIcon = { name: string; dataUrl: string; width: number; height: number }
export type CustomIconValidation = { ok: true; value: CustomIcon } | { ok: false; error: string }

export const MAX_CUSTOM_ICON_NAME_LENGTH = 120
export const MAX_CUSTOM_ICON_DIMENSION = 512
export const MAX_CUSTOM_ICON_ENCODED_BYTES = 384 * 1024
export const PNG_DATA_URL_PREFIX = 'data:image/png;base64,'
export const MAX_CUSTOM_ICON_DECODED_BYTES = Math.floor((MAX_CUSTOM_ICON_ENCODED_BYTES - PNG_DATA_URL_PREFIX.length) / 4) * 3
export const MAX_RAW_ICON_BYTES = 2 * 1024 * 1024
export const MAX_SOURCE_ICON_PIXELS = 16_000_000
export const MAX_SOURCE_ICON_DIMENSION = 16384
export const MAX_SVG_ICON_DIMENSION = 4096
export const DEFAULT_SVG_ICON_DIMENSION = 512

const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10]
const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let crc = index
  for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  return crc >>> 0
})

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 255]
  return (crc ^ 0xffffffff) >>> 0
}

/** Walk a bounded, non-animated canvas PNG: signature, IHDR, ordered chunks, CRCs, zlib envelope, exact IEND. No metadata or unknown chunks. */
function pngDimensions(bytes: Uint8Array): { width: number; height: number } | undefined {
  if (bytes.length < 57 || !pngSignature.every((byte, index) => bytes[index] === byte)) return
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 8
  let width = 0
  let height = 0
  let imageBytes = 0
  const zlibHeader: number[] = []
  const seen = new Set<string>()
  for (let count = 0; offset + 12 <= bytes.length && count < 1024; count++) {
    const length = view.getUint32(offset)
    if (length > bytes.length - offset - 12) return
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, offset + 8 + length)
    if (crc32(bytes.subarray(offset + 4, offset + 8 + length)) !== view.getUint32(offset + 8 + length)) return
    if (!width && type !== 'IHDR') return
    if (type === 'IHDR') {
      if (seen.has(type) || length !== 13) return
      width = view.getUint32(offset + 8)
      height = view.getUint32(offset + 12)
      if (!width || !height || width > MAX_CUSTOM_ICON_DIMENSION || height > MAX_CUSTOM_ICON_DIMENSION) return
      if (data[8] !== 8 || ![0, 2, 4, 6].includes(data[9]) || data[10] || data[11] || data[12]) return
    } else if (type === 'IDAT') {
      for (const byte of data.subarray(0, Math.max(0, 2 - zlibHeader.length))) zlibHeader.push(byte)
      imageBytes += length
    } else if (type === 'IEND') {
      if (length || !seen.has('IDAT') || imageBytes < 6 || offset + 12 !== bytes.length) return
      const [method, flags] = zlibHeader
      if ((method & 15) !== 8 || (method >>> 4) > 7 || ((method << 8) + flags) % 31 || (flags & 32)) return
      return { width, height }
    } else {
      const safeSizes: Record<string, number> = { sRGB: 1, gAMA: 4, cHRM: 32, pHYs: 9 }
      if (!Object.hasOwn(safeSizes, type) || safeSizes[type] !== length || seen.has(type) || seen.has('IDAT')) return
    }
    seen.add(type)
    offset += length + 12
  }
}

// Adapter cache: immutable PNG strings only, never caller objects; bounded to 16 entries AND 4 MiB of encoded text.
const pngCache = new Map<string, Readonly<{ width: number; height: number }>>()
let cachedBytes = 0
function remember(dataUrl: string, dimensions: { width: number; height: number }) {
  while (pngCache.size >= 16 || cachedBytes + dataUrl.length > 4 * 1024 * 1024) {
    const oldest = pngCache.keys().next().value!
    cachedBytes -= oldest.length
    pngCache.delete(oldest)
  }
  pngCache.set(dataUrl, Object.freeze(dimensions))
  cachedBytes += dataUrl.length
}

/** Inspect descriptors before reading; bound text before decode; validate immutable bytes once; recheck mutable fields on every call. */
export function validateCustomIcon(input: unknown): CustomIconValidation {
  const invalid = (error: string): CustomIconValidation => ({ ok: false, error })
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid('Custom icon must be a plain four-field object')
    const prototype = Object.getPrototypeOf(input)
    if (prototype !== null && prototype !== Object.prototype) return invalid('Custom icon must have an inert JSON prototype')
    const descriptors = Object.getOwnPropertyDescriptors(input)
    const keys = Reflect.ownKeys(descriptors)
    if (keys.length !== 4 || !['name', 'dataUrl', 'width', 'height'].every(key => Object.hasOwn(descriptors, key))) return invalid('Custom icon must contain only name, dataUrl, width and height')
    if (keys.some(key => typeof key !== 'string' || !('value' in descriptors[key]) || !descriptors[key].enumerable)) return invalid('Custom icon must not contain getters or hidden fields')
    const { name, dataUrl, width, height } = input as CustomIcon
    if (typeof name !== 'string' || !name.length || name.length > MAX_CUSTOM_ICON_NAME_LENGTH) return invalid('Custom icon name must contain 1-120 characters')
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width > MAX_CUSTOM_ICON_DIMENSION || height > MAX_CUSTOM_ICON_DIMENSION) return invalid('Custom icon dimensions must be integers from 1 to 512')
    if (typeof dataUrl !== 'string' || dataUrl.length > MAX_CUSTOM_ICON_ENCODED_BYTES || !dataUrl.startsWith(PNG_DATA_URL_PREFIX)) return invalid('Custom icon must be an embedded PNG data URL of at most 384 KiB')
    let dimensions = pngCache.get(dataUrl)
    if (!dimensions) {
      const base64 = dataUrl.slice(PNG_DATA_URL_PREFIX.length)
      if (!base64.length || base64.length % 4) return invalid('Custom PNG must use canonical padded base64')
      const binary = atob(base64)
      if (binary.length > MAX_CUSTOM_ICON_DECODED_BYTES || btoa(binary) !== base64) return invalid('Custom PNG has invalid base64 or exceeds the decoded byte limit')
      dimensions = pngDimensions(Uint8Array.from(binary, character => character.charCodeAt(0)))
      if (!dimensions) return invalid('Custom PNG has an invalid signature, dimensions, chunk structure or CRC; reimport the original image')
      remember(dataUrl, dimensions)
    }
    if (dimensions.width !== width || dimensions.height !== height) return invalid('Custom icon width and height must match its PNG IHDR')
    return { ok: true, value: { name, dataUrl, width, height } }
  } catch {
    return invalid('Custom icon contains invalid inert data or PNG base64')
  }
}