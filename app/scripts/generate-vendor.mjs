import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const registryDirectory = new URL('../src/vendor-icons/', import.meta.url)
const assetDirectory = new URL('../src/assets/vendors/', import.meta.url)
const definitions = JSON.parse(await readFile(new URL('definitions.json', registryDirectory), 'utf8'))
const checkOnly = process.argv.includes('--check')
const assets = {}
const items = []
const keys = new Set()

for (const definition of definitions) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(definition.key) || keys.has(definition.key)) throw new Error(`Invalid or duplicate vendor key: ${definition.key}`)
  if (typeof definition.label !== 'string' || !definition.label.trim() || definition.label.length > 64) throw new Error(`Invalid vendor label: ${definition.key}`)
  if (new URL(definition.url).protocol !== 'https:') throw new Error(`Invalid provenance URL: ${definition.key}`)
  if (!/^[a-f0-9]{64}$/.test(definition.sha256 ?? '')) throw new Error(`Unpinned vendor PNG: ${definition.key}`)
  keys.add(definition.key)
  const icon = `vendor-${definition.key}`
  const bytes = await readFile(new URL(`${icon}.png`, assetDirectory))
  if (bytes.length < 33 || bytes.subarray(0, 8).toString('hex') !== '89504e470d0a1a0a') throw new Error(`Invalid vendor PNG: ${definition.key}`)
  const digest = createHash('sha256').update(bytes).digest('hex')
  if (digest !== definition.sha256) throw new Error(`Vendor source bytes changed: ${definition.key}`)
  const entry = `app/src/assets/vendors/${icon}.png`
  assets[icon] = `data:image/png;base64,${bytes.toString('base64')}`
  items.push({ icon, label: definition.label, subtitle: 'Vendor product icon', color: '#62696c', category: 'Vendors', catalog: 'software', source: { entry, url: definition.url, sha256: digest, categories: ['Vendors'], entries: [entry] }, aliases: definition.aliases, keywords: ['vendor', 'vendor product icon', ...definition.keywords] })
  await emit(new URL(`${icon}.png`, assetDirectory), bytes)
}
await emit(new URL('catalog.generated.json', registryDirectory), `${JSON.stringify(items, null, 2)}\n`)
await emit(new URL('assets.generated.json', registryDirectory), `${JSON.stringify(assets, null, 2)}\n`)
const expectedNames = items.map(item => `${item.icon}.png`).sort()
const actualNames = (await readdir(assetDirectory)).sort()
if (JSON.stringify(expectedNames) !== JSON.stringify(actualNames)) throw new Error('Vendor asset directory contains unexpected or missing files; nothing was deleted.')
console.log(`${checkOnly ? 'Verified' : 'Generated'} ${items.length} pinned vendor PNGs.`)

async function emit(destination, content) {
  const expected = Buffer.isBuffer(content) ? content : Buffer.from(content)
  if (checkOnly) {
    if (!(await readFile(destination)).equals(expected)) throw new Error(`Stale generated vendor file: ${fileURLToPath(destination)}`)
    return
  }
  await mkdir(new URL('.', destination), { recursive: true })
  await writeFile(destination, expected)
}