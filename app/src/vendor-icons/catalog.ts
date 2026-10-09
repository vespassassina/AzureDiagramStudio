import registeredItems from './catalog.generated.json'

export type VendorIconKey = `vendor-${string}`
export type VendorItem = {
  icon: VendorIconKey
  label: string
  subtitle: 'Vendor product icon'
  color: '#62696c'
  category: 'Vendors'
  catalog: 'software'
  source: { entry: string; url: string; sha256: string; categories: string[]; entries: string[] }
  aliases?: string[]
  keywords?: string[]
}

export const vendorLibrary: VendorItem[] = registeredItems as VendorItem[]
for (const item of vendorLibrary) {
  Object.freeze(item.source.categories)
  Object.freeze(item.source.entries)
  Object.freeze(item.source)
  Object.freeze(item.aliases)
  Object.freeze(item.keywords)
  Object.freeze(item)
}
Object.freeze(vendorLibrary)