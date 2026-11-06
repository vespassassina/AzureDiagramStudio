import { expect, test } from 'vitest'
import { GRID_COLOR_SWATCHES } from './grid.ts'

test('should_freeze_the_exact_named_grid_color_palette_DGM156', () => {
  expect(GRID_COLOR_SWATCHES).toEqual([
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
  ])
})
