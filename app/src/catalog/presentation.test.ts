import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { test } from 'vitest'
import { allLibraryItems, fabricLibrary, isIconKey, vendorLibrary, microsoftLibrary } from '../catalog.ts'
import { isSelectableIcon, legacyItem, menuGroups, searchGroups, searchableLibrary, selectionLibrary } from './presentation.ts'
import * as presentation from './presentation.ts'
import { lifecycleDecision } from './lifecycle.ts'
import semantics from './semantics.json'
import legacy from './legacy.json'

const pins = [
  ['App Service', 'Azure Functions', 'Virtual Machines', 'AKS'],
  ['Virtual Network', 'Front Door', 'Application Gateway', 'Load Balancer'],
  ['Storage account', 'SQL Database', 'Cosmos DB', 'Azure Database for PostgreSQL'],
  ['Azure OpenAI', 'Azure Machine Learning', 'Azure AI Search', 'Azure Databricks'],
  ['API Management', 'Service Bus', 'Event Hubs', 'Logic Apps'],
  ['Microsoft Entra ID', 'Key Vault', 'Azure Monitor', 'Defender for Cloud'],
  ['OneLake', 'Lakehouse', 'Warehouse', 'Data pipeline'],
  ['SharePoint', 'Microsoft Teams', 'Microsoft 365', 'Microsoft 365 Copilot'],
]
const alphabetical = (labels: string[]) => labels.slice().sort((left, right) => left.localeCompare(right, 'en', { sensitivity: 'base', numeric: true }))

test('should_rank_API_Management_first_when_searching_APIM', () => {
  const groups = searchGroups('APIM')
  assert.equal(groups[0]?.items[0]?.icon, 'azure-api')
  assert.equal(groups[0]?.id, 'azure-integration')
})

test('should_rank_curated_aliases_and_exact_labels_first_when_searching_current_services', () => {
  const queries = [
    ['APIM', 'azure-api'], ['AAD', 'azure-entra'], ['Azure AD', 'azure-entra'],
    ['Azure Active Directory', 'azure-entra'], ['Entra ID', 'azure-entra'],
    ['ACA', 'azure-container-apps'], ['AKS', 'azure-aks'], ['API', 'api'],
    ['API Management', 'azure-api'], ['Microsoft Entra ID', 'azure-entra'],
    ['Container Apps', 'azure-container-apps'],
  ]
  for (const [query, icon] of queries) {
    const groups = searchGroups(query)
    assert.equal(groups[0]?.items[0]?.icon, icon, query)
    assert.deepEqual(searchGroups(`  ${query.toLowerCase()}  `), groups, query)
  }
})

test('should_keep_token_prefixes_ahead_of_Central_substrings_when_searching_Entra', () => {
  const matches = searchGroups('entra').flatMap(group => group.items)
  const identityIndex = matches.findIndex(item => item.icon === 'azure-entra')
  const centralMatches = matches.filter(item => /central/i.test(item.label))
  assert.ok(identityIndex >= 0)
  assert.ok(centralMatches.length > 0)
  for (const item of centralMatches) assert.ok(matches.indexOf(item) > identityIndex, item.label)
  assert.equal(searchGroups('Entra ID')[0]?.items[0]?.icon, 'azure-entra')
  assert.equal(searchGroups('Entra ID')[0]?.id, 'azure-security-management')
})

test('should_return_complete_flat_ranked_results_when_context_picker_searches', () => {
  assert.equal(typeof presentation.rankedSearch, 'function')
  assert.equal(presentation.rankedSearch(''), searchableLibrary)
  assert.equal(presentation.rankedSearch('  '), searchableLibrary)
  for (const query of ['APIM', 'AAD', 'Entra ID', 'ACA', 'pipeline', 'azure', 'no-such-component-12345']) {
    const flat = presentation.rankedSearch(query)
    const grouped = searchGroups(query).flatMap(group => group.items)
    assert.deepEqual(flat.map(item => item.icon).sort(), grouped.map(item => item.icon).sort(), query)
    assert.equal(new Set(flat.map(item => item.icon)).size, flat.length, query)
    assert.equal(Object.isFrozen(flat), true)
    for (const item of flat) assert.equal(item, searchableLibrary.find(candidate => candidate.icon === item.icon))
    assert.equal(presentation.rankedSearch(`  ${query.toUpperCase()} `), flat)
  }
  assert.equal(presentation.rankedSearch('APIM')[0]?.icon, 'azure-api')
  const snapshot = presentation.rankedSearch('Entra ID')
  presentation.rankedSearch('pipeline')
  assert.equal(snapshot[0]?.icon, 'azure-entra')
})

