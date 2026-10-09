import { UserRound, UsersRound, Braces, Boxes, Zap, Server, Database, Waves, ListOrdered, HardDrive, BrainCircuit, ShieldCheck } from 'lucide-react'
import { publishedItems } from './catalog/catalog.generated.ts'
import registeredVendors from './vendor-icons/catalog.generated.json' with { type: 'json' }
import type { VendorIconKey, VendorItem } from './vendor-icons/catalog.ts'
import registeredMicrosoft from './microsoft-icons/catalog.generated.json' with { type: 'json' }
import type { MicrosoftIconKey, MicrosoftItem } from './microsoft-icons/catalog.ts'

export const GENERIC_ICONS = { user: UserRound, people: UsersRound, api: Braces, service: Boxes, function: Zap, server: Server, database: Database, lake: Waves, queue: ListOrdered, storage: HardDrive, model: BrainCircuit, shield: ShieldCheck }
export type GenericIconKey = keyof typeof GENERIC_ICONS
export const COLORS = {
  azure: { main: '#0078d4', light: '#eff7ff' },
  teal: { main: '#117865', light: '#edf8f3' },
  amber: { main: '#a56b16', light: '#fff9ec' },
  rose: { main: '#bd4966', light: '#fff2f5' },
  gray: { main: '#62696c', light: '#f5f6f6' },
  fabric: { main: '#117865', light: '#edf8f3' },
  databricks: { main: '#E8412C', light: '#fff2ef' },
  purview: { main: '#6B3FA0', light: '#f7f2fc' },
  m365: { main: '#5B5FC7', light: '#f3f3fd' },
  foundry: { main: '#0063B1', light: '#eff7ff' },
  source: { main: '#605E5C', light: '#f5f6f6' },
}
export type SemanticColorKey = keyof typeof COLORS
export type ColorKey = SemanticColorKey | `#${string}`
export function isColorKey(value: string): value is ColorKey {
  return Object.hasOwn(COLORS, value) || /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)
}
export function resolveColor(value: string): { main: string; light: string } {
  if (Object.hasOwn(COLORS, value)) return COLORS[value as SemanticColorKey]
  return isColorKey(value) ? { main: value, light: '#f5f6f6' } : COLORS.gray
}

export type AzureIconKey = `azure-${string}`
export type FabricIconKey = `fabric-${string}`
export type IconKey = GenericIconKey | AzureIconKey | FabricIconKey | VendorIconKey | MicrosoftIconKey
export type CatalogName = 'azure' | 'fabric' | 'software'
export type CatalogSource = { entry: string; url: string; sha256: string; categories: string[]; entries?: string[] }
export type CatalogItem = { icon: IconKey; label: string; subtitle: string; color: ColorKey; category: string; catalog: CatalogName; source: CatalogSource; keywords?: string[]; aliases?: string[] }
export type CatalogGroup = { id: string; label: string; catalog: CatalogName; items: CatalogItem[] }

// Load the unchanged owner manifests in both Vite and native Node verification, retaining immutable registry metadata.
function freezeRegistry<Item extends CatalogItem>(items: Item[]): Item[] {
  for (const item of items) {
    Object.freeze(item.source.categories)
    Object.freeze(item.source.entries)
    Object.freeze(item.source)
    Object.freeze(item.aliases)
    Object.freeze(item.keywords)
    Object.freeze(item)
  }
  return Object.freeze(items) as Item[]
}
export const vendorLibrary = freezeRegistry(registeredVendors as VendorItem[])
export const microsoftLibrary = freezeRegistry(registeredMicrosoft as MicrosoftItem[])

export const AZURE_MANIFEST = publishedItems.filter(item => item.catalog === 'azure')
export const azureLibrary = AZURE_MANIFEST
export const fabricLibrary = publishedItems.filter(item => item.catalog === 'fabric')
export const missingAzureAssets: CatalogItem[] = []
export const genericLibrary: CatalogItem[] = Object.keys(GENERIC_ICONS).map(icon => ({ icon: icon as GenericIconKey, label: ({ api: 'API', people: 'People', lake: 'Data lake', model: 'AI model' } as Record<string, string>)[icon] ?? icon.charAt(0).toUpperCase() + icon.slice(1), subtitle: '', color: ['database', 'storage', 'queue'].includes(icon) ? 'amber' : 'teal', category: 'Software', catalog: 'software', source: { entry: `lucide-react/${icon}`, url: 'https://lucide.dev/', sha256: '', categories: ['Software'] } }))
export const allLibraryItems: CatalogItem[] = [...azureLibrary, ...fabricLibrary, ...genericLibrary, ...vendorLibrary, ...microsoftLibrary]
const iconKeys = new Set<string>(allLibraryItems.map(item => item.icon))

export function isIconKey(value: string): value is IconKey {
  return iconKeys.has(value)
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' })
const compareText = (left: string, right: string) => collator.compare(left, right) || (left < right ? -1 : left > right ? 1 : 0)

export function catalogGroups(items: readonly CatalogItem[], query = ''): CatalogGroup[] {
  const search = query.trim().toLocaleLowerCase('en')
  const groups = new Map<string, CatalogGroup>()
  for (const item of items) {
    const categories = item.source.categories.length ? item.source.categories : [item.category]
    const searchable = [item.label, item.subtitle, item.category, ...categories, ...(item.aliases ?? []), ...(item.keywords ?? [])].join('\n').toLocaleLowerCase('en')
    if (search && !searchable.includes(search)) continue
    for (const category of categories) {
      const id = `${item.catalog}-${category.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
      const group = groups.get(id) ?? { id, label: category, catalog: item.catalog, items: [] }
      if (!group.items.some(existing => existing.icon === item.icon)) group.items.push(item)
      groups.set(id, group)
    }
  }
  for (const group of groups.values()) group.items.sort((left, right) => compareText(left.label, right.label) || compareText(left.icon, right.icon))
  return [...groups.values()].sort((left, right) => compareText(left.catalog, right.catalog) || compareText(left.label, right.label) || compareText(left.id, right.id))
}