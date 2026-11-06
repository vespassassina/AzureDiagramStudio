import assert from 'node:assert/strict'
import { test } from 'vitest'
import { applyCommand } from './document/index.ts'
import { createDocument, historyCommit, historyUndo } from './model.ts'
import { buildScene, entityMarkup, renderSvg } from './scene.ts'
import { validateDocument } from './document/validation.ts'

const style = {
  id: 'degraded',
  name: 'Degraded',
  meaning: 'Service is available with reduced capability.',
  box: { fill: '#f80', stroke: '#112233', textColor: '#ffffff', strokeWidth: 2, lineStyle: 'dotted' },
  connector: { stroke: '#f80', textColor: '#112233', strokeWidth: 3, lineStyle: 'dashed' },
}

test('should_validate_v2_page_state_styles_normalize_paint_and_keep_legacy_defaults_DGM157', () => {
  const legacy = { ...createDocument('legacy'), entities: [{ id: 'box', kind: 'component' as const, label: 'Box', x: 0, y: 0, width: 220, height: 88, color: 'azure', status: 'planned' as const }] }
  assert.ok(validateDocument(legacy).ok)

  const custom = validateDocument({ ...legacy, schemaVersion: 2, stateStyles: [style], entities: [{ ...legacy.entities[0], status: 'degraded' }, { ...legacy.entities[0], id: 'peer', x: 300, status: 'degraded' }], connections: [{ id: 'edge', from: 'box', to: 'peer', label: 'Call', style: 'solid', arrow: 'forward', status: 'degraded' }] })
  assert.ok(custom.ok)
  if (!custom.ok) return
  assert.deepEqual(custom.value.stateStyles, [{ ...style, box: { ...style.box, fill: '#ff8800' }, connector: { ...style.connector, stroke: '#ff8800' } }])
  const svg = renderSvg(buildScene(custom.value))
  assert.equal(svg.includes('Degraded'), true)
  assert.equal(svg.includes('Service is available with reduced capability.'), true)
  assert.match(svg, /fill="#ff8800"/)
  assert.match(svg, /stroke="#112233" stroke-width="2" stroke-dasharray="1 3"/)
  assert.match(svg, /stroke="#ff8800" stroke-width="3" stroke-dasharray="6 5"/)
  assert.match(svg, /fill="#ffffff"/)
})

test('should_replace_used_state_atomically_with_one_undo_DGM157', () => {
  const document = {
    ...createDocument('custom'),
    schemaVersion: 2 as const,
    stateStyles: [style, { ...style, id: 'healthy', name: 'Healthy', meaning: 'Normal operation.' }],
    entities: [
      { id: 'box', kind: 'component' as const, label: 'Box', x: 0, y: 0, width: 220, height: 88, color: 'azure', status: 'degraded' },
      { id: 'peer', kind: 'component' as const, label: 'Peer', x: 300, y: 0, width: 220, height: 88, color: 'azure' },
    ],
    connections: [{ id: 'edge', from: 'box', to: 'peer', label: '', style: 'solid' as const, arrow: 'none' as const, status: 'degraded' }],
  }
  const next = applyCommand(document as never, { type: 'configureStateStyles', stateStyles: [{ ...style, id: 'healthy', name: 'Healthy', meaning: 'Normal operation.' }], remap: { degraded: 'healthy' } } as never)
  assert.equal(next.entities[0].status, 'healthy')
  assert.equal(next.connections[0].status, 'healthy')
  assert.deepEqual(historyUndo(historyCommit({ past: [], present: document as never, future: [] }, next)).present, document)
})

test('should_reject_used_state_removal_without_explicit_remap_DGM157', () => {
  const document = {
    ...createDocument('custom'),
    schemaVersion: 2 as const,
    stateStyles: [style],
    entities: [{ id: 'box', kind: 'component' as const, label: 'Box', x: 0, y: 0, width: 220, height: 88, color: 'azure', status: 'degraded' }],
  }
  assert.throws(() => applyCommand(document as never, { type: 'configureStateStyles', stateStyles: [] } as never), /state/i)
})

test('should_apply_configured_box_paint_to_every_supported_entity_kind_DGM157', () => {
  const document = {
    ...createDocument('paint-kinds'),
    schemaVersion: 2 as const,
    stateStyles: [style],
    entities: (['boundary', 'component', 'rectangle', 'text'] as const).map((kind, index) => ({
      id: kind, kind, label: kind, x: index * 300, y: 0, width: kind === 'text' ? 240 : 220, height: kind === 'text' ? 40 : 88, color: 'azure', status: 'degraded',
    })),
  }
  const validated = validateDocument(document)
  assert.ok(validated.ok)
  if (!validated.ok) return
  for (const entity of validated.value.entities) {
    const markup = entityMarkup({ ...entity, stateStyle: validated.value.stateStyles![0] } as never)
    assert.match(markup, /fill="#ffffff"/, entity.kind)
    if (entity.kind === 'text') continue
    assert.match(markup, /fill="#ff8800"/, entity.kind)
    assert.match(markup, /stroke="#112233"/, entity.kind)
    assert.match(markup, /stroke-width="2"/, entity.kind)
    assert.match(markup, /stroke-dasharray="1 3"/, entity.kind)
  }
})

