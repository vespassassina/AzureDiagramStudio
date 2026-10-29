import { useCallback, useState } from 'react'
import { selectionLibrary } from '../catalog/presentation.ts'

export const FAVORITES_KEY = 'azure-diagram-studio:favorites:v1'
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>
const available = new Set<string>(selectionLibrary.map(item => item.icon))
const describe = (error: unknown) => error instanceof Error ? error.message : String(error)
function validate(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > 256 || !value.every(icon => typeof icon === 'string' && icon.length > 0 && icon.length <= 256 && !/[\0-\x1f]/.test(icon))) throw new Error('Invalid bounded favorites list.')
  return [...new Set(value)]
}
export function readFavorites(storage: PreferenceStorage): string[] {
  const text = storage.getItem(FAVORITES_KEY)
  if (text === null) return []
  if (text.length > 65536) throw new Error('Favorites preference exceeds its size limit.')
  const value: unknown = JSON.parse(text)
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== 2 ||
    !('version' in value) || value.version !== 1 || !('icons' in value)) throw new Error('Invalid favorites preference.')
  return validate(value.icons)
}
export function saveFavorites(storage: PreferenceStorage, icons: readonly string[]) {
  const text = JSON.stringify({ version: 1, icons: validate(icons) })
  if (text.length > 65536) throw new Error('Favorites preference exceeds its size limit.')
  storage.setItem(FAVORITES_KEY, text)
}

// Read the fixed profile preference, never diagram/history. Re-read before an
// explicit edit so unavailable IDs survive; publish only after durable storage
// accepts the write. A malformed preference is not silently overwritten.
export function useFavorites(enabled: boolean) {
  const [state, setState] = useState<{ icons: string[]; error: string }>(() => {
    if (!enabled) return { icons: [], error: '' }
    try { return { icons: readFavorites(window.localStorage), error: '' } }
    catch (error) { return { icons: [], error: `Favorites unavailable: ${describe(error)}` } }
  })
  const update = useCallback((icon?: string) => {
    if (!enabled || (icon !== undefined && !available.has(icon))) return
    try {
      const current = readFavorites(window.localStorage)
      const next = icon === undefined ? current.filter(key => !available.has(key)) :
        current.includes(icon) ? current.filter(key => key !== icon) :
          current.filter(key => available.has(key)).length < 12 ? [...current, icon] : current
      saveFavorites(window.localStorage, next)
      setState({ icons: next, error: '' })
    } catch (error) { setState(previous => ({ ...previous, error: `Favorites not saved: ${describe(error)}` })) }
  }, [enabled])
  const clear = useCallback(() => update(), [update])
  const retry = useCallback(() => {
    try { setState({ icons: readFavorites(window.localStorage), error: '' }) }
    catch (error) { setState(previous => ({ ...previous, error: `Favorites unavailable: ${describe(error)}` })) }
  }, [])
  return { ...state, toggle: update, clear, retry }
}