test('should_sort_match_tiers_and_stable_collator_ties_when_searching_flat_or_grouped', () => {
  assert.equal(typeof presentation.rankedSearch, 'function')
  const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
  const owners = new Map(searchGroups('').flatMap(group => group.items.map(item => [item.icon, group] as const)))
  for (const query of ['API', 'APIM', 'AAD', 'ACA', 'Entra ID', 'entr', 'azure', 'pipeline', 'vm', 'server']) {
    const normalized = query.toLocaleLowerCase('en')
    const prefix = new RegExp(`(?:^|[^\\p{L}\\p{N}])${normalized}`, 'u')
    const ranked = searchableLibrary.map(item => {
      const fields = [item.label, item.subtitle, item.category, owners.get(item.icon)!.label, ...item.source.categories, ...(item.aliases ?? []), ...(item.keywords ?? [])]
        .map(field => field.toLocaleLowerCase('en'))
      const exactLabel = item.label.toLocaleLowerCase('en') === normalized
      const exactAlias = item.aliases?.some(alias => alias.toLocaleLowerCase('en') === normalized)
      const rank = exactLabel ? 0 : exactAlias ? 1 : fields.some(field => prefix.test(field)) ? 2 : 3
      return { item, rank, matches: fields.some(field => field.includes(normalized)) }
    }).filter(entry => entry.matches).sort((left, right) => left.rank - right.rank
      || collator.compare(left.item.label, right.item.label) || collator.compare(left.item.icon, right.item.icon))
    assert.deepEqual(presentation.rankedSearch(query).map(item => item.icon), ranked.map(entry => entry.item.icon), query)
    const groupIds = [...new Set(ranked.map(entry => owners.get(entry.item.icon)!.id))]
    const groups = searchGroups(query)
    assert.deepEqual(groups.map(group => group.id), groupIds, query)
    for (const group of groups) {
      assert.deepEqual(group.items.map(item => item.icon), ranked.filter(entry => owners.get(entry.item.icon)!.id === group.id).map(entry => entry.item.icon), `${query}: ${group.id}`)
    }
    assert.deepEqual(presentation.rankedSearch(query), presentation.rankedSearch(query), query)
  }
})

test('should_preserve_all_inventory_ids_raw_metadata_and_default_menus_when_ranking_search', () => {
  const fingerprint = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex')
  assert.equal(selectionLibrary.length, 696)
  assert.equal(allLibraryItems.length, 2266)
  assert.equal(fingerprint(selectionLibrary.map(item => item.icon).sort()), '08a681c123944a31891ffc77f6da2f7763896fa08a76c8425e97c84b946f114a')
  assert.equal(fingerprint(allLibraryItems), '33dc7dded3b3466747950f5cbcd4352deb1a8ec470c852da6ba194a7137e7ebf')
  const menus = [...menuGroups('azure'), ...menuGroups('software')].map(group => ({ ...group, items: group.items.map(item => item.icon) }))
  assert.equal(fingerprint(menus), '6dd6e41c0431d47b14bedf2db94e1af325eb93b86cd98553765de9040f2810ca')
})

test('should_keep_excluded_icons_out_of_ranked_search_when_legacy_documents_can_still_resolve_them', () => {
  assert.equal(typeof presentation.rankedSearch, 'function')
  const excluded = allLibraryItems.filter(item => lifecycleDecision(item).excluded)
  assert.equal(excluded.length, 32)
  for (const item of excluded) {
    assert.equal(presentation.rankedSearch(item.label).some(candidate => candidate.icon === item.icon), false, item.icon)
    assert.equal(isSelectableIcon(item.icon), false, item.icon)
    assert.equal(legacyItem(item.icon), item)
    assert.equal(isIconKey(item.icon), true)
  }
  for (const query of ['Bonsai', 'Blockchain', 'Batch AI', 'Scheduler', 'QnA Maker']) {
    assert.deepEqual(presentation.rankedSearch(query), [], query)
  }
})

