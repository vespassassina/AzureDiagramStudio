import { visualAssets } from './assets.ts'
import { resolveColor, isIconKey } from './catalog.ts'
import { validateCustomIcon } from './custom-icons/contract.ts'
import { entityTextGeometry } from './model.ts'
import { buildExportScene } from './scene.ts'
import { createStoredZip } from './workbook-export.ts'
import type { Diagram, Point } from './model.ts'
import type { Scene, SceneConnection, SceneEntity } from './scene.ts'

/**
 * DGM-152 native, macro-free, editable Visio drawing (.vsdx) writer.
 *
 * Package layout (OPC, Visio 2012 main namespace, deterministic order):
 *   [Content_Types].xml, _rels/.rels, docProps/core.xml, docProps/app.xml,
 *   visio/document.xml (+ _rels), visio/pages/pages.xml (+ _rels),
 *   visio/pages/pageN.xml (+ _rels when icons are embedded), visio/media/imageN.png
 *
 * Every saved page becomes one Visio page in saved order. Entities become
 * editable shapes with real text; boundaries become groups that contain their
 * children; component icons are embedded offline as PNG foreign shapes;
 * connectors are 1-D shapes whose BeginX/EndX are glued through <Connect>
 * records to connection-point rows whose X/Y cells are normalized formulas
 * (Width*f, Height*f) that reproduce the exact editor anchors.
 * Native-Visio interoperability is not claimed until checked in Visio itself.
 */

export const VSDX_MIME = 'application/vnd.ms-visio.drawing'
export type VsdxOptions = {
  title: string
  description?: string
  /** Rasterizes a bundled SVG icon data URL to PNG bytes (renderer canvas). */
  rasterizeIcon(dataUrl: string): Promise<Uint8Array>
}

const NS = 'http://schemas.microsoft.com/office/visio/2012/main'
const REL_NS = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const PACKAGE_REL = 'http://schemas.openxmlformats.org/package/2006/relationships'
const VISIO_REL = 'http://schemas.microsoft.com/visio/2010/relationships'
const PX = 96
const encoder = new TextEncoder()

