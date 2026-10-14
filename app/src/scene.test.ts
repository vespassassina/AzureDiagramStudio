import { describe, expect, test } from 'vitest'
import { createDocument, entityTextGeometry, measureEntity, sampleDiagram } from './model.ts'
import type { ConnectionSide, Diagram, Entity } from './model.ts'
import { buildExportScene, buildScene, connectionMarkup, connectionMarkers, entityMarkup, renderSvg, sceneLayers, pngDimensions } from './scene.ts'
import { painterOrder } from './order.ts'
import { compositeColor, contrastInk, contrastRatio } from './render/contrast.ts'
import { resolveColor } from './catalog.ts'

const component = (id: string, x = 0, y = 0): Entity => ({ id, kind: 'component', label: id, x, y, width: 220, height: 88, color: 'teal', icon: 'service' })
const documentWith = (entities: Entity[]): Diagram => ({ ...createDocument('scene', ''), entities })

test('should_capture_selected_subtrees_at_original_absolute_float_coordinates_and_scope_edges_and_legend', () => {
  const source = documentWith([
    { ...component('outer', -100.25, 40.5), kind: 'boundary' },
    { ...component('inner', 25.5, 30.25), kind: 'boundary', parentId: 'outer' },
    { ...component('child', 12.25, 44.5), parentId: 'inner', status: 'live' },
    { ...component('other', 1000, 1000), color: 'red', status: 'planned' },
  ])
  source.title = 'Retained title'; source.subtitle = 'Retained subtitle'; source.synthetic = true
  source.backgroundColor = '#101010'; source.legendVisible = true
  source.legend = [{ label: 'Used', color: 'teal' }, { label: 'Unused', color: 'red' }]
  source.connections = [{ id: 'inside', from: 'inner', to: 'child', label: '', style: 'solid', arrow: 'forward' }, { id: 'outside', from: 'child', to: 'other', label: '', style: 'solid', arrow: 'forward' }]
  const before = JSON.stringify(source), whole = buildScene(source)
  const scene = buildExportScene(source, { selectionIds: ['inner', 'child', 'missing'] })
  expect(scene.entities.map(entity => entity.id)).toEqual(['inner', 'child'])
  for (const entity of scene.entities) {
    expect(entity.absolute).toEqual(whole.entities.find(item => item.id === entity.id)!.absolute)
    expect(scene.entityBackgrounds[entity.id]).toBe(whole.entityBackgrounds[entity.id])
  }
  expect(scene.connections.map(connection => connection.id)).toEqual(['inside'])
  expect(scene.connectionBackgrounds.inside).toBe(whole.connectionBackgrounds.inside)
  expect(scene.legendItems.map(item => item.label)).toEqual(['Used', 'Live', 'Teal'])
  expect(scene.title).toBe(source.title); expect(scene.subtitle).toBe(source.subtitle)
  expect(scene.backgroundColor).toBe('#101010'); expect(scene.synthetic).toBe(true)
  expect(JSON.stringify(source)).toBe(before)
})

test.each([['wide', 900, 100], ['tall', 100, 900]] as const)('should_expand_padded_%s_bounds_to_exact_16_9_without_stretching', (_name, width, height) => {
  const source = documentWith([{ ...component('shape', -33.25, 19.5), kind: 'rectangle', width, height }])
  const content = buildScene(source), slide = buildExportScene(source, { aspect: '16:9' })
  expect(slide.width / slide.height).toBe(16 / 9)
  expect(slide.width).toBeGreaterThanOrEqual(content.width); expect(slide.height).toBeGreaterThanOrEqual(content.height)
  expect(slide.minX + slide.width / 2).toBe(content.minX + content.width / 2)
  expect(slide.minY + slide.height / 2).toBe(content.minY + content.height / 2)
  expect(slide.entities).toEqual(content.entities); expect(slide.contentBounds).toEqual(content.contentBounds)
  expect(pngDimensions(slide, 2)).toEqual({ width: slide.width * 2, height: slide.height * 2 })
})

test('should_preserve_literal_legacy_scene_and_recompute_white_override_contrast', () => {
  const source = { ...documentWith([{ ...component('note'), kind: 'text' as const }]), backgroundColor: '#101010' }
  expect(buildExportScene(source)).toEqual(buildScene(source))
  expect(renderSvg(buildExportScene(source, { background: 'white' }))).toBe(renderSvg(buildScene({ ...source, backgroundColor: '#ffffff' })))
  expect(() => buildExportScene(source, { selectionIds: [] })).toThrow(/selection/i)
})

