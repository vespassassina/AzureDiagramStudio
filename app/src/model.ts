import type { CustomIcon } from './custom-icons/contract.ts'
export type { CustomIcon } from './custom-icons/contract.ts'

export type Point = { x: number; y: number }
export type Direction = 'RIGHT' | 'DOWN'
export type Layer = 'foreground' | 'background'
export type Status = 'live' | 'planned' | 'not-connected' | 'synthetic'
export type ConnectionSide = 'auto' | 'top' | 'right' | 'bottom' | 'left'
export type LegendEntry = { label: string; color: string; dashed?: boolean }
export type Grid = { visible: boolean; style: 'dots' | 'lines'; spacing: number; snap: boolean; present: boolean; export: boolean }
export type Entity = {
  id: string
  kind: 'component' | 'boundary' | 'text' | 'rectangle'
  label: string
  subtitle?: string
  parentId?: string | null
  layer?: Layer
  order?: number
  x: number
  y: number
  width: number
  height: number
  color: string
  icon?: string
  customIcon?: CustomIcon
  status?: Status
}
export type Connection = {
  id: string
  from: string
  to: string
  label: string
  style: 'solid' | 'dashed'
  arrow: 'forward' | 'both' | 'none'
  sourceSide?: ConnectionSide
  targetSide?: ConnectionSide
  routeRevision?: number
  labelPosition?: Point
  points?: Point[]
}
export type Diagram = {
  schemaVersion: 1
  id: string
  title: string
  subtitle: string
  description?: string
  backgroundColor?: string
  grid?: Grid
  synthetic: boolean
  legendVisible: boolean
  legend: LegendEntry[]
  revision: number
  direction: Direction
  entities: Entity[]
  connections: Connection[]
}
export type History = { past: Diagram[]; present: Diagram; future: Diagram[] }

export function createDocument(id: string, title = 'Untitled architecture'): Diagram {
  return { schemaVersion: 1, id, title, subtitle: '', synthetic: false, legendVisible: true, legend: [], revision: 0, direction: 'RIGHT', entities: [], connections: [] }
}

export function wrapText(text: string, limit: number): string[] {
  if (!Number.isInteger(limit) || limit < 1) throw new Error('Text wrap limit must be a positive integer')
  return text.split(/\r?\n/).flatMap(paragraph => {
    const lines: string[] = []
    let current = ''
    for (const word of paragraph.split(/\s+/)) {
      let remaining = word
      while (remaining.length > limit) {
        if (current) { lines.push(current); current = '' }
        lines.push(remaining.slice(0, limit))
        remaining = remaining.slice(limit)
      }
      if (current && current.length + remaining.length + 1 > limit) { lines.push(current); current = '' }
      current = current ? `${current} ${remaining}` : remaining
    }
    if (current || !lines.length) lines.push(current)
    return lines
  })
}

export function entityTextGeometry(entity: Entity) {
  const component = entity.kind === 'component'
  const inset = component ? 62 : entity.kind === 'boundary' ? 32 : entity.kind === 'rectangle' ? 14 : 0
  const width = Math.max(component ? 220 : 180, entity.width)
  const labelY = entity.kind === 'text' ? 18 : entity.kind === 'rectangle' ? 28 : component ? 32 : 29
  const available = width - inset - (component ? 16 : entity.kind === 'boundary' ? 16 : inset)
  const labelLines = wrapText(entity.label, Math.max(1, Math.min(component ? 22 : 40, Math.floor(available / 8))))
  const subtitleLines = entity.subtitle ? wrapText(entity.subtitle, Math.max(1, Math.min(component ? 25 : 40, Math.floor(available / 7)))) : []
  const subtitleY = labelY + labelLines.length * 17 + 7
  const textBottom = subtitleLines.length ? subtitleY + (subtitleLines.length - 1) * 15 + 16 : labelY + (labelLines.length - 1) * 17 + 10
  return { width, labelLines, subtitleLines, labelX: inset, labelY, subtitleY, textBottom }
}

export function measureEntity(entity: Entity): { width: number; height: number } {
  const text = entityTextGeometry(entity)
  return { width: text.width, height: Math.max(entity.height, entity.kind === 'component' ? 88 : entity.kind === 'boundary' ? 80 : 40, text.textBottom + (entity.kind === 'boundary' ? 24 : 16)) }
}

export function absolutePosition(diagram: Diagram, id: string): Point {
  let entity = diagram.entities.find(candidate => candidate.id === id)
  if (!entity) throw new Error(`Unknown entity: ${id}`)
  const position = { x: entity.x, y: entity.y }
  const visited = new Set([id])
  while (entity.parentId) {
    if (visited.has(entity.parentId)) throw new Error('Boundary cycle')
    visited.add(entity.parentId)
    entity = diagram.entities.find(candidate => candidate.id === entity?.parentId)
    if (!entity) throw new Error('Unknown parent boundary')
    position.x += entity.x
    position.y += entity.y
  }
  return position
}

