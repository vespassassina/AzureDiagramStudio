import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { JSDOM } from 'jsdom'

const registryDirectory = new URL('../src/microsoft-icons/', import.meta.url)
const assetDirectory = new URL('../src/assets/microsoft/', import.meta.url)
const noticeFile = new URL('../public/MICROSOFT-APP-NOTICES.md', import.meta.url)
const hash = bytes => createHash('sha256').update(bytes).digest('hex')
const escapeXml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
const elementNames = new Set(['svg', 'g', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'filter', 'feFlood', 'feBlend', 'feColorMatrix', 'feComposite', 'feGaussianBlur', 'feOffset', 'use', 'title', 'desc', 'text'])

export function validateArtwork(bytes, extension) {
  if (bytes.length > 384 * 1024) throw new Error('Oversized Microsoft artwork')
  if (extension === 'png') {
    if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a' || bytes.subarray(12, 16).toString() !== 'IHDR') throw new Error('Invalid PNG')
    const width = bytes.readUInt32BE(16)
    const height = bytes.readUInt32BE(20)
    if (!width || !height || width > 4096 || height > 4096) throw new Error('Invalid PNG dimensions')
    return
  }
  if (extension !== 'svg') throw new Error('Unsupported artwork format')
  const source = bytes.toString('utf8')
  if (/<!DOCTYPE|<!ENTITY|<\?(?!xml\s)|@import|javascript:|\\/i.test(source)) throw new Error('Unsafe SVG declaration or CSS')
  const dom = new JSDOM(source, { contentType: 'image/svg+xml' })
  try {
    const root = dom.window.document.documentElement
    if (root.localName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg' || !root.hasAttribute('viewBox')) throw new Error('Invalid SVG root')
    for (const element of [root, ...root.querySelectorAll('*')]) {
      if (!elementNames.has(element.localName) || element.namespaceURI !== root.namespaceURI) throw new Error(`Unsafe SVG element: ${element.localName}`)
      for (const attribute of element.attributes) {
        if (/^on|^xml:base$|^src$/i.test(attribute.name)) throw new Error('Unsafe SVG attribute')
        if (/^(?:href|xlink:href)$/i.test(attribute.name) && !/^#[a-z0-9_.:-]+$/i.test(attribute.value)) throw new Error('External SVG reference')
        const references = [...attribute.value.matchAll(/url\(\s*['"]?([^)'"\s]+)['"]?\s*\)/gi)]
        if (references.some(reference => !/^#[a-z0-9_.:-]+$/i.test(reference[1]))) throw new Error('External SVG paint')
        if (/url\s*\(/i.test(attribute.value) && !references.length) throw new Error('Malformed SVG reference')
      }
    }
  } finally { dom.window.close() }
}

export function validateDefinitions(definitions) {
  const keys = new Set()
  for (const item of definitions) {
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.key) || keys.has(item.key)) throw new Error(`Invalid or duplicate Microsoft key: ${item.key}`)
    keys.add(item.key)
    if (typeof item.label !== 'string' || !item.label.trim() || item.label.length > 120) throw new Error('Invalid product name')
    if (!Array.isArray(item.aliases) || !item.aliases.length || !Array.isArray(item.keywords)) throw new Error('Missing search terms')
    if (item.classification === 'official-icon') {
      if (!['dynamics', 'power'].includes(item.collection) || !/^[a-f0-9]{64}$/.test(item.sha256 ?? '') || !item.entry || item.entry.includes('..') || !/^#[a-f0-9]{6}$/i.test(item.color ?? '')) throw new Error('Unpinned official artwork')
    } else if (item.classification === 'official-cdn-png') {
      if (!/^[a-f0-9]{64}$/.test(item.sha256 ?? '') || !item.url || new URL(item.url).protocol !== 'https:' || !/^#[a-f0-9]{6}$/i.test(item.color ?? '')) throw new Error('Unpinned official CDN PNG')
    } else if (item.classification === 'original-named-badge') {
      if (!/^[A-Z0-9]{2,3}$/.test(item.glyph) || new URL(item.url).protocol !== 'https:') throw new Error('Invalid original badge')
    } else throw new Error('Unknown artwork classification')
    if (item.url && new URL(item.url).protocol !== 'https:') throw new Error('Invalid source URL')
  }
}

function badge(item) {
  const label = escapeXml(item.label)
  const size = item.glyph.length === 3 ? 25 : 30
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img"><title>${label}: original named badge</title><desc>Original neutral architecture integration badge; not an official Microsoft product icon, logo, or endorsement.</desc><path d="M12 8H52L58 14V50L52 56H12L6 50V14Z" fill="#ffffff" stroke="#62696c" stroke-width="2"/><path d="M1 22H6M1 42H6M58 22H63M58 42H63" fill="none" stroke="#62696c" stroke-width="2" stroke-linecap="round"/><text x="32" y="41" text-anchor="middle" font-family="monospace" font-size="${size}" font-weight="700" fill="#252a2c">${item.glyph}</text></svg>\n`)
}

export async function generate(checkOnly = false) {
  const definitions = JSON.parse(await readFile(new URL('definitions.json', registryDirectory), 'utf8'))
  const collections = JSON.parse(await readFile(new URL('collections.json', registryDirectory), 'utf8'))
  validateDefinitions(definitions)
  const assets = {}
  const items = []
  const evidence = []
  for (const definition of definitions) {
    const icon = `microsoft-${definition.key}`
    const officialArchive = definition.classification === 'official-icon'
    const officialCdnPng = definition.classification === 'official-cdn-png'
    const official = officialArchive || officialCdnPng
    const collection = officialArchive ? collections[definition.collection] : undefined
    const extension = officialCdnPng ? 'png' : 'svg'
    const filename = `${icon}.${extension}`
    const bytes = official ? await readFile(new URL(filename, assetDirectory)) : badge(definition)
    validateArtwork(bytes, extension)
    const digest = hash(bytes)
    if (official && digest !== definition.sha256) throw new Error(`Official source bytes changed: ${icon}`)
    const entry = officialArchive ? definition.entry : `app/src/assets/microsoft/${filename}`
    const url = officialArchive ? collection.url : definition.url
    const mime = extension === 'png' ? 'image/png' : 'image/svg+xml'
    const subtitle = officialArchive ? 'Official architecture icon' : officialCdnPng ? 'Official product icon' : 'Original named badge (not official)'
    const keyword = officialArchive ? 'official architecture icon' : officialCdnPng ? 'official product icon' : 'original named badge'
    assets[icon] = `data:${mime};base64,${bytes.toString('base64')}`
    items.push({ icon, label: definition.label, subtitle, color: definition.color ?? '#62696c', category: 'Microsoft Apps', catalog: 'azure', source: { entry, url, sha256: digest, categories: ['Microsoft Apps'], entries: [entry] }, aliases: definition.aliases, keywords: ['Microsoft Apps', keyword, ...definition.keywords] })
    const sourceDescription = officialArchive ? `- Archive source: ${url}\n- Archive SHA-256: ${collection.sha256}\n- Permitted-use terms: ${collection.documentationUrl}\n- Extraction: unchanged bytes from the identified SVG ZIP entry.\n` : officialCdnPng ? `- Microsoft CDN source: ${url}\n- Retrieval: individual PNG downloaded unchanged, then SHA-256 pinned for offline bundling.\n` : `- Product identity reference (not an artwork license): ${url}\n- Source gap: no exact identifiable product artwork in the inspected Microsoft 365 SVG/stencil collections; no marketing-logo redistribution permission assumed. Original grayscale letters and connector geometry, not a replacement official glyph.\n`
    evidence.push(`### ${icon}: ${subtitle.toLowerCase()}\n\n- Product: ${definition.label}\n- Classification: ${subtitle}\n${sourceDescription}- Source entry: ${entry}\n- Bundled file: app/src/assets/microsoft/${filename}\n- Artwork SHA-256: ${digest}\n`)
    await emit(new URL(filename, assetDirectory), bytes, checkOnly)
  }
  await emit(new URL('catalog.generated.json', registryDirectory), `${JSON.stringify(items, null, 2)}\n`, checkOnly)
  await emit(new URL('assets.generated.json', registryDirectory), `${JSON.stringify(assets, null, 2)}\n`, checkOnly)
  const licenseEvidence = []
  for (const [key, collection] of Object.entries(collections)) {
    const bytes = await readFile(new URL(`../public/licenses/microsoft-apps/${key}-CELA_Licenses_Public_Use_Icons.pdf`, import.meta.url))
    licenseEvidence.push(`- ${key}: ${collection.licenseEntry}; SHA-256 ${hash(bytes)}; archive ${collection.url}`)
  }
  const notices = `# Microsoft Application Artwork Notices\n\nResearch snapshot: 2026-10-09. 14 products: 5 unchanged official architecture SVG icons and 9 original named badges. All 10 DGM-090 required keys are present. No affiliation, sponsorship, or endorsement by Microsoft is asserted. Microsoft product artwork is not Azure Diagram Studio branding. Microsoft and the named products are trademarks of their respective owners.\n\n## Permitted Use\n\nThe official Dynamics 365 and Power Platform documentation permits copying, distributing, and displaying these icons only in architectural diagrams, training materials, or documentation unless Microsoft grants explicit additional permission; all other rights are reserved. Preserve proportions, colors, orientation and complete glyphs; use product names nearby. Do not crop, rotate, flip, distort, recolor, or use them to represent this application. This is not a general logo/marketing license. See public/licenses/microsoft-apps/README.md and the original bundled PDFs.\n\n## Microsoft 365 Source Qualification\n\nThe requested Microsoft 365 architecture page now redirects to the archived previous-versions article. Inspected https://learn.microsoft.com/en-us/microsoft-365/solutions/architecture-icons-templates and its actual downloads:\n\n- SVG: https://go.microsoft.com/fwlink/?linkid=869455 resolves to https://download.microsoft.com/download/2/F/3/2F346655-1F7E-4F5E-BE78-82DA3D507F3A/2024-microsoft-365-content-icons.zip\n- SVG archive SHA-256: 522c4d43cf98a00380b0836f9ec6e06d81fb99758b258c49b6e5f385c05c547a\n- Visio: https://go.microsoft.com/fwlink/?linkid=2056186 resolves to https://download.microsoft.com/download/2/F/3/2F346655-1F7E-4F5E-BE78-82DA3D507F3A/2024-microsoft-365-content-VisioTemplates.zip\n- Visio archive SHA-256: 5ed0a9938b0e286656d3db7fa3f57a24f8579f6229a1a576df7d5f900826ef22\n\nThese downloads contain generic architectural symbols/color palettes, not identified exact glyphs for the nine fallback products. A SharePoint/Teams-colored generic folder, building, or cloud is not a SharePoint/Teams product logo. The productcolors-miscellaneous-symbols-2024.vssx masters were inspected as standard ZIP/XML; no product icons were extracted or decompiled. Existing Azure V24 catalog provenance was inspected read-only; no Office/MS365 legacy glyph was available there. The older Download Center icon-set page (id=41937) was unavailable during research, so its contents/terms were not assumed.\n\nMicrosoft 365 Copilot is deliberately not consumer Microsoft Copilot, GitHub Copilot, or Microsoft Copilot Studio. Its badge makes no marketing-artwork license claim. The current overview calls the Microsoft 365 Copilot app Microsoft Copilot, while retaining Microsoft 365 Copilot license/experience names; this registry identifies the work/productivity experience named by DGM-090. Dynamics 365 is the product family; Business Central is its distinct ERP application. Power Apps and Power Automate use their exact Power Platform artwork. Historical aliases are search aids, not extra menu products or lifecycle assertions. Microsoft Graph is omitted: no exact diagram-licensed glyph was found in the inspected packages.\n\n## Unchanged Bundled License PDFs\n\n${licenseEvidence.join('\n')}\n\n## Per-Product Provenance\n\n${evidence.join('\n')}\n## Reproduction\n\nUse the owned generate-microsoft-import.ps1 script to verify pinned ZIP hashes and extract the five exact SVGs and original license PDFs. Then node app/scripts/generate-microsoft.mjs generates the neutral badges, frozen registry input, embedded assets, and this notice. node app/scripts/generate-microsoft.mjs --check verifies every generated byte offline and refuses changed official hashes. No runtime downloads, arbitrary paths, DOM initialization, package changes, or shared catalog integration are part of this owner slice.\n`
  await emit(noticeFile, notices, checkOnly)
  const expected = definitions.map(definition => `microsoft-${definition.key}.${definition.classification === 'official-cdn-png' ? 'png' : 'svg'}`).sort()
  if (JSON.stringify((await readdir(assetDirectory)).sort()) !== JSON.stringify(expected)) throw new Error('Unexpected Microsoft asset files; nothing was deleted')
  const officialArchitectureCount = definitions.filter(definition => definition.classification === 'official-icon').length
  const officialProductCount = definitions.filter(definition => definition.classification === 'official-cdn-png').length
  const originalBadgeCount = definitions.filter(definition => definition.classification === 'original-named-badge').length
  console.log(`${checkOnly ? 'Verified' : 'Generated'} ${items.length} Microsoft products: ${officialArchitectureCount} official architecture icons, ${officialProductCount} official product PNGs, ${originalBadgeCount} original named badges.`)
}

async function emit(destination, content, checkOnly) {
  const expected = Buffer.isBuffer(content) ? content : Buffer.from(content)
  if (checkOnly) {
    if (!(await readFile(destination)).equals(expected)) throw new Error(`Stale generated Microsoft file: ${fileURLToPath(destination)}`)
  } else {
    await mkdir(new URL('.', destination), { recursive: true })
    await writeFile(destination, expected)
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) await generate(process.argv.includes('--check'))