import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Cloud } from 'lucide-react'
import { GENERIC_ICONS, resolveColor, isIconKey, isColorKey } from './catalog.ts'
import { visualAssets } from './assets.ts'
import { validateCustomIcon } from './custom-icons/contract.ts'
import { connectionLabelSize, escapeXml, textLines, textWidth } from './render/text.ts'
export { COLORS, GENERIC_ICONS } from './catalog.ts'
import { absolutePosition, measureEntity, entityTextGeometry, wrapText } from './model.ts'
import type { Diagram, Entity, Connection, ConnectionSide, LegendEntry, Point, Status } from './model.ts'
export { wrapText, measureEntity } from './model.ts'
export { escapeXml } from './render/text.ts'

export type SceneEntity = Entity & { absolute: Point }
export type SceneConnection = Connection & { path: string; labelPosition: Point; start: Point; end: Point }
export type Bounds = { x: number; y: number; width: number; height: number }
type TextBlock = { lines: string[]; x: number; y: number; width: number; size: number; weight: number; color: string }
type LegendItem = LegendEntry & Bounds & { lines: string[] }
export type Scene = Pick<Diagram, 'title' | 'subtitle' | 'synthetic' | 'legendVisible' | 'legend'> & { entities: SceneEntity[]; connections: SceneConnection[]; width: number; height: number; minX: number; minY: number; bounds: Bounds; contentBounds: Bounds; header: TextBlock[]; legendItems: LegendItem[]; padding: number }
export type Assets = { icons?: Record<string, string>; fontData?: string }

const GENERIC_GLYPH_CACHE_LIMIT = 256
const genericGlyphCache = new Map<string, string>()

const STATUS_STYLES: Record<Status, { label: string; color: string; dashed?: boolean }> = {
  live: { label: 'Live', color: '#117865' },
  planned: { label: 'Planned', color: '#a56b16', dashed: true },
  'not-connected': { label: 'Not connected', color: '#62696c', dashed: true },
  synthetic: { label: 'Synthetic', color: '#bd4966' },
}

export function componentHeight(label: string, subtitle = ''): number {
  return measureEntity({ id: '', kind: 'component', label, subtitle, x: 0, y: 0, width: 220, height: 88, color: 'gray' }).height
}

export function fallbackPoints(from: SceneEntity, to: SceneEntity, direction: Diagram['direction'], sourceSide: ConnectionSide = 'auto', targetSide: ConnectionSide = 'auto'): Point[] {
  const vertical = Math.abs((to.absolute.y + to.height / 2) - (from.absolute.y + from.height / 2)) > Math.abs((to.absolute.x + to.width / 2) - (from.absolute.x + from.width / 2)) || direction === 'DOWN'
  if (sourceSide !== 'auto' || targetSide !== 'auto') {
    const forward = vertical ? to.absolute.y >= from.absolute.y : to.absolute.x >= from.absolute.x
    const source = sourceSide === 'auto' ? vertical ? forward ? 'bottom' : 'top' : forward ? 'right' : 'left' : sourceSide
    const target = targetSide === 'auto' ? vertical ? forward ? 'top' : 'bottom' : forward ? 'left' : 'right' : targetSide
    const sidePoint = (entity: SceneEntity, side: ConnectionSide): Point => ({ x: entity.absolute.x + (side === 'left' ? 0 : side === 'right' ? entity.width : entity.width / 2), y: entity.absolute.y + (side === 'top' ? 0 : side === 'bottom' ? entity.height : entity.height / 2) })
    const stub = (point: Point, side: ConnectionSide): Point => ({ x: point.x + (side === 'left' ? -24 : side === 'right' ? 24 : 0), y: point.y + (side === 'top' ? -24 : side === 'bottom' ? 24 : 0) })
    const start = sidePoint(from, source), end = sidePoint(to, target)
    const before = stub(start, source), after = stub(end, target)
    const sourceHorizontal = source === 'left' || source === 'right', targetHorizontal = target === 'left' || target === 'right'
    const middle = sourceHorizontal && targetHorizontal ? [{ x: (before.x + after.x) / 2, y: before.y }, { x: (before.x + after.x) / 2, y: after.y }]
      : !sourceHorizontal && !targetHorizontal ? [{ x: before.x, y: (before.y + after.y) / 2 }, { x: after.x, y: (before.y + after.y) / 2 }]
        : [sourceHorizontal ? { x: after.x, y: before.y } : { x: before.x, y: after.y }]
    return [start, before, ...middle, after, end].filter((point, index, points) => index === 0 || point.x !== points[index - 1].x || point.y !== points[index - 1].y)
  }
  if (vertical) {
    const forward = to.absolute.y >= from.absolute.y
    const start = { x: from.absolute.x + from.width / 2, y: from.absolute.y + (forward ? from.height : 0) }
    const end = { x: to.absolute.x + to.width / 2, y: to.absolute.y + (forward ? 0 : to.height) }
    const middle = (start.y + end.y) / 2
    return [start, { x: start.x, y: middle }, { x: end.x, y: middle }, end]
  }
  const forward = to.absolute.x >= from.absolute.x
  const start = { x: from.absolute.x + (forward ? from.width : 0), y: from.absolute.y + from.height / 2 }
  const end = { x: to.absolute.x + (forward ? 0 : to.width), y: to.absolute.y + to.height / 2 }
  const middle = (start.x + end.x) / 2
  return [start, { x: middle, y: start.y }, { x: middle, y: end.y }, end]
}

