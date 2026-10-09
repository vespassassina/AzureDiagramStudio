import { describe, expect, test } from 'vitest'
import { createDocument, entityTextGeometry, measureEntity } from './model.ts'
import type { ConnectionSide, Diagram, Entity } from './model.ts'
import { buildScene, entityMarkup, renderSvg } from './scene.ts'

const component = (id: string, x = 0, y = 0): Entity => ({ id, kind: 'component', label: id, x, y, width: 220, height: 88, color: 'teal', icon: 'service' })
const documentWith = (entities: Entity[]): Diagram => ({ ...createDocument('scene', ''), entities })

test('should_render_metadata_and_deterministic_custom_status_color_legend_when_visible', () => {
  const document = documentWith([
    { ...component('one'), status: 'live' },
    { ...component('two', 300), status: 'planned', color: 'azure' },
    { ...component('three', 600), status: 'not-connected', color: '#123abc' },
    { ...component('four', 900), status: 'synthetic' },
  ])
  Object.assign(document, { title: 'Real architecture', subtitle: 'Customer subtitle', legend: [{ label: 'Custom category', color: 'rose', dashed: true }] })
  const svg = renderSvg(buildScene(document))
  for (const text of ['Real architecture', 'Customer subtitle', 'Custom category', 'Live', 'Planned', 'Not connected', 'Synthetic', 'Azure', 'Teal', '#123abc']) expect(svg).toContain(text)
  expect(svg).not.toContain('SYNTHETIC EXAMPLE')
  expect(svg).toContain('#bd4966')
  expect(renderSvg(buildScene({ ...document, synthetic: true }))).toContain('SYNTHETIC EXAMPLE')
  const hidden = renderSvg(buildScene({ ...document, legendVisible: false }))
  expect(hidden).not.toContain('Custom category')
  expect(hidden).not.toContain('>Live</text>')
})

test('should_crop_negative_and_positive_content_without_forced_margins_when_metadata_is_empty', () => {
  const scene = buildScene(documentWith([component('one', -700, -350)]))
  expect(scene.minX).toBeLessThan(-700)
  expect(scene.minY).toBeLessThan(-350)
  expect(scene.width).toBeLessThan(320)
  expect(scene.height).toBeLessThan(180)
  expect(renderSvg(scene)).toContain(`viewBox="${scene.minX} ${scene.minY} ${scene.width} ${scene.height}"`)
  const positive = buildScene(documentWith([component('one', 2000, 3000)]))
  expect(positive.minX).toBeGreaterThan(1900)
  expect(positive.width).toBe(scene.width)
  const empty = buildScene(createDocument('empty', ''))
  expect(empty.width).toBeGreaterThan(0)
  expect(empty.width).toBeLessThan(100)
  expect(empty.height).toBeLessThan(100)
})

test('should_measure_and_render_all_long_entity_text_using_frozen_geometry', () => {
  const entities = ['component', 'boundary', 'text', 'rectangle'].map((kind, index) => ({
    ...component(`long-${kind}`, index * 500), kind: kind as Entity['kind'], label: 'W'.repeat(kind === 'text' ? 2000 : 120), subtitle: 'W'.repeat(200),
  }))
  const scene = buildScene(documentWith(entities))
  for (const entity of scene.entities) {
    expect({ width: entity.width, height: entity.height }).toEqual(measureEntity(entities.find(original => original.id === entity.id)!))
    const geometry = entityTextGeometry(entity)
    const markup = entityMarkup(entity)
    for (const line of [...geometry.labelLines, ...geometry.subtitleLines]) expect(markup).toContain(`>${line}</text>`)
    expect(markup).toContain('lengthAdjust="spacingAndGlyphs"')
    expect(scene.minY + scene.height).toBeGreaterThan(entity.absolute.y + geometry.textBottom)
  }
})

test('should_fit_wide_lowercase_and_capital_glyphs_when_native_labels_exceed_available_width', () => {
  for (const character of ['m', 'w', 'O', 'Q']) {
    const markup = entityMarkup({ ...component('wide'), label: character.repeat(16) })
    expect(markup).toContain('textLength="142" lengthAdjust="spacingAndGlyphs"')
    expect(markup).toContain(`>${character.repeat(16)}</text>`)
  }
})

test('should_order_background_annotations_before_boundaries_edges_and_foreground', () => {
  const document = documentWith([
    { ...component('front'), kind: 'rectangle', label: 'FOREGROUND' },
    { ...component('group', 300), kind: 'boundary', label: 'BOUNDARY' },
    { ...component('back'), kind: 'rectangle', layer: 'background', label: 'BACKGROUND' },
  ])
  document.connections = [{ id: 'edge', from: 'group', to: 'front', label: 'EDGE LABEL', style: 'solid', arrow: 'none' }]
  const svg = renderSvg(buildScene(document))
  expect(svg.indexOf('BACKGROUND')).toBeLessThan(svg.indexOf('BOUNDARY'))
  expect(svg.indexOf('BOUNDARY')).toBeLessThan(svg.indexOf('EDGE LABEL'))
  expect(svg.indexOf('EDGE LABEL')).toBeLessThan(svg.indexOf('FOREGROUND'))
})

