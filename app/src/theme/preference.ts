export type Theme = 'light' | 'dark'
export const THEME_STORAGE_KEY = 'azure-diagram-studio.ui.theme'
export const THEME_PREFERENCE_FAILURE = 'Theme preference could not be saved; this choice applies only to this session.'
export type ThemeSnapshot = { theme: Theme; preferenceError: string | null }
export interface ThemeAdapter {
  readPreference(): string | null
  writePreference(theme: Theme): void
  prefersDark(): boolean
  applyTheme(theme: Theme): void
}
export interface ThemeStore {
  getSnapshot(): ThemeSnapshot
  subscribe(listener: () => void): () => void
  toggleTheme(): void
  setTheme(theme: Theme): void
}

export function chooseTheme(stored: string | null, prefersDark: boolean): Theme {
  return stored === 'light' || stored === 'dark' ? stored : prefersDark ? 'dark' : 'light'
}

/** Read once; explicit choices update chrome, try persistence, then notify all consumers.
 * A denied write retains the session choice, never a document save acknowledgement.
 */
export function createThemeStore(adapter: ThemeAdapter): ThemeStore {
  let stored: string | null = null
  let preferenceError: string | null = null
  try { stored = adapter.readPreference() }
  catch { preferenceError = THEME_PREFERENCE_FAILURE }
  let dark = false
  if (stored !== 'light' && stored !== 'dark') {
    try { dark = adapter.prefersDark() } catch { dark = false }
  }
  let snapshot: ThemeSnapshot = { theme: chooseTheme(stored, dark), preferenceError }
  const listeners = new Set<() => void>()
  function setTheme(theme: Theme) {
    let error: string | null = null
    try { adapter.writePreference(theme) } catch { error = THEME_PREFERENCE_FAILURE }
    snapshot = { theme, preferenceError: error }
    adapter.applyTheme(theme)
    listeners.forEach(listener => listener())
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => {
      listeners.add(listener)
      adapter.applyTheme(snapshot.theme)
      return () => { listeners.delete(listener) }
    },
    setTheme,
    toggleTheme: () => setTheme(snapshot.theme === 'light' ? 'dark' : 'light'),
  }
}

const browserStores = new WeakMap<Document, ThemeStore>()
const serverSnapshot: ThemeSnapshot = { theme: 'light', preferenceError: null }
const serverStore: ThemeStore = { getSnapshot: () => serverSnapshot, subscribe: () => () => {}, toggleTheme: () => {}, setTheme: () => {} }

/** One store per DOM document survives Strict Mode remounts without rereading or saving. */
export function getThemeStore(): ThemeStore {
  if (typeof document === 'undefined' || typeof window === 'undefined') return serverStore
  const existing = browserStores.get(document)
  if (existing) return existing
  const store = createThemeStore({
    readPreference: () => window.localStorage.getItem(THEME_STORAGE_KEY),
    writePreference: theme => window.localStorage.setItem(THEME_STORAGE_KEY, theme),
    prefersDark: () => window.matchMedia('(prefers-color-scheme: dark)').matches,
    applyTheme: theme => { document.documentElement.dataset.theme = theme },
  })
  browserStores.set(document, store)
  return store
}

export function getServerThemeSnapshot(): ThemeSnapshot { return serverSnapshot }