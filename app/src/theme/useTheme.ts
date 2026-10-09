import { useSyncExternalStore } from 'react'
import { getServerThemeSnapshot, getThemeStore } from './preference.ts'
import type { ThemeStore } from './preference.ts'

export function useTheme(store: ThemeStore = getThemeStore()) {
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, getServerThemeSnapshot)
  return { ...snapshot, toggleTheme: store.toggleTheme, setTheme: store.setTheme }
}