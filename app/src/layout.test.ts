import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { computeLayout, applyLayoutIfCurrent } from './layout.ts'
import { absolutePosition, historyCommit, historyUndo, sampleDiagram } from './model.ts'
import type { ELK, ElkNode } from 'elkjs'
import { createDocument, entityTextGeometry, measureEntity } from './model.ts'
import { buildScene, renderSvg } from './scene.ts'
import { qualityFixtures } from './fixtures.ts'
import * as routing from './routing.ts'
import type { Diagram } from './model.ts'

function isolatedBoundary(longHeader = false): Diagram {
  return {
    ...createDocument('isolated-boundary', ''),
    entities: [
      { id: 'parent', kind: 'boundary', label: longHeader ? 'W'.repeat(120) : 'Azure subscription', subtitle: longHeader ? 'W'.repeat(200) : 'Production boundary', x: 0, y: 0, width: 180, height: 80, color: 'azure' },
      { id: 'child', kind: 'component', label: 'Service', parentId: 'parent', x: 24, y: 80, width: 220, height: 88, color: 'teal' },
    ],
  }
}

function arrangementFixtures(): Diagram[] {
  const commerce = sampleDiagram()
  const longCommerce = sampleDiagram()
  longCommerce.entities = longCommerce.entities.map(entity => entity.kind === 'boundary' ? { ...entity, label: 'W'.repeat(120), subtitle: 'W'.repeat(200) } : entity)
  return [commerce, longCommerce, isolatedBoundary(), isolatedBoundary(true)]
}

function withBoundarySize(diagram: Diagram, width: number, height: number): Diagram {
  return { ...diagram, entities: diagram.entities.map(entity => entity.kind === 'boundary' ? { ...entity, width, height } : entity) }
}

function assertStableGeometry(actual: Diagram, expected: Diagram) {
  assert.deepEqual(actual.entities.map(entity => entity.id), expected.entities.map(entity => entity.id))
  for (const entity of actual.entities) {
    const previous = expected.entities.find(candidate => candidate.id === entity.id)!
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      assert.ok(Math.abs(entity[key] - previous[key]) <= 1, `${actual.id} ${entity.id} ${key}: ${entity[key]} vs ${previous[key]}`)
    }
  }
  for (const connection of actual.connections) {
    const previous = expected.connections.find(candidate => candidate.id === connection.id)!
    assert.equal(connection.points!.length, previous.points!.length)
    for (const [index, point] of connection.points!.entries()) for (const key of ['x', 'y'] as const) {
      assert.ok(Math.abs(point[key] - previous.points![index][key]) <= 1, `${connection.id} route ${index} ${key} changed`)
    }
    assert.equal(Boolean(connection.labelPosition), Boolean(previous.labelPosition))
    if (connection.labelPosition) for (const key of ['x', 'y'] as const) {
      assert.ok(Math.abs(connection.labelPosition[key] - previous.labelPosition![key]) <= 1, `${connection.id} label ${key} changed`)
    }
  }
}

for (const longHeader of [false, true]) {
  test(`should_leave_18_to_32_units_after_rendered_header_when_isolated_${longHeader ? 'long' : 'short'}_boundary_is_arranged`, async () => {
    for (const direction of ['RIGHT', 'DOWN'] as const) for (const oldSize of [180, 3000]) {
      const original = withBoundarySize(isolatedBoundary(longHeader), oldSize, oldSize)
      const result = await computeLayout(original, direction, 1)
      const parent = result.diagram.entities.find(entity => entity.id === 'parent')!
      const child = result.diagram.entities.find(entity => entity.id === 'child')!
      const gap = child.y - entityTextGeometry(parent).textBottom
      assert.ok(gap >= 18 && gap <= 32, `${direction} old size ${oldSize}: header gap ${gap}`)
      assert.ok(child.x >= 0 && child.x + child.width <= parent.width)
      assert.ok(child.y + child.height <= parent.height)
      assert.equal(child.width, 220)
      assert.equal(child.height, 88)
    }
  })
}

test('should_ignore_obsolete_boundary_dimensions_when_compact_and_3000px_copies_are_arranged', async () => {
  for (const original of arrangementFixtures()) for (const direction of ['RIGHT', 'DOWN'] as const) {
    const compact = await computeLayout(withBoundarySize(original, 180, 80), direction, 1)
    const oversized = await computeLayout(withBoundarySize(original, 3000, 3000), direction, 1)
    assertStableGeometry(oversized.diagram, compact.diagram)
  }
})

