import { absolutePosition, entityTextGeometry } from './model.ts'
import type { Connection, ConnectionSide, Diagram, Entity, Point } from './model.ts'

export type Box = { left: number; top: number; right: number; bottom: number }
export type FixedNode = { entity: Entity; box: Box; header: Box }
export type Port = { point: Point; stub: Point; heading: number; padding: number }
export const vectors = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
export const sides = ['right', 'bottom', 'left', 'top'] as const
export const EPS = 1e-9
export const expand = (box: Box, gap: number): Box => ({ left: box.left - gap, top: box.top - gap, right: box.right + gap, bottom: box.bottom + gap })
export const overlaps = (a: Box, b: Box) => a.left < b.right - EPS && a.right > b.left + EPS && a.top < b.bottom - EPS && a.bottom > b.top + EPS
export const encloses = (box: Box, point: Point) => point.x > box.left + EPS && point.x < box.right - EPS && point.y > box.top + EPS && point.y < box.bottom - EPS

export function fixedNodes(diagram: Diagram): Map<string, FixedNode> {
  return new Map(diagram.entities.filter(entity => ['component', 'boundary'].includes(entity.kind)).map(entity => {
    const point = absolutePosition(diagram, entity.id)
    const box = { left: point.x, top: point.y, right: point.x + entity.width, bottom: point.y + entity.height }
    if (!Object.values(box).every(Number.isFinite)) throw new Error(`Connection routing: nonfinite geometry for ${entity.id}`)
    return [entity.id, { entity, box, header: { ...box, bottom: point.y + entityTextGeometry(entity).textBottom + 18 } }]
  }))
}

export function ancestors(id: string, nodes: Map<string, FixedNode>): string[] {
  const result: string[] = []
  let parent = nodes.get(id)?.entity.parentId
  while (parent) {
    if (result.includes(parent)) throw new Error(`Connection routing: cyclic hierarchy at ${id}`)
    result.push(parent)
    parent = nodes.get(parent)?.entity.parentId
  }
  return result
}

export function obstacles(edge: Connection, nodes: Map<string, FixedNode>): { id: string; box: Box; component: boolean }[] {
  const related = new Set([...ancestors(edge.from, nodes), ...ancestors(edge.to, nodes)])
  return [...nodes].map(([id, node]) => ({
    id, component: node.entity.kind === 'component',
    box: node.entity.kind === 'boundary' && (related.has(id) || id === edge.from || id === edge.to) ? node.header : node.box,
  }))
}

export function segmentHits(a: Point, b: Point, box: Box): boolean {
  if (a.x === b.x) return a.x > box.left + EPS && a.x < box.right - EPS && Math.max(a.y, b.y) > box.top + EPS && Math.min(a.y, b.y) < box.bottom - EPS
  return a.y > box.top + EPS && a.y < box.bottom - EPS && Math.max(a.x, b.x) > box.left + EPS && Math.min(a.x, b.x) < box.right - EPS
}

export function preferredSide(from: FixedNode, to: FixedNode): Exclude<ConnectionSide, 'auto'> {
  const dx = (to.box.left + to.box.right - from.box.left - from.box.right) / 2
  const dy = (to.box.top + to.box.bottom - from.box.top - from.box.bottom) / 2
  return Math.abs(dx) >= Math.abs(dy) ? dx >= 0 ? 'right' : 'left' : dy >= 0 ? 'bottom' : 'top'
}

// Choose a perimeter point and a strictly outward stub. An explicit side is
// never replaced. Auto sides may try another face if the preferred face is
// trapped; a narrow positive corridor gets a correspondingly short stub.
export function makePort(node: FixedNode, preferred: ConnectionSide, peer: FixedNode, rank: number, count: number, blocked: Box[], context: string): Port {
  const primary = preferred === 'auto' ? preferredSide(node, peer) : preferred
  const choices = preferred === 'auto' ? [primary, ...sides.filter(side => side !== primary)] : [primary]
  for (const side of choices) {
    const heading = sides.indexOf(side), vector = vectors[heading], box = node.box
    const horizontal = heading % 2 === 0
    const low = horizontal ? node.entity.kind === 'boundary' ? node.header.bottom : box.top : box.left
    const high = horizontal ? box.bottom : box.right
    const step = Math.min(20, Math.max(0, high - low - 24) / Math.max(1, count))
    const peerAcross = horizontal ? (peer.box.top + peer.box.bottom) / 2 - (box.top + box.bottom) / 2 : (peer.box.left + peer.box.right) / 2 - (box.left + box.right) / 2
    const peerAhead = ((peer.box.left + peer.box.right - box.left - box.right) * vector.x + (peer.box.top + peer.box.bottom - box.top - box.bottom) * vector.y) / 2
    const anchor = peerAcross < 0 || !peerAcross && peerAhead <= 0 ? low + 12 : peerAcross > 0 ? high - 12 : (low + high) / 2
    const offset = anchor === low + 12 ? rank * step : anchor === high - 12 ? -(count - 1 - rank) * step : (rank - (count - 1) / 2) * step
    const middle = Math.max(low, Math.min(high, anchor + offset))
    const point = { x: horizontal ? side === 'left' ? box.left : box.right : middle, y: horizontal ? middle : side === 'top' ? box.top : box.bottom }
    let distance = 16
    for (const obstacle of blocked) {
      if (encloses(obstacle, point)) { distance = 0; break }
      const transverse = horizontal ? point.y > obstacle.top + EPS && point.y < obstacle.bottom - EPS : point.x > obstacle.left + EPS && point.x < obstacle.right - EPS
      if (!transverse) continue
      const near = side === 'right' ? obstacle.left - point.x : side === 'left' ? point.x - obstacle.right : side === 'bottom' ? obstacle.top - point.y : point.y - obstacle.bottom
      if (near >= -EPS) distance = Math.min(distance, Math.max(0, near) / 2)
    }
    if (distance <= EPS) continue
    return { point, stub: { x: point.x + vector.x * distance, y: point.y + vector.y * distance }, heading, padding: Math.min(8, distance / 2) }
  }
  throw new Error(`Connection routing failed for ${context}: ${preferred} port has no outward corridor`)
}

export function normalize(points: Point[]): Point[] {
  const result: Point[] = []
  for (const point of points) {
    const last = result.at(-1), before = result.at(-2)
    if (last && last.x === point.x && last.y === point.y) continue
    if (before && last && (before.x === last.x && last.x === point.x || before.y === last.y && last.y === point.y)
      && (last.x - before.x) * (point.x - last.x) + (last.y - before.y) * (point.y - last.y) > 0) result.pop()
    result.push(point)
  }
  return result
}
