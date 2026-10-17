import { isColorKey, isIconKey } from '../catalog.ts'
import { validateCustomIcon } from '../custom-icons/contract.ts'
import { isHexColor } from '../render/contrast.ts'
import type { Result, ValidationIssue } from '../contracts.ts'
import type { Connection, Diagram, Entity, LegendEntry, Point } from '../model.ts'

export const MAX_BYTES = 5 * 1024 * 1024
export const isStableId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(value) && !['__proto__', 'prototype', 'constructor'].includes(value)

export function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return (prototype === Object.prototype || prototype === null) && Object.values(Object.getOwnPropertyDescriptors(value)).every(descriptor => 'value' in descriptor)
}

/** Count raw JSON bytes before discarding unknown fields; descriptors avoid executing getters or toJSON hooks. */
export function inspectJson(input: unknown): ValidationIssue | undefined {
  let bytes = 0
  let pendingLength = 0
  const pending: string[] = []
  const ancestors = new Set<object>()
  const encoder = new TextEncoder()
  const oversized = (): ValidationIssue | undefined => bytes > MAX_BYTES ? { path: '$', message: 'JSON exceeds the 5 MiB limit' } : undefined
  const flush = () => {
    bytes += encoder.encode(pending.join('')).byteLength
    pending.length = 0
    pendingLength = 0
    return oversized()
  }
  const count = (text: string) => {
    pending.push(text)
    pendingLength += text.length
    if (bytes + pendingLength > MAX_BYTES) return { path: '$', message: 'JSON exceeds the 5 MiB limit' }
    return pendingLength >= 16 * 1024 ? flush() : undefined
  }
  const walk = (value: unknown, depth: number): ValidationIssue | undefined => {
    if (depth > 128) return { path: '$', message: 'JSON structure is too deeply nested' }
    if (value === null || value === undefined || typeof value === 'boolean' || typeof value === 'number') return count(JSON.stringify(value) ?? 'null')
    if (typeof value === 'string') return count(JSON.stringify(value))
    if (typeof value !== 'object') return { path: '$', message: 'Expected inert JSON data, without functions, getters or custom prototypes' }
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (!array && prototype !== Object.prototype && prototype !== null) return { path: '$', message: 'Expected inert JSON data, without functions, getters or custom prototypes' }
    if (ancestors.has(value)) return { path: '$', message: 'JSON data cannot contain cycles' }
    ancestors.add(value)
    const descriptors = Object.getOwnPropertyDescriptors(value)
    if (Object.values(descriptors).some(descriptor => !('value' in descriptor))) return { path: '$', message: 'JSON data cannot contain getters' }
    if (array && (prototype !== Array.prototype || Object.keys(descriptors).some(key => key !== 'length' && !/^(0|[1-9]\d*)$/.test(key)))) return { path: '$', message: 'JSON arrays cannot contain custom methods, properties or prototypes' }
    const entries = Object.entries(descriptors).filter(([key, descriptor]) => array ? /^(0|[1-9]\d*)$/.test(key) : descriptor.enumerable && descriptor.value !== undefined)
    if (array && entries.length !== value.length) return { path: '$', message: 'JSON arrays cannot contain sparse entries' }
    const punctuation = count(array ? '[' : '{')
    if (punctuation) return punctuation
    for (const [index, [key, descriptor]] of entries.entries()) {
      const separator = count(`${index ? ',' : ''}${array ? '' : `${JSON.stringify(key)}:`}`)
      if (separator) return separator
      const error = walk(descriptor.value, depth + 1)
      if (error) return error
    }
    ancestors.delete(value)
    return count(array ? ']' : '}')
  }
  return walk(input, 0) ?? (pendingLength ? flush() : undefined)
}

