import { isIconKey } from '../catalog.ts'
import type { Result, ValidationIssue } from '../contracts.ts'
import { createDocument, measureEntity } from '../model.ts'
import type { Diagram, Entity } from '../model.ts'
import { inspectJson, isRecord, isStableId, MAX_BYTES, validateDocument } from './validation.ts'

/** Map the documented skill tree in stable traversal order; never load assets or arrange geometry. */
export function importSkillSpec(input: unknown): Result<Diagram> {
  const unsafe = inspectJson(input)
  if (unsafe) return { ok: false, errors: [unsafe] }
  const errors: ValidationIssue[] = []
  const warnings: string[] = []
  const issue = (path: string, message: string) => errors.push({ path, message })
  const object = (value: unknown, path: string, keys: string[]): Record<string, unknown> => {
    if (!isRecord(value)) { issue(path, 'Expected a plain skill JSON object'); return {} }
    for (const key of Object.keys(value)) if (!keys.includes(key)) issue(`${path}.${key}`, 'Unsupported skill field')
    return value
  }
  const array = (value: unknown, path: string, limit: number): unknown[] => {
    if (value === undefined) return []
    if (!Array.isArray(value) || value.length > limit) { issue(path, `Expected an array with at most ${limit} entries`); return [] }
    return value
  }
  const source = object(input, '$', ['title', 'subtitle', 'direction', 'groups', 'nodes', 'edges', 'legend', 'synthetic', 'legendVisible'])
  const diagram = createDocument('skill-import-v1')
  const fallback = (value: unknown, defaultValue: unknown) => value === undefined ? defaultValue : value
  Object.assign(diagram, {
    title: fallback(source.title, 'Imported architecture'), subtitle: fallback(source.subtitle, ''), direction: fallback(source.direction, 'RIGHT'),
    synthetic: fallback(source.synthetic, false), legendVisible: fallback(source.legendVisible, true), legend: fallback(source.legend, []),
  })
  const used = new Set<string>()
  let generated = 0
  const makeId = (value: unknown, prefix: string, path: string): string => {
    if (value !== undefined && !isStableId(value)) { issue(path, 'Expected a stable ID'); return `invalid-${generated++}` }
    if (value !== undefined) return value as string
    let id: string
    do { id = `skill-${prefix}-${++generated}` } while (used.has(id))
    return id
  }
  // Reserve supplied IDs first, so generated IDs cannot collide with a later sibling.
  const reserve = (items: unknown[], depth: number) => {
    for (const item of items) {
      if (!isRecord(item)) continue
      if (isStableId(item.id)) used.add(item.id)
      if (depth < 2) {
        reserve(array(item.nodes, 'nodes', 100), depth + 1)
        reserve(array(item.groups, 'groups', 100), depth + 1)
      }
    }
  }
  reserve([...array(source.nodes, 'nodes', 100), ...array(source.groups, 'groups', 100), ...array(source.edges, 'edges', 150)], 0)
  const addNode = (value: unknown, path: string, parentId: string | null) => {
    if (diagram.entities.length >= 100) { issue(path, 'Limit exceeded: maximum 100 total entities'); return }
    const node = object(value, path, ['id', 'label', 'sub', 'icon', 'color', 'status'])
    const id = makeId(node.id, 'node', `${path}.id`)
    used.add(id)
    let icon = fallback(node.icon, 'service')
    if (typeof icon !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/.test(icon)) issue(`${path}.icon`, 'Only icon names are accepted; remote, SVG and asset paths are prohibited')
    else if (!isIconKey(icon)) { warnings.push(`${path}.icon: Unknown icon "${icon}"; using generic service glyph`); icon = 'service' }
    const entity = { id, kind: 'component', label: node.label, parentId, layer: 'foreground', x: 24, y: 64, width: 220, height: 88, color: fallback(node.color, 'azure'), icon, ...(node.sub !== undefined ? { subtitle: node.sub } : {}), ...(node.status !== undefined ? { status: node.status } : {}) } as Entity
    diagram.entities.push(entity)
  }
  const addGroup = (value: unknown, path: string, parentId: string | null, depth: number) => {
    if (diagram.entities.length >= 100) { issue(path, 'Limit exceeded: maximum 100 total entities'); return }
    const group = object(value, path, ['id', 'label', 'color', 'dashed', 'nodes', 'groups'])
    if (depth > 2) { issue(path, 'At most two boundary levels are supported'); return }
    if (group.dashed !== undefined && group.dashed !== false) issue(`${path}.dashed`, 'Dashed group boundaries are not represented in JSON v1')
    const id = makeId(group.id, 'group', `${path}.id`)
    used.add(id)
    diagram.entities.push({ id, kind: 'boundary', label: group.label, parentId, layer: 'foreground', x: 24, y: 64, width: 400, height: 300, color: fallback(group.color, 'azure') } as Entity)
    for (const [index, node] of array(group.nodes, `${path}.nodes`, 100).entries()) addNode(node, `${path}.nodes[${index}]`, id)
    for (const [index, nested] of array(group.groups, `${path}.groups`, 100).entries()) addGroup(nested, `${path}.groups[${index}]`, id, depth + 1)
  }
  for (const [index, node] of array(source.nodes, 'nodes', 100).entries()) addNode(node, `nodes[${index}]`, null)
  for (const [index, group] of array(source.groups, 'groups', 100).entries()) addGroup(group, `groups[${index}]`, null, 1)
  for (const [index, value] of array(source.edges, 'edges', 150).entries()) {
    const path = `edges[${index}]`
    const edge = object(value, path, ['id', 'from', 'to', 'label', 'style', 'arrow', 'sourceSide', 'targetSide'])
    const id = makeId(edge.id, 'edge', `${path}.id`)
    used.add(id)
    diagram.connections.push({ id, from: edge.from, to: edge.to, label: fallback(edge.label, ''), style: fallback(edge.style, 'solid'), arrow: fallback(edge.arrow, 'forward'), ...(edge.sourceSide !== undefined ? { sourceSide: edge.sourceSide } : {}), ...(edge.targetSide !== undefined ? { targetSide: edge.targetSide } : {}) } as Diagram['connections'][number])
  }
  const result = validateDocument(diagram)
  if (!result.ok) errors.push(...result.errors)
  if (errors.length || !result.ok) return { ok: false, errors }
  const value = result.value
  value.entities = value.entities.map(entity => ({ ...entity, ...measureEntity(entity) }))
  for (const boundary of [...value.entities].reverse().filter(entity => entity.kind === 'boundary')) {
    for (const child of value.entities.filter(entity => entity.parentId === boundary.id)) {
      boundary.width = Math.max(boundary.width, child.x + child.width + 24)
      boundary.height = Math.max(boundary.height, child.y + child.height + 24)
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).byteLength > MAX_BYTES) return { ok: false, errors: [{ path: '$', message: 'Skill import exceeds the 5 MiB limit' }] }
  return { ok: true, value, ...(warnings.length ? { warnings } : {}) }
}