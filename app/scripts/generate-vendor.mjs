import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const registryDirectory = new URL('../src/vendor-icons/', import.meta.url)
const assetDirectory = new URL('../src/assets/vendors/', import.meta.url)
const definitions = JSON.parse(await readFile(new URL('definitions.json', registryDirectory), 'utf8'))
const checkOnly = process.argv.includes('--check')
const escapeXml = value => value.replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character])
const assets = {}
const items = []
const keys = new Set()

for (const definition of definitions) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.key) || keys.has(definition.key)) throw new Error(`Invalid or duplicate vendor key: ${definition.key}`)
  if (!/^[A-Z]{2,3}$/.test(definition.glyph)) throw new Error(`Invalid neutral glyph: ${definition.key}`)
  if (typeof definition.label !== 'string' || !definition.label.trim() || definition.label.length > 64) throw new Error(`Invalid vendor label: ${definition.key}`)
  if (new URL(definition.url).protocol !== 'https:') throw new Error(`Invalid provenance URL: ${definition.key}`)
  keys.add(definition.key)
  const icon = `vendor-${definition.key}`
  const label = escapeXml(definition.label)
  const fontSize = definition.glyph.length === 3 ? 25 : 30
  const source = `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64" role="img"><title>${label}: named integration badge</title><desc>Original neutral diagram connector with plain letters; not an official vendor logo or endorsement.</desc><path d="M12 8H52L58 14V50L52 56H12L6 50V14Z" fill="#ffffff" stroke="#62696c" stroke-width="2"/><path d="M1 22H6M1 42H6M58 22H63M58 42H63" fill="none" stroke="#62696c" stroke-width="2" stroke-linecap="round"/><text x="32" y="41" text-anchor="middle" font-family="monospace" font-size="${fontSize}" font-weight="700" fill="#252a2c">${definition.glyph}</text></svg>\n`
  const entry = `app/src/assets/vendors/${icon}.svg`
  assets[icon] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(source)}`
  items.push({ icon, label: definition.label, subtitle: 'Named integration badge', color: '#62696c', category: 'Vendors', catalog: 'software', source: { entry, url: definition.url, sha256: createHash('sha256').update(source).digest('hex'), categories: ['Vendors'], entries: [entry] }, aliases: definition.aliases, keywords: ['vendor', 'named integration badge', ...definition.keywords] })
  await emit(new URL(`${icon}.svg`, assetDirectory), source)
}
await emit(new URL('catalog.generated.json', registryDirectory), `${JSON.stringify(items, null, 2)}\n`)
await emit(new URL('assets.generated.json', registryDirectory), `${JSON.stringify(assets, null, 2)}\n`)
const expectedNames = items.map(item => `${item.icon}.svg`).sort()
const actualNames = (await readdir(assetDirectory)).sort()
if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) throw new Error('Vendor asset directory contains unexpected or missing files; nothing was deleted.')
console.log(`${checkOnly ? 'Verified' : 'Generated'} ${items.length} original named integration badges; 0 official logos.`)

async function emit(destination, content) {
  if (checkOnly) {
    if (await readFile(destination, 'utf8') !== content) throw new Error(`Stale generated vendor file: ${fileURLToPath(destination)}`)
    return
  }
  await mkdir(new URL('.', destination), { recursive: true })
  await writeFile(destination, content, 'utf8')
}