import { afterEach, expect, test, vi } from 'vitest'
import { createDocument } from './model.ts'
import { exportPng, exportSvg } from './export.ts'
import { effectiveGrid } from './grid.ts'

const font = vi.hoisted(() => vi.fn(async () => 'data:font/ttf;base64,AA=='))
vi.mock('./assets.ts', () => ({ embeddedFont: font, visualAssets: { icons: {} } }))
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); font.mockClear() })

test('should_share_scoped_slide_svg_with_png_and_preserve_legacy_positional_arguments', async () => {
  rasterEnvironment()
  const source = { ...createDocument('slide', 'Title'), backgroundColor: '#101010', entities: [
    { id: 'one', kind: 'rectangle' as const, label: 'Included', x: -20.25, y: 90.5, width: 200, height: 100, color: 'teal' },
    { id: 'two', kind: 'rectangle' as const, label: 'Excluded', x: 1000, y: 1000, width: 200, height: 100, color: 'red' },
  ] }
  const options = { selectionIds: ['one'], aspect: '16:9' as const, background: 'white' as const, includeGrid: true }
  const svg = await exportSvg(source, true, undefined, options)
  expect(svg).toContain('Included'); expect(svg).not.toContain('Excluded'); expect(svg).toContain('<pattern ')
  expect(svg).not.toMatch(/<rect[^>]+fill="white"/)
  await exportPng(source, 2, true, undefined, options)
  expect(await (vi.mocked(URL.createObjectURL).mock.calls.at(-1)![0] as Blob).text()).toBe(svg)
  expect(await exportSvg(createDocument('legacy'), false)).toBe(await exportSvg(createDocument('legacy'), false, undefined, {}))
})

test('should_reject_slide_expansion_over_png_cap_before_font_loading', async () => {
  const source = { ...createDocument('tall', ''), entities: [{ id: 'tall', kind: 'rectangle' as const, label: '', x: 0, y: 0, width: 100, height: 5000, color: 'teal' }] }
  await expect(exportPng(source, 1, false, undefined, { aspect: '16:9' })).rejects.toThrow(/too large/i)
  expect(font).not.toHaveBeenCalled()
})

test.each(['dots', 'lines'] as const)('should_export_grid_%s_independently_of_editor_and_present_and_honor_explicit_override', async style => {
  rasterEnvironment()
  const document = { ...createDocument('grid-export', ''), grid: { ...effectiveGrid(), style, visible: false, present: false, export: true } }
  const svg = await exportSvg(document, true)
  expect(svg).toContain('<pattern ')
  expect(svg).not.toContain('fill="white"')
  await exportPng(document, 2, true)
  expect(await (vi.mocked(URL.createObjectURL).mock.calls.at(-1)![0] as Blob).text()).toBe(svg)
  expect(await exportSvg(document, true, false)).not.toContain('<pattern ')
  const hidden = { ...document, grid: { ...document.grid, export: false, visible: true, present: true } }
  expect(await exportSvg(hidden)).not.toContain('<pattern ')
  expect(await exportSvg(hidden, false, true)).toContain('<pattern ')
})

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

test.each(['#abc', '#101010', '#ffcc00'])('should_share_background_%s_and_transparency_with_png_rasterization_without_mutation', async backgroundColor => {
  rasterEnvironment()
  const document = { ...createDocument('custom-background', ''), backgroundColor }
  const original = JSON.stringify(document)
  const opaque = await exportSvg(document)
  const transparent = await exportSvg(document, true)
  const background = opaque.match(new RegExp(`<rect [^>]*fill="${backgroundColor}"/>`))![0]
  expect(opaque.replace(background, '')).toBe(transparent)
  await exportPng(document, 1)
  const opaqueSource = vi.mocked(URL.createObjectURL).mock.calls.at(-1)![0] as Blob
  expect(await opaqueSource.text()).toBe(opaque)
  await exportPng(document, 2, true)
  const transparentSource = vi.mocked(URL.createObjectURL).mock.calls.at(-1)![0] as Blob
  expect(await transparentSource.text()).toBe(transparent)
  expect(JSON.stringify(document)).toBe(original)
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