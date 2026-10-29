import { afterEach, expect, test, vi } from 'vitest'
import ELK from 'elkjs/lib/elk.bundled.js'
import { computeLayout } from './layout.ts'
import { createDocument, sampleDiagram } from './model.ts'

afterEach(() => { vi.unstubAllGlobals(); vi.doUnmock('elkjs/lib/elk.bundled.js'); vi.resetModules() })

test('should_return_exact_real_elk_placement_and_routes_without_creating_a_nested_native_worker', async () => {
  const postMessage = vi.fn()
  const nested = vi.fn(function () { throw new Error('Nested native worker is forbidden') })
  const scope = { onmessage: null as typeof self.onmessage, postMessage }
  const document = sampleDiagram()
  const before = structuredClone(document)
  const cases = []
  for (const direction of ['RIGHT', 'DOWN'] as const) for (const arrangement of ['standard', 'stacked'] as const) {
    const options = { arrangement }
    cases.push({ direction, options, expected: await computeLayout(document, direction, document.revision, new ELK(), options) })
  }
  vi.stubGlobal('self', scope)
  vi.stubGlobal('Worker', nested)
  await import('./layout-worker.ts')
  const handler = scope.onmessage!
  for (const { direction, options, expected } of cases) {
    postMessage.mockClear()
    await handler.call(scope as unknown as Window, { data: { document, direction, options } } as MessageEvent)
    expect(postMessage).toHaveBeenCalledExactlyOnceWith({ result: expected })
    expect(scope.onmessage).toBe(handler)
    expect(Object.hasOwn(globalThis, 'document')).toBe(false)
  }
  expect(nested).not.toHaveBeenCalled()
  expect(document).toEqual(before)
})

test('should_report_explicit_layout_failure_without_publishing_a_partial_result', async () => {
  const postMessage = vi.fn()
  const scope = { onmessage: null as typeof self.onmessage, postMessage }
  vi.stubGlobal('self', scope)
  vi.stubGlobal('Worker', vi.fn(function () { throw new Error('Nested native worker is forbidden') }))
  await import('./layout-worker.ts')
  const document = createDocument('malformed')
  Object.defineProperty(document, 'entities', { get() { throw new Error('Invalid worker input') } })
  await scope.onmessage!.call(scope as unknown as Window, { data: { document, direction: 'RIGHT' } } as MessageEvent)
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ error: 'Invalid worker input' })
  expect(Object.hasOwn(globalThis, 'document')).toBe(false)
})

test('should_restore_the_global_descriptor_and_report_engine_initialization_failure', async () => {
  const postMessage = vi.fn()
  const scope = { onmessage: null as typeof self.onmessage, postMessage }
  const original = { retained: true }
  vi.stubGlobal('document', original)
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document')
  vi.stubGlobal('self', scope)
  vi.doMock('elkjs/lib/elk.bundled.js', () => ({
    default: function () { expect(globalThis.document).not.toBe(original); throw new Error('Engine initialization failed') },
  }))
  await import('./layout-worker.ts')
  const handler = scope.onmessage!
  await handler.call(scope as unknown as Window, { data: { document: createDocument('initialization'), direction: 'RIGHT' } } as MessageEvent)
  expect(postMessage).toHaveBeenCalledExactlyOnceWith({ error: 'Engine initialization failed' })
  expect(Object.getOwnPropertyDescriptor(globalThis, 'document')).toEqual(descriptor)
  expect(scope.onmessage).toBe(handler)
})
