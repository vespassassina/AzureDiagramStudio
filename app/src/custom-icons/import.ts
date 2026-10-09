import type { CustomIcon } from './contract.ts'
import { MAX_CUSTOM_ICON_DIMENSION, MAX_CUSTOM_ICON_ENCODED_BYTES, MAX_CUSTOM_ICON_NAME_LENGTH, MAX_RAW_ICON_BYTES, validateCustomIcon } from './contract.ts'
import { checkSourceDimensions, inspectRasterSource } from './source.ts'
import { sanitizeSvgSource } from './svg.ts'

type DecodedImage = { image: CanvasImageSource; width: number; height: number; release(): void }

async function decodeImage(blob: Blob, mime: string): Promise<DecodedImage> {
  if (mime !== 'image/svg+xml' && typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob, { imageOrientation: 'from-image' })
    return { image: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() }
  }
  const url = URL.createObjectURL(blob)
  const image = new Image()
  try {
    image.src = url
    await image.decode()
    return { image, width: image.naturalWidth, height: image.naturalHeight, release: () => { image.src = ''; URL.revokeObjectURL(url) } }
  } catch (error) {
    image.src = ''
    URL.revokeObjectURL(url)
    throw error
  }
}

/** Bound source bytes/headers, sanitize XML before decoding, decode exactly once, rasterize original pixels with alpha, shrink to the encoded cap, release native resources. */
export async function importCustomIcon(file: File): Promise<CustomIcon> {
  if (!file || !Number.isInteger(file.size) || file.size < 1 || file.size > MAX_RAW_ICON_BYTES) throw new Error('Choose a nonempty SVG, PNG, JPEG, GIF or WebP file of at most 2 MiB')
  let decoded: DecodedImage | undefined
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    if (!bytes.length || bytes.length > MAX_RAW_ICON_BYTES || bytes.length !== file.size) throw new Error('Image file changed size or exceeds 2 MiB; select the original again')
    const declared = file.type.toLowerCase()
    const svg = declared === 'image/svg+xml' || (!declared && new TextDecoder().decode(bytes.subarray(0, 256)).trimStart().startsWith('<'))
    let blob: Blob
    if (svg) {
      const inert = sanitizeSvgSource(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
      blob = new Blob([inert.text], { type: 'image/svg+xml' })
    } else {
      const source = inspectRasterSource(bytes, declared)
      blob = new Blob([Uint8Array.from(source.bytes).buffer], { type: source.mime })
    }
    decoded = await decodeImage(blob, blob.type)
    checkSourceDimensions(decoded.width, decoded.height)
    const canvas = document.createElement('canvas')
    const context = canvas.getContext('2d', { alpha: true })
    if (!context) throw new Error('Image rasterization is unavailable; try a browser with Canvas support')
    let scale = Math.min(1, MAX_CUSTOM_ICON_DIMENSION / Math.max(decoded.width, decoded.height))
    const name = (file.name || 'Custom icon').slice(0, MAX_CUSTOM_ICON_NAME_LENGTH)
    for (let attempt = 0; attempt < 24; attempt++) {
      canvas.width = Math.max(1, Math.round(decoded.width * scale))
      canvas.height = Math.max(1, Math.round(decoded.height * scale))
      context.drawImage(decoded.image, 0, 0, canvas.width, canvas.height)
      const dataUrl = canvas.toDataURL('image/png')
      if (dataUrl.length <= MAX_CUSTOM_ICON_ENCODED_BYTES) {
        const result = validateCustomIcon({ name, dataUrl, width: canvas.width, height: canvas.height })
        if (!result.ok) throw new Error(`Image PNG normalization failed: ${result.error}`)
        return Object.freeze(result.value)
      }
      if (canvas.width === 1 && canvas.height === 1) break
      scale *= 0.75
    }
    throw new Error('Image cannot fit the 384 KiB embedded PNG limit; simplify or resize the original')
  } catch (error) {
    throw new Error(`Could not import image. ${error instanceof Error ? error.message : 'Native image decoding failed'}; choose a valid supported image or re-save it as PNG.`, { cause: error })
  } finally {
    decoded?.release()
  }
}