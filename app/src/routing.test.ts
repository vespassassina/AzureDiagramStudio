import assert from 'node:assert/strict'
import { performance } from 'node:perf_hooks'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'vitest'
import { routeFixedGeometry } from './routing.ts'
import { absolutePosition, createDocument, entityTextGeometry } from './model.ts'
import type { Connection, Diagram, Entity } from './model.ts'

const component = (id: string, x: number, y: number, parentId?: string): Entity => ({ id, kind: 'component', label: id, x, y, width: 220, height: 88, color: 'azure', parentId })
const edge = (id: string, from: string, to: string, extra: Partial<Connection> = {}): Connection => ({ id, from, to, label: id, style: 'solid', arrow: 'forward', ...extra })
function fixture(): Diagram {
  return {
    ...createDocument('routing'), revision: 3,
    entities: [component('a', 0, 100), component('obstacle', 340, 90), component('b', 720, 140)],
    connections: [edge('a-b', 'a', 'b', { sourceSide: 'right', targetSide: 'left' })],
  }
}
function assertRoutes(document: Diagram) {
  for (const connection of document.connections) {
    assert.ok(Array.isArray(connection.points), `${connection.id}: final router must produce every route`)
    const points = connection.points!
    assert.ok(points.length >= 2 && connection.labelPosition && connection.routeRevision === document.revision)
    for (let i = 1; i < points.length; i++) {
      assert.notDeepEqual(points[i], points[i - 1], `${connection.id}: no duplicate`)
      assert.ok(points[i].x === points[i - 1].x || points[i].y === points[i - 1].y, `${connection.id}: orthogonal`)
      if (i > 1) assert.ok(points[i].x !== points[i - 2].x || points[i].y !== points[i - 2].y, `${connection.id}: no return loop`)
    }
    for (const [id, point, side] of [[connection.from, points[0], connection.sourceSide], [connection.to, points.at(-1)!, connection.targetSide]] as const) {
      const entity = document.entities.find(entity => entity.id === id)!, origin = absolutePosition(document, id)
      assert.ok(point.x >= origin.x && point.x <= origin.x + entity.width && point.y >= origin.y && point.y <= origin.y + entity.height)
      if (side === 'left') assert.equal(point.x, origin.x)
      if (side === 'right') assert.equal(point.x, origin.x + entity.width)
      if (side === 'top') assert.equal(point.y, origin.y)
      if (side === 'bottom') assert.equal(point.y, origin.y + entity.height)
    }
    for (const entity of document.entities.filter(entity => entity.kind === 'component' && entity.id !== connection.from && entity.id !== connection.to || entity.kind === 'boundary' && entity.id !== connection.from && entity.id !== connection.to)) {
      const p = absolutePosition(document, entity.id), bottom = p.y + (entity.kind === 'boundary' ? entityTextGeometry(entity).textBottom + 18 : entity.height)
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i]
        const hit = a.x === b.x ? a.x > p.x && a.x < p.x + entity.width && Math.max(a.y, b.y) > p.y && Math.min(a.y, b.y) < bottom
          : a.y > p.y && a.y < bottom && Math.max(a.x, b.x) > p.x && Math.min(a.x, b.x) < p.x + entity.width
        assert.equal(hit, false, `${connection.id}: clear ${entity.id}`)
      }
    }
  }
}
test('should_route_around_obstacles_without_mutating_any_fixed_geometry_or_semantics', () => {
  const original = fixture(), snapshot = structuredClone(original)
  const result = routeFixedGeometry(original)
  assertRoutes(result.diagram)
  assert.equal(result.diagram.entities, original.entities)
  assert.deepEqual(original, snapshot)
  assert.deepEqual(result.diagram.connections.map(({ points, labelPosition, routeRevision, ...semantic }) => semantic), original.connections)
  assert.deepEqual(routeFixedGeometry(original), result)
})
test('should_separate_parallel_labeled_channels_and_support_backwards_cycles_and_self_links', () => {
  const diagram = fixture()
  diagram.connections.push(edge('parallel', 'a', 'b', { sourceSide: 'right', targetSide: 'left', style: 'dashed', arrow: 'both' }), edge('back', 'b', 'a'), edge('self', 'a', 'a', { sourceSide: 'top', targetSide: 'left' }))
  const result = routeFixedGeometry(diagram).diagram
  assertRoutes(result)
  assert.notDeepEqual(result.connections[0].points, result.connections[1].points)
  const labels = result.connections.map(connection => connection.labelPosition)
  assert.equal(new Set(labels.map(position => JSON.stringify(position))).size, labels.length)
  const horizontal = (connection: Connection) => connection.points!.slice(1).flatMap((point, index) => {
    const before = connection.points![index]
    return point.y === before.y && Math.abs(point.x - before.x) >= 100 ? [{ y: point.y, left: Math.min(point.x, before.x), right: Math.max(point.x, before.x) }] : []
  })
  assert.ok(horizontal(result.connections[0]).some(a => horizontal(result.connections[1]).some(b => Math.min(a.right, b.right) - Math.max(a.left, b.left) >= 100 && Math.abs(a.y - b.y) >= 20)), 'parallel middle channels have at least 20px separation, not merely different endpoint coordinates')
})
test('should_preserve_nested_boundary_endpoints_and_avoid_every_reserved_header', () => {
  const diagram = {
    ...createDocument('nested'),
    entities: [
      { ...component('outer', 0, 0), kind: 'boundary' as const, width: 900, height: 700 },
      { ...component('inner', 40, 100, 'outer'), kind: 'boundary' as const, width: 400, height: 450 },
      component('inside', 30, 120, 'inner'), component('peer', 560, 300, 'outer'), component('outside', 1100, 300),
    ],
    connections: [edge('nested', 'inside', 'outside', { sourceSide: 'top', targetSide: 'left' }), edge('sibling', 'peer', 'inside'), ...(['top', 'right', 'bottom', 'left'] as const).map(side => edge(`boundary-${side}`, 'inner', 'inside', { sourceSide: side, targetSide: 'right' }))],
  }
  assertRoutes(routeFixedGeometry(diagram).diagram)
})
test('should_reject_the_whole_layout_when_an_explicit_port_is_trapped_in_an_obstacle', () => {
  const diagram = fixture()
  diagram.entities[1] = { ...diagram.entities[1], x: 220, y: 80, height: 130 }
  const snapshot = structuredClone(diagram)
  assert.throws(() => routeFixedGeometry(diagram), /a-b.*(port|route|corridor)/i)
  assert.deepEqual(diagram, snapshot)
})
test('should_route_the_actual_100_entity_150_connection_domain_max_with_bounded_work', async () => {
  const diagram = createDocument('domain-max')
  diagram.entities = Array.from({ length: 100 }, (_, i) => component(`n${i}`, i % 10 * 500, Math.floor(i / 10) * 300))
  diagram.connections = Array.from({ length: 150 }, (_, i) => {
    const from = i % 100, to = i < 90 ? from + 10 : from % 10 === 9 ? from - 1 : from + 1
    return edge(`e${i}`, `n${from}`, `n${to}`, { label: `Flow ${i}` })
  })
  const started = performance.now()
  const result = routeFixedGeometry(diagram)
  const elapsed = performance.now() - started
  assertRoutes(result.diagram)
  assert.ok(result.work.expandedStates <= 4_000_000)
  assert.ok(result.work.gridCells <= 50_000_000)
  assert.ok(elapsed < 6000, `Routing leaves room inside the existing 15s worker deadline: ${elapsed}ms`)
  if (process.env.DGM142_OUTPUT) {
    const output = resolve(process.env.DGM142_OUTPUT)
    await mkdir(output, { recursive: true })
    await writeFile(resolve(output, 'domain-max.json'), JSON.stringify({ fixture: diagram, output: result.diagram, entities: 100, connections: 150, elapsed, work: result.work }, null, 2))
  }
}, 15000)

