import fontUrl from './assets/plex-sans.ttf?url'
import registeredAssets from './catalog/assets.generated.json'
import type { Assets } from './scene.ts'
import { azureLibrary, fabricLibrary } from './catalog.ts'
import { vendorAssets } from './vendor-icons/assets.ts'
import { microsoftAssets } from './microsoft-icons/assets.ts'
export { azureLibrary, fabricLibrary } from './catalog.ts'

const encodedSources: Readonly<Record<string, string>> = registeredAssets
const icons: Record<string, string> = Object.create(null) as Record<string, string>
for (const item of [...azureLibrary, ...fabricLibrary]) {
  const source = Object.hasOwn(encodedSources, item.source.sha256) ? encodedSources[item.source.sha256] : undefined
  if (!source?.startsWith('data:image/svg+xml;charset=utf-8,')) throw new Error(`Missing official ${item.catalog} asset: ${item.label} (${item.source.entry})`)
  icons[item.icon] = source
}
for (const registry of [vendorAssets, microsoftAssets]) {
  for (const [key, source] of Object.entries(registry)) {
    if (Object.hasOwn(icons, key) || !/^data:image\/svg\+xml;(?:base64|charset=utf-8),/.test(source)) throw new Error(`Invalid bundled icon: ${key}`)
    icons[key] = source
  }
}
export const visualAssets: Assets = { icons }
let fontPromise: Promise<string> | undefined
export function embeddedFont(): Promise<string> {
  fontPromise ??= fetch(fontUrl).then(async response => {
    if (!response.ok) throw new Error('The bundled font could not be loaded')
    const bytes = new Uint8Array(await response.arrayBuffer())
    let binary = ''
    for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
    return `data:font/ttf;base64,${btoa(binary)}`
  }).catch(error => { fontPromise = undefined; throw error })
  return fontPromise
}