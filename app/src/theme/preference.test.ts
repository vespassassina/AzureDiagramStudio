import { describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import { ThemeToggle } from './index.ts'
import { chooseTheme, createThemeStore, getThemeStore, THEME_STORAGE_KEY } from './preference.ts'
import type { Theme, ThemeAdapter } from './preference.ts'

function setup(stored: string | null = null, dark = false) {
  const adapter: ThemeAdapter = { readPreference: vi.fn(() => stored), writePreference: vi.fn(), prefersDark: vi.fn(() => dark), applyTheme: vi.fn() }
  return { adapter, store: createThemeStore(adapter) }
}

describe('isolated theme preference', () => {
  it.each(['light', 'dark'] as const)('should_use_%s_when_explicit_preference_exists', theme => {
    expect(chooseTheme(theme, theme !== 'dark')).toBe(theme)
  })
  it.each([null, '', 'system', 'DARK', '{"theme":"dark"}'])('should_follow_initial_system_when_storage_is_invalid_%s', stored => {
    expect(chooseTheme(stored, true)).toBe('dark')
    expect(chooseTheme(stored, false)).toBe('light')
  })
  it('should_keep_persistence_outside_document_keys_when_explicit_action_occurs', () => {
    expect(THEME_STORAGE_KEY).toBe('azure-diagram-studio.ui.theme')
    const { store, adapter } = setup('light')
    expect(adapter.writePreference).not.toHaveBeenCalled()
    store.toggleTheme()
    expect(store.getSnapshot()).toEqual({ theme: 'dark', preferenceError: null })
    expect(adapter.writePreference).toHaveBeenCalledExactlyOnceWith('dark')
    expect(adapter.applyTheme).toHaveBeenLastCalledWith('dark')
  })
  it('should_survive_reload_when_an_explicit_choice_was_written', () => {
    let preference: string | null = null
    const adapter: ThemeAdapter = { readPreference: () => preference, writePreference: theme => { preference = theme }, prefersDark: () => true, applyTheme: vi.fn() }
    const first = createThemeStore(adapter)
    first.toggleTheme()
    expect(createThemeStore(adapter).getSnapshot().theme).toBe('light')
  })
  it('should_keep_ephemeral_theme_and_report_failure_when_storage_denies_writes', () => {
    const { store, adapter } = setup('light')
    vi.mocked(adapter.writePreference).mockImplementation(() => { throw new DOMException('Denied', 'SecurityError') })
    expect(() => store.toggleTheme()).not.toThrow()
    expect(store.getSnapshot().theme).toBe('dark')
    expect(store.getSnapshot().preferenceError).toBe('Theme preference could not be saved; this choice applies only to this session.')
    store.toggleTheme()
    expect(store.getSnapshot().theme).toBe('light')
    vi.mocked(adapter.writePreference).mockImplementation(() => {})
    store.toggleTheme()
    expect(store.getSnapshot().preferenceError).toBeNull()
  })
  it('should_follow_system_without_throwing_when_preference_read_is_denied', () => {
    const { adapter } = setup()
    vi.mocked(adapter.readPreference).mockImplementation(() => { throw new Error('denied') })
    vi.mocked(adapter.prefersDark).mockReturnValue(true)
    const store = createThemeStore(adapter)
    expect(store.getSnapshot().theme).toBe('dark')
    expect(store.getSnapshot().preferenceError).not.toBeNull()
  })
  it('should_default_to_light_when_system_query_is_unavailable', () => {
    const { adapter } = setup()
    vi.mocked(adapter.prefersDark).mockImplementation(() => { throw new Error('unavailable') })
    expect(createThemeStore(adapter).getSnapshot().theme).toBe('light')
  })
  it('should_share_one_snapshot_without_writes_when_subscribers_mount_again', () => {
    const { store, adapter } = setup(null, true)
    const first = vi.fn(), second = vi.fn()
    const stop = store.subscribe(first)
    const initial = store.getSnapshot()
    stop()
    const stopAgain = store.subscribe(first)
    const stopSecond = store.subscribe(second)
    expect(store.getSnapshot()).toBe(initial)
    expect(adapter.readPreference).toHaveBeenCalledTimes(1)
    expect(adapter.prefersDark).toHaveBeenCalledTimes(1)
    expect(adapter.writePreference).not.toHaveBeenCalled()
    store.toggleTheme()
    expect(first).toHaveBeenCalledTimes(1)
    expect(second).toHaveBeenCalledTimes(1)
    stopAgain(); stopSecond()
    store.toggleTheme()
    expect(first).toHaveBeenCalledTimes(1)
  })
  it('should_not_requery_system_when_explicit_preference_exists', () => {
    const { adapter } = setup('dark')
    expect(adapter.prefersDark).not.toHaveBeenCalled()
  })
  it('should_keep_initial_system_choice_when_media_preference_later_changes', () => {
    const { store, adapter } = setup(null, true)
    vi.mocked(adapter.prefersDark).mockReturnValue(false)
    const stop = store.subscribe(vi.fn())
    expect(store.getSnapshot().theme).toBe('dark')
    expect(adapter.prefersDark).toHaveBeenCalledTimes(1)
    stop()
  })
  it('should_render_in_node_when_window_document_and_match_media_are_absent', () => {
    expect(typeof window).toBe('undefined')
    expect(typeof document).toBe('undefined')
    expect(getThemeStore().getSnapshot()).toEqual({ theme: 'light', preferenceError: null })
    expect(renderToString(createElement(ThemeToggle))).toContain('Switch to dark theme')
  })
  it('should_preserve_all_unrelated_storage_when_theme_changes', () => {
    const storage = new Map([['diagram', '{"revision":27}'], ['lock', 'other-tab']])
    const adapter: ThemeAdapter = { readPreference: () => storage.get(THEME_STORAGE_KEY) ?? null, writePreference: (theme: Theme) => { storage.set(THEME_STORAGE_KEY, theme) }, prefersDark: () => false, applyTheme: vi.fn() }
    createThemeStore(adapter).toggleTheme()
    expect([...storage]).toEqual([['diagram', '{"revision":27}'], ['lock', 'other-tab'], [THEME_STORAGE_KEY, 'dark']])
  })
})