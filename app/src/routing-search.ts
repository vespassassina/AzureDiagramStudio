import { EPS, vectors } from './routing-geometry.ts'
import type { Box, Port } from './routing-geometry.ts'
import type { Point } from './model.ts'

export type Work = { gridCells: number; expandedStates: number; maxCells: number }
export type Segment = { a: Point; b: Point }
export type Channel = { axis: 'x' | 'y'; source: number; target: number; bridge: number; forward: boolean }
type Entry = { state: number; score: number; cost: number }
const MAX_CELLS = 500_000
export const MAX_WORK = { gridCells: 50_000_000, expandedStates: 4_000_000 }
// 2.1px ink plus a visible gap (also clears the 4.1px dark-background halo).
export const CHANNEL_PITCH = 3.2

function middleEnvelopes(previous: Segment[], horizontal: boolean, endpoints: Port[]): Box[] {
  let boxes = previous.flatMap(({ a, b }) => {
    if ((a.y === b.y) !== horizontal) return []
    const low = horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y)
    const high = horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y)
    if (high === low) return []
    // Reserve all segments, not only long individual grid legs: otherwise a
    // staircase could evade clearance by splitting a long merged middle run.
    return [horizontal
      ? { left: low, right: high, top: a.y - CHANNEL_PITCH, bottom: a.y + CHANNEL_PITCH }
      : { left: a.x - CHANNEL_PITCH, right: a.x + CHANNEL_PITCH, top: low, bottom: high }]
  })
  // Dense valid ports are closer than an ink width. Keep a bounded local fan
  // (24px outward, 48px transverse) accessible; otherwise earlier bends
  // can fence in an unrouted port before it reaches any free middle channel.
  for (const port of endpoints) {
    const point = port.point, x = port.heading % 2 === 0 ? 24 : 48, y = port.heading % 2 === 0 ? 48 : 24
    const zone = { left: point.x - x, right: point.x + x, top: point.y - y, bottom: point.y + y }
    boxes = boxes.flatMap(box => {
      // Clip only longitudinally when the full stroke envelope fits in the
      // local fan. Four-way rectangle subtraction creates artificial open
      // seams that an orthogonal path could incorrectly use as a corridor.
      if (horizontal) {
        if (box.top < zone.top || box.bottom > zone.bottom || box.right <= zone.left || box.left >= zone.right) return [box]
        return [{ ...box, right: Math.max(box.left, zone.left) }, { ...box, left: Math.min(box.right, zone.right) }].filter(part => part.left < part.right)
      }
      if (box.left < zone.left || box.right > zone.right || box.bottom <= zone.top || box.top >= zone.bottom) return [box]
      return [{ ...box, bottom: Math.max(box.top, zone.top) }, { ...box, top: Math.min(box.bottom, zone.bottom) }].filter(part => part.top < part.bottom)
    })
  }
  return boxes
}

function lowerBound(values: number[], value: number): number {
  let low = 0, high = values.length
  while (low < high) {
    const middle = (low + high) >>> 1
    if (values[middle] < value) low = middle + 1
    else high = middle
  }
  return low
}

class Heap {
  entries: Entry[] = []
  less(a: Entry, b: Entry) { return a.score !== b.score ? a.score < b.score : a.cost !== b.cost ? a.cost < b.cost : a.state < b.state }
  push(entry: Entry) {
    let index = this.entries.length
    this.entries.push(entry)
    while (index) {
      const parent = (index - 1) >>> 1
      if (!this.less(entry, this.entries[parent])) break
      this.entries[index] = this.entries[parent]; index = parent
    }
    this.entries[index] = entry
  }
  pop(): Entry | undefined {
    const first = this.entries[0], last = this.entries.pop()
    if (!this.entries.length || !last) return first
    let index = 0
    while (index * 2 + 1 < this.entries.length) {
      let child = index * 2 + 1
      if (child + 1 < this.entries.length && this.less(this.entries[child + 1], this.entries[child])) child++
      if (!this.less(this.entries[child], last)) break
      this.entries[index] = this.entries[child]; index = child
    }
    this.entries[index] = last
    return first
  }
}

