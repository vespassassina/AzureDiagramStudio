import { PersistenceError } from './storage.ts'

const LOCK_NAME = 'diagrammer-active-document-v1'

function reportLockError(error: unknown) {
  const failure = new PersistenceError('Web Locks ownership', error instanceof Error ? error.message : String(error), error)
  // The frozen callback has no error parameter. Surface asynchronous failures through the browser's error channel.
  if (typeof globalThis.reportError === 'function') globalThis.reportError(failure)
  else queueMicrotask(() => { throw failure })
}

/** Start read-only, queue an exclusive origin-wide lease, and hold it until cleanup; abort only queued requests. */
export function watchSessionLock(onWritableChange: (writable: boolean) => void): () => void {
  onWritableChange(false)
  const locks = globalThis.navigator?.locks
  if (!locks || typeof locks.request !== 'function') throw new PersistenceError('Web Locks ownership', 'Web Locks support is unavailable; editing stays read-only')
  const controller = new AbortController()
  let closed = false
  let writable = false
  let release: (() => void) | undefined
  const cleanup = () => {
    if (closed) return
    closed = true
    globalThis.removeEventListener?.('pagehide', cleanup)
    try { if (writable) { writable = false; onWritableChange(false) } }
    finally {
      if (release) release()
      else controller.abort()
    }
  }
  try {
    const request = locks.request(LOCK_NAME, { mode: 'exclusive', signal: controller.signal }, async lock => {
      if (closed) return
      if (!lock) throw new Error('Exclusive document lock was not granted')
      const held = new Promise<void>(resolve => { release = resolve })
      try {
        writable = true
        onWritableChange(true)
        await held
      } finally {
        if (writable) { writable = false; onWritableChange(false) }
        release = undefined
      }
    })
    request.catch(error => {
      if (closed && error instanceof Error && error.name === 'AbortError') return
      cleanup()
      reportLockError(error)
    })
  } catch (error) {
    cleanup()
    throw new PersistenceError('Web Locks ownership', error instanceof Error ? error.message : String(error), error)
  }
  globalThis.addEventListener?.('pagehide', cleanup)
  return cleanup
}