import { describe, expect, it } from 'vitest'
import { createEmbeddedMarkdown, createExportZip, exportFilenameStem, MAX_EXPORT_MEMBER_BYTES } from './export-package.ts'

const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3])], { type: 'image/png' })

// Independent reader: walk local records and verify CRC, then central records
// and the end record, without using the production writer's implementation.
async function decode(blob: Blob) {
  const buffer = Buffer.from(await blob.arrayBuffer())
  const entries = new Map<string, Buffer>()
  let offset = 0
  while (buffer.readUInt32LE(offset) === 0x04034b50) {
    expect(buffer.readUInt16LE(offset + 6)).toBe(0x800)
    expect(buffer.readUInt16LE(offset + 8)).toBe(0)
    const length = buffer.readUInt32LE(offset + 18)
    expect(buffer.readUInt32LE(offset + 22)).toBe(length)
    const nameLength = buffer.readUInt16LE(offset + 26)
    const name = buffer.toString('utf8', offset + 30, offset + 30 + nameLength)
    const data = buffer.subarray(offset + 30 + nameLength, offset + 30 + nameLength + length)
    let crc = 0xffffffff
    for (const byte of data) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    expect(buffer.readUInt32LE(offset + 14)).toBe((crc ^ 0xffffffff) >>> 0)
    entries.set(name, data)
    offset += 30 + nameLength + length
  }
  const central = offset
  for (const name of entries.keys()) {
    expect(buffer.readUInt32LE(offset)).toBe(0x02014b50)
    const length = buffer.readUInt16LE(offset + 28)
    expect(buffer.toString('utf8', offset + 46, offset + 46 + length)).toBe(name)
    offset += 46 + length
  }
  expect(buffer.readUInt32LE(offset)).toBe(0x06054b50)
  expect(buffer.readUInt16LE(offset + 10)).toBe(2)
  expect(buffer.readUInt32LE(offset + 12)).toBe(offset - central)
  expect(buffer.readUInt32LE(offset + 16)).toBe(central)
  expect(offset + 22).toBe(buffer.length)
  return entries
}

describe('shared export packages DGM136', () => {
  it.each(['svg', 'png', 'json'] as const)('should_pair_exact_inert_UTF8_description_with_%s_in_deterministic_zip', async format => {
    const description = '# 世界\r\n<script>alert(1)</script>\n![x](file:///secret)\n'
    const image = format === 'png' ? png : new Blob([format === 'svg' ? '<svg/>' : '{}'], { type: format === 'svg' ? 'image/svg+xml' : 'application/json' })
    const archive = await createExportZip(image, `架構.${format}`, description)
    expect(archive.type).toBe('application/zip')
    const entries = await decode(archive)
    expect([...entries.keys()]).toEqual([`架構.${format}`, '架構.md'])
    expect(entries.get('架構.md')!.toString('utf8')).toBe(description)
    expect(entries.get(`架構.${format}`)).toEqual(Buffer.from(await image.arrayBuffer()))
    expect(await archive.arrayBuffer()).toEqual(await (await createExportZip(image, `架構.${format}`, description)).arrayBuffer())
  })
  it('should_create_empty_companion_and_safe_legacy_title_stems', async () => {
    expect((await decode(await createExportZip(png, 'architecture.png'))).get('architecture.md')!.length).toBe(0)
    expect(exportFilenameStem('../ A: file/世界')).toBe('-A-file-')
    expect(exportFilenameStem('')).toBe('architecture')
    expect(exportFilenameStem('a'.repeat(100))).toHaveLength(80)
    expect(exportFilenameStem('CON')).toBe('_CON')
  })
  it.each(['../x.png', 'x/y.png', 'x\\y.png', 'C:x.png', '.hidden.png', 'a..png', 'a\n.png', 'CON.png', 'a.md', 'a.exe'])('should_reject_unsafe_or_unsupported_member_%s', async name => {
    await expect(createExportZip(png, name, '')).rejects.toThrow()
  })
  it('should_reject_empty_invalid_or_oversized_output_without_creating_a_package', async () => {
    await expect(createExportZip(new Blob(), 'a.png')).rejects.toThrow()
    await expect(createExportZip(new Blob(['bad'], { type: 'image/png' }), 'a.png')).rejects.toThrow(/PNG/)
    await expect(createExportZip(new Blob(['bad'], { type: 'text/plain' }), 'a.svg')).rejects.toThrow()
    await expect(createExportZip(new Blob([new Uint8Array(MAX_EXPORT_MEMBER_BYTES + 1)], { type: 'image/png' }), 'a.png')).rejects.toThrow(/limit|large/i)
    await expect(createExportZip(png, 'a.png', 'x'.repeat(MAX_EXPORT_MEMBER_BYTES + 1))).rejects.toThrow(/limit|large/i)
    await expect(createExportZip(new Blob([new Uint8Array(MAX_EXPORT_MEMBER_BYTES)], { type: 'image/png' }), 'a.png', 'x'.repeat(MAX_EXPORT_MEMBER_BYTES))).rejects.toThrow(/limit|large/i)
    await expect(createEmbeddedMarkdown(png, 'x'.repeat(MAX_EXPORT_MEMBER_BYTES))).rejects.toThrow(/limit|large/i)
    await expect(createExportZip(png, `${'架'.repeat(100)}.png`)).rejects.toThrow(/long/i)
  })
  it.each(['', '# Description\r\n世界\n<script>inert</script>\n'])('should_preserve_description_verbatim_before_a_fixed_inline_PNG_block', async description => {
    const blob = await createEmbeddedMarkdown(png, description)
    expect(blob.type).toBe('text/markdown;charset=utf-8')
    const text = await blob.text()
    const block = text.slice(description.length)
    expect(text.slice(0, description.length)).toBe(description)
    expect(block).toMatch(/^\n\n!\[Diagram\]\(data:image\/png;base64,[A-Za-z0-9+/=]+\)\n$/)
    const base64 = block.match(/base64,([^)]*)/)![1]
    expect(Buffer.from(base64, 'base64')).toEqual(Buffer.from(await png.arrayBuffer()))
    await expect(createEmbeddedMarkdown(new Blob(['wrong'], { type: 'image/png' }), description)).rejects.toThrow(/PNG/)
  })
})
