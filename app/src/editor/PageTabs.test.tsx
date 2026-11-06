// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { movePage, PageTabs } from './PageTabs.tsx'
import type { PageTabsProps } from './PageTabs.tsx'

afterEach(() => { cleanup(); vi.restoreAllMocks() })

const pages = [{ id: 'a', title: 'Overview' }, { id: 'b', title: '' }, { id: 'c', title: 'Network' }]
function setup(overrides: Partial<PageTabsProps> = {}) {
  const props: PageTabsProps = { pages, activeId: 'b', presenting: false, editable: true, onSelect: vi.fn(), onAdd: vi.fn(), onRename: vi.fn(() => true), onReorder: vi.fn(), ...overrides }
  render(<PageTabs {...props} />)
  return props
}

it('should_return_exact_permutation_when_moving_a_page_DGM151B', () => {
  expect(movePage(['a', 'b', 'c'], 'c', 0)).toEqual(['c', 'a', 'b'])
  expect(movePage(['a', 'b', 'c'], 'a', 99)).toEqual(['b', 'c', 'a'])
  expect(movePage(['a', 'b', 'c'], 'missing', 0)).toEqual(['a', 'b', 'c'])
})

it('should_show_titled_tabs_with_active_indication_when_rendered_DGM151B', () => {
  setup()
  const tabs = within(screen.getByRole('tablist', { name: 'Workbook pages' })).getAllByRole('tab')
  expect(tabs.map(tab => tab.textContent)).toEqual(['Overview', 'Page 2', 'Network'])
  expect(tabs[1].getAttribute('aria-selected')).toBe('true')
  expect(tabs[0].getAttribute('aria-selected')).toBe('false')
  expect(tabs[1].tabIndex).toBe(0)
})

it('should_move_focus_with_arrows_and_select_on_click_when_navigating_tabs_DGM151B', () => {
  const props = setup()
  const tabs = screen.getAllByRole('tab')
  tabs[1].focus()
  fireEvent.keyDown(tabs[1], { key: 'ArrowRight' })
  expect(document.activeElement).toBe(tabs[2])
  fireEvent.keyDown(tabs[2], { key: 'Home' })
  expect(document.activeElement).toBe(tabs[0])
  fireEvent.click(tabs[0])
  expect(props.onSelect).toHaveBeenCalledWith('a')
})

it('should_commit_rename_on_enter_and_abandon_on_escape_when_renaming_DGM151B', () => {
  const props = setup()
  fireEvent.doubleClick(screen.getAllByRole('tab')[0])
  const input = screen.getByRole('textbox', { name: 'Page title' })
  fireEvent.change(input, { target: { value: 'Context' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(props.onRename).toHaveBeenCalledWith('a', 'Context')
  fireEvent.keyDown(screen.getAllByRole('tab')[2], { key: 'F2' })
  const second = screen.getByRole('textbox', { name: 'Page title' })
  fireEvent.change(second, { target: { value: 'Discarded' } })
  fireEvent.keyDown(second, { key: 'Escape' })
  expect(props.onRename).not.toHaveBeenCalledWith('c', 'Discarded')
  expect(screen.queryByRole('textbox', { name: 'Page title' })).toBeNull()
})

it('should_not_commit_rename_while_ime_composition_is_active_DGM151B', () => {
  const props = setup()
  fireEvent.doubleClick(screen.getAllByRole('tab')[0])
  const input = screen.getByRole('textbox', { name: 'Page title' })
  fireEvent.compositionStart(input)
  fireEvent.change(input, { target: { value: '概要' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(props.onRename).not.toHaveBeenCalled()
  fireEvent.compositionEnd(input)
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(props.onRename).toHaveBeenCalledWith('a', '概要')
})

it('should_reorder_with_accessible_move_actions_when_using_page_menu_DGM151B', () => {
  const props = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Page actions' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Move page left' }))
  expect(props.onReorder).toHaveBeenCalledWith(['b', 'a', 'c'])
  fireEvent.click(screen.getByRole('button', { name: 'Page actions' }))
  fireEvent.click(screen.getByRole('menuitem', { name: 'Move page right' }))
  expect(props.onReorder).toHaveBeenLastCalledWith(['a', 'c', 'b'])
})

it('should_disable_move_left_when_active_page_is_first_DGM151B', () => {
  setup({ activeId: 'a' })
  fireEvent.click(screen.getByRole('button', { name: 'Page actions' }))
  expect((screen.getByRole('menuitem', { name: 'Move page left' }) as HTMLButtonElement).disabled).toBe(true)
})

it('should_add_page_and_offer_no_delete_duplicate_or_close_DGM151B', () => {
  const props = setup()
  fireEvent.click(screen.getByRole('button', { name: 'Add page' }))
  expect(props.onAdd).toHaveBeenCalledTimes(1)
  fireEvent.click(screen.getByRole('button', { name: 'Page actions' }))
  const labels = screen.getAllByRole('menuitem').map(item => item.textContent)
  expect(labels).toEqual(['Rename page', 'Move page left', 'Move page right'])
  expect(screen.queryByRole('button', { name: /delete|duplicate|close/i })).toBeNull()
})

it('should_reorder_by_drag_and_drop_when_editable_DGM151B', () => {
  const props = setup()
  const tabs = screen.getAllByRole('tab')
  const store = new Map<string, string>()
  const dataTransfer = { get types() { return [...store.keys()] }, setData: (type: string, value: string) => store.set(type, value), getData: (type: string) => store.get(type) ?? '', effectAllowed: '', dropEffect: '' }
  fireEvent.dragStart(tabs[2], { dataTransfer })
  fireEvent.dragOver(tabs[0], { dataTransfer })
  fireEvent.drop(tabs[0], { dataTransfer })
  expect(props.onReorder).toHaveBeenCalledWith(['c', 'a', 'b'])
})

it('should_navigate_only_without_editing_controls_when_presenting_DGM151B', () => {
  const props = setup({ presenting: true })
  expect(screen.queryByRole('button', { name: 'Add page' })).toBeNull()
  expect(screen.queryByRole('button', { name: 'Page actions' })).toBeNull()
  const tabs = screen.getAllByRole('tab')
  expect(tabs[0].getAttribute('draggable')).toBe('false')
  fireEvent.doubleClick(tabs[0])
  expect(screen.queryByRole('textbox', { name: 'Page title' })).toBeNull()
  fireEvent.click(tabs[2])
  expect(props.onSelect).toHaveBeenCalledWith('c')
})

it('should_keep_navigation_but_disable_editing_when_read_only_DGM151B', () => {
  const props = setup({ editable: false })
  expect((screen.getByRole('button', { name: 'Add page' }) as HTMLButtonElement).disabled).toBe(true)
  expect((screen.getByRole('button', { name: 'Page actions' }) as HTMLButtonElement).disabled).toBe(true)
  fireEvent.click(screen.getAllByRole('tab')[0])
  expect(props.onSelect).toHaveBeenCalledWith('a')
})
