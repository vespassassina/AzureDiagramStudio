import assert from 'node:assert/strict'
import { test } from 'vitest'
import { absolutePosition, moveEntity, removeEntities, historyCommit, historyUndo, historyRedo, createDocument } from './model.ts'
import type { Diagram } from './model.ts'
import { buildScene, renderSvg, wrapText, pngDimensions } from './scene.ts'

const fixture: Diagram = {
  ...createDocument('nested-baseline', 'Synthetic architecture'), synthetic: true,
  title: 'Synthetic architecture', direction: 'RIGHT',
  entities: [
    { id: 'outer', kind: 'boundary', label: 'Subscription', x: 100, y: 50, width: 620, height: 400, color: 'azure' },
    { id: 'inner', kind: 'boundary', label: 'Application', parentId: 'outer', x: 30, y: 60, width: 280, height: 220, color: 'teal' },
    { id: 'api', kind: 'component', label: 'API', parentId: 'inner', x: 20, y: 50, width: 220, height: 88, color: 'teal', icon: 'api' },
    { id: 'user', kind: 'component', label: 'Users', x: 0, y: 200, width: 220, height: 88, color: 'gray', icon: 'user' },
  ],
  connections: [
    { id: 'request', from: 'user', to: 'api', label: 'HTTPS', style: 'solid', arrow: 'forward' },
    { id: 'boundary', from: 'user', to: 'outer', label: 'Access', style: 'dashed', arrow: 'forward' },
  ],
}

test('should_resolve_absolute_position_when_boundaries_are_nested', () => {
  assert.deepEqual(absolutePosition(fixture, 'api'), { x: 150, y: 160 })
})

test('should_move_descendants_once_when_a_boundary_moves', () => {
  const next = moveEntity(fixture, 'outer', 200, 120)
  assert.deepEqual(absolutePosition(next, 'api'), { x: 250, y: 230 })
  assert.deepEqual(next.entities.find(entity => entity.id === 'api'), fixture.entities[2])
  assert.deepEqual(next.entities.find(entity => entity.id === 'user'), fixture.entities[3])
})

test('should_preserve_children_when_a_boundary_is_removed', () => {
  const next = removeEntities(fixture, ['inner'])
  assert.deepEqual(absolutePosition(next, 'api'), { x: 150, y: 160 })
  assert.equal(next.entities.find(entity => entity.id === 'api')?.parentId, 'outer')
  assert.equal(next.connections.length, 2)
})

test('should_remove_incident_edges_when_a_component_is_deleted', () => {
  const next = removeEntities(fixture, ['api'])
  assert.deepEqual(next.connections.map(connection => connection.id), ['boundary'])
})

test('should_restore_exact_geometry_when_a_transaction_is_undone_and_redone', () => {
  const moved = moveEntity(fixture, 'api', 80, 90)
  const initial = { past: [], present: fixture, future: [] }
  const committed = historyCommit(initial, moved)
  const undone = historyUndo(committed)
  assert.deepEqual(undone.present, fixture)
  assert.deepEqual(historyRedo(undone).present, moved)
})

test('should_follow_moved_endpoints_when_scene_paths_are_rebuilt', () => {
  const before = buildScene(fixture).connections[0]
  const after = buildScene(moveEntity(fixture, 'api', 80, 90)).connections[0]
  assert.notEqual(before.path, after.path)
  assert.equal(buildScene(fixture).connections.length, 2)
})

test('should_escape_labels_when_svg_is_exported', () => {
  const malicious = { ...fixture, title: '<script>alert("test")</script>', entities: fixture.entities.map(entity => ({ ...entity, label: '<img onerror="alert(1)"> & text' })) }
  const svg = renderSvg(buildScene(malicious))
  assert.ok(svg.includes('&lt;script&gt;'))
  assert.ok(svg.includes('&amp;'))
  assert.ok(!svg.includes('<script'))
  assert.ok(!svg.includes('<img'))
  assert.ok(!svg.includes('foreignObject'))
  assert.ok(!svg.includes('href="http'))
})

test('should_wrap_long_words_when_labels_exceed_tile_width', () => {
  const lines = wrapText('AnExtremelyLongUnbrokenArchitectureComponentName', 22)
  assert.ok(lines.length > 1)
  assert.ok(lines.every(line => line.length <= 22))
  assert.equal(lines.join(''), 'AnExtremelyLongUnbrokenArchitectureComponentName')
})

test('should_double_dimensions_when_png_scale_is_two', () => {
  const scene = buildScene(fixture)
  const single = pngDimensions(scene, 1)
  const double = pngDimensions(scene, 2)
  assert.equal(double.width, single.width * 2)
  assert.equal(double.height, single.height * 2)
})

test('should_reject_oversized_png_when_pixel_cap_is_exceeded', () => {
  const scene = { ...buildScene(fixture), width: 9000, height: 9000 }
  assert.throws(() => pngDimensions(scene, 2), /too large/i)
})