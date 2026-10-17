import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { createDocument, sampleDiagram } from '../model.ts'
import { qualityFixtures } from '../fixtures.ts'
import { importSkillSpec, parseDocument, validateDocument } from './index.ts'
import { inspectJson, MAX_BYTES } from './validation.ts'
import webApiSource from '../../../examples/azure-web-app.json?raw'
import eventSource from '../../../examples/event-driven.json?raw'
import fabricSource from '../../../examples/fabric-onelake.json?raw'
import enterpriseSource from '../../../examples/enterprise-integration.json?raw'

const grid115 = { visible: true, style: 'dots' as const, spacing: 8, snap: true, present: false, export: false }

test('should_round_trip_literal_markdown_description_and_legacy_omission_DGM122', () => {
  const legacy = createDocument('description')
  assert.equal(Object.hasOwn(legacy, 'description'), false)
  assert.deepEqual(parseDocument(JSON.stringify(legacy)), { ok: true, value: legacy })
  for (const description of ['', '  # Architecture\r\n\r\n- **API**\n\t\u6f22\u5b57 \ud83d\ude00 [link](javascript:alert(1))\r\n<img src="https://invalid.example/remote" onerror="alert(1)">  ', '\ud83d\ude00'.repeat(10000)]) {
    const document = { ...legacy, description }
    assert.deepEqual(validateDocument(document), { ok: true, value: document })
    assert.deepEqual(parseDocument(JSON.stringify(document)), { ok: true, value: document })
  }
})

test.each([null, 1, true, [], {}, 'x'.repeat(20001), '\ud83d\ude00'.repeat(10001)])('should_reject_invalid_description_atomically_DGM122_%j', description => {
  const document = { ...createDocument('description'), description }
  const before = JSON.stringify(document)
  const result = validateDocument(document)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some(error => error.path === 'description'))
  assert.equal(JSON.stringify(document), before)
  assert.equal(parseDocument(before).ok, false)
})

test('should_keep_whole_document_byte_bound_with_description_DGM122', () => {
  const document = { ...createDocument('description-bytes'), description: '\u6f22'.repeat(20000), ignored: '' }
  document.ignored = 'x'.repeat(MAX_BYTES - Buffer.byteLength(JSON.stringify(document)))
  const result = validateDocument(document)
  assert.ok(result.ok)
  assert.equal((result.value as unknown as { description: string }).description, document.description)
  assert.equal(parseDocument(JSON.stringify(document)).ok, true)
  document.ignored += 'x'
  assert.equal(validateDocument(document).ok, false)
  assert.equal(parseDocument(JSON.stringify(document)).ok, false)
})

test.each([
  ['web-api', webApiSource], ['event-driven', eventSource],
  ['fabric', fabricSource], ['enterprise', enterpriseSource],
] as const)('should_keep_%s_starter_as_exact_valid_native_json_DGM109', (_key, source) => {
  const parsed = parseDocument(source)
  assert.ok(parsed.ok)
  assert.deepEqual(validateDocument(JSON.parse(source)), parsed)
  assert.deepEqual(parseDocument(JSON.stringify(parsed.value)), parsed)
  assert.equal(parsed.value.synthetic, true)
  assert.ok(parsed.value.connections.every(connection => !!connection.points && connection.points.length >= 2 && connection.routeRevision === parsed.value.revision))
})

test('should_preserve_grid_omission_and_round_trip_all_explicit_settings', () => {
  const legacy = createDocument('grid')
  assert.deepEqual(parseDocument(JSON.stringify(legacy)), { ok: true, value: legacy })
  for (const style of ['dots', 'lines'] as const) for (const spacing of [4, 8, 128]) {
    const document = { ...legacy, grid: { ...grid115, visible: false, style, spacing, snap: false, present: true, export: true } }
    assert.deepEqual(parseDocument(JSON.stringify(document)), { ok: true, value: document })
  }
})

test.each(['visible', 'style', 'spacing', 'snap', 'present', 'export'])('should_reject_grid_when_required_field_%s_is_missing', field => {
  const grid: Record<string, unknown> = { ...grid115 }
  delete grid[field]
  assert.equal(validateDocument({ ...createDocument('grid'), grid }).ok, false)
})