test.each(['dots', 'lines'] as const)('should_render_export_grid_%s_as_one_safe_zero_origin_pattern_below_all_entities', style => {
  const source = { ...documentWith([{ ...component('dgm-grid-0', -107, -93), layer: 'background' as const }]), grid: { visible: false, snap: false, style, spacing: 16, present: false, export: true } }
  const scene = buildScene(source)
  const svg = renderSvg(scene, {}, true)
  expect(svg).toContain('<pattern id="dgm-grid-1" x="0" y="0" width="16" height="16" patternUnits="userSpaceOnUse"')
  expect(svg.match(/<pattern /g)).toHaveLength(1)
  expect(svg).toContain(`x="${scene.minX}" y="${scene.minY}" width="${scene.width}" height="${scene.height}" fill="url(#dgm-grid-1)"`)
  expect(svg.indexOf('fill="url(#dgm-grid-1)"')).toBeLessThan(svg.indexOf('<g transform='))
  expect(svg).not.toContain('fill="white"/>')
  expect(svg).toContain(style === 'dots' ? '<circle' : '<path d="M 0 16 V 0 H 16"')
  expect(renderSvg(buildScene({ ...source, grid: { ...source.grid, visible: true, present: true, export: false } }))).not.toContain('<pattern ')
})

test('should_share_explicit_background_in_scene_and_svg_without_mutating_source_or_legacy_white', () => {
  const legacy = documentWith([])
  const document = { ...legacy, backgroundColor: '#123abc' }
  const source = JSON.stringify(document)
  const scene = buildScene(document)
  expect(scene).toHaveProperty('backgroundColor', '#123abc')
  const fill = `<rect x="${scene.minX}" y="${scene.minY}" width="${scene.width}" height="${scene.height}" fill="#123abc"/>`
  expect(renderSvg(scene)).toContain(fill)
  expect(renderSvg(scene, {}, true)).not.toContain(fill)
  expect(JSON.stringify(document)).toBe(source)
  expect(buildScene(legacy)).toHaveProperty('backgroundColor', '#ffffff')
  expect(renderSvg(buildScene(legacy))).toContain('fill="white"')
})

test.each(['#101010', '#172a4c', '#bd1636'])('should_adapt_background_%s_contrast_without_changing_entities_or_icon_bytes', backgroundColor => {
  const document = { ...documentWith([{ ...component('note'), kind: 'text' as const, subtitle: 'Annotation subtitle', color: '#172a4c' }, component('one', 300), component('two', 650)]), title: 'Metadata', subtitle: 'Subtitle', backgroundColor }
  document.connections = [{ id: 'edge', from: 'one', to: 'two', label: 'Link', style: 'solid', arrow: 'forward' }]
  const original = JSON.stringify(document)
  const scene = buildScene(document)
  expect(scene.header.every(block => block.color !== '#849293' && block.color !== '#203637')).toBe(true)
  const svg = renderSvg(scene)
  expect(svg).not.toContain('stroke="#6c8587"')
  expect(svg).toContain('fill="white" stroke="#d6dfe1"')
  expect(svg).not.toContain('fill="#172a4c">note</text>')
  expect(JSON.stringify(document)).toBe(original)
})

