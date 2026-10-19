// DGM-127 harness regression: browser runners that assume the commerce sample must establish it
// explicitly, because a fresh workspace now starts on an empty canvas with the New diagram picker.
// Runs the built dist through Vite preview in fresh Edge contexts; never touches user profiles.
import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { sampleDiagram } from '../src/model.ts'
import { ensureStartupSample, readActiveDocument } from './startup-fixture.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
let server
let browser
let url

before(async () => {
  server = await preview({ root, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  url = server.resolvedUrls.local[0]
  browser = await chromium.launch({ channel: 'msedge', headless: true })
})
after(async () => {
  await browser?.close()
  if (server) await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()))
})

test('should_seed_recovered_sample_when_fresh_startup_offers_picker', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  try {
    const page = await context.newPage()
    await page.goto(url)
    assert.equal(await ensureStartupSample(page), 'seeded')
    assert.equal(await page.getByRole('heading', { name: 'Commerce platform', exact: true }).count(), 1)
    assert.equal(await page.locator('.react-flow__node').count(), 9)
    assert.equal(await page.locator('.starter-dialog').count(), 0)
    assert.equal(await page.locator('.save-label').textContent(), 'Saved on this device')
    assert.equal(await page.locator('.backup-state').textContent(), 'Editable JSON copy needed')
    assert.deepEqual(await readActiveDocument(page), sampleDiagram())
  } finally { await context.close() }
})

test('should_frame_seeded_sample_when_narrow_viewport_recovers_it', async () => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', deviceScaleFactor: 2 })
  try {
    const page = await context.newPage()
    await page.goto(url)
    assert.equal(await ensureStartupSample(page), 'seeded')
    const outside = await page.locator('.react-flow__node').evaluateAll(nodes => nodes.filter(node => {
      const box = node.getBoundingClientRect()
      return box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight
    }).map(node => node.dataset.id))
    assert.deepEqual(outside, [], 'the former sample default started fitted; seeded fixtures must start framed too')
  } finally { await context.close() }
})

test('should_leave_existing_saved_work_untouched_when_no_picker_is_offered', async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  try {
    const first = await context.newPage()
    await first.goto(url)
    await ensureStartupSample(first)
    await first.getByLabel('Document title', { exact: true }).fill('Kept saved work')
    await first.getByLabel('Document title', { exact: true }).press('Enter')
    await first.waitForFunction(() => document.querySelector('.save-label')?.textContent === 'Saved on this device')
    const saved = await readActiveDocument(first)
    await first.close()
    const page = await context.newPage()
    await page.goto(url)
    assert.equal(await ensureStartupSample(page), 'existing')
    assert.equal(await page.getByLabel('Document title', { exact: true }).inputValue(), 'Kept saved work')
    assert.deepEqual(await readActiveDocument(page), saved)
  } finally { await context.close() }
})
