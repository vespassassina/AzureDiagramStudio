import { absolutePosition, entityTextGeometry, invalidateRoutes, measureEntity } from '../model.ts'
import type { ConnectionSide, Diagram, Entity, Point } from '../model.ts'
import type { ClipboardFragment, DocumentCommand } from '../contracts.ts'
import { isSelectableIcon, selectionLibrary } from '../catalog/presentation.ts'
import { effectiveGrid, gridParentOrigin, snapLocalPoint, snapPoint } from '../grid.ts'
import type { Grid } from '../model.ts'
import { applyCommand } from '../document/index.ts'

export type Tool = 'select' | 'pan' | 'component' | 'connector' | 'boundary' | 'text' | 'rectangle'
export type LibraryItem = { icon: string; label: string; subtitle: string; color: string }
export const libraryItems: readonly LibraryItem[] = selectionLibrary
export const DROP_TYPE = 'application/diagrammer'
export const sides: ConnectionSide[] = ['auto', 'top', 'right', 'bottom', 'left']
export const snap = (value: number, grid?: Grid) => snapPoint({ x: value, y: 0 }, grid).x

export function readDrop(source: string): LibraryItem | null {
  try {
    const input: unknown = JSON.parse(source)
    if (!input || typeof input !== 'object' || !('icon' in input) || typeof input.icon !== 'string') return null
    if (!isSelectableIcon(input.icon)) return null
    return libraryItems.find(item => item.icon === input.icon) ?? null
  } catch { return null }
}

export function makeEntity(kind: Entity['kind'], point: Point, id: string, item: LibraryItem, grid?: Grid): Entity {
  const entity: Entity = { id, kind, parentId: null, layer: 'foreground', status: undefined, label: kind === 'component' ? item.label : kind === 'boundary' ? 'Service boundary' : kind === 'text' ? 'Architecture note' : 'Region', subtitle: kind === 'component' ? item.subtitle : '', icon: kind === 'component' ? item.icon : undefined, color: kind === 'component' ? item.color : 'teal', ...snapPoint(point, grid), width: kind === 'boundary' ? 360 : kind === 'text' ? 400 : 220, height: kind === 'boundary' ? 260 : kind === 'text' ? 40 : 88 }
  return { ...entity, ...measureEntity(entity) }
}

export type AddSide = Exclude<ConnectionSide, 'auto'>

export function addConnectedCommand(document: Diagram, sourceId: string, side: AddSide, item: LibraryItem, entityId: string, connectionId: string): Extract<DocumentCommand, { type: 'addConnected' }> | null {
  const source = document.entities.find(entity => entity.id === sourceId)
  if (!source || (source.kind !== 'component' && source.kind !== 'boundary')) return null
  const entity = makeEntity('component', { x: 0, y: 0 }, entityId, item, document.grid)
  const origin = absolutePosition(document, sourceId)
  const parentId = source.kind === 'boundary' ? source.id : source.parentId ?? null
  const parent = gridParentOrigin(document, parentId)
  const centered = { x: origin.x + (source.width - entity.width) / 2, y: origin.y + (source.height - entity.height) / 2 }
  const point = source.kind === 'boundary' ? { x: origin.x + 24, y: origin.y + entityTextGeometry(source).textBottom + 24 } : {
    left: { x: origin.x - entity.width - 64, y: centered.y },
    right: { x: origin.x + source.width + 64, y: centered.y },
    top: { x: centered.x, y: origin.y - entity.height - 64 },
    bottom: { x: centered.x, y: origin.y + source.height + 64 },
  }[side]
  const aligned = snapPoint(point, document.grid)
  const grid = effectiveGrid(document.grid)
  if (source.kind === 'boundary' && grid.snap) {
    aligned.x = Math.max(aligned.x, Math.ceil(point.x / grid.spacing) * grid.spacing)
    aligned.y = Math.max(aligned.y, Math.ceil(point.y / grid.spacing) * grid.spacing)
  }
  Object.assign(entity, { parentId, x: aligned.x - parent.x, y: aligned.y - parent.y })
  if (!canConnect({ ...document, entities: [...document.entities, entity] }, sourceId, entityId)) return null
  const opposite: Record<AddSide, AddSide> = { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }
  return { type: 'addConnected', sourceId, entity, connection: { id: connectionId, from: sourceId, to: entityId, label: '', style: 'solid', arrow: 'forward', sourceSide: side, targetSide: opposite[side] } }
}