test.each([null, [], 'dots', {}, { ...grid115, style: 'off' }, ...[3, 129, 8.5, NaN, Infinity, '8', null].map(spacing => ({ ...grid115, spacing })), ...['visible', 'snap', 'present', 'export'].map(field => ({ ...grid115, [field]: 1 }))])('should_reject_invalid_grid_without_silently_omitting_it_%j', grid => {
  const result = validateDocument({ ...createDocument('grid'), grid })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some(error => error.path.startsWith('grid')))
})

test('should_preserve_background_when_valid_hex_is_reopened_and_omit_it_for_legacy_documents', () => {
  const legacy = createDocument('background')
  assert.deepEqual(parseDocument(JSON.stringify(legacy)), { ok: true, value: legacy })
  for (const backgroundColor of ['#abc', '#ABC', '#123abc', '#FFFFFF']) {
    const document = { ...legacy, backgroundColor }
    assert.deepEqual(parseDocument(JSON.stringify(document)), { ok: true, value: document })
  }
})

test.each(['white', 'transparent', '#abcd', '#12345678', '#ggg', ' #abc', '#abc\n', '#123456\r\n', 'url(https://evil)', 'var(--color)', '<script>', null])('should_reject_invalid_background_%s_without_discarding_it', backgroundColor => {
  const result = validateDocument({ ...createDocument('background'), backgroundColor })
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some(error => error.path === 'backgroundColor'))
})

test('should_batch_utf8_allocations_when_inspecting_the_production_stress_snapshot', () => {
  const document = qualityFixtures().find(candidate => candidate.id === 'stress-v1')!
  const encode = vi.spyOn(TextEncoder.prototype, 'encode')
  try {
    assert.equal(inspectJson(document), undefined)
    assert.ok(encode.mock.calls.length <= 4, `Expected bounded batches, received ${encode.mock.calls.length} UTF-8 allocations`)
    assert.equal(encode.mock.results.reduce((bytes, result) => bytes + (result.value as Uint8Array).byteLength, 0), Buffer.byteLength(JSON.stringify(document)))
  } finally {
    encode.mockRestore()
  }
})

test('should_match_standard_json_bytes_when_arbitrary_inert_values_are_inspected', () => {
  const texts = ['plain', '\u00e9', '\u6f22', '\ud83d\ude00', '\ud800', '\udfff', '"\\\b\f\n\r\t\u0000\u001f', '\u2028\u2029']
  const encode = vi.spyOn(TextEncoder.prototype, 'encode')
  try {
    for (let index = 0; index < 64; index++) {
      const text = texts[index % texts.length]
      const shared = { text, omitted: undefined, finite: index / 7, nonfinite: Infinity }
      const input = Object.assign(Object.create(null) as Record<string, unknown>, {
        [text]: [shared, null, true, false, undefined, -0, -1.2e100],
        nested: { shared, text: texts[(index * 3 + 1) % texts.length].repeat(index * 19) },
      })
      encode.mockClear()
      assert.equal(inspectJson(input), undefined)
      assert.equal(encode.mock.results.reduce((bytes, result) => bytes + (result.value as Uint8Array).byteLength, 0), Buffer.byteLength(JSON.stringify(input)), `JSON byte mismatch for case ${index}`)
    }
  } finally {
    encode.mockRestore()
  }
})

test.each(['ascii', '\u00e9\u6f22', '\ud83d\ude00', '\ud800\udfff\ud800', '"\\\n\u0000\u001f'])('should_enforce_exact_serialized_bytes_when_strings_contain_%s', text => {
  const payload = { values: [text.repeat(8193), { [text]: text }], padding: '' }
  const input = { ...createDocument('unicode-limit'), [text]: payload }
  payload.padding = 'x'.repeat(MAX_BYTES - Buffer.byteLength(JSON.stringify(input)))
  assert.equal(Buffer.byteLength(JSON.stringify(input)), MAX_BYTES)
  assert.equal(inspectJson(input), undefined)
  assert.equal(validateDocument(input).ok, true)
  payload.padding += 'x'
  assert.match(inspectJson(input)?.message ?? '', /5 MiB/)
  assert.equal(validateDocument(input).ok, false)
})