// XML 1.0 forbids most C0 controls and lone surrogates; drop them before escaping.
const INVALID_XML = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]|[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g
export function xmlText(value: string): string {
  return value.replace(INVALID_XML, '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}
const num = (value: number) => {
  const fixed = Number(value.toFixed(6))
  return Object.is(fixed, -0) ? '0' : String(fixed)
}
const cell = (name: string, value: number | string, formula?: string, unit?: string) =>
  `<Cell N="${name}" V="${typeof value === 'number' ? num(value) : xmlText(value)}"${unit ? ` U="${unit}"` : ''}${formula ? ` F="${xmlText(formula)}"` : ''}/>`
const hex = (color: string) => /^#[0-9a-f]{6}$/i.test(color) ? color.toUpperCase() : /^#[0-9a-f]{3}$/i.test(color) ? `#${[...color.slice(1)].map(c => c + c).join('')}`.toUpperCase() : '#62696C'

type Media = { name: string; bytes: Uint8Array }
type PageContext = {
  scene: Scene
  nextId: number
  sheetIds: Map<string, number>
  /** Connection rows per entity: normalized (fx, fy) in Visio local orientation (y up). */
  anchors: Map<string, { fx: number; fy: number }[]>
  rels: { id: string; target: string }[]
  mediaRel: Map<string, string>
}
type IconSource = { key: string; dataUrl: string; png: boolean }

function rectGeometry(fill: boolean) {
  return `<Section N="Geometry" IX="0">${cell('NoFill', fill ? 0 : 1)}${cell('NoLine', 0)}<Row T="RelMoveTo" IX="1">${cell('X', 0)}${cell('Y', 0)}</Row><Row T="RelLineTo" IX="2">${cell('X', 1)}${cell('Y', 0)}</Row><Row T="RelLineTo" IX="3">${cell('X', 1)}${cell('Y', 1)}</Row><Row T="RelLineTo" IX="4">${cell('X', 0)}${cell('Y', 1)}</Row><Row T="RelLineTo" IX="5">${cell('X', 0)}${cell('Y', 0)}</Row></Section>`
}

// Visio Y grows upward from the page bottom; the editor Y grows downward and may be negative.
const pageX = (scene: Scene, x: number) => (x - scene.minX) / PX
const pageY = (scene: Scene, y: number) => (scene.minY + scene.height - y) / PX

// Pseudocode for anchors:
// 1. Seed four side midpoints so manual reconnection in Visio has targets.
// 2. For every connector endpoint, normalize the exact scene point against the
//    entity box (editor y down -> Visio y up) and reuse an equal row if present.
// 3. Row index k is addressed as Connections.X{k+1} / ToPart 100+k.
function anchorRow(context: PageContext, entity: SceneEntity, point: Point): number {
  const rows = context.anchors.get(entity.id)!
  const fx = Math.min(1, Math.max(0, (point.x - entity.absolute.x) / Math.max(1, entity.width)))
  const fy = Math.min(1, Math.max(0, 1 - (point.y - entity.absolute.y) / Math.max(1, entity.height)))
  const found = rows.findIndex(row => Math.abs(row.fx - fx) < 1e-6 && Math.abs(row.fy - fy) < 1e-6)
  if (found >= 0) return found
  rows.push({ fx, fy })
  return rows.length - 1
}

function connectionSection(rows: { fx: number; fy: number }[], width: number, height: number) {
  return `<Section N="Connection">${rows.map((row, index) => `<Row IX="${index}">${cell('X', row.fx * width / PX, `Width*${num(row.fx)}`)}${cell('Y', row.fy * height / PX, `Height*${num(row.fy)}`)}${cell('DirX', 0)}${cell('DirY', 0)}${cell('Type', 0)}</Row>`).join('')}</Section>`
}

function characterSection(rows: { color: string; size: number; bold: boolean }[]) {
  return `<Section N="Character">${rows.map((row, index) => `<Row IX="${index}">${cell('Font', 'Calibri')}${cell('Color', hex(row.color))}${cell('Size', row.size * 0.75 / 72, undefined, 'PT')}${cell('Style', row.bold ? 1 : 0)}</Row>`).join('')}</Section>`
}

function entityText(entity: SceneEntity) {
  const subtitle = entity.subtitle ? `\n<cp IX="1"/>${xmlText(entity.subtitle)}` : ''
  return `<Text><cp IX="0"/>${xmlText(entity.label)}${subtitle}</Text>`
}

function iconSource(entity: SceneEntity): IconSource | undefined {
  if (entity.kind !== 'component') return undefined
  const custom = validateCustomIcon(entity.customIcon)
  if (custom.ok) return { key: custom.value.dataUrl, dataUrl: custom.value.dataUrl, png: true }
  const key = entity.icon && isIconKey(entity.icon) ? entity.icon : undefined
  const source = key && Object.hasOwn(visualAssets.icons ?? {}, key) ? visualAssets.icons![key] : undefined
  if (!source) return undefined
  return { key: source, dataUrl: source, png: source.startsWith('data:image/png;base64,') }
}

function base64Bytes(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1))
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return bytes
}

async function mediaFor(context: PageContext, source: IconSource, media: Media[], mediaByKey: Map<string, string>, options: VsdxOptions): Promise<string> {
  let name = mediaByKey.get(source.key)
  if (!name) {
    const bytes = source.png ? base64Bytes(source.dataUrl) : await options.rasterizeIcon(source.dataUrl)
    if (!(bytes instanceof Uint8Array) || bytes.length < 8 || ![137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) throw new Error('Visio export could not embed a component icon as PNG.')
    name = `image${media.length + 1}.png`
    media.push({ name, bytes })
    mediaByKey.set(source.key, name)
  }
  let rel = context.mediaRel.get(name)
  if (!rel) {
    rel = `rId${context.rels.length + 1}`
    context.rels.push({ id: rel, target: `../media/${name}` })
    context.mediaRel.set(name, rel)
  }
  return rel
}

// Pseudocode for one entity shape:
// 1. Compute the pin in the parent's coordinate system (page or parent group).
// 2. Emit size, fill/line/state paint, text margins and character runs.
// 3. Emit the connection rows collected earlier (side midpoints + exact anchors).
// 4. Boundaries emit their children inside <Shapes>; components emit an icon child.
async function entityShape(context: PageContext, entity: SceneEntity, parent: SceneEntity | undefined, children: Map<string, SceneEntity[]>, media: Media[], mediaByKey: Map<string, string>, options: VsdxOptions): Promise<string> {
  const id = context.sheetIds.get(entity.id)!
  const { scene } = context
  const pinX = parent ? (entity.absolute.x - parent.absolute.x + entity.width / 2) / PX : pageX(scene, entity.absolute.x + entity.width / 2)
  const pinY = parent ? (parent.absolute.y + parent.height - entity.absolute.y - entity.height / 2) / PX : pageY(scene, entity.absolute.y + entity.height / 2)
  const color = resolveColor(entity.color)
  const paint = entity.stateStyle?.box
  const legacyDashed = entity.legacyState?.dashed
  const dashed = legacyDashed || paint?.lineStyle === 'dashed' ? 2 : paint?.lineStyle === 'dotted' ? 3 : 1
  const text = entityTextGeometry(entity)
  const fill = entity.kind === 'boundary' ? paint?.fill ?? color.light : entity.kind === 'rectangle' ? paint?.fill ?? color.light : entity.kind === 'component' ? paint?.fill ?? '#ffffff' : undefined
  const line = entity.kind === 'boundary' ? paint?.stroke ?? color.main : entity.kind === 'rectangle' ? paint?.stroke ?? color.main : entity.kind === 'component' ? legacyDashed ? '#c49341' : paint?.stroke ?? '#d6dfe1' : undefined
  const textColor = paint?.textColor ?? (entity.kind === 'component' ? '#263637' : color.main)
  const kids = children.get(entity.id) ?? []
  const icon = iconSource(entity)
  const group = entity.kind === 'boundary' || (entity.kind === 'component' && !!icon) || kids.length > 0
  const cells = [
    cell('PinX', pinX), cell('PinY', pinY), cell('Width', entity.width / PX), cell('Height', entity.height / PX),
    cell('LocPinX', entity.width / PX / 2, 'Width*0.5'), cell('LocPinY', entity.height / PX / 2, 'Height*0.5'),
    fill ? cell('FillForegnd', hex(fill)) : cell('FillPattern', 0),
    entity.kind === 'boundary' && !paint?.fill ? cell('FillForegndTrans', 0.38) : '',
    line ? cell('LineColor', hex(line)) : cell('LinePattern', 0),
    line ? cell('LinePattern', dashed) : '',
    line ? cell('LineWeight', (paint?.strokeWidth ?? 1.5) / PX, undefined, 'PT') : '',
    entity.kind === 'text' ? '' : cell('Rounding', (entity.kind === 'boundary' ? 8 : entity.kind === 'component' ? 6 : 4) / PX),
    cell('LeftMargin', text.labelX / PX, undefined, 'PT'), cell('RightMargin', 8 / PX, undefined, 'PT'),
    cell('TopMargin', Math.max(0, text.labelY - 13) / PX, undefined, 'PT'), cell('BottomMargin', 4 / PX, undefined, 'PT'),
    cell('VerticalAlign', 0), group ? cell('SelectMode', 1) : '',
  ].join('')
  const sections = `${characterSection([{ color: textColor, size: 13, bold: entity.kind !== 'text' }, { color: paint?.textColor ?? '#768284', size: 11, bold: false }])}<Section N="Paragraph"><Row IX="0">${cell('HorzAlign', 0)}</Row></Section>${connectionSection(context.anchors.get(entity.id)!, entity.width, entity.height)}${entity.kind === 'text' ? '' : rectGeometry(!!fill)}`
  const name = `${entity.kind}.${id}`
  const userId = `<Section N="User"><Row N="dgmId">${cell('Value', entity.id)}</Row></Section>`
  if (!group) return `<Shape ID="${id}" NameU="${xmlText(name)}" Name="${xmlText(entity.label || name)}" Type="Shape">${cells}${userId}${sections}${entityText(entity)}</Shape>`
  const inner: string[] = []
  if (icon) {
    const rel = await mediaFor(context, icon, media, mediaByKey, options)
    const iconId = context.nextId++
    // Icon box mirrors the editor artwork: x 17..45, y 24..52 from the component's top-left.
    inner.push(`<Shape ID="${iconId}" NameU="icon.${iconId}" Name="Icon" Type="Foreign">${cell('PinX', 31 / PX)}${cell('PinY', (entity.height - 38) / PX)}${cell('Width', 28 / PX)}${cell('Height', 28 / PX)}${cell('LocPinX', 14 / PX, 'Width*0.5')}${cell('LocPinY', 14 / PX, 'Height*0.5')}${cell('ImgOffsetX', 0)}${cell('ImgOffsetY', 0)}${cell('ImgWidth', 28 / PX, 'Width*1')}${cell('ImgHeight', 28 / PX, 'Height*1')}<ForeignData ForeignType="Bitmap" CompressionType="PNG"><Rel r:id="${rel}"/></ForeignData></Shape>`)
  }
  for (const child of kids) inner.push(await entityShape(context, child, entity, children, media, mediaByKey, options))
  return `<Shape ID="${id}" NameU="${xmlText(name)}" Name="${xmlText(entity.label || name)}" Type="Group">${cells}${userId}${sections}${entityText(entity)}<Shapes>${inner.join('')}</Shapes></Shape>`
}

// Pseudocode for one connector:
// 1. Begin/End are the scene endpoints in page inches; Width/Height are the
//    signed deltas so local (0,0) is Begin, matching Visio routable connectors.
// 2. Geometry rows replay the saved route polyline as Width/Height fractions.
// 3. BeginX/EndX formulas reference the glued connection rows; <Connect>
//    records carry the same glue so Visio keeps them attached on move.
function connectorShape(context: PageContext, connection: SceneConnection, entities: Map<string, SceneEntity>): { shape: string; connects: string } {
  const { scene } = context
  const id = context.nextId++
  const from = entities.get(connection.from)!, to = entities.get(connection.to)!
  const points = connection.points ?? [connection.start, connection.end]
  const begin = { x: pageX(scene, points[0].x), y: pageY(scene, points[0].y) }
  const end = { x: pageX(scene, points.at(-1)!.x), y: pageY(scene, points.at(-1)!.y) }
  const width = end.x - begin.x, height = end.y - begin.y
  const sourceRow = anchorRow(context, from, points[0]), targetRow = anchorRow(context, to, points.at(-1)!)
  const fromSheet = context.sheetIds.get(from.id)!, toSheet = context.sheetIds.get(to.id)!
  // Visio's point-glue formula is identical for the X and Y cells; PNT yields a
  // point and each cell takes its own coordinate after PAR maps it to the page.
  const glue = (sheet: number, row: number) => `PAR(PNT(Sheet.${sheet}!Connections.X${row + 1},Sheet.${sheet}!Connections.Y${row + 1}))`
  const override = connection.stateStyle?.connector
  const pattern = override?.lineStyle === 'dashed' || (!override && connection.style === 'dashed') ? 2 : override?.lineStyle === 'dotted' ? 3 : 1
  const fraction = (value: number, total: number, axis: 'Width' | 'Height') => Math.abs(total) > 1e-9 ? `${axis}*${num(value / total)}` : undefined
  const rows = points.map((point, index) => {
    const x = pageX(scene, point.x) - begin.x, y = pageY(scene, point.y) - begin.y
    return `<Row T="${index ? 'LineTo' : 'MoveTo'}" IX="${index + 1}">${cell('X', x, fraction(x, width, 'Width'))}${cell('Y', y, fraction(y, height, 'Height'))}</Row>`
  }).join('')
  const label = connection.label ? `${cell('TxtPinX', pageX(scene, connection.labelPosition.x) - begin.x)}${cell('TxtPinY', pageY(scene, connection.labelPosition.y) - begin.y)}${cell('TxtWidth', 1.6)}${cell('TxtHeight', 0.3)}${cell('TxtLocPinX', 0.8, 'TxtWidth*0.5')}${cell('TxtLocPinY', 0.15, 'TxtHeight*0.5')}` : ''
  const shape = `<Shape ID="${id}" NameU="connector.${id}" Name="${xmlText(connection.label || `Connector ${id}`)}" Type="Shape">` +
    cell('PinX', (begin.x + end.x) / 2, 'GUARD((BeginX+EndX)/2)') + cell('PinY', (begin.y + end.y) / 2, 'GUARD((BeginY+EndY)/2)') +
    cell('Width', width, 'GUARD(EndX-BeginX)') + cell('Height', height, 'GUARD(EndY-BeginY)') +
    cell('LocPinX', width / 2, 'GUARD(Width*0.5)') + cell('LocPinY', height / 2, 'GUARD(Height*0.5)') +
    cell('BeginX', begin.x, glue(fromSheet, sourceRow)) + cell('BeginY', begin.y, glue(fromSheet, sourceRow)) +
    cell('EndX', end.x, glue(toSheet, targetRow)) + cell('EndY', end.y, glue(toSheet, targetRow)) +
    cell('ObjType', 2) + cell('ConFixedCode', 3) +
    cell('LineColor', hex(override?.stroke ?? '#6C8587')) + cell('LineWeight', (override?.strokeWidth ?? 2.1) / PX, undefined, 'PT') + cell('LinePattern', pattern) +
    cell('BeginArrow', connection.arrow === 'both' ? 4 : 0) + cell('EndArrow', connection.arrow === 'none' ? 0 : 4) + label +
    `<Section N="User"><Row N="dgmId">${cell('Value', connection.id)}</Row></Section>` +
    characterSection([{ color: override?.textColor ?? '#526B6D', size: 11, bold: false }]) +
    `<Section N="Geometry" IX="0">${cell('NoFill', 1)}${rows}</Section>` +
    (connection.label ? `<Text>${xmlText(connection.label)}</Text>` : '') + '</Shape>'
  const connects = `<Connect FromSheet="${id}" FromCell="BeginX" FromPart="9" ToSheet="${fromSheet}" ToCell="Connections.X${sourceRow + 1}" ToPart="${100 + sourceRow}"/>` +
    `<Connect FromSheet="${id}" FromCell="EndX" FromPart="12" ToSheet="${toSheet}" ToCell="Connections.X${targetRow + 1}" ToPart="${100 + targetRow}"/>`
  return { shape, connects }
}

function metadataShapes(context: PageContext): string {
  const { scene } = context
  const shapes: string[] = []
  // Background first so it stays behind every editable shape.
  if (scene.backgroundColor !== 'transparent') {
    const id = context.nextId++
    shapes.push(`<Shape ID="${id}" NameU="background.${id}" Name="Background" Type="Shape">${cell('PinX', scene.width / PX / 2)}${cell('PinY', scene.height / PX / 2)}${cell('Width', scene.width / PX)}${cell('Height', scene.height / PX)}${cell('LocPinX', scene.width / PX / 2, 'Width*0.5')}${cell('LocPinY', scene.height / PX / 2, 'Height*0.5')}${cell('FillForegnd', hex(scene.backgroundColor === 'white' ? '#ffffff' : scene.backgroundColor))}${cell('LinePattern', 0)}${rectGeometry(true)}</Shape>`)
  }
  for (const block of scene.header) {
    const id = context.nextId++
    const height = block.lines.length * (block.size + 4) + 4
    shapes.push(`<Shape ID="${id}" NameU="title.${id}" Name="Title" Type="Shape">${cell('PinX', pageX(scene, block.x + block.width / 2))}${cell('PinY', pageY(scene, block.y - block.size + height / 2))}${cell('Width', block.width / PX)}${cell('Height', height / PX)}${cell('LocPinX', block.width / PX / 2, 'Width*0.5')}${cell('LocPinY', height / PX / 2, 'Height*0.5')}${cell('FillPattern', 0)}${cell('LinePattern', 0)}${cell('VerticalAlign', 0)}${characterSection([{ color: block.color, size: block.size, bold: block.weight >= 600 }])}<Section N="Paragraph"><Row IX="0">${cell('HorzAlign', 0)}</Row></Section><Text>${xmlText(block.lines.join('\n'))}</Text></Shape>`)
  }
  for (const item of scene.legendItems) {
    const id = context.nextId++
    const swatch = resolveColor(item.color).main
    shapes.push(`<Shape ID="${id}" NameU="legend.${id}" Name="Legend" Type="Shape">${cell('PinX', pageX(scene, item.x + item.width / 2))}${cell('PinY', pageY(scene, item.y + item.height / 2))}${cell('Width', item.width / PX)}${cell('Height', item.height / PX)}${cell('LocPinX', item.width / PX / 2, 'Width*0.5')}${cell('LocPinY', item.height / PX / 2, 'Height*0.5')}${cell('FillPattern', 0)}${cell('LinePattern', 0)}${cell('LeftMargin', 26 / PX, undefined, 'PT')}${cell('VerticalAlign', 0)}${characterSection([{ color: '#7C8E90', size: 11, bold: false }, { color: '#7C8E90', size: 10, bold: false }])}<Section N="Paragraph"><Row IX="0">${cell('HorzAlign', 0)}</Row></Section><Section N="Geometry" IX="0">${cell('NoFill', 1)}${cell('NoLine', 0)}<Row T="MoveTo" IX="1">${cell('X', 0)}${cell('Y', (item.height - 8) / PX)}</Row><Row T="LineTo" IX="2">${cell('X', 18 / PX)}${cell('Y', (item.height - 8) / PX)}</Row></Section><Text><cp IX="0"/>${xmlText(item.labelLines.join('\n'))}${item.meaningLines.length ? `\n<cp IX="1"/>${xmlText(item.meaningLines.join('\n'))}` : ''}</Text></Shape>`.replace(cell('LinePattern', 0), `${cell('LineColor', hex(swatch))}${cell('LinePattern', item.dashed ? 2 : 1)}${cell('LineWeight', 2 / PX, undefined, 'PT')}`))
  }
  return shapes.join('')
}

async function pageXml(page: Diagram, media: Media[], mediaByKey: Map<string, string>, options: VsdxOptions) {
  // Export whole pages: never a stale selection, include legend/states/header.
  const scene = buildExportScene(page)
  const context: PageContext = { scene, nextId: 1, sheetIds: new Map(), anchors: new Map(), rels: [], mediaRel: new Map() }
  const metadata = metadataShapes(context)
  const entities = new Map(scene.entities.map(entity => [entity.id, entity]))
  for (const entity of scene.entities) {
    context.sheetIds.set(entity.id, context.nextId++)
    context.anchors.set(entity.id, [{ fx: 0.5, fy: 1 }, { fx: 1, fy: 0.5 }, { fx: 0.5, fy: 0 }, { fx: 0, fy: 0.5 }])
  }
  // Connectors are emitted after shapes but must register anchors first so
  // each entity's Connection section already contains every glued row.
  const connectors = scene.connections.filter(connection => entities.has(connection.from) && entities.has(connection.to)).map(connection => connectorShape(context, connection, entities))
  const children = new Map<string, SceneEntity[]>()
  const roots: SceneEntity[] = []
  for (const entity of scene.entities) {
    const parent = entity.parentId ? entities.get(entity.parentId) : undefined
    if (parent && parent.kind === 'boundary') children.set(parent.id, [...children.get(parent.id) ?? [], entity])
    else roots.push(entity)
  }
  const shapes: string[] = []
  for (const entity of roots) shapes.push(await entityShape(context, entity, undefined, children, media, mediaByKey, options))
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<PageContents xmlns="${NS}" xmlns:r="${REL_NS}" xml:space="preserve"><Shapes>${metadata}${shapes.join('')}${connectors.map(item => item.shape).join('')}</Shapes>${connectors.length ? `<Connects>${connectors.map(item => item.connects).join('')}</Connects>` : ''}</PageContents>`
  const rels = context.rels.length ? `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="${PACKAGE_REL}">${context.rels.map(rel => `<Relationship Id="${rel.id}" Type="${VISIO_REL}/image" Target="${rel.target}"/>`).join('')}</Relationships>` : undefined
  return { xml, rels, width: scene.width / PX, height: scene.height / PX }
}

const STYLE_SHEET = `<StyleSheets><StyleSheet ID="0" NameU="No Style" Name="No Style">${[
  cell('EnableLineProps', 1), cell('EnableFillProps', 1), cell('EnableTextProps', 1), cell('HideForApply', 0),
  cell('LineWeight', 0.01041666666666667), cell('LineColor', 0), cell('LinePattern', 1), cell('Rounding', 0), cell('LineCap', 0),
  cell('BeginArrow', 0), cell('EndArrow', 0), cell('BeginArrowSize', 2), cell('EndArrowSize', 2),
  cell('FillForegnd', 1), cell('FillBkgnd', 0), cell('FillPattern', 1), cell('FillForegndTrans', 0),
  cell('LeftMargin', 0.05555555555555555), cell('RightMargin', 0.05555555555555555), cell('TopMargin', 0.05555555555555555), cell('BottomMargin', 0.05555555555555555),
  cell('VerticalAlign', 1), cell('TextBkgnd', 0),
].join('')}<Section N="Character"><Row IX="0">${cell('Font', 'Calibri')}${cell('Color', 0)}${cell('Style', 0)}${cell('Size', 0.1666666666666667)}</Row></Section><Section N="Paragraph"><Row IX="0">${cell('HorzAlign', 1)}</Row></Section></StyleSheet></StyleSheets>`

// Pseudocode for the package:
// 1. Render every page (in saved order) to page XML; collect deduplicated icon media.
// 2. Write the OPC skeleton, pages index and relationships with fixed IDs/order.
// 3. Store all parts through the bounded deterministic ZIP writer (no timestamps).
export async function createVsdx(pages: readonly Diagram[], options: VsdxOptions): Promise<Blob> {
  if (!pages.length) throw new Error('Visio export requires at least one page.')
  const media: Media[] = []
  const mediaByKey = new Map<string, string>()
  const rendered = []
  for (const page of pages) rendered.push(await pageXml(page, media, mediaByKey, options))
  const head = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'
  const contentTypes = `${head}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/><Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>${rendered.map((_, index) => `<Override PartName="/visio/pages/page${index + 1}.xml" ContentType="application/vnd.ms-visio.page+xml"/>`).join('')}<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/></Types>`
  const rootRels = `${head}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${VISIO_REL}/document" Target="visio/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`
  const core = `${head}<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>${xmlText(options.title)}</dc:title>${options.description ? `<dc:description>${xmlText(options.description)}</dc:description>` : ''}</cp:coreProperties>`
  const app = `${head}<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Azure Diagram Studio</Application><Pages>${rendered.length}</Pages></Properties>`
  const documentXml = `${head}<VisioDocument xmlns="${NS}" xmlns:r="${REL_NS}" xml:space="preserve"><DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0"/><Colors/><FaceNames><FaceName NameU="Calibri" UnicodeRanges="-536859905 -1073732485 9 0" CharSets="536871423 0" Panose="2 15 5 2 2 2 4 3 2 4" Flags="325"/></FaceNames>${STYLE_SHEET}</VisioDocument>`
  const documentRels = `${head}<Relationships xmlns="${PACKAGE_REL}"><Relationship Id="rId1" Type="${VISIO_REL}/pages" Target="pages/pages.xml"/></Relationships>`
  // Visio page names must be unique within a document; suffix duplicates by ordinal.
  const used = new Set<string>()
  const names = pages.map((page, index) => {
    let name = (page.title.replace(INVALID_XML, '').trim() || `Page ${index + 1}`).slice(0, 120)
    if (used.has(name.toLowerCase())) name = `${name.slice(0, 110)} (${index + 1})`
    used.add(name.toLowerCase())
    return name
  })
  const pagesXml = `${head}<Pages xmlns="${NS}" xmlns:r="${REL_NS}" xml:space="preserve">${rendered.map((page, index) => `<Page ID="${index}" NameU="${xmlText(names[index])}" Name="${xmlText(names[index])}"><PageSheet LineStyle="0" FillStyle="0" TextStyle="0">${cell('PageWidth', page.width, undefined, 'IN')}${cell('PageHeight', page.height, undefined, 'IN')}${cell('ShdwOffsetX', 0.125)}${cell('ShdwOffsetY', -0.125)}${cell('PageScale', 1, undefined, 'IN')}${cell('DrawingScale', 1, undefined, 'IN')}${cell('DrawingSizeType', 0)}${cell('DrawingScaleType', 0)}${cell('InhibitSnap', 0)}</PageSheet><Rel r:id="rId${index + 1}"/></Page>`).join('')}</Pages>`
  const pagesRels = `${head}<Relationships xmlns="${PACKAGE_REL}">${rendered.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${VISIO_REL}/page" Target="page${index + 1}.xml"/>`).join('')}</Relationships>`
  const text = (name: string, value: string) => ({ name, bytes: encoder.encode(value) })
  const entries = [
    text('[Content_Types].xml', contentTypes), text('_rels/.rels', rootRels), text('docProps/core.xml', core), text('docProps/app.xml', app),
    text('visio/document.xml', documentXml), text('visio/_rels/document.xml.rels', documentRels),
    text('visio/pages/pages.xml', pagesXml), text('visio/pages/_rels/pages.xml.rels', pagesRels),
    ...rendered.flatMap((page, index) => [text(`visio/pages/page${index + 1}.xml`, page.xml), ...(page.rels ? [text(`visio/pages/_rels/page${index + 1}.xml.rels`, page.rels)] : [])]),
    ...media.map(item => ({ name: `visio/media/${item.name}`, bytes: item.bytes })),
  ]
  const zip = createStoredZip(entries)
  return new Blob([zip], { type: VSDX_MIME })
}
