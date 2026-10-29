import assert from 'node:assert/strict'
import path from 'node:path'

export const favoritesKey = 'azure-diagram-studio:favorites:v1'
const library = page => page.getByRole('complementary', { name: 'Component library', exact: true })
async function open(page) {
  if (!await library(page).isVisible() || await library(page).getAttribute('inert') !== null) {
    await page.getByRole('button', { name: 'Add component', exact: true }).click()
  }
  await library(page).getByRole('textbox', { name: 'Search components', exact: true }).waitFor()
  return library(page)
}
async function category(panel, name) { await panel.getByRole('tab', { name: new RegExp(`^${name}`) }).click() }

// Shared actual pointer/keyboard probe. No app state or callbacks are called
// directly: only the owned profile's storage-failure adapters are injected.
export async function favoritesBeforeRestart(page, output, label) {
  const panel = await open(page)
  await category(panel, 'Favorites')
  await panel.getByText(/No favorites yet/).waitFor()
  const tabs = panel.getByRole('tab')
  assert.equal(await tabs.count(), 3)
  const selected = panel.getByRole('tab', { name: /^Favorites/ })
  await selected.press('Home')
  assert.equal(await panel.getByRole('tab', { name: /^Azure/ }).getAttribute('aria-selected'), 'true')
  const query = panel.getByRole('textbox', { name: 'Search components', exact: true })
  await query.fill('App Service')
  await panel.getByRole('button', { name: 'Add App Service to favorites', exact: true }).click()
  await category(panel, 'Favorites')
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).waitFor()
  assert.equal(await panel.getByRole('button', { name: /^Insert / }).count(), 1)
  await query.fill('Storage')
  await panel.getByText(/No matching favorites/).waitFor()
  assert.equal(await panel.getByRole('button', { name: /^Insert / }).count(), 0)
  await query.fill('App Service')
  assert.equal(await panel.getByRole('button', { name: /^Insert / }).count(), 1)
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).click()
  assert.equal(await selected.getAttribute('aria-selected'), 'true')
  await panel.getByText(/No favorites yet/).waitFor()
  await category(panel, 'Azure')
  await query.fill('App Service')
  await panel.getByRole('button', { name: 'Add App Service to favorites', exact: true }).click()
  await category(panel, 'Favorites')
  const preference = await page.evaluate(key => localStorage.getItem(key), favoritesKey)
  assert.deepEqual(JSON.parse(preference), { version: 1, icons: ['azure-app'] })
  await page.getByRole('button', { name: 'Close component library', exact: true }).click()
  await page.getByRole('button', { name: 'Add component', exact: true }).click()
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).waitFor()
  assert.equal(await panel.locator('.library-bottom').count(), 0)
  assert.equal(await page.getByRole('button', { name: /Pin component library|Unpin component library/ }).count(), 0)
  await page.screenshot({ path: path.join(output, `${label}-favorites.png`) })
  await page.reload()
  await open(page)
  await category(panel, 'Favorites')
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).waitFor()
  return preference
}

export async function favoritesAfterRestart(page, preference) {
  const panel = await open(page)
  await category(panel, 'Favorites')
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).waitFor()
  assert.equal(await page.evaluate(key => localStorage.getItem(key), favoritesKey), preference)
  await panel.getByRole('tab', { name: /^Favorites/ }).press('ArrowRight')
  assert.equal(await panel.getByRole('tab', { name: /^Azure/ }).getAttribute('aria-selected'), 'true')
}

export async function favoritesStorageFailures(page, preference) {
  await page.evaluate(key => {
    globalThis.originalFavoriteSet = Storage.prototype.setItem
    Storage.prototype.setItem = function(name, value) {
      if (name === key) throw new Error('Owned favorite storage write denied')
      return globalThis.originalFavoriteSet.call(this, name, value)
    }
  }, favoritesKey)
  let panel = await open(page)
  await category(panel, 'Favorites')
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).click()
  await panel.getByRole('alert').filter({ hasText: /Favorites not saved.*write denied/ }).waitFor()
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).waitFor()
  assert.equal(await page.evaluate(key => localStorage.getItem(key), favoritesKey), preference)
  await page.evaluate(key => {
    Storage.prototype.setItem = globalThis.originalFavoriteSet
    delete globalThis.originalFavoriteSet
    localStorage.setItem(key, '{malformed-owned-fixture')
    localStorage.setItem('dgm139-unrelated', 'preserve')
  }, favoritesKey)
  await page.reload()
  panel = await open(page)
  await panel.getByRole('alert').filter({ hasText: /Favorites unavailable/ }).waitFor()
  await category(panel, 'Favorites')
  assert.equal(await panel.getByRole('button', { name: /^Insert / }).count(), 0)
  await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key: favoritesKey, value: preference })
  await panel.getByRole('button', { name: 'Retry favorites storage', exact: true }).click()
  await panel.getByRole('button', { name: 'Remove App Service from favorites', exact: true }).waitFor()
  assert.equal(await panel.getByRole('alert').count(), 0)
  assert.equal(await page.evaluate(() => localStorage.getItem('dgm139-unrelated')), 'preserve')
}
