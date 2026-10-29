import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { test } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'
import type { ELK as Engine } from 'elkjs'
import { computeLayout } from './layout.ts'
import { computeStackedLayout } from './layout-stacked.ts'
import { routeFixedGeometry } from './routing.ts'
import { absolutePosition, createDocument, entityTextGeometry } from './model.ts'
import { buildScene, renderSvg } from './scene.ts'
import type { Diagram } from './model.ts'

const starter = JSON.parse(await readFile(new URL('../../examples/fabric-onelake.json', import.meta.url), 'utf8')) as Diagram

for (const direction of ['RIGHT', 'DOWN'] as const) {
  test(`should_leave_new_compact_ELK_geometry_fixed_when_canonical_routing_${direction}_DGM143`, async () => {
    const input = structuredClone(starter)
    const before = structuredClone(input)
    const placed = (await computeStackedLayout(input, direction, 3, new ELK())).diagram
    const geometry = structuredClone(placed.entities)
    const routed = routeFixedGeometry(placed).diagram
    assert.equal(routed.entities, placed.entities)
    assert.deepEqual(routed.entities, geometry)
    assert.deepEqual(input, before)
    assert.equal(routed.connections.length, input.connections.length)
    assert.ok(placed.connections.every(edge => edge.points === undefined && edge.labelPosition === undefined),
      'placement does not retain obsolete provisional routing')
  })

  test(`should_fit_actual_fabric_group_content_and_equal_root_gaps_when_${direction}_stacked_DGM143`, async () => {
    const diagram = (await computeLayout(starter, direction, 2, new ELK(), { arrangement: 'stacked' })).diagram
    const margins = diagram.entities.filter(entity => entity.kind === 'boundary').map(parent => {
      const children = diagram.entities.filter(entity => entity.parentId === parent.id && ['component', 'boundary'].includes(entity.kind))
      return {
        id: parent.id,
        top: Math.min(...children.map(child => child.y)) - entityTextGeometry(parent).textBottom,
        bottom: parent.height - Math.max(...children.map(child => child.y + child.height)),
        left: Math.min(...children.map(child => child.x)),
        right: parent.width - Math.max(...children.map(child => child.x + child.width)),
      }
    })
    const roots = diagram.entities.filter(entity => !entity.parentId && ['component', 'boundary'].includes(entity.kind))
    const axis = direction === 'DOWN' ? 'x' : 'y'
    const size = direction === 'DOWN' ? 'width' : 'height'
    const cross = direction === 'DOWN' ? 'y' : 'x'
    const gaps = roots.slice(1).map((entity, index) => entity[axis] - roots[index][axis] - roots[index][size])
    if (process.env.DGM143_OUTPUT) {
      await mkdir(resolve(process.env.DGM143_OUTPUT), { recursive: true })
      await writeFile(resolve(process.env.DGM143_OUTPUT, `compact-${direction}.json`), JSON.stringify({ starter, diagram, margins, gaps }, null, 2))
    }
    for (const margin of margins) {
      assert.ok(margin.top >= 18 && margin.top <= 48, `${margin.id}: measured header-to-child margin ${margin.top} must be 18..48px`)
      assert.ok(margin.bottom >= 24 && margin.bottom <= 48, `${margin.id}: child-to-bottom margin ${margin.bottom} must be 24..48px`)
      assert.ok(margin.left >= 24 && margin.left <= 48 && margin.right >= 24 && margin.right <= 48,
        `${margin.id}: horizontal content margins must be 24..48px: ${margin.left}, ${margin.right}`)
    }
    assert.ok(roots.every(entity => entity[cross] === roots[0][cross]), 'exact root transverse alignment')
    assert.ok(gaps.every(gap => gap === gaps[0] && gap > 0 && gap <= 160), `positive equal root gaps <=160px: ${gaps}`)
  })
}

