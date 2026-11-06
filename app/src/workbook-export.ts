import { exportFilenameStem, MAX_EXPORT_ARCHIVE_BYTES, MAX_EXPORT_MEMBER_BYTES } from './export-package.ts'
import type { Diagram } from './model.ts'
import type { Workbook } from './workbook.ts'

const encoder = new TextEncoder()
const decoder = new TextDecoder()
const safeName = (name: string) => {
  if (name === '[Content_Types].xml') return name
  // OPC relationship parts are the only dot-leading segment allowed (_rels/.rels).
  if (!/^(?:[A-Za-z0-9_-][A-Za-z0-9_.-]{0,180}\/)*(?:[A-Za-z0-9_-][A-Za-z0-9_.-]{0,180}|\.rels)$/.test(name) || name.includes('..')) throw new Error('Unsafe archive member name')
  return name
}
const bound = (bytes: Uint8Array) => {
  // Empty members are legal (an empty Markdown description stays empty).
  if (bytes.length > MAX_EXPORT_MEMBER_BYTES) throw new Error('Export member exceeds the size limit')
}
function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Write a deterministic, stored UTF-8 ZIP only after every member is bounded. */
export function createStoredZip(entries: readonly { name: string; bytes: Uint8Array }[]): Blob {
  if (!entries.length || entries.length > 1000) throw new Error('Archive must contain bounded members')
  const names = entries.map(entry => encoder.encode(safeName(entry.name)))
  const seen = new Set<string>()
  for (const name of names) { const key = decoder.decode(name); if (seen.has(key)) throw new Error('Archive member collision'); seen.add(key) }
  entries.forEach(entry => bound(entry.bytes))
  const size = 22 + entries.reduce((total, entry, index) => total + entry.bytes.length + 76 + 2 * names[index].length, 0)
  if (size > MAX_EXPORT_ARCHIVE_BYTES) throw new Error('Archive exceeds the 64 MiB limit')
  const bytes = new Uint8Array(size), view = new DataView(bytes.buffer)
  const put16 = (offset: number, value: number) => view.setUint16(offset, value, true)
  const put32 = (offset: number, value: number) => view.setUint32(offset, value, true)
  let offset = 0
  const index = entries.map((entry, item) => {
    const name = names[item], start = offset, crc = crc32(entry.bytes)
    put32(offset, 0x04034b50); put16(offset + 4, 20); put16(offset + 6, 0x800); put16(offset + 12, 33); put32(offset + 14, crc)
    put32(offset + 18, entry.bytes.length); put32(offset + 22, entry.bytes.length); put16(offset + 26, name.length)
    bytes.set(name, offset + 30); bytes.set(entry.bytes, offset + 30 + name.length); offset += 30 + name.length + entry.bytes.length
    return { name, start, crc, size: entry.bytes.length }
  })
  const central = offset
  for (const entry of index) {
    put32(offset, 0x02014b50); put16(offset + 4, 20); put16(offset + 6, 20); put16(offset + 8, 0x800); put16(offset + 14, 33)
    put32(offset + 16, entry.crc); put32(offset + 20, entry.size); put32(offset + 24, entry.size); put16(offset + 28, entry.name.length); put32(offset + 42, entry.start)
    bytes.set(entry.name, offset + 46); offset += 46 + entry.name.length
  }
  put32(offset, 0x06054b50); put16(offset + 8, index.length); put16(offset + 10, index.length); put32(offset + 12, offset - central); put32(offset + 16, central)
  return new Blob([bytes], { type: 'application/zip' })
}


export type WorkbookArtworkFormat = 'svg' | 'png'
const ARTWORK_MIME: Record<WorkbookArtworkFormat, string> = { svg: 'image/svg+xml', png: 'image/png' }

// Pseudocode:
// 1. Walk pages in saved order; ordinal prefixes (001-, 002-, ...) keep names
//    unique even when sanitized titles collide or are empty.
// 2. Render each complete page (never a selection), check its MIME/signature,
//    and pair it with the page Markdown description (may be empty).
// 3. Append workbook.md (workbook description) and a manifest that maps
//    ordinals to stable page IDs, then write one bounded stored ZIP.
export async function createWorkbookArtworkZip(workbook: Workbook, format: WorkbookArtworkFormat, render: (page: Diagram) => Promise<Blob>): Promise<Blob> {
  const entries: { name: string; bytes: Uint8Array }[] = []
  const manifest: { ordinal: number; id: string; title: string; artwork: string; markdown: string }[] = []
  let total = 0
  for (const [index, page] of workbook.pages.entries()) {
    const ordinal = String(index + 1).padStart(3, '0')
    const stem = `${ordinal}-${exportFilenameStem(page.title)}`
    const artwork = await render(page)
    if (artwork.type.split(';')[0] !== ARTWORK_MIME[format]) throw new Error('Renderer returned an invalid workbook artwork type')
    total += artwork.size
    if (total > MAX_EXPORT_ARCHIVE_BYTES) throw new Error('Workbook export exceeds the 64 MiB archive limit')
    const bytes = new Uint8Array(await artwork.arrayBuffer())
    if (!bytes.length) throw new Error(`Page ${index + 1} rendered no artwork`)
    if (format === 'png' && ![137, 80, 78, 71, 13, 10, 26, 10].every((value, offset) => bytes[offset] === value)) throw new Error('Invalid PNG workbook artwork')
    entries.push({ name: `${stem}.${format}`, bytes })
    entries.push({ name: `${stem}.md`, bytes: encoder.encode(page.description ?? '') })
    manifest.push({ ordinal: index + 1, id: page.id, title: page.title, artwork: `${stem}.${format}`, markdown: `${stem}.md` })
  }
  entries.push({ name: 'workbook.md', bytes: encoder.encode(workbook.description ?? '') })
  entries.push({ name: 'manifest.json', bytes: encoder.encode(JSON.stringify({ kind: 'workbook-artwork', format, workbook: { id: workbook.id, title: workbook.title, revision: workbook.revision, markdown: 'workbook.md' }, pages: manifest }, null, 2)) })
  return createStoredZip(entries)
}
