const text = { type: 'string', maxLength: 4096 }
const id = { type: 'string', minLength: 1, maxLength: 160 }
const number = { type: 'number' }
const boolean = { type: 'boolean' }
const enumeration = (...values) => ({ type: 'string', enum: values })
const object = (properties, required = Object.keys(properties)) => ({ type: 'object', properties, required, additionalProperties: false })
const array = (items, maxItems = 1000) => ({ type: 'array', items, maxItems })
const ids = array(id)
const point = object({ x: number, y: number })
const side = enumeration('auto', 'top', 'right', 'bottom', 'left')
const entityProperties = {
  id, kind: enumeration('component', 'boundary', 'text', 'rectangle'), label: text, subtitle: text,
  parentId: { oneOf: [id, { type: 'null' }] }, layer: enumeration('foreground', 'background'), order: { type: 'integer' },
  x: number, y: number, width: number, height: number, color: text, icon: id,
  customIcon: object({ name: text, dataUrl: { type: 'string', maxLength: 60000 }, width: number, height: number }),
  status: enumeration('live', 'planned', 'not-connected', 'synthetic'),
}
const requiredEntity = ['id', 'kind', 'label', 'x', 'y', 'width', 'height', 'color']
const entity = object(entityProperties, requiredEntity)
const connectionProperties = {
  id, from: id, to: id, label: text, style: enumeration('solid', 'dashed'), arrow: enumeration('forward', 'both', 'none'),
  sourceSide: side, targetSide: side, routeRevision: { type: 'integer' }, labelPosition: point, points: array(point),
}
const connection = object(connectionProperties, ['id', 'from', 'to', 'label', 'style', 'arrow'])
const pick = (properties, names) => Object.fromEntries(names.map(name => [name, properties[name]]))
const command = (type, properties, required) => object({ type: { const: type }, ...properties }, ['type', ...(required ?? Object.keys(properties))])
export const commandSchema = { oneOf: [
  command('addEntity', { entity }),
  command('addConnected', { sourceId: id, entity, connection }),
  command('updateEntity', { id, patch: object(pick(entityProperties, ['label', 'subtitle', 'color', 'icon', 'customIcon', 'status']), []) }),
  command('remove', { entityIds: ids, connectionIds: ids }),
  command('move', { positions: array(object({ id, x: number, y: number })) }),
  command('resize', { id, width: number, height: number }),
  command('connect', { connection }),
  command('updateConnection', { id, patch: object(pick(connectionProperties, ['from', 'to', 'label', 'style', 'arrow', 'sourceSide', 'targetSide']), []) }),
  command('insertOnConnection', { connectionId: id, entity, upstreamId: id, downstreamId: id }),
  command('reparent', { ids, parentId: { oneOf: [id, { type: 'null' }] } }),
  command('group', { ids, boundary: object({ ...entityProperties, kind: { const: 'boundary' } }, requiredEntity) }),
  command('ungroup', { boundaryIds: ids }),
  command('paste', { fragment: object({ entities: array(entity), connections: array(connection), origin: point }), idMap: { type: 'object', additionalProperties: id, maxProperties: 2000 }, offset: point }),
  command('metadata', { patch: object({
    title: text, subtitle: text, description: { type: 'string', maxLength: 60000 }, backgroundColor: text,
    grid: object({ visible: boolean, style: enumeration('dots', 'lines'), spacing: number, snap: boolean, present: boolean, export: boolean }),
    direction: enumeration('RIGHT', 'DOWN'), synthetic: boolean, legendVisible: boolean,
    legend: array(object({ label: text, color: text, dashed: boolean }, ['label', 'color'])),
  }, []) }),
  command('order', { ids, layer: enumeration('foreground', 'background'), position: enumeration('forward', 'backward', 'top', 'bottom') }, ['ids']),
] }
const stateToken = { type: 'string', minLength: 1, maxLength: 200, description: 'Opaque current stateToken from get_document or the last successful mutation. Changes after edits, replacement, Undo/Redo and reload.' }
export const mutationTools = [
  { name: 'create_diagram', description: 'Replace the current workspace with a blank diagram or an existing template key from list_templates. Uses normal unsaved-work confirmation; cancel leaves it unchanged. Resets Undo history.', inputSchema: object({ stateToken, template: id }, ['stateToken']) },
  { name: 'edit_diagram', description: 'Atomically apply 1–100 native DocumentCommand values as one Undo step, using existing entity/connection IDs from get_document and icon IDs from search_catalog. Entire batch fails on invalid input. No client-computed layout.', inputSchema: object({ stateToken, commands: { ...array(commandSchema, 100), minItems: 1 } }) },
  { name: 'arrange_diagram', description: 'Run real Auto-arrange. Optional stacked uses existing boundary groups: RIGHT contents with groups stacked vertically; DOWN contents with groups side by side. Omitted arrangement preserves standard RIGHT/DOWN behavior. Commit only while current and interaction-free.', inputSchema: object({ stateToken, direction: enumeration('RIGHT', 'DOWN'), arrangement: enumeration('standard', 'stacked') }, ['stateToken', 'direction']) },
  { name: 'undo', description: 'Undo one normal history step. Fails if no Undo is available.', inputSchema: object({ stateToken }) },
  { name: 'redo', description: 'Redo one normal history step. Fails if no Redo is available.', inputSchema: object({ stateToken }) },
].map(tool => ({ ...tool, annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } }))