test('should_round_trip_exact_geometry_when_canonical_json_is_opened', () => {
  const document = sampleDiagram()
  document.connections[0] = { ...document.connections[0], points: [{ x: -10, y: 0 }, { x: 200, y: 90 }], labelPosition: { x: 0, y: 20 }, routeRevision: 0 }
  const result = parseDocument(JSON.stringify(document))
  assert.ok(result.ok)
  assert.deepEqual(result.value, document)
  assert.deepEqual(validateDocument(createDocument('blank')), { ok: true, value: createDocument('blank') })
})

test('should_reject_unsafe_fields_when_documents_are_invalid', () => {
  const cases: [string, (document: ReturnType<typeof sampleDiagram>) => void][] = [
    ['schemaVersion', document => { Object.assign(document, { schemaVersion: 2 }) }],
    ['entities[0].id', document => { document.entities[0].id = '__proto__' }],
    ['entities[0].x', document => { document.entities[0].x = Infinity }],
    ['entities[0].width', document => { document.entities[0].width = 0 }],
    ['entities[0].color', document => { document.entities[0].color = 'url(https://evil)' }],
    ['entities[0].icon', document => { document.entities[0].icon = '../../icon.svg' }],
    ['entities[0].status', document => { Object.assign(document.entities[0], { status: 'running' }) }],
    ['entities[0].label', document => { document.entities[0].label = 'x'.repeat(121) }],
    ['entities[0].subtitle', document => { document.entities[0].subtitle = 'x'.repeat(201) }],
    ['entities[8].label', document => { document.entities[8].label = 'x'.repeat(2001) }],
    ['connections[0].label', document => { document.connections[0].label = 'x'.repeat(81) }],
    ['connections[0].to', document => { document.connections[0].to = 'note' }],
    ['connections[0].to', document => { document.connections[0].to = document.connections[0].from }],
    ['connections[0].routeRevision', document => { document.connections[0].points = [{ x: 0, y: 0 }, { x: 1, y: 1 }]; document.connections[0].routeRevision = 99 }],
    ['entities[0].parentId', document => { document.entities[0].parentId = 'application' }],
    ['entities[1].parentId', document => { document.entities[1].parentId = 'users' }],
  ]
  for (const [path, mutate] of cases) {
    const document = sampleDiagram()
    mutate(document)
    const result = validateDocument(document)
    assert.equal(result.ok, false, path)
    if (!result.ok) assert.ok(result.errors.some(error => error.path === path), JSON.stringify(result.errors))
  }
})

test('should_reject_limits_and_malformed_input_when_parsing', () => {
  for (const text of ['{', 'null', ' '.repeat(5 * 1024 * 1024 + 1), '"' + '😀'.repeat(1400000) + '"']) assert.equal(parseDocument(text).ok, false)
  const document = sampleDiagram()
  document.entities = Array.from({ length: 101 }, (_, index) => ({ ...document.entities[3], id: `entity-${index}` }))
  assert.equal(validateDocument(document).ok, false)
  document.entities = sampleDiagram().entities
  document.connections = Array.from({ length: 151 }, (_, index) => ({ ...document.connections[0], id: `edge-${index}` }))
  assert.equal(validateDocument(document).ok, false)
})

test('should_build_only_known_fields_when_prototype_and_markup_payloads_are_opened', () => {
  const document = createDocument('safe', '<script>alert(1)</script>')
  const input = JSON.parse(JSON.stringify(document).replace('"entities":[]', '"__proto__":{"polluted":true},"entities":[]'))
  input.constructor = { prototype: { polluted: true } }
  input.asset = '<svg onload="alert(1)"/>'
  const result = validateDocument(input)
  assert.ok(result.ok)
  assert.deepEqual(result.value, document)
  assert.equal(Object.hasOwn(result.value, '__proto__'), false)
  assert.equal(({} as Record<string, unknown>).polluted, undefined)
})

