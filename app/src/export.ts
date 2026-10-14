import { embeddedFont, visualAssets } from './assets.ts'
import { buildExportScene, renderSvg, pngDimensions } from './scene.ts'
import type { Scene } from './scene.ts'
import type { Diagram } from './model.ts'
import type { ExportSceneOptions } from './contracts.ts'

async function renderExport(scene: Scene, transparent: boolean, includeGrid?: boolean): Promise<string> {
  return renderSvg(scene, { ...visualAssets, fontData: await embeddedFont() }, transparent, includeGrid)
}

export async function exportSvg(diagram: Diagram, transparent = false, includeGrid?: boolean, options?: ExportSceneOptions): Promise<string> {
  return renderExport(buildExportScene(diagram, options), transparent, options?.includeGrid ?? includeGrid)
}
export async function exportPng(diagram: Diagram, scale: 1 | 2, transparent = false, includeGrid?: boolean, options?: ExportSceneOptions): Promise<Blob> {
  const scene = buildExportScene(diagram, options)
  const size = pngDimensions(scene, scale)
  let source: string | undefined
  let image: HTMLImageElement | undefined
  let canvas: HTMLCanvasElement | undefined
  try {
    const svg = await renderExport(scene, transparent, options?.includeGrid ?? includeGrid)
    source = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }))
    await document.fonts?.ready
    image = new Image()
    image.src = source
    await image.decode()
    canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('PNG canvas is unavailable')
    context.drawImage(image, 0, 0, size.width, size.height)
    return await new Promise<Blob>((resolve, reject) => canvas!.toBlob(blob => blob ? resolve(blob) : reject(new Error('PNG encoding failed')), 'image/png'))
  } catch (error) {
    throw new Error(`PNG export failed: ${error instanceof Error ? error.message : 'The browser could not rasterize the diagram'}`, { cause: error })
  } finally {
    if (image) image.src = ''
    if (canvas) { canvas.width = 0; canvas.height = 0 }
    if (source) URL.revokeObjectURL(source)
  }
}
export function download(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}