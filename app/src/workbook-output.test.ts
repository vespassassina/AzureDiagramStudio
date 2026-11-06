import { describe, expect, it, vi } from 'vitest'
import { createDocument, sampleDiagram, type Diagram } from './model.ts'
import { createVsdx, xmlText } from './vsdx.ts'
import { buildDocumentExport, pdfUnavailableMessage, type ExportRenderers, type PdfJob } from './app/workbook-output.ts'
import type { Workbook } from './workbook.ts'

// DGM-151C/152 authored acceptance cases (not yet executed in this lane).

// Reads a stored (uncompressed) ZIP produced by createStoredZip.
async function entries(blob: Blob): Promise<Map<string, Uint8Array>> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  const view = new DataView(bytes.buffer)
  const files = new Map<string, Uint8Array>()
  let offset = 0
  while (offset + 30 <= bytes.length && view.getUint32(offset, true) === 0x04034b50) {
    const method = view.getUint16(offset + 8, true)
    expect(method).toBe(0)
    const size = view.getUint32(offset + 18, true)
    const nameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)
    const name = new TextDecoder().decode(bytes.subarray(offset + 30, offset + 30 + nameLength))
    const start = offset + 30 + nameLength + extraLength
    files.set(name, bytes.subarray(start, start + size))
    offset = start + size
  }
  return files
}
const text = (bytes: Uint8Array | undefined) => new TextDecoder().decode(bytes)
const PNG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 0])

function book(...pages: Diagram[]): Workbook {
  return { kind: 'workbook', schemaVersion: 1, id: 'book', title: 'Program <A&B>', description: '# Workbook notes', revision: 3, pages }
}
function renderers(overrides: Partial<ExportRenderers> = {}): ExportRenderers {
  return {
    exportSvg: vi.fn(async (page: Diagram) => `<svg data-page="${page.id}"/>`),
    exportPng: vi.fn(async () => new Blob([PNG], { type: 'image/png' })),
    rasterizeIcon: vi.fn(async () => PNG),
    ...overrides,
  }
}

describe('DGM-152 VSDX writer', () => {
  it('should_write_ordered_macro_free_visio_package_with_glued_connectors_when_pages_are_saved', async () => {
    const sample = sampleDiagram()
    const second = { ...createDocument('second', 'Second & <last>') }
    const blob = await createVsdx([sample, second], { title: 'Workbook "One"', rasterizeIcon: async () => PNG })
    expect(blob.type).toBe('application/vnd.ms-visio.drawing')
    const files = await entries(blob)
    const names = [...files.keys()]
    expect(names[0]).toBe('[Content_Types].xml')
    expect(names).toEqual(expect.arrayContaining(['_rels/.rels', 'docProps/core.xml', 'docProps/app.xml', 'visio/document.xml', 'visio/pages/pages.xml', 'visio/pages/page1.xml', 'visio/pages/page2.xml']))
    expect(names.some(name => /\.(vba|bin)$/i.test(name) || /vbaProject/i.test(name))).toBe(false)
    expect(text(files.get('[Content_Types].xml'))).toContain('application/vnd.ms-visio.drawing.main+xml')
    const pages = text(files.get('visio/pages/pages.xml'))
    expect(pages.indexOf(xmlText(sample.title))).toBeLessThan(pages.indexOf('Second &amp; &lt;last&gt;'))
    const first = text(files.get('visio/pages/page1.xml'))
    expect(first).toContain('http://schemas.microsoft.com/office/visio/2012/main')
    if (sample.connections.length) {
      expect(first).toContain('FromCell="BeginX"')
      expect(first).toContain('FromCell="EndX"')
      expect(first).toMatch(/<Row T="Connection"|Connections/)
    }
    expect(first).not.toMatch(/<image|data:image\/svg/i)
    const again = await entries(await createVsdx([sample, second], { title: 'Workbook "One"', rasterizeIcon: async () => PNG }))
    expect([...again.keys()]).toEqual(names)
    expect(text(again.get('visio/pages/page1.xml'))).toBe(first)
  })
  it('should_escape_special_and_invalid_xml_characters_when_writing_text', () => {
    expect(xmlText('a&b<c>"d\'e\u0001\ud800')).toBe('a&amp;b&lt;c&gt;&quot;d&apos;e')
    expect(xmlText('Ü 🙂')).toBe('Ü 🙂')
  })
})

