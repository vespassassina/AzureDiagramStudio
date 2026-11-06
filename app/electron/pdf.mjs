import path from 'node:path'
import { validDocument } from './mcp-bridge.mjs'
import { WINDOW_OPTIONS } from './policy.mjs'
import { secureWindow } from './security.mjs'

/**
 * DGM-151C structured PDF host.
 *
 * The privileged side never accepts HTML, URLs, paths or printer settings. A
 * caller submits a data-only job (titles + saved Diagram pages); this module
 * revalidates it, loads the bundled sandboxed print page in a hidden window,
 * hands the job to that page over a sender-checked channel, waits until the page
 * reports that fonts and images are decoded, then calls printToPDF (A4
 * landscape, backgrounds on). Every failure is explicit; there is no empty or
 * screenshot fallback. Pattern: Adapter around Electron's printToPDF.
 */
export const PRINT_URL = 'ads://studio/print.html'
export const MAX_PDF_JOB_BYTES = 64 * 1024 * 1024
const MAX_PAGE_BYTES = 5 * 1024 * 1024
const MAX_PDF_BYTES = 256 * 1024 * 1024
const RENDER_TIMEOUT_MS = 60_000
const record = value => value !== null && typeof value === 'object' && !Array.isArray(value)

// Pseudocode: exact keys; bounded title/description; 1..100 pages each a valid
// bounded Diagram with unique IDs; enumerated background; whole job <= 64 MiB.
export function validatePdfJob(job) {
  try {
    if (!record(job) || !Object.keys(job).every(key => ['title', 'description', 'pages', 'background', 'includeGrid'].includes(key))) return false
    if (typeof job.title !== 'string' || job.title.length > 4096) return false
    if (job.description !== undefined && (typeof job.description !== 'string' || job.description.length > 60000)) return false
    if (!['diagram', 'white'].includes(job.background) || (job.includeGrid !== undefined && typeof job.includeGrid !== 'boolean')) return false
    if (!Array.isArray(job.pages) || job.pages.length < 1 || job.pages.length > 100) return false
    if (new Set(job.pages.map(page => page?.id)).size !== job.pages.length) return false
    if (!job.pages.every(page => validDocument(page) && Buffer.byteLength(JSON.stringify(page)) <= MAX_PAGE_BYTES)) return false
    return Buffer.byteLength(JSON.stringify(job)) <= MAX_PDF_JOB_BYTES
  } catch { return false }
}

/**
 * Creates a PDF renderer bound to one Electron session (the GUI default session
 * or the headless disposable partition). `register` installs the two fixed IPC
 * channels exactly once per process; jobs are keyed by the hidden window's
 * webContents so concurrent jobs cannot read each other's data.
 */
const jobs = new Map()
let registered = false
function trustedPrintSender(event) {
  try {
    const contents = event.sender
    return !!contents && contents.isDestroyed() === false && event.senderFrame === contents.mainFrame &&
      contents.getURL() === PRINT_URL && event.senderFrame.url === PRINT_URL && jobs.has(contents.id)
  } catch { return false }
}
export function registerPrintChannels(ipcMain) {
  if (registered) return
  registered = true
  // Delivered once: a reload or second request receives nothing.
  ipcMain.handle('print:job', event => {
    if (!trustedPrintSender(event)) throw new Error('Untrusted print sender')
    const entry = jobs.get(event.sender.id)
    if (entry.delivered) throw new Error('Print job already delivered')
    entry.delivered = true
    return entry.job
  })
  ipcMain.on('print:done', (event, result) => {
    if (!trustedPrintSender(event)) return
    const entry = jobs.get(event.sender.id)
    if (!entry.delivered || entry.settled) return
    entry.settled = true
    if (record(result) && result.ok === true && Object.keys(result).length === 1) entry.resolve()
    else entry.reject(new Error(record(result) && typeof result.message === 'string' ? `PDF page rendering failed: ${result.message.slice(0, 500)}` : 'PDF page rendering failed.'))
  })
}

export function createPdfRenderer({ BrowserWindow, ipcMain, appPath, session, timeout = RENDER_TIMEOUT_MS }) {
  registerPrintChannels(ipcMain)
  const preload = path.join(appPath, 'electron', 'print-preload.cjs')
  return async function renderPdf(job) {
    if (!validatePdfJob(job)) throw new Error('Invalid PDF job.')
    const window = new BrowserWindow({
      show: false, width: 1123, height: 794, backgroundColor: '#ffffff',
      webPreferences: { ...WINDOW_OPTIONS.webPreferences, preload, ...(session ? { session } : {}) },
    })
    secureWindow(window)
    const id = window.webContents.id
    let timer
    try {
      const ready = new Promise((resolve, reject) => { jobs.set(id, { job, resolve, reject, delivered: false, settled: false }) })
      const expired = new Promise((_resolve, reject) => { timer = setTimeout(() => reject(new Error('PDF rendering timed out.')), timeout) })
      const gone = new Promise((_resolve, reject) => {
        window.webContents.once('render-process-gone', () => reject(new Error('PDF renderer stopped unexpectedly.')))
        window.webContents.once('did-fail-load', (_event, _code, description, _url, isMainFrame) => { if (isMainFrame) reject(new Error(`PDF page could not load: ${description}`)) })
      })
      await Promise.race([window.loadURL(PRINT_URL), expired, gone])
      await Promise.race([ready, expired, gone])
      const data = await Promise.race([window.webContents.printToPDF({
        landscape: true, pageSize: 'A4', printBackground: true, preferCSSPageSize: true,
        margins: { marginType: 'custom', top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 },
      }), expired, gone])
      const bytes = Buffer.from(data)
      if (bytes.length < 5 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') throw new Error('PDF rendering returned no document.')
      if (bytes.length > MAX_PDF_BYTES) throw new Error('PDF exceeds the output limit.')
      return bytes
    } finally {
      clearTimeout(timer)
      jobs.delete(id)
      if (!window.isDestroyed()) window.destroy()
    }
  }
}