for (const direction of ['RIGHT', 'DOWN'] as const) {
  test(`should_remain_stable_within_one_unit_when_${direction.toLowerCase()}_arrangement_is_repeated_ten_times`, async () => {
    for (const original of arrangementFixtures()) {
      const baseline = (await computeLayout(original, direction, 1)).diagram
      let current = baseline
      for (let repetition = 0; repetition < 10; repetition++) {
        current = (await computeLayout(current, direction, repetition + 2)).diagram
        assertStableGeometry(current, baseline)
      }
    }
  }, 30000)
}

test('should_restore_right_geometry_within_one_unit_when_direction_switches_right_down_right', async () => {
  for (const original of arrangementFixtures()) {
    const right = (await computeLayout(original, 'RIGHT', 1)).diagram
    const down = (await computeLayout(right, 'DOWN', 2)).diagram
    const restored = (await computeLayout(down, 'RIGHT', 3)).diagram
    assertStableGeometry(restored, right)
  }
})

test('should_shrink_unnecessary_bounds_when_the_only_child_is_removed', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const arranged = (await computeLayout(isolatedBoundary(), direction, 1)).diagram
    const empty = { ...arranged, entities: arranged.entities.filter(entity => entity.id !== 'child') }
    const result = (await computeLayout(empty, direction, 2)).diagram
    const previous = arranged.entities[0]
    const parent = result.entities[0]
    assert.ok(parent.width < previous.width, `${direction} empty boundary did not shrink in width`)
    assert.ok(parent.height < previous.height, `${direction} empty boundary did not shrink in height`)
    assert.ok(entityTextGeometry(parent).textBottom < parent.height)
    assertStableGeometry((await computeLayout(withBoundarySize(empty, 3000, 3000), direction, 3)).diagram, result)
  }
})

test('should_preserve_manual_component_sizes_and_semantics_when_boundaries_are_resized', async () => {
  const original = sampleDiagram()
  original.entities = original.entities.map((entity, index) => ({ ...entity, order: index, ...(entity.kind === 'component' ? { width: 420, height: 176 } : {}) }))
  const snapshot = structuredClone(original)
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const result = (await computeLayout(original, direction, 8)).diagram
    for (const entity of result.entities) {
      const previous = original.entities.find(candidate => candidate.id === entity.id)!
      const { x: _x, y: _y, width: _width, height: _height, ...content } = entity
      const { x: _oldX, y: _oldY, width: _oldWidth, height: _oldHeight, ...previousContent } = previous
      assert.deepEqual(content, previousContent)
      if (entity.kind === 'component') {
        assert.equal(entity.width, previous.width)
        assert.equal(entity.height, previous.height)
      }
    }
    assert.deepEqual(result.connections.map(({ points: _points, labelPosition: _label, routeRevision: _revision, ...connection }) => connection), original.connections)
  }
  assert.deepEqual(original, snapshot)
})

test('should_preserve_absolute_annotation_geometry_and_content_when_intrinsic_boundaries_replace_oversized_parents', async () => {
  const original = withBoundarySize(sampleDiagram(), 3000, 3000)
  original.entities = original.entities.map(entity => entity.id === 'note' ? { ...entity, parentId: 'application', x: -40, y: -20, order: 9 } : entity)
  original.entities.push({ id: 'rectangle', kind: 'rectangle', label: 'Annotation', subtitle: 'Absolute canvas', parentId: 'data', x: 170, y: 390, width: 240, height: 110, color: 'gray', layer: 'background', order: 10 })
  const snapshot = structuredClone(original)
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const result = (await computeLayout(original, direction, 5)).diagram
    for (const annotation of original.entities.filter(entity => entity.kind === 'text' || entity.kind === 'rectangle')) {
      const computed = result.entities.find(entity => entity.id === annotation.id)!
      assert.deepEqual(absolutePosition(result, annotation.id), absolutePosition(original, annotation.id))
      assert.deepEqual({ ...computed, x: annotation.x, y: annotation.y }, annotation)
    }
  }
  assert.deepEqual(original, snapshot)
})