test('should_fail_explicitly_when_an_input_exceeds_the_existing_document_work_limits', () => {
  const diagram = fixture()
  diagram.connections = Array.from({ length: 151 }, (_, index) => edge(`e${index}`, 'a', 'b'))
  assert.throws(() => routeFixedGeometry(diagram), /work limit/)
})

test('should_keep_fifty_empty_label_parallel_middle_channels_distinct_at_the_unchanged_stroke', () => {
  const diagram = createDocument('parallel-independent')
  diagram.entities = [component('a', 24, 24), component('b', 344, 24)]
  diagram.connections = Array.from({ length: 50 }, (_, i) => edge(`parallel-${i}`, 'a', 'b', { label: '', sourceSide: 'right', targetSide: 'left' }))
  const original = structuredClone(diagram)
  const result = routeFixedGeometry(diagram).diagram
  assertRoutes(result)
  assert.deepEqual(result.entities, original.entities)
  assert.deepEqual(result.connections.map(({ points, labelPosition, routeRevision, ...semantic }) => semantic), original.connections)
  const spans = (connection: Connection) => connection.points!.slice(1).flatMap((b, i) => {
    const a = connection.points![i]
    return a.y === b.y ? [{ y: a.y, left: Math.max(268, Math.min(a.x, b.x)), right: Math.min(320, Math.max(a.x, b.x)) }] : []
  })
  for (let i = 0; i < result.connections.length; i++) for (let j = 0; j < i; j++) {
    for (const a of spans(result.connections[i])) for (const b of spans(result.connections[j])) {
      if (Math.min(a.right, b.right) - Math.max(a.left, b.left) >= 32) assert.ok(Math.abs(a.y - b.y) >= 2.1, `${i}/${j}: middle spans overlap the 2.1px ink: pitch ${Math.abs(a.y - b.y)}`)
    }
  }
  const crossings = result.connections.flatMap(connection => connection.points!.slice(1).flatMap((b, i) => {
    const a = connection.points![i]
    return a.y === b.y && Math.min(a.x, b.x) < 294 && Math.max(a.x, b.x) > 294 ? [a.y] : []
  })).sort((a, b) => a - b)
  assert.equal(crossings.length, 50, 'all fifty connections cross the actual middle cut')
  for (let i = 1; i < crossings.length; i++) assert.ok(crossings[i] - crossings[i - 1] >= 2.1 - 1e-9, 'short staircases must not evade middle-channel clearance')
  assert.deepEqual(routeFixedGeometry(diagram).diagram, result)
})