test('should_preserve_entity_geometry_anchors_and_routes_for_status_only_updates_DGM157', () => {
  const document = {
    ...createDocument('status-invariants'),
    schemaVersion: 2 as const,
    revision: 7,
    legend: [{ label: 'Manual entry', color: '#123456', meaning: 'Manual legend content.' }],
    stateStyles: [{ ...style, box: { ...style.box, fill: '#ff8800' }, connector: { ...style.connector, stroke: '#ff8800' } }],
    entities: [
      { id: 'web-edge', kind: 'boundary' as const, label: 'Web API boundary geometry must remain stable when its functional state changes', subtitle: 'A deliberately long boundary subtitle proves that status-only updates do not rerun text measurement or ancestor expansion.', x: 100, y: 100, width: 220, height: 430, color: 'azure' },
      { id: 'web-apim', kind: 'component' as const, label: 'API Management', parentId: 'web-edge', x: 280, y: 180, width: 220, height: 88, color: 'azure' },
      { id: 'peer', kind: 'component' as const, label: 'Peer', x: 1200, y: 280, width: 220, height: 88, color: 'azure' },
    ],
    connections: [{
      id: 'web-edge-peer', from: 'web-edge', to: 'peer', label: 'Authored route', style: 'solid' as const, arrow: 'forward' as const,
      sourceSide: 'right' as const, targetSide: 'left' as const, sourceOffset: 0.25, targetOffset: 0.75,
      points: [{ x: 1000, y: 208 }, { x: 1200, y: 208 }], labelPosition: { x: 1100, y: 208 }, routeRevision: 7,
    }],
  }
  const invariant = (value: typeof document) => ({
    entities: value.entities.map(({ id, parentId, x, y, width, height }) => ({ id, parentId, x, y, width, height })),
    connections: value.connections.map(({ id, from, to, sourceSide, targetSide, sourceOffset, targetOffset, points, labelPosition }) =>
      ({ id, from, to, sourceSide, targetSide, sourceOffset, targetOffset, points, labelPosition })),
    legend: value.legend,
  })
  const validated = validateDocument(document)
  assert.ok(validated.ok)
  if (!validated.ok) return
  const baseline = validated.value
  const before = invariant(baseline as typeof document)

  const entityOnly = applyCommand(baseline as never, { type: 'updateEntity', id: 'web-edge', patch: { status: 'degraded' } } as never)
  assert.deepEqual(invariant(entityOnly as typeof document), before)
  assert.equal(entityOnly.connections[0].routeRevision, entityOnly.revision)

  const connectionOnly = applyCommand(baseline as never, { type: 'updateConnection', id: 'web-edge-peer', patch: { status: 'degraded' } } as never)
  assert.deepEqual(invariant(connectionOnly as typeof document), before)
  assert.equal(connectionOnly.connections[0].routeRevision, connectionOnly.revision)

  const combined = applyCommand(entityOnly as never, { type: 'updateConnection', id: 'web-edge-peer', patch: { status: 'degraded' } } as never)
  assert.deepEqual(invariant(combined as typeof document), before)
  assert.equal(combined.connections[0].routeRevision, combined.revision)
  assert.equal(combined.entities[0].status, 'degraded')
  assert.equal(combined.connections[0].status, 'degraded')
})

test('should_upgrade_a_legacy_connection_status_assignment_to_v2_DGM157', () => {
  const document = {
    ...createDocument('legacy-connection-status'),
    entities: [
      { id: 'source', kind: 'component' as const, label: 'Source', x: 0, y: 0, width: 220, height: 88, color: 'azure' },
      { id: 'target', kind: 'component' as const, label: 'Target', x: 400, y: 0, width: 220, height: 88, color: 'azure' },
    ],
    connections: [{ id: 'edge', from: 'source', to: 'target', label: 'Route', style: 'solid' as const, arrow: 'forward' as const, sourceSide: 'right' as const, targetSide: 'left' as const, points: [{ x: 220, y: 44 }, { x: 400, y: 44 }], labelPosition: { x: 310, y: 44 }, routeRevision: 0 }],
  }
  const next = applyCommand(document as never, { type: 'updateConnection', id: 'edge', patch: { status: 'live' } } as never)
  assert.equal(next.schemaVersion, 2)
  assert.equal(next.connections[0].status, 'live')
  assert.equal(next.connections[0].points?.length, 2)
  const cleared = applyCommand(next, { type: 'updateConnection', id: 'edge', patch: { status: undefined } } as never)
  assert.equal(Object.hasOwn(cleared.connections[0], 'status'), false)
  assert.equal(cleared.connections[0].points?.length, 2)
})
