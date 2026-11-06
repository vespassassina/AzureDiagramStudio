import { describe, expect, it } from 'vitest'
import { adjustSegment, labelPositionForRoute, segmentHandles } from './connector-segments.ts'

describe('connector segment manipulation', () => {
  it('should_create_an_orthogonal_dogleg_when_dragging_a_straight_route_DGM148', () => {
    const points = [{ x: -40, y: 20 }, { x: 260, y: 20 }]

    const adjusted = adjustSegment(points, 0, { x: 0, y: 84 })

    expect(adjusted).toEqual([
      { x: -40, y: 20 },
      { x: 60, y: 20 },
      { x: 60, y: 84 },
      { x: 160, y: 84 },
      { x: 160, y: 20 },
      { x: 260, y: 20 },
    ])
    expect(labelPositionForRoute(adjusted!)).toEqual({ x: 210, y: 20 })
  })

  it('should_preserve_cardinal_approaches_for_reversed_horizontal_and_vertical_straight_routes_DGM148_repair1', () => {
    expect(adjustSegment([{ x: 260, y: 20 }, { x: -40, y: 20 }], 0, { x: 0, y: 84 })).toEqual([
      { x: 260, y: 20 }, { x: 160, y: 20 }, { x: 160, y: 84 }, { x: 60, y: 84 }, { x: 60, y: 20 }, { x: -40, y: 20 },
    ])
    expect(adjustSegment([{ x: 20, y: 260 }, { x: 20, y: -40 }], 0, { x: 84, y: 0 })).toEqual([
      { x: 20, y: 260 }, { x: 20, y: 160 }, { x: 84, y: 160 }, { x: 84, y: 60 }, { x: 20, y: 60 }, { x: 20, y: -40 },
    ])
  })

  it('should_move_only_the_perpendicular_coordinate_of_an_internal_segment_DGM148', () => {
    const points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 100 }, { x: 180, y: 100 }, { x: 180, y: 160 }]

    expect(segmentHandles(points)).toEqual([
      { index: 1, orientation: 'vertical', x: 40, y: 50 },
      { index: 2, orientation: 'horizontal', x: 110, y: 100 },
    ])
    expect(adjustSegment(points, 2, { x: 0, y: 132 })).toEqual([
      { x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 132 }, { x: 180, y: 132 }, { x: 180, y: 160 },
    ])
    expect(adjustSegment(points, 1, { x: 72, y: 0 })).toEqual([
      { x: 0, y: 0 }, { x: 72, y: 0 }, { x: 72, y: 100 }, { x: 180, y: 100 }, { x: 180, y: 160 },
    ])
  })

  it('should_refuse_endpoint_and_degenerate_segments_DGM148', () => {
    const points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 100 }, { x: 180, y: 100 }, { x: 180, y: 160 }]

    expect(adjustSegment(points, 0, { x: 0, y: 20 })).toBeNull()
    expect(adjustSegment(points, 3, { x: 0, y: 20 })).toBeNull()
    expect(segmentHandles([{ x: 0, y: 0 }, { x: 0, y: 0 }])).toEqual([])
  })

  it('should_clamp_first_and_last_editable_runs_before_terminal_stubs_reverse_DGM148_repair1', () => {
    const points = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 100 }, { x: 180, y: 100 }, { x: 180, y: 160 }]

    const first = adjustSegment(points, 1, { x: -20, y: 0 })!
    const last = adjustSegment(points, 2, { x: 0, y: 200 })!

    expect(first[1].x).toBeGreaterThan(0)
    expect(first[2].x).toBeGreaterThan(0)
    expect(last[2].y).toBeLessThan(160)
    expect(last[3].y).toBeLessThan(160)
    expect(adjustSegment([{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }, { x: 2, y: 2 }], 1, { x: -20, y: 0 })![1].x).toBeGreaterThan(0)
  })
})