test('should_reuse_injected_engine_with_fresh_graphs_when_returned_width_changes_header_wrapping', async () => {
  const original = isolatedBoundary(true)
  const snapshot = structuredClone(original)
  const inputs: ElkNode[] = []
  const terminateWorker = vi.fn()
  const layout = vi.fn(async (root: ElkNode) => {
    inputs.push(root)
    const parent = root.children![0]
    assert.equal(parent.width, 368)
    const child = parent.children![0]
    assert.equal(child.width, 220)
    assert.equal(child.height, 88)
    const padding = Number(parent.layoutOptions!['elk.padding']!.match(/top=(\d+)/)![1])
    parent.width = 268
    parent.height = padding + child.height! + 24
    child.x = 24
    child.y = padding
    return root
  })
  const result = await computeLayout(original, 'DOWN', 12, { layout, terminateWorker } as unknown as ELK)
  assert.equal(layout.mock.calls.length, 2)
  assert.notEqual(inputs[0], inputs[1])
  assert.notEqual(inputs[0].children![0], inputs[1].children![0])
  assert.equal(terminateWorker.mock.calls.length, 0)
  const parent = result.diagram.entities[0]
  assert.equal(result.diagram.entities[1].y - entityTextGeometry(parent).textBottom, 18)
  assert.equal(result.revision, 12)
  assert.deepEqual(original, snapshot)
})

test('should_stop_after_three_engine_passes_when_header_width_oscillates', async () => {
  const original = isolatedBoundary(true)
  const snapshot = structuredClone(original)
  let calls = 0
  const terminateWorker = vi.fn()
  const engine = { layout: async (root: ElkNode) => {
    calls++
    root.children![0].width = calls % 2 ? 268 : 368
    return root
  }, terminateWorker } as unknown as ELK
  await assert.rejects(computeLayout(original, 'DOWN', 1, engine), /did not converge within three passes/)
  assert.equal(calls, 3)
  assert.equal(terminateWorker.mock.calls.length, 0)
  assert.deepEqual(original, snapshot)
})

test('should_use_elk_label_geometry_container_origin_and_request_stamps_when_engine_is_provided', async () => {
  // This deliberately diagonal mock tests the original placement adapter, not
  // valid final routing. Keep its exact translation assertions isolated.
  vi.spyOn(routing, 'routeFixedGeometry').mockImplementationOnce(diagram => ({ diagram, work: { gridCells: 0, expandedStates: 0, maxCells: 0 } }))
  const original = sampleDiagram()
  const snapshot = structuredClone(original)
  const engine = { layout: async (root: ElkNode) => {
    const platform = root.children!.find(node => node.id === 'platform')!
    platform.x = 100; platform.y = 200
    const application = platform.children!.find(node => node.id === 'application')!
    application.x = 30; application.y = 40
    root.edges = [{ id: 'route', sources: ['gateway'], targets: ['app'], container: 'application', sections: [{ id: 'section', startPoint: { x: 5, y: 6 }, endPoint: { x: 45, y: 46 } }], labels: [{ text: 'Route', x: 12, y: 15, width: 40, height: 24 }] }]
    return root
  } } as unknown as ELK
  const result = await computeLayout(original, 'DOWN', 9, engine)
  const route = result.diagram.connections.find(connection => connection.id === 'route')!
  assert.deepEqual(route.points, [{ x: 135, y: 246 }, { x: 175, y: 286 }])
  assert.deepEqual(route.labelPosition, { x: 162, y: 267 })
  assert.equal(result.diagram.revision, 9)
  assert.equal(route.routeRevision, 9)
  assert.deepEqual(original, snapshot)
})

test('should_reserve_complete_boundary_header_and_component_text_when_building_elk_graph', async () => {
  // The graph-inspection mock returns unplaced overlapping nodes.
  vi.spyOn(routing, 'routeFixedGeometry').mockImplementationOnce(diagram => ({ diagram, work: { gridCells: 0, expandedStates: 0, maxCells: 0 } }))
  const original = sampleDiagram()
  original.entities = original.entities.map(entity => entity.kind === 'text' ? entity : { ...entity, label: 'W'.repeat(120), subtitle: 'W'.repeat(200) })
  let graph: ElkNode | undefined
  const engine = { layout: async (root: ElkNode) => { graph = root; return root } } as unknown as ELK
  await computeLayout(original, 'RIGHT', 0, engine)
  const platform = graph!.children!.find(node => node.id === 'platform')!
  const application = platform.children!.find(node => node.id === 'application')!
  const gateway = application.children!.find(node => node.id === 'gateway')!
  const entity = original.entities.find(entity => entity.id === 'gateway')!
  assert.equal(gateway.height, measureEntity(entity).height)
  assert.ok(Number(application.layoutOptions!['elk.padding']!.match(/top=(\d+)/)![1]) > 120)
})

