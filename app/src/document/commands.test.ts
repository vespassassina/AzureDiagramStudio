import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { computeLayout } from '../layout.ts'
import { absolutePosition, createDocument, historyCommit, historyRedo, historyUndo, measureEntity, sampleDiagram } from '../model.ts'
import type { Diagram, Entity } from '../model.ts'
import type { DocumentCommand } from '../contracts.ts'
import { applyCommand, captureSelection } from './index.ts'
import { validateDocument } from './validation.ts'
import * as documentValidation from './validation.ts'
import { buildScene, renderSvg } from '../scene.ts'
import { effectiveOrder, painterOrder, siblingScopes } from '../order.ts'
import { parseDocument } from './index.ts'
import { effectiveGrid } from '../grid.ts'

function entity(id: string, kind: Entity['kind'] = 'component', parentId: string | null = null): Entity {
  return { id, kind, parentId, layer: 'foreground', label: id, x: 32, y: 64, width: kind === 'boundary' ? 400 : 220, height: kind === 'boundary' ? 300 : 88, color: 'teal', ...(kind === 'component' ? { icon: 'service' } : {}) }
}
function nested(): Diagram {
  return { ...createDocument('test'), entities: [entity('outer', 'boundary'), entity('inner', 'boundary', 'outer'), entity('child', 'component', 'inner'), { ...entity('peer'), x: 900 }], connections: [{ id: 'link', from: 'child', to: 'peer', label: 'Call', style: 'dashed', arrow: 'both' }] }
}
function rejects(document: Diagram, command: DocumentCommand, code?: string) {
  const before = JSON.stringify(document)
  assert.throws(() => applyCommand(document, command), (error: unknown) => {
    assert.ok(error instanceof Error)
    assert.equal(error.name, 'DomainError')
    if (code) assert.equal((error as Error & { code: string }).code, code)
    assert.ok((error as Error & { errors: unknown[] }).errors.length)
    return true
  })
  assert.equal(JSON.stringify(document), before)
}

test('should_commit_clear_undo_and_redo_description_without_artwork_changes_DGM122', () => {
  const document = sampleDiagram()
  document.connections[0] = { ...document.connections[0], points: [{ x: 10, y: 20 }, { x: 300, y: 90 }], labelPosition: { x: 150, y: 40 }, routeRevision: document.revision }
  const before = JSON.stringify(document)
  const description = '  # Architecture\r\n\r\n\u6f22\u5b57 \ud83d\ude00\n<script>alert(1)</script>\n![image](https://invalid.example/remote)  '
  const edited = applyCommand(document, { type: 'metadata', patch: { description } } as unknown as DocumentCommand)
  assert.equal((edited as unknown as { description: string }).description, description)
  assert.deepEqual(edited.entities, document.entities)
  assert.deepEqual(edited.connections, document.connections.map(connection => connection.routeRevision === document.revision ? { ...connection, routeRevision: edited.revision } : connection))
  assert.equal(renderSvg(buildScene(edited)), renderSvg(buildScene(document)))
  assert.deepEqual(captureSelection(edited, ['app']), captureSelection(document, ['app']))
  assert.deepEqual(parseDocument(JSON.stringify(edited)), { ok: true, value: edited })
  const history = historyCommit({ past: [], present: document, future: [] }, edited)
  assert.equal(history.past.length, 1)
  assert.deepEqual(historyUndo(history).present, document)
  assert.deepEqual(historyRedo(historyUndo(history)).present, edited)
  const cleared = applyCommand(edited, { type: 'metadata', patch: { description: undefined } } as unknown as DocumentCommand)
  assert.equal(Object.hasOwn(cleared, 'description'), false)
  assert.equal(JSON.stringify(document), before)
})

test.each([null, 1, true, [], {}, 'x'.repeat(20001)])('should_reject_invalid_metadata_description_without_mutation_DGM122_%j', description => {
  rejects(sampleDiagram(), { type: 'metadata', patch: { description } } as unknown as DocumentCommand, 'invalid-command')
})

function connected(sourceId = 'child', parentId: string | null = 'inner') {
  return { type: 'addConnected', sourceId, entity: { ...entity('added', 'component', parentId), x: -300, y: -160 }, connection: { id: 'added-link', from: sourceId, to: 'added', label: 'New call', style: 'dashed', arrow: 'both', sourceSide: 'left', targetSide: 'right' } } as unknown as DocumentCommand
}

test.each(['child', 'inner', 'peer'])('should_add_connected_atomically_with_expected_parent_and_one_undo_when_source_is_%s', sourceId => {
  const document = nested()
  document.entities[0].width = 500; document.entities[0].height = 450
  const parentId = sourceId === 'peer' ? null : 'inner'
  const command = connected(sourceId, parentId)
  const before = JSON.stringify(document)
  const result = applyCommand(document, command)
  assert.equal(result.revision, 1)
  assert.equal(result.entities.length, document.entities.length + 1)
  assert.equal(result.connections.length, document.connections.length + 1)
  assert.deepEqual(result.connections.at(-1), (command as unknown as { connection: unknown }).connection)
  for (const original of document.entities) {
    const after = result.entities.find(item => item.id === original.id)!
    if (original.kind !== 'boundary') {
      assert.deepEqual(absolutePosition(result, original.id), absolutePosition(document, original.id))
      assert.deepEqual({ ...after, x: original.x, y: original.y }, original)
    } else {
      if (sourceId === 'peer') assert.deepEqual(after, original)
      assert.ok(after.width >= original.width && after.height >= original.height)
      for (const child of result.entities.filter(item => item.parentId === original.id)) {
        assert.ok(child.x >= 24 && child.y >= 0)
        assert.ok(child.x + child.width + 24 <= after.width && child.y + child.height + 24 <= after.height)
      }
    }
  }
  assert.equal(JSON.stringify(document), before)
  const history = historyCommit({ past: [], present: document, future: [] }, result)
  assert.equal(history.past.length, 1)
  assert.deepEqual(historyUndo(history).present, document)
  assert.deepEqual(historyRedo(historyUndo(history)).present, result)
})

test('should_grow_all_ancestors_without_moving_any_existing_object_when_connected_sibling_exceeds_bounds', () => {
  const document = nested()
  const command = connected() as unknown as { entity: Entity }
  command.entity.x = 850; command.entity.y = 750
  const result = applyCommand(document, command as unknown as DocumentCommand)
  for (const original of document.entities) assert.deepEqual(absolutePosition(result, original.id), absolutePosition(document, original.id))
  const inner = result.entities.find(item => item.id === 'inner')!
  const outer = result.entities.find(item => item.id === 'outer')!
  assert.ok(inner.width >= 1094 && inner.height >= 862)
  assert.ok(outer.width >= inner.x + inner.width + 24 && outer.height >= inner.y + inner.height + 24)
})

