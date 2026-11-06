import { expect, test } from 'vitest'
import { createDocument } from './model.ts'
import { applyCommand, validateDocument } from './document/index.ts'
import { buildScene } from './scene.ts'

function anchoredDocument() {
  const document = createDocument('exact-anchors')
  document.entities = [
    { id: 'one', kind: 'component', label: 'One', parentId: null, layer: 'foreground', x: 20, y: 30, width: 200, height: 100, color: 'azure' },
    { id: 'two', kind: 'component', label: 'Two', parentId: null, layer: 'foreground', x: 500, y: 300, width: 300, height: 160, color: 'teal' },
  ]
  document.connections = [{ id: 'edge', from: 'one', to: 'two', label: '', style: 'solid', arrow: 'forward', sourceSide: 'right', targetSide: 'top', sourceOffset: .23, targetOffset: .71 }]
  return { ...document, schemaVersion: 2 as const }
}

test('should_validate_v2_exact_offsets_and_reject_them_in_v1_DGM155', () => {
  const document = anchoredDocument()
  expect(validateDocument(document)).toEqual({ ok: true, value: document })
  expect(validateDocument({ ...document, schemaVersion: 1 })).toMatchObject({ ok: false })
})

test('should_render_normalized_exact_attachment_points_after_resize_DGM155', () => {
  const document = anchoredDocument()
  let scene = buildScene(document)
  expect(scene.connections[0].start).toEqual({ x: 240, y: 53 })
  expect(scene.connections[0].end).toEqual({ x: 713, y: 300 })
  scene = buildScene({ ...document, entities: document.entities.map(entity => entity.id === 'one' ? { ...entity, width: 400, height: 200 } : entity) })
  expect(scene.connections[0].start).toEqual({ x: 420, y: 76 })
})

test('should_upgrade_only_an_explicit_anchor_edit_to_v2_and_reset_routes_DGM155', () => {
  const legacy = createDocument('legacy')
  legacy.entities = anchoredDocument().entities
  legacy.connections = [{ id: 'edge', from: 'one', to: 'two', label: '', style: 'solid', arrow: 'forward', points: [{ x: 1, y: 1 }, { x: 2, y: 1 }], routeRevision: 0 }]
  const updated = applyCommand(legacy, { type: 'updateConnection', id: 'edge', patch: { sourceSide: 'bottom', sourceOffset: .4 } })
  expect(updated.schemaVersion).toBe(2)
  expect(updated.connections[0]).toMatchObject({ sourceSide: 'bottom', sourceOffset: .4 })
  expect(updated.connections[0].points).toBeUndefined()
})
