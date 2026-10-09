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
const decodeAsset = (key: string) => decodeURIComponent(vendorAssets[key].split(',').slice(1).join(','))
const projectPath = (relative: string) => resolve(process.cwd(), relative)

test('should_include_seven_requested_identities_in_a_compact_vendor_registry', () => {
  assert.ok(vendorLibrary.length >= 16 && vendorLibrary.length <= 20)
  assert.equal(new Set(vendorLibrary.map(item => item.icon)).size, vendorLibrary.length)
  for (const icon of requiredKeys) assert.ok(vendorLibrary.find(item => item.icon === icon), icon)
  for (const item of vendorLibrary) {
    assert.match(item.icon, /^vendor-[a-z0-9-]+$/)
    assert.equal(item.category, 'Vendors')
    assert.equal(item.catalog, 'software')
    assert.equal(item.subtitle, 'Named integration badge')
    assert.deepEqual(item.source.categories, ['Vendors'])
    assert.deepEqual(item.source.entries, [item.source.entry])
    assert.match(item.source.url, /^https:\/\//)
    assert.match(item.source.sha256, /^[a-f0-9]{64}$/)
    assert.equal(item.color, '#62696c')
    assert.ok(item.keywords?.includes('named integration badge'))
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

test('should_register_only_bundled_hash_verified_svg_when_assets_are_loaded_offline', () => {
  assert.deepEqual(Object.keys(vendorAssets).sort(), vendorLibrary.map(item => item.icon).sort())
  const files = readdirSync(projectPath('src/assets/vendors')).sort()
  assert.deepEqual(files, vendorLibrary.map(item => `${item.icon}.svg`).sort())
  for (const item of vendorLibrary) {
    assert.equal(item.source.entry, `app/src/assets/vendors/${item.icon}.svg`)
    const bytes = readFileSync(projectPath(`src/assets/vendors/${item.icon}.svg`))
    assert.ok(vendorAssets[item.icon].startsWith('data:image/svg+xml;charset=utf-8,'))
    assert.equal(hash(bytes), item.source.sha256)
    assert.equal(hash(decodeAsset(item.icon)), item.source.sha256)
  }
  for (const key of ['toString', '__proto__', '../../upload.svg', 'https://example.com/icon.svg']) {
    assert.equal(vendorAssets[key], undefined)
  }
})

test('should_use_inert_self_contained_xml_and_visible_plain_letters_when_rendering_badges', () => {
  const allowedElements = new Set(['svg', 'title', 'desc', 'path', 'text'])
  const allowedAttributes = new Set(['xmlns', 'width', 'height', 'viewBox', 'role', 'd', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'x', 'y', 'font-family', 'font-size', 'font-weight', 'text-anchor'])
  for (const item of vendorLibrary) {
    const source = decodeAsset(item.icon)
    assert.doesNotMatch(source, /<!DOCTYPE|<!ENTITY|<\?|script|foreignObject|href|url\(|@import|style=/i)
    const document = new DOMParser().parseFromString(source, 'image/svg+xml')
    assert.equal(document.querySelector('parsererror'), null)
    const root = document.documentElement
    assert.equal(root.localName, 'svg')
    assert.equal(root.namespaceURI, 'http://www.w3.org/2000/svg')
    assert.equal(root.getAttribute('viewBox'), '0 0 64 64')
    assert.equal(root.getAttribute('width'), '64')
    assert.equal(root.getAttribute('height'), '64')
    for (const element of [root, ...root.querySelectorAll('*')]) {
      assert.ok(allowedElements.has(element.localName), `${item.icon}: ${element.localName}`)
      for (const attribute of element.attributes) assert.ok(allowedAttributes.has(attribute.name), attribute.name)
    }
    const glyph = root.querySelector('text')!
    assert.match(glyph.textContent ?? '', /^[A-Z]{2,3}$/)
    assert.equal(glyph.getAttribute('font-family'), 'monospace')
    assert.ok(Number(glyph.getAttribute('font-size')) >= 25)
    assert.equal(root.querySelector('title')?.textContent, `${item.label}: named integration badge`)
    assert.match(root.querySelector('desc')?.textContent ?? '', /original.*not.*official.*logo/i)
  }
})

test('should_document_badge_classification_and_trademarks_without_claiming_logo_permission', () => {
  const notices = readFileSync(projectPath('public/VENDOR-NOTICES.md'), 'utf8')
  const license = readFileSync(projectPath('public/licenses/vendor-badges/README.md'), 'utf8')
  for (const item of vendorLibrary) {
    assert.ok(notices.includes(item.icon), item.icon)
    assert.ok(notices.includes(item.source.url), item.source.url)
  }
  assert.match(notices, /No affiliation, sponsorship, or endorsement/i)
  assert.match(notices, /17 original named integration badges; 0 official logos/)
  assert.match(license, /does not grant.*trademark/i)
  const registrySource = readFileSync(projectPath('src/vendor-icons/catalog.ts'), 'utf8')
  const assetSource = readFileSync(projectPath('src/vendor-icons/assets.ts'), 'utf8')
  assert.doesNotMatch(registrySource + assetSource, /\.\.\/catalog\.ts|\.\.\/assets\.ts|fetch\(|import\.meta\.glob|\?raw/)
})