export function roundedPath(points: Point[]): string {
  if (!points.length) return ''
  let path = `M ${points[0].x} ${points[0].y}`
  for (let index = 1; index < points.length - 1; index++) {
    const previous = points[index - 1], current = points[index], next = points[index + 1]
    const beforeLength = Math.hypot(current.x - previous.x, current.y - previous.y)
    const afterLength = Math.hypot(next.x - current.x, next.y - current.y)
    if (!beforeLength || !afterLength) continue
    const radius = Math.min(8, beforeLength / 2, afterLength / 2)
    const before = { x: current.x + (previous.x - current.x) * radius / beforeLength, y: current.y + (previous.y - current.y) * radius / beforeLength }
    const after = { x: current.x + (next.x - current.x) * radius / afterLength, y: current.y + (next.y - current.y) * radius / afterLength }
    path += ` L ${before.x} ${before.y} Q ${current.x} ${current.y} ${after.x} ${after.y}`
  }
  const last = points.at(-1)!
  return `${path} L ${last.x} ${last.y}`
}

function unionBounds(boxes: Bounds[]): Bounds {
  if (!boxes.length) return { x: 0, y: 0, width: 1, height: 1 }
  const x = Math.min(...boxes.map(box => box.x)), y = Math.min(...boxes.map(box => box.y))
  return { x, y, width: Math.max(...boxes.map(box => box.x + box.width)) - x, height: Math.max(...boxes.map(box => box.y + box.height)) - y }
}

function automaticLegend(diagram: Diagram): LegendEntry[] {
  if (!diagram.legendVisible) return []
  const statuses = Object.entries(STATUS_STYLES).filter(([status]) => diagram.entities.some(entity => entity.status === status)).map(([, style]) => style)
  const colors = [...new Set(diagram.entities.map(entity => isColorKey(entity.color) ? entity.color : 'gray'))].sort().map(color => ({ label: color.startsWith('#') ? color : color === 'm365' ? 'Microsoft 365' : color.charAt(0).toUpperCase() + color.slice(1), color }))
  const entries: LegendEntry[] = [...diagram.legend, ...statuses, ...colors].map(entry => ({ ...entry, color: resolveColor(entry.color).main }))
  return entries.filter((entry, index) => entries.findIndex(candidate => candidate.label === entry.label && candidate.color === entry.color && !!candidate.dashed === !!entry.dashed) === index)
}

