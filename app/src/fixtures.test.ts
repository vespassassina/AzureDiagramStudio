import assert from 'node:assert/strict'
import { test } from 'vitest'
import { qualityFixtures } from './fixtures.ts'
import { absolutePosition, measureEntity, sampleDiagram } from './model.ts'

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