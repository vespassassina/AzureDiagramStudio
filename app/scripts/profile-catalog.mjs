import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { qualityFixtures } from '../src/fixtures.ts'

const url = process.env.DGM_PROFILE_URL ?? 'http://127.0.0.1:5174/'
const output = fileURLToPath(new URL('../test-results/v1/', import.meta.url))
const stress = qualityFixtures().find(document => document.id === 'stress-v1')
assert.equal(stress.entities.length, 100)
assert.equal(stress.connections.length, 150)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('dialog', dialog => dialog.accept())
  await page.goto(url)
  await page.locator('.react-flow__node').first().waitFor()
  await page.evaluate(() => document.fonts.ready)
  await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open JSON', exact: true }).click()
  await (await chooser).setFiles({ name: 'stress-profile.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(stress)) })
  await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title && document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device', stress.title)
  for (const name of ['Close component library', 'Close properties']) {
    const button = page.getByRole('button', { name, exact: true })
    if (await button.isVisible()) await button.click()
  }
  await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
  const target = page.locator('.react-flow__node[data-id="node-0"]')
  const box = await target.boundingBox()
  assert.ok(box)
  await target.click({ position: { x: Math.min(20, box.width / 2), y: Math.min(20, box.height / 2) } })
  assert.equal(await page.locator('.react-flow__node').count(), 100)
  assert.equal(await page.locator('.react-flow__edge').count(), 150)
  assert.equal(await page.locator('.library-item').count(), 10)
  const session = await context.newCDPSession(page)
  await session.send('Profiler.enable')
  await session.send('Profiler.setSamplingInterval', { interval: 1000 })
  await session.send('Profiler.start')
  await page.evaluate(async () => {
    for (let index = 0; index < 20; index++) {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    }
  })
  const { profile } = await session.send('Profiler.stop')
  await session.send('Profiler.disable')
  await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
  const revision = await page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('diagrammer-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('documents', 'readonly')
      const read = transaction.objectStore('documents').get('active-document')
      read.onsuccess = () => resolve(read.result.revision)
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => database.close()
    }
  }))
  assert.equal(revision, stress.revision + 20)
  assert.deepEqual(errors, [])
  const nodes = new Map(profile.nodes.map(node => [node.id, node]))
  const parents = new Map(profile.nodes.flatMap(node => (node.children ?? []).map(child => [child, node.id])))
  const self = new Map(), inclusive = new Map()
  for (const [index, id] of profile.samples.entries()) {
    const milliseconds = profile.timeDeltas[index] / 1000
    self.set(id, (self.get(id) ?? 0) + milliseconds)
    for (let ancestor = id; ancestor !== undefined; ancestor = parents.get(ancestor)) inclusive.set(ancestor, (inclusive.get(ancestor) ?? 0) + milliseconds)
  }
  const sources = new Map()
  async function frame(id) {
    const callFrame = nodes.get(id).callFrame
    let sourceExcerpt
    if (callFrame.url.startsWith(url)) {
      if (!sources.has(callFrame.url)) sources.set(callFrame.url, await (await fetch(callFrame.url)).text())
      const lines = sources.get(callFrame.url).split('\n')
      sourceExcerpt = lines[callFrame.lineNumber]?.slice(callFrame.columnNumber, callFrame.columnNumber + 700)
    }
    return { id, ...callFrame, selfMilliseconds: self.get(id) ?? 0, inclusiveMilliseconds: inclusive.get(id) ?? 0, sourceExcerpt }
  }
  const ranked = totals => [...totals].filter(([id]) => nodes.get(id).callFrame.url.startsWith(url)).sort((before, after) => after[1] - before[1]).slice(0, 25)
  const summary = {
    diagnosticOnly: 'CPU samples, not a latency-gate rerun; no p95 calculated', url, browser: browser.version(), fixtureSourceSha256: createHash('sha256').update(await readFile(new URL('../src/fixtures.ts', import.meta.url))).digest('hex'),
    hardware: { platform: os.platform(), release: os.release(), architecture: os.arch(), cpu: os.cpus()[0]?.model, logicalCpus: os.cpus().length, memoryGiB: os.totalmem() / 1024 ** 3 },
    nudges: 20, committedRevision: revision, samples: profile.samples.length, sampledMilliseconds: profile.timeDeltas.reduce((total, value) => total + value, 0) / 1000,
    runtime: await Promise.all([...self].filter(([id]) => !nodes.get(id).callFrame.url).map(([id]) => frame(id))),
    topSelf: await Promise.all(ranked(self).map(([id]) => frame(id))), topInclusive: await Promise.all(ranked(inclusive).map(([id]) => frame(id))), errors,
  }
  await writeFile(`${output}/catalog-profile.cpuprofile`, JSON.stringify(profile))
  await writeFile(`${output}/catalog-profile-summary.json`, JSON.stringify(summary, null, 2))
  console.log(JSON.stringify({ ...summary, topSelf: summary.topSelf.slice(0, 10), topInclusive: summary.topInclusive.slice(0, 10) }, null, 2))
} finally {
  await browser.close()
}