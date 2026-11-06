import type { ClipboardFragment, DocumentCommand, DomainErrorCode, ValidationIssue } from '../contracts.ts'
import { absolutePosition, entityTextGeometry, invalidateRoutes, measureEntity, removeEntities } from '../model.ts'
import type { Connection, Diagram, Entity, Point } from '../model.ts'
import { inspectJson, isRecord, validateDocument } from './validation.ts'
import { siblingScopes, stackingBand } from '../order.ts'
import { snapPoint } from '../grid.ts'

export class DomainError extends Error {
  name: 'DomainError' = 'DomainError'
  code: DomainErrorCode
  errors: ValidationIssue[]
  constructor(code: DomainErrorCode, errors: ValidationIssue[]) {
    super(errors.map(error => `${error.path}: ${error.message}`).join('; '))
    this.code = code
    this.errors = errors
  }
}

function fail(code: DomainErrorCode, path: string, message: string): never {
  throw new DomainError(code, [{ path, message }])
}
function checked(input: unknown, code: DomainErrorCode = 'invalid-document'): Diagram {
  const result = validateDocument(input)
  if (result.ok) return result.value
  const error = result.errors[0]
  const category = code === 'invalid-document' ? code : error.message.includes('Duplicate ID') ? 'duplicate-id' : error.message.includes('Limit exceeded') ? 'limit-exceeded' : error.path.includes('parentId') ? 'invalid-parent' : /\.(from|to)$/.test(error.path) ? 'invalid-connection' : code
  throw new DomainError(category, result.errors)
}
function getEntity(document: Diagram, id: string): Entity {
  const entity = document.entities.find(entity => entity.id === id)
  if (!entity) fail('unknown-id', 'id', `Unknown entity: ${id}`)
  return entity
}
function getConnection(document: Diagram, id: string): Connection {
  const connection = document.connections.find(connection => connection.id === id)
  if (!connection) fail('unknown-id', 'id', `Unknown connection: ${id}`)
  return connection
}
function ensureFresh(document: Diagram, id: string) {
  if (document.entities.some(entity => entity.id === id) || document.connections.some(connection => connection.id === id)) fail('duplicate-id', 'id', `ID already exists: ${id}`)
}
function idsExist(document: Diagram, ids: string[]): Set<string> {
  if (!Array.isArray(ids)) fail('invalid-command', 'ids', 'Expected an array of entity IDs')
  const selected = new Set(ids)
  if (selected.size !== ids.length) fail('invalid-command', 'ids', 'Selection contains duplicate IDs')
  for (const id of selected) getEntity(document, id)
  return selected
}
function hasSelectedAncestor(document: Diagram, entity: Entity, selected: Set<string>): boolean {
  let parentId = entity.parentId
  while (parentId) {
    if (selected.has(parentId)) return true
    parentId = getEntity(document, parentId).parentId
  }
  return false
}
function roots(document: Diagram, ids: string[]): Entity[] {
  const selected = idsExist(document, ids)
  return document.entities.filter(entity => selected.has(entity.id) && !hasSelectedAncestor(document, entity, selected))
}
function patchFields(patch: unknown, allowed: string[], path = 'patch'): asserts patch is Record<string, unknown> {
  if (!isRecord(patch)) fail('invalid-command', path, 'Expected a plain patch object')
  for (const key of Object.keys(patch)) if (!allowed.includes(key)) fail('invalid-command', `${path}.${key}`, 'Field cannot be changed by this command')
}
function finitePoint(point: Point, path: string) {
  if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) fail('invalid-command', path, 'Expected finite x/y coordinates')
}
function validRoutePoints(points: unknown): asserts points is Point[] {
  if (!Array.isArray(points) || points.length < 2 || points.length > 64) fail('invalid-command', 'points', 'Expected 2 to 64 route points')
  for (let index = 0; index < points.length; index++) {
    finitePoint(points[index], `points[${index}]`)
    if (Math.abs(points[index].x) > 1_000_000 || Math.abs(points[index].y) > 1_000_000) fail('invalid-command', `points[${index}]`, 'Route point is outside the supported canvas bounds')
    if (index && points[index - 1].x !== points[index].x && points[index - 1].y !== points[index].y) fail('invalid-command', `points[${index}]`, 'Route segments must be orthogonal')
  }
}
function growText(entity: Entity) { Object.assign(entity, measureEntity(entity)) }

