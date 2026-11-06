import { expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { resolve } from 'node:path'

test('should_scroll_the_narrow_workspace_when_wheeling_an_actual_legend_DGM157', async () => {
  const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  await server.listen()
  const address = server.httpServer!.address() as { port: number }
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 640, height: 480 } })
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Web/API', exact: true }).click()
    const placement = await page.locator('.canvas-legend').evaluate(legend => {
      const workspace = legend.closest<HTMLElement>('.workspace')
      if (!workspace) throw new Error('Legend workspace unavailable.')
      // Reveal the whole legend inside the clipped workspace with the least scroll,
      // so the workspace keeps room to move and the pointer is over a visible legend.
      const legendBottom = legend.getBoundingClientRect().bottom - workspace.getBoundingClientRect().top + workspace.scrollTop
      workspace.scrollTop = Math.max(1, Math.ceil(legendBottom - workspace.clientHeight) + 1)
      const bounds = legend.getBoundingClientRect()
      const left = bounds.left + Math.min(12, bounds.width / 2), top = bounds.top + Math.min(12, bounds.height / 2)
      return { left, top, hit: legend.contains(document.elementFromPoint(left, top)), before: workspace.scrollTop, max: workspace.scrollHeight - workspace.clientHeight }
    })
    expect(placement.hit).toBe(true)
    expect(placement.max).toBeGreaterThan(placement.before)
    await page.mouse.move(placement.left, placement.top)
    await page.mouse.wheel(0, 60)
    await expect.poll(() => page.locator('.workspace').evaluate(workspace => workspace.scrollTop)).toBeGreaterThan(placement.before)
  } finally {
    await browser.close()
    await server.close()
  }
}, 30_000)

test('should_keep_edited_document_when_new_starter_confirmation_is_canceled_DGM158', async () => {
  const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  await server.listen()
  const address = server.httpServer!.address() as { port: number }
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } })
    await page.goto(`http://127.0.0.1:${address.port}/`, { waitUntil: 'domcontentloaded' })
    await page.getByRole('button', { name: 'Web/API', exact: true }).click()
    const title = page.getByLabel('Document title')
    await title.fill('Protected draft')
    await title.press('Enter')
    await page.getByRole('menuitem', { name: 'File menu' }).click()
    await page.getByRole('menuitem', { name: 'New diagram' }).click()
    page.once('dialog', dialog => dialog.dismiss())
    await page.getByRole('button', { name: 'Fabric', exact: true }).click()
    await expect.poll(() => title.inputValue()).toBe('Protected draft')
  } finally {
    await browser.close()
    await server.close()
  }
}, 30_000)