describe('DGM-151C document export builder', () => {
  it('should_export_page_json_as_its_own_diagram_when_scope_is_page', async () => {
    const root = book(createDocument('p1', 'One'), createDocument('p2', 'Two'))
    const built = await buildDocumentExport(root, { scope: 'page', pageId: 'p2', format: 'json' }, renderers())
    expect(JSON.parse(await built.blob.text())).toEqual(root.pages[1])
    expect(built.filename).toMatch(/\.json$/)
    expect(built.mimeType).toBe('application/json')
  })
  it('should_export_complete_root_when_workbook_json_is_requested', async () => {
    const root = book(createDocument('p1', 'One'), createDocument('p2', 'Two'))
    const built = await buildDocumentExport(root, { scope: 'workbook', format: 'json' }, renderers())
    expect(JSON.parse(await built.blob.text())).toEqual(root)
  })
  it('should_reject_unknown_page_when_page_scope_names_missing_id', async () => {
    await expect(buildDocumentExport(book(createDocument('p1', 'One')), { scope: 'page', pageId: 'missing', format: 'json' }, renderers())).rejects.toThrow('Unknown page')
  })
  it('should_write_ordinal_unique_zip_names_markdown_and_manifest_when_workbook_zip_is_requested', async () => {
    const pages = [{ ...createDocument('p1', 'Same'), description: 'first' }, createDocument('p2', 'Same'), createDocument('p3', '')]
    const output = renderers()
    const built = await buildDocumentExport(book(...pages), { scope: 'workbook', format: 'zip', imageFormat: 'svg' }, output)
    const files = await entries(built.blob)
    const manifest = JSON.parse(text(files.get('manifest.json')))
    expect(manifest.pages.map((page: { id: string }) => page.id)).toEqual(['p1', 'p2', 'p3'])
    expect(new Set(manifest.pages.map((page: { artwork: string }) => page.artwork)).size).toBe(3)
    expect(manifest.pages[0].artwork).toMatch(/^001-/)
    expect(text(files.get(manifest.pages[0].markdown))).toBe('first')
    expect(text(files.get('workbook.md'))).toBe('# Workbook notes')
    expect(text(files.get(manifest.pages[1].artwork))).toBe('<svg data-page="p2"/>')
    // Whole pages only: no selection IDs are ever forwarded.
    for (const call of vi.mocked(output.exportSvg).mock.calls) expect(call[3]?.selectionIds).toBeUndefined()
  })
  it('should_report_pdf_unavailable_when_no_desktop_renderer_exists', async () => {
    await expect(buildDocumentExport(book(createDocument('p1', 'One')), { scope: 'workbook', format: 'pdf' }, renderers())).rejects.toThrow(pdfUnavailableMessage())
  })
  it('should_fail_explicitly_when_pdf_renderer_returns_non_pdf_bytes', async () => {
    const renderPdf = vi.fn(async () => new Uint8Array())
    await expect(buildDocumentExport(book(createDocument('p1', 'One')), { scope: 'workbook', format: 'pdf' }, renderers({ renderPdf }))).rejects.toThrow('PDF rendering returned no document')
  })
  it('should_send_all_pages_in_saved_order_when_workbook_pdf_is_rendered', async () => {
    const renderPdf = vi.fn(async (_job: PdfJob) => new TextEncoder().encode('%PDF-1.7 test'))
    const root = book(createDocument('p1', 'One'), createDocument('p2', 'Two'))
    const built = await buildDocumentExport(root, { scope: 'workbook', format: 'pdf' }, renderers({ renderPdf }))
    expect(built.mimeType).toBe('application/pdf')
    expect(renderPdf.mock.calls[0]![0]).toMatchObject({ title: root.title, description: root.description, background: 'diagram' })
    expect(renderPdf.mock.calls[0]![0].pages.map(page => page.id)).toEqual(['p1', 'p2'])
  })
  it('should_export_legacy_diagram_root_as_one_page_without_promotion_when_workbook_zip_is_requested', async () => {
    const root = createDocument('legacy', 'Legacy')
    const files = await entries((await buildDocumentExport(root, { scope: 'workbook', format: 'zip', imageFormat: 'png' }, renderers())).blob)
    expect(JSON.parse(text(files.get('manifest.json'))).pages).toHaveLength(1)
    expect(root).not.toHaveProperty('kind')
  })
})