test('should_expose_eight_compact_azure_microsoft_groups_with_icons_and_editorial_pins', () => {
  const groups = menuGroups('azure')
  assert.deepEqual(groups.map(group => group.label), ['Compute & Apps', 'Networking', 'Storage & Databases', 'AI & Analytics', 'Integration', 'Security & Management', 'Microsoft Fabric', 'Microsoft Apps'])
  assert.deepEqual(groups.map(group => group.icon), ['server', 'network', 'database', 'brain', 'workflow', 'shield', 'layers', 'app-window'])
  groups.forEach((group, index) => {
    assert.equal(group.catalog, 'azure')
    assert.ok(group.items.length >= 8 && group.items.length <= 12, group.label)
    assert.deepEqual(group.items.slice(0, 4).map(item => item.label), pins[index])
    const tail = group.items.slice(4).map(item => item.label)
    assert.deepEqual(tail, alphabetical(tail), group.label)
  })
  const keys = groups.flatMap(group => group.items.map(item => item.icon))
  assert.equal(new Set(keys).size, keys.length)
})

test('should_keep_twelve_software_entries_separate_from_azure', () => {
  const groups = menuGroups('software')
  assert.equal(groups.length, 2)
  assert.equal(groups[0].catalog, 'software')
  assert.ok(groups[0].icon)
  assert.equal(groups[0].items.length, 12)
  assert.deepEqual(groups[0].items.slice(0, 4).map(item => item.icon), ['user', 'api', 'service', 'database'])
  assert.deepEqual(groups[0].items.slice(4).map(item => item.label), alphabetical(groups[0].items.slice(4).map(item => item.label)))
})

test('should_reveal_current_long_tail_only_through_global_search', () => {
  const menuKeys = new Set(menuGroups('azure').flatMap(group => group.items.map(item => item.icon)))
  for (const query of ['ExpressRoute', 'ML experiment', 'IoT Central', 'Azure Spring']) {
    const found = searchGroups(query).flatMap(group => group.items)
    assert.ok(found.length, query)
    if (query === 'ML experiment') assert.ok(found.every(item => !menuKeys.has(item.icon)))
  }
  assert.deepEqual(searchGroups('no-such-component-12345'), [])
})

test('should_search_names_aliases_and_categories_case_insensitively_without_duplicate_keys', () => {
  for (const query of ['OneLake', '  oNe LaKe  ', 'Data Engineering', 'compute', 'pipeline', 'KQL', 'Networking', 'API']) {
    const groups = searchGroups(query)
    assert.ok(groups.length, query)
    const keys = groups.flatMap(group => group.items.map(item => item.icon))
    assert.equal(new Set(keys).size, keys.length, query)
    assert.deepEqual(searchGroups(`  ${query.toUpperCase()}  `), groups, query)
  }
  assert.deepEqual(searchGroups('OneLake'), searchGroups('onelake'))
})

test('should_select_one_preferred_official_glyph_per_semantic_fabric_family', () => {
  const components = searchableLibrary.filter(item => item.catalog === 'fabric')
  const stateFamilies = ['globe_settings_20_filed', 'external_semantic_model', 'shared_semantic_model', 'no_access_semantic_model', 'restricted_report', 'mobile_report', 'restricted_scorecard', 'rdl_report']
  const modeledFamilies = Object.entries(semantics.fabric).filter(([family]) => !stateFamilies.includes(family))
  assert.equal(components.length, modeledFamilies.length)
  for (const [family, definition] of modeledFamilies) {
    const item = components.find(candidate => candidate.label === definition.label)
    assert.ok(item, family)
    assert.ok(item.source.entry.includes(`/${family}_`), family)
    assert.equal(legacyItem(item.icon)!.source, item.source)
    assert.equal(/\d+ px|variant|filled|regular/i.test(item.subtitle), false, item.subtitle)
    const candidates = fabricLibrary.filter(candidate => candidate.source.entry.match(new RegExp(`/${family}_\\d+_(?:item|color|filled|regular)\\.svg$`)))
    const preferred = candidates.find(candidate => candidate.source.entry.endsWith(`/${family}_20_item.svg`)) ?? candidates.find(candidate => candidate.source.entry.endsWith(`/${family}_20_color.svg`))
    if (preferred) assert.equal(item.icon, preferred.icon, family)
  }
  assert.equal(searchGroups('OneLake').flatMap(group => group.items).filter(item => item.label === 'OneLake').length, 1)
  assert.ok(components.length < fabricLibrary.length)
  assert.equal(components.some(item => /globe|chevron|button/i.test(item.label)), false)
  assert.equal(components.some(item => /No-access|Restricted|Shared semantic|External semantic|Mobile report|RDL report/i.test(item.label)), false)
  assert.equal(menuGroups('azure')[6].items.length, 12)
  assert.deepEqual(menuGroups('azure')[6].items.slice(4).map(item => item.label), ['Dataflow Gen2', 'Eventhouse', 'Eventstream', 'KQL database', 'Notebook', 'Power BI', 'Report', 'Semantic model'])
})

