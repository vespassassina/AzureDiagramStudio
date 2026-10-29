import assert from 'node:assert/strict'
import { test } from 'vitest'
import { computeLayout } from './layout.ts'
import { absolutePosition, createDocument, entityTextGeometry, sampleDiagram } from './model.ts'
import type { Diagram, Direction, Entity } from './model.ts'

function grouped(): Diagram {
  const component = (id: string, parentId?: string): Entity => ({ id, parentId, kind: 'component', label: id, x: 30, y: 80, width: 220, height: 88, color: 'azure' })
  const boundary = (id: string, parentId?: string): Entity => ({ ...component(id, parentId), kind: 'boundary' })
  return {
    ...createDocument('stacked', 'Four real layouts'),
    entities: [
      boundary('a'), component('a1', 'a'), component('a2', 'a'),
      boundary('nested', 'a'), component('n1', 'nested'), component('n2', 'nested'),
      boundary('b'), component('b1', 'b'), component('b2', 'b'), component('root-node'),
      { ...component('note', 'a'), kind: 'text' },
    ],
    connections: [
      { id: 'a-edge', from: 'a1', to: 'a2', label: 'Inside A', style: 'solid', arrow: 'forward' },
      { id: 'nested-edge', from: 'n1', to: 'n2', label: 'Nested', style: 'solid', arrow: 'forward' },
      { id: 'b-edge', from: 'b1', to: 'b2', label: 'Inside B', style: 'solid', arrow: 'forward' },
      { id: 'cross', from: 'a2', to: 'b1', sourceSide: 'right', targetSide: 'top', label: 'Cross group', style: 'solid', arrow: 'forward' },
      { id: 'cross-nested', from: 'n2', to: 'b2', label: 'Nested crossing', style: 'solid', arrow: 'forward' },
      { id: 'ungrouped', from: 'b2', to: 'root-node', label: 'Root', style: 'solid', arrow: 'forward' },
    ],
  }
}

function axisOrder(diagram: Diagram, ids: string[], direction: Direction) {
  const axis = direction === 'RIGHT' ? 'x' : 'y'
  const size = direction === 'RIGHT' ? 'width' : 'height'
  for (let i = 1; i < ids.length; i++) {
    const before = diagram.entities.find(entity => entity.id === ids[i - 1])!
    const after = diagram.entities.find(entity => entity.id === ids[i])!
    assert.ok(after[axis] >= before[axis] + before[size], `${ids[i - 1]} → ${ids[i]} must be disjoint on ${axis}: ${JSON.stringify([before, after])}`)
  }
}

function alignedUnits(diagram: Diagram, ids: string[], direction: Direction) {
  axisOrder(diagram, ids, direction)
  const axis = direction === 'RIGHT' ? 'y' : 'x'
  const units = ids.map(id => diagram.entities.find(entity => entity.id === id)!)
  assert.ok(units.every(unit => Math.abs(unit[axis] - units[0][axis]) < 0.001),
    `No stagger on ${axis}: ${JSON.stringify(units.map(({ id, x, y, width, height }) => ({ id, x, y, width, height })))}`)
}

function equalGaps(diagram: Diagram, ids: string[], direction: Direction) {
  const axis = direction === 'RIGHT' ? 'x' : 'y'
  const size = direction === 'RIGHT' ? 'width' : 'height'
  const units = ids.map(id => diagram.entities.find(entity => entity.id === id)!)
  const gaps = units.slice(1).map((unit, index) => unit[axis] - units[index][axis] - units[index][size])
  assert.ok(gaps.every(gap => Math.abs(gap - gaps[0]) < 0.001), `Consistent measured gaps: ${JSON.stringify(gaps)}`)
}