for (const direction of ['RIGHT', 'DOWN'] as const) {
  test(`should_route_all_fifty_explicit_parallel_links_after_real_${direction}_placement`, async () => {
    const diagram: Diagram = {
      ...createDocument('parallel-independent'),
      entities: ['a', 'b'].map((id, i) => ({ id, kind: 'component', label: id, color: 'azure', x: i * 650, y: 100, width: 220, height: 88 })),
      connections: Array.from({ length: 50 }, (_, i) => ({ id: `parallel-${i}`, from: 'a', to: 'b', label: '', style: 'solid', arrow: 'forward', sourceSide: 'right', targetSide: 'left' })),
    }
    const result = await computeLayout(diagram, direction, 1, new ELK())
    assert.equal(result.diagram.connections.length, 50)
    if (process.env.DGM142_OUTPUT) await writeFile(resolve(process.env.DGM142_OUTPUT, `parallel-${direction}.json`), JSON.stringify(result.diagram, null, 2))
    const spans = (edge: Diagram['connections'][number]) => edge.points!.slice(1).flatMap((b, i) => {
      const a = edge.points![i], horizontal = a.y === b.y
      const low = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y), high = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
      return high - low > 64 ? [{ horizontal, axis: horizontal ? a.y : a.x, low: low + 16, high: high - 16 }] : []
    })
    for (let i = 0; i < 50; i++) for (let j = 0; j < i; j++) for (const a of spans(result.diagram.connections[i])) for (const b of spans(result.diagram.connections[j])) {
      if (a.horizontal === b.horizontal && Math.min(a.high, b.high) - Math.max(a.low, b.low) >= 32) assert.ok(Math.abs(a.axis - b.axis) >= 2.1 - 1e-9, `${i}/${j}: sustained stroke overlap ${JSON.stringify({ a, b })}`)
    }
    if (process.env.DGM142_OUTPUT) await writeFile(resolve(process.env.DGM142_OUTPUT, `parallel-${direction}.json`), JSON.stringify(result.diagram, null, 2))
  })
}

