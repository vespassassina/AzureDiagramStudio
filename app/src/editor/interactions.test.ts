import { describe, expect, it } from 'vitest'
import { absolutePosition, createDocument, entityTextGeometry } from '../model.ts'
import type { Entity } from '../model.ts'
import { allLibraryItems } from '../catalog.ts'
import { isSelectableIcon, selectionLibrary } from '../catalog/presentation.ts'
import { addConnectedCommand, alignmentPositions, captureFragment, freshIdMap, libraryItems, makeEntity, minimumSize, movePositions, nudgeCommand, parentChoices, readDrop, resizeCommand } from './interactions.ts'
import { effectiveGrid, snapPoint } from '../grid.ts'
import { applyCommand } from '../document/index.ts'

const group: Entity = { id: 'group', kind: 'boundary', label: 'Group', x: 80, y: 80, width: 400, height: 300, color: 'teal' }
const child: Entity = { id: 'child', parentId: 'group', kind: 'component', label: 'Child', icon: 'service', x: 32, y: 64, width: 220, height: 88, color: 'teal' }
const other: Entity = { ...child, id: 'other', parentId: null, x: 560 }
const document = { ...createDocument('test'), entities: [group, child, other], connections: [{ id: 'internal', from: 'group', to: 'child', label: 'Keep', style: 'solid' as const, arrow: 'forward' as const }, { id: 'external', from: 'child', to: 'other', label: 'Omit', style: 'solid' as const, arrow: 'forward' as const }] }

