import { expect, test } from 'vitest'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const output = resolve(process.env.DGM156_OUTPUT ?? 'test-results/dgm156/independent/browser/grid-color')

test('should_decode_the_explicit_grid_color_from_shared_svg_and_png_outputs_DGM156', async () => {
  await mkdir(output, { recursive: true })
  const server = await createServer({ root: resolve('.'), server: { host: '127.0.0.1', port: 0, strictPort: true, open: false } })
  await server.listen()
  const address = server.httpServer!.address() as { port: number }
  const browser = await chromium.launch({ channel: 'msedge', headless: true })
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
    await page.goto(`http://127.0.0.1:${address.port}/src/editor/Editor.harness.html?blank`)
    const result = await page.evaluate(async () => {
      const load = new Function('path', 'return import(path)')
      const { createDocument } = await load('/src/model.ts')
      const { exportPng, exportSvg } = await load('/src/export.ts')
      const samples: Record<string, unknown> = {}
      for (const style of ['dots', 'lines']) {
        const diagram = {
          ...createDocument(`grid-color-${style}`, ''),
          schemaVersion: 2,
          backgroundColor: '#ffffff',
          grid: { visible: false, style, spacing: 8, snap: true, present: false, export: true, color: '#0070c0' },
        }
        const svg = await exportSvg(diagram, false)
        const blob = await exportPng(diagram, 1, false)
        const image = new Image()
        const url = URL.createObjectURL(blob)
        image.src = url
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.naturalWidth
        canvas.height = image.naturalHeight
        const context = canvas.getContext('2d')!
        context.drawImage(image, 0, 0)
        const color = Array.from(context.getImageData(20, 20, 1, 1).data)
        URL.revokeObjectURL(url)
        samples[style] = { svg, color, size: [image.naturalWidth, image.naturalHeight] }
      }
      return samples
    })
    for (const style of ['dots', 'lines']) {
      const sample = result[style] as { svg: string; color: number[]; size: number[] }
      expect(sample.svg).toContain('#0070c0')
      expect(sample.color).not.toEqual([255, 255, 255, 255])
      expect(sample.color[2]).toBeGreaterThan(sample.color[1])
      expect(sample.color[1]).toBeGreaterThan(sample.color[0])
      expect(sample.color[3]).toBe(255)
      expect(sample.size).toEqual([41, 41])
    }
    await writeFile(resolve(output, 'shared-svg-png-color.json'), JSON.stringify(result, null, 2))
    await page.close()
  } catch (error) {
    await writeFile(resolve(output, 'shared-svg-png-color-failed.json'), JSON.stringify({ error: String(error) }, null, 2))
    throw error
  } finally {
    await browser.close()
    await server.close()
  }
}, 120_000)
