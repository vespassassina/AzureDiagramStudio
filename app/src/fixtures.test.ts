import assert from 'node:assert/strict'
import { test } from 'vitest'
import { qualityFixtures } from './fixtures.ts'
import { absolutePosition, measureEntity, sampleDiagram } from './model.ts'
import { starterDocument, starterKeys } from './app/session.ts'
import { starterCatalog } from './app/starters.ts'
import { isSelectableIcon } from './catalog/presentation.ts'
import { entityTextGeometry } from './model.ts'
import { buildScene, renderSvg } from './scene.ts'
import { parseDocument } from './document/index.ts'

test('should_offer_eleven_guided_native_starters_with_frozen_references_DGM123', () => {
  const references = {
    'aks-baseline': 'https://learn.microsoft.com/en-us/azure/architecture/reference-architectures/containers/aks/baseline-aks',
    'container-apps-microservices': 'https://learn.microsoft.com/en-us/azure/architecture/example-scenario/serverless/microservices-with-container-apps',
    'web-queue-worker': 'https://learn.microsoft.com/en-us/azure/architecture/guide/architecture-styles/web-queue-worker',
    'hub-spoke-network': 'https://learn.microsoft.com/en-us/azure/architecture/networking/architecture/hub-spoke',
    'saas-deployment-stamps': 'https://learn.microsoft.com/en-us/azure/architecture/patterns/deployment-stamp',
    'file-claim-check': 'https://learn.microsoft.com/en-us/azure/architecture/patterns/claim-check',
    'azure-data-warehouse': 'https://learn.microsoft.com/en-us/azure/architecture/example-scenario/data/data-warehouse',
  }
  assert.deepEqual(starterKeys, ['web-api', 'event-driven', 'fabric', 'enterprise', ...Object.keys(references)])
  for (const key of starterKeys) {
    const document = starterDocument(key)
    assert.equal(document.schemaVersion, 1)
    assert.equal(document.synthetic, true)
    assert.ok(document.description)
    for (const heading of ['Overview', 'Flow', 'Decisions', 'Start Editing', 'Reference']) assert.ok(document.description.includes(`## ${heading}`), `${key}: ${heading}`)
    assert.match(document.description, /synthetic/i)
    assert.match(document.description, /not deployed/i)
    if (Object.hasOwn(references, key)) {
      assert.ok(document.description.includes(references[key as keyof typeof references]))
      assert.ok(document.description.includes('2026-10-17'))
      const words = document.description.split(/\s+/).length
      assert.ok(words >= 120 && words <= 200, `${key}: ${words} words`)
    }
  }
})

test('should_validate_native_geometry_icons_sources_and_artwork_independence_for_each_starter_DGM123', () => {
  assert.equal(new Set(starterCatalog.map(choice => choice.key)).size, 11)
  assert.equal(new Set(starterCatalog.map(choice => choice.label)).size, 11)
  for (const choice of starterCatalog) {
    const document = starterDocument(choice.key)
    const parsed = parseDocument(choice.source)
    assert.ok(parsed.ok)
    assert.deepEqual(parsed.value, document)
    assert.equal(choice.sourceCue, choice.reference ? 'Learn adaptation' : 'Synthetic example')
    if (!choice.reference) continue
    assert.ok(document.description!.includes(choice.reference))
    assert.ok(document.entities.filter(entity => entity.kind === 'component').length >= 6)
    assert.ok(document.entities.filter(entity => entity.kind === 'component').length <= 12)
    assert.equal(document.entities.filter(entity => entity.kind === 'boundary').length, 3)
    for (const entity of document.entities) {
      assert.ok([entity.x, entity.y, entity.width, entity.height].every(Number.isFinite))
      assert.ok(entityTextGeometry(entity).textBottom <= entity.height, `${choice.key}: text in ${entity.id}`)
      if (entity.kind === 'component') { assert.ok(isSelectableIcon(entity.icon!)); assert.equal(entity.status, 'synthetic') }
      if (!entity.parentId) continue
      const parent = document.entities.find(candidate => candidate.id === entity.parentId)!
      assert.ok(entity.x >= 0 && entity.y >= entityTextGeometry(parent).textBottom)
      assert.ok(entity.x + entity.width <= parent.width && entity.y + entity.height <= parent.height, `${choice.key}: ${entity.id} contained`)
    }
    for (const connection of document.connections) {
      assert.equal(connection.routeRevision, document.revision)
      assert.ok(connection.points && connection.points.length >= 2)
      assert.ok(connection.points.every(point => Number.isFinite(point.x) && Number.isFinite(point.y)))
    }
    const svg = renderSvg(buildScene(document))
    assert.match(svg, /<svg/)
    assert.equal(svg, renderSvg(buildScene({ ...document, description: '# Different inert guide' })))
    assert.ok(!svg.includes('## Overview'))
  }
})

