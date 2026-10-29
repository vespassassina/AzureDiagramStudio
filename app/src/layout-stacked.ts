import type { ELK, ElkNode } from 'elkjs'
import { absolutePosition, entityTextGeometry, measureEntity } from './model.ts'
import type { Diagram, Entity } from './model.ts'
import type { LayoutResult } from './layout.ts'

type Module = { width: number; height: number; entities: Entity[] }

// Algorithm:
// 1. Measure nested boundaries bottom-up as opaque modules.
// 2. Ask ELK to place an ordered chain of the real units on a shared axis.
// 3. Fit each envelope to the real child hull and measured header, not to
//    discarded proxy terminals, provisional paths or their provisional labels.
// 4. Reverse only the root axis; keep annotations absolute. The canonical
//    router subsequently owns all actual connections against this final hull.
export async function computeStackedLayout(diagram: Diagram, direction: Diagram['direction'], revision: number, engine: ELK): Promise<LayoutResult> {
  const structured = diagram.entities.filter(entity => entity.kind === 'component' || entity.kind === 'boundary')
  const used = new Set([...diagram.entities, ...diagram.connections].map(item => item.id))
  const unique = (seed: string) => {
    while (used.has(seed)) seed += '-layout'
    used.add(seed)
    return seed
  }
  const modules = new Map<string, Module>()

  async function level(parent?: Entity): Promise<Module> {
    const units = structured.filter(entity => (entity.parentId ?? undefined) === parent?.id)
    for (const unit of units.filter(entity => entity.kind === 'boundary')) modules.set(unit.id, await level(unit))
    const flow = parent ? direction : direction === 'RIGHT' ? 'DOWN' : 'RIGHT'
    const input: ElkNode = {
      id: unique('stack-module'),
      layoutOptions: {
        'elk.algorithm': 'layered', 'elk.direction': flow,
        'elk.edgeRouting': 'ORTHOGONAL', 'elk.partitioning.activate': 'true',
        'elk.layered.nodePlacement.strategy': 'INTERACTIVE',
        'elk.layered.interactiveReferencePoint': 'TOP_LEFT',
        'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
        'elk.separateConnectedComponents': 'false',
        'elk.spacing.nodeNode': '40', 'elk.layered.spacing.nodeNodeBetweenLayers': '100',
        'elk.spacing.edgeEdge': '20', 'elk.layered.spacing.edgeNodeBetweenLayers': '32',
        'elk.padding': '[top=24,left=24,bottom=24,right=24]',
      },
      children: units.map((entity, index) => {
        const contents = modules.get(entity.id)
        return {
          id: entity.id, x: 0, y: 0,
          ...(contents ? { width: contents.width, height: contents.height } : measureEntity(entity)),
          layoutOptions: { 'elk.partitioning.partition': String(index) },
        }
      }),
      // These placement-only links express document order, including disconnected
      // units. Actual endpoint/label routing must not inflate placement with
      // temporary edge nodes; it belongs to routeFixedGeometry after this stage.
      edges: units.slice(1).map((unit, index) => ({
        id: unique('stack-order'), sources: [units[index].id], targets: [unit.id],
      })),
    }
    const graph = await engine.layout(input)
    const placed = new Map((graph.children ?? []).map(node => [node.id, node]))
    const intrinsic = parent ? entityTextGeometry({ ...parent, width: 368 }) : undefined
    const minWidth = intrinsic ? Math.max(180, ...intrinsic.labelLines.map(line => line.length * 8 + 48), ...intrinsic.subtitleLines.map(line => line.length * 7 + 48)) : 0
    // Keep a usable 24px corridor below the reserved header band: explicit top
    // ports cannot leave a component that touches that band's bottom edge.
    const header = parent ? Math.max(58, entityTextGeometry({ ...parent, width: minWidth }).textBottom + 18) + 24 : 24
    const nodes = [...placed.values()]
    const x = nodes.length ? Math.min(...nodes.map(node => node.x!)) - 24 : 0
    const y = nodes.length ? Math.min(...nodes.map(node => node.y!)) - header : 0
    const width = Math.max(minWidth, ...nodes.map(node => node.x! + node.width! + 24 - x), 180)
    const height = Math.max(header + 24, ...nodes.map(node => node.y! + node.height! + 24 - y))
    const entities = units.flatMap(unit => {
      const node = placed.get(unit.id)!
      return [
        { ...unit, x: node.x! - x, y: node.y! - y, width: node.width!, height: node.height! },
        ...(modules.get(unit.id)?.entities ?? []),
      ]
    })
    return { width, height, entities }
  }
  const root = await level()
  const geometry = new Map(root.entities.map(entity => [entity.id, entity]))
  const result = { ...diagram, direction, revision, entities: diagram.entities.map(entity => geometry.get(entity.id) ?? entity) }
  result.entities = result.entities.map(entity => {
    if (geometry.has(entity.id) || !entity.parentId) return entity
    const before = absolutePosition(diagram, entity.id)
    const parent = absolutePosition(result, entity.parentId)
    return { ...entity, x: before.x - parent.x, y: before.y - parent.y }
  })
  return {
    revision,
    diagram: {
      ...result,
      connections: diagram.connections.map(({ points: _points, labelPosition: _label, routeRevision: _revision, ...edge }) => ({ ...edge, routeRevision: revision })),
    },
  }
}
