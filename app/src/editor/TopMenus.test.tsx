// @vitest-environment jsdom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { TopMenus } from './TopMenus.tsx'

afterEach(cleanup)

function setup(disabled = false) {
  const run = vi.fn()
  function Harness() {
    const [open, setOpen] = useState<string | null>(null)
    return <><TopMenus open={open} onOpen={setOpen} disabled={disabled} menus={[
      { label: 'File', items: [{ label: 'New diagram', run }, { label: 'Open JSON', disabled: true, run }, { label: 'Save JSON', run }] },
      { label: 'View', items: [{ label: 'Component library', checked: true, run }] },
      { label: 'Settings', items: [{ label: 'Help', run }] },
    ]} /><button>Outside</button></>
  }
  render(<Harness />)
  return run
}

it('should_navigate_menubar_and_menu_restore_focus_and_run_only_enabled_actions', () => {
  const run = setup()
  const file = screen.getByRole('menuitem', { name: 'File menu' })
  fireEvent.keyDown(file, { key: 'ArrowDown' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'New diagram' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' })
  const unavailable = screen.getByRole('menuitem', { name: 'Open JSON' })
  expect(document.activeElement).toBe(unavailable)
  fireEvent.click(unavailable)
  expect(run).not.toHaveBeenCalled()
  fireEvent.keyDown(unavailable, { key: 'End' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'Save JSON' }))
  fireEvent.keyDown(document.activeElement!, { key: 'Home' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'New diagram' }))
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowRight' })
  expect(screen.queryByRole('menu', { name: 'File' })).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: 'Component library', checked: true }))
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' })
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'View menu' }))
  fireEvent.click(file)
  fireEvent.click(screen.getByRole('menuitem', { name: 'Save JSON' }))
  expect(run).toHaveBeenCalledOnce()
  expect(document.activeElement).toBe(file)
})

it('should_dismiss_outside_without_action_and_refuse_disabled_menubar', () => {
  const run = setup()
  fireEvent.click(screen.getByRole('menuitem', { name: 'File menu' }))
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }))
  expect(screen.queryByRole('menu')).toBeNull()
  expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: 'File menu' }))
  expect(run).not.toHaveBeenCalled()
  cleanup()
  setup(true)
  fireEvent.click(screen.getByRole('menuitem', { name: 'File menu' }))
  expect(screen.queryByRole('menu')).toBeNull()
})
