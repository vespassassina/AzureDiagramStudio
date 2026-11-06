import { expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve(process.env.DGM156_OUTPUT ?? 'test-results/dgm156/independent/browser/grid-color')
const blue = 'rgb(0, 112, 192)'

type StoredDocument = {
  documentId?: string
  id?: string
  revision: number
  subtitle?: string
  grid?: { visible: boolean; style: 'dots' | 'lines'; spacing: number; snap: boolean; present: boolean; export: boolean; color?: string }
}

type GridAdmission = {
  documentId: string
  inputRevision: number
  resultRevision: number
  generation: number
  resultGeneration: number
  command: { type: string; patch?: { grid?: StoredDocument['grid'] } }
}

function documentIdentity(document: StoredDocument | null) {
  return document?.documentId ?? document?.id
}

function sessionCommandTracePlugin() {
  // DGM-151A: the session now commits page commands through workspace history.
  const command = '    try { accept(pageCommit(activePageId, applyCommand(currentPage(), command))) }'
  const tracedCommand = `    const dgm156Admission = { documentId: currentPage().id, inputRevision: currentPage().revision, generation, command }
    ;(globalThis as any).__dgm156CommandTrace?.push({ phase: 'admitted', ...dgm156Admission })
    try {
      accept(pageCommit(activePageId, applyCommand(currentPage(), command)))
      ;(globalThis as any).__dgm156CommandTrace?.push({ phase: 'accepted', ...dgm156Admission, resultRevision: currentPage().revision, resultGeneration: generation })
    }`
  return {
    name: 'dgm156-session-command-trace',
    enforce: 'pre' as const,
    transform(source: string, id: string) {
      if (!id.replaceAll('\\', '/').split('?')[0].endsWith('/src/app/session.ts')) return null
      if (source.split(command).length !== 2) throw new Error('DGM-156 command trace could not uniquely locate session.command.')
      return source.replace(command, tracedCommand)
    },
  }
}

async function storedDocument(page: import('@playwright/test').Page): Promise<StoredDocument | null> {
  return page.evaluate(async () => new Promise<StoredDocument | null>((resolve, reject) => {
    const request = indexedDB.open('diagrammer-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('documents', 'readonly')
      const read = transaction.objectStore('documents').get('active-document')
      read.onsuccess = () => resolve(read.result ?? null)
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => database.close()
      transaction.onerror = () => reject(transaction.error)
    }
  }))
}

async function commandTraceLength(page: import('@playwright/test').Page) {
  return page.evaluate(() => ((window as any).__dgm156CommandTrace ?? []).length as number)
}

async function waitForGridCommand(page: import('@playwright/test').Page, afterIndex: number, field: keyof NonNullable<StoredDocument['grid']>, value: string | boolean): Promise<GridAdmission> {
  const result = await page.waitForFunction(({ afterIndex, field, value }) => {
    const trace = (window as any).__dgm156CommandTrace ?? []
    return trace.slice(afterIndex).find((entry: any) =>
      entry.phase === 'accepted' &&
      entry.command?.type === 'metadata' &&
      entry.command.patch?.grid?.[field] === value,
    ) ?? false
  }, { afterIndex, field, value }, { timeout: 10_000 })
  return await result.jsonValue() as GridAdmission
}

async function waitForStoredRevision(page: import('@playwright/test').Page, expected: { documentId: string; revision: number; grid: NonNullable<StoredDocument['grid']> }) {
  await expect.poll(async () => {
    const stored = await storedDocument(page)
    if (documentIdentity(stored) !== expected.documentId || stored?.revision !== expected.revision) return null
    const fields: (keyof typeof expected.grid)[] = ['visible', 'style', 'spacing', 'snap', 'present', 'export', 'color']
    return fields.every(field => stored?.grid?.[field] === expected.grid[field]) ? stored : null
  }, { timeout: 10_000 }).not.toBeNull()
  return storedDocument(page)
}

async function waitForInitialDocument(page: import('@playwright/test').Page) {
  await expect.poll(async () => {
    const stored = await storedDocument(page)
    return stored && documentIdentity(stored) ? stored : null
  }, { timeout: 10_000 }).toMatchObject({ revision: 0 })
  const document = await storedDocument(page)
  if (!document || !documentIdentity(document)) throw new Error('Fresh blank document identity was not persisted.')
  return document
}

test('should_paint_explicit_grid_color_for_dots_and_lines_in_the_actual_editor_DGM156', async () => {
  await mkdir(output, { recursive: true })
  const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  await server.listen()
  const address = server.httpServer!.address() as { port: number }
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Blank', exact: true }).click()
    await page.getByRole('button', { name: 'Commands' }).click()
    await page.getByRole('option', { name: 'Document properties' }).click()
    await page.getByRole('checkbox', { name: 'Show grid', exact: true }).check()

    const paint = async () => page.locator('.react-flow__background pattern').first().evaluate(pattern =>
      [...pattern.children].map(element => {
        const style = getComputedStyle(element)
        return { tag: element.tagName, fill: style.fill, stroke: style.stroke }
      }),
    )

    await page.getByRole('button', { name: 'Blue grid color' }).click()
    const dots = await paint()
    expect(dots).toEqual([{ tag: 'circle', fill: blue, stroke: 'none' }])

    await page.getByRole('button', { name: 'Lines grid' }).click()
    const lines = await paint()
    expect(lines).toEqual([{ tag: 'path', fill: blue, stroke: blue }])
    await writeFile(resolve(output, 'actual-editor-grid-color.json'), JSON.stringify({ dots, lines }, null, 2))
    await page.close()
  } catch (error) {
    await writeFile(resolve(output, 'actual-editor-grid-color-failed.json'), JSON.stringify({ error: String(error) }, null, 2))
    throw error
  } finally {
    await browser.close()
    await server.close()
  }
}, 120_000)