test('should_import_nested_skill_meaning_when_unknown_glyphs_are_used', () => {
  const input = {
    title: 'Imported', subtitle: 'Synthetic data', direction: 'DOWN',
    groups: [{ id: 'outer', label: 'Tenant', color: 'fabric', nodes: [], groups: [{ id: 'inner', label: 'Trust', color: '#abc', nodes: [{ id: 'api', label: 'API', sub: 'Calls', icon: 'api', color: 'azure', status: 'live' }] }] }],
    nodes: [{ id: 'client', label: 'Client', icon: 'graph', color: 'source' }],
    edges: [{ from: 'client', to: 'outer', label: 'Calls', style: 'dashed' }],
    legend: [{ label: 'Planned', color: '#B45309', dashed: true }],
  }
  const result = importSkillSpec(input)
  assert.ok(result.ok)
  assert.deepEqual(importSkillSpec(input), result)
  assert.ok(result.warnings?.some(warning => warning.includes('graph')))
  assert.equal(result.value.entities.find(entity => entity.id === 'api')?.parentId, 'inner')
  assert.equal(result.value.entities.find(entity => entity.id === 'api')?.subtitle, 'Calls')
  assert.equal(result.value.entities.find(entity => entity.id === 'client')?.status, undefined)
  assert.equal(result.value.entities.find(entity => entity.id === 'client')?.icon, 'service')
  assert.equal(result.value.connections[0].to, 'outer')
  assert.equal(result.value.connections[0].points, undefined)
  assert.equal(result.value.direction, 'DOWN')
  assert.deepEqual(result.value.legend, input.legend)
})

test('should_reject_unsupported_skill_structures_when_assets_or_statuses_are_unsafe', () => {
  for (const icon of ['https://evil/icon.svg', '../icons/thing.svg', '<svg/>', 'thing.svg']) {
    assert.equal(importSkillSpec({ nodes: [{ id: 'one', label: 'One', icon }] }).ok, false)
  }
  for (const input of [
    { nodes: [{ id: 'one', label: 'One', status: 'running' }] },
    { nodes: [{ id: 'one', label: 'One', image: 'remote' }] },
    { nodes: [], edges: [{ from: 'none', to: 'none', style: 'dotted' }] },
    { groups: [{ id: 'one', label: 'One', dashed: true }] },
  ]) assert.equal(importSkillSpec(input).ok, false)
})

test('should_bound_unknown_json_fields_without_executing_hooks_when_validating', () => {
  const document = createDocument('bounded')
  assert.equal(validateDocument({ ...document, ignored: 'x'.repeat(5 * 1024 * 1024) }).ok, false)
  let called = false
  const result = validateDocument({ ...document, toJSON() { called = true; return document } })
  assert.equal(result.ok, false)
  assert.equal(called, false)
  const cycle: Record<string, unknown> = { ...document }
  cycle.ignored = cycle
  assert.equal(validateDocument(cycle).ok, false)
})

test('should_reject_invalid_graph_geometry_and_tokens_when_known_fields_are_malformed', () => {
  const patches = [
    { revision: 1.5 }, { direction: 'LEFT' }, { synthetic: 'yes' }, { legend: [{ label: 'Legend', color: 'javascript:bad' }] },
    { entities: [{ ...sampleDiagram().entities[3], layer: 'overlay' }] },
    { entities: [{ ...sampleDiagram().entities[3] }, { ...sampleDiagram().entities[3] }] },
    { entities: sampleDiagram().entities, connections: [{ ...sampleDiagram().connections[0], id: 'app' }] },
    { entities: sampleDiagram().entities, connections: [{ ...sampleDiagram().connections[0], sourceSide: 'corner' }] },
    { entities: sampleDiagram().entities, connections: [{ ...sampleDiagram().connections[0], points: [{ x: NaN, y: 0 }, { x: 1, y: 1 }], routeRevision: 0 }] },
    { entities: sampleDiagram().entities, connections: [{ ...sampleDiagram().connections[0], labelPosition: { x: 0, y: 0 } }] },
    { entities: sampleDiagram().entities, connections: [{ ...sampleDiagram().connections[0], points: [{ x: 0, y: 0 }], routeRevision: 0 }] },
  ]
  for (const patch of patches) assert.equal(validateDocument({ ...createDocument('invalid'), ...patch }).ok, false)
})