function metadataGeometry(diagram: Diagram, content: Bounds) {
  const width = Math.min(720, Math.max(280, content.width))
  const header: TextBlock[] = []
  const addHeader = (text: string, size: number, weight: number, color: string) => {
    if (text) header.push({ lines: wrapText(text, Math.max(1, Math.floor(width / (size * 0.65)))), x: content.x, y: 0, width, size, weight, color })
  }
  addHeader(diagram.title, 23, 600, '#203637')
  addHeader(diagram.subtitle, 11, 400, '#849293')
  if (diagram.synthetic) addHeader('SYNTHETIC EXAMPLE', 11, 400, '#849293')
  const height = header.reduce((total, block) => total + block.lines.length * (block.size + 4) + 5, 0)
  let top = content.y - height - 16
  for (const block of header) { block.y = top + block.size; top += block.lines.length * (block.size + 4) + 5 }
  const legendItems: LegendItem[] = []
  const available = Math.max(180, Math.min(720, content.width))
  let x = content.x, y = content.y + content.height + 16, rowHeight = 0
  for (const entry of automaticLegend(diagram)) {
    const lines = wrapText(entry.label, Math.max(1, Math.floor((available - 36) / 7.15)))
    const itemWidth = Math.min(available, Math.max(72, ...lines.map(line => textWidth(line, 11) + 36)))
    if (x > content.x && x + itemWidth > content.x + available) { x = content.x; y += rowHeight + 8; rowHeight = 0 }
    const itemHeight = lines.length * 15 + 5
    legendItems.push({ ...entry, lines, x, y, width: itemWidth, height: itemHeight })
    x += itemWidth + 16; rowHeight = Math.max(rowHeight, itemHeight)
  }
  return { header, legendItems }
}

export function buildScene(diagram: Diagram): Scene {
  const entities = diagram.entities.map(entity => ({ ...entity, ...measureEntity(entity), absolute: absolutePosition(diagram, entity.id) }))
  const connections = diagram.connections.flatMap(connection => {
    const from = entities.find(entity => entity.id === connection.from), to = entities.find(entity => entity.id === connection.to)
    if (!from || !to) return []
    const validRoute = connection.routeRevision === diagram.revision && (connection.points?.length ?? 0) >= 2 && connection.points!.every(point => Number.isFinite(point.x) && Number.isFinite(point.y))
    const points = validRoute ? connection.points! : fallbackPoints(from, to, diagram.direction, connection.sourceSide, connection.targetSide)
    const segment = Math.max(0, Math.floor((points.length - 1) / 2))
    const before = points[segment], after = points[Math.min(segment + 1, points.length - 1)]
    const labelPosition = validRoute && connection.labelPosition && Number.isFinite(connection.labelPosition.x) && Number.isFinite(connection.labelPosition.y) ? connection.labelPosition : { x: (before.x + after.x) / 2, y: (before.y + after.y) / 2 }
    return [{ ...connection, points, path: roundedPath(points), labelPosition, start: points[0], end: points.at(-1)! }]
  })
  const boxes = entities.map(entity => ({ ...entity.absolute, width: entity.width, height: entity.height }))
  for (const connection of connections) {
    for (const point of connection.points!) boxes.push({ x: point.x - 10, y: point.y - 10, width: 20, height: 20 })
    if (connection.label) { const size = connectionLabelSize(connection.label); boxes.push({ x: connection.labelPosition.x - size.width / 2, y: connection.labelPosition.y - size.height / 2, ...size }) }
  }
  const contentBounds = unionBounds(boxes)
  const { header, legendItems } = metadataGeometry(diagram, contentBounds)
  const metadataBoxes = header.map(block => ({ x: block.x, y: block.y - block.size, width: Math.min(block.width, Math.max(...block.lines.map(line => textWidth(line, block.size)), 1)), height: block.lines.length * (block.size + 4) }))
  const content = unionBounds([...boxes, ...metadataBoxes, ...legendItems])
  const padding = 20
  const bounds = { x: content.x - padding, y: content.y - padding, width: Math.ceil(content.width + padding * 2), height: Math.ceil(content.height + padding * 2) }
  return { title: diagram.title, subtitle: diagram.subtitle, synthetic: diagram.synthetic, legendVisible: diagram.legendVisible, legend: diagram.legend, entities, connections, minX: bounds.x, minY: bounds.y, width: bounds.width, height: bounds.height, bounds, contentBounds, header, legendItems, padding }
}