test.each([
  ['missing source', { sourceId: 'missing' }, 'unknown-id'],
  ['bad source type', { sourceId: 42 }, 'invalid-command'],
  ['duplicate entity', { entity: entity('peer', 'component', 'inner') }, 'duplicate-id'],
  ['duplicate connection', { connection: { id: 'link', from: 'child', to: 'added', label: '', style: 'solid', arrow: 'forward' } }, 'duplicate-id'],
  ['cross duplicate', { connection: { id: 'added', from: 'child', to: 'added', label: '', style: 'solid', arrow: 'forward' } }, 'duplicate-id'],
  ['non component', { entity: entity('added', 'boundary', 'inner') }, 'invalid-command'],
  ['wrong parent', { entity: entity('added', 'component', 'outer') }, 'invalid-parent'],
  ['cyclic parent', { entity: entity('added', 'component', 'added') }, 'invalid-parent'],
  ['source mismatch', { connection: { id: 'added-link', from: 'peer', to: 'added', label: '', style: 'solid', arrow: 'forward' } }, 'invalid-connection'],
  ['target mismatch', { connection: { id: 'added-link', from: 'child', to: 'peer', label: '', style: 'solid', arrow: 'forward' } }, 'invalid-connection'],
  ['invalid direction', { connection: { id: 'added-link', from: 'child', to: 'added', label: '', style: 'solid', arrow: 'backward' } }, 'invalid-command'],
  ['invalid style', { connection: { id: 'added-link', from: 'child', to: 'added', label: '', style: 'dotted', arrow: 'forward' } }, 'invalid-command'],
  ['invalid geometry', { entity: { ...entity('added', 'component', 'inner'), x: Infinity } }, 'invalid-command'],
  ['null entity', { entity: null }, 'invalid-command'],
  ['null connection', { connection: null }, 'invalid-command'],
] as const)('should_reject_addConnected_without_partial_mutation_when_%s', (_name, patch, code) => {
  rejects(nested(), { ...connected(), ...patch } as unknown as DocumentCommand, code)
})

test.each(['text', 'rectangle'] as const)('should_reject_addConnected_from_nonconnectable_%s_atomically', kind => {
  const document = nested()
  document.entities.push(entity('annotation', kind))
  rejects(document, connected('annotation', null), 'invalid-connection')
})

test.each(['entities', 'connections'] as const)('should_reject_addConnected_at_the_%s_limit_without_abandoned_objects', collection => {
  const document = nested()
  if (collection === 'entities') document.entities.push(...Array.from({ length: 96 }, (_, index) => entity(`limit-${index}`)))
  else document.connections = Array.from({ length: 150 }, (_, index) => ({ ...document.connections[0], id: `limit-${index}` }))
  assert.ok(validateDocument(document).ok)
  rejects(document, connected(), 'limit-exceeded')
})

test('should_reject_circular_runtime_addConnected_contract_without_executing_or_mutating_it', () => {
  const command = connected() as unknown as Record<string, unknown>
  command.extra = command
  rejects(nested(), command as unknown as DocumentCommand, 'invalid-command')
})

test('should_preserve_routes_positions_history_and_reload_when_background_settings_change', () => {
  const document = nested()
  document.connections[0] = { ...document.connections[0], points: [{ x: 900, y: 108 }, { x: 700, y: 208 }], labelPosition: { x: 800, y: 158 }, routeRevision: 0 }
  const source = JSON.stringify(document)
  const next = applyCommand(document, { type: 'metadata', patch: { backgroundColor: '#123abc' } })
  assert.equal(next.backgroundColor, '#123abc')
  assert.deepEqual(next.entities, document.entities)
  assert.deepEqual(next.connections, document.connections.map(connection => ({ ...connection, routeRevision: next.revision })))
  assert.deepEqual(buildScene(next).connections[0].points, document.connections[0].points)
  assert.deepEqual(parseDocument(JSON.stringify(next)), { ok: true, value: next })
  const history = historyCommit({ past: [], present: document, future: [] }, next)
  assert.equal(history.past.length, 1)
  assert.deepEqual(historyUndo(history).present, document)
  assert.deepEqual(historyRedo(historyUndo(history)).present, next)
  const reset = applyCommand(next, { type: 'metadata', patch: { backgroundColor: undefined } })
  assert.equal(Object.hasOwn(reset, 'backgroundColor'), false)
  assert.deepEqual(reset.entities, document.entities)
  assert.deepEqual(reset.connections[0].points, document.connections[0].points)
  assert.equal(JSON.stringify(document), source)
  rejects(next, { type: 'metadata', patch: { backgroundColor: 'url(https://evil)' } }, 'invalid-command')
})

test('should_change_grid_metadata_reversibly_without_geometry_or_route_loss', () => {
  const document = nested()
  document.connections[0] = { ...document.connections[0], points: [{ x: 900, y: 108 }, { x: 700, y: 208 }], labelPosition: { x: 800, y: 158 }, routeRevision: 0 }
  const grid = { ...effectiveGrid(), visible: false, snap: false, spacing: 16, present: true, export: true }
  const next = applyCommand(document, { type: 'metadata', patch: { grid } })
  assert.deepEqual(next.grid, grid)
  assert.deepEqual(next.entities, document.entities)
  assert.deepEqual(next.connections, document.connections.map(connection => ({ ...connection, routeRevision: 1 })))
  assert.deepEqual(historyUndo(historyCommit({ past: [], present: document, future: [] }, next)).present, document)
  assert.deepEqual(parseDocument(JSON.stringify(next)), { ok: true, value: next })
  assert.equal(Object.hasOwn(applyCommand(next, { type: 'metadata', patch: { grid: undefined } }), 'grid'), false)
  rejects(document, { type: 'metadata', patch: { grid: { ...grid, spacing: 3 } } }, 'invalid-command')
})

test.each([true, false])('should_align_paste_root_origin_once_and_retain_all_relative_offsets_when_snap_is_%s', snap => {
  const document = { ...nested(), grid: { ...effectiveGrid(), spacing: 16, snap } }
  document.entities[0].x = 35.5
  document.entities[0].y = 67.25
  document.entities[1].x = 33.5
  document.entities[2].y = 65.25
  document.entities[3].y = 71
  const fragment = captureSelection(document, ['outer', 'peer'])
  const next = applyCommand(document, { type: 'paste', fragment, idMap: { outer: 'new-outer', inner: 'new-inner', child: 'new-child', peer: 'new-peer', link: 'new-link' }, offset: { x: 32, y: 32 } })
  const root = next.entities.find(entity => entity.id === 'new-outer')!
  const correction = snap ? { x: -3.5, y: -3.25 } : { x: 0, y: 0 }
  assert.equal(root.x, document.entities[0].x + 32 + correction.x)
  assert.equal(root.y, document.entities[0].y + 32 + correction.y)
  for (const id of ['inner', 'child']) {
    const before = document.entities.find(entity => entity.id === id)!
    const after = next.entities.find(entity => entity.id === `new-${id}`)!
    assert.deepEqual({ x: after.x, y: after.y }, { x: before.x, y: before.y })
  }
  const peer = next.entities.find(entity => entity.id === 'new-peer')!
  assert.equal(peer.x - root.x, document.entities[3].x - document.entities[0].x)
  assert.equal(peer.y - root.y, document.entities[3].y - document.entities[0].y)
})

