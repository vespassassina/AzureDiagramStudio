import { absolutePosition, invalidateRoutes, measureEntity } from '../model.ts'
import type { ConnectionSide, Diagram, Entity, Point } from '../model.ts'
import type { ClipboardFragment, DocumentCommand } from '../contracts.ts'
import { isSelectableIcon, selectionLibrary } from '../catalog/presentation.ts'

export type Tool = 'select' | 'pan' | 'component' | 'connector' | 'boundary' | 'text' | 'rectangle'
export type LibraryItem = { icon: string; label: string; subtitle: string; color: string }
export const libraryItems: readonly LibraryItem[] = selectionLibrary
export const DROP_TYPE = 'application/diagrammer'
export const sides: ConnectionSide[] = ['auto', 'top', 'right', 'bottom', 'left']
export const snap = (value: number) => Math.round(value / 8) * 8

export function readDrop(source: string): LibraryItem | null {
  try {
    const input: unknown = JSON.parse(source)
    if (!input || typeof input !== 'object' || !('icon' in input) || typeof input.icon !== 'string') return null
    if (!isSelectableIcon(input.icon)) return null
    return libraryItems.find(item => item.icon === input.icon) ?? null
  } catch { return null }
}

export function makeEntity(kind: Entity['kind'], point: Point, id: string, item: LibraryItem): Entity {
  const entity: Entity = { id, kind, parentId: null, layer: 'foreground', status: undefined, label: kind === 'component' ? item.label : kind === 'boundary' ? 'Service boundary' : kind === 'text' ? 'Architecture note' : 'Region', subtitle: kind === 'component' ? item.subtitle : '', icon: kind === 'component' ? item.icon : undefined, color: kind === 'component' ? item.color : 'teal', x: snap(point.x), y: snap(point.y), width: kind === 'boundary' ? 360 : kind === 'text' ? 400 : 220, height: kind === 'boundary' ? 260 : kind === 'text' ? 40 : 88 }
  return { ...entity, ...measureEntity(entity) }
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

export function movePositions(document: Diagram, moved: { id: string; position: Point }[]) {
  return selectionRoots(document, moved.map(node => node.id)).map(entity => {
    const node = moved.find(candidate => candidate.id === entity.id)!
    return { id: entity.id, x: snap(node.position.x), y: snap(node.position.y) }
  })
}

export function nudgeCommand(document: Diagram, ids: string[], key: string, shift: boolean): DocumentCommand | null {
  const delta: Record<string, Point> = { ArrowLeft: { x: -1, y: 0 }, ArrowRight: { x: 1, y: 0 }, ArrowUp: { x: 0, y: -1 }, ArrowDown: { x: 0, y: 1 } }
  if (!delta[key]) return null
  const amount = shift ? 64 : 8
  const positions = selectionRoots(document, ids).map(entity => ({ id: entity.id, x: snap(entity.x + delta[key].x * amount), y: snap(entity.y + delta[key].y * amount) }))
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
  const x = snap(Math.min(...points.map(point => point.x)) - 24)
  const y = snap(Math.min(...points.map(point => point.y)) - 56)
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