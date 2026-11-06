import { absolutePosition } from './model.ts'
import type { Diagram, Grid, Point } from './model.ts'

const DEFAULT_GRID: Readonly<Grid> = Object.freeze({ visible: true, style: 'dots', spacing: 8, snap: true, present: false, export: false })
export const GRID_COLOR_SWATCHES = [
  ['Lightgrey', '#d9d9d9'],
  ['Mediumgrey', '#7f7f7f'],
  ['Darkgrey', '#595959'],
  ['White', '#ffffff'],
  ['Black', '#000000'],
  ['Red', '#ff0000'],
  ['Green', '#00b050'],
  ['Yellow', '#ffff00'],
  ['Blue', '#0070c0'],
  ['Orange', '#ed7d31'],
  ['Purple', '#7030a0'],
  ['Brown', '#833c0c'],
] as const

export function effectiveGrid(grid?: Grid): Readonly<Grid> {
  return grid ?? DEFAULT_GRID
}

export function editorGridOffset(grid?: Grid): number {
  const settings = effectiveGrid(grid)
  return settings.style === 'dots' ? (1 - settings.spacing) / 2 : 0
}

export function snapPoint(point: Point, settings?: Grid): Point {
  const grid = effectiveGrid(settings)
  if (!grid.snap) return { ...point }
  return { x: Math.round(point.x / grid.spacing) * grid.spacing, y: Math.round(point.y / grid.spacing) * grid.spacing }
}

export function gridParentOrigin(document: Diagram, parentId?: string | null): Point {
  return parentId ? absolutePosition(document, parentId) : { x: 0, y: 0 }
}

export function snapLocalPoint(document: Diagram, parentId: string | null | undefined, point: Point): Point {
  const origin = gridParentOrigin(document, parentId)
  const absolute = snapPoint({ x: origin.x + point.x, y: origin.y + point.y }, document.grid)
  return { x: absolute.x - origin.x, y: absolute.y - origin.y }
}