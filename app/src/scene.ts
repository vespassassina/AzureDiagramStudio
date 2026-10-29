import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Cloud } from 'lucide-react'
import { GENERIC_ICONS, resolveColor, isIconKey, isColorKey } from './catalog.ts'
import { visualAssets } from './assets.ts'
import { validateCustomIcon } from './custom-icons/contract.ts'
import { connectionLabelSize, escapeXml, textLines, textWidth } from './render/text.ts'
import { backgroundAt, compositeColor, contrastInk, effectiveBackground, isWhiteBackground } from './render/contrast.ts'
export { COLORS, GENERIC_ICONS } from './catalog.ts'
import { absolutePosition, measureEntity, entityTextGeometry, wrapText } from './model.ts'
import { painterOrder } from './order.ts'
import { effectiveGrid } from './grid.ts'
import type { Diagram, Entity, Connection, ConnectionSide, LegendEntry, Point, Status } from './model.ts'
import type { ExportSceneOptions } from './contracts.ts'
export { wrapText, measureEntity } from './model.ts'
export { escapeXml } from './render/text.ts'

export type SceneEntity = Entity & { absolute: Point }
export type SceneConnection = Connection & { path: string; labelPosition: Point; start: Point; end: Point }
export type Bounds = { x: number; y: number; width: number; height: number }
type TextBlock = { lines: string[]; x: number; y: number; width: number; size: number; weight: number; color: string }
type LegendItem = LegendEntry & Bounds & { lines: string[] }
export type Scene = Pick<Diagram, 'title' | 'subtitle' | 'synthetic' | 'legendVisible' | 'legend'> & { grid: ReturnType<typeof effectiveGrid>; backgroundColor: string; entityBackgrounds: Record<string, string>; connectionBackgrounds: Record<string, string>; entities: SceneEntity[]; connections: SceneConnection[]; width: number; height: number; minX: number; minY: number; bounds: Bounds; contentBounds: Bounds; header: TextBlock[]; legendItems: LegendItem[]; padding: number }
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
    if (text) header.push({ lines: wrapText(text, Math.max(1, Math.floor(width / (size * 0.65)))), x: content.x, y: 0, width, size, weight, color: contrastInk(color, effectiveBackground(diagram.backgroundColor), 7) })
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
  const entities = painterOrder(diagram.entities).entities.map(entity => ({ ...entity, ...measureEntity(entity), absolute: absolutePosition(diagram, entity.id) }))
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
  const backgroundColor = effectiveBackground(diagram.backgroundColor)
  const legacyWhite = isWhiteBackground(backgroundColor)
  const entityBackgrounds = Object.fromEntries(entities.map(entity => {
    const text = entityTextGeometry(entity)
    const point = { x: entity.absolute.x + text.labelX, y: entity.absolute.y + text.labelY }
    return [entity.id, legacyWhite || entity.kind === 'component' ? '#ffffff' : backgroundAt(entities, point, backgroundColor, entity.id)]
  }))
  const { background, boundaries } = painterOrder(entities)
  const connectionBackgrounds = Object.fromEntries(connections.map(connection => [connection.id, legacyWhite ? '#ffffff' : backgroundAt([...background, ...boundaries], connection.labelPosition, backgroundColor)]))
  return { title: diagram.title, subtitle: diagram.subtitle, grid: effectiveGrid(diagram.grid), backgroundColor, entityBackgrounds, connectionBackgrounds, synthetic: diagram.synthetic, legendVisible: diagram.legendVisible, legend: diagram.legend, entities, connections, minX: bounds.x, minY: bounds.y, width: bounds.width, height: bounds.height, bounds, contentBounds, header, legendItems, padding }
}

