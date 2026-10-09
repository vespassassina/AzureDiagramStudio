import DOMPurify from 'dompurify'
import { DEFAULT_SVG_ICON_DIMENSION, MAX_SOURCE_ICON_PIXELS, MAX_SVG_ICON_DIMENSION } from './contract.ts'

const SVG_NS = 'http://www.w3.org/2000/svg'
const XLINK_NS = 'http://www.w3.org/1999/xlink'
const allowedTags = ['svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'text', 'tspan', 'title', 'desc', 'symbol', 'use', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'pattern']
const allowedAttributes = ['xmlns', 'xmlns:xlink', 'id', 'width', 'height', 'viewBox', 'preserveAspectRatio', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'd', 'points', 'transform', 'fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'color', 'style', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'dx', 'dy', 'offset', 'stop-color', 'stop-opacity', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'href', 'xlink:href', 'clipPathUnits', 'maskUnits', 'maskContentUnits', 'patternUnits', 'patternContentUnits', 'patternTransform']
const cssProperties = new Set(['fill', 'fill-rule', 'fill-opacity', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-opacity', 'opacity', 'color', 'font-family', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline'])

function parseInertSvg(text: string): XMLDocument {
  if (/<!DOCTYPE|<!ENTITY|<\?/i.test(text)) throw new Error('SVG XML declarations, processing instructions and DTD/entities are not supported; remove them before importing')
  const document = new DOMParser().parseFromString(text, 'image/svg+xml')
  if (document.getElementsByTagName('parsererror').length || document.documentElement.localName !== 'svg' || document.documentElement.namespaceURI !== SVG_NS) throw new Error('SVG is malformed XML or has no SVG namespace/root')
  const elements = document.getElementsByTagName('*')
  if (elements.length > 10000) throw new Error('SVG has too many elements; simplify the original image')
  for (const element of elements) {
    if (element.namespaceURI !== SVG_NS || !allowedTags.includes(element.localName)) throw new Error(`SVG element ${element.localName} is not supported; use passive shapes, not scripts, foreignObject, images, filters or animation`)
    for (const attribute of element.attributes) {
      const name = attribute.name
      const value = attribute.value
      if (attribute.localName.toLowerCase().startsWith('on') || !allowedAttributes.includes(name)) throw new Error(`SVG attribute ${name} is not supported; remove active or external content`)
      if (attribute.namespaceURI && ![XLINK_NS, 'http://www.w3.org/2000/xmlns/'].includes(attribute.namespaceURI)) throw new Error('SVG contains an unsupported attribute namespace')
      if (/url\s*\(|@|\\|\/\*|expression\s*\(|(?:https?|file|data|javascript):/i.test(value) && !name.startsWith('xmlns')) throw new Error('SVG CSS URLs, imports, escapes and external resources are not supported')
      if (attribute.localName === 'href' && !/^#[A-Za-z_][A-Za-z0-9_.:-]*$/.test(value)) throw new Error('SVG href must reference a local fragment, never a remote/data/file resource')
      if (name === 'style') {
        for (const declaration of value.split(';').filter(part => part.trim())) {
          const [property, content, ...extra] = declaration.split(':')
          if (extra.length || !cssProperties.has(property.trim().toLowerCase()) || !content?.trim()) throw new Error('SVG style contains unsupported CSS; use passive presentation attributes')
        }
      }
    }
  }
  return document
}

function length(value: string | null): number | undefined {
  if (value === null) return
  if (!/^\s*(?:\d+(?:\.\d*)?|\.\d+)(?:px)?\s*$/.test(value)) throw new Error('SVG width/height must be positive pixel lengths, not percentages or physical units')
  const result = Number.parseFloat(value)
  if (!(result > 0) || result > MAX_SVG_ICON_DIMENSION) throw new Error('SVG source dimensions must be positive and at most 4096px')
  return result
}

/** Strict XML preflight, bound explicit/viewBox dimensions, sanitize defensively, recheck the sanitized XML, then serialize an inert sized image only. */
export function sanitizeSvgSource(text: string): { text: string; width: number; height: number } {
  const source = parseInertSvg(text)
  const root = source.documentElement
  const viewBox = root.getAttribute('viewBox')
  let boxWidth: number | undefined
  let boxHeight: number | undefined
  if (viewBox !== null) {
    const values = viewBox.trim().split(/[\s,]+/).map(Number)
    if (values.length !== 4 || values.some(value => !Number.isFinite(value)) || values[2] <= 0 || values[3] <= 0 || values.some(value => Math.abs(value) > MAX_SVG_ICON_DIMENSION)) throw new Error('SVG viewBox must have four finite values within 4096 and positive width/height')
    boxWidth = values[2]
    boxHeight = values[3]
  }
  const explicitWidth = length(root.getAttribute('width'))
  const explicitHeight = length(root.getAttribute('height'))
  const width = explicitWidth ?? (explicitHeight && boxWidth && boxHeight ? explicitHeight * boxWidth / boxHeight : boxWidth ?? DEFAULT_SVG_ICON_DIMENSION)
  const height = explicitHeight ?? (explicitWidth && boxWidth && boxHeight ? explicitWidth * boxHeight / boxWidth : boxHeight ?? DEFAULT_SVG_ICON_DIMENSION)
  if (width > MAX_SVG_ICON_DIMENSION || height > MAX_SVG_ICON_DIMENSION || width * height > MAX_SOURCE_ICON_PIXELS) throw new Error('SVG source dimensions exceed 4096px or 16000000 pixels; resize its viewBox')
  root.setAttribute('width', String(width))
  root.setAttribute('height', String(height))
  const sanitized = DOMPurify.sanitize(new XMLSerializer().serializeToString(root), { ALLOWED_TAGS: [...allowedTags], ALLOWED_ATTR: [...allowedAttributes], ALLOW_DATA_ATTR: false, ALLOW_ARIA_ATTR: false, KEEP_CONTENT: false, NAMESPACE: SVG_NS, PARSER_MEDIA_TYPE: 'image/svg+xml', RETURN_TRUSTED_TYPE: false })
  const inert = parseInertSvg(sanitized)
  return { text: new XMLSerializer().serializeToString(inert.documentElement), width, height }
}