function ancestors(document: Diagram, id: string): string[] {
  const result: string[] = []
  let parent = document.entities.find(entity => entity.id === id)?.parentId
  while (parent && !result.includes(parent)) {
    result.push(parent)
    parent = document.entities.find(entity => entity.id === parent)?.parentId
  }
  return result
}

/** Keep only moved roots: React Flow also reports selected descendants of a dragged group. */
export function selectionRoots(document: Diagram, ids: string[]): Entity[] {
  const selected = new Set(ids)
  return document.entities.filter(entity => selected.has(entity.id) && !ancestors(document, entity.id).some(parent => selected.has(parent)))
}

export type AlignmentAction = 'align-left' | 'align-center' | 'align-top' | 'distribute-horizontal' | 'distribute-vertical'

function preservesAlignmentMove(document: Diagram, positions: { id: string; x: number; y: number }[]): boolean {
  try {
    const baseline = applyCommand(structuredClone(document), { type: 'metadata', patch: {} })
    const moved = applyCommand(structuredClone(document), { type: 'move', positions })
    const targets = new Map(positions.map(position => [position.id, position]))
    if (moved.entities.length !== baseline.entities.length || moved.connections.length !== baseline.connections.length) return false
    if (!moved.entities.every((entity, index) => {
      const original = baseline.entities[index]
      const target = targets.get(entity.id)
      if (!original || original.id !== entity.id) return false
      return target ? JSON.stringify(entity) === JSON.stringify({ ...original, x: target.x, y: target.y }) : JSON.stringify(entity) === JSON.stringify(original)
    })) return false
    return moved.connections.every((connection, index) => {
      const original = baseline.connections[index]
      if (!original || original.id !== connection.id) return false
      const { points: _points, routeRevision: _routeRevision, labelPosition: _labelPosition, ...semantic } = connection
      const { points: _originalPoints, routeRevision: _originalRouteRevision, labelPosition: _originalLabelPosition, ...originalSemantic } = original
      return JSON.stringify(semantic) === JSON.stringify(originalSemantic)
    })
  } catch { return false }
}

export function alignmentPositions(document: Diagram, ids: string[], action: AlignmentAction): { id: string; x: number; y: number }[] | null {
  if (new Set(ids).size !== ids.length || !ids.every(id => document.entities.some(entity => entity.id === id))) return null
  const roots = selectionRoots(document, ids)
  const distributing = action === 'distribute-horizontal' || action === 'distribute-vertical'
  if (roots.length < (distributing ? 3 : 2) || !roots.every(root => (root.parentId ?? null) === (roots[0].parentId ?? null))) return null

  const absolute = roots.map((entity, index) => ({ entity, index, point: absolutePosition(document, entity.id) }))
  const parentOrigin = (entity: Entity) => entity.parentId ? absolutePosition(document, entity.parentId) : { x: 0, y: 0 }
  const local = (entity: Entity, point: Point) => {
    const parent = parentOrigin(entity)
    return { id: entity.id, x: point.x - parent.x, y: point.y - parent.y }
  }
  const fits = (positions: { id: string; x: number; y: number }[]) => positions.every(position => {
    const entity = document.entities.find(candidate => candidate.id === position.id)!
    const parent = entity.parentId ? document.entities.find(candidate => candidate.id === entity.parentId) : null
    return !parent || (position.x >= 24 && position.y >= entityTextGeometry(parent).textBottom + 24 && position.x + entity.width <= parent.width - 24 && position.y + entity.height <= parent.height - 24)
  })
  const changed = (positions: { id: string; x: number; y: number }[]) => positions.some(position => {
    const entity = document.entities.find(candidate => candidate.id === position.id)!
    return entity.x !== position.x || entity.y !== position.y
  })

  if (!distributing) {
    const reference = absolute[0]
    const positions = absolute.map(item => local(item.entity, {
      x: action === 'align-left' ? reference.point.x : action === 'align-center' ? reference.point.x + reference.entity.width / 2 - item.entity.width / 2 : item.point.x,
      y: action === 'align-top' ? reference.point.y : item.point.y,
    }))
    return fits(positions) && changed(positions) && preservesAlignmentMove(document, positions) ? positions : null
  }

  const horizontal = action === 'distribute-horizontal'
  const sorted = [...absolute].sort((before, after) => {
    const delta = (horizontal ? before.point.x : before.point.y) - (horizontal ? after.point.x : after.point.y)
    return delta || before.index - after.index
  })
  const first = sorted[0], last = sorted[sorted.length - 1]
  const firstLeading = horizontal ? first.point.x : first.point.y
  const lastTrailing = horizontal ? last.point.x + last.entity.width : last.point.y + last.entity.height
  const totalSize = sorted.reduce((sum, item) => sum + (horizontal ? item.entity.width : item.entity.height), 0)
  const gap = (lastTrailing - firstLeading - totalSize) / (sorted.length - 1)
  if (!Number.isFinite(gap) || gap < 0) return null
  let cursor = firstLeading
  const positions = sorted.map(item => {
    const point = horizontal ? { x: cursor, y: item.point.y } : { x: item.point.x, y: cursor }
    cursor += (horizontal ? item.entity.width : item.entity.height) + gap
    return local(item.entity, point)
  }).sort((before, after) => roots.findIndex(root => root.id === before.id) - roots.findIndex(root => root.id === after.id))
  return fits(positions) && changed(positions) && preservesAlignmentMove(document, positions) ? positions : null
}