export function buildExportScene(diagram: Diagram, options: ExportSceneOptions = {}): Scene {
  const source = options.background === 'white' ? { ...diagram, backgroundColor: '#ffffff' } : diagram
  const whole = buildScene(source)
  let scene = whole
  if (options.selectionIds !== undefined) {
    const selected = new Set(options.selectionIds)
    const included = new Set(source.entities.filter(entity => {
      let current: Entity | undefined = entity
      while (current) {
        if (selected.has(current.id)) return true
        current = source.entities.find(parent => parent.id === current!.parentId)
      }
      return false
    }).map(entity => entity.id))
    if (!included.size) throw new Error('Select at least one object to export Selection.')
    const entities = source.entities.filter(entity => included.has(entity.id)).map(entity => {
      if (!entity.parentId || included.has(entity.parentId)) return entity
      const absolute = absolutePosition(source, entity.id)
      const { parentId: _parentId, ...root } = entity
      return { ...root, ...absolute }
    })
    const colors = new Set(entities.map(entity => resolveColor(entity.color).main))
    for (const entity of entities) if (entity.status) colors.add(STATUS_STYLES[entity.status].color)
    scene = buildScene({ ...source, entities, connections: source.connections.filter(connection => included.has(connection.from) && included.has(connection.to)), legend: source.legend.filter(entry => colors.has(resolveColor(entry.color).main)) })
    scene.entityBackgrounds = Object.fromEntries(scene.entities.map(entity => [entity.id, whole.entityBackgrounds[entity.id]]))
    scene.connectionBackgrounds = Object.fromEntries(scene.connections.map(connection => [connection.id, whole.connectionBackgrounds[connection.id]]))
  }
  if (options.includeGrid !== undefined) scene = { ...scene, grid: { ...scene.grid, export: options.includeGrid } }
  if (options.aspect !== '16:9') return scene
  const units = Math.ceil(Math.max(scene.width / 16, scene.height / 9))
  const width = units * 16, height = units * 9
  const minX = scene.minX - (width - scene.width) / 2, minY = scene.minY - (height - scene.height) / 2
  return { ...scene, width, height, minX, minY, bounds: { x: minX, y: minY, width, height } }
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

export function entityMarkup(entity: Entity, assets: Assets = {}, background = '#ffffff'): string {
  entity = { ...entity, ...measureEntity(entity) }
  const color = resolveColor(entity.color)
  const text = entityTextGeometry(entity)
  const available = entity.width - text.labelX - (entity.kind === 'text' ? 0 : 16)
  const backdrop = isWhiteBackground(background) ? '#ffffff' : entity.kind === 'boundary' ? compositeColor(color.light, background, 0.62) : entity.kind === 'rectangle' ? color.light : background
  const annotation = textLines(text.labelLines, text.labelX, text.labelY, 13, contrastInk(color.main, backdrop), available, entity.kind === 'boundary' ? 600 : 400) + textLines(text.subtitleLines, text.labelX, text.subtitleY, 11, contrastInk('#768284', backdrop), available)
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

function connectionPaint(background: string) {
  const ink = contrastInk('#6c8587', background, 7)
  return { ink, halo: ink === '#ffffff' ? '#000000' : '#ffffff' }
}

const CONNECTION_STROKE = 2.1

export function connectionMarkup(connection: SceneConnection, background = '#ffffff'): string {
  const prefix = isWhiteBackground(background) ? '' : `dgm-${escapeXml(connection.id)}-`
  const markerEnd = connection.arrow !== 'none' ? `marker-end="url(#${prefix}arrow)"` : ''
  const markerStart = connection.arrow === 'both' ? `marker-start="url(#${prefix}arrow-start)"` : ''
  const size = connectionLabelSize(connection.label)
  const paint = connectionPaint(background)
  const dash = connection.style === 'dashed' ? 'stroke-dasharray="6 5"' : ''
  // A route may cross several fills. Opposite-color outlines keep it visible beyond the sampled label backdrop.
  const halo = isWhiteBackground(background) ? '' : `<path d="${escapeXml(connection.path)}" fill="none" stroke="${paint.halo}" stroke-width="${CONNECTION_STROKE + 2}" ${dash}/>`
  return `${halo}<path d="${escapeXml(connection.path)}" fill="none" stroke="${paint.ink}" stroke-width="${CONNECTION_STROKE}" ${dash} ${markerEnd} ${markerStart}/>${connection.label ? `<rect x="${connection.labelPosition.x - size.width / 2}" y="${connection.labelPosition.y - size.height / 2}" width="${size.width}" height="${size.height}" rx="3" fill="${isWhiteBackground(background) ? 'white' : background}"/>${textLines(wrapText(connection.label, 80), connection.labelPosition.x, connection.labelPosition.y - size.height / 2 + 16, 11, contrastInk('#526b6d', background), size.width - 20, 400, 15, true)}` : ''}`
}

export const MARKERS = '<marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6c8587"/></marker><marker id="arrow-start" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#6c8587"/></marker>'

export function connectionMarkers(connection: SceneConnection, background: string): string {
  if (isWhiteBackground(background)) return ''
  const prefix = `dgm-${escapeXml(connection.id)}-`
  const paint = connectionPaint(background)
  return MARKERS.replaceAll('id="arrow', `id="${prefix}arrow`).replaceAll('#6c8587', paint.ink).replaceAll('/>', ` stroke="${paint.halo}" stroke-width="1.2"/>`)
}

export function sceneLayers(scene: Scene) {
  const { background, boundaries, foreground } = painterOrder(scene.entities)
  return {
    background, boundaries, foreground,
  }
}

export function sceneMetadataMarkup(scene: Scene): string {
  return scene.header.map(block => textLines(block.lines, block.x, block.y, block.size, block.color, block.width, block.weight)).join('') + scene.legendItems.map(item => `<path d="M ${item.x} ${item.y + 8} h 18" stroke="${contrastInk(resolveColor(item.color).main, scene.backgroundColor, 3)}" stroke-width="2"${item.dashed ? ' stroke-dasharray="5 3"' : ''}/>${textLines(item.lines, item.x + 26, item.y + 12, 11, contrastInk('#7c8e90', scene.backgroundColor), item.width - 26)}`).join('')
}

export function gridMarkup(scene: Scene, id: string): { pattern: string; fill: string } {
  const spacing = scene.grid.spacing
  const ink = contrastInk('#c4d2ce', scene.backgroundColor, 3)
  const shape = scene.grid.style === 'dots' ? `<circle cx="0" cy="0" r="1" fill="${ink}"/>` : `<path d="M 0 ${spacing} V 0 H ${spacing}" fill="none" stroke="${ink}" stroke-width="0.5"/>`
  return { pattern: `<pattern id="${id}" x="0" y="0" width="${spacing}" height="${spacing}" patternUnits="userSpaceOnUse" overflow="visible">${shape}</pattern>`, fill: `<rect x="${scene.minX}" y="${scene.minY}" width="${scene.width}" height="${scene.height}" fill="url(#${id})"/>` }
}

export function renderSvg(scene: Scene, assets: Assets = {}, transparent = false, includeGrid = scene.grid.export): string {
  const { background, boundaries, foreground } = sceneLayers(scene)
  const reserved = new Set([...scene.entities, ...scene.connections].map(item => item.id))
  let index = 0
  while (reserved.has(`dgm-grid-${index}`)) index++
  const grid = includeGrid ? gridMarkup(scene, `dgm-grid-${index}`) : { pattern: '', fill: '' }
  const markup = (entity: SceneEntity) => `<g transform="translate(${entity.absolute.x} ${entity.absolute.y})">${entityMarkup(entity, assets, scene.entityBackgrounds[entity.id])}</g>`
  const markers = scene.connections.map(connection => connectionMarkers(connection, scene.connectionBackgrounds[connection.id])).join('')
  const font = assets.fontData && /^data:font\/(?:ttf|otf|woff2?);base64,[a-z\d+/]*={0,2}$/i.test(assets.fontData) ? `@font-face{font-family:Plex;src:url('${assets.fontData}')} ` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${scene.width}" height="${scene.height}" viewBox="${scene.minX} ${scene.minY} ${scene.width} ${scene.height}"><defs>${MARKERS}${markers}${grid.pattern}<style>${font}text{font-family:Plex,'IBM Plex Sans',sans-serif}</style></defs>${transparent ? '' : `<rect x="${scene.minX}" y="${scene.minY}" width="${scene.width}" height="${scene.height}" fill="${isWhiteBackground(scene.backgroundColor) ? 'white' : scene.backgroundColor}"/>`}${grid.fill}${background.map(markup).join('')}${boundaries.map(markup).join('')}${scene.connections.map(connection => connectionMarkup(connection, scene.connectionBackgrounds[connection.id])).join('')}${foreground.map(markup).join('')}${sceneMetadataMarkup(scene)}</svg>`
}

export function pngDimensions(scene: Scene, scale: 1 | 2): { width: number; height: number } {
  const width = scene.width * scale, height = scene.height * scale
  if ((scale !== 1 && scale !== 2) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || !Number.isInteger(width) || !Number.isInteger(height)) throw new Error('PNG dimensions and scale must be positive integers at 1x or 2x.')
  if (width > 8192 || height > 8192 || width * height > 16_777_216) throw new Error('PNG is too large. Export SVG or use 1x resolution.')
  return { width, height }
}