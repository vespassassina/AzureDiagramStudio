import { exportSvg } from './export.ts'
import { validateDocument } from './document/index.ts'
import type { Diagram } from './model.ts'

/**
 * DGM-151C bundled print page. Runs only in the hidden, sandboxed PDF host
 * window. It renders each saved page with the normal SVG exporter (fonts,
 * icons, backgrounds, grid, legend, anchors) into one A4-landscape sheet with
 * its title, in saved order, then reports readiness once every font and image
 * is decoded. All text is set via textContent; nothing is parsed as HTML.
 */
type PrintJob = { title: string; description?: string; pages: unknown[]; background: 'diagram' | 'white'; includeGrid?: boolean }
declare global {
  interface Window { printHost?: { job(): Promise<PrintJob>; done(result: { ok: true } | { ok: false; message: string }): void } }
}

// Pseudocode:
// 1. Read the single job; revalidate every page with the domain validator.
// 2. For each page: header (workbook title, page n/N), page title, SVG image.
// 3. Await image decode for every sheet and document.fonts.ready.
// 4. Report ok, or report the first failure explicitly (never a blank PDF).
async function render(host: NonNullable<Window['printHost']>) {
  const job = await host.job()
  const pages: Diagram[] = job.pages.map((page, index) => {
    const validated = validateDocument(page)
    if (!validated.ok) throw new Error(`Page ${index + 1} is invalid.`)
    return validated.value
  })
  document.title = job.title || 'Diagram'
  const root = document.getElementById('print')
  if (!root) throw new Error('Print root missing.')
  const decoding: Promise<void>[] = []
  for (const [index, page] of pages.entries()) {
    const sheet = document.createElement('section')
    sheet.className = 'sheet'
    const header = document.createElement('header')
    const book = document.createElement('span')
    book.textContent = job.title
    const count = document.createElement('span')
    count.textContent = `${index + 1} / ${pages.length}`
    header.append(book, count)
    const heading = document.createElement('h1')
    heading.textContent = page.title || `Page ${index + 1}`
    const figure = document.createElement('div')
    figure.className = 'art'
    const image = document.createElement('img')
    image.alt = page.title
    const svg = await exportSvg(page, false, job.includeGrid, { background: job.background, ...(job.includeGrid === undefined ? {} : { includeGrid: job.includeGrid }) })
    image.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
    figure.append(image)
    sheet.append(header, heading, figure)
    root.append(sheet)
    decoding.push(image.decode())
  }
  await Promise.all(decoding)
  await document.fonts.ready
  // Two frames so layout of the final sheet is committed before printing.
  await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

const host = window.printHost
if (host) {
  render(host).then(() => host.done({ ok: true }), (error: unknown) => host.done({ ok: false, message: error instanceof Error ? error.message : String(error) }))
}
