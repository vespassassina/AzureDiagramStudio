import { expect, it } from 'vitest'
import { sampleDiagram } from './model.ts'
import { buildExportScene, buildScene, connectionMarkup, renderSvg } from './scene.ts'

it.each(['solid', 'dashed'] as const)('should_share_2_1_normal_%s_connections_without_changing_document_background_or_geometry_DGM141', style => {
  const document = sampleDiagram()
  document.connections = document.connections.map(edge => ({ ...edge, style, arrow: 'both' }))
  const before = JSON.stringify(document)
  const scene = buildScene(document), exported = buildExportScene(document)
  const edge = scene.connections[0]
  const markup = connectionMarkup(edge)
  expect(markup).toContain('stroke-width="2.1"')
  expect(markup).toContain(`d="${edge.path}"`)
  expect(markup).toContain('marker-start=')
  expect(markup.includes('stroke-dasharray="6 5"')).toBe(style === 'dashed')
  expect(exported.connections).toEqual(scene.connections)
  expect(renderSvg(exported)).toContain(markup)
  expect(scene.backgroundColor).toBe('#ffffff')
  expect(renderSvg(exported)).toContain('fill="white"')
  expect(JSON.stringify(document)).toBe(before)
})

it('should_keep_custom_background_halo_contrast_and_transparent_export_DGM141', () => {
  const document = { ...sampleDiagram(), backgroundColor: '#123456' }
  const scene = buildExportScene(document)
  const markup = connectionMarkup(scene.connections[0], scene.connectionBackgrounds[scene.connections[0].id])
  expect(markup).toContain('stroke-width="2.1"')
  expect(markup).toContain('stroke-width="4.1"')
  expect(scene.backgroundColor).toBe(document.backgroundColor)
  expect(renderSvg(scene)).toContain('fill="#123456"')
  expect(renderSvg(scene, {}, true)).not.toContain(`height="${scene.height}" fill="#123456"`)
})