function variedGroups(): Diagram {
  const diagram = grouped()
  const boundary = (id: string, parentId?: string): Entity => ({ id, parentId, kind: 'boundary', label: id, x: 0, y: 0, width: 220, height: 88, color: 'azure' })
  const component = (id: string, parentId: string, width: number, height: number): Entity => ({ ...boundary(id, parentId), kind: 'component', width, height })
  diagram.entities.splice(7, 0,
    boundary('nested-sibling', 'a'), component('s1', 'nested-sibling', 310, 120), component('s2', 'nested-sibling', 180, 90),
    boundary('deep', 'nested-sibling'), component('d1', 'deep', 200, 150), component('d2', 'deep', 260, 100),
  )
  diagram.entities.push(boundary('disconnected'), component('z1', 'disconnected', 410, 180), component('z2', 'disconnected', 180, 88))
  diagram.entities.push(
    { ...component('deep-note', 'deep', 220, 88), kind: 'text', x: -110, y: 680 },
    { ...component('deep-rectangle', 'deep', 220, 88), kind: 'rectangle', x: -90, y: 750 },
  )
  diagram.connections.push(
    { id: 'sibling-edge', from: 's1', to: 's2', label: 'Sibling contents', style: 'solid', arrow: 'forward' },
    { id: 'deep-edge', from: 'd1', to: 'd2', label: 'Deep contents', style: 'solid', arrow: 'forward' },
    { id: 'sibling-cross', from: 'n2', to: 's1', label: 'Nested sibling crossing', style: 'solid', arrow: 'forward', sourceSide: 'right', targetSide: 'top' },
    { id: 'cycle-back', from: 'root-node', to: 'd1', label: 'Back to deep child', style: 'dashed', arrow: 'both', sourceSide: 'bottom', targetSide: 'left' },
    { id: 'inside-cycle', from: 'a2', to: 'a1', label: 'Internal backwards', style: 'dashed', arrow: 'forward' },
    { id: 'sibling-cycle', from: 's2', to: 'n1', label: 'Sibling backwards', style: 'solid', arrow: 'forward' },
  )
  return diagram
}