test('should_resize_once_without_moving_descendants_or_clipping_them', () => {
  const document = nested()
  const before = absolutePosition(document, 'child')
  const next = applyCommand(document, { type: 'resize', id: 'outer', width: 500, height: 400 })
  assert.deepEqual(absolutePosition(next, 'child'), before)
  assert.deepEqual({ x: next.entities[0].x, y: next.entities[0].y }, { x: document.entities[0].x, y: document.entities[0].y })
  assert.deepEqual(historyUndo(historyCommit({ past: [], present: document, future: [] }, next)).present, document)
  rejects(document, { type: 'resize', id: 'outer', width: 300, height: 200 }, 'invalid-command')
})

test('should_keep_explicit_layout_geometry_unquantized_when_grid_snap_is_enabled', () => {
  const document = { ...nested(), grid: { ...effectiveGrid(), spacing: 128 } }
  const layout = structuredClone(document)
  layout.entities.find(entity => entity.id === 'peer')!.x = 903.75
  const next = applyCommand(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } })
  assert.equal(next.entities.find(entity => entity.id === 'peer')!.x, 903.75)
  assert.deepEqual(next.grid, document.grid)
  assert.deepEqual(historyUndo(historyCommit({ past: [], present: document, future: [] }, next)).present, document)
})

test('should_restamp_only_valid_routes_when_appearance_changes_but_invalidate_on_direction_change', () => {
  const document = nested()
  document.revision = 2
  document.connections[0] = { ...document.connections[0], points: [{ x: 1, y: 2 }, { x: 3, y: 4 }], routeRevision: 1 }
  const next = applyCommand(document, { type: 'metadata', patch: { backgroundColor: '#abc' } })
  assert.equal(next.connections[0].routeRevision, 1)
  const direction = applyCommand(next, { type: 'metadata', patch: { backgroundColor: '#def', direction: 'DOWN' } })
  assert.equal(direction.connections[0].points, undefined)
})

test('should_retain_background_when_layout_is_applied_or_content_is_pasted', () => {
  const document = { ...nested(), backgroundColor: '#0f0' }
  const layout = structuredClone(document)
  layout.entities.find(entity => entity.id === 'peer')!.x += 80
  const next = applyCommand(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } })
  assert.equal(next.backgroundColor, document.backgroundColor)
  const fragment = captureSelection(document, ['peer'])
  const pasted = applyCommand(next, { type: 'paste', fragment, idMap: { peer: 'pasted' }, offset: { x: 32, y: 64 } })
  assert.equal(pasted.backgroundColor, document.backgroundColor)
  const stripped: Diagram = structuredClone(layout)
  delete stripped.backgroundColor
  rejects(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: stripped } }, 'invalid-command')
})

test('should_preserve_F1_document_routes_and_paint_when_already_bottom_rectangle_is_sent_to_bottom', () => {
  const document = { ...createDocument('F1'), entities: [entity('front'), { ...entity('back', 'rectangle'), layer: 'background' as const }, entity('boundary', 'boundary')] }
  document.connections = [{ id: 'route', from: 'front', to: 'boundary', label: 'Saved route', style: 'solid', arrow: 'none', points: [{ x: 252, y: 108 }, { x: 400, y: 108 }], labelPosition: { x: 326, y: 108 }, routeRevision: 0 }]
  const before = structuredClone(document)
  const svg = renderSvg(buildScene(document))
  const result = applyCommand(document, { type: 'order', ids: ['back'], position: 'bottom' })
  assert.equal(renderSvg(buildScene(result)), svg)
  assert.deepEqual(result, before)
  assert.equal(result, document)
  const history = { past: [], present: document, future: [] }
  assert.equal(historyCommit(history, result), history)
})

test('should_validate_input_and_final_publication_only_when_no_ancestry_growth_is_needed', () => {
  const document = nested()
  const validate = vi.spyOn(documentValidation, 'validateDocument')
  try {
    const result = applyCommand(document, { type: 'move', positions: [{ id: 'peer', x: 904, y: 64 }] })
    assert.equal(result.revision, 1)
    assert.equal(validate.mock.calls.length, 2)
    assert.equal(validate.mock.calls[0][0], document)
    const published = validate.mock.calls[1][0] as Diagram
    assert.equal(published.revision, 1)
    assert.deepEqual(result, published)
  } finally {
    validate.mockRestore()
  }
})

test('should_validate_layout_routes_before_restamping_and_final_publication_when_layout_is_applied', () => {
  const document = nested()
  const layout = structuredClone(document)
  layout.connections[0] = { ...layout.connections[0], points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], labelPosition: { x: 0.5, y: 0.5 }, routeRevision: 0 }
  const validate = vi.spyOn(documentValidation, 'validateDocument')
  try {
    const result = applyCommand(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } })
    assert.equal(validate.mock.calls.length, 3)
    assert.equal((validate.mock.calls[1][0] as Diagram).connections[0].routeRevision, 0)
    assert.equal((validate.mock.calls[2][0] as Diagram).connections[0].routeRevision, 1)
    assert.equal(result.connections[0].routeRevision, result.revision)
    assert.equal(layout.connections[0].routeRevision, 0)
  } finally {
    validate.mockRestore()
  }
})

test('should_reject_malicious_layout_routes_atomically_when_their_final_stamp_would_hide_bad_input', () => {
  const document = nested()
  const mutations: ((diagram: Diagram) => void)[] = [
    diagram => { diagram.connections[0].routeRevision = 99 },
    diagram => { diagram.connections[0].points = [{ x: NaN, y: 0 }, { x: 1, y: 1 }] },
    diagram => { diagram.connections[0].points = [{ x: 0, y: 0 }] },
    diagram => { diagram.connections[0].labelPosition = { x: Infinity, y: 0 } },
    diagram => { Object.assign(diagram.connections[0], { sourceSide: 'corner' }) },
    diagram => { diagram.connections[0].from = 'missing' },
    diagram => { Object.defineProperty(diagram.connections[0].points![0], 'x', { get() { assert.fail('Route accessor executed') } }) },
    diagram => { Object.assign(diagram.connections[0], { toJSON() { assert.fail('Route hook executed') } }) },
  ]
  for (const [index, mutate] of mutations.entries()) {
    const layout = structuredClone(document)
    layout.connections[0] = { ...layout.connections[0], points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], routeRevision: 0 }
    mutate(layout)
    rejects(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } }, index === 5 ? 'invalid-connection' : 'invalid-command')
  }
})

test('should_revalidate_mutable_snapshots_and_revision_overflow_when_commands_are_applied', () => {
  const document = nested()
  const accepted = validateDocument(document)
  assert.ok(accepted.ok)
  assert.equal(Object.isFrozen(document), false)
  assert.equal(Object.isFrozen(accepted.value.entities[0]), false)
  accepted.value.entities[0].x = Infinity
  rejects(accepted.value, { type: 'metadata', patch: { title: 'Changed' } }, 'invalid-document')
  document.revision = Number.MAX_SAFE_INTEGER
  rejects(document, { type: 'metadata', patch: { title: 'Changed' } }, 'invalid-command')
})

