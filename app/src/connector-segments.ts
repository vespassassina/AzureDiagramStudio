import type { Point } from './model.ts'

export type SegmentHandle = { index: number; orientation: 'horizontal' | 'vertical'; x: number; y: number }

function samePoint(left: Point, right: Point) {
  return left.x === right.x && left.y === right.y
}

function orientation(start: Point, end: Point): SegmentHandle['orientation'] | null {
  if (start.y === end.y && start.x !== end.x) return 'horizontal'
  if (start.x === end.x && start.y !== end.y) return 'vertical'
  return null
}

function axis(point: Point, direction: SegmentHandle['orientation']) {
  return direction === 'horizontal' ? point.y : point.x
}

function withAxis(point: Point, direction: SegmentHandle['orientation'], value: number): Point {
  return direction === 'horizontal' ? { ...point, y: value } : { ...point, x: value }
}

/**
 * Pseudocode:
 * 1. Keep the source terminal segment pointing in its original outward direction.
 * 2. Keep the target terminal segment pointing in its original approach direction.
 * 3. Intersect those open bounds and clamp the requested moved-axis coordinate.
 * 4. Reject a route whose short terminal stubs leave no safe coordinate.
 */
function safeMovedAxis(points: Point[], index: number, direction: SegmentHandle['orientation'], requested: number): number | null {
  const epsilon = 0.001
  let minimum = -Infinity, maximum = Infinity
  if (index === 1) {
    const endpoint = axis(points[0], direction)
    const stub = axis(points[1], direction) - endpoint
    if (stub === 0) return null
    if (stub > 0) minimum = endpoint + epsilon
    else maximum = endpoint - epsilon
  }
  if (index + 1 === points.length - 2) {
    const endpoint = axis(points.at(-1)!, direction)
    const stub = endpoint - axis(points.at(-2)!, direction)
    if (stub === 0) return null
    if (stub > 0) maximum = endpoint - epsilon
    else minimum = endpoint + epsilon
  }
  if (minimum > maximum) return null
  return Math.min(maximum, Math.max(minimum, requested))
}

/** Return only movable internal runs, while allowing a straight route to gain one useful dogleg. */
export function segmentHandles(points: Point[]): SegmentHandle[] {
  const horizontal = points.length >= 2 && points.every(point => point.y === points[0].y) && points.some(point => point.x !== points[0].x)
  const vertical = points.length >= 2 && points.every(point => point.x === points[0].x) && points.some(point => point.y !== points[0].y)
  if (points.length === 2 || horizontal || vertical) {
    const direction = orientation(points[0], points[1])
    const routeDirection = horizontal ? 'horizontal' : vertical ? 'vertical' : direction
    return routeDirection ? [{ index: points.length === 2 ? 0 : Math.floor((points.length - 1) / 2), orientation: routeDirection, x: (points[0].x + points.at(-1)!.x) / 2, y: (points[0].y + points.at(-1)!.y) / 2 }] : []
  }
  const handles: SegmentHandle[] = []
  for (let index = 1; index < points.length - 2; index++) {
    const direction = orientation(points[index], points[index + 1])
    const before = orientation(points[index - 1], points[index])
    const after = orientation(points[index + 1], points[index + 2])
    if (!direction || !before || !after || before === direction || after === direction) continue
    handles.push({ index, orientation: direction, x: (points[index].x + points[index + 1].x) / 2, y: (points[index].y + points[index + 1].y) / 2 })
  }
  return handles
}

/** Move a selected run on its normal axis without altering either connected endpoint. */
export function adjustSegment(points: Point[], index: number, position: Point): Point[] | null {
  const handle = segmentHandles(points).find(candidate => candidate.index === index)
  if (!handle || !Number.isFinite(position.x) || !Number.isFinite(position.y)) return null
  const straight = points.every(point => point.y === points[0].y) || points.every(point => point.x === points[0].x)
  if (points.length === 2 || straight) {
    const start = points[0], end = points.at(-1)!
    const firstAxis = handle.orientation === 'horizontal' ? start.x : start.y
    const lastAxis = handle.orientation === 'horizontal' ? end.x : end.y
    const firstBend = firstAxis + (lastAxis - firstAxis) / 3
    const lastBend = firstAxis + (lastAxis - firstAxis) * 2 / 3
    return handle.orientation === 'horizontal'
      ? [start, { x: firstBend, y: start.y }, { x: firstBend, y: position.y }, { x: lastBend, y: position.y }, { x: lastBend, y: end.y }, end]
      : [start, { x: start.x, y: firstBend }, { x: position.x, y: firstBend }, { x: position.x, y: lastBend }, { x: end.x, y: lastBend }, end]
  }
  const next = points.map(point => ({ ...point }))
  const movedAxis = safeMovedAxis(points, index, handle.orientation, axis(position, handle.orientation))
  if (movedAxis === null) return null
  next[index] = withAxis(next[index], handle.orientation, movedAxis)
  next[index + 1] = withAxis(next[index + 1], handle.orientation, movedAxis)
  return samePoint(points[0], next[0]) && samePoint(points.at(-1)!, next.at(-1)!) ? next : null
}

/** Keep connection labels on the longest routed run after a manual adjustment. */
export function labelPositionForRoute(points: Point[]): Point {
  let best = 0, bestLength = -1
  for (let index = 0; index < points.length - 1; index++) {
    const length = Math.abs(points[index + 1].x - points[index].x) + Math.abs(points[index + 1].y - points[index].y)
    if (length >= bestLength) { best = index; bestLength = length }
  }
  return { x: (points[best].x + points[best + 1].x) / 2, y: (points[best].y + points[best + 1].y) / 2 }
}