test('should_generate_collision_free_stable_ids_when_skill_ids_are_missing', () => {
  const input = { nodes: [{ label: 'Generated' }, { id: 'skill-node-1', label: 'Supplied' }], edges: [] }
  const result = importSkillSpec(input)
  assert.ok(result.ok)
  assert.equal(new Set(result.value.entities.map(entity => entity.id)).size, 2)
  assert.deepEqual(importSkillSpec(input), result)
  const tooMany = { groups: Array.from({ length: 2 }, (_, group) => ({ id: `g-${group}`, label: 'Group', nodes: Array.from({ length: 60 }, (_, node) => ({ id: `n-${group}-${node}`, label: 'Node' })) })) }
  assert.equal(importSkillSpec(tooMany).ok, false)
})

test('should_reject_accessors_and_sparse_arrays_without_execution_when_validating', () => {
  let called = false
  const entities: unknown[] = []
  Object.defineProperty(entities, '0', { enumerable: true, get() { called = true; return sampleDiagram().entities[3] } })
  const result = validateDocument({ ...createDocument('getter'), entities })
  assert.equal(result.ok, false)
  assert.equal(called, false)
  assert.equal(validateDocument({ ...createDocument('sparse'), entities: new Array(1) }).ok, false)
})

test('should_accept_the_exact_byte_limit_when_unknown_json_fields_are_stripped', () => {
  const input = { ...createDocument('exact-limit'), ignored: '' }
  input.ignored = 'x'.repeat(5 * 1024 * 1024 - new TextEncoder().encode(JSON.stringify(input)).byteLength)
  assert.equal(validateDocument(input).ok, true)
  input.ignored += 'x'
  assert.equal(validateDocument(input).ok, false)
})

test('should_preserve_all_frozen_quality_fixtures_when_they_are_reopened', () => {
  for (const document of qualityFixtures()) {
    const result = parseDocument(JSON.stringify(document))
    assert.ok(result.ok, result.ok ? document.id : `${document.id}: ${JSON.stringify(result.errors)}`)
    assert.deepEqual(result.value, document)
  }
})

test('should_reject_explicit_null_skill_tokens_when_only_missing_values_have_defaults', () => {
  for (const input of [
    { direction: null }, { title: null }, { synthetic: null },
    { nodes: [{ id: 'one', label: 'One', icon: null }] },
    { nodes: [{ id: 'one', label: 'One', color: null }] },
  ]) assert.equal(importSkillSpec(input).ok, false)
})

test('should_reject_array_method_overrides_without_calling_them_when_validating', () => {
  let called = false
  const entities = [sampleDiagram().entities[3]]
  Object.defineProperty(entities, 'map', { value: () => { called = true; return [] } })
  assert.equal(validateDocument({ ...createDocument('array-hook'), entities }).ok, false)
  assert.equal(called, false)
})

test('should_round_trip_all_finite_numeric_order_values_without_integer_or_range_restrictions', () => {
  const document = sampleDiagram()
  for (const order of [-Number.MAX_VALUE, -1e100, -0.125, 0, 3.25, Number.MAX_VALUE]) {
    document.entities[0].order = order
    const parsed = parseDocument(JSON.stringify(document))
    assert.ok(parsed.ok)
    assert.equal(parsed.value.entities[0].order, order)
  }
  for (const order of [Infinity, NaN, '4']) {
    Object.assign(document.entities[0], { order })
    assert.equal(validateDocument(document).ok, false)
  }
})

test('should_retain_stale_routes_without_accepting_future_or_invalid_route_revisions', () => {
  const document = sampleDiagram()
  document.revision = 3
  document.connections[0] = { ...document.connections[0], points: [{ x: 0, y: 0 }, { x: 1, y: 1 }], labelPosition: { x: 0.5, y: 0.5 }, routeRevision: 2 }
  const parsed = parseDocument(JSON.stringify(document))
  assert.ok(parsed.ok)
  assert.deepEqual(parsed.value.connections[0], document.connections[0])
  for (const routeRevision of [4, -1, 0.5, Infinity]) {
    document.connections[0].routeRevision = routeRevision
    assert.equal(validateDocument(document).ok, false)
  }
})