test('should_commit_one_revision_when_ordinary_commands_are_applied', () => {
  const original = sampleDiagram()
  const updated = applyCommand(original, { type: 'updateEntity', id: 'app', patch: { label: 'Updated', status: 'planned' } })
  assert.equal(updated.revision, 1)
  assert.equal(original.entities.find(item => item.id === 'app')?.label, 'App Service')
  assert.deepEqual(updated.entities.find(item => item.id === 'users'), original.entities.find(item => item.id === 'users'))
  const metadata = applyCommand(updated, { type: 'metadata', patch: { title: 'Changed', legendVisible: false } })
  assert.equal(metadata.revision, 2)
  assert.equal(metadata.title, 'Changed')
  assert.deepEqual(historyUndo(historyCommit({ past: [], present: original, future: [] }, updated)).present, original)
  assert.deepEqual(historyRedo(historyUndo(historyCommit({ past: [], present: original, future: [] }, updated))).present, updated)
})

test('should_preserve_absolute_positions_when_boundaries_are_removed_or_ungrouped', () => {
  for (const command of [{ type: 'remove', entityIds: ['outer', 'inner'], connectionIds: [] }, { type: 'ungroup', boundaryIds: ['outer', 'inner'] }] as DocumentCommand[]) {
    const document = nested()
    const result = applyCommand(document, command)
    assert.deepEqual(absolutePosition(result, 'child'), absolutePosition(document, 'child'))
    assert.equal(result.entities.find(item => item.id === 'child')?.parentId, null)
    assert.equal(result.connections.length, 1)
  }
  const result = applyCommand(nested(), { type: 'remove', entityIds: ['child'], connectionIds: [] })
  assert.equal(result.connections.length, 0)
})

test('should_move_descendants_once_when_parent_and_child_are_selected', () => {
  const document = nested()
  const result = applyCommand(document, { type: 'move', positions: [{ id: 'outer', x: 72, y: 104 }, { id: 'child', x: 72, y: 104 }] })
  assert.deepEqual(absolutePosition(result, 'child'), { x: absolutePosition(document, 'child').x + 40, y: absolutePosition(document, 'child').y + 40 })
  assert.equal(result.entities.find(item => item.id === 'child')?.x, 32)
})

test('should_reparent_across_boundaries_when_depth_allows', () => {
  const document = nested()
  const result = applyCommand(document, { type: 'reparent', ids: ['child'], parentId: 'outer' })
  assert.deepEqual(absolutePosition(result, 'child'), absolutePosition(document, 'child'))
  assert.equal(result.entities.find(item => item.id === 'child')?.parentId, 'outer')
  const detached = applyCommand(document, { type: 'reparent', ids: ['inner', 'child'], parentId: null })
  assert.equal(detached.entities.find(item => item.id === 'child')?.parentId, 'inner')
  assert.deepEqual(absolutePosition(detached, 'child'), absolutePosition(document, 'child'))
})

test('should_reject_cycles_depth_invalid_ids_and_clipping_atomically_when_commands_are_unsafe', () => {
  const document = nested()
  rejects(document, { type: 'reparent', ids: ['outer'], parentId: 'inner' }, 'invalid-parent')
  rejects(document, { type: 'group', ids: ['inner'], boundary: entity('third', 'boundary', 'outer') as Entity & { kind: 'boundary' } }, 'invalid-parent')
  rejects(document, { type: 'resize', id: 'inner', width: 10, height: 10 })
  rejects(document, { type: 'updateEntity', id: 'missing', patch: { label: 'X' } }, 'unknown-id')
  rejects(document, { type: 'addEntity', entity: entity('child') }, 'duplicate-id')
  rejects(document, { type: 'connect', connection: { id: 'bad', from: 'child', to: 'child', label: '', style: 'solid', arrow: 'none' } }, 'invalid-connection')
  rejects(document, { type: 'updateEntity', id: 'child', patch: { label: 'x'.repeat(121) } })
})

test('should_group_across_boundaries_and_grow_ancestors_when_text_grows', () => {
  const document = nested()
  const boundary = { ...entity('new', 'boundary'), x: 0, y: 0 } as Entity & { kind: 'boundary' }
  const grouped = applyCommand(document, { type: 'group', ids: ['child', 'peer'], boundary })
  for (const id of ['child', 'peer']) assert.deepEqual(absolutePosition(grouped, id), absolutePosition(document, id))
  assert.ok(grouped.entities.find(item => item.id === 'new')!.width >= 900 + 220)
  const updated = applyCommand(document, { type: 'updateEntity', id: 'child', patch: { label: 'LongLabel'.repeat(13), subtitle: 'Subtitle '.repeat(22) } })
  const child = updated.entities.find(item => item.id === 'child')!
  assert.deepEqual(measureEntity(child), { width: child.width, height: child.height })
  const inner = updated.entities.find(item => item.id === 'inner')!
  const outer = updated.entities.find(item => item.id === 'outer')!
  assert.ok(inner.height >= child.y + child.height)
  assert.ok(outer.height >= inner.y + inner.height)
})

test('should_copy_internal_topology_and_fresh_ids_when_a_boundary_is_pasted', () => {
  const document = nested()
  const fragment = captureSelection(document, ['inner', 'peer'])
  assert.equal(fragment.entities.length, 3)
  assert.equal(fragment.connections.length, 1)
  assert.equal(fragment.entities.find(item => item.id === 'inner')?.parentId, null)
  const idMap = { inner: 'inner-copy', child: 'child-copy', peer: 'peer-copy', link: 'link-copy' }
  const result = applyCommand(document, { type: 'paste', fragment, idMap, offset: { x: 24, y: 24 } })
  assert.equal(result.entities.find(item => item.id === 'child-copy')?.parentId, 'inner-copy')
  assert.equal(result.connections.at(-1)?.from, 'child-copy')
  for (const id of ['inner', 'child', 'peer'] as const) assert.deepEqual(absolutePosition(result, idMap[id]), { x: absolutePosition(document, id).x + 24, y: absolutePosition(document, id).y + 24 })
  assert.equal(captureSelection(document, ['inner']).connections.length, 0)
  rejects(document, { type: 'paste', fragment, idMap: {}, offset: { x: 0, y: 0 } })
})

test('should_split_label_upstream_and_preserve_style_when_inserting_on_a_connection', () => {
  const document = nested()
  const result = applyCommand(document, { type: 'insertOnConnection', connectionId: 'link', entity: entity('inserted'), upstreamId: 'up', downstreamId: 'down' })
  assert.equal(result.connections.length, 2)
  assert.deepEqual(result.connections.map(item => [item.from, item.to, item.label, item.style, item.arrow]), [['child', 'inserted', 'Call', 'dashed', 'both'], ['inserted', 'peer', '', 'dashed', 'both']])
  assert.equal(result.revision, 1)
  rejects(document, { type: 'insertOnConnection', connectionId: 'link', entity: entity('note', 'text'), upstreamId: 'up', downstreamId: 'down' })
})