// Rasterize segment midpoints with rectangular difference arrays. This costs
// O(obstacles + grid cells), rather than testing every expanded A* neighbour
// against every obstacle. Strict interiors leave the padded perimeter usable.
function raster(rectangles: Box[], xs: number[], ys: number[]): Uint8Array {
  const stride = xs.length + 1, diff = new Int16Array(stride * (ys.length + 1))
  for (const box of rectangles) {
    const x0 = lowerBound(xs, box.left + EPS), x1 = lowerBound(xs, box.right - EPS)
    const y0 = lowerBound(ys, box.top + EPS), y1 = lowerBound(ys, box.bottom - EPS)
    if (x0 >= x1 || y0 >= y1) continue
    diff[y0 * stride + x0]++; diff[y0 * stride + x1]--
    diff[y1 * stride + x0]--; diff[y1 * stride + x1]++
  }
  const result = new Uint8Array(xs.length * ys.length)
  for (let y = 0; y < ys.length; y++) for (let x = 0; x < xs.length; x++) {
    const i = y * stride + x
    const count = diff[i] + (x ? diff[i - 1] : 0) + (y ? diff[i - stride] : 0) - (x && y ? diff[i - stride - 1] : 0)
    diff[i] = count
    result[y * xs.length + x] = count > 0 ? 1 : 0
  }
  return result
}

function occupancy(segments: Segment[], xs: number[], ys: number[]): [Float32Array, Float32Array] {
  const horizontal = new Float32Array(xs.length * ys.length), vertical = new Float32Array(xs.length * ys.length)
  for (const { a, b } of segments) {
    if (a.y === b.y) {
      const y = lowerBound(ys, a.y)
      if (ys[y] !== a.y) continue
      const end = lowerBound(xs, Math.max(a.x, b.x))
      for (let x = lowerBound(xs, Math.min(a.x, b.x)); x < end; x++) horizontal[y * xs.length + x] += 4
    } else {
      const x = lowerBound(xs, a.x)
      if (xs[x] !== a.x) continue
      const end = lowerBound(ys, Math.max(a.y, b.y))
      for (let y = lowerBound(ys, Math.min(a.y, b.y)); y < end; y++) vertical[y * xs.length + x] += 4
    }
  }
  return [horizontal, vertical]
}

