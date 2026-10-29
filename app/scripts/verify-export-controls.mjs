import assert from 'node:assert/strict'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { preview } from 'vite'
import { ensureStartupSample, readActiveDocument } from './startup-fixture.mjs'
import { sampleDiagram } from '../src/model.ts'
import { applicationCommand, clickApplicationCommand } from './application-menus.mjs'

const root = fileURLToPath(new URL('../', import.meta.url))
const output = resolve(process.env.DGM_EXPORT_OUTPUT ?? join(root, 'test-results', 'dgm134-136-owner', new Date().toISOString().replace(/[:.]/g, '-')))
await mkdir(output, { recursive: true })
const server = await preview({ root, build: { outDir: process.env.DGM_SOURCE_DIST ?? 'dist' }, preview: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
const report = { output, cells: [], errors: [] }
let context

// Independent stored-ZIP reader. Product helper is deliberately not imported.
function unzip(bytes) {
  const entries = new Map()
  let offset = 0
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(bytes.readUInt16LE(offset + 6), 0x800)
    assert.equal(bytes.readUInt16LE(offset + 8), 0)
    const length = bytes.readUInt32LE(offset + 18)
    const nameLength = bytes.readUInt16LE(offset + 26)
    const start = offset + 30 + nameLength
    const name = bytes.toString('utf8', offset + 30, start)
    const data = bytes.subarray(start, start + length)
    let crc = 0xffffffff
    for (const byte of data) {
      crc ^= byte
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
    }
    assert.equal(bytes.readUInt32LE(offset + 14), (crc ^ 0xffffffff) >>> 0)
    assert.equal(bytes.readUInt32LE(offset + 22), data.length)
    assert.ok(!entries.has(name))
    entries.set(name, data)
    offset = start + length
  }
  assert.equal(bytes.readUInt32LE(offset), 0x02014b50)
  assert.equal(bytes.readUInt16LE(bytes.length - 12), entries.size)
  return entries
}

async function downloaded(page, action, label) {
  const pending = page.waitForEvent('download')
  await action()
  const download = await pending
  assert.equal(await download.failure(), null)
  const path = join(output, `${label}-${download.suggestedFilename()}`)
  await download.saveAs(path)
  return { name: download.suggestedFilename(), bytes: await readFile(path) }
}

async function geometry(page) {
  const result = await page.evaluate(() => {
    const bounds = element => {
      const box = element.getBoundingClientRect()
      return { label: element.getAttribute('aria-label'), left: box.left, right: box.right, top: box.top, bottom: box.bottom }
    }
    return { overflow: document.documentElement.scrollWidth > innerWidth, width: innerWidth, height: innerHeight, buttons: [...document.querySelectorAll('.topbar button')].map(bounds) }
  })
  assert.equal(result.overflow, false)
  for (const box of result.buttons) assert.ok(box.left >= 0 && box.right <= result.width && box.top >= 0 && box.bottom <= result.height, `Unreachable ${JSON.stringify(box)}`)
  for (const a of result.buttons) for (const b of result.buttons) if (a !== b) {
    assert.ok(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top, `Overlapping ${a.label}/${b.label}`)
  }
  return result
}

try {
  for (const theme of ['light', 'dark']) for (const [width, height] of [[1440, 900], [390, 844], [720, 450]]) {
    const label = `${theme}-${width}x${height}`
    context = await chromium.launchPersistentContext(join(output, `profile-${label}`), { channel: 'msedge', headless: true, viewport: { width, height }, acceptDownloads: true })
    const page = await context.newPage()
    page.on('pageerror', error => report.errors.push(`${label}: ${error.message}`))
    await page.goto(server.resolvedUrls.local[0])
    const fixture = { ...sampleDiagram(), title: 'DGM136 export', description: '# 世界\r\n<script>inert</script>\n![x](file:///not-loaded)\n' }
    await ensureStartupSample(page, { fixture })
    if (await page.locator('html').getAttribute('data-theme') !== theme) await clickApplicationCommand(page, `Switch to ${theme} theme`)
    const baseline = await readActiveDocument(page)
    const boxes = await geometry(page)
    for (const name of ['Help', 'About', 'Settings']) {
      assert.equal(await page.locator('.tool-rail').getByRole('button', { name, exact: true }).count(), 0)
      const trigger = page.getByRole('menuitem', { name: 'Settings menu', exact: true })
      await clickApplicationCommand(page, name)
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
      await page.getByRole('dialog').waitFor({ state: 'hidden' })
      assert.equal(await trigger.evaluate(element => element === document.activeElement), true, `${label}: ${name} focus return`)
      await trigger.focus()
      await page.keyboard.press('Enter')
      await (await applicationCommand(page, name)).focus()
      await page.keyboard.press('Enter')
      await page.getByRole('dialog').waitFor()
      await page.keyboard.press('Escape')
    }
    await clickApplicationCommand(page, `Switch to ${theme === 'light' ? 'dark' : 'light'} theme`)
    await clickApplicationCommand(page, `Switch to ${theme} theme`)
    await page.screenshot({ path: join(output, `${label}-header.png`) })
    const open = async () => { await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByRole('dialog', { name: 'Export diagram' }).waitFor() }
    await open()
    assert.equal(await page.getByRole('checkbox', { name: 'Include Markdown', exact: true }).isChecked(), false)
    const svg = await downloaded(page, () => page.getByRole('button', { name: 'Export SVG', exact: true }).click(), `${label}-plain`)
    for (const format of ['SVG', 'PNG 1x']) {
      await open()
      await page.getByRole('checkbox', { name: 'Include Markdown', exact: true }).check()
      await page.screenshot({ path: join(output, `${label}-export.png`) })
      const zip = await downloaded(page, () => page.getByRole('button', { name: `Export ${format}`, exact: true }).click(), `${label}-${format.split(' ')[0]}`)
      assert.equal(zip.name, 'DGM136-export.zip')
      const entries = unzip(zip.bytes)
      const extension = format === 'SVG' ? 'svg' : 'png'
      assert.deepEqual([...entries.keys()], [`DGM136-export.${extension}`, 'DGM136-export.md'])
      assert.equal(entries.get('DGM136-export.md').toString('utf8'), fixture.description)
      if (extension === 'svg') assert.deepEqual(entries.get('DGM136-export.svg'), svg.bytes)
      else {
        await open()
        const plain = await downloaded(page, () => page.getByRole('button', { name: 'Export PNG 1x', exact: true }).click(), `${label}-plain`)
        assert.deepEqual(entries.get('DGM136-export.png'), plain.bytes)
        await open()
        await page.getByRole('checkbox', { name: 'Include Markdown', exact: true }).check()
        await page.getByRole('radio', { name: 'Markdown with embedded PNG' }).check()
        assert.equal(await page.getByRole('checkbox', { name: 'Include Markdown', exact: true }).count(), 0)
        const markdown = await downloaded(page, () => page.getByRole('button', { name: 'Export Markdown 1x' }).click(), label)
        assert.equal(markdown.name, 'DGM136-export.md')
        const text = markdown.bytes.toString('utf8')
        assert.equal(text.slice(0, fixture.description.length), fixture.description)
        const block = text.slice(fixture.description.length)
        assert.match(block, /^\n\n!\[Diagram\]\(data:image\/png;base64,[A-Za-z0-9+/=]+\)\n$/)
        assert.deepEqual(Buffer.from(block.match(/base64,([^)]*)/)[1], 'base64'), plain.bytes)
      }
    }
    // Real pointer opening must not auto-commit a title draft before packaging.
    const title = page.getByRole('textbox', { name: 'Document title' })
    await title.fill('Uncommitted export title')
    await open()
    await page.getByRole('checkbox', { name: 'Include Markdown', exact: true }).check()
    const draftZip = await downloaded(page, () => page.getByRole('button', { name: 'Export SVG' }).click(), `${label}-draft`)
    assert.equal(draftZip.name, 'DGM136-export.zip')
    assert.deepEqual(unzip(draftZip.bytes).get('DGM136-export.svg'), svg.bytes)
    assert.equal(await title.inputValue(), 'Uncommitted export title')
    assert.deepEqual(await readActiveDocument(page), baseline)
    await title.focus()
    await page.keyboard.press('Escape')
    report.cells.push({ theme, width, height, geometry: boxes, checks: ['pointer/keyboard dialogs and focus', 'header geometry', 'theme', 'plain SVG/PNG equivalence', 'ZIP exact description, names and CRC', 'embedded PNG exact bytes', 'uncommitted draft preservation', 'unchanged autosave'] })
    await context.close()
    context = undefined
  }
  assert.deepEqual(report.errors, [])
  console.log(`PASS ${report.cells.length} viewport/theme cells; downloads and screenshots retained in ${output}`)
} catch (error) {
  report.failure = error.stack
  console.error(error)
  process.exitCode = 1
} finally {
  await context?.close()
  await server.httpServer.close()
  await writeFile(join(output, 'report.json'), JSON.stringify(report, null, 2))
}
