import { allLibraryItems, azureLibrary, fabricLibrary, genericLibrary, vendorLibrary, microsoftLibrary } from '../catalog.ts'
import type { CatalogItem, IconKey } from '../catalog.ts'
import { lifecycleDecision } from './lifecycle.ts'
import semantics from './semantics.json'

export type ServiceGroup = { id: string; label: string; icon: string; items: CatalogItem[]; catalog: 'azure' | 'software' }

const collator = new Intl.Collator('en', { sensitivity: 'base', numeric: true })
const compareItems = (left: CatalogItem, right: CatalogItem) => collator.compare(left.label, right.label) || collator.compare(left.icon, right.icon)
const rawByKey = new Map<string, CatalogItem>(allLibraryItems.map(item => [item.icon, item]))
const azureNames: Record<string, { label: string; aliases?: string[] }> = {
  'azure-10044-icon-service-cognitive-search': { label: 'Azure AI Search', aliases: ['Azure Cognitive Search'] },
  'azure-10162-icon-service-cognitive-services': { label: 'Foundry Tools', aliases: ['Azure AI services', 'Cognitive Services'] },
  'azure-03513-icon-service-ai-studio': { label: 'Microsoft Foundry', aliases: ['Azure AI Foundry', 'Azure AI Studio'] },
  'azure-10241-icon-service-microsoft-defender-for-cloud': { label: 'Defender for Cloud' },
}
const fabricStateAliases: Record<string, string> = {
  external_semantic_model: 'semantic_model', shared_semantic_model: 'semantic_model', no_access_semantic_model: 'semantic_model',
  restricted_report: 'report', mobile_report: 'report', restricted_scorecard: 'scorecard', rdl_report: 'paginated_report',
}
const fabricDefinitions: Record<string, { label: string; category: string; aliases?: string[] }> = semantics.fabric

function freezeItem(item: CatalogItem): CatalogItem {
  if (item.aliases) {
    item.aliases = [...item.aliases]
    Object.freeze(item.aliases)
  }
  if (item.keywords) {
    item.keywords = [...item.keywords]
    Object.freeze(item.keywords)
  }
  return Object.freeze(item)
}

const fabricByFamily = new Map<string, CatalogItem[]>()
for (const item of fabricLibrary) {
  const match = /\/([a-z0-9_]+)_(\d+)_(item|color|filled|regular|non-item)\.svg$/.exec(item.source.entry)
  if (!match || !Object.hasOwn(fabricDefinitions, match[1]) || Object.hasOwn(fabricStateAliases, match[1])) continue
  const candidates = fabricByFamily.get(match[1]) ?? []
  candidates.push(item)
  fabricByFamily.set(match[1], candidates)
}

function preferredFabric(family: string, candidates: CatalogItem[]): CatalogItem {
  const definition = fabricDefinitions[family]
  const preferred = ['20_item', '20_color', '20_filled', '20_regular']
    .map(suffix => candidates.find(item => item.source.entry.endsWith(`/${family}_${suffix}.svg`))).find(Boolean)
    ?? candidates.slice().sort((left, right) => left.icon.localeCompare(right.icon, 'en'))[0]
  const aliases = Object.entries(fabricStateAliases).filter(([, canonical]) => canonical === family).map(([state]) => fabricDefinitions[state].label)
  return freezeItem({ ...preferred, label: definition.label, subtitle: definition.category, category: definition.category, aliases: [...(definition.aliases ?? []), ...aliases], keywords: [definition.category, 'Microsoft Fabric'] })
}

