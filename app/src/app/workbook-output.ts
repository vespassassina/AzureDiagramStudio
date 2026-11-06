import { createEmbeddedMarkdown, exportFilenameStem } from '../export-package.ts'
import { createWorkbookArtworkZip } from '../workbook-export.ts'
import { createVsdx, VSDX_MIME } from '../vsdx.ts'
import { MAX_WORKBOOK_BYTES, activePage, isWorkbook, workspacePages } from '../workbook.ts'
import type { Diagram } from '../model.ts'
import type { ExportSceneOptions } from '../contracts.ts'
import type { WorkspaceDocument } from '../workbook.ts'

/**
 * DGM-151C/152 shared page/workbook export builder used by the Export dialog,
 * MCP export_workbook and the headless CLI. It only ever reads an immutable
 * root snapshot captured by the caller, renders whole pages (never a stale
 * selection) and returns bytes; saving/encoding stays with each caller.
 */
export type PageExportFormat = 'json' | 'svg' | 'png' | 'markdown' | 'pdf' | 'vsdx'
export type WorkbookExportFormat = 'json' | 'zip' | 'pdf' | 'vsdx'
export type DocumentExportRequest =
  | { scope: 'page'; pageId: string; format: PageExportFormat }
  | { scope: 'workbook'; format: WorkbookExportFormat; imageFormat?: 'svg' | 'png' }
export type DocumentExportStyle = { background?: 'diagram' | 'white'; includeGrid?: boolean; transparent?: boolean; scale?: 1 | 2 }
/** Structured, data-only PDF job; the privileged side validates every page again. */
export type PdfJob = { title: string; description?: string; pages: Diagram[]; background: 'diagram' | 'white'; includeGrid?: boolean }
export type ExportRenderers = {
  exportSvg(document: Diagram, transparent: boolean, includeGrid?: boolean, options?: ExportSceneOptions): Promise<string>
  exportPng(document: Diagram, scale: 1 | 2, transparent: boolean, includeGrid?: boolean, options?: ExportSceneOptions): Promise<Blob>
  /** Desktop/headless only. Browser builds omit it and PDF is reported unavailable. */
  renderPdf?(job: PdfJob): Promise<Uint8Array>
  rasterizeIcon?(dataUrl: string): Promise<Uint8Array>
}
export type BuiltExport = { blob: Blob; filename: string; mimeType: string }

export const EXPORT_MIME: Readonly<Record<PageExportFormat | WorkbookExportFormat, string>> = Object.freeze({
  json: 'application/json', svg: 'image/svg+xml', png: 'image/png', markdown: 'text/markdown', zip: 'application/zip', pdf: 'application/pdf', vsdx: VSDX_MIME,
})
const extension = (format: PageExportFormat | WorkbookExportFormat) => format === 'markdown' ? 'md' : format

export function pdfUnavailableMessage(): string {
  return 'PDF export is available in the desktop app only. Choose SVG, PNG, JSON or Visio here.'
}

async function pdfBlob(renderers: ExportRenderers, job: PdfJob): Promise<Blob> {
  if (!renderers.renderPdf) throw new Error(pdfUnavailableMessage())
  const bytes = await renderers.renderPdf(job)
  // Explicit failure, never an empty or non-PDF fallback.
  if (!(bytes instanceof Uint8Array) || bytes.length < 5 || String.fromCharCode(...bytes.subarray(0, 5)) !== '%PDF-') throw new Error('PDF rendering returned no document.')
  return new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' })
}

async function vsdxBlob(renderers: ExportRenderers, pages: Diagram[], title: string, description?: string): Promise<Blob> {
  const rasterizeIcon = renderers.rasterizeIcon
  if (!rasterizeIcon) throw new Error('Visio export is unavailable: icon rasterization is not supported here.')
  return createVsdx(pages, { title, ...(description ? { description } : {}), rasterizeIcon })
}

// Pseudocode:
// 1. Resolve the requested page (scope page) or every saved page (scope workbook)
//    from the caller's immutable root; unknown page IDs fail explicitly.
// 2. Page JSON is the page's own Diagram (v1 or v2 as stored); workbook JSON
//    is the full root (a legacy Diagram root stays a Diagram).
// 3. Artwork formats reuse the normal renderers (fonts, icons, backgrounds,
//    grid, legend, anchors) with the whole-page scene.
// 4. PDF/VSDX go through their dedicated writers; PDF requires the desktop host.
export async function buildDocumentExport(root: WorkspaceDocument, request: DocumentExportRequest, renderers: ExportRenderers, style: DocumentExportStyle = {}): Promise<BuiltExport> {
  const background = style.background ?? 'diagram'
  const scene: ExportSceneOptions = { background, ...(style.includeGrid === undefined ? {} : { includeGrid: style.includeGrid }) }
  const transparent = style.transparent ?? false
  if (request.scope === 'page') {
    const page = activePage(root, request.pageId)
    if (page.id !== request.pageId) throw new Error(`Unknown page: ${request.pageId}`)
    const stem = exportFilenameStem(page.title)
    const filename = `${stem}.${extension(request.format)}`
    let blob: Blob
    if (request.format === 'json') blob = new Blob([JSON.stringify(page, null, 2)], { type: 'application/json' })
    else if (request.format === 'svg') blob = new Blob([await renderers.exportSvg(page, transparent, undefined, scene)], { type: 'image/svg+xml' })
    else if (request.format === 'png') blob = await renderers.exportPng(page, style.scale ?? 1, transparent, undefined, scene)
    else if (request.format === 'markdown') blob = await createEmbeddedMarkdown(await renderers.exportPng(page, style.scale ?? 1, transparent, undefined, scene), page.description ?? '')
    else if (request.format === 'pdf') blob = await pdfBlob(renderers, { title: page.title, ...(page.description ? { description: page.description } : {}), pages: [page], background, ...(style.includeGrid === undefined ? {} : { includeGrid: style.includeGrid }) })
    else blob = await vsdxBlob(renderers, [page], page.title, page.description)
    return { blob, filename, mimeType: EXPORT_MIME[request.format] }
  }
  const pages = workspacePages(root)
  const title = root.title
  const description = root.description
  const stem = exportFilenameStem(title)
  const filename = `${stem}.${extension(request.format)}`
  let blob: Blob
  if (request.format === 'json') {
    const text = JSON.stringify(root, null, 2)
    if (text.length > MAX_WORKBOOK_BYTES) throw new Error('Workbook exceeds the 64 MiB limit')
    blob = new Blob([text], { type: 'application/json' })
  } else if (request.format === 'zip') {
    const imageFormat = request.imageFormat ?? 'svg'
    // A legacy Diagram root exports as a one-page workbook archive; nothing is promoted.
    const book = isWorkbook(root) ? root : { kind: 'workbook' as const, schemaVersion: 1 as const, id: root.id, title: root.title, revision: root.revision, pages: [root], ...(root.description ? { description: root.description } : {}) }
    blob = await createWorkbookArtworkZip(book, imageFormat, async page => imageFormat === 'svg'
      ? new Blob([await renderers.exportSvg(page, transparent, undefined, scene)], { type: 'image/svg+xml' })
      : renderers.exportPng(page, style.scale ?? 1, transparent, undefined, scene))
  } else if (request.format === 'pdf') blob = await pdfBlob(renderers, { title, ...(description ? { description } : {}), pages, background, ...(style.includeGrid === undefined ? {} : { includeGrid: style.includeGrid }) })
  else blob = await vsdxBlob(renderers, pages, title, description)
  return { blob, filename, mimeType: EXPORT_MIME[request.format] }
}