/** Expand from the affected children upward. Shifting a boundary's origin offsets every child, preserving absolute placement. */
function expandAncestors(document: Diagram, seeds: string[]) {
  const affected = new Set<string>()
  for (const id of seeds) {
    let entity = getEntity(document, id)
    if (entity.kind === 'boundary') affected.add(entity.id)
    while (entity.parentId) {
      affected.add(entity.parentId)
      entity = getEntity(document, entity.parentId)
    }
  }
  const depth = (entity: Entity) => {
    let levels = 0
    while (entity.parentId) { levels++; entity = getEntity(document, entity.parentId) }
    return levels
  }
  const boundaries = document.entities.filter(entity => affected.has(entity.id)).sort((left, right) => depth(right) - depth(left))
  for (const boundary of boundaries) {
    growText(boundary)
    const children = document.entities.filter(entity => entity.parentId === boundary.id)
    if (!children.length) continue
    const top = entityTextGeometry(boundary).textBottom + 24
    const shiftX = Math.min(0, ...children.map(child => child.x - 24))
    const shiftY = Math.min(0, ...children.map(child => child.y - top))
    if (shiftX || shiftY) {
      boundary.x += shiftX
      boundary.y += shiftY
      boundary.width -= shiftX
      boundary.height -= shiftY
      for (const child of children) { child.x -= shiftX; child.y -= shiftY }
    }
    boundary.width = Math.max(boundary.width, ...children.map(child => child.x + child.width + 24))
    boundary.height = Math.max(boundary.height, ...children.map(child => child.y + child.height + 24))
  }
}

function reparent(document: Diagram, ids: string[], parentId: string | null): string[] {
  if (parentId !== null && typeof parentId !== 'string') fail('invalid-parent', 'parentId', 'Expected a boundary ID or null')
  if (parentId !== null && getEntity(document, parentId).kind !== 'boundary') fail('invalid-parent', 'parentId', 'Parent must be a boundary')
  const selected = roots(document, ids)
  const positions = new Map(selected.map(entity => [entity.id, absolutePosition(document, entity.id)]))
  const parent = parentId ? absolutePosition(document, parentId) : { x: 0, y: 0 }
  for (const entity of selected) {
    const position = positions.get(entity.id)!
    entity.parentId = parentId
    entity.x = position.x - parent.x
    entity.y = position.y - parent.y
  }
  // Check cycles/depth before traversing the modified ancestry to expand it.
  checked(document, 'invalid-command')
  return selected.map(entity => entity.id)
}

type BoundaryDropPosition = { id: string; x: number; y: number }
type BoundaryResize = { id: string; x: number; y: number; width: number; height: number }

function boundaryDepth(document: Diagram, entity: Entity): number {
  let depth = 0
  while (entity.parentId) { depth++; entity = getEntity(document, entity.parentId) }
  return depth
}

function boundarySubtreeDepth(document: Diagram, root: Entity): number {
  return Math.max(root.kind === 'boundary' ? 1 : 0, ...document.entities
    .filter(entity => entity.kind === 'boundary' && entity.id !== root.id)
    .filter(entity => {
      let parentId = entity.parentId
      while (parentId) {
        if (parentId === root.id) return true
        parentId = getEntity(document, parentId).parentId
      }
      return false
    })
    .map(entity => boundaryDepth(document, entity) - boundaryDepth(document, root) + 1))
}

function isStrictlyInside(rect: { x: number; y: number; width: number; height: number }, boundary: { x: number; y: number; width: number; height: number }) {
  return rect.x > boundary.x && rect.y > boundary.y && rect.x + rect.width < boundary.x + boundary.width && rect.y + rect.height < boundary.y + boundary.height
}