test('should_compose_nested_boundary_fills_for_annotation_and_connection_contrast', () => {
  const document = { ...documentWith([
    { ...component('outer'), kind: 'boundary' as const, width: 800, height: 600 },
    { ...component('inner', 50, 70), kind: 'boundary' as const, parentId: 'outer', width: 500, height: 400, color: 'rose' },
    { ...component('note', 80, 90), kind: 'text' as const, parentId: 'inner', subtitle: 'Subtitle', color: 'rose' },
    { ...component('one', 50, 160), parentId: 'inner' },
    { ...component('two', 300, 160), parentId: 'inner' },
  ]), backgroundColor: '#101010' }
  document.connections = [{ id: 'edge', from: 'one', to: 'two', label: 'Link', arrow: 'both', style: 'dashed', points: [{ x: 250, y: 200 }, { x: 350, y: 200 }], labelPosition: { x: 300, y: 200 }, routeRevision: 0 }]
  const scene = buildScene(document)
  const outer = compositeColor(resolveColor('teal').light, document.backgroundColor, 0.62)
  const inner = compositeColor(resolveColor('rose').light, outer, 0.62)
  expect(scene.entityBackgrounds.inner).toBe(outer)
  expect(scene.entityBackgrounds.note).toBe(inner)
  expect(scene.connectionBackgrounds.edge).toBe(inner)
  const note = scene.entities.find(entity => entity.id === 'note')!
  const markup = entityMarkup(note, {}, scene.entityBackgrounds.note)
  const labelColor = markup.match(/fill="([^"]+)"[^>]*>note<\/text>/)![1]
  expect(contrastRatio(labelColor, inner)).toBeGreaterThanOrEqual(4.5)
  const svg = renderSvg(scene)
  expect(svg).toContain(`fill="${inner}"/>`)
  expect(svg).toContain('marker-end="url(#dgm-edge-arrow)"')
  expect(svg).toContain('id="dgm-edge-arrow"')
})

test('should_outline_custom_connectors_and_arrowheads_when_routes_cross_dark_and_pale_surfaces', () => {
  const document = { ...documentWith([
    component('outside', -400),
    { ...component('boundary'), kind: 'boundary' as const, width: 600, height: 400 },
    { ...component('inside', 80, 100), parentId: 'boundary' },
  ]), backgroundColor: '#101010' }
  document.connections = [{ id: 'crossing', from: 'outside', to: 'inside', label: 'Crossing', arrow: 'both', style: 'dashed', points: [{ x: -180, y: 44 }, { x: 80, y: 144 }], labelPosition: { x: -100, y: 80 }, routeRevision: 0 }]
  const scene = buildScene(document)
  const connection = scene.connections[0]
  const markup = connectionMarkup(connection, scene.connectionBackgrounds.crossing)
  expect(markup).toContain('stroke="#000000" stroke-width="3.6"')
  expect(markup).toContain('stroke="#ffffff" stroke-width="1.6"')
  expect(connectionMarkers(connection, scene.connectionBackgrounds.crossing)).toContain('stroke="#000000" stroke-width="1.2"')
  expect(connectionMarkup(connection)).not.toContain('stroke-width="3.6"')
})

test.each(['#101010', '#0f0', '#ffcc00', '#f0f', '#03a', '#eeffee', '#bd1636'])('should_meet_text_contrast_on_custom_background_%s', background => {
  for (const preferred of ['#849293', '#768284', '#117865', '#526b6d']) expect(contrastRatio(contrastInk(preferred, background), background)).toBeGreaterThanOrEqual(4.5)
})

test('should_keep_component_artwork_exact_and_fall_back_safely_when_background_is_not_hex', () => {
  const tile = component('same')
  expect(entityMarkup(tile, {}, '#101010')).toBe(entityMarkup(tile))
  const legacy = documentWith([tile])
  expect(renderSvg(buildScene({ ...legacy, backgroundColor: 'url(https://evil)' }))).toBe(renderSvg(buildScene(legacy)))
  expect(renderSvg(buildScene({ ...legacy, backgroundColor: '#fff' }))).toBe(renderSvg(buildScene(legacy)))
})

test('should_paint_edges_after_all_legacy_sample_boundaries_and_before_all_foreground_tiles', () => {
  const document = sampleDiagram()
  document.connections.forEach((connection, index) => { connection.label = `LEGACY EDGE ${index}` })
  const scene = buildScene(document)
  const svg = renderSvg(scene)
  const paint = painterOrder(document.entities)
  for (const connection of document.connections) {
    const edgeIndex = svg.indexOf(`>${connection.label}</text>`)
    expect(edgeIndex).toBeGreaterThan(-1)
    for (const entity of document.entities) {
      const entityIndex = svg.indexOf(entityMarkup(scene.entities.find(item => item.id === entity.id)!))
      expect(entityIndex).toBeGreaterThan(-1)
      if (entity.kind === 'boundary') {
        expect(entityIndex).toBeLessThan(edgeIndex)
        expect(paint.nodeZIndices.get(entity.id)).toBeLessThan(paint.connectionZIndex)
      } else {
        expect(edgeIndex).toBeLessThan(entityIndex)
        expect(paint.nodeZIndices.get(entity.id)).toBeGreaterThan(paint.connectionZIndex)
      }
    }
  }
})

