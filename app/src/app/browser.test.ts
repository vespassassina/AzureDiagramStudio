// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocument, sampleDiagram } from '../model.ts'
import { workerLayout } from './browser.ts'

class OwnedWorker extends EventTarget {
  postMessage = vi.fn()
  terminate = vi.fn()
  readonly url: URL
  readonly options: WorkerOptions
  constructor(url: URL, options: WorkerOptions) { super(); this.url = url; this.options = options; workers.push(this) }
}
const workers: OwnedWorker[] = []
beforeEach(() => {
  vi.useFakeTimers()
  workers.length = 0
  vi.stubGlobal('Worker', OwnedWorker)
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('DGM-142 complete layout worker lifecycle', () => {
  it('should_offload_placement_and_routing_to_one_owned_module_worker_and_terminate_after_success', async () => {
    const document = sampleDiagram(), options = { arrangement: 'stacked' as const }
    const job = workerLayout(document, 'RIGHT', options)
    expect(workers[0].url.pathname.endsWith('/layout-worker.ts')).toBe(true)
    expect(workers[0].options).toEqual({ type: 'module' })
    expect(workers[0].postMessage).toHaveBeenCalledWith({ document, direction: 'RIGHT', options })
    const result = { diagram: document, revision: document.revision }
    workers[0].dispatchEvent(new MessageEvent('message', { data: { result } }))
    await expect(job.promise).resolves.toEqual(result)
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    job.cancel()
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })
  it('should_reject_and_terminate_when_worker_times_out_without_fake_completion', async () => {
    const job = workerLayout(createDocument('timeout'), 'RIGHT')
    const failure = expect(job.promise).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15_000)
    await failure
    expect(workers[0].terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
  })
  it('should_reject_and_terminate_when_cancelled_or_worker_transport_fails', async () => {
    const cancelled = workerLayout(createDocument('cancel'), 'RIGHT')
    const cancellation = expect(cancelled.promise).rejects.toThrow('cancelled')
    cancelled.cancel(); await cancellation
    const failed = workerLayout(createDocument('error'), 'RIGHT')
    const failure = expect(failed.promise).rejects.toThrow('Transport broke')
    workers[1].dispatchEvent(new ErrorEvent('error', { message: 'Transport broke' }))
    await failure
    expect(workers.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('should_remove_old_listeners_and_allow_a_new_request_after_failure', async () => {
    const first = workerLayout(createDocument('old'), 'RIGHT')
    const failure = expect(first.promise).rejects.toThrow('worker failed')
    workers[0].dispatchEvent(new Event('messageerror')); await failure
    const second = workerLayout(createDocument('retry'), 'DOWN')
    const result = { diagram: { ...createDocument('retry'), direction: 'DOWN' }, revision: 0 }
    workers[0].dispatchEvent(new MessageEvent('message', { data: { result: { diagram: createDocument('stale') } } }))
    workers[1].dispatchEvent(new MessageEvent('message', { data: { result } }))
    await expect(second.promise).resolves.toEqual(result)
    expect(workers.every(worker => worker.terminate.mock.calls.length === 1)).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('should_propagate_a_complete_routing_failure_without_partial_success', async () => {
    const job = workerLayout(createDocument('unroutable'), 'RIGHT')
    const failure = expect(job.promise).rejects.toThrow('edge-1: no corridor')
    workers[0].dispatchEvent(new MessageEvent('message', { data: { error: 'edge-1: no corridor' } }))
    await failure
    workers[0].dispatchEvent(new MessageEvent('message', { data: { result: { diagram: createDocument('late') } } }))
    expect(workers[0].terminate).toHaveBeenCalledOnce()
  })
})