test('should_honor_explicit_endpoint_sides_when_compounds_are_arranged_in_both_directions', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) for (const sourceSide of ['top', 'right', 'bottom', 'left'] as const) for (const targetSide of ['top', 'right', 'bottom', 'left'] as const) {
    const original = sampleDiagram()
    original.connections = original.connections.map(connection => ({ ...connection, sourceSide, targetSide }))
    const result = await computeLayout(original, direction, 7)
    for (const connection of result.diagram.connections) for (const endpoint of [{ id: connection.from, side: sourceSide, point: connection.points![0] }, { id: connection.to, side: targetSide, point: connection.points!.at(-1)! }]) {
      const entity = result.diagram.entities.find(entity => entity.id === endpoint.id)!
      const origin = absolutePosition(result.diagram, entity.id)
      const side = endpoint.side
      const actual = side === 'left' || side === 'right' ? endpoint.point.x : endpoint.point.y
      const expected = side === 'left' ? origin.x : side === 'right' ? origin.x + entity.width : side === 'top' ? origin.y : origin.y + entity.height
      assert.ok(Math.abs(actual - expected) < 1, `${direction} ${side} ${connection.id} ${endpoint.id} is on wrong side`)
      assert.ok(endpoint.point.x >= origin.x - 1 && endpoint.point.x <= origin.x + entity.width + 1 && endpoint.point.y >= origin.y - 1 && endpoint.point.y <= origin.y + entity.height + 1)
    }
  }
})

test('should_keep_nested_annotations_absolute_when_parent_boundaries_are_arranged', async () => {
  const original = sampleDiagram()
  original.entities = original.entities.map(entity => entity.id === 'note' ? { ...entity, parentId: 'application', x: -40, y: -20 } : entity)
  const before = absolutePosition(original, 'note')
  const result = await computeLayout(original, 'DOWN', 0)
  assert.deepEqual(absolutePosition(result.diagram, 'note'), before)
  assert.equal(result.diagram.entities.find(entity => entity.id === 'note')!.parentId, 'application')
})

test('should_reserve_measured_headers_and_contain_children_when_long_compounds_are_arranged', async () => {
  const original = sampleDiagram()
  original.entities = original.entities.map(entity => entity.kind === 'boundary' ? { ...entity, label: 'W'.repeat(120), subtitle: 'W'.repeat(200) } : entity)
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const result = await computeLayout(original, direction, 2)
    for (const entity of result.diagram.entities.filter(entity => entity.parentId)) {
      const parent = result.diagram.entities.find(candidate => candidate.id === entity.parentId)!
      assert.ok(entity.y > entityTextGeometry(parent).textBottom)
      assert.ok(entity.x + entity.width <= parent.width && entity.y + entity.height <= parent.height)
    }
    for (const connection of result.diagram.connections) for (const endpoint of [{ id: connection.from, point: connection.points![0] }, { id: connection.to, point: connection.points!.at(-1)! }]) {
      const entity = result.diagram.entities.find(candidate => candidate.id === endpoint.id)!
      const origin = absolutePosition(result.diagram, endpoint.id)
      assert.ok(endpoint.point.x >= origin.x - 1 && endpoint.point.x <= origin.x + entity.width + 1 && endpoint.point.y >= origin.y - 1 && endpoint.point.y <= origin.y + entity.height + 1)
      assert.ok(Math.abs(endpoint.point.x - origin.x) < 1 || Math.abs(endpoint.point.x - origin.x - entity.width) < 1 || Math.abs(endpoint.point.y - origin.y) < 1 || Math.abs(endpoint.point.y - origin.y - entity.height) < 1, `${direction} long header ${connection.id} detached`)
    }
  }
})

