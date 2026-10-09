import { afterEach, expect, test, vi } from 'vitest'
import { createDocument } from './model.ts'
import { exportPng, exportSvg } from './export.ts'

const font = vi.hoisted(() => vi.fn(async () => 'data:font/ttf;base64,AA=='))
vi.mock('./assets.ts', () => ({ embeddedFont: font, visualAssets: { icons: {} } }))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); font.mockClear() })

test('should_embed_font_and_escape_complete_metadata_when_exporting_svg', async () => {
  const document = { ...createDocument('export', '<title> & "'), subtitle: '<subtitle> \'', synthetic: false }
  const svg = await exportSvg(document)
  expect(svg).toContain('data:font/ttf;base64,AA==')
  expect(svg).toContain('&lt;title&gt;')
  expect(svg).toContain('&lt;subtitle&gt;')
  expect(svg).toContain('&apos;')
  for (const unsafe of ['<script', 'foreignObject', 'href="http', 'SYNTHETIC EXAMPLE']) expect(svg).not.toContain(unsafe)
})

test('should_change_only_canvas_background_when_transparent_svg_is_requested', async () => {
  const document = createDocument('background', '')
  const white = await exportSvg(document, false)
  const transparent = await exportSvg(document, true)
  const background = white.match(/<rect [^>]*fill="white"\/>/)![0]
  expect(white.replace(background, '')).toBe(transparent)
  expect(transparent).not.toContain('<rect')
})

test('should_preflight_png_before_loading_assets_when_dimensions_exceed_cap', async () => {
  const document = createDocument('huge', '')
  document.entities = [{ id: 'huge', kind: 'rectangle', label: '', x: 0, y: 0, width: 9000, height: 9000, color: 'gray' }]
  await expect(exportPng(document, 2)).rejects.toThrow(/too large/i)
  expect(font).not.toHaveBeenCalled()
})

test('should_fail_with_png_context_when_embedded_font_loading_fails', async () => {
  font.mockRejectedValueOnce(new Error('font unavailable'))
  await expect(exportPng(createDocument('font'), 1)).rejects.toThrow(/PNG.*font unavailable/i)
})

function rasterEnvironment(failure?: 'decode' | 'context' | 'encode') {
  const image = { src: '', decode: vi.fn(async () => { if (failure === 'decode') throw new Error('decode failed') }) }
  const context = { drawImage: vi.fn(), fillRect: vi.fn(), fillStyle: '' }
  const canvas = { width: 0, height: 0, getContext: vi.fn(() => failure === 'context' ? null : context), toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(failure === 'encode' ? null : new Blob(['png'], { type: 'image/png' }))) }
  vi.stubGlobal('Image', class { constructor() { return image } })
  vi.stubGlobal('document', { createElement: vi.fn(() => canvas) })
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  const revoke = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  return { canvas, image, context, revoke }
}

test('should_rasterize_double_dimensions_and_release_resources_when_png_succeeds', async () => {
  const environment = rasterEnvironment()
  const document = createDocument('png')
  const svg = await exportSvg(document)
  const width = Number(svg.match(/width="([\d.]+)"/)![1])
  const height = Number(svg.match(/height="([\d.]+)"/)![1])
  const blob = await exportPng(document, 2, true)
  expect(blob.type).toBe('image/png')
  expect(environment.context.drawImage).toHaveBeenCalledWith(environment.image, 0, 0, width * 2, height * 2)
  expect(environment.revoke).toHaveBeenCalledWith('blob:test')
  expect(environment.canvas.width).toBe(0)
  expect(environment.canvas.height).toBe(0)
  expect(environment.image.src).toBe('')
})

for (const failure of ['decode', 'context', 'encode'] as const) test(`should_release_resources_and_report_${failure}_when_png_fails`, async () => {
  const environment = rasterEnvironment(failure)
  await expect(exportPng(createDocument('png'), 1)).rejects.toThrow(/PNG/i)
  expect(environment.revoke).toHaveBeenCalledWith('blob:test')
  expect(environment.canvas.width).toBe(0)
  expect(environment.image.src).toBe('')
})