import { connectionLabelSize } from './render/text.ts'
import { ancestors, expand, fixedNodes, makePort, normalize, obstacles, overlaps, preferredSide, segmentHits, vectors } from './routing-geometry.ts'
import { CHANNEL_PITCH, searchRoute } from './routing-search.ts'
import type { Box, FixedNode, Port } from './routing-geometry.ts'
import type { Channel, Segment, Work } from './routing-search.ts'
import type { Connection, Diagram, Point } from './model.ts'

type Plan = { edge: Connection; from: Port; to: Port; blocked: ReturnType<typeof obstacles> }
const segments = (points: Point[]): Segment[] => points.slice(1).map((b, i) => ({ a: points[i], b }))
const labelBox = (point: Point, size: { width: number; height: number }): Box => ({ left: point.x - size.width / 2, right: point.x + size.width / 2, top: point.y - size.height / 2, bottom: point.y + size.height / 2 })

function planPorts(diagram: Diagram, nodes: Map<string, FixedNode>): Plan[] {
  const choices = diagram.connections.flatMap(edge => (['from', 'to'] as const).map(endpoint => {
    const node = nodes.get(edge[endpoint]), peer = nodes.get(edge[endpoint === 'from' ? 'to' : 'from'])
    if (!node || !peer) throw new Error(`Connection routing failed for ${edge.id}: unknown endpoint`)
    const requested = (endpoint === 'from' ? edge.sourceSide : edge.targetSide) ?? 'auto'
    const side = requested === 'auto' ? preferredSide(node, peer) : requested
    return { edge, endpoint, node, peer, requested, key: `${node.entity.id}:${side}` }
  }))
  const counts = new Map<string, number>(), ranks = new Map<string, number>(), ports = new Map<string, Port>()
  for (const choice of choices) counts.set(choice.key, (counts.get(choice.key) ?? 0) + 1)
  for (const { edge, endpoint, node, peer, requested, key } of choices) {
    const rank = ranks.get(key) ?? 0
    ranks.set(key, rank + 1)
    const blocked = obstacles(edge, nodes).filter(item => item.id !== node.entity.id || node.entity.kind === 'boundary').map(item => item.box)
    ports.set(`${edge.id}:${endpoint}`, makePort(node, requested, peer, rank, counts.get(key)!, blocked, edge.id))
  }
  return diagram.connections.map(edge => ({ edge, from: ports.get(`${edge.id}:from`)!, to: ports.get(`${edge.id}:to`)!, blocked: obstacles(edge, nodes) }))
}

function routingDomain(plan: Plan, nodes: Map<string, FixedNode>): { preferred: Box; expanded: Box } {
  const boxes = [...nodes.values()].map(node => node.box)
  const hull = {
    left: Math.min(...boxes.map(box => box.left)), right: Math.max(...boxes.map(box => box.right)),
    top: Math.min(...boxes.map(box => box.top)), bottom: Math.max(...boxes.map(box => box.bottom)),
  }
  const required = [plan.from.stub, plan.to.stub]
  const preferred = {
    left: Math.min(hull.left, ...required.map(point => point.x - 8)), right: Math.max(hull.right, ...required.map(point => point.x + 8)),
    top: Math.min(hull.top, ...required.map(point => point.y - 8)), bottom: Math.max(hull.bottom, ...required.map(point => point.y + 8)),
  }
  const common = ancestors(plan.edge.from, nodes).find(id => ancestors(plan.edge.to, nodes).includes(id))
  if (!common) return { preferred, expanded: expand(preferred, 80 + connectionLabelSize(plan.edge.label).width) }
  const node = nodes.get(common)!
  const interior = { ...node.box, top: node.header.bottom }
  return { preferred: interior, expanded: interior }
}