test('should_retain_approved_essential_flows_and_optional_extensions_DGM123', () => {
  const flows = {
    'aks-baseline': [['clients', 'gateway'], ['gateway', 'load-balancer'], ['load-balancer', 'envoy'], ['envoy', 'workloads'], ['workloads', 'endpoints'], ['endpoints', 'registry'], ['endpoints', 'vault'], ['workloads', 'firewall']],
    'container-apps-microservices': [['ingestion', 'bus'], ['bus', 'workflow'], ['workflow', 'scheduler'], ['workflow', 'delivery'], ['workflow', 'cosmos'], ['delivery', 'redis']],
    'web-queue-worker': [['web', 'queue'], ['queue', 'worker'], ['worker', 'sql'], ['web', 'sql']],
    'hub-spoke-network': [['workload-a', 'firewall'], ['workload-b', 'firewall']],
    'saas-deployment-stamps': [['tenants', 'front'], ['front', 'apim'], ['apim', 'map'], ['apim', 'app-a'], ['apim', 'app-b'], ['app-a', 'sql-a'], ['app-b', 'sql-b']],
    'file-claim-check': [['sender', 'blob'], ['blob', 'events'], ['events', 'bus'], ['bus', 'consumer'], ['consumer', 'blob']],
    'azure-data-warehouse': [['sql-server', 'lake'], ['oracle', 'lake'], ['azure-sql', 'lake'], ['lake', 'factory'], ['factory', 'synapse'], ['synapse', 'analysis'], ['analysis', 'powerbi']],
  } as const
  for (const key of Object.keys(flows) as (keyof typeof flows)[]) {
    const document = starterDocument(key)
    for (const [from, to] of flows[key]) assert.ok(document.connections.some(connection => connection.from === from && connection.to === to && connection.style === 'solid'), `${key}: ${from} -> ${to}`)
    if (key === 'web-queue-worker') for (const target of ['cache', 'cosmos', 'remote']) assert.ok(document.connections.filter(connection => connection.to === target).every(connection => connection.style === 'dashed'))
    if (key === 'hub-spoke-network') {
      assert.ok(!document.connections.some(connection => [connection.from, connection.to].every(id => ['workload-a', 'workload-b'].includes(id))))
      assert.ok(document.connections.filter(connection => connection.from === 'vpn' || connection.to === 'vpn').every(connection => connection.style === 'dashed'))
    }
    if (key === 'saas-deployment-stamps') assert.ok(!document.connections.some(connection => (connection.from.endsWith('-a') && connection.to.endsWith('-b')) || (connection.from.endsWith('-b') && connection.to.endsWith('-a'))))
    if (key === 'container-apps-microservices') assert.ok(!document.entities.some(entity => /package|WAF|DocumentDB/i.test(entity.label)))
    if (key === 'azure-data-warehouse') { assert.ok(document.entities.some(entity => entity.label === 'Azure Analysis Services')); assert.ok(document.description!.includes('2022')) }
  }
})