const currentAzure = azureLibrary.filter(item => !lifecycleDecision(item).excluded).map(item => {
  const naming = azureNames[item.icon]
  return freezeItem({ ...item, ...(naming ?? {}), aliases: [...(item.aliases ?? []), item.label, ...(naming?.aliases ?? [])] })
})
const canonicalFabric = [...fabricByFamily].map(([family, candidates]) => preferredFabric(family, candidates))
export const searchableLibrary: CatalogItem[] = [...currentAzure, ...canonicalFabric, ...genericLibrary.map(item => freezeItem({ ...item })), ...vendorLibrary, ...microsoftLibrary].sort(compareItems)
Object.freeze(searchableLibrary)
export const selectionLibrary = searchableLibrary
const selectableKeys = new Set<string>(searchableLibrary.map(item => item.icon))
const currentByKey = new Map<string, CatalogItem>(searchableLibrary.map(item => [item.icon, item]))
const currentByLabel = new Map(searchableLibrary.map(item => [item.label, item]))

function requiredItem(keyOrLabel: string): CatalogItem {
  const item = currentByKey.get(keyOrLabel) ?? currentByLabel.get(keyOrLabel)
  if (!item) throw new Error(`Presentation menu references an unavailable catalog item: ${keyOrLabel}`)
  return item
}

function group(id: string, label: string, icon: string, catalog: ServiceGroup['catalog'], choices: string[]): ServiceGroup {
  const items = choices.map(requiredItem)
  const sorted = [...items.slice(0, 4), ...items.slice(4).sort(compareItems)]
  Object.freeze(sorted)
  return Object.freeze({ id, label, icon, catalog, items: sorted })
}

const azureMenus = [
  group('azure-compute', 'Compute & Apps', 'server', 'azure', ['azure-app', 'azure-function', 'azure-vm', 'azure-aks', 'azure-container-apps', 'Container Registries', 'Batch Accounts', 'VM Scale Sets', 'Static Apps', 'Service Fabric Clusters']),
  group('azure-networking', 'Networking', 'network', 'azure', ['azure-network', 'azure-front-door', 'azure-application-gateway', 'azure-load-balancer', 'azure-private-endpoint', 'Bastions', 'Firewalls', 'DNS Zones', 'Traffic Manager Profiles', 'Network Watcher']),
  group('azure-storage-data', 'Storage & Databases', 'database', 'azure', ['azure-storage', 'azure-sql', 'azure-cosmos', 'azure-postgresql', 'azure-redis', 'Azure Database MySQL Server', 'SQL Managed Instance', 'Disks']),
  group('azure-ai-analytics', 'AI & Analytics', 'brain', 'azure', ['Azure OpenAI', 'Azure Machine Learning', 'Azure AI Search', 'Azure Databricks', 'Foundry Tools', 'Microsoft Foundry', 'Azure Synapse Analytics', 'Stream Analytics Jobs']),
  group('azure-integration', 'Integration', 'workflow', 'azure', ['azure-api', 'azure-service-bus', 'azure-event-hubs', 'azure-logic-apps', 'azure-event-grid', 'SignalR', 'Event Grid Domains', 'Integration Accounts']),
  group('azure-security-management', 'Security & Management', 'shield', 'azure', ['azure-entra', 'azure-key-vault', 'azure-monitor', 'Defender for Cloud', 'azure-managed-identities', 'Policy', 'Automation Accounts', 'Log Analytics Workspaces', 'Azure Backup Center', 'Microsoft Defender for IoT']),
  group('azure-fabric', 'Microsoft Fabric', 'layers', 'azure', ['OneLake', 'Lakehouse', 'Warehouse', 'Data pipeline', 'Dataflow Gen2', 'Eventhouse', 'Eventstream', 'KQL database', 'Notebook', 'Power BI', 'Report', 'Semantic model']),
  group('azure-microsoft-apps', 'Microsoft Apps', 'app-window', 'azure', ['microsoft-sharepoint', 'microsoft-teams', 'microsoft-m365', 'microsoft-copilot', 'microsoft-business-central', 'microsoft-dynamics365', 'microsoft-copilot-studio', 'microsoft-excel', 'microsoft-word', 'microsoft-powerpoint', 'microsoft-power-apps', 'microsoft-power-automate']),
]
const softwareMenus = [
  group('software-components', 'Software', 'boxes', 'software', ['user', 'api', 'service', 'database', ...genericLibrary.filter(item => !['user', 'api', 'service', 'database'].includes(item.icon)).map(item => item.icon)]),
  group('software-vendors', 'Vendors', 'building', 'software', ['vendor-oracle', 'vendor-sap', 'vendor-ibm', 'vendor-aws', 'vendor-gcp', 'vendor-hp', 'vendor-hpe', 'vendor-red-hat', 'vendor-salesforce', 'vendor-servicenow', 'vendor-snowflake', 'vendor-databricks']),
]
Object.freeze(azureMenus)
Object.freeze(softwareMenus)
const menuGroupByKey = new Map([...azureMenus, ...softwareMenus].flatMap(menu => menu.items.map(item => [item.icon, menu] as const)))
const categoryGroup: Record<string, number> = {
  Compute: 0, Containers: 0, 'App Services': 0, Web: 0, Mobile: 0, DevOps: 0, 'Developer Tools': 0,
  Networking: 1, Storage: 2, Databases: 2,
  'AI & Machine Learning': 3, Analytics: 3, IoT: 3, 'Mixed Reality': 3,
  Integration: 4,
  Security: 5, Identity: 5, Intune: 5, Monitor: 5, 'Management & Governance': 5, 'Hybrid & Multicloud': 5, Migration: 5, Migrate: 5,
}