test('should_invalidate_routes_and_commit_layout_once_when_the_revision_matches', () => {
  const document = nested()
  const layout = structuredClone(document)
  layout.entities[0].x += 40
  layout.connections[0] = { ...layout.connections[0], points: [{ x: 0, y: 0 }, { x: 10, y: 10 }], routeRevision: 0 }
  const result = applyCommand(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } })
  assert.equal(result.revision, 1)
  assert.equal(result.connections[0].routeRevision, 1)
  assert.deepEqual(result.connections[0].points, layout.connections[0].points)
  const moved = applyCommand(result, { type: 'move', positions: [{ id: 'peer', x: 1000, y: 0 }] })
  assert.equal(moved.connections[0].points, undefined)
  rejects(moved, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } }, 'stale-layout')
  layout.entities[0].label = 'Overwrite'
  rejects(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } })
})

function annotatedSample(kind: 'text' | 'rectangle', parentId: string): Diagram {
  const document = sampleDiagram()
  Object.assign(document.entities.find(item => item.id === 'note')!, { kind, parentId, x: 24, y: 170, width: 200, status: 'planned', layer: kind === 'rectangle' ? 'background' : 'foreground' })
  return document
}

function assertFixedAnnotation(before: Diagram, after: Diagram) {
  const position = absolutePosition(before, 'note')
  const actual = absolutePosition(after, 'note')
  assert.ok(Math.abs(actual.x - position.x) <= 1e-6, `Annotation canvas x changed: ${position.x} -> ${actual.x}`)
  assert.ok(Math.abs(actual.y - position.y) <= 1e-6, `Annotation canvas y changed: ${position.y} -> ${actual.y}`)
  const original = before.entities.find(item => item.id === 'note')!
  assert.deepEqual({ ...after.entities.find(item => item.id === 'note')!, x: original.x, y: original.y }, original)
}

const annotationLayouts = (['text', 'rectangle'] as const).flatMap(kind =>
  (['RIGHT', 'DOWN'] as const).flatMap(direction =>
    ['platform', 'application', 'data'].map(parentId => ({ kind, direction, parentId }))))

test.each(annotationLayouts)('should_apply_real_layout_when_kind=$kind direction=$direction parent=$parentId', async ({ kind, direction, parentId }) => {
  const document = annotatedSample(kind, parentId)
  const snapshot = structuredClone(document)
  const layout = await computeLayout(document, direction, document.revision)
  const note = document.entities.find(item => item.id === 'note')!
  const rebased = layout.diagram.entities.find(item => item.id === 'note')!
  assert.notDeepEqual({ x: rebased.x, y: rebased.y }, { x: note.x, y: note.y })
  assertFixedAnnotation(document, layout.diagram)

  const result = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result: layout })
  assertFixedAnnotation(document, result)
  assert.equal(result.direction, direction)
  assert.equal(result.revision, document.revision + 1)
  assert.deepEqual({ ...result, direction: document.direction, revision: document.revision, entities: document.entities, connections: document.connections }, document)
  for (const original of document.entities) {
    const updated = result.entities.find(item => item.id === original.id)!
    assert.deepEqual({ ...updated, x: original.x, y: original.y, width: original.width, height: original.height }, original)
  }
  assert.deepEqual(result.connections.map(({ points: _points, labelPosition: _label, routeRevision: _revision, ...connection }) => connection), document.connections)
  for (const connection of result.connections) {
    const computed = layout.diagram.connections.find(item => item.id === connection.id)!
    assert.ok(connection.points && connection.points.length >= 2)
    assert.equal(connection.routeRevision, result.revision)
    assert.deepEqual(connection.points, computed.points)
    assert.deepEqual(connection.labelPosition, computed.labelPosition)
  }
  const history = historyCommit({ past: [], present: document, future: [] }, result)
  assert.equal(history.past.length, 1)
  assert.deepEqual(historyUndo(history).present, document)
  assert.deepEqual(historyRedo(historyUndo(history)).present, result)
  assert.deepEqual(document, snapshot)
  assert.equal(layout.diagram.revision, document.revision)
  assert.ok(layout.diagram.connections.every(connection => connection.routeRevision === document.revision))
})

test.each(['RIGHT', 'DOWN'] as const)('should_apply_real_%s_layout_when_the_sample_note_is_reparented_by_command', async direction => {
  const sample = sampleDiagram()
  const document = applyCommand(sample, { type: 'reparent', ids: ['note'], parentId: 'application' })
  assert.deepEqual(absolutePosition(document, 'note'), absolutePosition(sample, 'note'))
  const layout = await computeLayout(document, direction, document.revision)
  const result = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result: layout })
  assertFixedAnnotation(document, result)
  assert.equal(result.revision, document.revision + 1)
})

test.each(annotationLayouts.filter(({ parentId }) => parentId === 'application'))('should_preserve_negative_absolute_coordinates_when_direction=$direction kind=$kind', async ({ kind, direction, parentId }) => {
  const document = annotatedSample(kind, parentId)
  Object.assign(document.entities.find(item => item.id === 'note')!, { x: -900.125, y: -700.375 })
  const position = absolutePosition(document, 'note')
  assert.ok(position.x < 0 && position.y < 0)
  const layout = await computeLayout(document, direction, document.revision)
  const result = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result: layout })
  assertFixedAnnotation(document, result)
  const note = result.entities.find(item => item.id === 'note')!
  assert.ok(Number.isFinite(note.x) && Number.isFinite(note.y))
  assert.ok(note.x < 0 && note.y < 0)
})

const annotationChanges: { change: string; patch: (annotation: Entity) => Partial<Entity> }[] = [
  { change: 'absolute-x', patch: annotation => ({ x: annotation.x + 2e-6 }) },
  { change: 'absolute-y', patch: annotation => ({ y: annotation.y - 2e-6 }) },
  { change: 'width', patch: annotation => ({ width: annotation.width + 1e-7 }) },
  { change: 'height', patch: annotation => ({ height: annotation.height + 1e-7 }) },
  { change: 'parent', patch: () => ({ parentId: 'data' }) },
  { change: 'label', patch: () => ({ label: 'Overwrite' }) },
  { change: 'subtitle', patch: () => ({ subtitle: 'Overwrite' }) },
  { change: 'status', patch: () => ({ status: 'live' }) },
  { change: 'color', patch: () => ({ color: 'rose' }) },
  { change: 'layer', patch: annotation => ({ layer: annotation.layer === 'background' ? 'foreground' : 'background' }) },
  { change: 'icon', patch: () => ({ icon: 'service' }) },
  { change: 'id', patch: () => ({ id: 'replaced-note' }) },
  { change: 'kind', patch: annotation => ({ kind: annotation.kind === 'text' ? 'rectangle' : 'text' }) },
]

