import assert from 'node:assert/strict'
import { afterEach, test, vi } from 'vitest'
import { createDocument } from '../model.ts'
import { createStorage, watchSessionLock } from './index.ts'

type EventRequest = { result?: unknown; error?: Error; onsuccess?: () => void; onerror?: () => void; onupgradeneeded?: () => void; onblocked?: () => void }
type FakeTransaction = { error?: Error; oncomplete?: () => void; onerror?: () => void; onabort?: () => void; abort(): void; objectStore(): { get(): EventRequest; put(value: unknown): EventRequest } }

class FakeIndexedDb {
  snapshot: unknown = undefined
  failure: 'open' | 'blocked' | 'request' | 'abort' | 'transaction' | null = null
  autoComplete = true
  transactions: FakeTransaction[] = []
  closeCount = 0
  openCount = 0
  database = {
    objectStoreNames: { contains: () => false },
    createObjectStore: vi.fn(),
    close: () => { this.closeCount++ },
    onversionchange: undefined as (() => void) | undefined,
    transaction: (_store: string, mode: string) => {
      let value: unknown = this.snapshot
      let aborted = false
      const request: EventRequest = {}
      const transaction: FakeTransaction = {
        abort: () => { aborted = true; queueMicrotask(() => transaction.onabort?.()) },
        objectStore: () => ({
          get: () => { schedule(); return request },
          put: next => { value = structuredClone(next); schedule(); return request },
        }),
      }
      const complete = () => {
        if (aborted) return
        if (this.failure === 'abort') { transaction.error = new Error('Quota exhausted'); transaction.onabort?.(); return }
        if (this.failure === 'transaction') { transaction.error = new Error('Transaction failed'); transaction.onerror?.(); return }
        if (mode === 'readwrite') this.snapshot = value
        transaction.oncomplete?.()
      }
      const schedule = () => queueMicrotask(() => {
        if (aborted) return
        if (this.failure === 'request') { request.error = new Error('Request failed'); request.onerror?.(); return }
        request.result = this.snapshot
        request.onsuccess?.()
        if (this.autoComplete) queueMicrotask(complete)
      })
      this.transactions.push(transaction)
      Object.assign(transaction, { complete })
      return transaction
    },
  }
  open() {
    this.openCount++
    const request: EventRequest = {}
    queueMicrotask(() => {
      if (this.failure === 'open') { request.error = new Error('Access denied'); request.onerror?.(); return }
      if (this.failure === 'blocked') { request.onblocked?.(); return }
      request.result = this.database
      request.onupgradeneeded?.()
      request.onsuccess?.()
    })
    return request
  }
  complete() { for (const transaction of this.transactions) (transaction as FakeTransaction & { complete(): void }).complete() }
}

class FakeLocks {
  owner = false
  queue: { callback: (lock: object) => Promise<unknown>; resolve(value: unknown): void; reject(error: Error): void; aborted: boolean }[] = []
  names: string[] = []
  failure: Error | null = null
  request(name: string, options: { signal: AbortSignal }, callback: (lock: object) => Promise<unknown>) {
    this.names.push(name)
    if (this.failure) return Promise.reject(this.failure)
    return new Promise((resolve, reject) => {
      const entry = { callback, resolve, reject, aborted: false }
      this.queue.push(entry)
      options.signal.addEventListener('abort', () => { entry.aborted = true; reject(new DOMException('Cancelled', 'AbortError')) }, { once: true })
      this.pump()
    })
  }
  pump() {
    if (this.owner) return
    const entry = this.queue.shift()
    if (!entry) return
    if (entry.aborted) { this.pump(); return }
    this.owner = true
    Promise.resolve().then(() => entry.callback({})).then(entry.resolve, entry.reject).finally(() => { this.owner = false; this.pump() })
  }
}

async function flush() { for (let index = 0; index < 20; index++) await Promise.resolve() }
afterEach(() => vi.unstubAllGlobals())

test('should_round_trip_latest_snapshot_when_indexeddb_transactions_complete', async () => {
  const fake = new FakeIndexedDb()
  vi.stubGlobal('indexedDB', fake)
  const storage = createStorage()
  assert.equal(await storage.load(), null)
  const document = createDocument('saved')
  await storage.save(document)
  assert.deepEqual(await storage.load(), document)
  assert.equal(fake.openCount, 1)
  storage.close()
  assert.equal(fake.closeCount, 1)
  await assert.rejects(storage.load(), /closed/i)
  await assert.rejects(storage.save(document), /closed/i)
})

test('should_wait_for_commit_when_a_write_request_succeeds', async () => {
  const fake = new FakeIndexedDb()
  fake.autoComplete = false
  vi.stubGlobal('indexedDB', fake)
  const storage = createStorage()
  let saved = false
  const pending = storage.save(createDocument('pending')).then(() => { saved = true })
  await flush()
  assert.equal(saved, false)
  fake.complete()
  await pending
  assert.equal(saved, true)
  storage.close()
})

test('should_surface_open_request_abort_and_transaction_errors_when_storage_fails', async () => {
  for (const failure of ['open', 'blocked', 'request', 'abort', 'transaction'] as const) {
    const fake = new FakeIndexedDb()
    fake.failure = failure
    vi.stubGlobal('indexedDB', fake)
    const storage = createStorage()
    await assert.rejects(storage.save(createDocument('failure')), /IndexedDB|storage/i, failure)
    assert.equal(fake.snapshot, undefined)
    storage.close()
  }
  vi.stubGlobal('indexedDB', undefined)
  await assert.rejects(createStorage().load(), /unavailable|unsupported/i)
})