function isFullyOutside(rect: { x: number; y: number; width: number; height: number }, boundary: { x: number; y: number; width: number; height: number }) {
  return rect.x > boundary.x + boundary.width || rect.x + rect.width < boundary.x || rect.y > boundary.y + boundary.height || rect.y + rect.height < boundary.y
}

function finalizeBoundaryGeometry(draft: Diagram, grow: string[]): Diagram {
  draft = checked(draft, 'invalid-command')
  if (grow.length) expandAncestors(draft, grow)
  draft = invalidateRoutes(draft)
  draft.revision++
  return checked(draft, 'invalid-command')
}

/**
 * Apply the editor-only release decision after a pointer drag.
 * The operation deliberately is not a DocumentCommand: automatic membership
 * belongs only to the canvas gesture and must not alter programmatic moves.
 */
export function applyBoundaryDrop(document: Diagram, positions: BoundaryDropPosition[]): Diagram {
  const source = checked(document)
  let draft = checked(source)
  if (!Array.isArray(positions) || !positions.length) fail('invalid-command', 'positions', 'Expected one or more dropped entity positions')
  const selected = idsExist(draft, positions.map(position => position.id))
  for (const position of positions) finitePoint(position, 'positions')
  const rootsToDrop = draft.entities.filter(entity => selected.has(entity.id) && !hasSelectedAncestor(draft, entity, selected))
  if (!rootsToDrop.length) return document

  const sourceBoundaries = document.entities
    .map((entity, index) => entity.kind === 'boundary' ? { entity, index, ...absolutePosition(document, entity.id) } : null)
    .filter((entry): entry is { entity: Entity; index: number; x: number; y: number } => entry !== null)
  const sourceBounds = new Map(sourceBoundaries.map(entry => [entry.entity.id, { x: entry.x, y: entry.y, width: entry.entity.width, height: entry.entity.height }]))
  const selectedTree = new Set<string>()
  for (const root of rootsToDrop) {
    selectedTree.add(root.id)
    for (const entity of draft.entities) if (hasSelectedAncestor(draft, entity, new Set([root.id]))) selectedTree.add(entity.id)
  }

  for (const root of rootsToDrop) {
    const position = positions.find(candidate => candidate.id === root.id)
    if (position) Object.assign(root, { x: position.x, y: position.y })
  }

  const grow: string[] = []
  for (const root of rootsToDrop) {
    const final = absolutePosition(draft, root.id)
    const rect = { ...final, width: root.width, height: root.height }
    const currentParentId = document.entities.find(entity => entity.id === root.id)?.parentId ?? null
    const currentBounds = currentParentId ? sourceBounds.get(currentParentId) : undefined
    if (currentBounds && !isFullyOutside(rect, currentBounds)) {
      if (!isStrictlyInside(rect, currentBounds)) grow.push(root.id)
      continue
    }

    const target = sourceBoundaries
      .filter(candidate => !selectedTree.has(candidate.entity.id))
      .filter(candidate => boundaryDepth(document, candidate.entity) + boundarySubtreeDepth(document, root) <= 2)
      .filter(candidate => isStrictlyInside(rect, { ...candidate, width: candidate.entity.width, height: candidate.entity.height }))
      .sort((left, right) => boundaryDepth(document, right.entity) - boundaryDepth(document, left.entity) || left.index - right.index)[0]
    const parentId = target?.entity.id ?? null
    const parent = parentId ? absolutePosition(draft, parentId) : { x: 0, y: 0 }
    root.parentId = parentId
    root.x = final.x - parent.x
    root.y = final.y - parent.y
  }

  if (JSON.stringify(draft.entities) === JSON.stringify(source.entities)) return document
  return finalizeBoundaryGeometry(draft, grow)
}

/**
 * Resize a boundary from any edge while translating direct children by the
 * inverse origin delta, keeping every descendant fixed in canvas space.
 */