test.each((['text', 'rectangle'] as const).flatMap(kind => annotationChanges.map(change => ({ kind, ...change }))))('should_reject_annotation_tampering_when_kind=$kind change=$change', async ({ kind, patch }) => {
  const document = annotatedSample(kind, 'application')
  const layout = await computeLayout(document, 'DOWN', document.revision)
  const note = layout.diagram.entities.find(item => item.id === 'note')!
  const originalPosition = absolutePosition(layout.diagram, note.id)
  const change = patch(note)
  Object.assign(note, change)
  if (Object.hasOwn(change, 'parentId')) {
    const parent = absolutePosition(layout.diagram, note.parentId!)
    Object.assign(note, { x: originalPosition.x - parent.x, y: originalPosition.y - parent.y })
  }
  assert.ok(validateDocument(layout.diagram).ok)
  rejects(document, { type: 'applyLayout', expectedRevision: document.revision, result: layout }, 'invalid-command')
})

test.each((['text', 'rectangle'] as const).flatMap(kind => [null, 'application'].map(parentId => ({ kind, parentId }))))('should_accept_only_tight_absolute_roundoff_when_kind=$kind parent=$parentId', async ({ kind, parentId }) => {
  const document = annotatedSample(kind, 'application')
  document.entities.find(item => item.id === 'note')!.parentId = parentId
  const layout = await computeLayout(document, 'DOWN', document.revision)
  const note = layout.diagram.entities.find(item => item.id === 'note')!
  note.x += 5e-7
  note.y -= 5e-7
  const result = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result: layout })
  assertFixedAnnotation(document, result)
  for (const axis of ['x', 'y'] as const) {
    const malicious = structuredClone(layout)
    malicious.diagram.entities.find(item => item.id === 'note')![axis] += 2e-6
    rejects(document, { type: 'applyLayout', expectedRevision: document.revision, result: malicious }, 'invalid-command')
  }
})

test('should_reject_unchanged_local_coordinates_when_layout_moves_the_annotation_parent', async () => {
  const document = annotatedSample('text', 'application')
  const layout = await computeLayout(document, 'DOWN', document.revision)
  const original = document.entities.find(item => item.id === 'note')!
  Object.assign(layout.diagram.entities.find(item => item.id === 'note')!, { x: original.x, y: original.y })
  assert.notDeepEqual(absolutePosition(layout.diagram, 'note'), absolutePosition(document, 'note'))
  rejects(document, { type: 'applyLayout', expectedRevision: document.revision, result: layout }, 'invalid-command')
})

test('should_reject_layout_content_and_membership_changes_when_annotations_are_legitimately_rebased', async () => {
  const document = annotatedSample('text', 'application')
  const layout = await computeLayout(document, 'DOWN', document.revision)
  const mutations: ((diagram: Diagram) => void)[] = [
    diagram => { diagram.id = 'replacement' },
    diagram => { diagram.title = 'Overwrite' },
    diagram => { diagram.subtitle = 'Overwrite' },
    diagram => { diagram.synthetic = false },
    diagram => { diagram.legendVisible = false },
    diagram => { diagram.legend = [{ label: 'Unexpected', color: 'rose' }] },
    diagram => { diagram.entities.find(item => item.id === 'app')!.label = 'Overwrite' },
    diagram => { diagram.entities.find(item => item.id === 'app')!.status = 'live' },
    diagram => { diagram.entities.find(item => item.id === 'app')!.color = 'rose' },
    diagram => { diagram.entities.find(item => item.id === 'app')!.icon = 'service' },
    diagram => { diagram.entities.find(item => item.id === 'app')!.parentId = 'data' },
    diagram => { diagram.entities = diagram.entities.filter(item => item.id !== 'note') },
    diagram => { diagram.entities.push({ ...diagram.entities.find(item => item.id === 'note')!, id: 'extra-note' }) },
    diagram => { diagram.connections[0].id = 'replacement-edge' },
    diagram => { diagram.connections[0].from = 'gateway' },
    diagram => { diagram.connections[0].to = 'app' },
    diagram => { diagram.connections[0].label = 'Overwrite' },
    diagram => { diagram.connections[0].style = 'dashed' },
    diagram => { diagram.connections[0].arrow = 'both' },
    diagram => { diagram.connections[0].sourceSide = 'left' },
    diagram => { diagram.connections[0].targetSide = 'bottom' },
    diagram => { diagram.connections.pop() },
  ]
  for (const mutate of mutations) {
    const malicious = structuredClone(layout)
    mutate(malicious.diagram)
    assert.ok(validateDocument(malicious.diagram).ok)
    rejects(document, { type: 'applyLayout', expectedRevision: document.revision, result: malicious }, 'invalid-command')
  }
})

test('should_reject_stale_layout_snapshots_when_annotations_are_legitimately_rebased', async () => {
  const document = annotatedSample('text', 'application')
  const layout = await computeLayout(document, 'DOWN', document.revision)
  const edited = applyCommand(document, { type: 'metadata', patch: { title: 'Newer work' } })
  assert.deepEqual(edited.entities, document.entities)
  rejects(edited, { type: 'applyLayout', expectedRevision: document.revision, result: layout }, 'stale-layout')
  rejects(document, { type: 'applyLayout', expectedRevision: document.revision + 1, result: layout }, 'stale-layout')
  rejects(document, { type: 'applyLayout', expectedRevision: document.revision, result: { ...layout, revision: document.revision + 1 } }, 'stale-layout')
  rejects(document, { type: 'applyLayout', expectedRevision: document.revision, result: { ...layout, diagram: { ...layout.diagram, revision: document.revision + 1 } } }, 'stale-layout')
})

test('should_preserve_annotation_positions_when_ordinary_content_edits_are_applied', () => {
  const document = annotatedSample('text', 'application')
  const result = applyCommand(document, { type: 'updateEntity', id: 'app', patch: { label: 'Updated', status: 'planned' } })
  assertFixedAnnotation(document, result)
  assert.deepEqual(result.entities.find(item => item.id === 'note'), document.entities.find(item => item.id === 'note'))
  assert.equal(result.revision, document.revision + 1)
})

test('should_handle_add_resize_reconnect_and_order_when_basic_commands_are_used', () => {
  let document = createDocument('basic')
  document = applyCommand(document, { type: 'addEntity', entity: entity('one') })
  document = applyCommand(document, { type: 'addEntity', entity: entity('two') })
  document = applyCommand(document, { type: 'resize', id: 'one', width: 300, height: 120 })
  document = applyCommand(document, { type: 'connect', connection: { id: 'edge', from: 'one', to: 'two', label: '', style: 'solid', arrow: 'forward' } })
  document = applyCommand(document, { type: 'updateConnection', id: 'edge', patch: { from: 'two', to: 'one', sourceSide: 'left', arrow: 'none' } })
  document = applyCommand(document, { type: 'order', ids: ['one'], layer: 'background' })
  assert.equal(document.revision, 6)
  assert.equal(document.entities[0].width, 300)
  assert.equal(document.entities[0].layer, 'background')
  assert.equal(document.connections[0].from, 'two')
})