test('should_paint_parent_first_subtrees_in_sibling_order_when_imported_child_ranks_cross_the_parent', () => {
  const document = documentWith([
    { ...component('front'), order: 10 },
    { ...component('child'), parentId: 'inner', order: -1e100 },
    { ...component('back'), kind: 'boundary', layer: 'background' },
    { ...component('inner'), kind: 'boundary', parentId: 'outer', order: -20 },
    { ...component('peer'), parentId: 'outer', order: 7.5 },
    { ...component('outer'), kind: 'boundary', order: 3.25 },
  ])
  const expected = ['back', 'outer', 'inner', 'child', 'peer', 'front']
  const scene = buildScene(document)
  expect(scene.entities.map(item => item.id)).toEqual(expected)
  const layers = sceneLayers(scene)
  expect([...layers.background, ...layers.boundaries, ...layers.foreground].map(item => item.id)).toEqual(expected)
  const svg = renderSvg(scene)
  const indices = expected.map(id => svg.indexOf(`>${id}</text>`))
  expect(indices.every((index, offset) => index >= 0 && (offset === 0 || index > indices[offset - 1]))).toBe(true)
})

test('should_keep_boundary_and_child_in_their_semantic_bands_when_numeric_group_ranks_cross_connections', () => {
  for (const order of [-3, 5]) {
    const document = documentWith([{ ...component('group'), kind: 'boundary', order }, { ...component('child'), parentId: 'group', order: -100 }, component('peer', 400)])
    document.connections = [{ id: 'edge', from: 'child', to: 'peer', label: 'EDGE', style: 'solid', arrow: 'none' }]
    const svg = renderSvg(buildScene(document))
    expect(svg.indexOf('>group</text>')).toBeLessThan(svg.indexOf('>child</text>'))
    expect(svg.indexOf('>group</text>')).toBeLessThan(svg.indexOf('>EDGE</text>'))
    expect(svg.indexOf('>EDGE</text>')).toBeLessThan(svg.indexOf('>child</text>'))
    expect(svg.indexOf('>EDGE</text>')).toBeLessThan(svg.indexOf('>peer</text>'))
  }
})

test('should_paint_contained_backgrounds_after_their_own_boundaries_and_before_edges_despite_imported_ranks', () => {
  const document = documentWith([
    { ...component('tile'), parentId: 'inner', order: -1e100 },
    { ...component('inner-back'), kind: 'rectangle', layer: 'background', parentId: 'inner', order: -1e100 },
    { ...component('outer-back'), kind: 'text', layer: 'background', parentId: 'outer', order: 1e100 },
    { ...component('inner'), kind: 'boundary', layer: 'background', parentId: 'outer', order: -1e100 },
    { ...component('outer'), kind: 'boundary', order: 1e100 },
    { ...component('root-back'), kind: 'rectangle', layer: 'background', order: 1e100 },
    { ...component('root-tile'), order: -1e100 },
  ])
  document.connections = [{ id: 'edge', from: 'tile', to: 'root-tile', label: 'EDGE', style: 'solid', arrow: 'none' }]
  const scene = buildScene(document)
  const layers = sceneLayers(scene)
  const paint = painterOrder(document.entities)
  expect(layers.background.map(item => item.id)).toEqual(['root-back'])
  expect(layers.boundaries.map(item => item.id)).toEqual(['outer', 'inner', 'inner-back', 'outer-back'])
  expect(layers.foreground.map(item => item.id)).toEqual(['tile', 'root-tile'])
  expect(painterOrder(scene.entities).nodeZIndices).toEqual(paint.nodeZIndices)
  const svg = renderSvg(scene)
  const ids = ['root-back', 'outer', 'inner', 'inner-back', 'outer-back', 'EDGE', 'tile', 'root-tile']
  const indices = ids.map(id => svg.indexOf(`>${id}</text>`))
  expect(indices.every((index, offset) => index >= 0 && (offset === 0 || index > indices[offset - 1]))).toBe(true)
  for (const entity of document.entities.filter(item => item.parentId)) expect(paint.nodeZIndices.get(entity.parentId!)).toBeLessThan(paint.nodeZIndices.get(entity.id)!)
})

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