// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test, vi } from 'vitest'
import { microsoftLibrary } from './catalog.ts'
import { microsoftAssets } from './assets.ts'

const requiredKeys = ['sharepoint', 'business-central', 'dynamics365', 'm365', 'copilot', 'copilot-studio', 'excel', 'word', 'powerpoint', 'teams'].map(key => `microsoft-${key}`)
const hash = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const projectPath = (relative: string) => resolve(process.cwd(), relative)
const decode = (url: string) => url.includes(';base64,') ? Buffer.from(url.split(',')[1], 'base64') : Buffer.from(decodeURIComponent(url.slice(url.indexOf(',') + 1)))

test('should_include_all_ten_required_identities_in_a_compact_microsoft_registry', () => {
  assert.ok(microsoftLibrary.length >= 14 && microsoftLibrary.length <= 15)
  assert.equal(new Set(microsoftLibrary.map(item => item.icon)).size, microsoftLibrary.length)
  for (const icon of requiredKeys) assert.ok(microsoftLibrary.some(item => item.icon === icon), icon)
  for (const item of microsoftLibrary) {
    assert.match(item.icon, /^microsoft-[a-z0-9-]+$/)
    assert.equal(item.category, 'Microsoft Apps')
    assert.equal(item.catalog, 'azure')
    assert.deepEqual(item.source.categories, ['Microsoft Apps'])
    assert.ok(item.source.entries.includes(item.source.entry))
    assert.match(item.source.url, /^https:\/\//)
    assert.match(item.source.sha256, /^[a-f0-9]{64}$/)
    assert.match(item.color, /^#[a-f0-9]{6}$/i)
    assert.ok(item.aliases?.length)
    assert.ok(item.keywords?.length)
    assert.match(item.subtitle, /official.*architecture|original.*badge/i)
    assert.ok(Object.isFrozen(item) && Object.isFrozen(item.source) && Object.isFrozen(item.source.entries))
  }
  assert.ok(Object.isFrozen(microsoftLibrary) && Object.isFrozen(microsoftAssets))
})

test.each([
  ['microsoft-sharepoint', 'SharePoint Online'], ['microsoft-business-central', 'Dynamics 365 Business Central'],
  ['microsoft-dynamics365', 'D365'], ['microsoft-m365', 'Office 365'], ['microsoft-copilot', 'Microsoft 365 Copilot'],
  ['microsoft-copilot-studio', 'Power Virtual Agents'], ['microsoft-excel', 'Excel'], ['microsoft-word', 'Word'],
  ['microsoft-powerpoint', 'PowerPoint'], ['microsoft-teams', 'Teams'], ['microsoft-outlook', 'Outlook'],
  ['microsoft-onedrive', 'OneDrive'], ['microsoft-power-apps', 'Power Apps'], ['microsoft-power-automate', 'Flow'],
])('should_supply_search_alias_%s_%s_without_shared_catalog_imports', (icon, alias) => {
  const item = microsoftLibrary.find(candidate => candidate.icon === icon)!
  assert.ok([item.label, ...(item.aliases ?? [])].includes(alias))
})

test('should_distinguish_copilot_products_and_business_central_from_the_dynamics_family', () => {
  const copilot = microsoftLibrary.find(item => item.icon === 'microsoft-copilot')!
  const studio = microsoftLibrary.find(item => item.icon === 'microsoft-copilot-studio')!
  const dynamics = microsoftLibrary.find(item => item.icon === 'microsoft-dynamics365')!
  const business = microsoftLibrary.find(item => item.icon === 'microsoft-business-central')!
  assert.equal(copilot.label, 'Microsoft 365 Copilot')
  assert.equal(studio.label, 'Microsoft Copilot Studio')
  assert.equal(dynamics.label, 'Dynamics 365')
  assert.equal(business.label, 'Dynamics 365 Business Central')
  assert.notEqual(copilot.source.sha256, studio.source.sha256)
  assert.notEqual(dynamics.source.sha256, business.source.sha256)
  assert.ok(!copilot.aliases?.includes('Microsoft Copilot Studio'))
  assert.ok(!studio.aliases?.includes('Microsoft 365 Copilot'))
  assert.ok(!copilot.aliases?.includes('Microsoft Copilot'))
})

test('should_embed_exact_local_bytes_with_verified_provenance_for_every_asset', () => {
  assert.deepEqual(Object.keys(microsoftAssets).sort(), microsoftLibrary.map(item => item.icon).sort())
  const files = readdirSync(projectPath('src/assets/microsoft')).sort()
  assert.equal(files.length, microsoftLibrary.length)
  for (const item of microsoftLibrary) {
    const filename = files.find(file => file.replace(/\.(svg|png)$/, '') === item.icon)!
    assert.ok(filename, item.icon)
    const bytes = readFileSync(projectPath(`src/assets/microsoft/${filename}`))
    assert.match(microsoftAssets[item.icon], /^data:image\/(svg\+xml|png)(;charset=utf-8|;base64),/)
    assert.equal(hash(bytes), item.source.sha256)
    assert.deepEqual(decode(microsoftAssets[item.icon]), bytes)
  }
  for (const key of ['toString', '__proto__', '../../upload.svg', 'https://example.com/icon.svg']) assert.equal(microsoftAssets[key], undefined)
})

test('should_reject_active_or_external_content_in_trusted_svg_artwork', () => {
  for (const item of microsoftLibrary) {
    const url = microsoftAssets[item.icon]
    if (url.startsWith('data:image/png;')) {
      assert.deepEqual([...decode(url).subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
      continue
    }
    const source = decode(url).toString('utf8')
    assert.doesNotMatch(source, /<!DOCTYPE|<!ENTITY|<\s*(?:script|foreignObject|iframe|object|embed|animate|set)\b|\bon\w+\s*=|@import|javascript:/i)
    const document = new DOMParser().parseFromString(source, 'image/svg+xml')
    assert.equal(document.querySelector('parsererror'), null, item.icon)
    assert.equal(document.documentElement.localName, 'svg')
    assert.ok(document.documentElement.hasAttribute('viewBox'))
    for (const element of document.querySelectorAll('*')) {
      for (const attribute of element.attributes) {
        if (/^(?:href|xlink:href|src)$/i.test(attribute.name)) assert.match(attribute.value, /^#[a-z0-9_.:-]+$/i)
        for (const reference of attribute.value.matchAll(/url\(\s*['"]?([^)'"\s]+)/gi)) assert.match(reference[1], /^#[a-z0-9_.:-]+$/i)
      }
    }
    for (const style of document.querySelectorAll('style')) assert.doesNotMatch(style.textContent ?? '', /@import|url\(\s*['"]?(?!#)/i)
  }
})

test('should_disclose_every_source_hash_and_fallback_without_claiming_branding_rights', () => {
  const notices = readFileSync(projectPath('public/MICROSOFT-APP-NOTICES.md'), 'utf8')
  const terms = readFileSync(projectPath('public/licenses/microsoft-apps/README.md'), 'utf8')
  for (const item of microsoftLibrary) {
    for (const evidence of [item.icon, item.source.url, item.source.entry, item.source.sha256]) assert.ok(notices.includes(evidence), evidence)
    if (/badge/i.test(item.subtitle)) assert.ok(notices.includes(`${item.icon}: original named badge`))
  }
  assert.match(terms, /architectural diagrams, training materials, or documentation/)
  assert.match(notices, /No affiliation, sponsorship, or endorsement/i)
  assert.match(notices, /not.*branding/i)
})

test('should_load_fresh_registry_and_asset_modules_without_dom_network_or_shared_dispatch', async () => {
  vi.resetModules()
  const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => { throw new Error('Offline') })
  const elementSpy = vi.spyOn(document, 'createElement')
  try {
    const registry = await import('./catalog.ts')
    const assets = await import('./assets.ts')
    assert.equal(registry.microsoftLibrary.length, microsoftLibrary.length)
    assert.deepEqual(Object.keys(assets.microsoftAssets), Object.keys(microsoftAssets))
    assert.equal(fetchSpy.mock.calls.length, 0)
    assert.equal(elementSpy.mock.calls.length, 0)
    const modules = ['catalog.ts', 'assets.ts'].map(file => readFileSync(projectPath(`src/microsoft-icons/${file}`), 'utf8')).join('\n')
    assert.doesNotMatch(modules, /\.\.\/catalog\.ts|\.\.\/assets\.ts|fetch\(|document\.|window\.|import\.meta\.glob|\?raw/)
  } finally {
    fetchSpy.mockRestore()
    elementSpy.mockRestore()
  }
})