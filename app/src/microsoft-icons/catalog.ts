import registeredItems from './catalog.generated.json'

export type MicrosoftIconKey = `microsoft-${string}`
export type MicrosoftItem = {
  icon: MicrosoftIconKey
  label: string
  subtitle: string
  color: `#${string}`
  category: 'Microsoft Apps'
  catalog: 'azure'
  source: { entry: string; url: string; sha256: string; categories: string[]; entries: string[] }
  aliases: string[]
  keywords: string[]
}

export const microsoftLibrary: MicrosoftItem[] = registeredItems as MicrosoftItem[]
for (const item of microsoftLibrary) {
  Object.freeze(item.source.categories)
  Object.freeze(item.source.entries)
  Object.freeze(item.source)
  Object.freeze(item.aliases)
  Object.freeze(item.keywords)
  Object.freeze(item)
}
Object.freeze(microsoftLibrary)