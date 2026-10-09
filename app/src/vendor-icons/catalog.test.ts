// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { test } from 'vitest'
import { vendorLibrary } from './catalog.ts'
import { vendorAssets } from './assets.ts'

const requiredKeys = ['vendor-oracle', 'vendor-sap', 'vendor-ibm', 'vendor-aws', 'vendor-gcp', 'vendor-hp', 'vendor-hpe']
const hash = (bytes: string | Uint8Array) => createHash('sha256').update(bytes).digest('hex')
const decodeAsset = (key: string) => Buffer.from(vendorAssets[key].split(',').slice(1).join(','), 'base64')
const projectPath = (relative: string) => resolve(process.cwd(), relative)

test('should_include_seven_requested_identities_in_a_compact_vendor_registry', () => {
  assert.ok(vendorLibrary.length >= 16 && vendorLibrary.length <= 20)
  assert.equal(new Set(vendorLibrary.map(item => item.icon)).size, vendorLibrary.length)
  for (const icon of requiredKeys) assert.ok(vendorLibrary.find(item => item.icon === icon), icon)
  for (const item of vendorLibrary) {
    assert.match(item.icon, /^vendor-[a-z0-9-]+$/)
    assert.equal(item.category, 'Vendors')
    assert.equal(item.catalog, 'software')
    assert.equal(item.subtitle, 'Vendor product icon')
    assert.deepEqual(item.source.categories, ['Vendors'])
    assert.deepEqual(item.source.entries, [item.source.entry])
    assert.match(item.source.url, /^https:\/\//)
    assert.match(item.source.sha256, /^[a-f0-9]{64}$/)
    assert.equal(item.color, '#62696c')
    assert.ok(item.keywords?.includes('vendor product icon'))
  }
})

test('should_keep_hp_and_hpe_distinct_when_names_and_assets_are_resolved', () => {
  const hp = vendorLibrary.find(item => item.icon === 'vendor-hp')!
  const hpe = vendorLibrary.find(item => item.icon === 'vendor-hpe')!
  assert.equal(hp.label, 'HP')
  assert.equal(hpe.label, 'HPE')
  assert.notEqual(hp.source.sha256, hpe.source.sha256)
  assert.notEqual(vendorAssets[hp.icon], vendorAssets[hpe.icon])
  assert.ok(!hp.aliases?.includes('Hewlett Packard Enterprise'))
  assert.ok(!hpe.aliases?.includes('HP Inc.'))
})

test.each([
  ['vendor-aws', 'Amazon'], ['vendor-aws', 'Amazon Web Services'], ['vendor-aws', 'AWS'],
  ['vendor-gcp', 'Google'], ['vendor-gcp', 'Google Cloud'], ['vendor-gcp', 'GCP'],
  ['vendor-hp', 'Hewlett-Packard'], ['vendor-hp', 'Hewlett Packard'], ['vendor-hp', 'HP Inc.'],
  ['vendor-hpe', 'Hewlett Packard Enterprise'], ['vendor-hpe', 'HPE'],
])('should_supply_search_alias_%s_%s_without_shared_catalog_imports', (icon, alias) => {
  const item = vendorLibrary.find(candidate => candidate.icon === icon)!
  assert.ok([item.label, ...(item.aliases ?? [])].includes(alias))
})

test('should_register_only_bundled_hash_verified_png_when_assets_are_loaded_offline', () => {
  assert.deepEqual(Object.keys(vendorAssets).sort(), vendorLibrary.map(item => item.icon).sort())
  const files = readdirSync(projectPath('src/assets/vendors')).sort()
  assert.deepEqual(files, vendorLibrary.map(item => `${item.icon}.png`).sort())
  for (const item of vendorLibrary) {
    assert.equal(item.source.entry, `app/src/assets/vendors/${item.icon}.png`)
    const bytes = readFileSync(projectPath(`src/assets/vendors/${item.icon}.png`))
    assert.ok(vendorAssets[item.icon].startsWith('data:image/png;base64,'))
    assert.equal(hash(bytes), item.source.sha256)
    assert.equal(hash(decodeAsset(item.icon)), item.source.sha256)
  }
  for (const key of ['toString', '__proto__', '../../upload.svg', 'https://example.com/icon.svg']) {
    assert.equal(vendorAssets[key], undefined)
  }
})

test('should_use_valid_bounded_png_images_when_rendering_vendor_icons', () => {
  for (const item of vendorLibrary) {
    const bytes = decodeAsset(item.icon)
    assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    assert.ok(width > 0 && width <= 256)
    assert.ok(height > 0 && height <= 256)
  }
})

test('should_document_vendor_icons_and_trademarks_without_claiming_logo_permission', () => {
  const notices = readFileSync(projectPath('public/VENDOR-NOTICES.md'), 'utf8')
  const license = readFileSync(projectPath('public/licenses/vendor-badges/README.md'), 'utf8')
  for (const item of vendorLibrary) {
    assert.ok(notices.includes(item.icon), item.icon)
    assert.ok(notices.includes(item.source.url), item.source.url)
  }
  assert.match(notices, /No affiliation, sponsorship, or endorsement/i)
  assert.match(notices, /17 bundled vendor PNG icons/)
  assert.match(license, /does not grant.*trademark/i)
  const registrySource = readFileSync(projectPath('src/vendor-icons/catalog.ts'), 'utf8')
  const assetSource = readFileSync(projectPath('src/vendor-icons/assets.ts'), 'utf8')
  assert.doesNotMatch(registrySource + assetSource, /\.\.\/catalog\.ts|\.\.\/assets\.ts|fetch\(|import\.meta\.glob|\?raw/)
})