export function movePositions(document: Diagram, moved: { id: string; position: Point }[]) {
  const roots = selectionRoots(document, moved.map(node => node.id))
  const anchor = roots[0]
  const position = moved.find(node => node.id === anchor?.id)?.position
  const aligned = anchor && position ? snapLocalPoint(document, anchor.parentId, position) : { x: 0, y: 0 }
  const delta = anchor && position ? { x: aligned.x - anchor.x, y: aligned.y - anchor.y } : { x: 0, y: 0 }
  return roots.map(entity => {
    return { id: entity.id, x: entity.x + delta.x, y: entity.y + delta.y }
  })
}

export function nudgeCommand(document: Diagram, ids: string[], key: string, shift: boolean): DocumentCommand | null {
  const delta: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
  if (!delta[key]) return null
  const grid = effectiveGrid(document.grid)
  const amount = grid.snap ? grid.spacing * (shift ? 4 : 1) : shift ? 64 : 8
  const positions = movePositions(document, selectionRoots(document, ids).map(entity => ({ id: entity.id, position: { x: entity.x + delta[key].x * amount, y: entity.y + delta[key].y * amount } })))
  return positions.length ? { type: 'move', positions } : null
}

/** Capture, detach excluded parents in absolute space, and retain only internal edges. No callbacks or store. */
export function captureFragment(document: Diagram, ids: string[]): ClipboardFragment {
  const selected = new Set(ids)
  const included = document.entities.filter(entity => selected.has(entity.id) || ancestors(document, entity.id).some(parent => selected.has(parent)))
  const includedIds = new Set(included.map(entity => entity.id))
  const points = included.map(entity => absolutePosition(document, entity.id))
  return structuredClone({ entities: included.map(entity => entity.parentId && includedIds.has(entity.parentId) ? entity : { ...entity, parentId: null, ...absolutePosition(document, entity.id) }), connections: document.connections.filter(connection => includedIds.has(connection.from) && includedIds.has(connection.to)), origin: { x: points.length ? Math.min(...points.map(point => point.x)) : 0, y: points.length ? Math.min(...points.map(point => point.y)) : 0 } })
}

export function freshIdMap(fragment: ClipboardFragment, nextId: () => string): Record<string, string> {
  return Object.fromEntries([...fragment.entities, ...fragment.connections].map(item => [item.id, nextId()]))
}

export function minimumSize(document: Diagram, entity: Entity) {
  const own = measureEntity({ ...entity, width: 180, height: entity.kind === 'component' ? 88 : entity.kind === 'boundary' ? 80 : 40 })
  const children = document.entities.filter(child => child.parentId === entity.id)
  return { width: Math.max(own.width, ...children.map(child => child.x + measureEntity(child).width + 24)), height: Math.max(own.height, ...children.map(child => child.y + measureEntity(child).height + 24)) }
}

