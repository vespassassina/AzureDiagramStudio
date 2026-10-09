import { Moon, Sun } from 'lucide-react'
import { useTheme } from './useTheme.ts'
import type { ThemeStore } from './preference.ts'

export function ThemeToggle({ store }: { store?: ThemeStore } = {}) {
  const { theme, toggleTheme, preferenceError } = useTheme(store)
  const label = theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'
  const Icon = theme === 'light' ? Moon : Sun
  return <button type="button" className="icon-button theme-toggle" aria-label={label} aria-pressed={theme === 'dark'} aria-description={preferenceError ?? undefined} data-preference-error={preferenceError ? 'true' : undefined} title={preferenceError ? `${label}. ${preferenceError}` : label} onClick={toggleTheme}><Icon size={18} strokeWidth={1.7} aria-hidden="true" /></button>
}