class Reader {
  errors: ValidationIssue[] = []
  issue(path: string, message: string) { this.errors.push({ path, message }) }
  record(value: unknown, path: string): Record<string, unknown> {
    if (isRecord(value)) return value
    this.issue(path, 'Expected a plain JSON object')
    return {}
  }
  text(value: unknown, path: string, limit: number): string {
    if (typeof value === 'string' && value.length <= limit) return value
    this.issue(path, `Expected plain text of at most ${limit} characters`)
    return ''
  }
  id(value: unknown, path: string): string {
    if (isStableId(value)) return value
    this.issue(path, 'Expected a stable ID (1-128 letters, digits, dot, underscore, colon or hyphen; no reserved prototype names)')
    return ''
  }
  number(value: unknown, path: string, positive = false): number {
    if (typeof value === 'number' && Number.isFinite(value) && (!positive || value > 0)) return value
    this.issue(path, `Expected a finite ${positive ? 'positive ' : ''}number`)
    return positive ? 1 : 0
  }
  revision(value: unknown, path: string): number {
    if (Number.isSafeInteger(value) && (value as number) >= 0) return value as number
    this.issue(path, 'Expected a nonnegative safe integer revision')
    return 0
  }
  boolean(value: unknown, path: string): boolean {
    if (typeof value === 'boolean') return value
    this.issue(path, 'Expected a boolean')
    return false
  }
  token<T extends string>(value: unknown, path: string, allowed: readonly T[]): T {
    if (allowed.includes(value as T)) return value as T
    this.issue(path, `Expected one of: ${allowed.join(', ')}`)
    return allowed[0]
  }
  color(value: unknown, path: string): string {
    if (typeof value === 'string' && isColorKey(value)) return value
    this.issue(path, 'Expected a registered semantic color or #RGB/#RRGGBB')
    return 'gray'
  }
  array(value: unknown, path: string, limit: number): unknown[] {
    if (!Array.isArray(value)) { this.issue(path, 'Expected an array'); return [] }
    if (value.length > limit) { this.issue(path, `Limit exceeded: maximum ${limit} items`); return [] }
    return value
  }
  point(value: unknown, path: string): Point {
    const input = this.record(value, path)
    return { x: this.number(input.x, `${path}.x`), y: this.number(input.y, `${path}.y`) }
  }
  entity(value: unknown, path: string): Entity {
    const input = this.record(value, path)
    const kind = this.token(input.kind, `${path}.kind`, ['component', 'boundary', 'text', 'rectangle'])
    const entity: Entity = {
      id: this.id(input.id, `${path}.id`), kind,
      label: this.text(input.label, `${path}.label`, kind === 'text' ? 2000 : 120),
      parentId: input.parentId == null ? null : this.id(input.parentId, `${path}.parentId`),
      layer: input.layer === undefined ? 'foreground' : this.token(input.layer, `${path}.layer`, ['foreground', 'background'] as const),
      x: this.number(input.x, `${path}.x`), y: this.number(input.y, `${path}.y`),
      width: this.number(input.width, `${path}.width`, true), height: this.number(input.height, `${path}.height`, true),
      color: this.color(input.color, `${path}.color`),
    }
    if (input.subtitle !== undefined) entity.subtitle = this.text(input.subtitle, `${path}.subtitle`, 200)
    if (input.order !== undefined) entity.order = this.number(input.order, `${path}.order`)
    if (input.icon !== undefined) {
      if (typeof input.icon === 'string' && isIconKey(input.icon)) entity.icon = input.icon
      else this.issue(`${path}.icon`, 'Expected an allowlisted icon registry key, not an asset path')
    }
    if (input.status !== undefined) entity.status = this.token(input.status, `${path}.status`, ['live', 'planned', 'not-connected', 'synthetic'] as const)
    if (input.customIcon !== undefined) {
      const custom = validateCustomIcon(input.customIcon)
      if (kind !== 'component') this.issue(`${path}.customIcon`, 'Only components can contain a custom icon')
      else if (!custom.ok) this.issue(`${path}.customIcon`, custom.error)
      else entity.customIcon = custom.value
    }
    return entity
  }
  connection(value: unknown, path: string, revision: number): Connection {
    const input = this.record(value, path)
    const connection: Connection = {
      id: this.id(input.id, `${path}.id`), from: this.id(input.from, `${path}.from`), to: this.id(input.to, `${path}.to`),
      label: this.text(input.label, `${path}.label`, 80),
      style: this.token(input.style, `${path}.style`, ['solid', 'dashed']),
      arrow: this.token(input.arrow, `${path}.arrow`, ['forward', 'both', 'none']),
    }
    for (const key of ['sourceSide', 'targetSide'] as const) if (input[key] !== undefined) connection[key] = this.token(input[key], `${path}.${key}`, ['auto', 'top', 'right', 'bottom', 'left'] as const)
    if (input.points !== undefined) {
      const points = this.array(input.points, `${path}.points`, 10000)
      if (points.length < 2) this.issue(`${path}.points`, 'A route requires at least two points')
      connection.points = points.map((point, index) => this.point(point, `${path}.points[${index}]`))
      connection.routeRevision = this.revision(input.routeRevision, `${path}.routeRevision`)
      if (connection.routeRevision > revision) this.issue(`${path}.routeRevision`, 'Saved route revision cannot be newer than the document revision')
    } else if (input.routeRevision !== undefined || input.labelPosition !== undefined) this.issue(`${path}.points`, 'Route revision and label position require route points')
    if (input.labelPosition !== undefined) connection.labelPosition = this.point(input.labelPosition, `${path}.labelPosition`)
    return connection
  }
  legend(value: unknown): LegendEntry[] {
    return this.array(value, 'legend', 100).map((entry, index) => {
      const path = `legend[${index}]`
      const input = this.record(entry, path)
      return { label: this.text(input.label, `${path}.label`, 120), color: this.color(input.color, `${path}.color`), ...(input.dashed !== undefined ? { dashed: this.boolean(input.dashed, `${path}.dashed`) } : {}) }
    })
  }
}

