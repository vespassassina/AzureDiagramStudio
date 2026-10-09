import { createDocument, measureEntity, sampleDiagram } from './model.ts'
import type { Diagram, Entity } from './model.ts'

export const QUALITY_FIXTURE_IDS = ['blank-v1', 'three-tier-v1', 'azure-integration-v1', 'nested-cross-links-v1', 'annotations-v1', 'stress-v1'] as const

function syntheticDocument(id: string, title: string): Diagram {
  return { ...createDocument(id, title), synthetic: true }
}

function threeTier(): Diagram {
  const document = syntheticDocument('three-tier-v1', 'Three-tier application')
  const components: Entity[] = ['frontend', 'api', 'worker', 'queue', 'orders', 'media', 'cache', 'audit'].map((id, index) => ({
    id, kind: 'component', parentId: index < 4 ? 'application' : 'data', layer: 'foreground',
    label: id, icon: ['service', 'api', 'function', 'queue', 'database', 'storage', 'database', 'storage'][index],
    color: index < 4 ? 'teal' : 'azure', x: 24 + (index % 2) * 260, y: 72 + Math.floor((index % 4) / 2) * 160, width: 220, height: 88,
  }))
  document.entities = [
    { id: 'application', kind: 'boundary', parentId: null, layer: 'foreground', label: 'Application', color: 'teal', x: 0, y: 0, width: 540, height: 368 },
    { id: 'data', kind: 'boundary', parentId: null, layer: 'foreground', label: 'Data', color: 'azure', x: 660, y: 0, width: 540, height: 368 },
    ...components,
  ]
  document.connections = [['frontend', 'api'], ['api', 'worker'], ['worker', 'queue'], ['api', 'orders'], ['worker', 'media'], ['api', 'cache'], ['queue', 'audit'], ['worker', 'orders']].map(([from, to], index) => ({ id: `flow-${index}`, from, to, label: `Flow ${index + 1}`, style: 'solid', arrow: 'forward' }))
  return document
}

export function qualityFixtures(): Diagram[] {
  const blank = syntheticDocument('blank-v1', 'Empty architecture')
  const integration = { ...sampleDiagram(), id: 'azure-integration-v1', title: 'Grouped Azure integration' }
  integration.entities = integration.entities.map(entity => entity.id === 'gateway' ? { ...entity, status: 'not-connected' } : entity)
  const nested = { ...sampleDiagram(), id: 'nested-cross-links-v1', title: 'Nested boundaries and long labels' }
  nested.entities = nested.entities.map(entity => {
    if (entity.id === 'app') return { ...entity, y: 396 }
    if (entity.id === 'application') return { ...entity, height: 536 }
    if (entity.id === 'platform') return { ...entity, height: 636 }
    if (entity.id === 'note') return { ...entity, y: 748 }
    if (entity.id !== 'gateway') return entity
    const updated = { ...entity, label: 'UnbrokenArchitectureComponentName'.repeat(3), subtitle: 'Gateway ownership and event delivery '.repeat(3) }
    return { ...updated, ...measureEntity(updated) }
  })
  const annotations = syntheticDocument('annotations-v1', 'Annotations and negative coordinates')
  annotations.entities = [
    { id: 'region', kind: 'rectangle', parentId: null, layer: 'background', label: 'Ownership region', color: '#117865', x: -80, y: -40, width: 520, height: 360 },
    { id: 'note', kind: 'text', parentId: null, layer: 'foreground', label: 'Architecture note\nRetain complete plain text. '.repeat(16), color: 'source', x: -24, y: 24, width: 400, height: 40 },
  ].map(entity => ({ ...entity, ...measureEntity(entity as Entity) })) as Entity[]
  const stress = syntheticDocument('stress-v1', 'Stress graph: 100 entities and 150 connections')
  stress.entities = Array.from({ length: 100 }, (_, index) => ({ id: `node-${index}`, kind: 'component', parentId: null, layer: 'foreground', label: `Service ${index}`, icon: 'service', color: index % 2 ? 'teal' : 'azure', x: (index % 10) * 260, y: Math.floor(index / 10) * 128, width: 220, height: 88 }))
  stress.connections = Array.from({ length: 150 }, (_, index) => ({ id: `edge-${index}`, from: `node-${index % 100}`, to: `node-${(index % 100 + 1 + Math.floor(index / 100)) % 100}`, label: '', style: 'solid', arrow: 'forward' }))
  return [blank, threeTier(), integration, nested, annotations, stress]
}