function genericGlyphMarkup(key: keyof typeof GENERIC_ICONS | 'cloud', color: string): string {
  const size = 26, strokeWidth = 1.65
  const cacheKey = `${key}:${color}:${size}:${strokeWidth}`
  const cached = genericGlyphCache.get(cacheKey)
  if (cached !== undefined) return cached
  const glyph = key === 'cloud' ? Cloud : GENERIC_ICONS[key]
  const markup = renderToStaticMarkup(createElement(glyph, { size, color, strokeWidth }))
  if (genericGlyphCache.size >= GENERIC_GLYPH_CACHE_LIMIT) genericGlyphCache.delete(genericGlyphCache.keys().next().value!)
  genericGlyphCache.set(cacheKey, markup)
  return markup
}

export function entityMarkup(entity: Entity, assets: Assets = {}): string {
  entity = { ...entity, ...measureEntity(entity) }
  const color = resolveColor(entity.color)
  const text = entityTextGeometry(entity)
  const available = entity.width - text.labelX - (entity.kind === 'text' ? 0 : 16)
  const annotation = textLines(text.labelLines, text.labelX, text.labelY, 13, color.main, available, entity.kind === 'boundary' ? 600 : 400) + textLines(text.subtitleLines, text.labelX, text.subtitleY, 11, '#768284', available)
  if (entity.kind === 'boundary') return `<rect x="1" y="1" width="${entity.width - 2}" height="${entity.height - 2}" rx="8" fill="${color.light}" fill-opacity="0.62" stroke="${color.main}" stroke-opacity="0.36" stroke-width="1.5"/><circle cx="20" cy="24" r="3" fill="${color.main}"/>${annotation}`
  if (entity.kind === 'text') return annotation
  if (entity.kind === 'rectangle') return `<rect x="1" y="1" width="${entity.width - 2}" height="${entity.height - 2}" rx="4" fill="${color.light}" stroke="${color.main}" stroke-width="1.5"/>${annotation}`
  const key = entity.icon && isIconKey(entity.icon) ? entity.icon : undefined
  const icon = key && Object.hasOwn(assets.icons ?? {}, key) && assets.icons?.[key] === visualAssets.icons?.[key] ? assets.icons![key] : undefined
  const glyphKey = Object.hasOwn(GENERIC_ICONS, entity.icon ?? '') ? entity.icon as keyof typeof GENERIC_ICONS : 'cloud'
  const custom = validateCustomIcon(entity.customIcon)
  const artwork = custom.ok ? custom.value.dataUrl : icon
  const iconSvg = artwork ? `<image href="${escapeXml(artwork)}" x="17" y="24" width="28" height="28" preserveAspectRatio="xMidYMid meet">${custom.ok ? `<title>${escapeXml(custom.value.name)}</title>` : ''}</image>` : `<g transform="translate(18 25)">${genericGlyphMarkup(glyphKey, color.main)}</g>`
  const labelLines = text.labelLines
  const subtitleLines = text.subtitleLines
  const status = entity.status && Object.hasOwn(STATUS_STYLES, entity.status) ? STATUS_STYLES[entity.status] : undefined
  const badge = status ? `<rect x="${entity.width - 11}" y="16" width="5" height="5" rx="2.5" fill="${status.color}"/><title>${escapeXml(status.label)}</title>` : ''
  return `<rect x="1" y="1" width="${entity.width - 2}" height="${entity.height - 2}" rx="6" fill="white" stroke="${status?.dashed ? '#c49341' : '#d6dfe1'}" stroke-width="1.4" ${status?.dashed ? 'stroke-dasharray="5 4"' : ''}/><rect x="12" y="19" width="38" height="38" rx="6" fill="${color.light}"/>${iconSvg}${textLines(labelLines, text.labelX, text.labelY, 13, '#263637', available, 600)}${textLines(subtitleLines, text.labelX, text.subtitleY, 11, '#768284', available)}${badge}`
}