export function applyBoundaryResize(document: Diagram, resize: BoundaryResize): Diagram {
  const source = checked(document)
  let draft = checked(source)
  const boundary = getEntity(draft, resize.id)
  if (boundary.kind !== 'boundary') fail('invalid-command', 'id', 'Only boundaries support origin-preserving resize')
  if (![resize.x, resize.y, resize.width, resize.height].every(Number.isFinite)) fail('invalid-command', 'size', 'Resize requires finite geometry')
  const minimum = measureEntity({ ...boundary, width: resize.width, height: 0 })
  if (resize.width < minimum.width || resize.height < minimum.height) fail('invalid-command', 'size', 'Resize would clip text or use an invalid size')
  const delta = { x: resize.x - boundary.x, y: resize.y - boundary.y }
  const children = draft.entities.filter(entity => entity.parentId === boundary.id)
  for (const child of children) { child.x -= delta.x; child.y -= delta.y }
  Object.assign(boundary, resize)
  if (children.some(child => child.x < 0 || child.y < 0 || child.x + child.width > boundary.width || child.y + child.height > boundary.height)) fail('invalid-command', 'size', 'Resize would clip contained entities')
  if (JSON.stringify(draft.entities) === JSON.stringify(source.entities)) return document
  return finalizeBoundaryGeometry(draft, boundary.parentId ? [boundary.id] : [])
}

export function captureSelection(document: Diagram, ids: string[]): ClipboardFragment {
  const source = checked(document)
  const selected = idsExist(source, ids)
  for (const entity of source.entities) if (hasSelectedAncestor(source, entity, selected)) selected.add(entity.id)
  const entities = source.entities.filter(entity => selected.has(entity.id)).map(entity => {
    if (entity.parentId && selected.has(entity.parentId)) return entity
    return { ...entity, parentId: null, ...absolutePosition(source, entity.id) }
  })
  const positions = entities.map(entity => absolutePosition(source, entity.id))
  const origin = positions.length ? { x: Math.min(...positions.map(point => point.x)), y: Math.min(...positions.map(point => point.y)) } : { x: 0, y: 0 }
  const connections = invalidateRoutes(source).connections.filter(connection => selected.has(connection.from) && selected.has(connection.to))
  return { entities, connections, origin }
}

function paste(document: Diagram, fragment: ClipboardFragment, idMap: Record<string, string>, offset: Point): string[] {
  if (!fragment || !Array.isArray(fragment.entities) || !Array.isArray(fragment.connections)) fail('invalid-command', 'fragment', 'Expected a clipboard fragment')
  finitePoint(fragment.origin, 'fragment.origin')
  finitePoint(offset, 'offset')
  if (!isRecord(idMap)) fail('invalid-command', 'idMap', 'Expected caller-supplied ID mappings')
  const source = checked({ ...document, entities: fragment.entities, connections: invalidateRoutes({ ...document, connections: fragment.connections }).connections }, 'invalid-command')
  const mapped = new Set<string>()
  const newId = (id: string): string => {
    if (!Object.hasOwn(idMap, id)) fail('invalid-command', `idMap.${id}`, 'Missing fresh ID mapping')
    const next = idMap[id]
    ensureFresh(document, next)
    if (mapped.has(next)) fail('duplicate-id', `idMap.${id}`, 'ID mappings must be unique')
    mapped.add(next)
    return next
  }
  const remap = new Map([...source.entities, ...source.connections].map(item => [item.id, newId(item.id)]))
  const rootEntities = source.entities.filter(entity => !entity.parentId)
  const origin = rootEntities.length ? { x: Math.min(...rootEntities.map(entity => entity.x)), y: Math.min(...rootEntities.map(entity => entity.y)) } : fragment.origin
  const target = { x: origin.x + offset.x, y: origin.y + offset.y }
  const aligned = snapPoint(target, document.grid)
  const translation = { x: offset.x + aligned.x - target.x, y: offset.y + aligned.y - target.y }
  const entities = source.entities.map(entity => ({ ...entity, id: remap.get(entity.id)!, parentId: entity.parentId ? remap.get(entity.parentId)! : null, ...(entity.parentId ? {} : { x: entity.x + translation.x, y: entity.y + translation.y }) }))
  document.entities.push(...entities)
  document.connections.push(...source.connections.map(connection => ({ ...connection, id: remap.get(connection.id)!, from: remap.get(connection.from)!, to: remap.get(connection.to)! })))
  return entities.map(entity => entity.id)
}

