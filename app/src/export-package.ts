/** Shared UI/MCP packaging. ZIP32, stored entries, UTF-8 names, fixed 1980 date. */
export const MAX_EXPORT_MEMBER_BYTES = 32 * 1024 * 1024
export const MAX_EXPORT_ARCHIVE_BYTES = 64 * 1024 * 1024
const encoder = new TextEncoder()
const reserved = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i

export function exportFilenameStem(title: string): string {
  const stem = title.trim().replace(/[^a-zA-Z0-9_-]+/g, '-').slice(0, 80) || 'architecture'
  return reserved.test(stem) ? `_${stem}` : stem
}

function bounded(size: number, limit = MAX_EXPORT_MEMBER_BYTES) {
  if (!Number.isSafeInteger(size) || size < 0 || size > limit) throw new Error('Export size limit exceeded.')
}

function markdownBytes(description: string) {
  // Check code units first to avoid an unbounded allocation; UTF-8 can be larger.
  bounded(description.length)
  const bytes = encoder.encode(description)
  bounded(bytes.length)
  return bytes
}

function safeMember(filename: string) {
  if (!filename || filename.startsWith('.') || filename.includes('..') || /[\\/:<>|" ?*\x00-\x1f\x7f]/.test(filename) || reserved.test(filename)) throw new Error('Unsafe export archive filename.')
  const name = encoder.encode(filename)
  if (name.length > 255) throw new Error('Export filename is too long.')
  const match = /^(.*)\.(svg|png|json)$/.exec(filename)
  if (!match) throw new Error('Unsupported export archive member.')
  return { name, stem: match[1], format: match[2] }
}

async function imageBytes(image: Blob, format: string): Promise<Uint8Array<ArrayBuffer>> {
  bounded(image.size)
  if (!image.size) throw new Error('Export image is empty.')
  const expected = { svg: 'image/svg+xml', png: 'image/png', json: 'application/json' }[format]
  if (!expected || image.type.split(';')[0] !== expected) throw new Error('Export image type does not match its format.')
  const bytes = new Uint8Array(await image.arrayBuffer())
  bounded(bytes.length)
  if (format === 'png' && ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) throw new Error('Invalid PNG export output.')
  if (format === 'svg' && !/^\s*(?:<\?xml[^>]*>\s*)?<svg[\s/>]/.test(new TextDecoder().decode(bytes))) throw new Error('Invalid SVG export output.')
  return bytes
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Validate both members, budget the entire archive, then write once. */
export async function createExportZip(image: Blob, imageFilename: string, description = ''): Promise<Blob> {
  const member = safeMember(imageFilename)
  const markdown = markdownBytes(description)
  const names = [member.name, encoder.encode(`${member.stem}.md`)]
  bounded(image.size)
  const total = 22 + image.size + markdown.length + names.reduce((sum, name) => sum + 76 + 2 * name.length, 0)
  bounded(total, MAX_EXPORT_ARCHIVE_BYTES)
  const contents = [await imageBytes(image, member.format), markdown]
  const bytes = new Uint8Array(total)
  const view = new DataView(bytes.buffer)
  const put16 = (offset: number, value: number) => view.setUint16(offset, value, true)
  const put32 = (offset: number, value: number) => view.setUint32(offset, value, true)
  let offset = 0
  const entries = contents.map((content, index) => {
    const name = names[index], start = offset, crc = crc32(content)
    put32(offset, 0x04034b50); put16(offset + 4, 20); put16(offset + 6, 0x800)
    put16(offset + 12, 33); put32(offset + 14, crc)
    put32(offset + 18, content.length); put32(offset + 22, content.length); put16(offset + 26, name.length)
    bytes.set(name, offset + 30); bytes.set(content, offset + 30 + name.length)
    offset += 30 + name.length + content.length
    return { start, crc, name, size: content.length }
  })
  const central = offset
  for (const entry of entries) {
    put32(offset, 0x02014b50); put16(offset + 4, 20); put16(offset + 6, 20); put16(offset + 8, 0x800)
    put16(offset + 14, 33); put32(offset + 16, entry.crc)
    put32(offset + 20, entry.size); put32(offset + 24, entry.size); put16(offset + 28, entry.name.length)
    put32(offset + 42, entry.start); bytes.set(entry.name, offset + 46)
    offset += 46 + entry.name.length
  }
  put32(offset, 0x06054b50); put16(offset + 8, 2); put16(offset + 10, 2)
  put32(offset + 12, offset - central); put32(offset + 16, central)
  return new Blob([bytes], { type: 'application/zip' })
}

/** Preserve description bytes, append a separate inert, fixed-alt PNG block. */
export async function createEmbeddedMarkdown(png: Blob, description = ''): Promise<Blob> {
  const markdown = markdownBytes(description)
  bounded(png.size)
  bounded(markdown.length + 4 * Math.ceil(png.size / 3) + 48)
  const bytes = await imageBytes(png, 'png')
  // Chunking avoids spread argument limits without requiring Node Buffer.
  const chunks: string[] = []
  for (let offset = 0; offset < bytes.length; offset += 8192) chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 8192)))
  const base64 = btoa(chunks.join(''))
  return new Blob([markdown, `\n\n![Diagram](data:image/png;base64,${base64})\n`], { type: 'text/markdown;charset=utf-8' })
}