describe('editor interaction commands', () => {
  it('should_align_to_document_order_reference_and_preserve_fractional_distribution_targets_DGM110', () => {
    const source = {
      ...createDocument('alignment'),
      grid: { ...effectiveGrid(), snap: true, spacing: 8 },
      entities: [
        { ...child, id: 'a', parentId: null, x: 80, y: 120, width: 240, height: 88 },
        { ...child, id: 'b', parentId: null, x: 440, y: 240, width: 320, height: 104 },
        { ...child, id: 'c', parentId: null, x: 961, y: 360, width: 280, height: 96 },
        { ...child, id: 'u', parentId: null, x: 1280, y: 640, width: 220, height: 88 },
      ],
    }
    const leftTargets = [{ id: 'a', x: 80, y: 120 }, { id: 'b', x: 80, y: 240 }, { id: 'c', x: 80, y: 360 }]
    const baseline = applyCommand(source, { type: 'metadata', patch: {} })

    expect(applyCommand(source, { type: 'move', positions: leftTargets }).entities).toEqual(source.entities.map(entity => {
      const target = leftTargets.find(position => position.id === entity.id)
      const original = baseline.entities.find(candidate => candidate.id === entity.id)!
      return target ? { ...original, ...target } : original
    }))

    expect(alignmentPositions(source, ['c', 'b', 'a'], 'align-left')).toEqual([
      { id: 'a', x: 80, y: 120 }, { id: 'b', x: 80, y: 240 }, { id: 'c', x: 80, y: 360 },
    ])
    expect(alignmentPositions(source, ['c', 'b', 'a'], 'align-center')).toEqual([
      { id: 'a', x: 80, y: 120 }, { id: 'b', x: 40, y: 240 }, { id: 'c', x: 60, y: 360 },
    ])
    expect(alignmentPositions(source, ['c', 'b', 'a'], 'align-top')).toEqual([
      { id: 'a', x: 80, y: 120 }, { id: 'b', x: 440, y: 120 }, { id: 'c', x: 961, y: 120 },
    ])
    expect(alignmentPositions(source, ['a', 'c', 'b'], 'distribute-horizontal')).toEqual([
      { id: 'a', x: 80, y: 120 }, { id: 'b', x: 480.5, y: 240 }, { id: 'c', x: 961, y: 360 },
    ])
  })
  it('should_reject_alignment_targets_that_violate_nested_boundary_clearance_DGM110', () => {
    const outer = { ...group, id: 'outer', x: -81.5, y: 83.25, width: 1600, height: 1000 }
    const inner = { ...group, id: 'inner', parentId: 'outer', layer: 'foreground' as const, x: 25, y: 65, width: 1400, height: 800 }
    const source = {
      ...createDocument('nested-alignment'),
      entities: [outer, inner,
        { ...child, id: 'a', parentId: 'inner', x: 32, y: 96, width: 240, height: 88 },
        { ...child, id: 'b', parentId: 'inner', x: 600, y: 256, width: 320, height: 104 },
        { ...child, id: 'c', parentId: 'inner', x: 1050, y: 420, width: 280, height: 96 },
      ],
    }

    expect(alignmentPositions(source, ['a', 'b', 'c'], 'align-center')).toBeNull()
  })
  it('should_align_nested_roots_in_parent_local_coordinates_DGM110', () => {
    const outer = { ...group, id: 'outer', x: -81.5, y: 83.25, width: 1600, height: 1000 }
    const inner = { ...group, id: 'inner', parentId: 'outer', x: 25, y: 65, width: 1400, height: 800 }
    const source = {
      ...createDocument('nested-alignment'),
      entities: [outer, inner,
        { ...child, id: 'a', parentId: 'inner', x: 200, y: 96, width: 240, height: 88 },
        { ...child, id: 'b', parentId: 'inner', x: 600, y: 256, width: 320, height: 104 },
        { ...child, id: 'c', parentId: 'inner', x: 1050, y: 420, width: 280, height: 96 },
        { ...child, id: 'u', parentId: 'inner', x: 700, y: 650, width: 220, height: 88 },
      ],
    }

    expect(alignmentPositions(source, ['c', 'b', 'a'], 'align-center')).toEqual([
      { id: 'a', x: 200, y: 96 }, { id: 'b', x: 160, y: 256 }, { id: 'c', x: 180, y: 420 },
    ])
    expect(alignmentPositions(source, ['c', 'b', 'a'], 'distribute-horizontal')).toEqual([
      { id: 'a', x: 200, y: 96 }, { id: 'b', x: 585, y: 256 }, { id: 'c', x: 1050, y: 420 },
    ])
  })
  it('should_return_no_target_when_alignment_or_distribution_has_no_geometric_effect_DGM110', () => {
    const source = {
      ...createDocument('alignment-noop'),
      entities: [
        { ...child, id: 'a', parentId: null, x: 80, y: 120, width: 220, height: 88 },
        { ...child, id: 'b', parentId: null, x: 80, y: 280, width: 220, height: 88 },
        { ...child, id: 'c', parentId: null, x: 80, y: 440, width: 220, height: 88 },
      ],
    }

    expect(alignmentPositions(source, ['c', 'b', 'a'], 'align-left')).toBeNull()
    expect(alignmentPositions(source, ['c', 'b', 'a'], 'distribute-vertical')).toBeNull()
  })
  it.each([true, false])('should_preserve_fractional_distribution_without_grid_rounding_when_snap_is_%s_DGM110', snap => {
    const source = {
      ...createDocument('fractional-alignment'),
      grid: { ...effectiveGrid(), snap, spacing: 8 },
      entities: [
        { ...child, id: 'a', parentId: null, x: 80, y: 120, width: 240, height: 88 },
        { ...child, id: 'b', parentId: null, x: 440, y: 240, width: 320, height: 104 },
        { ...child, id: 'c', parentId: null, x: 961, y: 360, width: 280, height: 96 },
      ],
    }

    expect(alignmentPositions(source, ['c', 'b', 'a'], 'distribute-horizontal')).toEqual([
      { id: 'a', x: 80, y: 120 }, { id: 'b', x: 480.5, y: 240 }, { id: 'c', x: 961, y: 360 },
    ])
  })
  it('should_use_document_order_for_distribution_ties_and_reject_negative_gaps_DGM110', () => {
    const tied = {
      ...createDocument('tied-alignment'),
      entities: [
        { ...child, id: 'a', parentId: null, x: 80, y: 120, width: 240, height: 88 },
        { ...child, id: 'b', parentId: null, x: 80, y: 240, width: 320, height: 104 },
        { ...child, id: 'c', parentId: null, x: 960, y: 360, width: 280, height: 96 },
      ],
    }
    const overlapping = {
      ...tied,
      entities: [
        { ...tied.entities[0], x: 80 }, { ...tied.entities[1], x: 200 }, { ...tied.entities[2], x: 400 },
      ],
    }

    expect(alignmentPositions(tied, ['c', 'b', 'a'], 'distribute-horizontal')).toEqual([
      { id: 'a', x: 80, y: 120 }, { id: 'b', x: 480, y: 240 }, { id: 'c', x: 960, y: 360 },
    ])
    expect(alignmentPositions(overlapping, ['a', 'b', 'c'], 'distribute-horizontal')).toBeNull()
  })
  it('should_preserve_nested_containers_and_unrelated_entities_in_detached_move_preflight_DGM110', () => {
    const outer = { ...group, id: 'outer', parentId: null, layer: 'foreground' as const, x: -81.5, y: 83.25, width: 1600, height: 1000 }
    const inner = { ...group, id: 'inner', parentId: 'outer', x: 25, y: 65, width: 1400, height: 800 }
    const source = {
      ...createDocument('nested-preflight'),
      entities: [outer, inner,
        { ...child, id: 'a', parentId: 'inner', layer: 'foreground' as const, x: 200, y: 96, width: 240, height: 88 },
        { ...child, id: 'b', parentId: 'inner', layer: 'foreground' as const, x: 600, y: 256, width: 320, height: 104 },
        { ...child, id: 'c', parentId: 'inner', layer: 'foreground' as const, x: 1050, y: 420, width: 280, height: 96 },
        { ...child, id: 'u', parentId: 'inner', layer: 'foreground' as const, x: 700, y: 650, width: 220, height: 88 },
      ],
    }
    const positions = alignmentPositions(source, ['c', 'b', 'a'], 'align-center')!
    const result = applyCommand(source, { type: 'move', positions })
    const baseline = applyCommand(source, { type: 'metadata', patch: {} })

    expect(positions).toEqual([
      { id: 'a', x: 200, y: 96 }, { id: 'b', x: 160, y: 256 }, { id: 'c', x: 180, y: 420 },
    ])
    expect(absolutePosition(result, 'b')).toEqual({ x: 103.5, y: 404.25 })
    expect(absolutePosition(result, 'c')).toEqual({ x: 123.5, y: 568.25 })
    for (const id of ['outer', 'inner', 'u']) expect(result.entities.find(entity => entity.id === id)).toEqual(baseline.entities.find(entity => entity.id === id))
  })
  it('should_move_only_selected_parent_roots_and_carry_children_once_DGM110', () => {
    const source = {
      ...createDocument('parent-root-alignment'),
      entities: [
        { ...group, id: 'ga', parentId: null, layer: 'foreground' as const, x: 80, y: 80, width: 600, height: 400 },
        { ...group, id: 'gb', parentId: null, layer: 'foreground' as const, x: 900, y: 200, width: 600, height: 400 },
        { ...child, id: 'child-a', parentId: 'ga', layer: 'foreground' as const, x: 32, y: 96 },
        { ...child, id: 'child-b', parentId: 'gb', layer: 'foreground' as const, x: 32, y: 96 },
        { ...child, id: 'u', parentId: null, layer: 'foreground' as const, x: 1600, y: 600 },
      ],
    }
    const positions = alignmentPositions(source, ['ga', 'child-a', 'gb'], 'align-top')!
    const result = applyCommand(source, { type: 'move', positions })

    expect(positions).toEqual([{ id: 'ga', x: 80, y: 80 }, { id: 'gb', x: 900, y: 80 }])
    expect(result.entities.find(entity => entity.id === 'child-b')).toEqual(source.entities.find(entity => entity.id === 'child-b'))
    expect(absolutePosition(result, 'child-b')).toEqual({ x: 932, y: 176 })
    expect(result.entities.find(entity => entity.id === 'child-a')).toEqual(source.entities.find(entity => entity.id === 'child-a'))
    expect(result.entities.find(entity => entity.id === 'u')).toEqual(source.entities.find(entity => entity.id === 'u'))
  })
  it.each(['left', 'right', 'top', 'bottom'] as const)('should_place_addConnected_%s_with_gap64_in_absolute_space_and_convert_to_sibling_local', side => {
    const source = { ...document, grid: { ...effectiveGrid(), snap: false }, entities: [{ ...group, x: -81.5, y: 83.25 }, { ...group, id: 'inner', parentId: 'group', x: 25, y: 65 }, { ...child, parentId: 'inner' }, other] }
    const before = JSON.stringify(source)
    const command = addConnectedCommand(source, 'child', side, libraryItems[0], 'fresh', 'fresh-link')!
    expect(command.type).toBe('addConnected')
    expect(command.entity.parentId).toBe('inner')
    expect(command.connection).toMatchObject({ from: 'child', to: 'fresh', id: 'fresh-link', style: 'solid', arrow: 'forward', sourceSide: side, targetSide: { left: 'right', right: 'left', top: 'bottom', bottom: 'top' }[side] })
    const point = absolutePosition({ ...source, entities: [...source.entities, command.entity] }, 'fresh')
    const original = absolutePosition(source, 'child')
    const expected = {
      left: { x: original.x - command.entity.width - 64, y: original.y + (child.height - command.entity.height) / 2 },
      right: { x: original.x + child.width + 64, y: original.y + (child.height - command.entity.height) / 2 },
      top: { x: original.x + (child.width - command.entity.width) / 2, y: original.y - command.entity.height - 64 },
      bottom: { x: original.x + (child.width - command.entity.width) / 2, y: original.y + child.height + 64 },
    }[side]
    expect(point).toEqual(expected)
    expect(JSON.stringify(source)).toBe(before)
  })
  it.each([4, 8, 16, 128])('should_snap_addConnected_to_the_shared_absolute_zero_grid_when_spacing_is_%s', spacing => {
    const source = { ...document, grid: { ...effectiveGrid(), spacing }, entities: [{ ...group, x: -81, y: 83 }, child, other] }
    const command = addConnectedCommand(source, 'child', 'left', libraryItems[0], 'fresh', 'fresh-link')!
    const absolute = absolutePosition({ ...source, entities: [...source.entities, command.entity] }, 'fresh')
    expect(absolute).toEqual(snapPoint({ x: -81 + child.x - command.entity.width - 64, y: 83 + child.y + (child.height - command.entity.height) / 2 }, source.grid))
    expect(absolute.x).toBeLessThan(0)
  })
  it.each(['left', 'right', 'top', 'bottom'] as const)('should_start_inside_boundary_below_measured_header_for_%s_without_moving_existing_nodes', side => {
    const boundary = { ...group, label: 'Long boundary label '.repeat(5), subtitle: 'Measured boundary content header '.repeat(5), width: 240, x: -81, y: -83 }
    const source = { ...document, grid: { ...effectiveGrid(), spacing: 32 }, entities: [boundary, child, other] }
    const command = addConnectedCommand(source, 'group', side, libraryItems[0], 'fresh', 'fresh-link')!
    expect(command.entity.parentId).toBe('group')
    expect(command.entity.x).toBeGreaterThanOrEqual(24)
    expect(command.entity.y).toBeGreaterThanOrEqual(entityTextGeometry(boundary).textBottom + 24)
    const absolute = absolutePosition({ ...source, entities: [...source.entities, command.entity] }, 'fresh')
    expect(Math.abs(absolute.x % 32)).toBe(0)
    expect(Math.abs(absolute.y % 32)).toBe(0)
  })
  it('should_keep_negative_root_addConnected_coordinates_and_reject_nonconnectable_or_missing_sources', () => {
    const source = { ...document, grid: { ...effectiveGrid(), snap: false } }
    const entity = addConnectedCommand(source, 'other', 'top', libraryItems[0], 'fresh', 'fresh-link')!.entity
    expect(entity).toMatchObject({ parentId: null, y: other.y - entity.height - 64 })
    expect(entity.y).toBeLessThan(0)
    expect(addConnectedCommand(source, 'missing', 'right', libraryItems[0], 'fresh', 'fresh-link')).toBeNull()
    expect(addConnectedCommand({ ...source, entities: [{ ...other, kind: 'text' }] }, 'other', 'right', libraryItems[0], 'fresh', 'fresh-link')).toBeNull()
  })

  it('should_share_legacy_defaults_and_snap_to_absolute_zero_origin_without_mutation', () => {
    expect(effectiveGrid()).toEqual({ visible: true, style: 'dots', spacing: 8, snap: true, present: false, export: false })
    expect(snapPoint({ x: -11, y: 20 })).toEqual({ x: -8, y: 24 })
    expect(Object.hasOwn(document, 'grid')).toBe(false)
  })
  it('should_keep_fractional_insertion_move_and_keyboard_coordinates_when_snap_is_off', () => {
    const grid = { ...effectiveGrid(), snap: false }
    const source = { ...document, grid, entities: [{ ...group, x: 81.5, y: 83.25 }, child] }
    expect(makeEntity('component', { x: 11.5, y: -20.25 }, 'fresh', libraryItems[0], grid)).toMatchObject({ x: 11.5, y: -20.25 })
    expect(movePositions(source, [{ id: 'child', position: { x: 35.5, y: 69.25 } }])).toEqual([{ id: 'child', x: 35.5, y: 69.25 }])
    expect(nudgeCommand(source, ['group'], 'ArrowRight', false)).toEqual({ type: 'move', positions: [{ id: 'group', x: 89.5, y: 83.25 }] })
    expect(nudgeCommand(source, ['group'], 'ArrowDown', true)).toEqual({ type: 'move', positions: [{ id: 'group', x: 81.5, y: 147.25 }] })
  })
  it('should_snap_nested_absolute_positions_once_and_preserve_fragment_relative_spacing', () => {
    const source = { ...document, grid: { ...effectiveGrid(), spacing: 16 }, entities: [{ ...group, x: 81, y: 83 }, { ...group, id: 'inner', parentId: 'group', x: 25, y: 65 }, { ...child, parentId: 'inner' }, other] }
    expect(movePositions(source, [{ id: 'child', position: { x: 37, y: 69 } }])).toEqual([{ id: 'child', x: 38, y: 76 }])
    expect(movePositions(source, [{ id: 'group', position: { x: 95, y: 101 } }, { id: 'inner', position: { x: 29, y: 71 } }, { id: 'child', position: { x: 39, y: 77 } }])).toEqual([{ id: 'group', x: 96, y: 96 }])
    expect(nudgeCommand(source, ['child'], 'ArrowDown', true)).toEqual({ type: 'move', positions: [{ id: 'child', x: 38, y: 124 }] })
  })
  it('should_keep_selected_root_offsets_when_reactflow_reports_individually_quantized_positions', () => {
    const source = { ...document, entities: [{ ...group, x: 81, y: 83 }, { ...other, x: 563, y: 87 }] }
    expect(movePositions(source, [{ id: 'group', position: { x: 96, y: 96 } }, { id: 'other', position: { x: 584, y: 88 } }])).toEqual([{ id: 'group', x: 96, y: 96 }, { id: 'other', x: 578, y: 100 }])
  })
  it.each([true, false])('should_snap_resize_absolute_edges_only_when_enabled_%s_and_keep_containment_minima', snap => {
    const source = { ...document, grid: { ...effectiveGrid(), spacing: 16, snap }, entities: [{ ...group, x: 81, y: 83 }, { ...group, id: 'inner', parentId: 'group', x: 25, y: 65, width: 401, height: 301 }, { ...child, parentId: 'inner', x: 35.5, y: 67.25, width: 223.5, height: 91.25 }] }
    const inner = source.entities[1]
    const command = resizeCommand(source, inner, { x: 25, y: 65, width: 413.5, height: 311.25 })
    expect(command).toMatchObject({ type: 'resize', id: 'inner', width: snap ? 406 : 413.5, height: snap ? 316 : 311.25 })
    expect(resizeCommand(source, inner, { x: 25, y: 65, width: 100, height: 100 })).toMatchObject({ width: 283, height: 182.5 })
  })
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
    expect(nudgeCommand(document, ['child'], 'ArrowDown', true)).toEqual({ type: 'move', positions: [{ id: 'child', x: 32, y: 96 }] })
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