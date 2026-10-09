import { describe, expect, it } from 'vitest'
import { createDocument } from '../model.ts'
import type { Entity } from '../model.ts'
import { allLibraryItems } from '../catalog.ts'
import { isSelectableIcon, selectionLibrary } from '../catalog/presentation.ts'
import { captureFragment, freshIdMap, libraryItems, makeEntity, minimumSize, movePositions, nudgeCommand, parentChoices, readDrop } from './interactions.ts'

const group: Entity = { id: 'group', kind: 'boundary', label: 'Group', x: 80, y: 80, width: 400, height: 300, color: 'teal' }
const child: Entity = { id: 'child', parentId: 'group', kind: 'component', label: 'Child', icon: 'service', x: 32, y: 64, width: 220, height: 88, color: 'teal' }
const other: Entity = { ...child, id: 'other', parentId: null, x: 560 }
const document = { ...createDocument('test'), entities: [group, child, other], connections: [{ id: 'internal', from: 'group', to: 'child', label: 'Keep', style: 'solid' as const, arrow: 'forward' as const }, { id: 'external', from: 'child', to: 'other', label: 'Omit', style: 'solid' as const, arrow: 'forward' as const }] }

describe('editor interaction commands', () => {
  it('should_use_current_canonical_defaults_when_any_selectable_item_is_dropped', () => {
    expect(libraryItems).toEqual(selectionLibrary)
    for (const item of selectionLibrary) expect(readDrop(JSON.stringify({ icon: item.icon, label: '<script>untrusted</script>' }))).toEqual(item)
    const legacy = allLibraryItems.filter(item => !isSelectableIcon(item.icon))
    expect(legacy.length).toBeGreaterThan(0)
    for (const item of legacy) expect(readDrop(JSON.stringify({ icon: item.icon }))).toBeNull()
    for (const icon of ['__proto__', 'constructor', 'toString', '../../evil.svg']) expect(readDrop(JSON.stringify({ icon }))).toBeNull()
  })
  it('should_move_descendants_once_when_group_and_child_are_selected', () => {
    expect(nudgeCommand(document, ['group', 'child'], 'ArrowRight', false)).toEqual({ type: 'move', positions: [{ id: 'group', x: 88, y: 80 }] })
    expect(nudgeCommand(document, ['child'], 'ArrowDown', true)).toEqual({ type: 'move', positions: [{ id: 'child', x: 32, y: 128 }] })
    expect(movePositions(document, [{ id: 'group', position: { x: 96, y: 88 } }, { id: 'child', position: { x: 40, y: 72 } }])).toEqual([{ id: 'group', x: 96, y: 88 }])
  })
  it('should_capture_internal_graph_when_boundary_is_copied', () => {
    const fragment = captureFragment(document, ['group'])
    expect(fragment.entities.map(entity => entity.id)).toEqual(['group', 'child'])
    expect(fragment.connections.map(connection => connection.id)).toEqual(['internal'])
    expect(fragment.origin).toEqual({ x: 80, y: 80 })
    expect(captureFragment(document, ['child']).entities[0]).toMatchObject({ parentId: null, x: 112, y: 144 })
    let counter = 0
    expect(freshIdMap(fragment, () => `new-${++counter}`)).toEqual({ group: 'new-1', child: 'new-2', internal: 'new-3' })
    expect(document.entities[1]).toEqual(child)
  })
  it('should_use_catalog_defaults_when_external_drop_contains_extra_markup', () => {
    expect(readDrop('{"icon":"service","label":"<script>bad</script>","color":"url(evil)"}')).toMatchObject({ icon: 'service', label: 'Service', color: 'teal' })
    expect(readDrop('{"icon":"../../evil.svg"}')).toBeNull()
    expect(readDrop('<svg/>')).toBeNull()
    expect(readDrop('null')).toBeNull()
    expect(makeEntity('component', { x: 11, y: 20 }, 'fresh', readDrop('{"icon":"service"}')!)).toMatchObject({ id: 'fresh', x: 8, y: 24, parentId: null, status: undefined })
  })
  it('should_exclude_cycles_and_third_level_when_parent_choices_are_built', () => {
    const nested = { ...group, id: 'nested', parentId: 'group', x: 24, y: 64 }
    const graph = { ...document, entities: [group, nested, { ...child, parentId: 'nested' }, other] }
    expect(parentChoices(graph, ['group']).map(entity => entity.id)).toEqual([])
    expect(parentChoices(graph, ['nested']).map(entity => entity.id)).toEqual(['group'])
    expect(parentChoices(graph, ['other']).map(entity => entity.id)).toEqual(['group', 'nested'])
  })
  it('should_include_child_and_shared_text_measurements_when_resizing', () => {
    expect(minimumSize(document, group)).toMatchObject({ width: 276, height: 176 })
    const note = { ...child, kind: 'text' as const, label: Array(12).fill('line').join('\n') }
    expect(minimumSize({ ...document, entities: [group, note] }, group).height).toBeGreaterThan(300)
  })
})