test('should_throw_domain_errors_when_untyped_command_payloads_are_malformed', () => {
  for (const command of [
    { type: 'move', positions: [null] },
    { type: 'remove', entityIds: [null], connectionIds: [] },
    { type: 'applyLayout', expectedRevision: 0, result: null },
    { type: 'updateEntity', id: 'child', patch: { x: 500 } },
    { type: 'reparent', ids: ['child'], parentId: undefined },
    { type: 'order', ids: ['child'], layer: 'overlay' },
  ]) rejects(nested(), command as unknown as DocumentCommand)
})

test('should_expand_promoted_children_without_moving_them_when_a_boundary_is_removed', () => {
  const document = nested()
  document.entities.find(item => item.id === 'child')!.x = 500
  const before = absolutePosition(document, 'child')
  const result = applyCommand(document, { type: 'ungroup', boundaryIds: ['inner'] })
  const child = result.entities.find(item => item.id === 'child')!
  const outer = result.entities.find(item => item.id === 'outer')!
  assert.deepEqual(absolutePosition(result, 'child'), before)
  assert.ok(outer.width >= child.x + child.width)
})

test('should_preserve_absolute_geometry_when_reparenting_requires_left_and_top_growth', () => {
  const document = nested()
  document.entities.find(item => item.id === 'outer')!.x = 1000
  document.entities.find(item => item.id === 'outer')!.y = 1000
  const positions = new Map(document.entities.map(item => [item.id, absolutePosition(document, item.id)]))
  const result = applyCommand(document, { type: 'reparent', ids: ['peer'], parentId: 'inner' })
  for (const item of document.entities.filter(item => item.kind === 'component')) assert.deepEqual(absolutePosition(result, item.id), positions.get(item.id))
  const peer = result.entities.find(item => item.id === 'peer')!
  assert.ok(peer.x >= 0 && peer.y >= 0)
})

test('should_omit_routes_and_detach_clipboard_data_when_capture_is_modified', () => {
  const document = nested()
  document.connections[0] = { ...document.connections[0], points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], routeRevision: 0 }
  const fragment = captureSelection(document, ['inner', 'peer'])
  assert.equal(fragment.connections[0].points, undefined)
  fragment.entities[0].label = 'Changed'
  fragment.connections[0].label = 'Changed'
  assert.equal(document.entities[1].label, 'inner')
  assert.equal(document.connections[0].label, 'Call')
  const duplicate = { inner: 'copy', child: 'copy', peer: 'copy', link: 'copy' }
  rejects(document, { type: 'paste', fragment, idMap: duplicate, offset: { x: 24, y: 24 } }, 'duplicate-id')
})

test('should_reject_callable_command_payloads_without_execution_when_mutating', () => {
  let called = false
  const positions = [{ id: 'peer', x: 100, y: 100 }]
  Object.defineProperty(positions, 'map', { value: () => { called = true; return [] } })
  rejects(nested(), { type: 'move', positions })
  assert.equal(called, false)
})

const orderCases = [
  { position: 'forward', ids: ['b', 'c'], expected: ['a', 'd', 'b', 'c', 'e'] },
  { position: 'backward', ids: ['b', 'c'], expected: ['b', 'c', 'a', 'd', 'e'] },
  { position: 'top', ids: ['b', 'c'], expected: ['a', 'd', 'e', 'b', 'c'] },
  { position: 'bottom', ids: ['b', 'c'], expected: ['b', 'c', 'a', 'd', 'e'] },
  { position: 'forward', ids: ['b', 'd'], expected: ['a', 'c', 'b', 'e', 'd'] },
  { position: 'backward', ids: ['b', 'd'], expected: ['b', 'a', 'd', 'c', 'e'] },
  { position: 'top', ids: ['b', 'd'], expected: ['a', 'c', 'e', 'b', 'd'] },
  { position: 'bottom', ids: ['b', 'd'], expected: ['b', 'd', 'a', 'c', 'e'] },
] as const

test.each(orderCases)('should_reorder_each_sibling_scope_stably_when_$position_is_applied_to_$ids', ({ position, ids, expected }) => {
  const document = { ...createDocument('scopes'), entities: [entity('left', 'boundary'), entity('right', 'boundary'), ...['left', 'right'].flatMap(parent => ['a', 'b', 'c', 'd', 'e'].map(id => entity(`${parent}-${id}`, 'component', parent))), entity('untouched')] }
  const before = structuredClone(document)
  const result = applyCommand(document, { type: 'order', ids: [...ids].reverse().flatMap(id => [`left-${id}`, `right-${id}`]), position })
  for (const parent of ['left', 'right']) assert.deepEqual(siblingScopes(result.entities).get(parent)!.map(item => item.id), expected.map(id => `${parent}-${id}`))
  for (const id of ['left', 'right', 'untouched']) assert.deepEqual(result.entities.find(item => item.id === id), document.entities.find(item => item.id === id))
  assert.equal(result.revision, 1)
  assert.deepEqual(document, before)
})

test.each(orderCases)('should_reorder_applicable_bands_without_promoting_kinds_when_$position_moves_$ids', ({ position, ids, expected }) => {
  const groups = ['background', 'boundary', 'foreground'] as const
  const document: Diagram = { ...createDocument('bands'), entities: ['a', 'b', 'c', 'd', 'e'].flatMap(id => groups.map(band => ({ ...entity(`${band}-${id}`, band === 'boundary' ? 'boundary' : id === 'a' ? 'text' : 'rectangle'), ...(band === 'background' ? { layer: 'background' as const } : {}), order: id.charCodeAt(0) * 1e20 }))) }
  for (const id of ['a', 'b', 'c', 'd', 'e']) document.entities.push(entity(`child-${id}`, 'component', `boundary-${id}`), entity(`inner-${id}`, 'boundary', `boundary-${id}`), { ...entity(`back-${id}`, 'rectangle', `boundary-${id}`), layer: 'background' })
  const before = structuredClone(document)
  const result = applyCommand(document, { type: 'order', ids: groups.flatMap(band => ids.map(id => `${band}-${id}`)), position })
  for (const band of groups) {
    const prefix = `${band}-`
    assert.deepEqual(siblingScopes(result.entities).get(null)!.filter(item => item.id.startsWith(prefix)).map(item => item.id), expected.map(id => `${prefix}${id}`))
  }
  const paint = painterOrder(result.entities)
  assert.deepEqual(paint.foreground.filter(item => item.parentId).map(item => item.id), expected.map(id => `child-${id}`))
  assert.deepEqual(paint.boundaries.filter(item => item.id.startsWith('inner-')).map(item => item.id), expected.map(id => `inner-${id}`))
  for (const item of result.entities) {
    const original = document.entities.find(candidate => candidate.id === item.id)!
    assert.equal(item.kind, original.kind)
    assert.equal(item.layer, original.layer)
    if (item.parentId) assert.deepEqual(item, original)
  }
  assert.equal(result.revision, 1)
  assert.deepEqual(document, before)
})

