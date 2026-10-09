import assert from 'node:assert/strict'
import { test } from 'vitest'
import * as model from './model.ts'
import { buildScene, renderSvg } from './scene.ts'
import { GENERIC_ICONS, AZURE_MANIFEST, isColorKey, isIconKey, resolveColor } from './catalog.ts'
import inventory from './catalog/inventory.json'
import legacy from './catalog/legacy.json'

test('should_round_trip_canonical_metadata_when_blank_document_is_reopened', () => {
  assert.equal(typeof model.createDocument, 'function')
  const document = model.createDocument('blank-001')
  assert.deepEqual(JSON.parse(JSON.stringify(document)), {
    schemaVersion: 1, id: 'blank-001', title: 'Untitled architecture', subtitle: '',
    synthetic: false, legendVisible: true, legend: [], revision: 0,
    direction: 'RIGHT', entities: [], connections: [],
  })
})

test('should_round_trip_explicitly_synthetic_metadata_when_sample_is_reopened', () => {
  const document = model.sampleDiagram()
  assert.equal(document.schemaVersion, 1)
  assert.equal(document.id, 'sample-commerce')
  assert.equal(document.synthetic, true)
  assert.equal(document.revision, 0)
  assert.equal(typeof document.subtitle, 'string')
  assert.equal(document.legendVisible, true)
  assert.deepEqual(JSON.parse(JSON.stringify(document)), document)
  assert.ok(document.entities.every(entity => entity.parentId !== undefined && entity.layer === 'foreground'))
})

test('should_grow_complete_text_when_labels_subtitles_notes_and_boundaries_are_long', () => {
  assert.equal(typeof model.measureEntity, 'function')
  for (const kind of ['component', 'boundary', 'text', 'rectangle'] as const) {
    const entity = { id: kind, kind, label: 'UnbrokenArchitectureLabel'.repeat(5), subtitle: 'Subtitle '.repeat(20), x: 0, y: 0, width: 220, height: 40, color: 'azure' }
    const size = model.measureEntity(entity)
    assert.ok(size.width >= entity.width)
    assert.ok(size.height > entity.height, kind)
    assert.deepEqual(model.measureEntity({ ...entity, ...size }), size)
  }
  assert.throws(() => model.wrapText('label', 0), /positive/)
  assert.deepEqual(model.wrapText('First\nSecond', 22), ['First', 'Second'])
})

test('should_render_document_metadata_when_a_non_synthetic_document_is_exported', () => {
  const document = { ...model.sampleDiagram(), synthetic: false, subtitle: 'Custom subtitle', legendVisible: false }
  const svg = renderSvg(buildScene(document))
  assert.ok(svg.includes('Custom subtitle'))
  assert.ok(!svg.includes('SYNTHETIC EXAMPLE'))
  assert.ok(!svg.includes('Dashed outline:'))
})

test('should_ignore_saved_routes_when_the_document_revision_changes', () => {
  const document = model.sampleDiagram()
  document.connections[0] = { ...document.connections[0], points: [{ x: -1000, y: -1000 }, { x: -900, y: -900 }], routeRevision: 0 }
  assert.equal(buildScene(document).connections[0].start.x, -1000)
  assert.notEqual(buildScene({ ...document, revision: 1 }).connections[0].start.x, -1000)
  const invalidated = model.invalidateRoutes(document).connections[0]
  assert.equal(invalidated.points, undefined)
  assert.equal(invalidated.routeRevision, undefined)
})

test('should_expose_approved_generics_and_safe_styles_when_catalog_is_used', () => {
  assert.equal(Object.keys(GENERIC_ICONS).length, 12)
  assert.equal(AZURE_MANIFEST.length, 639)
  assert.equal(AZURE_MANIFEST.length, inventory.archives.azure.uniqueItemCount + 1)
  assert.equal(legacy.length, 24)
  for (const oldItem of legacy) {
    const item = AZURE_MANIFEST.find(candidate => candidate.icon === oldItem.icon)
    assert.ok(item, oldItem.icon)
    assert.equal(item.label, oldItem.label)
    assert.equal(item.subtitle, oldItem.subtitle)
    assert.equal(item.source.sha256, oldItem.sha256)
  }
  for (const color of ['azure', 'fabric', 'databricks', 'purview', 'm365', 'foundry', 'source', 'teal', 'amber', 'rose', 'gray', '#A1B2C3', '#abc']) assert.ok(isColorKey(color))
  assert.equal(resolveColor('databricks').main, '#E8412C')
  assert.equal(resolveColor('#A1B2C3').main, '#A1B2C3')
  for (const color of ['toString', '__proto__', '#xyz', 'url(http://example.com)', '#12345']) assert.equal(isColorKey(color), false)
  assert.equal(isIconKey('../../arbitrary.svg'), false)
  assert.equal(isIconKey('toString'), false)
})

test('should_keep_100_transactions_when_session_history_exceeds_the_limit', () => {
  let history: model.History = { past: [], present: model.createDocument('history'), future: [] }
  for (let revision = 1; revision <= 110; revision++) history = model.historyCommit(history, { ...history.present, revision })
  assert.equal(history.past.length, 100)
  assert.equal(history.past[0].revision, 10)
})

test('should_provide_deterministic_canonical_documents_when_quality_fixtures_are_requested', async () => {
  const { qualityFixtures } = await import('./fixtures.ts')
  const fixtures = qualityFixtures()
  assert.deepEqual(fixtures, qualityFixtures())
  assert.equal(fixtures.length, 6)
  assert.equal(new Set(fixtures.map(document => document.id)).size, 6)
  for (const document of fixtures) {
    assert.equal(document.schemaVersion, 1)
    assert.equal(document.synthetic, true)
    assert.deepEqual(JSON.parse(JSON.stringify(document)), document)
    assert.ok(document.entities.every(entity => entity.parentId !== undefined && entity.layer !== undefined))
  }
  const simple = fixtures.find(document => document.id === 'three-tier-v1')!
  assert.equal(simple.entities.filter(entity => entity.kind === 'component').length, 8)
  assert.equal(simple.entities.filter(entity => entity.kind === 'boundary').length, 2)
  assert.equal(simple.connections.length, 8)
  const stress = fixtures.find(document => document.id === 'stress-v1')!
  assert.equal(stress.entities.length, 100)
  assert.equal(stress.connections.length, 150)
})