for (const direction of ['RIGHT', 'DOWN'] as const) for (const arrangement of ['standard', 'stacked'] as const) {
  test(`should_use_local_channels_for_the_actual_fabric_starter_when_${direction}_${arrangement}`, async () => {
    const engine = new ELK()
    const traces: unknown[] = []
    const observed = { layout: async (input: Parameters<typeof engine.layout>[0]) => {
      const before = structuredClone(input)
      const output = await engine.layout(input)
      traces.push({ input: before, output: structuredClone(output) })
      return output
    } } as unknown as Engine
    const { diagram } = await computeLayout(starter, direction, 2, observed, { arrangement })
    const intersects = (a: { x: number; y: number }, b: { x: number; y: number }, box: { left: number; right: number; top: number; bottom: number }) =>
      Math.abs(a.x - b.x) < 1e-9
        ? a.x > box.left + 1e-9 && a.x < box.right - 1e-9 && Math.max(a.y, b.y) > box.top + 1e-9 && Math.min(a.y, b.y) < box.bottom - 1e-9
        : Math.abs(a.y - b.y) < 1e-9 && a.y > box.top + 1e-9 && a.y < box.bottom - 1e-9 && Math.max(a.x, b.x) > box.left + 1e-9 && Math.min(a.x, b.x) < box.right - 1e-9
    const metrics = diagram.connections.map(edge => {
      const points = edge.points!
      const from = diagram.entities.find(entity => entity.id === edge.from)!
      const to = diagram.entities.find(entity => entity.id === edge.to)!
      const a = absolutePosition(diagram, from.id), b = absolutePosition(diagram, to.id)
      const hull = { left: Math.min(a.x, b.x), top: Math.min(a.y, b.y), right: Math.max(a.x + from.width, b.x + to.width), bottom: Math.max(a.y + from.height, b.y + to.height) }
      const length = points.slice(1).reduce((sum, point, index) => sum + Math.abs(point.x - points[index].x) + Math.abs(point.y - points[index].y), 0)
      const obstacles = diagram.entities.filter(entity => entity.id !== edge.from && entity.id !== edge.to && ['component', 'boundary'].includes(entity.kind)).map(entity => {
        const origin = absolutePosition(diagram, entity.id)
        return { id: entity.id, left: origin.x, right: origin.x + entity.width, top: origin.y, bottom: origin.y + (entity.kind === 'boundary' ? entityTextGeometry(entity).textBottom + 18 : entity.height) }
      })
      return {
        id: edge.id, from: edge.from, to: edge.to, hull, length, pointCount: points.length,
        bends: points.slice(1, -1).filter((point, index) => {
          const before = points[index], after = points[index + 2]
          return (point.x - before.x) * (after.y - point.y) !== (point.y - before.y) * (after.x - point.x)
            || (point.x - before.x) * (after.x - point.x) + (point.y - before.y) * (after.y - point.y) < 0
        }).length,
        obstacleHits: obstacles.filter(box => points.slice(1).some((point, index) => intersects(points[index], point, box))).map(box => box.id),
        direct: Math.abs(points[0].x - points.at(-1)!.x) + Math.abs(points[0].y - points.at(-1)!.y),
        extent: { left: Math.min(...points.map(point => point.x)), top: Math.min(...points.map(point => point.y)), right: Math.max(...points.map(point => point.x)), bottom: Math.max(...points.map(point => point.y)) },
      }
    })
    const scene = buildScene(diagram)
    if (process.env.DGM142_OUTPUT) {
      const output = resolve(process.env.DGM142_OUTPUT)
      await mkdir(output, { recursive: true })
      const name = `${direction}-${arrangement}`
      await writeFile(resolve(output, `${name}.json`), JSON.stringify({ starter, diagram, metrics, scene: scene.bounds, traces }, null, 2))
      await writeFile(resolve(output, `${name}.svg`), renderSvg(scene))
    }
    for (const edge of diagram.connections) {
      for (let i = 1; i < edge.points!.length; i++) {
        assert.ok(Math.min(Math.abs(edge.points![i].x - edge.points![i - 1].x), Math.abs(edge.points![i].y - edge.points![i - 1].y)) < 1e-9, `${edge.id}: orthogonal`)
      }
    }
    for (const metric of metrics) assert.deepEqual(metric.obstacleHits, [], `${metric.id}: unrelated component/header clearance`)
    if (arrangement === 'standard') return
    // Same-group forward neighbours have a clear straight content corridor.
    // 80px on either side permits four 20px tracks, not a canvas-wide loop;
    // 160px excess length permits a full out-and-back excursion on those tracks.
    for (const metric of metrics) {
      const from = diagram.entities.find(entity => entity.id === metric.from)!
      const to = diagram.entities.find(entity => entity.id === metric.to)!
      const forward = direction === 'DOWN' ? to.y > from.y : to.x > from.x
      if (from.parentId !== to.parentId || !forward) continue
      assert.ok(metric.length <= metric.direct + 160, `${metric.id}: local route length ${metric.length}, direct ${metric.direct}`)
      assert.ok(metric.extent.left >= metric.hull.left - 80 && metric.extent.top >= metric.hull.top - 80 && metric.extent.right <= metric.hull.right + 80 && metric.extent.bottom <= metric.hull.bottom + 80,
        `${metric.id}: no unexplained excursion ${JSON.stringify(metric)}`)
    }
    // All four root groups are a row/column. A forward neighbouring-group edge
    // can cross the gap below the header without travelling above the scene.
    if (direction === 'DOWN') {
      const roots = diagram.entities.filter(entity => entity.kind === 'boundary' && !entity.parentId)
      const top = Math.min(...roots.map(entity => entity.y))
      for (const metric of metrics) assert.ok(metric.extent.top >= top, `${metric.id}: route above the complete group hull: ${metric.extent.top} < ${top}`)
    }
  })
}
