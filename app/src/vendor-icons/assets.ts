import registeredAssets from './assets.generated.json'

export const vendorAssets: Record<string, string> = Object.assign(Object.create(null) as Record<string, string>, registeredAssets)
Object.freeze(vendorAssets)