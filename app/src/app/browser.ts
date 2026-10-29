import type { LayoutOptions, LayoutResult } from '../layout.ts'
import { createStorage, watchSessionLock } from '../persistence/index.ts'
import { download, exportPng, exportSvg } from '../export.ts'
import type { Diagram, Direction } from '../model.ts'
import type { LayoutJob, SessionDependencies } from './session.ts'
import { saveWorkspaceExport } from './workspace.ts'

export function workerLayout(document: Diagram, direction: Direction, options?: LayoutOptions): LayoutJob {
  const worker = new Worker(new URL('../layout-worker.ts', import.meta.url), { type: 'module' })
  let rejectJob!: (error: Error) => void
  let finished = false
  let timer: ReturnType<typeof setTimeout>
  function cleanup() {
    clearTimeout(timer)
    worker.removeEventListener('error', onError)
    worker.removeEventListener('messageerror', onError)
    worker.removeEventListener('message', onMessage)
    worker.terminate()
  }
  function cancel(message = 'Layout cancelled') {
    if (finished) return
    finished = true; cleanup(); rejectJob(new Error(message))
  }
  function onError(event: Event) { cancel(event instanceof ErrorEvent && event.message ? event.message : 'Layout worker failed; retry Auto-arrange') }
  let resolveJob!: (result: LayoutResult) => void
  function onMessage(event: MessageEvent<{ result?: LayoutResult; error?: string }>) {
    if (finished) return
    if (event.data.error || !event.data.result) { cancel(event.data.error ?? 'Layout worker returned no complete result'); return }
    finished = true; cleanup(); resolveJob(event.data.result)
  }
  const promise = new Promise<LayoutResult>((resolve, reject) => {
    resolveJob = resolve
    rejectJob = reject
    timer = setTimeout(() => cancel('Layout worker timed out after 15 seconds; retry Auto-arrange'), 15_000)
    worker.addEventListener('error', onError)
    worker.addEventListener('messageerror', onError)
    worker.addEventListener('message', onMessage)
    try { worker.postMessage({ document, direction, options }) }
    catch (error) { cancel(error instanceof Error ? error.message : 'Layout worker transport failed') }
  })
  return { promise, cancel: () => cancel() }
}

export const browserDependencies: SessionDependencies = {
  createStorage, watchLock: watchSessionLock, layout: workerLayout, download, saveFile: saveWorkspaceExport, exportSvg, exportPng,
  copyImage: png => {
    if (!globalThis.ClipboardItem || !navigator.clipboard?.write) throw new Error('Image clipboard is unavailable')
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  },
  newId: () => `document-${crypto.randomUUID()}`,
  confirmReplace: () => window.confirm('Replace this diagram? Changes since your last JSON download are not backed up. Browser autosave is not a file backup.'),
}