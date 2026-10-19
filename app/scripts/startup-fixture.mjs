// Shared browser-runner precondition (DGM-127).
// Production no longer opens on the commerce sample: a fresh workspace shows an empty canvas with
// the New diagram picker (Blank default), while saved work recovers exactly. Runners whose checks
// were written against the sample establish it here as explicit recovered work instead of relying
// on the old startup default. Older published builds still start on the sample, so they take the
// 'existing' path unchanged.
import { sampleDiagram } from '../src/model.ts'

const DATABASE = 'diagrammer-v1'
const STORE = 'documents'
const ACTIVE = 'active-document'

/** Reads the raw autosaved document (same key the app's IndexedDB adapter uses). */
export function readActiveDocument(page) {
  return page.evaluate(({ database, store, key }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const connection = request.result
      const transaction = connection.transaction(store, 'readonly')
      const read = transaction.objectStore(store).get(key)
      read.onsuccess = () => resolve(read.result)
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => connection.close()
    }
  }), { database: DATABASE, store: STORE, key: ACTIVE })
}

/** Writes a document as the autosaved active document and resolves once the write has committed. */
export function writeActiveDocument(page, document) {
  return page.evaluate(({ database, store, key, document }) => new Promise((resolve, reject) => {
    const request = indexedDB.open(database, 1)
    request.onerror = () => reject(request.error)
    request.onupgradeneeded = () => { if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store) }
    request.onsuccess = () => {
      const connection = request.result
      const transaction = connection.transaction(store, 'readwrite')
      transaction.objectStore(store).put(document, key)
      transaction.oncomplete = () => { connection.close(); resolve() }
      transaction.onerror = () => reject(transaction.error)
      transaction.onabort = () => reject(transaction.error ?? new Error('Fixture write aborted'))
    }
  }), { database: DATABASE, store: STORE, key: ACTIVE, document })
}

// Pseudocode:
//   1. wait until the editor shows either rendered nodes (sample/recovered work, or an older build)
//      or the fresh-startup New diagram picker
//   2. nodes -> leave storage untouched and report 'existing'
//   3. picker -> keep the default Blank (Escape), let the fresh autosave settle, overwrite it with the
//      sample as recovered work, reload, and wait for the sample to render and settle -> 'seeded'
// The reload is deliberate: recovered work is the only production path that shows the sample
// without a picker, so later checks see the same unsaved-to-JSON state the sample default had.
export async function ensureStartupSample(page, { timeout = 30_000, fixture = sampleDiagram() } = {}) {
  await page.waitForFunction(() => document.querySelector('.react-flow__node') || document.querySelector('.starter-dialog'), undefined, { timeout })
  if (await page.locator('.react-flow__node').count()) return 'existing'
  await page.keyboard.press('Escape')
  await page.waitForFunction(() => document.querySelector('.starter-dialog') === null, undefined, { timeout })
  await settled(page, timeout)
  await writeActiveDocument(page, fixture)
  await page.reload()
  await page.locator('.react-flow__node').first().waitFor({ timeout })
  await settled(page, timeout)
  // Recovered work is framed once by the canvas' initial fit; wait for that camera to settle
  // instead of fitting here, so a recovery-framing regression fails the 390 helper test.
  await cameraSettled(page, timeout)
  return 'seeded'
}

// Resolves once the flow camera transform is unchanged across consecutive animation frames.
function cameraSettled(page, timeout) {
  return page.waitForFunction(() => new Promise(resolve => {
    const read = () => document.querySelector('.react-flow__viewport')?.style.transform
    const first = read()
    requestAnimationFrame(() => requestAnimationFrame(() => resolve(first === read())))
  }), undefined, { timeout, polling: 50 })
}

function settled(page, timeout) {
  return page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device', undefined, { timeout })
}
