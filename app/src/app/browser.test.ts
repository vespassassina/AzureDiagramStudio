// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDocument, sampleDiagram } from '../model.ts'
import { workerLayout } from './browser.ts'

const host = vi.hoisted(() => ({ layout: vi.fn(), terminate: vi.fn(), factories: [] as (() => Worker)[] }))
vi.mock('elkjs/lib/elk-api.js', () => ({ default: class {
  constructor(options: { workerFactory: () => Worker }) { host.factories.push(options.workerFactory) }
  layout(graph: unknown) { return host.layout(graph) }
  terminateWorker() { host.terminate() }
} }))
const workers: EventTarget[] = []
beforeEach(() => {
  vi.useFakeTimers()
  workers.length = 0; host.factories.length = 0
  host.layout.mockImplementation(() => new Promise(() => {}))
  vi.stubGlobal('Worker', class extends EventTarget { constructor() { super(); workers.push(this) } })
})
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.clearAllMocks() })

describe('DGM-040 official worker lifecycle', () => {
  it('should_use_official_worker_factory_and_terminate_after_success', async () => {
    host.layout.mockImplementation(async graph => graph)
    const job = workerLayout(sampleDiagram(), 'RIGHT')
    const result = await job.promise
    expect(host.factories[0]()).toBe(workers[0])
    expect(result.diagram.id).toBe('sample-commerce')
    expect(host.terminate).toHaveBeenCalledOnce()
    expect(vi.getTimerCount()).toBe(0)
    job.cancel()
    expect(host.terminate).toHaveBeenCalledOnce()
  })
  it('should_reject_and_terminate_when_worker_times_out_without_fake_completion', async () => {
    const job = workerLayout(createDocument('timeout'), 'RIGHT')
    const failure = expect(job.promise).rejects.toThrow('timed out')
    await vi.advanceTimersByTimeAsync(15_000)
    await failure
    expect(host.terminate).toHaveBeenCalledOnce()
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
    expect(host.terminate).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('should_remove_old_error_listener_and_allow_new_request_after_failure', async () => {
    const first = workerLayout(createDocument('old'), 'RIGHT')
    const failure = expect(first.promise).rejects.toThrow('worker failed')
    workers[0].dispatchEvent(new Event('messageerror')); await failure
    host.layout.mockImplementation(async graph => graph)
    const second = workerLayout(createDocument('retry'), 'DOWN')
    await expect(second.promise).resolves.toMatchObject({ diagram: { id: 'retry', direction: 'DOWN' } })
    workers[0].dispatchEvent(new Event('messageerror'))
    expect(host.terminate).toHaveBeenCalledTimes(2)
    expect(vi.getTimerCount()).toBe(0)
  })
})