export function invalidateRoutes(diagram: Diagram): Diagram {
  return { ...diagram, connections: diagram.connections.map(({ points: _points, routeRevision: _routeRevision, labelPosition: _labelPosition, ...connection }) => connection) }
}

export function moveEntity(diagram: Diagram, id: string, x: number, y: number): Diagram {
  return invalidateRoutes({ ...diagram, entities: diagram.entities.map(entity => entity.id === id ? { ...entity, x, y } : entity) })
}

export function removeEntities(diagram: Diagram, ids: string[]): Diagram {
  const removed = new Set(ids)
  const entities = diagram.entities.filter(entity => !removed.has(entity.id)).map(entity => {
    if (!entity.parentId || !removed.has(entity.parentId)) return entity
    const position = absolutePosition(diagram, entity.id)
    let parentId: string | null | undefined = entity.parentId
    while (parentId && removed.has(parentId)) parentId = diagram.entities.find(candidate => candidate.id === parentId)?.parentId
    const parent = parentId ? absolutePosition(diagram, parentId) : { x: 0, y: 0 }
    return { ...entity, parentId: parentId ?? null, x: position.x - parent.x, y: position.y - parent.y }
  })
  return invalidateRoutes({ ...diagram, entities, connections: diagram.connections.filter(connection => !removed.has(connection.from) && !removed.has(connection.to)) })
}

export function historyCommit(history: History, next: Diagram): History {
  if (JSON.stringify(history.present) === JSON.stringify(next)) return history
  return { past: [...history.past, history.present].slice(-100), present: next, future: [] }
}

export function historyUndo(history: History): History {
  if (!history.past.length) return history
  return { past: history.past.slice(0, -1), present: history.past.at(-1)!, future: [history.present, ...history.future] }
}

export function historyRedo(history: History): History {
  if (!history.future.length) return history
  return { past: [...history.past, history.present], present: history.future[0], future: history.future.slice(1) }
}

export function sampleDiagram(): Diagram {
  return {
    ...createDocument('sample-commerce', 'Commerce platform'), synthetic: true,
    entities: [
      { id: 'platform', kind: 'boundary', label: 'Azure subscription', subtitle: 'Production boundary', x: 340, y: 64, width: 680, height: 476, color: 'azure' },
      { id: 'application', kind: 'boundary', label: 'Application layer', parentId: 'platform', x: 24, y: 72, width: 288, height: 376, color: 'teal' },
      { id: 'data', kind: 'boundary', label: 'Data services', parentId: 'platform', x: 344, y: 72, width: 312, height: 376, color: 'amber' },
      { id: 'users', kind: 'component', label: 'Customers', subtitle: 'Web & mobile', x: 32, y: 220, width: 220, height: 88, color: 'gray', icon: 'user' },
      { id: 'gateway', kind: 'component', label: 'API Management', subtitle: 'Gateway & policies', parentId: 'application', x: 32, y: 64, width: 220, height: 88, color: 'teal', icon: 'azure-api' },
      { id: 'app', kind: 'component', label: 'App Service', subtitle: 'Commerce API', parentId: 'application', x: 32, y: 236, width: 220, height: 88, color: 'azure', icon: 'azure-app' },
      { id: 'sql', kind: 'component', label: 'SQL Database', subtitle: 'Orders & inventory', parentId: 'data', x: 46, y: 64, width: 220, height: 88, color: 'amber', icon: 'azure-sql' },
      { id: 'storage', kind: 'component', label: 'Storage account', subtitle: 'Product media', parentId: 'data', x: 46, y: 236, width: 220, height: 88, color: 'rose', icon: 'azure-storage', status: 'planned' },
      { id: 'note', kind: 'text', label: 'Customer requests stay within the application boundary.', x: 340, y: 588, width: 660, height: 40, color: 'gray' },
    ].map(entity => ({ ...entity, parentId: entity.parentId ?? null, layer: 'foreground' })) as Entity[],
    connections: [
      { id: 'access', from: 'users', to: 'platform', label: 'HTTPS', style: 'solid', arrow: 'forward' },
      { id: 'route', from: 'gateway', to: 'app', label: 'Route', style: 'solid', arrow: 'forward' },
      { id: 'orders', from: 'app', to: 'sql', label: 'Read / write', style: 'solid', arrow: 'forward' },
      { id: 'media', from: 'app', to: 'storage', label: 'Upload', style: 'dashed', arrow: 'forward' },
    ],
  }
}