test('should_use_official_worker_factory_and_release_owned_worker_when_browser_transport_succeeds_or_fails', async () => {
  let failed = false
  let failOnCall = 1
  let layoutCalls = 0
  const workers: { url: string; terminate: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('Worker', class {
    terminate = vi.fn()
    url: string
    constructor(url: string) { this.url = url; workers.push(this) }
  })
  vi.doMock('elkjs/lib/elk-api.js', () => ({ default: class {
    worker: { terminate(): void }
    constructor(options: { workerFactory(): { terminate(): void } }) { this.worker = options.workerFactory(); layoutCalls = 0 }
    async layout(root: ElkNode) {
      layoutCalls++
      if (failed && layoutCalls === failOnCall) throw new Error('worker failure')
      if (root.children?.length) root.children[0].width = 268
      return root
    }
    terminateWorker() { this.worker.terminate() }
  } }))
  try {
    await computeLayout(createDocument('worker', ''), 'RIGHT', 0)
    failed = true
    await assert.rejects(computeLayout(createDocument('worker', ''), 'DOWN', 0), /worker failure/)
    failed = false
    await computeLayout(isolatedBoundary(true), 'DOWN', 0)
    assert.equal(layoutCalls, 2)
    failed = true
    failOnCall = 2
    await assert.rejects(computeLayout(isolatedBoundary(true), 'DOWN', 0), /worker failure/)
    assert.equal(layoutCalls, 2)
    assert.equal(workers.length, 4)
    for (const worker of workers) { assert.ok(worker.url.includes('elk-worker.min.js')); assert.equal(worker.terminate.mock.calls.length, 1) }
    const terminateWorker = vi.fn()
    await computeLayout(createDocument('provided', ''), 'RIGHT', 0, { layout: async (root: ElkNode) => root, terminateWorker } as unknown as ELK)
    assert.equal(terminateWorker.mock.calls.length, 0)
  } finally { vi.unstubAllGlobals(); vi.doUnmock('elkjs/lib/elk-api.js') }
})

test('should_keep_all_quality_fixture_geometry_and_report_node_costs_when_explicit_layout_is_requested', async () => {
  for (const document of qualityFixtures()) for (const direction of ['RIGHT', 'DOWN'] as const) {
    const original = structuredClone(document)
    const result = await computeLayout(document, direction, 1)
    const scene = buildScene(result.diagram)
    assert.equal(scene.entities.length, document.entities.length)
    assert.equal(scene.connections.length, document.connections.length)
    assert.deepEqual(document, original)
    assert.ok(Number.isFinite(scene.width) && Number.isFinite(scene.height))
    for (const connection of scene.connections) for (const endpoint of [{ id: connection.from, point: connection.start }, { id: connection.to, point: connection.end }]) {
      const entity = scene.entities.find(candidate => candidate.id === endpoint.id)!
      const origin = entity.absolute
      assert.ok(endpoint.point.x >= origin.x - 1 && endpoint.point.x <= origin.x + entity.width + 1 && endpoint.point.y >= origin.y - 1 && endpoint.point.y <= origin.y + entity.height + 1)
      assert.ok(Math.abs(endpoint.point.x - origin.x) < 1 || Math.abs(endpoint.point.x - origin.x - entity.width) < 1 || Math.abs(endpoint.point.y - origin.y) < 1 || Math.abs(endpoint.point.y - origin.y - entity.height) < 1, `${document.id} ${direction} ${connection.id} detached`)
    }
  }
  const fixture = qualityFixtures().find(document => document.id === 'stress-v1')!
  const sceneTimes: number[] = [], layoutTimes: number[] = []
  let bytes = 0
  for (let index = 0; index < 20; index++) {
    const started = performance.now()
    const scene = buildScene(fixture)
    bytes = renderSvg(scene).length
    sceneTimes.push(performance.now() - started)
    assert.equal(scene.entities.length, 100)
    assert.equal(scene.connections.length, 150)
  }
  for (let index = 0; index < 10; index++) {
    const started = performance.now()
    const result = await computeLayout(fixture, index % 2 ? 'DOWN' : 'RIGHT', index)
    layoutTimes.push(performance.now() - started)
    assert.equal(result.diagram.entities.length, 100)
    assert.ok(result.diagram.connections.every(connection => connection.points!.length >= 2 && connection.routeRevision === index))
  }
  console.info(`DGM-030 Node-only stress: scene/render p95=${sceneTimes.sort((left, right) => left - right)[18].toFixed(1)}ms; layout max=${Math.max(...layoutTimes).toFixed(1)}ms; SVG=${bytes} characters. Not browser paint/worker evidence.`)
}, 30000)

test('should_return_empty_geometry_and_propagate_engine_failure_without_mutation', async () => {
  const original = createDocument('empty', '')
  const result = await computeLayout(original, 'DOWN', 3)
  assert.deepEqual(result.diagram.entities, [])
  assert.deepEqual(result.diagram.connections, [])
  await assert.rejects(computeLayout(original, 'RIGHT', 0, { layout: async () => { throw new Error('worker failed') } } as unknown as ELK), /worker failed/)
  assert.equal(original.revision, 0)
})

test('should_layout_nested_boundaries_and_group_endpoints_when_arrange_is_requested', async () => {
  const original = sampleDiagram()
  const result = await computeLayout(original, 'RIGHT', 4)
  assert.equal(result.revision, 4)
  assert.deepEqual(result.diagram.entities.map(entity => entity.id), original.entities.map(entity => entity.id))
  for (const entity of result.diagram.entities) {
    const position = absolutePosition(result.diagram, entity.id)
    assert.ok(Number.isFinite(position.x) && Number.isFinite(position.y))
    if (entity.parentId) {
      const parent = result.diagram.entities.find(candidate => candidate.id === entity.parentId)!
      assert.ok(entity.x >= 0 && entity.y >= 0)
      assert.ok(entity.x + entity.width <= parent.width + 1)
      assert.ok(entity.y + entity.height <= parent.height + 1)
    }
  }
  assert.ok(result.diagram.connections.every(connection => (connection.points?.length ?? 0) >= 2))
  const access = result.diagram.connections.find(connection => connection.to === 'platform')!
  const platform = result.diagram.entities.find(entity => entity.id === 'platform')!
  const position = absolutePosition(result.diagram, platform.id)
  const endpoint = access.points!.at(-1)!
  assert.ok(Math.abs(endpoint.x - position.x) < 1 || Math.abs(endpoint.x - position.x - platform.width) < 1 || Math.abs(endpoint.y - position.y) < 1 || Math.abs(endpoint.y - position.y - platform.height) < 1)
})

test('should_restore_geometry_when_layout_is_undone', async () => {
  const original = sampleDiagram()
  const result = await computeLayout(original, 'DOWN', 0)
  const history = historyCommit({ past: [], present: original, future: [] }, result.diagram)
  assert.deepEqual(historyUndo(history).present, original)
})

test('should_attach_every_endpoint_when_nested_layout_routes_are_translated', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const result = await computeLayout(sampleDiagram(), direction, 0)
    for (const connection of result.diagram.connections) {
      const endpoints = [{ id: connection.from, point: connection.points![0] }, { id: connection.to, point: connection.points!.at(-1)! }]
      for (const endpoint of endpoints) {
        const entity = result.diagram.entities.find(candidate => candidate.id === endpoint.id)!
        const origin = absolutePosition(result.diagram, entity.id)
        const within = endpoint.point.x >= origin.x - 1 && endpoint.point.x <= origin.x + entity.width + 1 && endpoint.point.y >= origin.y - 1 && endpoint.point.y <= origin.y + entity.height + 1
        const onBorder = Math.abs(endpoint.point.x - origin.x) < 1 || Math.abs(endpoint.point.x - origin.x - entity.width) < 1 || Math.abs(endpoint.point.y - origin.y) < 1 || Math.abs(endpoint.point.y - origin.y - entity.height) < 1
        assert.ok(within && onBorder, `${direction} ${connection.id}: ${endpoint.id} is detached`)
      }
    }
  }
})

test('should_preserve_annotations_when_components_are_arranged', async () => {
  const original = sampleDiagram()
  const result = await computeLayout(original, 'RIGHT', 0)
  assert.deepEqual(result.diagram.entities.find(entity => entity.id === 'note'), original.entities.find(entity => entity.id === 'note'))
})

test('should_discard_layout_when_the_revision_is_stale', async () => {
  const original = sampleDiagram()
  const result = await computeLayout(original, 'DOWN', 2)
  assert.equal(applyLayoutIfCurrent(original, result, 3), original)
  assert.equal(applyLayoutIfCurrent(original, result, 2), result.diagram)
})