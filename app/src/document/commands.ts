import type { ClipboardFragment, DocumentCommand, DomainErrorCode, ValidationIssue } from '../contracts.ts'
import { absolutePosition, entityTextGeometry, invalidateRoutes, measureEntity, removeEntities } from '../model.ts'
import type { Connection, Diagram, Entity, Point } from '../model.ts'
import { inspectJson, isRecord, validateDocument } from './validation.ts'

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
  const depth = (entity: Entity) => entity.parentId ? 1 : 0
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
  const entities = source.entities.map(entity => ({ ...entity, id: remap.get(entity.id)!, parentId: entity.parentId ? remap.get(entity.parentId)! : null, ...(entity.parentId ? {} : { x: entity.x + offset.x, y: entity.y + offset.y }) }))
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
    case 'updateEntity': {
      patchFields(command.patch, ['label', 'subtitle', 'color', 'icon', 'customIcon', 'status'])
      Object.assign(getEntity(draft, command.id), command.patch)
      draft = checked(draft, 'invalid-command')
      if (!Object.hasOwn(command.patch, 'customIcon') || Object.keys(command.patch).some(key => key !== 'customIcon' && key !== 'icon')) {
        growText(getEntity(draft, command.id))
        grow = [command.id]
      }
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
      patchFields(command.patch, ['from', 'to', 'label', 'style', 'arrow', 'sourceSide', 'targetSide'])
      Object.assign(getConnection(draft, command.id), command.patch)
      break
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
    case 'metadata':
      patchFields(command.patch, ['title', 'subtitle', 'direction', 'synthetic', 'legendVisible', 'legend'])
      Object.assign(draft, command.patch)
      break
    case 'order':
      idsExist(draft, command.ids)
      for (const id of command.ids) getEntity(draft, id).layer = command.layer
      break
    case 'applyLayout':
      draft = applyLayout(draft, command)
      break
    default:
      fail('invalid-command', 'type', 'Unknown command type')
  }
  // Old routes are checked only for snapshot input; ordinary mutations deliberately invalidate them.
  if (command.type !== 'applyLayout') draft = invalidateRoutes(draft)
  if (grow.length) {
    draft = checked(draft, 'invalid-command')
    expandAncestors(draft, grow)
  }
  draft.revision++
  if (command.type === 'applyLayout') for (const connection of draft.connections) if (connection.points) connection.routeRevision = draft.revision
  return checked(draft, 'invalid-command')
}