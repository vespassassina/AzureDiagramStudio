import assert from 'node:assert/strict'
import { test } from 'vitest'
import { architectureCategories, searchArchitectureCatalog } from './architecture-catalog.ts'
import type { ArchitectureCatalogChoice } from './architecture-catalog.ts'

const entries: readonly ArchitectureCatalogChoice[] = [
  { key: 'web-api', label: 'Vision pipeline', source: '{}', sourceCue: 'Architecture catalog', origin: 'Google Cloud', categoryPath: ['AI and search', 'Image enrichment'], summary: 'Image processing.', reference: 'https://example.test/vision', reviewedOn: '2026-11-06', caveats: ['Feature parity is not implied.'] },
  { key: 'event-driven', label: 'Cell placement', source: '{}', sourceCue: 'Architecture catalog', origin: 'AWS', categoryPath: ['SaaS and multitenancy', 'Cell routing'], summary: 'Tenant placement.', reference: 'https://example.test/cells', reviewedOn: '2026-11-06', caveats: ['Migration needs design.'] },
  { key: 'fabric', label: 'Grounded assistant', source: '{}', sourceCue: 'Architecture catalog', origin: 'Microsoft', categoryPath: ['AI and search', 'Grounded assistants'], summary: 'Grounded responses.', reference: 'https://example.test/rag', reviewedOn: '2026-11-06', caveats: ['Evaluation is required.'] },
]

test('should_group_researched_architectures_by_workload_then_subcategory_DGM164', () => {
  const categories = architectureCategories(entries)
  assert.deepEqual(categories.map(category => category.name), ['AI and search', 'SaaS and multitenancy'])
  assert.deepEqual(categories[0].subcategories.map(category => [category.name, category.entries.map(entry => entry.label)]), [
    ['Grounded assistants', ['Grounded assistant']],
    ['Image enrichment', ['Vision pipeline']],
  ])
})

test('should_search_researched_architectures_by_title_category_or_origin_DGM164', () => {
  assert.deepEqual(searchArchitectureCatalog(entries, 'vision').map(entry => entry.label), ['Vision pipeline'])
  assert.deepEqual(searchArchitectureCatalog(entries, 'AI AND SEARCH').map(entry => entry.label).sort(), ['Grounded assistant', 'Vision pipeline'])
  assert.deepEqual(searchArchitectureCatalog(entries, 'aws').map(entry => entry.label), ['Cell placement'])
  assert.deepEqual(searchArchitectureCatalog(entries, 'no match'), [])
  assert.equal(searchArchitectureCatalog(entries, '  ').length, entries.length)
})
