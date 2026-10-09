import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const directory = join(root, 'src/catalog')
const snapshot = join(tmpdir(), 'diagrammer-catalog-extraction.json')
const archives = {
  azure: { path: join(tmpdir(), 'diagrammer-azure-v24.zip'), url: 'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip', page: 'https://learn.microsoft.com/en-us/azure/architecture/icons/' },
  fabric: { path: join(tmpdir(), 'diagrammer-fabric-icons.zip'), url: 'https://raw.githubusercontent.com/microsoft/fabric-samples/main/docs-samples/Icons.zip', page: 'https://learn.microsoft.com/en-us/fabric/fundamentals/icons' },
}
for (const [vendor, archive] of Object.entries(archives)) {
  if (!existsSync(archive.path) || process.argv.includes(`--download-${vendor}`)) {
    const response = await fetch(archive.url)
    if (!response.ok) throw new Error(`Download failed: ${archive.url} (${response.status})`)
    writeFileSync(`${archive.path}.download`, Buffer.from(await response.arrayBuffer()))
    renameSync(`${archive.path}.download`, archive.path)
  }
}
execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', join(root, 'scripts/import-catalog-extract.ps1'), '-AzureZip', archives.azure.path, '-FabricZip', archives.fabric.path, '-OutputPath', snapshot], { stdio: 'inherit' })
const extracted = JSON.parse(readFileSync(snapshot, 'utf8'))
if (process.argv.includes('--inspect')) {
  for (const [vendor, archive] of Object.entries(extracted)) console.log(vendor, archive.sha256, archive.entries.map(entry => ({ entry: entry.entry, safetyFlags: entry.safetyFlags })))
  process.exit(0)
}
const legacy = JSON.parse(readFileSync(join(directory, 'legacy.json'), 'utf8'))
const configuration = JSON.parse(readFileSync(join(directory, 'semantics.json'), 'utf8'))
const ordinal = (left, right) => left < right ? -1 : left > right ? 1 : 0
const slug = value => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
const canonicalFilename = value => value.replace(/^(\d+)\s+(?=-icon-)/, '$1')
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const items = []
const coverage = []
const inventory = { archives: {}, coverage, supplemental: [] }
const svgRoot = { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' }
for (const [vendor, archive] of Object.entries(extracted)) {
  if (configuration.archiveHashes[vendor] !== archive.sha256) throw new Error(`Archive hash changed: ${vendor}. Review source inventory before updating the pin.`)
  for (const entry of archive.entries) {
    if (entry.safetyFlags.length) throw new Error(`Unsafe SVG ${entry.entry}: ${entry.safetyFlags.join(', ')}`)
    if (entry.svgRoot.localName !== svgRoot.localName || entry.svgRoot.namespaceURI !== svgRoot.namespaceURI) throw new Error(`Invalid SVG root: ${entry.entry}`)
    if (hash(Buffer.from(entry.base64, 'base64')) !== entry.sha256) throw new Error(`Extracted bytes changed: ${entry.entry}`)
  }
}
for (const entry of legacy) {
  if (hash(readFileSync(join(root, `src/assets/azure/${entry.icon}.svg`))) !== entry.sha256) throw new Error(`Legacy glyph changed: ${entry.icon}`)
}
for (const [vendor, archive] of Object.entries(extracted)) {
  const byIdentity = new Map()
  const filenameHashes = new Map()
  for (const entry of archive.entries) {
    const filename = canonicalFilename(entry.entry.split('/').at(-1))
    const hashes = filenameHashes.get(filename) ?? new Set()
    hashes.add(entry.sha256)
    filenameHashes.set(filename, hashes)
  }
  const categories = new Map()
  const safetyFlags = []
  const fabricFamilies = new Set()
  const variants = { filenameFamilyCount: 0, styles: {}, sizes: {}, unclassifiedEntryCount: 0 }
  for (const entry of archive.entries.sort((left, right) => ordinal(left.entry, right.entry))) {
    const filename = canonicalFilename(entry.entry.split('/').at(-1))
    const relative = vendor === 'azure' ? entry.entry.replace(/^Azure_Public_Service_Icons\/Icons\//, '') : entry.entry
    const fabricVariant = filename.match(/^(.*)_(\d+)_(color|filled|regular|item|non-item)\.svg$/)
    const fabricStem = fabricVariant?.[1] ?? filename.replace(/\.svg$/, '')
    if (vendor === 'fabric') {
      fabricFamilies.add(fabricStem)
      if (fabricVariant) {
        variants.styles[fabricVariant[3]] = (variants.styles[fabricVariant[3]] ?? 0) + 1
        variants.sizes[fabricVariant[2]] = (variants.sizes[fabricVariant[2]] ?? 0) + 1
      } else variants.unclassifiedEntryCount++
    }
    const fabricSemantics = configuration.fabric[fabricStem]
    const fabricCategory = fabricSemantics?.category ?? (/kql|stream|event|graph/.test(fabricStem) ? 'Real-Time Intelligence' : /pipeline|dataflow|connector|copy_job/.test(fabricStem) ? 'Data Factory' : /notebook|spark|lakehouse/.test(fabricStem) ? 'Data Engineering' : /warehouse|sql_database/.test(fabricStem) ? 'Data Warehouse' : /report|semantic_model|scorecard|dashboard/.test(fabricStem) ? 'Power BI' : 'Platform & OneLake')
    const rawCategory = vendor === 'azure' ? relative.split('/')[0] : fabricCategory
    if (!rawCategory) throw new Error(`Missing published semantic mapping: ${entry.entry}`)
    const category = vendor === 'azure' ? configuration.azureCategories[rawCategory] : rawCategory
    if (!category) throw new Error(`Missing category: ${rawCategory}`)
    const categoryInfo = categories.get(category) ?? { category, label: category, entryCount: 0 }
    categoryInfo.entryCount++
    categories.set(category, categoryInfo)
    safetyFlags.push(...entry.safetyFlags.map(flag => ({ entry: entry.entry, flag })))
    const original = vendor === 'azure' ? legacy.find(item => item.source.split('/').at(-1) === filename && item.sha256 === entry.sha256) : undefined
    const semantics = vendor === 'fabric' ? fabricSemantics ?? {} : configuration.azureNames[filename] ?? {}
    const stem = vendor === 'fabric' ? fabricStem : filename.replace(/\.svg$/i, '').replace(/^\d+-icon-(?:service|general|resource)-/i, '')
    const readable = stem.replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim()
    const label = original?.label ?? semantics.label ?? (vendor === 'fabric' ? readable.charAt(0).toUpperCase() + readable.slice(1) : readable)
    const variantSubtitle = vendor === 'fabric' ? `${fabricVariant?.[3] === 'item' ? 'Item' : fabricSemantics ? 'Product / workload' : 'Interface'} glyph - ${fabricVariant?.[3] ?? 'SVG'}, ${fabricVariant?.[2] ?? 'source'} px` : /classic|deprecated|legacy/i.test(label) ? 'Legacy / deprecated published icon' : `${category} icon`
    const suffix = filenameHashes.get(filename).size > 1 ? `-${entry.sha256.slice(0, 12)}` : ''
    const icon = original?.icon ?? `${vendor}-${slug(filename.replace(/\.svg$/i, ''))}${suffix}`
    const identity = `${filename}\0${entry.sha256}`
    let item = byIdentity.get(identity)
    if (!item) {
      if (items.some(item => item.icon === icon)) throw new Error(`Ambiguous key collision: ${icon}`)
      item = { icon, label, subtitle: original?.subtitle ?? semantics.subtitle ?? variantSubtitle, color: original?.color ?? (vendor === 'azure' ? 'azure' : 'fabric'), category: original ? configuration.azureCategories[original.source.split('/')[0]] : category, catalog: vendor, source: { entry: vendor === 'azure' && original ? `Azure_Public_Service_Icons/Icons/${original.source}` : entry.entry, url: archives[vendor].url, sha256: entry.sha256, categories: [], entries: [] }, aliases: [...new Set([readable, ...(semantics.aliases ?? [])])], keywords: semantics.keywords ?? [] }
      byIdentity.set(identity, item)
      items.push(item)
      const bytes = Buffer.from(entry.base64, 'base64')
      const path = join(root, `src/assets/${vendor}/${icon}.svg`)
      mkdirSync(dirname(path), { recursive: true })
      if (original) {
        if (!readFileSync(path).equals(bytes)) throw new Error(`Legacy source mismatch: ${icon}`)
      } else writeFileSync(path, bytes)
    }
    if (!item.source.categories.includes(category)) item.source.categories.push(category)
    item.source.entries.push(entry.entry)
    coverage.push({ catalog: vendor, entry: entry.entry, icon: item.icon, category, sha256: entry.sha256 })
  }
  const svgValidation = { root: svgRoot, checkedEntryCount: archive.entries.length, byteHashCheckedEntryCount: archive.entries.length, documentScope: 'entire-xml-document', dtdProcessing: 'prohibit', xmlResolver: 'disabled', unsafeContentPolicy: 'reject' }
  if (vendor === 'fabric') {
    variants.filenameFamilyCount = fabricFamilies.size
    variants.styles = Object.fromEntries(Object.entries(variants.styles).sort(([left], [right]) => ordinal(left, right)))
  }
  inventory.archives[vendor] = { url: archives[vendor].url, documentationUrl: archives[vendor].page, sha256: archive.sha256, entryCount: archive.entries.length, uniqueItemCount: byIdentity.size, duplicatePlacementCount: archive.entries.length - byIdentity.size, categories: [...categories.values()].sort((left, right) => ordinal(left.category, right.category)), safetyFlags, svgValidation, ...(vendor === 'fabric' ? { variants } : {}) }
}
const entra = legacy.find(item => item.icon === 'azure-entra')
const entraSource = { entry: entra.source, url: 'https://download.microsoft.com/download/3/1/a/31a56038-856a-4489-88e4-ee5a1c4352be/Microsoft%20Entra%20architecture%20icons%20-%20Oct%202023.zip', sha256: entra.sha256, categories: ['Identity'], entries: [entra.source] }
items.push({ ...entra, source: entraSource, category: 'Identity', catalog: 'azure', aliases: ['Entra ID', 'Azure Active Directory'], keywords: [] })
inventory.supplemental.push({ catalog: 'azure', icon: entra.icon, ...entraSource, archiveSha256: '4e07536706a2d092e6524e5417e2c861333fdbdb41c36f78d44dfa07ccc5eedc' })
items.sort((left, right) => ordinal(left.icon, right.icon))
for (const item of items) { item.source.categories.sort(ordinal); item.source.entries.sort(ordinal) }
const registeredAssets = Object.create(null)
for (const item of items) {
  if (Object.hasOwn(registeredAssets, item.source.sha256)) continue
  const bytes = readFileSync(join(root, `src/assets/${item.catalog}/${item.icon}.svg`))
  if (hash(bytes) !== item.source.sha256) throw new Error(`Registered asset bytes changed: ${item.icon}`)
  const source = bytes.toString('utf8')
  if (!Buffer.from(source, 'utf8').equals(bytes)) throw new Error(`Registered asset is not UTF-8: ${item.icon}`)
  registeredAssets[item.source.sha256] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
}
mkdirSync(directory, { recursive: true })
writeFileSync(join(directory, 'assets.generated.json'), `${JSON.stringify(registeredAssets)}\n`)
writeFileSync(join(directory, 'inventory.json'), `${JSON.stringify(inventory, null, 2)}\n`)
const chunks = []
for (let offset = 0; offset < items.length; offset += 100) chunks.push(items.slice(offset, offset + 100))
const declarations = chunks.map((chunk, index) => `const publishedItems${index} = catalogItems(${JSON.stringify(chunk, null, 2)})`).join('\n\n')
writeFileSync(join(directory, 'catalog.generated.ts'), `import type { CatalogItem } from '../catalog.ts'\n\nfunction catalogItems<Items extends CatalogItem[]>(items: Items): CatalogItem[] { return items }\n\n${declarations}\n\nexport const publishedItems: CatalogItem[] = [${chunks.map((_chunk, index) => `...publishedItems${index}`).join(', ')}]\n`)
console.log(JSON.stringify(inventory.archives, null, 2))