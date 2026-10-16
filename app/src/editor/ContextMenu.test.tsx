// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { Boxes } from 'lucide-react'
import { readFileSync } from 'node:fs'
import { ContextMenu } from './ContextMenu.tsx'

const originalWidth = window.innerWidth
const originalHeight = window.innerHeight
afterEach(() => { cleanup(); vi.restoreAllMocks(); window.innerWidth = originalWidth; window.innerHeight = originalHeight })

it.each([{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 320, height: 180 }])('should_clamp_menu_inside_${width}x${height}_viewport_DGM119', viewport => {
  window.innerWidth = viewport.width; window.innerHeight = viewport.height
  const width = Math.min(240, viewport.width - 16), height = Math.min(580, viewport.height - 16)
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: width, bottom: height, width, height, toJSON() {} })
  render(<ContextMenu point={{ x: viewport.width - 1, y: viewport.height - 1 }} origin={null} actions={[{ label: 'Add component', icon: Boxes, disabled: false, run: vi.fn() }]} onClose={vi.fn()} />)
  const menu = screen.getByRole('menu')
  expect(Number.parseFloat(menu.style.left)).toBeGreaterThanOrEqual(8)
  expect(Number.parseFloat(menu.style.top)).toBeGreaterThanOrEqual(8)
  expect(Number.parseFloat(menu.style.left) + width).toBeLessThanOrEqual(viewport.width - 8)
  expect(Number.parseFloat(menu.style.top) + height).toBeLessThanOrEqual(viewport.height - 8)
  const css = readFileSync('src/editor/editor.css', 'utf8')
  expect(css).toContain('width: min(240px, calc(100vw - 16px))')
  expect(css).toContain('max-height: calc(100dvh - 16px); overflow-y: auto')
})

it.each(['Enter', ' '])('should_skip_disabled_items_wrap_and_activate_once_by_%s_DGM119', key => {
  const run = vi.fn(), close = vi.fn()
  render(<ContextMenu point={{ x: 20, y: 20 }} origin={null} actions={[
    { label: 'Disabled', icon: Boxes, disabled: true, run },
    { label: 'First', icon: Boxes, disabled: false, run },
    { label: 'Last', icon: Boxes, disabled: false, run },
  ]} onClose={close} />)
  const menu = screen.getByRole('menu')
  expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'First' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' })
  expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Last' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'First' }))
  fireEvent.keyDown(document.activeElement!, { key }); fireEvent.keyDown(document.activeElement!, { key })
  expect(run).toHaveBeenCalledTimes(1); expect(close).toHaveBeenCalledTimes(1)
})

it('should_ignore_IME_and_restore_origin_without_stealing_new_focus_DGM119', () => {
  const origin = document.createElement('button'), other = document.createElement('button')
  document.body.append(origin, other)
  try {
    act(() => origin.focus())
    const run = vi.fn(), onClose = vi.fn()
    const view = render(<ContextMenu point={{ x: 20, y: 20 }} origin={origin} actions={[{ label: 'Add', icon: Boxes, disabled: false, run }]} onClose={onClose} />)
    fireEvent.keyDown(document.activeElement!, { key: 'Enter', isComposing: true, keyCode: 229 })
    expect(run).not.toHaveBeenCalled()
    view.unmount(); expect(document.activeElement).toBe(origin)
    const next = render(<ContextMenu point={{ x: 20, y: 20 }} origin={origin} actions={[{ label: 'Add', icon: Boxes, disabled: false, run }]} onClose={onClose} />)
    act(() => other.focus()); next.unmount()
    expect(document.activeElement).toBe(other)
  } finally { origin.remove(); other.remove() }
})