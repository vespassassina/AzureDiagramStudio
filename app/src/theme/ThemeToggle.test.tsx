// @vitest-environment jsdom
import { StrictMode } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderToString } from 'react-dom/server'
import { ThemeToggle, useTheme } from './index.ts'
import { createThemeStore } from './preference.ts'
import type { ThemeAdapter } from './preference.ts'

afterEach(() => { cleanup(); delete document.documentElement.dataset.theme; vi.restoreAllMocks() })

function setup(dark = false) {
  const adapter: ThemeAdapter = { readPreference: vi.fn(() => null), writePreference: vi.fn(), prefersDark: vi.fn(() => dark), applyTheme: theme => { document.documentElement.dataset.theme = theme } }
  return { adapter, store: createThemeStore(adapter) }
}

describe('theme control', () => {
  it('should_name_the_next_action_and_use_existing_icon_button_style', () => {
    const { store } = setup()
    render(<ThemeToggle store={store} />)
    const button = screen.getByRole('button', { name: 'Switch to dark theme' })
    expect(button.classList.contains('icon-button')).toBe(true)
    expect(button.title).toBe('Switch to dark theme')
    expect(button.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true')
    expect(button.getAttribute('aria-pressed')).toBe('false')
    expect(document.documentElement.dataset.theme).toBe('light')
    fireEvent.click(button)
    expect(screen.getByRole('button', { name: 'Switch to light theme' }).getAttribute('aria-pressed')).toBe('true')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })
  it('should_share_hook_and_multiple_controls_without_forking_or_strict_mode_writes', () => {
    const { store, adapter } = setup(true)
    function Probe() { const { theme } = useTheme(store); return <output>{theme}</output> }
    const view = render(<StrictMode><ThemeToggle store={store} /><ThemeToggle store={store} /><Probe /></StrictMode>)
    expect(adapter.writePreference).not.toHaveBeenCalled()
    fireEvent.click(screen.getAllByRole('button', { name: 'Switch to light theme' })[0])
    expect(screen.getAllByRole('button', { name: 'Switch to dark theme' })).toHaveLength(2)
    expect(screen.getByRole('status').textContent).toBe('light')
    expect(adapter.writePreference).toHaveBeenCalledTimes(1)
    view.unmount()
    render(<ThemeToggle store={store} />)
    expect(screen.getByRole('button', { name: 'Switch to dark theme' })).toBeDefined()
    expect(adapter.readPreference).toHaveBeenCalledTimes(1)
  })
  it('should_expose_a_true_preference_failure_without_claiming_diagram_save', () => {
    const { store, adapter } = setup()
    vi.mocked(adapter.writePreference).mockImplementation(() => { throw new Error('denied') })
    render(<ThemeToggle store={store} />)
    fireEvent.click(screen.getByRole('button'))
    const button = screen.getByRole('button', { name: 'Switch to light theme' })
    expect(button.title).toContain('could not be saved')
    expect(button.getAttribute('aria-description')).toContain('only to this session')
    expect(button.getAttribute('data-preference-error')).toBe('true')
    expect(screen.queryByText('Saved')).toBeNull()
  })
  it('should_render_without_required_props_or_browser_during_server_render', () => {
    expect(renderToString(<ThemeToggle />)).toContain('Switch to dark theme')
  })
  it('should_unsubscribe_without_leaving_system_media_listeners', () => {
    const { store } = setup()
    const listener = vi.fn()
    const stop = store.subscribe(listener)
    const view = render(<ThemeToggle store={store} />)
    view.unmount(); stop()
    act(() => store.toggleTheme())
    expect(listener).not.toHaveBeenCalled()
  })
})