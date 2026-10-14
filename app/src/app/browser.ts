import ELK from 'elkjs/lib/elk-api.js'
import workerUrl from 'elkjs/lib/elk-worker.min.js?url'
import { computeLayout } from '../layout.ts'
import { createStorage, watchSessionLock } from '../persistence/index.ts'
import { download, exportPng, exportSvg } from '../export.ts'
import type { Diagram, Direction } from '../model.ts'
import type { LayoutJob, SessionDependencies } from './session.ts'

export function workerLayout(document: Diagram, direction: Direction): LayoutJob {
  const worker = new Worker(workerUrl)
  const engine = new ELK({ workerFactory: () => worker })
  let rejectJob!: (error: Error) => void
  let finished = false
  let timer: ReturnType<typeof setTimeout>
  function cleanup() {
    clearTimeout(timer)
    worker.removeEventListener('error', onError)
    worker.removeEventListener('messageerror', onError)
    engine.terminateWorker()
  }
  function cancel(message = 'Layout cancelled') {
    if (finished) return
    finished = true; cleanup(); rejectJob(new Error(message))
  }
  function onError(event: Event) { cancel(event instanceof ErrorEvent && event.message ? event.message : 'Layout worker failed; retry Auto-arrange') }
  const promise = new Promise<Awaited<ReturnType<typeof computeLayout>>>((resolve, reject) => {
    rejectJob = reject
    timer = setTimeout(() => cancel('Layout worker timed out after 15 seconds; retry Auto-arrange'), 15_000)
    worker.addEventListener('error', onError)
    worker.addEventListener('messageerror', onError)
    computeLayout(document, direction, document.revision, engine).then(result => {
      if (finished) return
      finished = true; cleanup(); resolve(result)
    }, error => {
      if (finished) return
      finished = true; cleanup(); reject(error)
    })
  })
  return { promise, cancel: () => cancel() }
}

export const browserDependencies: SessionDependencies = {
  createStorage, watchLock: watchSessionLock, layout: workerLayout, download, exportSvg, exportPng,
  copyImage: png => {
    if (!globalThis.ClipboardItem || !navigator.clipboard?.write) throw new Error('Image clipboard is unavailable')
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
  },
  newId: () => `document-${crypto.randomUUID()}`,
  confirmReplace: () => window.confirm('Replace this diagram? Changes since your last JSON download are not backed up. Browser autosave is not a file backup.'),
}