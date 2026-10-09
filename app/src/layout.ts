import type { ElkNode, ELK } from 'elkjs'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'
import { absolutePosition, entityTextGeometry, measureEntity } from './model.ts'
import { connectionLabelSize } from './render/text.ts'
import type { ConnectionSide, Diagram, Entity, Point } from './model.ts'

export type LayoutResult = { diagram: Diagram; revision: number }

async function createEngine(): Promise<ELK> {
  if (typeof Worker !== 'undefined') {
    const { default: Constructor } = await import('elkjs/lib/elk-api.js')
    return new Constructor({ workerFactory: () => new Worker(workerUrl) })
  }
  const { default: Constructor } = await import('elkjs/lib/elk.bundled.js')
  return new Constructor()
}

export async function computeLayout(diagram: Diagram, direction: Diagram['direction'], revision: number, providedEngine?: ELK): Promise<LayoutResult> {
  const structured = diagram.entities.filter(entity => entity.kind === 'component' || entity.kind === 'boundary')
  const ports = new Map<string, NonNullable<ElkNode['ports']>>()
  const usedIds = new Set([...diagram.entities, ...diagram.connections].map(item => item.id))
  const sides = { top: 'NORTH', right: 'EAST', bottom: 'SOUTH', left: 'WEST' }
  const endpoint = (id: string, side: ConnectionSide | undefined) => {
    if (!side || side === 'auto') return id
    let portId = `${id}-port-${side}`
    while (usedIds.has(portId)) portId += '-port'
    usedIds.add(portId)
    const entries = ports.get(id) ?? []
    entries.push({ id: portId, width: 0, height: 0, layoutOptions: { 'elk.port.side': sides[side] } })
    ports.set(id, entries)
    return portId
  }
  const edges = diagram.connections.map(connection => ({
    id: connection.id, sources: [endpoint(connection.from, connection.sourceSide)], targets: [endpoint(connection.to, connection.targetSide)],
    labels: connection.label ? [{ id: `${connection.id}-label`, text: connection.label, ...connectionLabelSize(connection.label) }] : [],
  }))
  const buildNode = (entity: Entity): ElkNode => {
    const children = structured.filter(candidate => candidate.parentId === entity.id)
    const size = measureEntity(entity)
    const header = Math.max(58, entityTextGeometry(entity).textBottom + 18)
    return {
      id: entity.id,
      ...size,
      ports: ports.get(entity.id),
      layoutOptions: {
        'elk.portConstraints': ports.has(entity.id) ? 'FIXED_SIDE' : 'FREE',
        'elk.nodeSize.constraints': 'MINIMUM_SIZE',
        'elk.nodeSize.minimum': `(${size.width},${size.height})`,
        ...(entity.kind === 'boundary' ? { 'elk.padding': `[top=${header},left=24,bottom=24,right=24]` } : {}),
      },
      ...(entity.kind === 'boundary' && children.length ? {
        children: children.map(buildNode),
      } : {}),
    }
  }
  let rootId = 'root'
  while (usedIds.has(rootId)) rootId += '-root'
  const root: ElkNode = {
    id: rootId,
    layoutOptions: {
      'elk.algorithm': 'layered', 'elk.direction': direction,
      'elk.hierarchyHandling': 'INCLUDE_CHILDREN', 'elk.edgeRouting': 'ORTHOGONAL',
      'elk.spacing.nodeNode': '40', 'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.spacing.edgeEdge': '20', 'elk.layered.spacing.edgeNodeBetweenLayers': '32',
      'elk.padding': '[top=24,left=24,bottom=24,right=24]',
    },
    children: structured.filter(entity => !entity.parentId).map(buildNode),
    edges,
  }
  const engine = providedEngine ?? await createEngine()
  let result: ElkNode
  try { result = await engine.layout(root) }
  finally { if (!providedEngine && typeof Worker !== 'undefined') engine.terminateWorker() }
  const geometry = new Map<string, { x: number; y: number; width: number; height: number }>()
  const routes = new Map<string, Point[]>()
  const labels = new Map<string, Point>()
  const origins = new Map<string, Point>()
  const walk = (node: ElkNode, origin: Point) => {
    origins.set(node.id, origin)
    for (const child of node.children ?? []) {
      geometry.set(child.id, { x: child.x ?? 0, y: child.y ?? 0, width: child.width ?? 220, height: child.height ?? 88 })
      walk(child, { x: origin.x + (child.x ?? 0), y: origin.y + (child.y ?? 0) })
    }
  }
  walk(result, { x: 0, y: 0 })
  const walkEdges = (node: ElkNode) => {
    for (const edge of node.edges ?? []) {
      const points = (edge.sections ?? []).flatMap(section => [section.startPoint, ...(section.bendPoints ?? []), section.endPoint])
      const edgeOrigin = origins.get(edge.container ?? node.id)
      if (!edgeOrigin) throw new Error(`Unknown ELK edge container: ${edge.container}`)
      routes.set(edge.id, points.map(point => ({ x: point.x + edgeOrigin.x, y: point.y + edgeOrigin.y })))
      const label = edge.labels?.[0]
      if (label && Number.isFinite(label.x) && Number.isFinite(label.y)) labels.set(edge.id, { x: edgeOrigin.x + label.x! + (label.width ?? 0) / 2, y: edgeOrigin.y + label.y! + (label.height ?? 0) / 2 })
    }
    for (const child of node.children ?? []) walkEdges(child)
  }
  walkEdges(result)
  const entities = diagram.entities.map(entity => {
    const computed = geometry.get(entity.id)
    if (computed) return { ...entity, ...computed }
    if (!entity.parentId) return { ...entity }
    const absolute = absolutePosition(diagram, entity.id)
    const parent = origins.get(entity.parentId)
    return parent ? { ...entity, x: absolute.x - parent.x, y: absolute.y - parent.y } : { ...entity }
  })
  return {
    revision,
    diagram: {
      ...diagram, direction, revision, entities,
      connections: diagram.connections.map(({ points: _points, labelPosition: _label, routeRevision: _revision, ...connection }) => ({ ...connection, points: routes.get(connection.id), labelPosition: labels.get(connection.id), routeRevision: revision })),
    },
  }
}

export function applyLayoutIfCurrent(current: Diagram, result: LayoutResult, revision: number): Diagram {
  return result.revision === revision ? result.diagram : current
}