test('should_reject_corrupt_snapshots_and_invalid_writes_when_storage_is_used', async () => {
  const fake = new FakeIndexedDb()
  fake.snapshot = { schemaVersion: 99 }
  vi.stubGlobal('indexedDB', fake)
  const storage = createStorage()
  await assert.rejects(storage.load(), /schemaVersion/)
  const document = createDocument('bad')
  Object.assign(document, { revision: -1 })
  await assert.rejects(storage.save(document), /revision/)
  storage.close()
})

test('should_abort_pending_work_when_storage_closes', async () => {
  const fake = new FakeIndexedDb()
  fake.autoComplete = false
  vi.stubGlobal('indexedDB', fake)
  const storage = createStorage()
  const pending = storage.save(createDocument('pending'))
  const rejection = assert.rejects(pending, /closed/i)
  await flush()
  storage.close()
  await rejection
  fake.complete()
  assert.equal(fake.snapshot, undefined)
  storage.close()
  assert.equal(fake.closeCount, 1)
})

test('should_keep_second_tab_read_only_until_the_owner_releases_the_origin_lock', async () => {
  const locks = new FakeLocks()
  vi.stubGlobal('navigator', { locks })
  const first: boolean[] = []
  const second: boolean[] = []
  const closeFirst = watchSessionLock(writable => first.push(writable))
  const closeSecond = watchSessionLock(writable => second.push(writable))
  await flush()
  assert.deepEqual(first, [false, true])
  assert.deepEqual(second, [false])
  assert.equal(new Set(locks.names).size, 1)
  closeFirst()
  await flush()
  assert.deepEqual(first, [false, true, false])
  assert.deepEqual(second, [false, true])
  closeSecond()
  await flush()
  assert.equal(locks.owner, false)
})

test('should_abort_queued_tabs_when_their_watch_is_closed', async () => {
  const locks = new FakeLocks()
  const errors = vi.fn()
  vi.stubGlobal('navigator', { locks })
  vi.stubGlobal('reportError', errors)
  const closeOwner = watchSessionLock(() => {})
  const queued: boolean[] = []
  const closeQueued = watchSessionLock(writable => queued.push(writable))
  await flush()
  closeQueued()
  closeQueued()
  closeOwner()
  await flush()
  assert.deepEqual(queued, [false])
  assert.equal(errors.mock.calls.length, 0)
  assert.equal(locks.owner, false)
})

test('should_fail_closed_and_report_errors_when_browser_lock_support_is_missing_or_fails', async () => {
  vi.stubGlobal('navigator', {})
  const writable: boolean[] = []
  assert.throws(() => watchSessionLock(value => writable.push(value)), /Web Locks|lock support/i)
  assert.deepEqual(writable, [false])
  const locks = new FakeLocks()
  locks.failure = new Error('Policy blocked locks')
  const report = vi.fn()
  vi.stubGlobal('navigator', { locks })
  vi.stubGlobal('reportError', report)
  const close = watchSessionLock(value => writable.push(value))
  await flush()
  assert.equal(writable.includes(true), false)
  assert.match(String(report.mock.calls[0]?.[0]), /Policy blocked locks/)
  close()
})

test('should_close_a_late_database_handle_when_cleanup_happens_during_open', async () => {
  const fake = new FakeIndexedDb()
  vi.stubGlobal('indexedDB', fake)
  const storage = createStorage()
  const pending = storage.load()
  const rejection = assert.rejects(pending, /closed/i)
  storage.close()
  await rejection
  await flush()
  assert.equal(fake.closeCount, 1)
  assert.equal(fake.transactions.length, 0)
})

test('should_close_and_abort_work_when_a_database_version_change_occurs', async () => {
  const fake = new FakeIndexedDb()
  vi.stubGlobal('indexedDB', fake)
  const storage = createStorage()
  await storage.load()
  fake.database.onversionchange?.()
  assert.equal(fake.closeCount, 1)
  await assert.rejects(storage.load(), /closed/i)
})

test('should_retry_open_and_preserve_the_last_durable_snapshot_when_a_later_save_fails', async () => {
  const fake = new FakeIndexedDb()
  fake.failure = 'open'
  vi.stubGlobal('indexedDB', fake)
  const storage = createStorage()
  await assert.rejects(storage.load(), /Access denied/)
  fake.failure = null
  await storage.save(createDocument('durable'))
  fake.failure = 'abort'
  await assert.rejects(storage.save(createDocument('failed')), /Quota exhausted/)
  fake.failure = null
  assert.equal((await storage.load())?.id, 'durable')
  storage.close()
})

test('should_cancel_without_becoming_writable_when_cleanup_precedes_lock_grant', async () => {
  const locks = new FakeLocks()
  vi.stubGlobal('navigator', { locks })
  const states: boolean[] = []
  const close = watchSessionLock(value => states.push(value))
  close()
  await flush()
  assert.deepEqual(states, [false])
  assert.equal(locks.owner, false)
})

test('should_release_ownership_and_report_callback_errors_when_the_owner_callback_throws', async () => {
  const locks = new FakeLocks()
  const report = vi.fn()
  vi.stubGlobal('navigator', { locks })
  vi.stubGlobal('reportError', report)
  const closeFirst = watchSessionLock(writable => { if (writable) throw new Error('Ownership callback failed') })
  const states: boolean[] = []
  const closeSecond = watchSessionLock(writable => states.push(writable))
  await flush()
  assert.deepEqual(states, [false, true])
  assert.match(String(report.mock.calls[0]?.[0]), /Ownership callback failed/)
  closeFirst()
  closeSecond()
  await flush()
  assert.equal(locks.owner, false)
})