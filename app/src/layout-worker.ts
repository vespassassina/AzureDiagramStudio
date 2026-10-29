import ELK from 'elkjs/lib/elk.bundled.js'
import { computeLayout } from './layout.ts'
import type { LayoutOptions } from './layout.ts'
import type { Diagram, Direction } from './model.ts'

function createInProcessEngine(): InstanceType<typeof ELK> {
  // The pinned bundle lazily chooses its embedded transport during construction.
  // Without a document marker it instead installs a native-worker dispatcher on
  // self. Select its existing in-process transport, then immediately restore the
  // worker global before any queued engine work runs. No renderer work or eval.
  const document = Object.getOwnPropertyDescriptor(globalThis, 'document')
  Object.defineProperty(globalThis, 'document', { value: {}, configurable: true })
  try { return new ELK() }
  finally {
    if (document) Object.defineProperty(globalThis, 'document', document)
    else Reflect.deleteProperty(globalThis, 'document')
  }
}

// One cancellable native job owns both real ELK placement and the pure router.
// The host terminates that job on success, error, timeout or cancellation.
self.onmessage = async (event: MessageEvent<{ document: Diagram; direction: Direction; options?: LayoutOptions }>) => {
  const { document, direction, options } = event.data
  try {
    const engine = createInProcessEngine()
    const result = await computeLayout(document, direction, document.revision, engine, options)
    self.postMessage({ result })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Layout worker failed' })
  }
}
