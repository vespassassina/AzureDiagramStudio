// @vitest-environment jsdom
import { cleanup, createEvent, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { PresentationMarkup } from './PresentationMarkup.tsx'

const flow = vi.hoisted(() => ({ viewport: { x: 17, y: 23, zoom: 2 }, convert: vi.fn((point: { x: number; y: number }) => ({ x: (point.x - 17) / 2, y: (point.y - 23) / 2 })) }))
vi.mock('@xyflow/react', () => ({ useViewport: () => flow.viewport, useReactFlow: () => ({ screenToFlowPosition: flow.convert }) }))
afterEach(() => { cleanup(); vi.clearAllMocks() })

function pointer(target: Element, type: 'pointerDown' | 'pointerMove' | 'pointerUp' | 'pointerCancel' | 'lostPointerCapture', values: Record<string, unknown> = {}) {
  const event = createEvent[type](target, { bubbles: true, cancelable: true })
  for (const [key, value] of Object.entries({ button: 0, pointerId: 7, isPrimary: true, clientX: 57, clientY: 83, ...values })) Object.defineProperty(event, key, { value })
  fireEvent(target, event)
  return event
}
function start() {
  const view = render(<PresentationMarkup />)
  fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
  const canvas = screen.getByTestId('markup-canvas')
  Object.assign(canvas, { setPointerCapture: vi.fn(), hasPointerCapture: vi.fn(() => true), releasePointerCapture: vi.fn() })
  return { ...view, canvas }
}
function drag(canvas: Element, modifiers: Record<string, unknown> = {}, end = { clientX: 137, clientY: 163 }) {
  pointer(canvas, 'pointerDown', modifiers)
  pointer(canvas, 'pointerMove', { ...end, ...modifiers })
  pointer(canvas, 'pointerUp', { ...end, ...modifiers })
}
function committed(container: Element) { return [...container.querySelectorAll('[data-markup-committed]')] }

it('should_start_in_Navigate_with_five_colors_and_red_default_DGM120', () => {
  render(<PresentationMarkup />)
  expect(screen.getByRole('button', { name: 'Navigate' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('false')
  for (const color of ['Red', 'Blue', 'Green', 'Yellow', 'Black']) {
    expect(screen.getByRole('button', { name: `${color} markup` }).getAttribute('aria-pressed')).toBe(String(color === 'Red'))
  }
  for (const name of ['Undo markup', 'Redo markup', 'Clear markup']) expect(screen.getByRole('button', { name })).toHaveProperty('disabled', true)
  fireEvent.click(screen.getByRole('button', { name: 'Draw' }))
  expect(screen.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('true')
})

it.each([
  ['freehand', {}, 'path'], ['rectangle', { shiftKey: true }, 'rect'], ['ellipse', { altKey: true }, 'ellipse'],
  ['arrow', { ctrlKey: true }, 'path'], ['arrow', { metaKey: true }, 'path'],
  ['arrow', { ctrlKey: true, altKey: true, shiftKey: true }, 'path'], ['ellipse', { altKey: true, shiftKey: true }, 'ellipse'],
] as const)('should_draw_%s_with_frozen_modifier_kind_DGM120', (kind, modifiers, tag) => {
  const { canvas, container } = start()
  pointer(canvas, 'pointerDown', modifiers)
  pointer(canvas, 'pointerMove', { clientX: 97, clientY: 123 })
  expect(container.querySelector('[data-markup-preview]')?.getAttribute('data-markup-kind')).toBe(kind)
  pointer(canvas, 'pointerUp', { clientX: 137, clientY: 163 })
  const shapes = committed(container)
  expect(shapes).toHaveLength(1)
  expect(shapes[0].tagName.toLowerCase()).toBe(tag)
  expect(shapes[0].getAttribute('data-markup-kind')).toBe(kind)
  expect(shapes[0].getAttribute('stroke')).toBe('#ff0000')
  expect(shapes[0].getAttribute('stroke-width')).toBe('6')
  expect(shapes[0].getAttribute('stroke-linecap')).toBe('round')
  expect(shapes[0].getAttribute('fill')).toBe('none')
  expect(shapes[0].getAttribute('vector-effect')).toBe('non-scaling-stroke')
  expect(canvas.setPointerCapture).toHaveBeenCalledWith(7)
  expect(canvas.releasePointerCapture).toHaveBeenCalledWith(7)
  expect(container.querySelector('[data-markup-preview]')).toBeNull()
})

it.each([['Red', '#ff0000'], ['Blue', '#0000ff'], ['Green', '#008000'], ['Yellow', '#ffff00'], ['Black', '#000000']])('should_use_actual_%s_swatch_and_stroke_DGM120', (name, value) => {
  const { canvas, container } = start()
  const button = screen.getByRole('button', { name: `${name} markup` })
  expect((button.firstElementChild as HTMLElement).style.backgroundColor).not.toBe('')
  fireEvent.click(button); drag(canvas)
  expect(committed(container)[0].getAttribute('stroke')).toBe(value)
  expect(button.getAttribute('aria-pressed')).toBe('true')
})

it('should_convert_unsnapped_world_coordinates_and_follow_viewport_without_scaling_width_DGM120', () => {
  const { canvas, container, rerender } = start()
  drag(canvas)
  const path = committed(container)[0]
  expect(path.getAttribute('d')).toBe('M 20 30 L 60 70')
  expect(flow.convert).toHaveBeenCalledWith({ x: 57, y: 83 }, { snapToGrid: false })
  expect(path.parentElement?.getAttribute('transform')).toBe('translate(17 23) scale(2)')
  const original = flow.viewport
  flow.viewport = { x: 53, y: 81, zoom: .5 }
  try {
    rerender(<PresentationMarkup />)
    expect(committed(container)[0].getAttribute('d')).toBe('M 20 30 L 60 70')
    expect(committed(container)[0].parentElement?.getAttribute('transform')).toBe('translate(53 81) scale(0.5)')
    expect(committed(container)[0].getAttribute('stroke-width')).toBe('6')
  } finally { flow.viewport = original }
})

it.each(['rectangle', 'ellipse'])('should_normalize_reverse_%s_drag_DGM120', kind => {
  const { canvas, container } = start()
  drag(canvas, kind === 'rectangle' ? { shiftKey: true } : { altKey: true }, { clientX: 17, clientY: 23 })
  const shape = committed(container)[0]
  if (kind === 'rectangle') {
    for (const [name, value] of Object.entries({ x: '0', y: '0', width: '20', height: '30' })) expect(shape.getAttribute(name)).toBe(value)
  } else {
    for (const [name, value] of Object.entries({ cx: '10', cy: '15', rx: '10', ry: '15' })) expect(shape.getAttribute(name)).toBe(value)
  }
})

it('should_render_a_straight_arrow_with_two_head_segments_DGM120', () => {
  const { canvas, container } = start()
  drag(canvas, { ctrlKey: true }, { clientX: 137, clientY: 83 })
  const path = committed(container)[0].getAttribute('d')!
  expect(path.startsWith('M 20 30 L 60 30 M ')).toBe(true)
  expect(path.match(/ L /g)).toHaveLength(3)
  expect(path).not.toMatch(/NaN|Infinity/)
})

it.each([{}, { shiftKey: true }, { altKey: true }, { ctrlKey: true }])('should_discard_zero_size_clicks_DGM120', modifiers => {
  const { canvas, container } = start()
  drag(canvas, modifiers, { clientX: 57, clientY: 83 })
  expect(committed(container)).toHaveLength(0)
  expect(screen.getByRole('button', { name: 'Undo markup' })).toHaveProperty('disabled', true)
})

it.each([{ shiftKey: true }, { altKey: true }])('should_discard_zero_area_shapes_DGM120', modifiers => {
  const { canvas, container } = start()
  drag(canvas, modifiers, { clientX: 57, clientY: 163 })
  expect(committed(container)).toHaveLength(0)
})

it.each(['Escape', 'pointerCancel', 'lostPointerCapture', 'blur', 'Navigate'])('should_cancel_on_%s_and_ignore_late_release_then_allow_new_stroke_DGM120', reason => {
  const { canvas, container } = start()
  const parentKey = vi.fn()
  window.addEventListener('keydown', parentKey)
  try {
    pointer(canvas, 'pointerDown'); pointer(canvas, 'pointerMove', { clientX: 137, clientY: 163 })
    if (reason === 'Escape') { fireEvent.keyDown(window, { key: 'Escape' }); expect(parentKey).not.toHaveBeenCalled() }
    else if (reason === 'Navigate') fireEvent.click(screen.getByRole('button', { name: 'Navigate' }))
    else if (reason === 'blur') fireEvent.blur(window)
    else pointer(canvas, reason as 'pointerCancel' | 'lostPointerCapture')
    pointer(canvas, 'pointerUp', { clientX: 137, clientY: 163 })
    expect(committed(container)).toHaveLength(0)
    expect(container.querySelector('[data-markup-preview]')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Draw' })); drag(canvas)
    expect(committed(container)).toHaveLength(1)
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(parentKey).toHaveBeenCalledTimes(1)
  } finally { window.removeEventListener('keydown', parentKey) }
})

it('should_keep_history_local_with_Undo_Redo_Clear_and_new_branch_DGM120', () => {
  const { canvas, container } = start()
  drag(canvas); drag(canvas, { shiftKey: true })
  fireEvent.click(screen.getByRole('button', { name: 'Undo markup' }))
  expect(committed(container)).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Redo markup' }))
  expect(committed(container)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Clear markup' }))
  expect(committed(container)).toHaveLength(0)
  fireEvent.click(screen.getByRole('button', { name: 'Undo markup' }))
  expect(committed(container)).toHaveLength(2)
  fireEvent.click(screen.getByRole('button', { name: 'Undo markup' })); drag(canvas, { altKey: true })
  expect(committed(container)).toHaveLength(2)
  expect(screen.getByRole('button', { name: 'Redo markup' })).toHaveProperty('disabled', true)
})

it.each([{ ctrlKey: true }, { metaKey: true }])('should_handle_local_keyboard_history_only_while_Draw_owns_focus_DGM120', modifier => {
  const { canvas, container } = start()
  drag(canvas)
  const parentKey = vi.fn()
  window.addEventListener('keydown', parentKey)
  try {
    fireEvent.keyDown(canvas, { key: 'z', ...modifier }); expect(committed(container)).toHaveLength(0)
    fireEvent.keyDown(canvas, { key: 'Z', shiftKey: true, ...modifier }); expect(committed(container)).toHaveLength(1)
    fireEvent.keyDown(canvas, { key: 'z', ...modifier })
    fireEvent.keyDown(canvas, { key: 'y', ...modifier }); expect(committed(container)).toHaveLength(1)
    expect(parentKey).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }))
    fireEvent.keyDown(window, { key: 'z', ...modifier }); expect(parentKey).toHaveBeenCalledTimes(1)
    expect(committed(container)).toHaveLength(1)
  } finally { window.removeEventListener('keydown', parentKey) }
})

it('should_pass_through_Navigate_and_block_Draw_canvas_gestures_not_toolbar_DGM120', () => {
  const { canvas } = start()
  const parent = vi.fn()
  document.addEventListener('pointerdown', parent)
  try {
    const event = pointer(canvas, 'pointerDown')
    expect(event.defaultPrevented).toBe(true); expect(parent).not.toHaveBeenCalled()
    pointer(canvas, 'pointerCancel')
    fireEvent.click(screen.getByRole('button', { name: 'Navigate' }))
    expect(canvas.getAttribute('data-drawing')).toBe('false')
    pointer(canvas, 'pointerDown'); expect(parent).toHaveBeenCalledTimes(1)
    pointer(screen.getByRole('button', { name: 'Draw' }), 'pointerDown'); expect(parent).toHaveBeenCalledTimes(2)
  } finally { document.removeEventListener('pointerdown', parent) }
})

it('should_ignore_secondary_and_other_pointer_ids_without_interrupting_primary_stroke_DGM120', () => {
  const { canvas, container } = start()
  pointer(canvas, 'pointerDown', { button: 2 }); pointer(canvas, 'pointerUp')
  pointer(canvas, 'pointerDown', { isPrimary: false }); pointer(canvas, 'pointerUp')
  expect(committed(container)).toHaveLength(0)
  pointer(canvas, 'pointerDown')
  pointer(canvas, 'pointerMove', { pointerId: 9, clientX: 999, clientY: 999 })
  pointer(canvas, 'pointerUp', { pointerId: 9 }); pointer(canvas, 'pointerCancel', { pointerId: 9 })
  pointer(canvas, 'pointerUp', { clientX: 137, clientY: 163 })
  expect(committed(container)[0].getAttribute('d')).toBe('M 20 30 L 60 70')
})

it('should_reset_ink_history_and_gesture_on_unmount_DGM120', () => {
  const { canvas, container, unmount } = start()
  drag(canvas); pointer(canvas, 'pointerDown')
  unmount(); pointer(canvas, 'pointerUp', { clientX: 137, clientY: 163 })
  expect(committed(container)).toHaveLength(0)
  render(<PresentationMarkup />)
  expect(screen.getByRole('button', { name: 'Undo markup' })).toHaveProperty('disabled', true)
  expect(screen.getByRole('button', { name: 'Navigate' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByRole('button', { name: 'Red markup' }).getAttribute('aria-pressed')).toBe('true')
  expect(screen.getByTestId('markup-canvas').querySelector('[data-markup-committed]')).toBeNull()
})

it.each(['Navigate', 'Draw', 'Red markup', 'Blue markup', 'Green markup', 'Yellow markup', 'Black markup', 'Undo markup', 'Redo markup', 'Clear markup'])('should_expose_keyboard_and_hover_tooltip_for_%s_without_native_duplicate_DGM120', label => {
  const { canvas } = start()
  drag(canvas); drag(canvas); fireEvent.click(screen.getByRole('button', { name: 'Undo markup' }))
  const button = screen.getByRole('button', { name: label })
  fireEvent.focus(button)
  expect(screen.getByRole('tooltip').textContent).toBe(label)
  expect(button.getAttribute('aria-describedby')).toBe(screen.getByRole('tooltip').id)
  expect(button.hasAttribute('title')).toBe(false)
  fireEvent.blur(button); expect(screen.queryByRole('tooltip')).toBeNull()
  fireEvent.mouseEnter(button); expect(screen.getByRole('tooltip').textContent).toBe(label)
  fireEvent.mouseLeave(button); expect(screen.queryByRole('tooltip')).toBeNull()
})

it.each(['pointer', 'Escape', 'scroll', 'resize', 'window blur', 'mode change', 'unmount'])('should_dismiss_markup_tooltip_on_%s_DGM120', reason => {
  const { unmount } = start()
  const button = screen.getByRole('button', { name: 'Navigate' })
  fireEvent.mouseEnter(button); expect(screen.getByRole('tooltip')).toBeTruthy()
  if (reason === 'pointer') { pointer(button, 'pointerDown'); fireEvent.focus(button) }
  else if (reason === 'Escape') fireEvent.keyDown(window, { key: 'Escape' })
  else if (reason === 'scroll') fireEvent.scroll(window)
  else if (reason === 'resize') fireEvent.resize(window)
  else if (reason === 'window blur') fireEvent.blur(window)
  else if (reason === 'mode change') fireEvent.click(button)
  else unmount()
  expect(screen.queryByRole('tooltip')).toBeNull()
})