// Labels are measured exactly as shared scene markup. Candidate centres project
// onto a real segment, stay clear of all nodes/headers/other labels and do not
// erase earlier routes or any endpoint's reserved cardinal approach.
function placeLabel(plan: Plan, points: Point[], labels: Box[], previous: Segment[], approaches: Segment[]): Point | undefined {
  const size = connectionLabelSize(plan.edge.label)
  if (!plan.edge.label) return { x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 }
  const ordered = segments(points).sort((a, b) => Math.abs(b.b.x - b.a.x) + Math.abs(b.b.y - b.a.y) - Math.abs(a.b.x - a.a.x) - Math.abs(a.b.y - a.a.y))
  for (const { a, b } of ordered) for (const fraction of [0.5, 0.25, 0.75, 0.1, 0.9]) {
    const horizontal = a.y === b.y
    const offsets = horizontal ? [0, -size.height / 2 - 4, size.height / 2 + 4] : [size.width / 2 + 4, -size.width / 2 - 4, 0]
    for (const offset of offsets) {
      const point = { x: a.x + (b.x - a.x) * fraction + (horizontal ? 0 : offset), y: a.y + (b.y - a.y) * fraction + (horizontal ? offset : 0) }
      const box = labelBox(point, size)
      if (plan.blocked.some(item => overlaps(box, item.box)) || labels.some(label => overlaps(box, expand(label, 4)))) continue
      if ([plan.from.point, plan.to.point].some(port => overlaps(box, expand({ left: port.x, right: port.x, top: port.y, bottom: port.y }, 10)))) continue
      if (previous.some(segment => segmentHits(segment.a, segment.b, expand(box, 2))) || approaches.some(segment => segmentHits(segment.a, segment.b, expand(box, 8)))) continue
      return point
    }
  }
}

// Validate the generated result independently of grid occupancy before any
// session/history publication. A failure rejects the entire immutable result.
function audit(plan: Plan, points: Point[], nodes: Map<string, FixedNode>) {
  if (points.length < 2 || !points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))) throw new Error('incomplete route')
  if (points[0].x !== plan.from.point.x || points[0].y !== plan.from.point.y || points.at(-1)!.x !== plan.to.point.x || points.at(-1)!.y !== plan.to.point.y) throw new Error('detached port')
  const first = points[1], last = points.at(-2)!, from = vectors[plan.from.heading], to = vectors[plan.to.heading]
  if ((first.x - points[0].x) * from.x + (first.y - points[0].y) * from.y <= 0 || (last.x - points.at(-1)!.x) * to.x + (last.y - points.at(-1)!.y) * to.y <= 0) throw new Error('reversed cardinal port approach')
  for (const { a, b } of segments(points)) {
    if (a.x !== b.x && a.y !== b.y || a.x === b.x && a.y === b.y) throw new Error('nonorthogonal or duplicate segment')
    if (plan.blocked.some(item => segmentHits(a, b, item.box))) throw new Error('route crosses component or header obstacle')
  }
  if (new Set(points.map(point => `${point.x},${point.y}`)).size !== points.length) throw new Error('route contains a return loop')
  for (let i = 2; i < points.length; i++) {
    if (points[i].x === points[i - 1].x && points[i - 1].x === points[i - 2].x || points[i].y === points[i - 1].y && points[i - 1].y === points[i - 2].y) throw new Error('route has a collinear reversal')
  }
  for (const id of new Set([...ancestors(plan.edge.from, nodes), ...ancestors(plan.edge.to, nodes)])) {
    if (id === plan.edge.from || id === plan.edge.to) continue
    const box = nodes.get(id)!.box
    const states = segments(points).map(({ a, b }) => {
      const x = (a.x + b.x) / 2, y = (a.y + b.y) / 2
      return x >= box.left && x <= box.right && y >= box.top && y <= box.bottom
    })
    const changes = states.slice(1).filter((value, i) => value !== states[i]).length
    const both = ancestors(plan.edge.from, nodes).includes(id) && ancestors(plan.edge.to, nodes).includes(id)
    if (changes > (both ? 0 : 1)) throw new Error(`route needlessly recrosses ancestor ${id}`)
  }
}