test('should_reject_unknown_asset_paths_and_style_injection_when_rendering_plain_text', () => {
  const document = documentWith([{ ...component('safe'), color: 'url(https://bad)', icon: '../../bad.svg', label: '<script> & " \'', subtitle: '<foreignObject>' }])
  document.legend = [{ label: '<img>', color: 'red" onload="alert(1)' }]
  const svg = renderSvg(buildScene(document), { icons: { '../../bad.svg': 'https://bad', service: 'https://bad' }, fontData: "x');}</style><script>" })
  expect(svg).toContain('&lt;script&gt;')
  expect(svg).toContain('&apos;')
  expect(svg).toContain('#62696c')
  for (const unsafe of ['<script', '<foreignObject', 'href="https:', 'onload=', 'url(https:']) expect(svg).not.toContain(unsafe)
  expect(entityMarkup({ ...component('safe'), icon: 'azure-app' }, { icons: { 'azure-app': 'https://bad' } })).not.toContain('https://bad')
})

test('should_include_saved_edge_labels_and_header_text_in_bounds_without_double_translation', () => {
  const document = documentWith([component('one', -100), component('two', 200)])
  document.title = 'W'.repeat(120)
  document.subtitle = 'W'.repeat(200)
  document.connections = [{ id: 'far', from: 'one', to: 'two', label: 'W'.repeat(80), style: 'dashed', arrow: 'both', routeRevision: 0, points: [{ x: 120, y: 44 }, { x: 200, y: 44 }], labelPosition: { x: -2000, y: -1000 } }]
  const scene = buildScene(document)
  expect(scene.minX).toBeLessThan(-2000)
  expect(scene.minY).toBeLessThan(-1000)
  expect(renderSvg(scene)).toContain('M 120 44')
  expect(renderSvg(scene)).not.toContain('translate(40 ')
  expect(renderSvg(scene)).toContain('lengthAdjust="spacingAndGlyphs"')
})

test('should_render_multiline_connector_labels_with_complete_bounds_when_saved_geometry_is_used', () => {
  const document = documentWith([component('one'), component('two', 400)])
  document.connections = [{ id: 'multiline', from: 'one', to: 'two', label: 'First line\nSecond line\nThird line', style: 'solid', arrow: 'none', routeRevision: 0, points: [{ x: 220, y: 44 }, { x: 400, y: 44 }], labelPosition: { x: -500, y: -600 } }]
  const scene = buildScene(document)
  const svg = renderSvg(scene)
  for (const line of ['First line', 'Second line', 'Third line']) expect(svg).toContain(`>${line}</text>`)
  expect(scene.minY).toBeLessThan(-625)
})

test('should_embed_all_unmodified_official_icons_only_when_the_registry_supplies_them', async () => {
  const { visualAssets, azureLibrary } = await import('./assets.ts')
  for (const item of azureLibrary) {
    const markup = entityMarkup({ ...component(item.icon), icon: item.icon }, visualAssets)
    expect(markup).toContain(visualAssets.icons![item.icon])
    expect(markup).toContain('preserveAspectRatio="xMidYMid meet"')
    const overridden = entityMarkup({ ...component(item.icon), icon: item.icon }, { icons: { [item.icon]: 'data:image/svg+xml;charset=utf-8,%3Csvg%20onload%3D%22alert(1)%22%2F%3E' } })
    expect(overridden).not.toContain('<image')
  }
})

test('should_keep_unset_status_and_hidden_legend_absent_when_document_has_no_status', () => {
  const document = { ...documentWith([component('unset')]), legendVisible: false }
  const svg = renderSvg(buildScene(document))
  expect(svg).not.toContain('<title>Live</title>')
  expect(svg).not.toContain('>Live</text>')
  expect(svg).not.toContain('SYNTHETIC EXAMPLE')
  expect(buildScene(document).legendItems).toEqual([])
})

describe('stale side-aware routes', () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) for (const sourceSide of ['top', 'right', 'bottom', 'left'] as ConnectionSide[]) for (const targetSide of ['top', 'right', 'bottom', 'left'] as ConnectionSide[]) {
    test(`should_attach_${sourceSide}_${targetSide}_when_${direction}_route_is_stale`, () => {
      const document = { ...documentWith([component('one'), component('two', 400, 300)]), direction, revision: 3 }
      document.connections = [{ id: 'edge', from: 'one', to: 'two', label: 'route', style: 'solid', arrow: 'forward', sourceSide, targetSide, routeRevision: 2, points: [{ x: -900, y: -900 }, { x: -800, y: -800 }], labelPosition: { x: -850, y: -850 } }]
      const scene = buildScene(document)
      const sidePoint = (entity: typeof scene.entities[number], side: ConnectionSide) => ({ x: entity.absolute.x + (side === 'left' ? 0 : side === 'right' ? entity.width : entity.width / 2), y: entity.absolute.y + (side === 'top' ? 0 : side === 'bottom' ? entity.height : entity.height / 2) })
      expect(scene.connections[0].start).toEqual(sidePoint(scene.entities[0], sourceSide))
      expect(scene.connections[0].end).toEqual(sidePoint(scene.entities[1], targetSide))
      expect(scene.connections[0].labelPosition).not.toEqual({ x: -850, y: -850 })
      const points = scene.connections[0].points!
      expect(points.every((point, index) => index === 0 || point.x === points[index - 1].x || point.y === points[index - 1].y)).toBe(true)
    })
  }
})