function owningGroup(item: CatalogItem): ServiceGroup {
  if (item.catalog === 'fabric') return azureMenus[6]
  if (item.icon.startsWith('microsoft-')) return azureMenus[7]
  if (item.icon.startsWith('vendor-')) return softwareMenus[1]
  if (item.catalog === 'software') return softwareMenus[0]
  const menu = menuGroupByKey.get(item.icon)
  if (menu) return menu
  const category = item.source.categories.find(candidate => Object.hasOwn(categoryGroup, candidate)) ?? item.category
  return azureMenus[categoryGroup[category] ?? 5]
}

const searchIndex = searchableLibrary.map(item => {
  const owner = owningGroup(item)
  const text = [item.label, item.subtitle, item.category, owner.label, ...item.source.categories, ...(item.aliases ?? []), ...(item.keywords ?? [])].join('\n').toLocaleLowerCase('en')
  return { item, owner, text }
})
const allSearchGroups = [...azureMenus, ...softwareMenus].map(menu => {
  const items = searchIndex.filter(entry => entry.owner.id === menu.id).map(entry => entry.item)
  Object.freeze(items)
  return Object.freeze({ ...menu, items })
})
Object.freeze(allSearchGroups)
let lastQuery = ''
let lastResults = allSearchGroups

export function menuGroups(catalog: 'azure' | 'software'): ServiceGroup[] {
  return catalog === 'azure' ? azureMenus : softwareMenus
}

export function searchGroups(query: string): ServiceGroup[] {
  const normalized = query.trim().toLocaleLowerCase('en')
  if (!normalized) return allSearchGroups
  if (normalized === lastQuery) return lastResults
  const matches = new Map<string, CatalogItem[]>()
  for (const entry of searchIndex) {
    if (!entry.text.includes(normalized)) continue
    const items = matches.get(entry.owner.id) ?? []
    items.push(entry.item)
    matches.set(entry.owner.id, items)
  }
  lastQuery = normalized
  lastResults = [...azureMenus, ...softwareMenus].filter(menu => matches.has(menu.id)).map(menu => {
    const items = matches.get(menu.id)!
    Object.freeze(items)
    return Object.freeze({ ...menu, items })
  })
  Object.freeze(lastResults)
  return lastResults
}

export function isSelectableIcon(key: string): key is IconKey {
  return selectableKeys.has(key)
}

export function legacyItem(key: string): CatalogItem | undefined {
  return rawByKey.get(key)
}