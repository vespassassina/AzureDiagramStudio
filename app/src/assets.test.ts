import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { test } from 'vitest'
import { visualAssets } from './assets.ts'
import * as catalog from './catalog.ts'

const sha256 = (bytes: Uint8Array | string) => createHash('sha256').update(bytes).digest('hex')
const inventory = JSON.parse(readFileSync(new URL('./catalog/inventory.json', import.meta.url), 'utf8')) as {
  archives: Record<string, { entryCount: number; uniqueItemCount: number; duplicatePlacementCount: number; categories: { entryCount: number }[]; sha256: string; safetyFlags: unknown[] }>
  coverage: { catalog: string; entry: string; icon: string; category: string; sha256: string }[]
}
const libraries = [...catalog.azureLibrary, ...catalog.fabricLibrary]
const byIcon = new Map<string, (typeof libraries)[number]>(libraries.map(item => [item.icon, item]))

test('should_bundle_every_exact_official_entry_when_full_catalogs_are_imported', () => {
  assert.equal(inventory.archives.azure.entryCount, 714)
  assert.equal(inventory.archives.azure.categories.length, 29)
  assert.equal(inventory.archives.azure.uniqueItemCount, 638)
  assert.equal(inventory.archives.fabric.entryCount, 1584)
  assert.equal(inventory.archives.fabric.uniqueItemCount, 1584)
  assert.equal(inventory.archives.fabric.categories.length, 7)
  assert.equal(inventory.coverage.filter((entry: { catalog: string }) => entry.catalog === 'azure').length, 714)
  for (const vendor of ['azure', 'fabric']) {
    const archive = inventory.archives[vendor]
    const coverage = inventory.coverage.filter((entry: { catalog: string }) => entry.catalog === vendor)
    assert.equal(coverage.length, archive.entryCount)
    assert.equal(new Set(coverage.map((entry: { entry: string }) => entry.entry)).size, archive.entryCount)
    assert.equal(new Set(coverage.map((entry: { icon: string }) => entry.icon)).size, archive.uniqueItemCount)
    assert.equal(archive.duplicatePlacementCount, archive.entryCount - archive.uniqueItemCount)
    assert.equal(archive.categories.reduce((sum: number, group: { entryCount: number }) => sum + group.entryCount, 0), archive.entryCount)
    assert.match(archive.sha256, /^[a-f0-9]{64}$/)
    assert.deepEqual(archive.safetyFlags, [])
  }
  assert.equal(libraries.length, inventory.archives.azure.uniqueItemCount + inventory.archives.fabric.uniqueItemCount + 1)
  assert.equal(Object.keys(visualAssets.icons ?? {}).filter(key => !key.startsWith('vendor-') && !key.startsWith('microsoft-')).length, libraries.length)
  assert.equal(Object.keys(visualAssets.icons ?? {}).length, libraries.length + catalog.vendorLibrary.length + catalog.microsoftLibrary.length)
  assert.equal(new Set(libraries.map(item => item.icon)).size, libraries.length)
  for (const vendor of ['azure', 'fabric']) {
    const files = readdirSync(new URL(`./assets/${vendor}/`, import.meta.url)).filter(name => name.endsWith('.svg')).sort()
    const expected = libraries.filter(item => item.catalog === vendor).map(item => `${item.icon}.svg`).sort()
    assert.deepEqual(files, expected)
  }
})

test('should_preserve_all_24_original_keys_and_bytes_when_catalog_coverage_expands', () => {
  const legacy = JSON.parse(readFileSync(new URL('./catalog/legacy.json', import.meta.url), 'utf8'))
  assert.equal(legacy.length, 24)
  for (const entry of legacy) {
    const item = catalog.azureLibrary.find(item => item.icon === entry.icon)
    assert.ok(item)
    for (const field of ['icon', 'label', 'subtitle', 'color'] as const) assert.equal(item[field], entry[field], `${entry.icon}: ${field}`)
    assert.ok(item.source.entry.endsWith(entry.source))
    assert.equal(item.source.sha256, entry.sha256)
    assert.equal(sha256(readFileSync(new URL(`./assets/azure/${entry.icon}.svg`, import.meta.url))), entry.sha256)
    const uri = visualAssets.icons![entry.icon]
    assert.equal(sha256(decodeURIComponent(uri.slice(uri.indexOf(',') + 1))), entry.sha256)
  }
})

test('should_report_styles_and_sizes_as_variants_not_distinct_services_when_importing_fabric', () => {
  const archive = JSON.parse(readFileSync(new URL('./catalog/inventory.json', import.meta.url), 'utf8')).archives.fabric
  assert.deepEqual(archive.variants, {
    filenameFamilyCount: 380,
    styles: { color: 78, filled: 560, item: 342, 'non-item': 42, regular: 561 },
    sizes: { '12': 28, '16': 170, '20': 684, '24': 219, '28': 51, '32': 200, '40': 64, '48': 103, '64': 64 },
    unclassifiedEntryCount: 1,
  })
  assert.equal(Object.values(archive.variants.styles).reduce((sum: number, count) => sum + Number(count), 0) + archive.variants.unclassifiedEntryCount, 1584)
  for (const vendor of ['azure', 'fabric']) {
    const current = JSON.parse(readFileSync(new URL('./catalog/inventory.json', import.meta.url), 'utf8')).archives[vendor]
    assert.deepEqual(current.svgValidation.root, { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' })
    assert.equal(current.svgValidation.checkedEntryCount, current.entryCount)
    assert.equal(current.svgValidation.byteHashCheckedEntryCount, current.entryCount)
    assert.equal(current.svgValidation.documentScope, 'entire-xml-document')
    assert.equal(current.svgValidation.dtdProcessing, 'prohibit')
    assert.equal(current.svgValidation.xmlResolver, 'disabled')
    assert.equal(current.svgValidation.unsafeContentPolicy, 'reject')
  }
})

test('should_refuse_file_paths_when_an_icon_key_is_not_allowlisted', () => {
  assert.equal(visualAssets.icons?.['../../arbitrary.svg'], undefined)
  assert.equal(visualAssets.icons?.['https://example.com/icon.svg'], undefined)
  assert.equal(visualAssets.icons?.['toString'], undefined)
})

test.each(inventory.coverage.map(entry => [entry.entry, entry] as const))('should_preserve_exact_bytes_and_category_when_bundling_%s', (_name, entry) => {
  const item = byIcon.get(entry.icon)
  assert.ok(item, entry.entry)
  assert.ok(item.source.categories.includes(entry.category), entry.entry)
  assert.ok(item.source.entries?.includes(entry.entry), entry.entry)
  const bytes = readFileSync(new URL(`./assets/${entry.catalog}/${entry.icon}.svg`, import.meta.url))
  assert.equal(sha256(bytes), entry.sha256, entry.entry)
  const uri = visualAssets.icons?.[entry.icon]
  assert.ok(uri, entry.icon)
  assert.ok(uri.startsWith('data:image/svg+xml;charset=utf-8,'), entry.icon)
  assert.equal(sha256(decodeURIComponent(uri.slice(uri.indexOf(',') + 1))), entry.sha256, entry.icon)
})