const imageOptions = { scale: { type: 'integer', enum: [1, 2] }, transparent: boolean, background: enumeration('diagram', 'white'), aspect: enumeration('content', '16:9'), includeGrid: boolean }
export const outputTools = [
  { name: 'snapshot_diagram', description: 'Render the entire current committed diagram as PNG at scale 1, diagram background, content bounds and normal export grid. No UI, drafts, selection or filesystem access.', inputSchema: object({ stateToken }) },
  { name: 'export_diagram', description: 'Return SVG, PNG, native editable JSON or Markdown with inline PNG. Optional includeMarkdown packages SVG/PNG/JSON plus companion description Markdown in one ZIP. Requires current stateToken; no save dialog or filesystem access.', inputSchema: { ...object({ stateToken, format: enumeration('svg', 'png', 'json', 'markdown'), ...imageOptions, includeMarkdown: boolean }, ['stateToken', 'format']), oneOf: [
    object({ stateToken, format: enumeration('svg', 'png'), ...imageOptions, includeMarkdown: boolean }, ['stateToken', 'format']),
    object({ stateToken, format: { const: 'json' }, includeMarkdown: boolean }, ['stateToken', 'format']),
    object({ stateToken, format: { const: 'markdown' }, ...imageOptions, includeMarkdown: { const: false } }, ['stateToken', 'format']),
  ] } },
].map(tool => ({ ...tool, annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } }))

// Small, deliberately bounded validator for exactly the JSON Schema subset above.
// The domain still validates graph/geometry/catalog semantics before any commit.
export function matchesSchema(value, schema, depth = 0) {
  if (depth > 20) return false
  if (schema.oneOf) return schema.oneOf.filter(choice => matchesSchema(value, choice, depth + 1)).length === 1
  if (schema.const !== undefined && value !== schema.const) return false
  if (schema.enum && !schema.enum.includes(value)) return false
  if (schema.type === 'null') return value === null
  if (schema.type === 'string') return typeof value === 'string' && value.length >= (schema.minLength ?? 0) && value.length <= (schema.maxLength ?? Infinity)
  if (schema.type === 'boolean') return typeof value === 'boolean'
  if (schema.type === 'number' || schema.type === 'integer') return typeof value === 'number' && Number.isFinite(value) && (schema.type !== 'integer' || Number.isSafeInteger(value))
  if (schema.type === 'array') return Array.isArray(value) && value.length >= (schema.minItems ?? 0) && value.length <= (schema.maxItems ?? Infinity) && value.every(item => matchesSchema(item, schema.items, depth + 1))
  if (schema.type === 'object') {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length > (schema.maxProperties ?? Infinity)) return false
    if ((schema.required ?? []).some(key => !Object.hasOwn(value, key))) return false
    return Object.entries(value).every(([key, item]) => {
      if (['__proto__', 'prototype', 'constructor'].includes(key)) return false
      const property = Object.hasOwn(schema.properties ?? {}, key) ? schema.properties[key] : schema.additionalProperties
      return property && typeof property === 'object' ? matchesSchema(item, property, depth + 1) : property === true
    })
  }
  return schema.const !== undefined
}
export function validateMutation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['name', 'arguments'].includes(key))) return false
  const tool = mutationTools.find(tool => tool.name === value.name)
  return !!tool && matchesSchema(value.arguments, tool.inputSchema)
}
export function validateOutputOperation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['name', 'arguments'].includes(key))) return false
  const tool = outputTools.find(tool => tool.name === value.name)
  return !!tool && matchesSchema(value.arguments, tool.inputSchema)
}