// Algorithm:
// 1. Read fixed absolute geometry; allocate stable cardinal endpoint approaches.
// 2. Route each semantic edge on a finite visibility/channel grid, preferring
//    the existing scene hull before a bounded exterior corridor.
// 3. Penalize coincident channels, reserve measured labels, normalize and audit.
// 4. Publish one complete connection array; never mutate nodes or reuse ELK paths.
export function routeFixedGeometry(diagram: Diagram): { diagram: Diagram; work: Work } {
  if (diagram.entities.length > 100 || diagram.connections.length > 150) throw new Error('Connection routing: document work limit exceeded')
  const nodes = fixedNodes(diagram), plans = planPorts(diagram, nodes)
  const work: Work = { gridCells: 0, expandedStates: 0, maxCells: 0 }, labels: Box[] = [], previous: Segment[] = []
  const parallel = new Map<string, Point[]>(), ranks = new Map<string, number>()
  const parallelSegments = new Map<string, Segment[]>()
  const approaches = plans.flatMap(plan => [{ a: plan.from.point, b: plan.from.stub }, { a: plan.to.point, b: plan.to.stub }])
  const queues = new Map<string, Plan[]>()
  const channels = new Map<string, Channel>()
  for (const plan of plans) {
    const key = [plan.edge.from, plan.edge.to].sort().join(':')
    queues.set(key, [...(queues.get(key) ?? []), plan])
  }
  // Dense fans grow symmetrically from the middle rather than trapping the
  // remaining ports behind a one-sided wall of already allocated channels.
  for (const group of queues.values()) {
    const node = nodes.get(group[0].edge.from)!
    const span = group[0].from.heading % 2 === 0 ? node.entity.height : node.entity.width
    if (group.length * CHANNEL_PITCH <= span - 24) continue
    const axis = group[0].from.heading % 2 === 0 ? 'y' : 'x'
    const along = axis === 'y' ? 'x' : 'y'
    const source = group.reduce((sum, plan) => sum + plan.from.point[axis], 0) / group.length
    const target = group.reduce((sum, plan) => sum + plan.to.point[axis], 0) / group.length
    const bridge = group.reduce((sum, plan) => sum + plan.from.stub[along] + plan.to.stub[along], 0) / (group.length * 2)
    group.forEach((plan, i) => {
      const offset = (i - (group.length - 1) / 2) * CHANNEL_PITCH
      channels.set(plan.edge.id, { axis, source: source + offset, target: target + offset, bridge: bridge + (Math.abs(source - target) > CHANNEL_PITCH ? offset : 0), forward: plan.from.stub[along] <= plan.to.stub[along] })
    })
    const index = new Map(group.map((plan, i) => [plan, i]))
    group.sort((a, b) => Math.abs(index.get(a)! - (group.length - 1) / 2) - Math.abs(index.get(b)! - (group.length - 1) / 2) || index.get(a)! - index.get(b)!)
  }
  const ordered = plans.map(plan => queues.get([plan.edge.from, plan.edge.to].sort().join(':'))!.shift()!)
  const routed = new Map(ordered.map(plan => {
    let generated: Point[] = []
    try {
      const rectangles = plan.blocked.map(item => expand(item.box, item.component ? item.id === plan.edge.from ? plan.from.padding : item.id === plan.edge.to ? plan.to.padding : 8 : nodes.get(item.id)!.entity.kind === 'boundary' && item.box === nodes.get(item.id)!.box ? 8 : 0))
      rectangles.push(...labels.map(box => expand(box, 4)))
      const key = [plan.edge.from, plan.edge.to].sort().join(':'), rank = ranks.get(key) ?? 0
      ranks.set(key, rank + 1)
      const track = rank % 2 ? Math.ceil(rank / 2) * 20 : -rank / 2 * 20
      const tracks = (parallel.get(key) ?? []).flatMap(point => [{ x: point.x + track, y: point.y + track }, { x: point.x - track, y: point.y - track }])
      const sourceAncestors = ancestors(plan.edge.from, nodes), targetAncestors = ancestors(plan.edge.to, nodes)
      const gates = [...new Set([...sourceAncestors, ...targetAncestors])].filter(id => id !== plan.edge.from && id !== plan.edge.to).map(id => ({
        box: nodes.get(id)!.box, source: sourceAncestors.includes(id), target: targetAncestors.includes(id),
      }))
      const inside = (point: Point, box: Box) => point.x >= box.left && point.x <= box.right && point.y >= box.top && point.y <= box.bottom
      const permit = (a: Point, b: Point) => gates.every(gate => gate.source && gate.target
        ? inside(a, gate.box) && inside(b, gate.box)
        : gate.source ? inside(a, gate.box) || !inside(b, gate.box) : !inside(a, gate.box) || inside(b, gate.box))
      tracks.push(...gates.flatMap(({ box }) => [{ x: box.left, y: box.top }, { x: box.right, y: box.bottom }]))
      const domain = routingDomain(plan, nodes)
      const channel = channels.get(plan.edge.id)
      if (channel) tracks.push(...[channel.source, channel.target].map(position => ({ x: channel.axis === 'x' ? position : channel.bridge, y: channel.axis === 'y' ? position : channel.bridge })))
      const reservedApproaches = approaches.filter(segment => segment.a !== plan.from.point && segment.a !== plan.to.point)
      const labelFor = plan.edge.label ? (segment: Segment) => placeLabel(plan, [segment.a, segment.b], labels, previous, reservedApproaches) : undefined
      const neighbours = parallelSegments.get(key) ?? []
      const route = searchRoute(plan.from, plan.to, rectangles, channel ? domain.expanded : domain.preferred, tracks, previous, work, labelFor, permit, neighbours, channel)
        ?? (channel ? undefined : searchRoute(plan.from, plan.to, rectangles, domain.expanded, tracks, previous, work, labelFor, permit, neighbours))
      if (!route) throw new Error('no feasible orthogonal corridor')
      const points = normalize([plan.from.point, ...route.points, plan.to.point])
      generated = points
      audit(plan, points, nodes)
      const labelPosition = placeLabel(plan, points, labels, previous, reservedApproaches) ?? route.label
      if (!labelPosition) throw new Error('no clear final label corridor')
      const size = connectionLabelSize(plan.edge.label)
      if (!segments(points).some(({ a, b }) => a.y === b.y
        ? labelPosition.x >= Math.min(a.x, b.x) && labelPosition.x <= Math.max(a.x, b.x) && Math.abs(labelPosition.y - a.y) <= size.height / 2 + 4
        : labelPosition.y >= Math.min(a.y, b.y) && labelPosition.y <= Math.max(a.y, b.y) && Math.abs(labelPosition.x - a.x) <= size.width / 2 + 4)) throw new Error('label detached from final route')
      if (plan.edge.label) labels.push(labelBox(labelPosition, connectionLabelSize(plan.edge.label)))
      previous.push(...segments(points))
      parallelSegments.set(key, [...neighbours, ...segments(points)])
      if (!parallel.has(key)) parallel.set(key, points)
      return [plan.edge.id, { ...plan.edge, points, labelPosition, routeRevision: diagram.revision }] as const
    } catch (error) {
      throw new Error(`Connection routing failed for ${plan.edge.id}: ${error instanceof Error ? error.message : String(error)}`, { cause: { edge: plan.edge, from: plan.from, to: plan.to, obstacles: plan.blocked, labels, points: generated } })
    }
  }))
  const connections = diagram.connections.map(edge => routed.get(edge.id)!)
  return { diagram: { ...diagram, connections }, work }
}