function applyLayout(document: Diagram, command: Extract<DocumentCommand, { type: 'applyLayout' }>): Diagram {
  if (command.expectedRevision !== document.revision || command.result?.revision !== document.revision || command.result?.diagram?.revision !== document.revision) fail('stale-layout', 'expectedRevision', 'Layout snapshot no longer matches the current document revision')
  const result = checked(command.result.diagram, 'invalid-command')
  const semantics = (diagram: Diagram) => ({
    ...diagram, direction: 'RIGHT',
    entities: diagram.entities.map(entity => entity.kind === 'component' || entity.kind === 'boundary' ? { ...entity, x: 0, y: 0, width: 1, height: 1 } : { ...entity, x: 0, y: 0 }),
    connections: invalidateRoutes(diagram).connections,
  })
  if (JSON.stringify(semantics(document)) !== JSON.stringify(semantics(result))) fail('invalid-command', 'result.diagram', 'Layout may change only structured entity geometry, routes and direction; content, annotations and membership must remain unchanged')
  for (const entity of document.entities.filter(entity => entity.kind === 'text' || entity.kind === 'rectangle')) {
    const before = absolutePosition(document, entity.id)
    const after = absolutePosition(result, entity.id)
    if (!(Math.abs(after.x - before.x) <= 1e-6 && Math.abs(after.y - before.y) <= 1e-6)) fail('invalid-command', 'result.diagram', 'Layout must preserve annotation absolute positions')
  }
  return result
}

/** Move selected runs past one unselected neighbor, or partition at an extreme, retaining both internal orders. */
function reorderSiblings(ordered: Entity[], selected: Set<string>, position: NonNullable<Extract<DocumentCommand, { type: 'order' }>['position']>): Entity[] {
  const chosen = ordered.filter(entity => selected.has(entity.id))
  const others = ordered.filter(entity => !selected.has(entity.id))
  if (position === 'top') return [...others, ...chosen]
  if (position === 'bottom') return [...chosen, ...others]
  const next = [...ordered]
  const direction = position === 'forward' ? 1 : -1
  for (let index = direction > 0 ? next.length - 2 : 1; index >= 0 && index < next.length; index -= direction) {
    const neighbor = index + direction
    if (selected.has(next[index].id) && !selected.has(next[neighbor].id)) [next[index], next[neighbor]] = [next[neighbor], next[index]]
  }
  return next
}