test('should_separate_measured_component_tiles_when_nested_fixture_siblings_share_a_parent', () => {
  const nested = qualityFixtures().find(document => document.id === 'nested-cross-links-v1')!
  const components = nested.entities.filter(entity => entity.kind === 'component')
  const overlaps: string[] = []
  for (const [index, component] of components.entries()) {
    const size = measureEntity(component)
    for (const sibling of components.slice(index + 1)) {
      if (component.parentId !== sibling.parentId) continue
      const siblingSize = measureEntity(sibling)
      if (component.x < sibling.x + siblingSize.width && sibling.x < component.x + size.width
        && component.y < sibling.y + siblingSize.height && sibling.y < component.y + size.height) {
        overlaps.push(`${component.id}/${sibling.id} in ${component.parentId}`)
      }
    }
  }
  assert.deepEqual(overlaps, [])
  const gateway = nested.entities.find(entity => entity.id === 'gateway')!
  const app = nested.entities.find(entity => entity.id === 'app')!
  assert.ok(gateway.y + measureEntity(gateway).height < app.y, 'The complete gateway must finish with a positive gap before app')
})

test('should_contain_each_measured_child_when_nested_fixture_has_two_boundary_levels', () => {
  const nested = qualityFixtures().find(document => document.id === 'nested-cross-links-v1')!
  const overflow: string[] = []
  const parents = new Set<string>()
  for (const child of nested.entities) {
    if (!child.parentId) continue
    const parent = nested.entities.find(entity => entity.id === child.parentId)!
    assert.equal(parent.kind, 'boundary')
    parents.add(parent.id)
    const size = measureEntity(child)
    const parentSize = measureEntity(parent)
    if (child.x < 0 || child.y < 0 || child.x + size.width > parentSize.width || child.y + size.height > parentSize.height) {
      overflow.push(`${child.id} outside ${parent.id}`)
    }
  }
  assert.deepEqual([...parents].sort(), ['application', 'data', 'platform'])
  assert.deepEqual(overflow, [])
})

test('should_keep_outside_annotation_below_its_owner_when_nested_fixture_boundary_grows', () => {
  const nested = qualityFixtures().find(document => document.id === 'nested-cross-links-v1')!
  const owner = nested.entities.find(entity => entity.id === 'platform')!
  const annotation = nested.entities.find(entity => entity.id === 'note')!
  assert.equal(annotation.parentId, null)
  const ownerPosition = absolutePosition(nested, owner.id)
  const annotationPosition = absolutePosition(nested, annotation.id)
  assert.ok(annotationPosition.y > ownerPosition.y + measureEntity(owner).height, 'Outside annotation must have a positive gap below the outer boundary')
})

test('should_preserve_all_nested_fixture_semantics_when_only_authored_geometry_is_corrected', () => {
  const nested = qualityFixtures().find(document => document.id === 'nested-cross-links-v1')!
  const expected = { ...sampleDiagram(), id: 'nested-cross-links-v1', title: 'Nested boundaries and long labels' }
  expected.entities = expected.entities.map(entity => entity.id === 'gateway'
    ? { ...entity, label: 'UnbrokenArchitectureComponentName'.repeat(3), subtitle: 'Gateway ownership and event delivery '.repeat(3) }
    : entity)
  assert.deepEqual({ ...nested, entities: nested.entities.map(entity => ({ ...entity, x: 0, y: 0, width: 0, height: 0 })) },
    { ...expected, entities: expected.entities.map(entity => ({ ...entity, x: 0, y: 0, width: 0, height: 0 })) })
})

test('should_preserve_exact_stress_fixture_when_nested_quality_geometry_is_corrected', () => {
  const stress = qualityFixtures().find(document => document.id === 'stress-v1')!
  assert.equal(stress.entities.length, 100)
  assert.equal(stress.connections.length, 150)
  for (const [index, entity] of stress.entities.entries()) {
    assert.deepEqual(entity, {
      id: `node-${index}`, kind: 'component', parentId: null, layer: 'foreground', label: `Service ${index}`, icon: 'service',
      color: index % 2 ? 'teal' : 'azure', x: (index % 10) * 260, y: Math.floor(index / 10) * 128, width: 220, height: 88,
    })
  }
  for (const [index, connection] of stress.connections.entries()) {
    assert.deepEqual(connection, {
      id: `edge-${index}`, from: `node-${index % 100}`, to: `node-${(index % 100 + 1 + Math.floor(index / 100)) % 100}`,
      label: '', style: 'solid', arrow: 'forward',
    })
  }
})