// Build a finite obstacle/channel grid, then run A* with heading in the state.
// Length, bends and occupied-channel cost are positive; Manhattan distance is
// an admissible heuristic. Stable coordinate/state ordering breaks every tie.
// Both per-edge allocation and aggregate work have explicit failure limits.
export function searchRoute(start: Port, end: Port, rectangles: Box[], domain: Box, tracks: Point[], previous: Segment[], work: Work, labelFor?: (segment: Segment) => Point | undefined, permit?: (a: Point, b: Point) => boolean, parallel: Segment[] = [], channel?: Channel): { points: Point[]; label?: Point } | undefined {
  const horizontalEnvelopes = middleEnvelopes(parallel, true, [start, end]), verticalEnvelopes = middleEnvelopes(parallel, false, [start, end])
  const coordinates = (axis: 'x' | 'y') => {
    const low = axis === 'x' ? domain.left : domain.top, high = axis === 'x' ? domain.right : domain.bottom
    const values = [low, high, start.stub[axis], end.stub[axis], ...tracks.map(point => point[axis]),
      ...[...rectangles, ...horizontalEnvelopes, ...verticalEnvelopes].flatMap(box => axis === 'x' ? [box.left, box.right] : [box.top, box.bottom])]
    return [...new Set(values.filter(value => value >= low && value <= high))].sort((a, b) => a - b)
  }
  const xs = coordinates('x'), ys = coordinates('y'), width = xs.length, cells = width * ys.length
  if (!xs.every(Number.isFinite) || !ys.every(Number.isFinite)) throw new Error('nonfinite routing coordinates')
  if (xs.length > 1024 || ys.length > 1024 || cells > MAX_CELLS || work.gridCells + cells > MAX_WORK.gridCells) throw new Error('routing grid work limit exceeded')
  work.gridCells += cells; work.maxCells = Math.max(work.maxCells, cells)
  const midX = xs.slice(1).map((value, i) => xs[i] + (value - xs[i]) / 2), midY = ys.slice(1).map((value, i) => ys[i] + (value - ys[i]) / 2)
  const blockedH = raster(rectangles, midX, ys), blockedV = raster(rectangles, xs, midY)
  const mergedH = raster(horizontalEnvelopes, midX, ys), mergedV = raster(verticalEnvelopes, xs, midY)
  const [occupiedH, occupiedV] = occupancy(previous, xs, ys)
  const first = lowerBound(ys, start.stub.y) * width + lowerBound(xs, start.stub.x)
  const target = lowerBound(ys, end.stub.y) * width + lowerBound(xs, end.stub.x)
  const costs = new Float64Array(cells * 8).fill(Infinity), parents = new Int32Array(cells * 8).fill(-1)
  const labelAt = new Map<number, Point>(), labelCache = new Map<number, Point | undefined>()
  const heap = new Heap(), initial = first * 8 + start.heading * 2 + (labelFor ? 0 : 1)
  const heuristic = (point: number) => Math.abs(xs[point % width] - end.stub.x) + Math.abs(ys[Math.floor(point / width)] - end.stub.y)
  costs[initial] = 0; heap.push({ state: initial, cost: 0, score: heuristic(first) })
  while (heap.entries.length) {
    const entry = heap.pop()!
    if (entry.cost !== costs[entry.state]) continue
    if (++work.expandedStates > MAX_WORK.expandedStates) throw new Error('routing search work limit exceeded')
    const point = Math.floor(entry.state / 8), heading = Math.floor(entry.state % 8 / 2), labeled = entry.state % 2, x = point % width, y = Math.floor(point / width)
    if (point === target && heading !== end.heading && labeled) {
      const path: Point[] = []
      let label: Point | undefined
      for (let state = entry.state; state !== -1; state = parents[state]) {
        const index = Math.floor(state / 8)
        path.push({ x: xs[index % width], y: ys[Math.floor(index / width)] })
        if (labelAt.has(state)) label = labelAt.get(state)
      }
      return { points: path.reverse(), label }
    }
    for (let direction = 0; direction < 4; direction++) {
      if (direction === (heading + 2) % 4) continue
      const nx = x + vectors[direction].x, ny = y + vectors[direction].y
      if (nx < 0 || nx >= width || ny < 0 || ny >= ys.length) continue
      if (permit && !permit({ x: xs[x], y: ys[y] }, { x: xs[nx], y: ys[ny] })) continue
      const horizontal = direction % 2 === 0, index = horizontal ? y * width + Math.min(x, nx) : Math.min(y, ny) * width + x
      if (horizontal ? blockedH[y * (width - 1) + Math.min(x, nx)] : blockedV[index]) continue
      const merged = horizontal ? mergedH[y * (width - 1) + Math.min(x, nx)] : mergedV[index]
      if (merged) continue
      const length = Math.abs(xs[nx] - xs[x]) + Math.abs(ys[ny] - ys[y])
      let channelCost = 0
      if (channel) {
        const along = channel.axis === 'y' ? (xs[x] + xs[nx]) / 2 : (ys[y] + ys[ny]) / 2
        const middleDirection = horizontal ? channel.axis === 'y' : channel.axis === 'x'
        const lane = (along <= channel.bridge) === channel.forward ? channel.source : channel.target
        const coordinate = horizontal ? ys[y] : xs[x]
        channelCost = middleDirection ? Math.abs(coordinate - lane) * 4
          : Math.min(Math.abs(coordinate - channel.bridge), Math.abs(coordinate - (horizontal ? start.stub.y : start.stub.x)), Math.abs(coordinate - (horizontal ? end.stub.y : end.stub.x))) * 4
      }
      const cost = entry.cost + length * (1 + (horizontal ? occupiedH[index] : occupiedV[index]) + channelCost) + (direction === heading ? 0 : 12)
      const next = ny * width + nx
      let candidate: Point | undefined
      if (!labeled && labelFor) {
        const key = horizontal ? y * width + Math.min(x, nx) : cells + Math.min(y, ny) * width + x
        if (!labelCache.has(key)) labelCache.set(key, labelFor({ a: { x: xs[x], y: ys[y] }, b: { x: xs[nx], y: ys[ny] } }))
        candidate = labelCache.get(key)
      }
      for (const hasLabel of candidate ? [0, 1] : [labeled]) {
        const state = next * 8 + direction * 2 + hasLabel
        if (cost >= costs[state]) continue
        costs[state] = cost; parents[state] = entry.state
        if (candidate && hasLabel) labelAt.set(state, candidate)
        else labelAt.delete(state)
        heap.push({ state, cost, score: cost + heuristic(next) })
      }
    }
  }
}