/** Reconstruct known JSON fields, then check references and ancestry without following unchecked input. */
export function validateDocument(input: unknown): Result<Diagram> {
  const unsafe = inspectJson(input)
  if (unsafe) return { ok: false, errors: [unsafe] }
  const reader = new Reader()
  const source = reader.record(input, '$')
  if (source.schemaVersion !== 1) reader.issue('schemaVersion', 'Only schemaVersion 1 is supported; no implicit migrations')
  const revision = reader.revision(source.revision, 'revision')
  const diagram: Diagram = {
    schemaVersion: 1, id: reader.id(source.id, 'id'), title: reader.text(source.title, 'title', 120),
    subtitle: reader.text(source.subtitle, 'subtitle', 200), synthetic: reader.boolean(source.synthetic, 'synthetic'),
    legendVisible: reader.boolean(source.legendVisible, 'legendVisible'), legend: reader.legend(source.legend), revision,
    direction: reader.token(source.direction, 'direction', ['RIGHT', 'DOWN']),
    entities: reader.array(source.entities, 'entities', 100).map((entity, index) => reader.entity(entity, `entities[${index}]`)),
    connections: reader.array(source.connections, 'connections', 150).map((connection, index) => reader.connection(connection, `connections[${index}]`, revision)),
  }
  if (source.description !== undefined) diagram.description = reader.text(source.description, 'description', 20000)
  if (source.backgroundColor !== undefined) {
    if (isHexColor(source.backgroundColor)) diagram.backgroundColor = source.backgroundColor
    else reader.issue('backgroundColor', 'Expected #RGB or #RRGGBB')
  }
  if (source.grid !== undefined) {
    const grid = reader.record(source.grid, 'grid')
    const spacing = grid.spacing
    if (typeof spacing !== 'number' || !Number.isFinite(spacing) || !Number.isInteger(spacing) || spacing < 4 || spacing > 128) reader.issue('grid.spacing', 'Expected an integer between 4 and 128')
    diagram.grid = {
      visible: reader.boolean(grid.visible, 'grid.visible'), style: reader.token(grid.style, 'grid.style', ['dots', 'lines']),
      spacing: typeof spacing === 'number' ? spacing : 8, snap: reader.boolean(grid.snap, 'grid.snap'),
      present: reader.boolean(grid.present, 'grid.present'), export: reader.boolean(grid.export, 'grid.export'),
    }
  }
  validateGraph(diagram, reader)
  if (!reader.errors.length && new TextEncoder().encode(JSON.stringify(diagram)).byteLength > MAX_BYTES) reader.issue('$', 'Document exceeds the 5 MiB limit')
  return reader.errors.length ? { ok: false, errors: reader.errors } : { ok: true, value: diagram }
}

function validateGraph(diagram: Diagram, reader: Reader) {
  const ids = new Set<string>()
  const entities = new Map(diagram.entities.map(entity => [entity.id, entity]))
  for (const [index, entity] of diagram.entities.entries()) {
    const path = `entities[${index}]`
    if (ids.has(entity.id)) reader.issue(`${path}.id`, 'Duplicate ID; entity and connection IDs must be globally unique')
    ids.add(entity.id)
    if (entity.parentId && entities.get(entity.parentId)?.kind !== 'boundary') reader.issue(`${path}.parentId`, 'Parent must reference an existing boundary')
    const visited = new Set([entity.id])
    let parentId = entity.parentId
    let levels = entity.kind === 'boundary' ? 1 : 0
    while (parentId) {
      if (visited.has(parentId)) { reader.issue(`${path}.parentId`, 'Boundary membership cycle'); break }
      visited.add(parentId)
      const parent = entities.get(parentId)
      if (!parent) break
      levels++
      if (levels > 2) { reader.issue(`${path}.parentId`, 'At most two boundary levels are supported'); break }
      parentId = parent.parentId
    }
  }
  for (const [index, connection] of diagram.connections.entries()) {
    const path = `connections[${index}]`
    if (ids.has(connection.id)) reader.issue(`${path}.id`, 'Duplicate ID; entity and connection IDs must be globally unique')
    ids.add(connection.id)
    for (const endpoint of ['from', 'to'] as const) {
      const entity = entities.get(connection[endpoint])
      if (!entity || !['component', 'boundary'].includes(entity.kind)) reader.issue(`${path}.${endpoint}`, 'Endpoint must reference an existing component or boundary')
    }
    if (connection.from === connection.to) reader.issue(`${path}.to`, 'Self-loop connections are not supported')
  }
}

export function parseDocument(text: string): Result<Diagram> {
  if (typeof text !== 'string') return { ok: false, errors: [{ path: '$', message: 'Expected JSON text' }] }
  if (text.length > MAX_BYTES || new TextEncoder().encode(text).byteLength > MAX_BYTES) return { ok: false, errors: [{ path: '$', message: 'JSON exceeds the 5 MiB limit' }] }
  try { return validateDocument(JSON.parse(text)) }
  catch (error) { return { ok: false, errors: [{ path: '$', message: `Invalid JSON: ${error instanceof Error ? error.message : String(error)}` }] } }
}