import assert from 'node:assert/strict'
import { test } from 'vitest'
import * as catalog from './catalog.ts'
import { visualAssets } from './assets.ts'
import { sampleDiagram } from './model.ts'
import { parseDocument } from './document/index.ts'
import { buildScene, renderSvg } from './scene.ts'

test('should_expose_frozen_group_contract_when_all_catalogs_are_searched', () => {
  const groups = catalog.catalogGroups(catalog.allLibraryItems)
  assert.equal(groups.filter(group => group.catalog === 'azure' && group.label !== 'Microsoft Apps').length, 29)
  assert.equal(groups.filter(group => group.catalog === 'azure').length, 30)
  assert.equal(groups.find(group => group.id === 'azure-microsoft-apps')?.items.length, catalog.microsoftLibrary.length)
  assert.equal(groups.find(group => group.id === 'software-vendors')?.items.length, catalog.vendorLibrary.length)
  assert.equal(groups.filter(group => group.catalog === 'fabric').length, 7)
  assert.equal(new Set(groups.map(group => group.id)).size, groups.length)
  for (const group of groups) {
    assert.ok(group.id.startsWith(`${group.catalog}-`))
    assert.ok(group.items.length)
    assert.equal(group.items.every(item => item.catalog === group.catalog), true)
  }
  assert.deepEqual(catalog.catalogGroups(catalog.allLibraryItems.slice().reverse()), groups)
  for (const query of ['OneLake', 'Lakehouse', 'KQL', 'pipeline', 'Data Factory', 'App Service']) {
    assert.ok(catalog.catalogGroups(catalog.allLibraryItems, query).some(group => group.items.length), query)
  }
  assert.deepEqual(catalog.catalogGroups(catalog.allLibraryItems, 'no-such-component-12345'), [])
  for (const group of groups) assert.ok(catalog.catalogGroups(catalog.allLibraryItems, group.label).some(match => match.id === group.id))
  assert.equal(catalog.genericLibrary.every(item => item.catalog === 'software' && item.category && item.source), true)
})

test('should_use_only_official_glyphs_when_fabric_core_components_are_selected', () => {
  for (const label of ['OneLake', 'Lakehouse', 'Warehouse', 'Notebook', 'Data pipeline', 'Dataflow Gen2', 'Eventhouse', 'Eventstream', 'KQL database', 'Semantic model', 'Report', 'ML model', 'Experiment']) {
    const item = catalog.fabricLibrary.find(item => item.label.toLowerCase() === label.toLowerCase())
    assert.ok(item, label)
    assert.equal(item.catalog, 'fabric')
    assert.ok(item.source.entry.endsWith('.svg'))
    assert.match(item.source.sha256, /^[a-f0-9]{64}$/)
    assert.ok(visualAssets.icons?.[item.icon])
  }
})

test('should_reject_unsafe_and_inherited_keys_when_allowlisting_expanded_catalogs', () => {
  for (const item of catalog.allLibraryItems) assert.equal(catalog.isIconKey(item.icon), true, item.icon)
  for (const key of ['__proto__', 'constructor', 'prototype', 'toString', 'hasOwnProperty', '../../icon.svg', 'fabric-not-a-published-icon', 'azure-not-a-published-icon', 'https://example.com/icon.svg']) {
    assert.equal(catalog.isIconKey(key), false, key)
    assert.equal(visualAssets.icons?.[key], undefined, key)
  }
})

test.each(catalog.allLibraryItems.map(item => [item.icon, item] as const))('should_open_and_render_unchanged_schema_when_using_%s', (_key, item) => {
    const document = sampleDiagram()
    document.entities[3].icon = item.icon
    const result = parseDocument(JSON.stringify(document))
    assert.ok(result.ok, item.icon)
    assert.deepEqual(result.value, document)
    assert.equal(result.value.schemaVersion, 1)
    const svg = renderSvg(buildScene(result.value), visualAssets)
    assert.ok(svg.includes('<svg'), item.icon)
    if (item.catalog !== 'software') assert.ok(svg.includes('data:image/svg+xml'), item.icon)
})

