import type { StarterKey } from '../contracts.ts'

export type ArchitectureOrigin = 'Microsoft' | 'AWS' | 'Google Cloud'
export type ArchitectureCatalogChoice = {
  key: StarterKey
  label: string
  source: string
  sourceCue: 'Architecture catalog'
  origin: ArchitectureOrigin
  categoryPath: readonly [string, string]
  summary: string
  reference: string
  reviewedOn: string
  caveats: readonly string[]
}

export type ArchitectureCategory = {
  name: string
  subcategories: readonly { name: string; entries: readonly ArchitectureCatalogChoice[] }[]
}

export function architectureCategories(entries: readonly ArchitectureCatalogChoice[]): readonly ArchitectureCategory[] {
  const categories = new Map<string, Map<string, ArchitectureCatalogChoice[]>>()
  for (const entry of entries) {
    const [category, subcategory] = entry.categoryPath
    const children = categories.get(category) ?? new Map<string, ArchitectureCatalogChoice[]>()
    const group = children.get(subcategory) ?? []
    group.push(entry)
    children.set(subcategory, group)
    categories.set(category, children)
  }
  return [...categories].sort(([left], [right]) => left.localeCompare(right)).map(([name, children]) => ({
    name,
    subcategories: [...children].sort(([left], [right]) => left.localeCompare(right)).map(([subcategory, entries]) => ({
      name: subcategory,
      entries: entries.slice().sort((left, right) => left.label.localeCompare(right.label)),
    })),
  }))
}

export function searchArchitectureCatalog(entries: readonly ArchitectureCatalogChoice[], query: string): readonly ArchitectureCatalogChoice[] {
  const normalized = query.trim().toLocaleLowerCase('en')
  if (!normalized) return entries
  return entries.filter(entry => [entry.label, entry.origin, ...entry.categoryPath].join('\n').toLocaleLowerCase('en').includes(normalized))
}
