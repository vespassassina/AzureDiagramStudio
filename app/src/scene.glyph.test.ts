import { beforeEach, expect, test, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { createDocument } from './model.ts'
import type { Entity } from './model.ts'

vi.mock('react-dom/server', async importOriginal => {
  const actual = await importOriginal<typeof import('react-dom/server')>()
  return { ...actual, renderToStaticMarkup: vi.fn(actual.renderToStaticMarkup) }
})

const component = (overrides: Partial<Entity> = {}): Entity => ({ id: 'one', kind: 'component', label: 'Original label', subtitle: 'Original subtitle', x: 0, y: 0, width: 220, height: 88, color: 'teal', icon: 'service', ...overrides })
const renderer = vi.mocked(renderToStaticMarkup)
let sceneModule: typeof import('./scene.ts')

beforeEach(async () => { vi.resetModules(); sceneModule = await import('./scene.ts'); renderer.mockClear() })

test('should_load_registered_assets_without_per_svg_module_fanout', () => {
  const source = readFileSync(new URL('./assets.ts', import.meta.url), 'utf8')
  expect(source).not.toMatch(/import\.meta\.glob/)
  expect(source).not.toMatch(/(?:import|from)\s*['"][^'"]*\.svg(?:\?raw)?['"]/)
})

test('should_reuse_only_pure_glyph_markup_when_entities_and_document_metadata_change', async () => {
  const { buildScene, renderSvg } = sceneModule
  const original = { ...createDocument('original', 'Original title'), subtitle: 'Original document subtitle', entities: [component(), component({ id: 'two', x: 300 })], legend: [{ label: 'Original legend', color: 'teal' }] }
  const originalSvg = renderSvg(buildScene(original))
  expect(originalSvg).toContain('Original label')
  expect(renderer).toHaveBeenCalledTimes(1)

  const updated = { ...original, id: 'updated', title: 'Updated title', subtitle: 'Updated document subtitle', synthetic: true, legend: [{ label: 'Updated legend', color: 'rose' }], entities: [component({ id: 'updated-node', label: '<private> & label', subtitle: 'Updated node subtitle', status: 'planned', x: -200, y: 120 })] }
  const updatedSvg = renderSvg(buildScene(updated))
  expect(renderer).toHaveBeenCalledTimes(1)
  for (const text of ['Updated title', 'Updated document subtitle', 'Updated legend', '&lt;private&gt; &amp; label', '>Updated node</text>', '>subtitle</text>', '<title>Planned</title>', 'SYNTHETIC EXAMPLE', 'translate(-200 120)']) expect(updatedSvg).toContain(text)
  expect(updatedSvg).not.toContain('Original')
  const element = renderer.mock.calls[0][0]
  expect(element).toHaveProperty('props', { size: 26, color: '#117865', strokeWidth: 1.65 })
})

test('should_render_distinct_glyphs_and_resolved_colors_without_stale_fragments', async () => {
  const { entityMarkup } = sceneModule
  const service = entityMarkup(component())
  const database = entityMarkup(component({ icon: 'database' }))
  const rose = entityMarkup(component({ color: 'rose' }))
  const hex = entityMarkup(component({ color: '#123abc' }))
  expect(renderer).toHaveBeenCalledTimes(4)
  expect(service).toContain('lucide-boxes')
  expect(database).toContain('lucide-database')
  expect(database).not.toContain('lucide-boxes')
  expect(rose).toContain('stroke="#bd4966"')
  expect(hex).toContain('stroke="#123abc"')
  expect(entityMarkup(component({ color: 'fabric' }))).toBe(service)
  const tealHex = entityMarkup(component({ color: '#117865' }))
  expect(tealHex).toBe(service.replace('fill="#edf8f3"', 'fill="#f5f6f6"'))
  expect(entityMarkup(component({ color: '#123abc' }))).toBe(hex)
  expect(renderer).toHaveBeenCalledTimes(4)
})

test('should_bound_glyph_cache_when_many_valid_hex_colors_are_rendered', async () => {
  const { entityMarkup } = sceneModule
  for (let index = 0; index <= 256; index++) entityMarkup(component({ color: `#${index.toString(16).padStart(6, '0')}` }))
  expect(renderer).toHaveBeenCalledTimes(257)
  const recent = entityMarkup(component({ color: '#000100' }))
  expect(recent).toContain('stroke="#000100"')
  expect(renderer).toHaveBeenCalledTimes(257)
  const evicted = entityMarkup(component({ color: '#000000' }))
  expect(evicted).toContain('stroke="#000000"')
  expect(renderer).toHaveBeenCalledTimes(258)
})

test('should_cache_safe_fallbacks_without_retaining_untrusted_icons_colors_assets_or_fonts', async () => {
  const { buildScene, entityMarkup, renderSvg } = sceneModule
  const { visualAssets } = await import('./assets.ts')
  const first = entityMarkup(component({ icon: '../../private-one.svg', color: 'url(https://private-one)' }))
  const second = entityMarkup(component({ icon: '__proto__', color: 'red" onload="private-two' }))
  expect(first).toBe(second)
  expect(first).toContain('lucide-cloud')
  expect(first).toContain('stroke="#62696c"')
  expect(renderer).toHaveBeenCalledTimes(1)

  const official = component({ icon: 'azure-app' })
  expect(entityMarkup(official, visualAssets)).toContain(visualAssets.icons!['azure-app'])
  expect(renderer).toHaveBeenCalledTimes(1)
  const overridden = entityMarkup(official, { icons: { 'azure-app': 'https://private-asset' } })
  expect(overridden).toContain('lucide-cloud')
  expect(overridden).not.toContain('<image')
  expect(entityMarkup(official, visualAssets)).toContain('<image')
  expect(renderer).toHaveBeenCalledTimes(2)

  const scene = buildScene({ ...createDocument('font', ''), entities: [component()] })
  const embedded = renderSvg(scene, { fontData: 'data:font/ttf;base64,AA==' })
  const plain = renderSvg(scene, { fontData: "x');}</style><script>private-font" })
  expect(embedded).toContain('data:font/ttf;base64,AA==')
  expect(plain).not.toContain('@font-face')
  expect(plain).not.toContain('private-font')
  expect(renderer).toHaveBeenCalledTimes(3)
})

test('should_preserve_exact_lucide_markup_when_palette_and_hex_glyphs_are_reused', async () => {
  const { entityMarkup } = sceneModule
  const { GENERIC_ICONS, COLORS, resolveColor } = await import('./catalog.ts')
  const actual = await vi.importActual<typeof import('react-dom/server')>('react-dom/server')
  const colors = [...Object.keys(COLORS), '#abc', '#ABCDEF', '#123abc']
  const resolvedColors = new Set(colors.map(color => resolveColor(color).main))
  for (const [icon, glyph] of Object.entries(GENERIC_ICONS)) for (const color of colors) {
    const expected = `<g transform="translate(18 25)">${actual.renderToStaticMarkup(createElement(glyph, { size: 26, color: resolveColor(color).main, strokeWidth: 1.65 }))}</g>`
    expect(entityMarkup(component({ icon, color }))).toContain(expected)
    expect(entityMarkup(component({ icon, color, label: 'Changed identity', subtitle: 'Changed subtitle', status: 'synthetic' }))).toContain(expected)
  }
  expect(renderer).toHaveBeenCalledTimes(Object.keys(GENERIC_ICONS).length * resolvedColors.size)
})

test('should_serialize_shared_glyph_once_when_rendering_100_entities_150_edges_and_20_nudges', async () => {
  const { buildScene, renderSvg } = sceneModule
  const document = {
    ...createDocument('stress', 'Stress'),
    entities: Array.from({ length: 100 }, (_, index) => component({ id: `node-${index}`, label: `Node ${index}`, subtitle: '', x: (index % 10) * 300, y: Math.floor(index / 10) * 150 })),
    connections: Array.from({ length: 150 }, (_, index) => ({ id: `edge-${index}`, from: `node-${index % 100}`, to: `node-${(index + 1) % 100}`, label: `edge-${index}`, style: 'solid' as const, arrow: 'forward' as const })),
  }
  for (let nudge = 0; nudge <= 20; nudge++) {
    const updated = { ...document, title: `Stress ${nudge}`, revision: nudge, entities: document.entities.map((entity, index) => index === 0 ? { ...entity, x: nudge, label: `Changed ${nudge}` } : entity) }
    const scene = buildScene(updated)
    const svg = renderSvg(scene)
    expect(scene.entities).toHaveLength(100)
    expect(scene.connections).toHaveLength(150)
    expect(svg.match(/class="lucide lucide-boxes"/g)).toHaveLength(100)
    expect(svg.match(/>edge-\d+<\/text>/g)).toHaveLength(150)
    expect(svg).toContain(`>Changed ${nudge}</text>`)
    expect(svg).toContain(`>Stress ${nudge}</text>`)
    expect(renderer).toHaveBeenCalledTimes(1)
  }
})