test('should_preserve_the_accepted_grid_color_when_entering_present_after_a_modal_and_metadata_draft_DGM156', async () => {
  await mkdir(output, { recursive: true })
  const server = await createServer({ root: resolve('.'), plugins: [sessionCommandTracePlugin()], server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  await server.listen()
  const address = server.httpServer!.address() as { port: number }
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  let page: import('@playwright/test').Page | undefined
  try {
    page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.addInitScript(() => {
      const put = IDBObjectStore.prototype.put
      ;(window as any).__dgm156Writes = []
      ;(window as any).__dgm156CommandTrace = []
      IDBObjectStore.prototype.put = function(value, key) {
        if (this.name === 'documents' && key === 'active-document') {
          ;(window as any).__dgm156Writes.push({
            documentId: (value as any)?.documentId ?? (value as any)?.id,
            revision: (value as any)?.revision,
            grid: (value as any)?.grid,
            savedAt: performance.now(),
          })
        }
        return put.call(this, value, key)
      }
    })
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Blank', exact: true }).click()
    await page.getByRole('button', { name: 'Commands' }).click()
    await page.getByRole('option', { name: 'Document properties' }).click()

    const initial = await waitForInitialDocument(page)
    const identity = documentIdentity(initial)!
    const persistAcceptedGrid = async (action: GridAdmission) => {
      const grid = action.command.patch?.grid
      if (!grid) throw new Error('Accepted grid command did not contain its canonical grid state.')
      const persisted = await waitForStoredRevision(page!, {
        documentId: action.documentId,
        revision: action.resultRevision,
        grid,
      })
      expect(documentIdentity(persisted)).toBe(action.documentId)
      expect(persisted?.revision).toBe(action.resultRevision)
      expect(persisted?.grid).toEqual(grid)
      return persisted
    }
    const chooseColor = async (name: string, color: string) => {
      const afterIndex = await commandTraceLength(page!)
      const swatch = page!.getByRole('button', { name: `${name} grid color` })
      await swatch.click()
      expect(await swatch.getAttribute('aria-pressed')).toBe('true')
      const action = await waitForGridCommand(page!, afterIndex, 'color', color)
      expect(action.documentId).toBe(identity)
      expect(action.resultRevision).toBe(action.inputRevision + 1)
      expect(action.resultGeneration).toBe(action.generation + 1)
      return action
    }
    const applyGridControl = async (control: () => Promise<void>, field: keyof NonNullable<StoredDocument['grid']>, value: string | boolean) => {
      const afterIndex = await commandTraceLength(page!)
      await control()
      const action = await waitForGridCommand(page!, afterIndex, field, value)
      expect(action.documentId).toBe(identity)
      return action
    }
    const chooseLines = page.getByRole('button', { name: 'Lines grid' })
    if (await chooseLines.getAttribute('aria-pressed') !== 'true') {
      const action = await applyGridControl(() => chooseLines.click(), 'style', 'lines')
      expect(await chooseLines.getAttribute('aria-pressed')).toBe('true')
      await persistAcceptedGrid(action)
    }
    const showInPresent = page.getByRole('checkbox', { name: 'Show grid in Present', exact: true })
    if (!await showInPresent.isChecked()) {
      const action = await applyGridControl(() => showInPresent.check(), 'present', true)
      await persistAcceptedGrid(action)
    }
    const showGrid = page.getByRole('checkbox', { name: 'Show grid', exact: true })
    if (!await showGrid.isChecked()) {
      const action = await applyGridControl(() => showGrid.check(), 'visible', true)
      await persistAcceptedGrid(action)
    }
    const blueState = await chooseColor('Blue', '#0070c0')
    const persistedInitialBlue = await persistAcceptedGrid(blueState)

    const traceCountBeforePresent = await commandTraceLength(page)
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    const presentPaintInitial = await page.locator('.react-flow__background pattern path').evaluate(element => {
      const style = getComputedStyle(element)
      return { fill: style.fill, stroke: style.stroke }
    })
    expect(presentPaintInitial).toEqual({ fill: blue, stroke: blue })
    const storedDuringFirstPresent = await storedDocument(page)
    expect(documentIdentity(storedDuringFirstPresent)).toBe(identity)
    expect(storedDuringFirstPresent).toMatchObject({
      revision: blueState.resultRevision,
      grid: { color: '#0070c0', style: 'lines', present: true, visible: true },
    })
    expect(await commandTraceLength(page)).toBe(traceCountBeforePresent)
    await page.getByRole('button', { name: 'Exit presentation' }).click()
    const storedAfterFirstPresent = await storedDocument(page)
    expect(documentIdentity(storedAfterFirstPresent)).toBe(identity)
    expect(storedAfterFirstPresent).toMatchObject({
      revision: blueState.resultRevision,
      grid: { color: '#0070c0', style: 'lines', present: true, visible: true },
    })

    await page.setViewportSize({ width: 360, height: 480 })
    await page.getByLabel('Document subtitle').fill('draft')
    await page.getByLabel('Document subtitle').press('Control+z')
    await page.getByLabel('Document subtitle').fill('')
    await page.getByLabel('Document subtitle').press('Tab')
    const oldBlue = await storedDocument(page)
    expect(documentIdentity(oldBlue)).toBe(identity)
    expect(oldBlue).toMatchObject({ revision: blueState.resultRevision, grid: { color: '#0070c0', style: 'lines' } })

    const redState = await chooseColor('Red', '#ff0000')
    const persistedRed = await persistAcceptedGrid(redState)

    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dialog = page.getByRole('dialog', { name: 'Export diagram' })
    await dialog.waitFor()
    const traceCountBeforeBlockedClick = await commandTraceLength(page)
    const blockedBlueClick = await page.getByRole('button', { name: 'Blue grid color' }).click({ timeout: 1_500 })
      .then(() => false, () => true)
    expect(blockedBlueClick).toBe(true)
    expect(await commandTraceLength(page)).toBe(traceCountBeforeBlockedClick)
    await dialog.getByRole('button', { name: 'Cancel export' }).click()
    const blueStateAfterModal = await chooseColor('Blue', '#0070c0')
    const newBlue = await persistAcceptedGrid(blueStateAfterModal)
    expect(documentIdentity(newBlue)).toBe(identity)
    expect(newBlue?.revision).toBeGreaterThan(persistedRed!.revision)
    expect(persistedRed?.revision).toBeGreaterThan(oldBlue!.revision)
    expect(blueStateAfterModal.inputRevision).toBe(persistedRed!.revision)

    const persistedBeforePresent = await storedDocument(page)
    expect(persistedBeforePresent).toMatchObject({ revision: blueStateAfterModal.resultRevision, grid: { color: '#0070c0', style: 'lines' } })
    const traceCountBeforeSecondPresent = await commandTraceLength(page)
    await page.getByRole('button', { name: 'Present', exact: true }).click()
    const presentPaint = await page.locator('.react-flow__background pattern path').evaluate(element => {
      const style = getComputedStyle(element)
      return { fill: style.fill, stroke: style.stroke }
    })
    expect(presentPaint).toEqual({ fill: blue, stroke: blue })
    const storedInFirstPresent = await storedDocument(page)
    expect(documentIdentity(storedInFirstPresent)).toBe(identity)
    expect(storedInFirstPresent).toMatchObject({
      revision: blueStateAfterModal.resultRevision,
      grid: { color: '#0070c0', style: 'lines' },
    })
    expect(persistedBeforePresent?.revision).toBe(blueStateAfterModal.resultRevision)
    expect(await commandTraceLength(page)).toBe(traceCountBeforeSecondPresent)
    await page.getByRole('button', { name: 'Exit presentation' }).click()

    const redImmediate = await chooseColor('Red', '#ff0000')
    await persistAcceptedGrid(redImmediate)

    const immediateTraceStart = await commandTraceLength(page)
    const blueButton = page.getByRole('button', { name: 'Blue grid color' })
    await blueButton.click()
    expect(await blueButton.getAttribute('aria-pressed')).toBe('true')
    const blueImmediate = await waitForGridCommand(page, immediateTraceStart, 'color', '#0070c0')
    expect(blueImmediate.documentId).toBe(identity)
    expect(blueImmediate.resultRevision).toBe(blueImmediate.inputRevision + 1)
    expect(blueImmediate.resultGeneration).toBe(blueImmediate.generation + 1)
    expect(blueImmediate.inputRevision).toBe(redImmediate.resultRevision)
    const traceCountOnImmediateBlueAdmission = await commandTraceLength(page)
    const presentButton = page.getByRole('button', { name: 'Present', exact: true })
    await presentButton.click()
    expect(await commandTraceLength(page)).toBe(traceCountOnImmediateBlueAdmission)
    const immediatePresentPaint = await page.locator('.react-flow__background pattern path').evaluate(element => {
      const style = getComputedStyle(element)
      return { fill: style.fill, stroke: style.stroke }
    })
    expect(immediatePresentPaint).toEqual({ fill: blue, stroke: blue })
    const presentBox = await page.locator('.react-flow__background').boundingBox()
    expect(presentBox).not.toBeNull()
    const screenshot = await page.screenshot({ path: resolve(output, 'present-grid-color-immediate.png'), clip: presentBox! })
    const bluePixels = await page.evaluate(async encoded => {
      const bytes = Uint8Array.from(atob(encoded), character => character.charCodeAt(0))
      const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }))
      const canvas = document.createElement('canvas')
      canvas.width = image.width
      canvas.height = image.height
      const context = canvas.getContext('2d')
      if (!context) throw new Error('PNG pixel decoder context was unavailable.')
      context.drawImage(image, 0, 0)
      const pixels = context.getImageData(0, 0, image.width, image.height).data
      let count = 0
      for (let offset = 0; offset < pixels.length; offset += 4) {
        if (pixels[offset + 2] > pixels[offset + 1] + 8 && pixels[offset + 1] > pixels[offset] + 8 && pixels[offset + 2] > pixels[offset] + 20) count++
      }
      image.close()
      return count
    }, screenshot.toString('base64'))
    expect(bluePixels).toBeGreaterThan(0)
    const persistedDuringImmediatePresent = await storedDocument(page)
    expect(documentIdentity(persistedDuringImmediatePresent)).toBe(identity)
    expect([redImmediate.resultRevision, blueImmediate.resultRevision]).toContain(persistedDuringImmediatePresent?.revision)
    const finalBlue = await persistAcceptedGrid(blueImmediate)
    expect(documentIdentity(finalBlue)).toBe(identity)
    expect(finalBlue).toMatchObject({ revision: blueImmediate.resultRevision, grid: { color: '#0070c0', style: 'lines' } })
    const writes = await page.evaluate(() => (window as any).__dgm156Writes ?? [])
    const documentWrites = writes.filter((write: any) => write.documentId === identity)
    expect(documentWrites.every((write: any, index: number) => index === 0 || write.revision >= documentWrites[index - 1].revision)).toBe(true)
    expect(documentWrites.slice(-1)[0]).toMatchObject({ documentId: identity, revision: blueImmediate.resultRevision, grid: blueImmediate.command.patch?.grid })
    const storedAfterImmediatePresent = await storedDocument(page)
    expect(documentIdentity(storedAfterImmediatePresent)).toBe(identity)
    expect(storedAfterImmediatePresent).toMatchObject({ revision: blueImmediate.resultRevision, grid: { color: '#0070c0', style: 'lines' } })
    await writeFile(resolve(output, 'present-grid-color.json'), JSON.stringify({
      initialBlue: { action: blueState, persisted: persistedInitialBlue },
      oldBlue: { documentId: identity, revision: oldBlue!.revision, color: oldBlue!.grid?.color },
      persistedRed: { action: redState, document: persistedRed },
      newBlue: { action: blueStateAfterModal, document: newBlue },
      firstPresent: { documentId: identity, revision: blueStateAfterModal.resultRevision, paint: presentPaint },
      immediateBlueAdmission: blueImmediate,
      persistedDuringImmediatePresent: persistedDuringImmediatePresent && { documentId: documentIdentity(persistedDuringImmediatePresent), revision: persistedDuringImmediatePresent.revision, color: persistedDuringImmediatePresent.grid?.color },
      immediatePresentPaint,
      decodedBluePixels: bluePixels,
      finalBlue: { documentId: documentIdentity(finalBlue), revision: finalBlue?.revision, color: finalBlue?.grid?.color },
      writes: documentWrites,
      commandTrace: await page.evaluate(() => (window as any).__dgm156CommandTrace ?? []),
    }, null, 2))
    await page.getByRole('button', { name: 'Exit presentation' }).click()
  } catch (error) {
    const diagnostic = await page?.evaluate(() => ({
      writes: (window as any).__dgm156Writes ?? [],
      commandTrace: (window as any).__dgm156CommandTrace ?? [],
      documentId: document.querySelector('[data-document-id]')?.getAttribute('data-document-id') ?? null,
    })).catch(() => undefined)
    await writeFile(resolve(output, 'present-grid-color-failed.json'), JSON.stringify({ error: String(error), diagnostic }, null, 2))
    throw error
  } finally {
    await browser.close()
    await server.close()
  }
}, 120_000)
