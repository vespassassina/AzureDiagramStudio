// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { movePage, PageTabs } from './PageTabs.tsx'
import type { PageTabsProps } from './PageTabs.tsx'

afterEach(() => { cleanup(); vi.restoreAllMocks() })
const pages = [{ id: 'a', title: 'Overview' }, { id: 'b', title: 'Network' }]
function setup(overrides: Partial<PageTabsProps> = {}) {
  const props: PageTabsProps = { pages, activeId: 'a', presenting: false, editable: true, onSelect: vi.fn(), onAdd: vi.fn(), onRemove: vi.fn(), onRename: vi.fn(() => true), onReorder: vi.fn(), ...overrides }
  render(<PageTabs {...props} />)
  return props
}

it('should_place_add_diagram_after_the_last_tab_when_rendered_DGM163', () => {
  setup()
  const children = [...screen.getByRole('tablist').children]
  expect(children.at(-1)).toBe(screen.getByRole('button', { name: 'Add diagram' }))
  expect(screen.queryByRole('button', { name: 'Page actions' })).toBeNull()
})
it('should_commit_page_rename_on_blur_and_escape_without_stale_commit_DGM163', () => {
  const props = setup()
  fireEvent.doubleClick(screen.getAllByRole('tab')[0])
  const input = screen.getByRole('textbox', { name: 'Page title' })
  fireEvent.change(input, { target: { value: 'Context' } })
  fireEvent.blur(input)
  expect(props.onRename).toHaveBeenCalledWith('a', 'Context')
  fireEvent.doubleClick(screen.getAllByRole('tab')[1])
  fireEvent.change(screen.getByRole('textbox', { name: 'Page title' }), { target: { value: 'Discarded' } })
  fireEvent.keyDown(screen.getByRole('textbox', { name: 'Page title' }), { key: 'Escape' })
  expect(props.onRename).not.toHaveBeenCalledWith('b', 'Discarded')
})
it('should_disable_last_page_removal_and_stop_close_event_from_selecting_DGM163', () => {
  const only = setup({ pages: [pages[0]] })
  expect((screen.getByRole('button', { name: 'Cannot remove the last page' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getByRole('button', { name: 'Cannot remove the last page' }))
  expect(only.onRemove).not.toHaveBeenCalled()
})
it('should_stop_close_event_from_selecting_the_page_DGM163', () => {
  const props = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Remove Overview' }))
  expect(props.onRemove).toHaveBeenCalledWith('a')
  expect(props.onSelect).not.toHaveBeenCalled()
})
it('should_reorder_with_drag_and_keyboard_chord_DGM163', () => {
  expect(movePage(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  const props = setup()
  fireEvent.keyDown(screen.getAllByRole('tab')[1], { key: 'ArrowLeft', altKey: true, shiftKey: true })
  expect(props.onReorder).toHaveBeenCalledWith(['b', 'a'])
})
it('should_rove_focus_and_preserve_ime_drafts_until_composition_ends_DGM163', () => {
  const props = setup()
  const tabs = screen.getAllByRole('tab')
  tabs[0].focus()
  fireEvent.keyDown(tabs[0], { key: 'ArrowRight' })
  expect(document.activeElement).toBe(tabs[1])
  fireEvent.doubleClick(tabs[0])
  const input = screen.getByRole('textbox', { name: 'Page title' })
  fireEvent.compositionStart(input)
  fireEvent.change(input, { target: { value: '概要' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(props.onRename).not.toHaveBeenCalled()
  fireEvent.compositionEnd(input)
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(props.onRename).toHaveBeenCalledWith('a', '概要')
})
it('should_reorder_by_drag_and_drop_when_editable_DGM163', () => {
  const props = setup()
  const tabs = screen.getAllByRole('tab')
  const values = new Map<string, string>()
  const dataTransfer = { get types() { return [...values.keys()] }, setData: (type: string, value: string) => values.set(type, value), getData: (type: string) => values.get(type) ?? '', effectAllowed: '', dropEffect: '' }
  fireEvent.dragStart(tabs[1], { dataTransfer })
  fireEvent.dragOver(tabs[0].parentElement!, { dataTransfer })
  fireEvent.drop(tabs[0].parentElement!, { dataTransfer })
  expect(props.onReorder).toHaveBeenCalledWith(['b', 'a'])
})
it('should_navigate_without_editing_controls_when_presenting_or_read_only_DGM163', () => {
  const present = setup({ presenting: true })
  expect(screen.queryByRole('button', { name: 'Add diagram' })).toBeNull()
  expect(screen.queryByRole('button', { name: /Remove/ })).toBeNull()
  fireEvent.click(screen.getAllByRole('tab')[1])
  expect(present.onSelect).toHaveBeenCalledWith('b')
  cleanup()
  const readOnly = setup({ editable: false })
  expect((screen.getByRole('button', { name: 'Add diagram' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Remove Overview' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getAllByRole('tab')[1])
  expect(readOnly.onSelect).toHaveBeenCalledWith('b')
})
