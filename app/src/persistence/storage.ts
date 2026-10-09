import type { DocumentStorage } from '../contracts.ts'
import { validateDocument } from '../document/index.ts'
import type { Diagram } from '../model.ts'

const DATABASE = 'diagrammer-v1'
const STORE = 'documents'
const ACTIVE = 'active-document'

export class PersistenceError extends Error {
  name = 'PersistenceError'
  operation: string
  constructor(operation: string, message: string, cause?: unknown) {
    super(`${operation}: ${message}`, { cause })
    this.operation = operation
  }
}
const describe = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : String(error)
const failure = (operation: string, error: unknown) => new PersistenceError(operation, describe(error), error)

/** Adapter boundary: one lazy connection, committed transaction promises, and explicit cancellation on close. */
export function createStorage(): DocumentStorage {
  let closed = false
  let database: IDBDatabase | undefined
  let opening: Promise<IDBDatabase> | undefined
  let cancelOpen: ((error: Error) => void) | undefined
  const pending = new Map<IDBTransaction, (error: Error) => void>()
  const closedError = () => new PersistenceError('IndexedDB storage', 'Storage is closed')

  function close() {
    if (closed) return
    closed = true
    cancelOpen?.(closedError())
    cancelOpen = undefined
    const errors: unknown[] = []
    for (const [transaction, reject] of pending) {
      reject(closedError())
      try { transaction.abort() } catch (error) { errors.push(error) }
    }
    pending.clear()
    try { database?.close() } catch (error) { errors.push(error) }
    database = undefined
    if (errors.length) throw failure('IndexedDB close', new AggregateError(errors, 'Storage cleanup failed'))
  }

  function open(): Promise<IDBDatabase> {
    if (closed) return Promise.reject(closedError())
    if (opening) return opening
    opening = new Promise<IDBDatabase>((resolve, reject) => {
      let failed = false
      const rejectOpen = (error: Error) => { failed = true; cancelOpen = undefined; reject(error) }
      cancelOpen = rejectOpen
      try {
        const factory = globalThis.indexedDB
        if (!factory) { rejectOpen(new PersistenceError('IndexedDB open', 'Browser storage is unavailable or unsupported')); return }
        const request = factory.open(DATABASE, 1)
        request.onerror = () => rejectOpen(failure('IndexedDB open', request.error ?? new Error('Database open failed')))
        request.onblocked = () => rejectOpen(new PersistenceError('IndexedDB open', 'Database upgrade is blocked by another tab; close older Diagrammer tabs and retry'))
        request.onupgradeneeded = () => {
          try { if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE) }
          catch (error) { rejectOpen(failure('IndexedDB upgrade', error)) }
        }
        request.onsuccess = () => {
          if (closed || failed) { request.result.close(); return }
          database = request.result
          database.onversionchange = () => close()
          cancelOpen = undefined
          resolve(database)
        }
      } catch (error) { rejectOpen(failure('IndexedDB open', error)) }
    }).catch(error => { opening = undefined; throw error })
    return opening
  }

  async function transact(mode: IDBTransactionMode, snapshot?: Diagram): Promise<unknown> {
    const database = await open()
    if (closed) throw closedError()
    const operation = mode === 'readwrite' ? 'IndexedDB save' : 'IndexedDB load'
    return new Promise((resolve, reject) => {
      let transaction: IDBTransaction | undefined
      let settled = false
      let value: unknown
      const finish = (error?: Error) => {
        if (settled) return
        settled = true
        if (transaction) pending.delete(transaction)
        if (error) reject(error)
        else resolve(value)
      }
      const rejectAndAbort = (error: unknown) => {
        let cause = error
        try { transaction?.abort() } catch (abortError) { cause = new AggregateError([error, abortError], 'Operation and abort failed') }
        finish(failure(operation, cause))
      }
      try {
        transaction = database.transaction(STORE, mode)
        pending.set(transaction, finish)
        transaction.oncomplete = () => finish()
        transaction.onerror = () => rejectAndAbort(transaction?.error ?? new Error('Storage transaction failed'))
        transaction.onabort = () => finish(failure(operation, transaction?.error ?? new Error('Storage transaction aborted')))
        const store = transaction.objectStore(STORE)
        const request = mode === 'readwrite' ? store.put(snapshot, ACTIVE) : store.get(ACTIVE)
        request.onsuccess = () => { value = request.result }
        request.onerror = () => rejectAndAbort(request.error ?? new Error('Storage request failed'))
      } catch (error) { rejectAndAbort(error) }
    })
  }

  return {
    async load() {
      const value = await transact('readonly')
      if (value === undefined) return null
      const result = validateDocument(value)
      if (!result.ok) throw new PersistenceError('IndexedDB load', `Saved document is invalid: ${result.errors.map(error => `${error.path}: ${error.message}`).join('; ')}`)
      return result.value
    },
    async save(document) {
      if (closed) throw closedError()
      const result = validateDocument(document)
      if (!result.ok) throw new PersistenceError('IndexedDB save', `Document is invalid: ${result.errors.map(error => `${error.path}: ${error.message}`).join('; ')}`)
      await transact('readwrite', result.value)
    },
    close,
  }
}