/** Validate the snapshot, mutate a detached draft, enforce invariants, then publish exactly one revision. */
export function applyCommand(document: Diagram, command: DocumentCommand): Diagram {
  let draft = checked(document)
  if (!isRecord(command)) fail('invalid-command', 'command', 'Expected a command object')
  const unsafe = inspectJson(command)
  if (unsafe) throw new DomainError('invalid-command', [unsafe])
  let grow: string[] = []
  switch (command.type) {
    case 'addEntity': {
      if (!isRecord(command.entity)) fail('invalid-command', 'entity', 'Expected an entity')
      ensureFresh(draft, command.entity.id)
      draft.entities.push({ ...command.entity })
      draft = checked(draft, 'invalid-command')
      growText(getEntity(draft, command.entity.id))
      grow = [command.entity.id]
      break
    }
    case 'addConnected': {
      if (typeof command.sourceId !== 'string') fail('invalid-command', 'sourceId', 'Expected an existing source ID')
      const source = getEntity(draft, command.sourceId)
      if (source.kind !== 'component' && source.kind !== 'boundary') fail('invalid-connection', 'sourceId', 'Source must be a component or boundary')
      if (!isRecord(command.entity) || command.entity.kind !== 'component') fail('invalid-command', 'entity', 'Add and connect requires a component')
      if (!isRecord(command.connection)) fail('invalid-command', 'connection', 'Expected a connection')
      ensureFresh(draft, command.entity.id)
      ensureFresh(draft, command.connection.id)
      if (command.entity.id === command.connection.id) fail('duplicate-id', 'connection.id', 'Entity and connection IDs must be distinct')
      const parentId = source.kind === 'boundary' ? source.id : source.parentId ?? null
      if ((command.entity.parentId ?? null) !== parentId) fail('invalid-parent', 'entity.parentId', 'New component must share the source parent, or be inside the source boundary')
      if (command.connection.from !== source.id || command.connection.to !== command.entity.id) fail('invalid-connection', 'connection', 'Connection must run from the source to the new component')
      draft.entities.push({ ...command.entity })
      draft.connections.push({ ...command.connection })
      draft = checked(draft, 'invalid-command')
      growText(getEntity(draft, command.entity.id))
      grow = [command.entity.id]
      break
    }
    case 'updateEntity': {
      patchFields(command.patch, ['label', 'subtitle', 'color', 'icon', 'customIcon', 'status'])
      Object.assign(getEntity(draft, command.id), command.patch)
      if (Object.hasOwn(command.patch, 'status') && draft.stateStyles !== undefined) draft.schemaVersion = 2
      draft = checked(draft, 'invalid-command')
      if (Object.hasOwn(command.patch, 'label') || Object.hasOwn(command.patch, 'subtitle')) {
        growText(getEntity(draft, command.id))
        grow = [command.id]
      }
      break
    }
    case 'configureStateStyles': {
      if (!Array.isArray(command.stateStyles)) fail('invalid-command', 'stateStyles', 'Expected a state style array')
      if (command.remap !== undefined && !isRecord(command.remap)) fail('invalid-command', 'remap', 'Expected a plain state replacement map')
      // Undefined is the legacy four-style registry, so making a v2 registry
      // explicit must not silently leave old status references dangling.
      const current = new Set(draft.stateStyles?.map(style => style.id) ?? ['live', 'planned', 'not-connected', 'synthetic'])
      const replacement = new Set(command.stateStyles.map(style => style.id))
      const remap = command.remap ?? {}
      for (const id of current) {
        if (replacement.has(id)) continue
        const users = [...draft.entities, ...draft.connections].filter(item => item.status === id)
        if (!users.length) continue
        if (!Object.hasOwn(remap, id)) fail('invalid-command', `remap.${id}`, 'Removing a used state requires an explicit replacement or null Unset')
        const target = remap[id]
        if (target !== null && (typeof target !== 'string' || !replacement.has(target))) fail('invalid-command', `remap.${id}`, 'Replacement must be a remaining state style ID or null')
        for (const item of users) {
          if (target === null) delete item.status
          else item.status = target
        }
      }
      draft.stateStyles = command.stateStyles.map(style => ({ ...style, ...(style.box ? { box: { ...style.box } } : {}), ...(style.connector ? { connector: { ...style.connector } } : {}) }))
      draft.schemaVersion = 2
      break
    }
    case 'remove': {
      idsExist(draft, command.entityIds)
      if (!Array.isArray(command.connectionIds)) fail('invalid-command', 'connectionIds', 'Expected connection IDs')
      for (const id of command.connectionIds) getConnection(draft, id)
      grow = draft.entities.filter(entity => entity.parentId && command.entityIds.includes(entity.parentId) && !command.entityIds.includes(entity.id)).map(entity => entity.id)
      draft = removeEntities(draft, command.entityIds)
      draft.connections = draft.connections.filter(connection => !command.connectionIds.includes(connection.id))
      break
    }
    case 'move': {
      if (!Array.isArray(command.positions)) fail('invalid-command', 'positions', 'Expected entity positions')
      if (command.positions.some(position => !isRecord(position))) fail('invalid-command', 'positions', 'Expected position objects with id/x/y')
      const selected = idsExist(draft, command.positions.map(position => position.id))
      const candidates = command.positions.filter(position => !hasSelectedAncestor(draft, getEntity(draft, position.id), selected))
      for (const position of command.positions) finitePoint(position, 'positions')
      for (const position of candidates) Object.assign(getEntity(draft, position.id), { x: position.x, y: position.y })
      grow = candidates.filter(position => getEntity(draft, position.id).parentId).map(position => position.id)
      break
    }
    case 'resize': {
      const entity = getEntity(draft, command.id)
      const size = { ...entity, width: command.width, height: command.height }
      const minimum = measureEntity({ ...size, height: 0 })
      if (!Number.isFinite(command.width) || !Number.isFinite(command.height) || command.width < minimum.width || command.height < minimum.height) fail('invalid-command', 'size', 'Resize would clip text or use an invalid size')
      if (draft.entities.some(child => child.parentId === entity.id && (child.x < 0 || child.y < 0 || child.x + child.width > command.width || child.y + child.height > command.height))) fail('invalid-command', 'size', 'Resize would clip contained entities')
      Object.assign(entity, { width: command.width, height: command.height })
      grow = entity.parentId ? [entity.id] : []
      break
    }
    case 'connect':
      if (!isRecord(command.connection)) fail('invalid-command', 'connection', 'Expected a connection')
      ensureFresh(draft, command.connection.id)
      draft.connections.push({ ...command.connection })
      break
    case 'updateConnection':
      patchFields(command.patch, ['from', 'to', 'label', 'style', 'arrow', 'sourceSide', 'targetSide', 'sourceOffset', 'targetOffset', 'status'])
      Object.assign(getConnection(draft, command.id), command.patch)
      if (Object.hasOwn(command.patch, 'sourceOffset') || Object.hasOwn(command.patch, 'targetOffset') || Object.hasOwn(command.patch, 'status')) draft.schemaVersion = 2
      break
    case 'adjustRoute': {
      if (command.expectedRevision !== document.revision) fail('stale-layout', 'expectedRevision', 'Route adjustment no longer matches the current document revision')
      validRoutePoints(command.points); finitePoint(command.labelPosition, 'labelPosition')
      const current = getConnection(draft, command.id)
      const points = command.points.map(point => ({ ...point }))
      const labelPosition = { ...command.labelPosition }
      if (JSON.stringify(current.points) === JSON.stringify(points) && JSON.stringify(current.labelPosition) === JSON.stringify(labelPosition) && current.routeRevision === document.revision) return document
      Object.assign(current, { points, labelPosition, routeRevision: document.revision })
      break
    }
    case 'resetRoute': {
      if (command.expectedRevision !== document.revision) fail('stale-layout', 'expectedRevision', 'Route reset no longer matches the current document revision')
      const current = getConnection(draft, command.id)
      if (!current.points) return document
      const { points: _points, labelPosition: _labelPosition, routeRevision: _routeRevision, ...automatic } = current
      Object.assign(current, automatic)
      delete current.points; delete current.labelPosition; delete current.routeRevision
      break
    }
    case 'insertOnConnection': {
      const original = getConnection(draft, command.connectionId)
      if (!isRecord(command.entity) || command.entity.kind !== 'component') fail('invalid-command', 'entity.kind', 'Connector insertion requires a component')
      ensureFresh(draft, command.entity.id)
      ensureFresh(draft, command.upstreamId)
      ensureFresh(draft, command.downstreamId)
      draft.entities.push({ ...command.entity })
      draft.connections = draft.connections.filter(connection => connection.id !== original.id)
      draft.connections.push({ ...original, id: command.upstreamId, to: command.entity.id }, { ...original, id: command.downstreamId, from: command.entity.id, label: '' })
      draft = checked(draft, 'invalid-command')
      growText(getEntity(draft, command.entity.id))
      grow = [command.entity.id]
      break
    }
    case 'reparent':
      grow = reparent(draft, command.ids, command.parentId)
      break
    case 'group': {
      const selected = roots(draft, command.ids).map(entity => entity.id)
      if (!selected.length) fail('invalid-command', 'ids', 'Grouping requires at least one entity')
      if (!isRecord(command.boundary) || command.boundary.kind !== 'boundary') fail('invalid-parent', 'boundary.kind', 'Grouping requires a boundary')
      ensureFresh(draft, command.boundary.id)
      draft.entities.push({ ...command.boundary })
      draft = checked(draft, 'invalid-command')
      grow = [command.boundary.id, ...reparent(draft, selected, command.boundary.id)]
      break
    }
    case 'ungroup':
      idsExist(draft, command.boundaryIds)
      for (const id of command.boundaryIds) if (getEntity(draft, id).kind !== 'boundary') fail('invalid-parent', 'boundaryIds', 'Ungroup requires boundaries')
      grow = draft.entities.filter(entity => entity.parentId && command.boundaryIds.includes(entity.parentId) && !command.boundaryIds.includes(entity.id)).map(entity => entity.id)
      draft = removeEntities(draft, command.boundaryIds)
      break
    case 'paste':
      grow = paste(draft, command.fragment, command.idMap, command.offset)
      break
    case 'metadata': {
      patchFields(command.patch, ['title', 'subtitle', 'description', 'backgroundColor', 'grid', 'direction', 'synthetic', 'legendVisible', 'legend'])
      const before = JSON.stringify(draft)
      Object.assign(draft, command.patch)
      if (draft.grid?.color !== undefined) draft.schemaVersion = 2
      // A no-op keeps the revision but still returns the canonical validated
      // document, matching every other applyCommand result.
      if (JSON.stringify(draft) === before) return draft
      break
    }
    case 'order': {
      const selected = new Set(roots(draft, command.ids).map(entity => entity.id))
      if (command.position !== undefined && !['forward', 'backward', 'top', 'bottom'].includes(command.position)) fail('invalid-command', 'position', 'Expected a stacking position')
      if (command.layer !== undefined && !['background', 'foreground'].includes(command.layer)) fail('invalid-command', 'layer', 'Expected a layer action')
      const position = command.position ?? (command.layer === 'background' ? 'bottom' : command.layer === 'foreground' ? 'top' : undefined)
      if (!position) fail('invalid-command', 'position', 'Expected a stacking position or layer action')
      let changed = false
      for (const ordered of siblingScopes(draft.entities).values()) {
        if (!ordered.some(entity => selected.has(entity.id))) continue
        // Resolve any explicit legacy band change first; numeric moves never promote kind or layer.
        // Reorder only selected roots' target bands and rank only bands that visibly change.
        for (const band of [-1, 0, 4] as const) {
          const siblings = ordered.filter(entity => stackingBand(command.layer && selected.has(entity.id) ? { ...entity, layer: command.layer } : entity) === band)
          const chosen = siblings.filter(entity => selected.has(entity.id))
          if (!chosen.length) continue
          const next = reorderSiblings(siblings, selected, position)
          const layerChanged = chosen.some(entity => stackingBand(entity) !== band)
          if (next.every((entity, index) => entity.id === siblings[index].id) && !layerChanged) continue
          changed = true
          next.forEach((entity, index) => { entity.order = band + index })
          if (command.layer) for (const entity of chosen) entity.layer = command.layer
        }
      }
      if (!changed) return document
      break
    }
    case 'applyLayout':
      draft = applyLayout(draft, command)
      break
    default:
      fail('invalid-command', 'type', 'Unknown command type')
  }
  // Appearance and stacking edits do not change geometry. Keep valid routes and restamp only those.
  const preserveRoutes = command.type === 'order'
    || command.type === 'configureStateStyles'
    || command.type === 'adjustRoute'
    || command.type === 'resetRoute'
    || (command.type === 'updateEntity' && Object.keys(command.patch).every(key => ['color', 'icon', 'customIcon', 'status'].includes(key)))
    || (command.type === 'updateConnection' && Object.keys(command.patch).every(key => ['label', 'style', 'arrow', 'status'].includes(key)))
    || (command.type === 'metadata' && draft.direction === document.direction)
  if (command.type !== 'applyLayout' && !preserveRoutes) draft = invalidateRoutes(draft)
  if (grow.length) {
    draft = checked(draft, 'invalid-command')
    expandAncestors(draft, grow)
  }
  draft.revision++
  if (command.type === 'applyLayout') for (const connection of draft.connections) if (connection.points) connection.routeRevision = draft.revision
  if (command.type === 'adjustRoute') getConnection(draft, command.id).routeRevision = draft.revision
  if (preserveRoutes) for (const connection of draft.connections) if (connection.points && connection.routeRevision === document.revision) connection.routeRevision = draft.revision
  return checked(draft, 'invalid-command')
}