export function resizeCommand(document: Diagram, entity: Entity, geometry: Point & { width: number; height: number }): Extract<DocumentCommand, { type: 'resize' }> {
  const origin = gridParentOrigin(document, entity.parentId)
  const opposite = snapPoint({ x: origin.x + entity.x + geometry.width, y: origin.y + entity.y + geometry.height }, document.grid)
  const minimum = minimumSize(document, entity)
  return { type: 'resize', id: entity.id, width: Math.max(minimum.width, opposite.x - origin.x - entity.x), height: Math.max(minimum.height, opposite.y - origin.y - entity.y) }
}

export function parentChoices(document: Diagram, ids: string[]): Entity[] {
  const roots = selectionRoots(document, ids)
  const contained = new Set(document.entities.filter(entity => ids.includes(entity.id) || ancestors(document, entity.id).some(parent => ids.includes(parent))).map(entity => entity.id))
  const boundaryHeight = (root: Entity) => Math.max(root.kind === 'boundary' ? 1 : 0, ...document.entities.filter(entity => entity.kind === 'boundary' && ancestors(document, entity.id).includes(root.id)).map(entity => ancestors(document, entity.id).indexOf(root.id) + 2))
  return document.entities.filter(parent => parent.kind === 'boundary' && !contained.has(parent.id) && roots.every(root => ancestors(document, parent.id).length + 1 + boundaryHeight(root) <= 2))
}

export function groupCommand(document: Diagram, ids: string[], id: string): DocumentCommand | null {
  const roots = selectionRoots(document, ids)
  if (!roots.length) return null
  const points = roots.map(entity => ({ ...absolutePosition(document, entity.id), ...measureEntity(entity) }))
  const sharedParent = roots.every(entity => (entity.parentId ?? null) === (roots[0].parentId ?? null)) ? roots[0].parentId ?? null : null
  const parent = sharedParent ? absolutePosition(document, sharedParent) : { x: 0, y: 0 }
  const x = snap(Math.min(...points.map(point => point.x)) - 24, document.grid)
  const y = snap(Math.min(...points.map(point => point.y)) - 56, document.grid)
  return { type: 'group', ids: roots.map(entity => entity.id), boundary: { id, kind: 'boundary', label: 'Service boundary', color: 'teal', layer: 'foreground', parentId: sharedParent, x: x - parent.x, y: y - parent.y, width: Math.max(180, Math.max(...points.map(point => point.x + point.width)) - x + 24), height: Math.max(80, Math.max(...points.map(point => point.y + point.height)) - y + 24) } }
}

/** Draft projection is deliberately limited to previews; domain commands remain authoritative. */
export function previewDocument(document: Diagram, command: DocumentCommand): Diagram {
  let draft = document
  if (command.type === 'metadata') draft = { ...document, ...command.patch }
  if (command.type === 'updateConnection') draft = { ...document, connections: document.connections.map(connection => connection.id === command.id ? { ...connection, ...command.patch } : connection) }
  if (command.type === 'updateEntity') draft = { ...document, entities: document.entities.map(entity => {
    if (entity.id !== command.id) return entity
    const updated = { ...entity, ...command.patch }
    return { ...updated, ...measureEntity(updated) }
  }) }
  if (command.type === 'move') draft = { ...document, entities: document.entities.map(entity => {
    const point = command.positions.find(position => position.id === entity.id)
    return point ? { ...entity, x: point.x, y: point.y } : entity
  }) }
  if (command.type === 'resize') draft = { ...document, entities: document.entities.map(entity => entity.id === command.id ? { ...entity, width: command.width, height: command.height } : entity) }
  return invalidateRoutes(draft)
}

export function canConnect(document: Diagram, from: string | null, to: string | null): boolean {
  return !!from && !!to && from !== to && [from, to].every(id => document.entities.some(entity => entity.id === id && ['component', 'boundary'].includes(entity.kind)))
}

export function sideAtPoint(document: Diagram, id: string, point: Point): Exclude<ConnectionSide, 'auto'> {
  const entity = document.entities.find(candidate => candidate.id === id)!
  const absolute = absolutePosition(document, id)
  const distances = { left: Math.abs(point.x - absolute.x), right: Math.abs(point.x - absolute.x - entity.width), top: Math.abs(point.y - absolute.y), bottom: Math.abs(point.y - absolute.y - entity.height) }
  return (Object.keys(distances) as Exclude<ConnectionSide, 'auto'>[]).sort((before, after) => distances[before] - distances[after])[0]
}