export function connectionMarkup(connection: SceneConnection): string {
  const markerEnd = connection.arrow !== 'none' ? 'marker-end="url(#arrow)"' : ''
  const markerStart = connection.arrow === 'both' ? 'marker-start="url(#arrow-start)"' : ''
  const size = connectionLabelSize(connection.label)
  return `<path d="${escapeXml(connection.path)}" fill="none" stroke="#6c8587" stroke-width="1.6" ${connection.style === 'dashed' ? 'stroke-dasharray="6 5"' : ''} ${markerEnd} ${markerStart}/>${connection.label ? `<rect x="${connection.labelPosition.x - size.width / 2}" y="${connection.labelPosition.y - size.height / 2}" width="${size.width}" height="${size.height}" rx="3" fill="white"/>${textLines(wrapText(connection.label, 80), connection.labelPosition.x, connection.labelPosition.y - size.height / 2 + 16, 11, '#526b6d', size.width - 20, 400, 15, true)}` : ''}`
}

export const MARKERS = '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6c8587"/></marker><marker id="arrow-start" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6c8587"/></marker>'

export function sceneLayers(scene: Scene) {
  const depth = (entity: Entity): number => entity.parentId ? 1 + depth(scene.entities.find(candidate => candidate.id === entity.parentId)!) : 0
  return {
    background: scene.entities.filter(entity => entity.kind !== 'boundary' && entity.layer === 'background'),
    boundaries: scene.entities.filter(entity => entity.kind === 'boundary').sort((left, right) => depth(left) - depth(right)),
    foreground: scene.entities.filter(entity => entity.kind !== 'boundary' && entity.layer !== 'background'),
  }
}

export function sceneMetadataMarkup(scene: Scene): string {
  return scene.header.map(block => textLines(block.lines, block.x, block.y, block.size, block.color, block.width, block.weight)).join('') + scene.legendItems.map(item => `<path d="M ${item.x} ${item.y + 8} h 18" stroke="${resolveColor(item.color).main}" stroke-width="2"${item.dashed ? ' stroke-dasharray="5 3"' : ''}/>${textLines(item.lines, item.x + 26, item.y + 12, 11, '#7c8e90', item.width - 26)}`).join('')
}

export function renderSvg(scene: Scene, assets: Assets = {}, transparent = false): string {
  const { background, boundaries, foreground } = sceneLayers(scene)
  const markup = (entity: SceneEntity) => `<g transform="translate(${entity.absolute.x} ${entity.absolute.y})">${entityMarkup(entity, assets)}</g>`
  const font = assets.fontData && /^data:font\/(?:ttf|otf|woff2?);base64,[a-z\d+/]*={0,2}$/i.test(assets.fontData) ? `@font-face{font-family:Plex;src:url('${assets.fontData}')} ` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="${scene.minX} ${scene.minY} ${scene.width} ${scene.height}"><defs>${MARKERS}<style>${font}text{font-family:Plex,'IBM Plex Sans',sans-serif}</style></defs>${transparent ? '' : `<rect x="${scene.minX}" y="${scene.minY}" width="${scene.width}" height="${scene.height}" fill="white"/>`}${background.map(markup).join('')}${boundaries.map(markup).join('')}${scene.connections.map(connectionMarkup).join('')}${foreground.map(markup).join('')}${sceneMetadataMarkup(scene)}</svg>`
}

export function pngDimensions(scene: Scene, scale: 1 | 2): { width: number; height: number } {
  const width = scene.width * scale, height = scene.height * scale
  if ((scale !== 1 && scale !== 2) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height)) throw new Error('PNG dimensions and scale must be positive integers at 1x or 2x.')
  if (width > 8192 || height > 8192 || width * height > 16_777_216) throw new Error('PNG is too large. Export SVG or use 1x resolution.')
  return { width, height }
}