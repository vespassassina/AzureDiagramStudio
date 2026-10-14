import { resolveColor } from '../catalog.ts'
import type { Entity, Point } from '../model.ts'

export const isHexColor = (value: unknown): value is string => typeof value === 'string' && /^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value)
export const effectiveBackground = (value?: string): string => isHexColor(value) ? value : '#ffffff'
export const fullHex = (value: string): string => value.length === 4 ? `#${[...value.slice(1)].map(character => character.repeat(2)).join('')}` : value
export const isWhiteBackground = (value: string): boolean => fullHex(effectiveBackground(value)).toLowerCase() === '#ffffff'

function channels(color: string): number[] {
  const hex = fullHex(effectiveBackground(color))
  return [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16))
}
function luminance(color: string): number {
  const linear = channels(color).map(channel => {
    const value = channel / 255
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  })
  return linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722
}
export function contrastRatio(foreground: string, background: string): number {
  const first = luminance(foreground), second = luminance(background)
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05)
}

/** Preserve the established white output; elsewhere retain semantic ink only when it meets the contrast target. */
export function contrastInk(preferred: string, background: string, minimum = 4.5): string {
  if (isWhiteBackground(background) || contrastRatio(preferred, background) >= minimum) return preferred
  return contrastRatio('#000000', background) > contrastRatio('#ffffff', background) ? '#000000' : '#ffffff'
}

export function compositeColor(foreground: string, background: string, opacity: number): string {
  const front = channels(foreground), back = channels(background)
  return `#${front.map((channel, index) => Math.round(channel * opacity + back[index] * (1 - opacity)).toString(16).padStart(2, '0')).join('')}`
}

/** Walk the existing paint order until the target; compose only filled shapes covering the sampled text position. */
export function backgroundAt(entities: (Entity & { absolute: Point })[], point: Point, background: string, stopId?: string): string {
  let result = effectiveBackground(background)
  for (const entity of entities) {
    if (entity.id === stopId) break
    if (entity.kind !== 'boundary' && entity.kind !== 'rectangle') continue
    if (point.x < entity.absolute.x || point.y < entity.absolute.y || point.x > entity.absolute.x + entity.width || point.y > entity.absolute.y + entity.height) continue
    result = compositeColor(resolveColor(entity.color).light, result, entity.kind === 'boundary' ? 0.62 : 1)
  }
  return result
}