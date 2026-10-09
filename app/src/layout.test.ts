import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { computeLayout, applyLayoutIfCurrent } from './layout.ts'
import { absolutePosition, historyCommit, historyUndo, sampleDiagram } from './model.ts'
import type { ELK, ElkNode } from 'elkjs'
import { createDocument, entityTextGeometry, measureEntity } from './model.ts'
import { buildScene, renderSvg } from './scene.ts'
import { qualityFixtures } from './fixtures.ts'

test('should_use_elk_label_geometry_container_origin_and_request_stamps_when_engine_is_provided', async () => {
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
  }
})

test('should_use_official_worker_factory_and_release_owned_worker_when_browser_transport_succeeds_or_fails', async () => {
  let failed = false
  const workers: { url: string; terminate: ReturnType<typeof vi.fn> }[] = []
  vi.stubGlobal('Worker', class {
    terminate = vi.fn()
    url: string
    constructor(url: string) { this.url = url; workers.push(this) }
  })
  vi.doMock('elkjs/lib/elk-api.js', () => ({ default: class {
    worker: { terminate(): void }
    constructor(options: { workerFactory(): { terminate(): void } }) { this.worker = options.workerFactory() }
    async layout(root: ElkNode) { if (failed) throw new Error('worker failure'); return root }
    terminateWorker() { this.worker.terminate() }
  } }))
  try {
    await computeLayout(createDocument('worker', ''), 'RIGHT', 0)
    failed = true
    await assert.rejects(computeLayout(createDocument('worker', ''), 'DOWN', 0), /worker failure/)
    assert.equal(workers.length, 2)
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