test('should_exclude_retired_families_and_bonsai_from_search_and_new_selection_only', () => {
  for (const query of ['Bonsai', 'Blockchain', 'Batch AI', 'Scheduler', 'Time Series Insights', 'Media Services', 'Data Lake Analytics', 'MariaDB', 'App Center', 'Video Analyzer', 'Machine Learning Studio (Classic)', 'Anomaly Detector', 'Metrics Advisor', 'Personalizer', 'QnA Maker', 'Language Understanding']) {
    assert.deepEqual(searchGroups(query), [], query)
  }
  const retired = allLibraryItems.filter(item => lifecycleDecision(item).excluded)
  assert.ok(retired.length > 10)
  for (const item of retired) {
    assert.equal(isSelectableIcon(item.icon), false, item.label)
    assert.equal(isIconKey(item.icon), true)
    assert.equal(legacyItem(item.icon), item)
  }
})

test('should_keep_raw_legacy_labels_hashes_and_allowlist_when_presentation_is_canonicalized', () => {
  assert.equal(allLibraryItems.filter(item => !item.icon.startsWith('vendor-') && !item.icon.startsWith('microsoft-')).length, 2235)
  assert.equal(allLibraryItems.length, 2235 + vendorLibrary.length + microsoftLibrary.length)
  for (const item of legacy) {
    const raw = legacyItem(item.icon)!
    assert.ok(raw)
    assert.equal(raw.label, item.label)
    assert.equal(raw.subtitle, item.subtitle)
    assert.equal(raw.source.sha256, item.sha256)
    assert.equal(isIconKey(item.icon), true)
  }
  for (const item of allLibraryItems) assert.equal(isIconKey(item.icon), true)
  assert.equal(legacyItem('__proto__'), undefined)
  assert.equal(legacyItem('../../arbitrary.svg'), undefined)
  assert.equal(isSelectableIcon('toString'), false)
})

test('should_share_cached_current_selection_and_preserve_source_provenance', () => {
  assert.equal(selectionLibrary, searchableLibrary)
  assert.equal(new Set(searchableLibrary.map(item => item.icon)).size, searchableLibrary.length)
  for (const item of searchableLibrary) {
    assert.equal(isSelectableIcon(item.icon), true)
    assert.equal(legacyItem(item.icon)!.source, item.source)
  }
  assert.equal(menuGroups('azure'), menuGroups('azure'))
})

test('should_protect_cached_policy_arrays_and_item_metadata_from_consumer_mutation', () => {
  assert.equal(Object.isFrozen(searchableLibrary), true)
  for (const group of [...menuGroups('azure'), ...searchGroups('pipeline')]) {
    assert.equal(Object.isFrozen(group), true)
    assert.equal(Object.isFrozen(group.items), true)
  }
  for (const item of searchableLibrary) {
    assert.equal(Object.isFrozen(item), true)
    if (item.aliases) assert.equal(Object.isFrozen(item.aliases), true, item.icon)
    if (item.keywords) assert.equal(Object.isFrozen(item.keywords), true, item.icon)
  }
  assert.equal(searchGroups('pipeline'), searchGroups('PIPELINE'))
  const snapshot = searchGroups('OneLake')
  searchGroups('compute')
  assert.equal(snapshot.flatMap(group => group.items).filter(item => item.label === 'OneLake').length, 1)
})