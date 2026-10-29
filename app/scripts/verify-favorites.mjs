import assert from 'node:assert/strict'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { favoritesBeforeRestart, favoritesAfterRestart, favoritesStorageFailures } from './favorites-acceptance.mjs'
import { readActiveDocument } from './startup-fixture.mjs'
import { clickApplicationCommand } from './application-menus.mjs'

const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)))
const output = path.resolve(root, process.env.DGM139_OUTPUT ?? path.join('test-results', 'dgm139-owner', `browser-${Date.now()}`))
assert.ok(output.startsWith(path.join(root, 'test-results') + path.sep))
await mkdir(output, { recursive: true })
const dist = path.resolve(root, process.env.DGM139_DIST ?? 'dist')
assert.ok(dist.startsWith(root + path.sep))
const report = { cells: [], errors: [], started: new Date().toISOString() }
const manifest = []
async function hashTree(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) await hashTree(file)
    else manifest.push({ path: path.relative(root, file), sha256: createHash('sha256').update(await readFile(file)).digest('hex') })
  }
}
await hashTree(path.join(root, 'src')); await hashTree(dist)
for (const name of ['verify-favorites.mjs', 'favorites-acceptance.mjs', 'startup-fixture.mjs', 'application-menus.mjs']) manifest.push({ path: `scripts\\${name}`, sha256: createHash('sha256').update(await readFile(path.join(root, 'scripts', name))).digest('hex') })
await writeFile(path.join(output, 'inputs.json'), JSON.stringify(manifest, null, 2))
const server = await preview({ root, build: { outDir: dist }, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
let context
async function launch(profile, viewport, theme) {
  context = await chromium.launchPersistentContext(profile, { channel: 'msedge', headless: true, viewport, acceptDownloads: true })
  const page = await context.newPage()
  page.on('pageerror', error => report.errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') report.errors.push(message.text()) })
  page.on('dialog', dialog => void dialog.accept())
  await page.goto(server.resolvedUrls.local[0])
  await page.getByRole('main', { name: 'Architecture canvas' }).waitFor()
  return page
}
try {
  for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 720, height: 450 }]) for (const theme of ['light', 'dark']) {
    const label = `${viewport.width}-${viewport.height}-${theme}`
    const profile = path.join(output, `profile-${label}`)
    await mkdir(profile)
    let page = await launch(profile, viewport, theme)
    await page.getByRole('dialog', { name: 'New diagram', exact: true }).getByRole('button', { name: 'Blank', exact: true }).click()
    await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
    if (await page.locator('html').getAttribute('data-theme') !== theme) await clickApplicationCommand(page, `Switch to ${theme} theme`)
    const before = await readActiveDocument(page)
    const preference = await favoritesBeforeRestart(page, output, label)
    await favoritesStorageFailures(page, preference)
    assert.deepEqual(await readActiveDocument(page), before)
    await clickApplicationCommand(page, 'Settings')
    await page.getByText(/Workspace root configuration requires the desktop app/).waitFor()
    await page.getByRole('button', { name: 'Done', exact: true }).click()
    await context.close(); context = undefined
    page = await launch(profile, viewport, theme)
    await favoritesAfterRestart(page, preference)
    assert.deepEqual(await readActiveDocument(page), before)
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    await context.close(); context = undefined
    report.cells.push({ ...viewport, theme, passed: true })
    console.log(`PASS ${label}: peer category, search, empty/removal, keyboard, storage failures, reload/profile restart, unchanged diagram`)
  }
  assert.deepEqual(report.errors, [])
  report.passed = true
} catch (error) {
  report.passed = false; report.failure = error.stack
  console.error(error); process.exitCode = 1
} finally {
  if (context) await context.close()
  await new Promise(resolve => server.httpServer.close(resolve))
  report.finished = new Date().toISOString()
  await writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2))
}
