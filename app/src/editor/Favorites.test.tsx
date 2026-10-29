// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { CatalogAccordion } from './CatalogAccordion.tsx'
import { FAVORITES_KEY, readFavorites, saveFavorites } from './favorites.ts'

afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear() })
const mount = () => render(<CatalogAccordion writable selectedIcon={null} onChoose={vi.fn()} />)
const favorites = () => fireEvent.click(screen.getByRole('tab', { name: /^Favorites/ }))
it('should_expose_persistent_favorites_as_a_peer_category_with_search_and_actionable_empty_states', () => {
  const first = mount()
  expect(screen.getAllByRole('tab')).toHaveLength(3)
  favorites()
  expect(screen.getByText(/no favorites yet.*star/i)).toBeTruthy()
  fireEvent.keyDown(screen.getByRole('tab', { name: /^Favorites/ }), { key: 'Home' })
  expect(screen.getByRole('tab', { name: /^Azure/ }).getAttribute('aria-selected')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'Add App Service to favorites' }))
  favorites()
  expect(screen.getByRole('button', { name: 'Insert App Service' })).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Search components'), { target: { value: 'Storage' } })
  expect(screen.queryByRole('button', { name: /^Insert / })).toBeNull()
  expect(screen.getByText(/no matching favorites/i)).toBeTruthy()
  fireEvent.change(screen.getByLabelText('Search components'), { target: { value: 'App Service' } })
  expect(screen.getAllByRole('button', { name: /^Insert / })).toHaveLength(1)
  first.unmount()
  mount(); favorites()
  expect(screen.getByRole('button', { name: 'Remove App Service from favorites' })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'Remove App Service from favorites' }))
  expect(screen.getByRole('tab', { name: /^Favorites/ }).getAttribute('aria-selected')).toBe('true')
  expect(screen.getByText(/no favorites yet.*star/i)).toBeTruthy()
})
it('should_preserve_unknown_stored_ids_and_unrelated_preferences_when_toggling_valid_catalog_ids', () => {
  localStorage.setItem('unrelated-preference', 'unchanged')
  saveFavorites(localStorage, ['unavailable:future-icon'])
  mount()
  fireEvent.click(screen.getByRole('button', { name: 'Add App Service to favorites' }))
  expect(readFavorites(localStorage)).toEqual(['unavailable:future-icon', 'azure-app'])
  favorites()
  expect(within(screen.getByRole('tabpanel')).getAllByRole('button', { name: /^Insert / })).toHaveLength(1)
  fireEvent.click(screen.getByRole('button', { name: 'Clear favorite components' }))
  expect(readFavorites(localStorage)).toEqual(['unavailable:future-icon'])
  expect(localStorage.getItem('unrelated-preference')).toBe('unchanged')
})
it('should_report_read_and_write_failures_without_claiming_unsaved_membership', () => {
  localStorage.setItem(FAVORITES_KEY, '{bad')
  const first = mount()
  expect(screen.getByRole('alert').textContent).toMatch(/favorites.*unavailable/i)
  fireEvent.click(screen.getByRole('button', { name: 'Add App Service to favorites' }))
  expect(screen.queryByRole('button', { name: 'Remove App Service from favorites' })).toBeNull()
  expect(localStorage.getItem(FAVORITES_KEY)).toBe('{bad')
  first.unmount(); localStorage.removeItem(FAVORITES_KEY)
  mount()
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota denied') })
  fireEvent.click(screen.getByRole('button', { name: 'Add App Service to favorites' }))
  expect(screen.getByRole('alert').textContent).toMatch(/not saved.*quota denied/i)
  expect(screen.queryByRole('button', { name: 'Remove App Service from favorites' })).toBeNull()
})
it('should_reject_malformed_or_oversized_storage_and_bound_the_fixed_preference_key', () => {
  for (const invalid of ['null', '{}', JSON.stringify({ version: 1, icons: [12] }), JSON.stringify({ version: 1, icons: ['a'], extra: 1 }), ' '.repeat(65537)]) {
    localStorage.setItem(FAVORITES_KEY, invalid)
    expect(() => readFavorites(localStorage)).toThrow()
  }
  expect(() => saveFavorites(localStorage, Array.from({ length: 257 }, (_, i) => `future-${i}`))).toThrow()
})
it('should_report_unavailable_storage_reads_and_retry_without_touching_other_keys', () => {
  const original = Storage.prototype.getItem
  const read = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function(this: Storage, key: string) {
    if (key === FAVORITES_KEY) throw new Error('Owned read denied')
    return original.call(this, key)
  })
  mount()
  expect(screen.getByRole('alert').textContent).toMatch(/unavailable.*read denied/i)
  read.mockRestore()
  fireEvent.click(screen.getByRole('button', { name: 'Retry favorites storage' }))
  expect(screen.queryByRole('alert')).toBeNull()
  expect(localStorage.getItem(FAVORITES_KEY)).toBeNull()
})