test('should_deduplicate_placements_without_merging_different_published_identities', () => {
  const appService = catalog.azureLibrary.find(item => item.icon === 'azure-app')!
  assert.ok(appService.source.entries!.length > 1)
  for (const category of appService.source.categories) assert.ok(catalog.catalogGroups(catalog.allLibraryItems).find(group => group.catalog === 'azure' && group.label === category)?.items.some(item => item.icon === 'azure-app'))
  for (const labels of [['Genomics', 'Genomics Accounts'], ['AKS', 'Container Services (Deprecated)']]) {
    const items = labels.map(label => catalog.azureLibrary.find(item => item.label === label)!)
    assert.ok(items.every(Boolean), labels.join(', '))
    assert.notEqual(items[0].icon, items[1].icon)
    assert.equal(items[0].source.sha256, items[1].source.sha256)
  }
  const oneLake = catalog.fabricLibrary.find(item => item.label === 'OneLake')!
  assert.match(oneLake.source.entry, /\/one_lake_\d+_(?:color|filled|regular)\.svg$/)
  const gen2 = catalog.fabricLibrary.find(item => item.label === 'Dataflow Gen2')!
  assert.match(gen2.source.entry, /\/dataflow_gen2_\d+_item\.svg$/)
})

test('should_use_readable_names_and_identify_retired_services_when_old_glyphs_remain_published', () => {
  assert.ok(catalog.azureLibrary.some(item => item.label === 'VPN Client (Windows)'))
  for (const label of ['Batch AI', 'Scheduler', 'Time Series Insights Environments', 'Azure Blockchain Service']) {
    const item = catalog.azureLibrary.find(item => item.label === label)
    assert.ok(item, label)
    assert.match(item.subtitle, /legacy|retired|deprecated/i, label)
  }
  for (const item of catalog.allLibraryItems) assert.equal(/^\d+\s*-icon-/i.test(item.label), false, item.label)
})

test('should_find_actual_official_components_when_searching_core_names_and_canonical_aliases', () => {
  const cases = [
    ['OneLake', 'OneLake', 'one-lake'], ['One Lake', 'OneLake', 'one-lake'],
    ['Lakehouse', 'Lakehouse', 'lakehouse'], ['KQL', 'KQL database', 'kql-database'],
    ['Pipeline', 'Data pipeline', 'pipeline'], ['Data flow Gen 2', 'Dataflow Gen2', 'dataflow-gen2'],
    ['Event house', 'Eventhouse', 'event-house'], ['Event stream', 'Eventstream', 'eventstream'],
    ['Machine learning model', 'ML model', 'model'], ['ML experiment', 'Experiment', 'experiments'],
  ]
  for (const [query, label, stem] of cases) {
    const items = catalog.fabricLibrary.filter(item => item.label === label)
    assert.ok(items.length, label)
    const found = new Set(catalog.catalogGroups(catalog.allLibraryItems, query).flatMap(group => group.items.map(item => item.icon)))
    for (const item of items) {
      assert.ok(found.has(item.icon), `${query}: ${item.icon}`)
      assert.match(item.icon, new RegExp(`^fabric-${stem}-\\d+-(color|filled|regular|item|non-item)$`))
      assert.match(item.source.entry, new RegExp(`/${stem.replace(/-/g, '_')}_\\d+_(color|filled|regular|item|non-item)\\.svg$`))
    }
  }
  for (const item of catalog.fabricLibrary) assert.equal(/_|\.svg$|_(?:filled|regular|item)|^\d/i.test(item.label), false, item.label)
})

test('should_use_a_readable_label_without_changing_the_key_when_a_published_style_suffix_is_malformed', () => {
  const item = catalog.fabricLibrary.find(item => item.icon === 'fabric-globe-settings-20-filed')
  assert.ok(item)
  assert.equal(item.label, 'Globe settings')
  assert.equal(item.category, 'Platform & OneLake')
  assert.equal(item.source.entry, 'v6.1.0/package/dist/svg/globe_settings_20_filed.svg')
  assert.match(item.subtitle, /published.*filed.*20 px/)
  assert.ok(catalog.catalogGroups(catalog.fabricLibrary, 'Globe settings').some(group => group.items.some(match => match.icon === item.icon)))
})