test.each(['forward', 'backward', 'top', 'bottom'] as const)('should_preserve_exact_document_when_%s_has_only_other_band_or_parent_neighbors', position => {
  const document = nested()
  document.entities.push(entity('root-background', 'rectangle'))
  document.entities.at(-1)!.layer = 'background'
  for (const ids of [['outer'], ['peer'], ['child'], ['inner']]) {
    const result = applyCommand(document, { type: 'order', ids, position })
    assert.equal(result, document)
    assert.equal(historyCommit({ past: [], present: document, future: [] }, result).present, document)
  }
})

test.each(['background', 'foreground'] as const)('should_keep_legacy_%s_effective_after_numeric_moves_in_each_kind_and_parent_scope', layer => {
  const document = { ...createDocument('legacy-bands'), entities: [entity('left', 'boundary'), entity('right', 'boundary'), entity('one'), entity('two'), entity('child-one', 'component', 'left'), entity('child-two', 'text', 'left')] }
  const numeric = applyCommand(document, { type: 'order', ids: ['left', 'one', 'child-one'], position: 'top' })
  const result = applyCommand(numeric, { type: 'order', ids: ['right', 'two', 'child-two'], layer })
  for (const id of ['right', 'two', 'child-two']) assert.equal(result.entities.find(item => item.id === id)!.layer, layer)
  assert.deepEqual(siblingScopes(result.entities).get(null)!.map(item => item.id), layer === 'background' ? ['right', 'two', 'left', 'one'] : ['left', 'right', 'one', 'two'])
  assert.deepEqual(siblingScopes(result.entities).get('left')!.map(item => item.id), layer === 'background' ? ['child-two', 'child-one'] : ['child-one', 'child-two'])
  const paint = painterOrder(result.entities)
  for (const item of result.entities) {
    if (item.kind === 'boundary' || item.layer === 'background') assert.ok(paint.nodeZIndices.get(item.id)! < paint.connectionZIndex)
    else assert.ok(paint.nodeZIndices.get(item.id)! > paint.connectionZIndex)
    if (item.parentId) assert.ok(paint.nodeZIndices.get(item.parentId)! < paint.nodeZIndices.get(item.id)!)
  }
  assert.equal(applyCommand(result, { type: 'order', ids: ['right', 'two', 'child-two'], layer }), result)
})

test.each(['forward', 'backward', 'top', 'bottom'] as const)('should_ignore_selected_descendants_and_retain_subtree_metadata_when_%s_moves_a_boundary', position => {
  const document = nested()
  document.entities[0].order = 4
  document.entities.push({ ...entity('root-peer', 'boundary'), order: 5 })
  document.entities.push(entity('another', 'boundary', 'outer'))
  const result = applyCommand(document, { type: 'order', ids: ['outer', 'child', 'inner'], position })
  for (const id of ['inner', 'child', 'another']) assert.deepEqual(result.entities.find(item => item.id === id), document.entities.find(item => item.id === id))
  assert.equal(result.revision, position === 'backward' || position === 'bottom' ? 0 : 1)
})

test.each(['forward', 'backward', 'top', 'bottom'] as const)('should_return_exact_document_and_history_when_%s_has_no_unselected_sibling', position => {
  const document = nested()
  const result = applyCommand(document, { type: 'order', ids: ['outer', 'peer'], position })
  assert.equal(result, document)
  assert.equal(applyCommand(document, { type: 'order', ids: [], position }), document)
  const history = { past: [], present: document, future: [] }
  assert.equal(historyCommit(history, result), history)
})

test('should_preserve_geometry_valid_and_stale_routes_and_exact_undo_when_stacking_changes', () => {
  const document = nested()
  document.entities.push(entity('root-peer', 'boundary'))
  document.revision = 3
  document.connections[0] = { ...document.connections[0], points: [{ x: 252, y: 172 }, { x: 900, y: 108 }], labelPosition: { x: 600, y: 172 }, routeRevision: 3 }
  document.connections.push({ ...document.connections[0], id: 'stale', routeRevision: 2 })
  const before = structuredClone(document)
  const result = applyCommand(document, { type: 'order', ids: ['outer'], position: 'top' })
  assert.equal(result.revision, 4)
  assert.deepEqual(result.entities.map(({ order: _order, ...item }) => item), document.entities)
  assert.deepEqual(result.connections[0], { ...document.connections[0], routeRevision: 4 })
  assert.deepEqual(result.connections[1], document.connections[1])
  assert.deepEqual(buildScene(result).connections, buildScene({ ...document, connections: document.connections.map(connection => ({ ...connection, routeRevision: connection.id === 'stale' ? 2 : 3 })) }).connections.map(connection => ({ ...connection, routeRevision: connection.id === 'stale' ? 2 : 4 })))
  assert.deepEqual(historyUndo(historyCommit({ past: [], present: document, future: [] }, result)).present, before)
  assert.deepEqual(document, before)
})

test('should_honor_legacy_extremes_and_connection_stratum_after_numeric_order_and_paste', () => {
  const document = { ...createDocument('legacy'), entities: [entity('a'), entity('b'), entity('c')] }
  const bottom = applyCommand(document, { type: 'order', ids: ['b'], position: 'bottom' })
  const top = applyCommand(bottom, { type: 'order', ids: ['b'], layer: 'foreground' })
  assert.deepEqual(siblingScopes(top.entities).get(null)!.map(item => item.id), ['a', 'c', 'b'])
  const background = applyCommand(top, { type: 'order', ids: ['a'], layer: 'background' })
  assert.ok(effectiveOrder(background.entities[0]) < 2)
  assert.equal(background.entities[0].layer, 'background')
  assert.equal(applyCommand(background, { type: 'order', ids: ['a'], layer: 'background' }), background)
  const opened = parseDocument(JSON.stringify(background))
  assert.ok(opened.ok)
  assert.deepEqual(opened.value, background)
  const pasted = applyCommand(createDocument('paste'), { type: 'paste', fragment: captureSelection(opened.value, ['a', 'b', 'c']), idMap: { a: 'a-copy', b: 'b-copy', c: 'c-copy' }, offset: { x: 24, y: 24 } })
  assert.deepEqual(siblingScopes(pasted.entities).get(null)!.map(item => item.id), ['a-copy', 'c-copy', 'b-copy'])
})

test('should_reject_malformed_ordering_and_revision_overflow_atomically', () => {
  for (const command of [{ type: 'order', ids: ['missing'], position: 'top' }, { type: 'order', ids: ['child', 'child'], position: 'top' }, { type: 'order', ids: ['child'], position: 'sideways' }, { type: 'order', ids: ['child'] }]) rejects(nested(), command as DocumentCommand)
  const document = nested()
  document.entities.push(entity('root-peer', 'boundary'))
  document.revision = Number.MAX_SAFE_INTEGER
  rejects(document, { type: 'order', ids: ['outer'], position: 'top' }, 'invalid-command')
})