for (const direction of ['RIGHT', 'DOWN'] as const) {
  test(`should_form_a_true_root_stack_with_varied_nested_and_disconnected_units_when_${direction}`, async () => {
    const result = (await computeLayout(variedGroups(), direction, 9, undefined, { arrangement: 'stacked' })).diagram
    alignedUnits(result, ['a', 'b', 'root-node', 'disconnected'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    equalGaps(result, ['a', 'b', 'root-node', 'disconnected'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
  })

  test(`should_apply_aligned_contents_direction_at_every_nested_boundary_when_${direction}`, async () => {
    const result = (await computeLayout(variedGroups(), direction, 9, undefined, { arrangement: 'stacked' })).diagram
    for (const boundary of result.entities.filter(entity => entity.kind === 'boundary')) {
      const children = result.entities.filter(entity => entity.parentId === boundary.id && (entity.kind === 'component' || entity.kind === 'boundary'))
      alignedUnits(result, children.map(entity => entity.id), direction)
    }
  })
}

test('should_keep_routes_for_self_connections_and_explicit_boundary_to_descendant_connections_when_stacked', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const original = variedGroups()
    original.connections.push({ id: 'self', from: 'a1', to: 'a1', label: 'Self', style: 'solid', arrow: 'forward', sourceSide: 'top', targetSide: 'left' })
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      original.connections.push(
        { id: `ancestor-${side}`, from: 'a', to: 'd2', label: 'Boundary to child', style: 'solid', arrow: 'forward', sourceSide: side, targetSide: 'bottom' },
        { id: `to-ancestor-${side}`, from: 'd1', to: 'a', label: 'Child to boundary', style: 'solid', arrow: 'forward', sourceSide: 'right', targetSide: side },
      )
    }
    const result = (await computeLayout(original, direction, 9, undefined, { arrangement: 'stacked' })).diagram
    alignedUnits(result, ['a', 'b', 'root-node', 'disconnected'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    equalGaps(result, ['a', 'b', 'root-node', 'disconnected'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    for (const boundary of result.entities.filter(entity => entity.kind === 'boundary')) {
      alignedUnits(result, result.entities.filter(entity => entity.parentId === boundary.id && ['component', 'boundary'].includes(entity.kind)).map(entity => entity.id), direction)
    }
    for (const id of ['note', 'deep-note', 'deep-rectangle']) assert.deepEqual(absolutePosition(result, id), absolutePosition(original, id))
    for (const entity of result.entities.filter(entity => entity.parentId && ['component', 'boundary'].includes(entity.kind))) {
      const parent = result.entities.find(candidate => candidate.id === entity.parentId)!
      assert.ok(entity.x >= 0 && entity.y >= entityTextGeometry(parent).textBottom + 18)
      assert.ok(entity.x + entity.width <= parent.width && entity.y + entity.height <= parent.height)
    }
    for (const edge of result.connections) {
      assert.ok(edge.points && edge.points.length >= 2, `${direction} ${edge.id}: routed`)
      assert.ok(edge.labelPosition && Number.isFinite(edge.labelPosition.x), `${edge.id}: label`)
      for (let index = 1; index < edge.points.length; index++) assert.ok(edge.points[index].x === edge.points[index - 1].x || edge.points[index].y === edge.points[index - 1].y, `${edge.id}: orthogonal`)
      for (const [id, point, side] of [[edge.from, edge.points[0], edge.sourceSide], [edge.to, edge.points.at(-1)!, edge.targetSide]] as const) {
        const entity = result.entities.find(entity => entity.id === id)!
        const origin = absolutePosition(result, id)
        const near = (a: number, b: number) => Math.abs(a - b) < 0.001
        assert.ok(point.x >= origin.x - 0.001 && point.x <= origin.x + entity.width + 0.001 && point.y >= origin.y - 0.001 && point.y <= origin.y + entity.height + 0.001, `${edge.id}: endpoint on ${id}`)
        if (side === 'top') assert.ok(near(point.y, origin.y), `${edge.id}: top ${id}`)
        if (side === 'bottom') assert.ok(near(point.y, origin.y + entity.height), `${edge.id}: bottom ${id}`)
        if (side === 'left') assert.ok(near(point.x, origin.x), `${edge.id}: left ${id}`)
        if (side === 'right') assert.ok(near(point.x, origin.x + entity.width), `${edge.id}: right ${id}`)
      }
    }
    assert.deepEqual((await computeLayout(result, direction, 9, undefined, { arrangement: 'stacked' })).diagram, result)
  }
})

test('should_keep_empty_disconnected_boundaries_aligned_and_route_boundary_endpoints_when_stacked', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const original = variedGroups()
    original.entities.push({ ...original.entities.find(entity => entity.id === 'b')!, id: 'empty', label: 'Empty group with a wrapping header and subtitle', subtitle: 'Still contains no components' })
    original.connections.push({ id: 'empty-edge', from: 'empty', to: 'a', label: 'Boundary link', style: 'solid', arrow: 'forward', sourceSide: 'right', targetSide: 'top' })
    const result = (await computeLayout(original, direction, 9, undefined, { arrangement: 'stacked' })).diagram
    alignedUnits(result, ['a', 'b', 'root-node', 'disconnected', 'empty'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    equalGaps(result, ['a', 'b', 'root-node', 'disconnected', 'empty'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    assert.ok(result.connections.at(-1)!.points!.length >= 2)
    assert.deepEqual((await computeLayout(result, direction, 9, undefined, { arrangement: 'stacked' })).diagram, result)
  }
})

test('should_retain_every_canonical_sample_route_when_stacked', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const result = await computeLayout(sampleDiagram(), direction, 0, undefined, { arrangement: 'stacked' })
    for (const edge of result.diagram.connections) assert.ok(edge.points && edge.points.length >= 2, JSON.stringify({ direction, edge, entities: result.diagram.entities }))
  }
})

test('should_keep_aligned_axes_and_wrapped_header_containment_when_edge_labels_are_wide_and_multiline', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const original = variedGroups()
    original.entities.find(entity => entity.id === 'nested')!.label = 'A nested boundary with several words that need a wrapped header'
    original.connections = original.connections.map(edge => ({ ...edge, label: `${edge.label} with a substantially wider label\nSecond descriptive line` }))
    const result = (await computeLayout(original, direction, 0, undefined, { arrangement: 'stacked' })).diagram
    alignedUnits(result, ['a', 'b', 'root-node', 'disconnected'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    equalGaps(result, ['a', 'b', 'root-node', 'disconnected'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    for (const parent of result.entities.filter(entity => entity.kind === 'boundary')) {
      const children = result.entities.filter(entity => entity.parentId === parent.id && ['component', 'boundary'].includes(entity.kind))
      alignedUnits(result, children.map(entity => entity.id), direction)
      for (const child of children) assert.ok(child.y >= entityTextGeometry(parent).textBottom + 18 && child.y + child.height <= parent.height && child.x + child.width <= parent.width)
    }
    for (const edge of result.connections) assert.ok(edge.points!.length >= 2 && Number.isFinite(edge.labelPosition!.x) && Number.isFinite(edge.labelPosition!.y))
  }
})

for (const direction of ['RIGHT', 'DOWN'] as const) for (const arrangement of ['standard', 'stacked'] as const) {
  test(`should_preserve_real_geometry_routes_hierarchy_and_annotations_when_${direction}_${arrangement}`, async () => {
    const original = grouped()
    const snapshot = structuredClone(original)
    const result = (await computeLayout(original, direction, 7, undefined, { arrangement })).diagram
    axisOrder(result, ['a1', 'a2'], direction)
    axisOrder(result, ['b1', 'b2'], direction)
    axisOrder(result, ['n1', 'n2'], direction)
    axisOrder(result, ['a', 'b', 'root-node'], arrangement === 'stacked' ? direction === 'RIGHT' ? 'DOWN' : 'RIGHT' : direction)
    if (arrangement === 'stacked') alignedUnits(result, ['a', 'b', 'root-node'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    for (const entity of result.entities.filter(entity => entity.parentId && entity.kind !== 'text')) {
      const parent = result.entities.find(candidate => candidate.id === entity.parentId)!
      assert.ok(entity.x >= 0 && entity.y >= entityTextGeometry(parent).textBottom + 18)
      assert.ok(entity.x + entity.width <= parent.width && entity.y + entity.height <= parent.height)
    }
    for (const edge of result.connections) {
      assert.ok(edge.points && edge.points.length >= 2, `${edge.id} has a real route`)
      assert.ok(edge.labelPosition && Number.isFinite(edge.labelPosition.x))
      assert.equal(edge.routeRevision, 7)
      for (const [id, point, side] of [[edge.from, edge.points[0], edge.sourceSide], [edge.to, edge.points.at(-1)!, edge.targetSide]] as const) {
        const entity = result.entities.find(candidate => candidate.id === id)!
        const origin = absolutePosition(result, id)
        const near = (a: number, b: number) => Math.abs(a - b) < 0.1
        assert.ok(point.x >= origin.x - 0.1 && point.x <= origin.x + entity.width + 0.1 && point.y >= origin.y - 0.1 && point.y <= origin.y + entity.height + 0.1, `${edge.id}: endpoint on ${id}`)
        assert.ok(near(point.x, origin.x) || near(point.x, origin.x + entity.width) || near(point.y, origin.y) || near(point.y, origin.y + entity.height))
        if (side === 'right') assert.ok(near(point.x, origin.x + entity.width))
        if (side === 'top') assert.ok(near(point.y, origin.y))
      }
    }
    assert.deepEqual(absolutePosition(result, 'note'), absolutePosition(original, 'note'))
    assert.deepEqual(original, snapshot)
    assert.deepEqual((await computeLayout(original, direction, 7, undefined, { arrangement })).diagram, result)
    assert.deepEqual((await computeLayout(result, direction, 7, undefined, { arrangement })).diagram, result)
    for (const entity of result.entities) {
      const previous = original.entities.find(candidate => candidate.id === entity.id)!
      const { x: _x, y: _y, width: _width, height: _height, ...content } = entity
      const { x: _oldX, y: _oldY, width: _oldWidth, height: _oldHeight, ...oldContent } = previous
      assert.deepEqual(content, oldContent)
      if (entity.kind === 'component') assert.deepEqual([entity.width, entity.height], [previous.width, previous.height])
    }
  })
}

test('should_match_standard_geometry_when_stacked_has_no_groups', async () => {
  const original = grouped()
  original.entities = original.entities.filter(entity => entity.kind === 'component').map(({ parentId: _parent, ...entity }) => entity)
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const standard = await computeLayout(original, direction, 1)
    const stacked = await computeLayout(original, direction, 1, undefined, { arrangement: 'stacked' })
    assert.deepEqual(stacked, standard)
  }
})

test('should_stack_disconnected_units_in_document_order_and_route_backward_crossings_DGM137', async () => {
  for (const direction of ['RIGHT', 'DOWN'] as const) for (const connected of [false, true]) {
    const original = grouped()
    if (!connected) original.connections = original.connections.filter(edge => ['a-edge', 'b-edge', 'nested-edge'].includes(edge.id))
    if (connected) original.connections.push({ id: 'backward', from: 'root-node', to: 'n1', label: 'Backwards', style: 'dashed', arrow: 'both', sourceSide: 'bottom', targetSide: 'left' })
    const result = (await computeLayout(original, direction, 8, undefined, { arrangement: 'stacked' })).diagram
    axisOrder(result, ['a', 'b', 'root-node'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    alignedUnits(result, ['a', 'b', 'root-node'], direction === 'RIGHT' ? 'DOWN' : 'RIGHT')
    for (const edge of result.connections) {
      assert.ok(edge.points?.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)))
      for (let index = 1; index < edge.points!.length; index++) {
        assert.ok(edge.points![index].x === edge.points![index - 1].x || edge.points![index].y === edge.points![index - 1].y, `${edge.id} has no diagonal joins`)
      }
    }
  }
})
