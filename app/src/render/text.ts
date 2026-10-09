import { wrapText } from '../model.ts'

export function escapeXml(text: string): string {
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/g, '\ufffd').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]!)
}

export function textWidth(text: string, size: number): number {
  return Array.from(text).reduce((width, character) => width + (/[MWmw@%&#~]/.test(character) ? 1 : /[ilI.,'!:;|\s]/.test(character) ? 0.35 : /[^\u0000-\u007f]/.test(character) ? 1 : /[A-Z]/.test(character) ? 0.85 : 0.65) * size, 0)
}

export function connectionLabelSize(label: string): { width: number; height: number } {
  const lines = wrapText(label, 80)
  return { width: Math.min(600, Math.ceil(Math.max(...lines.map(line => textWidth(line, 11)))) + 20), height: Math.max(24, lines.length * 15 + 8) }
}

export function textLines(lines: string[], x: number, y: number, size: number, color: string, width: number, weight = 400, lineHeight = size + 4, centered = false): string {
  return lines.map((line, index) => {
    const fit = textWidth(line, size) > width ? ` textLength="${Math.max(1, width)}" lengthAdjust="spacingAndGlyphs"` : ''
    return `<text x="${x}" y="${y + index * lineHeight}" fill="${color}" font-size="${size}" font-weight="${weight}"${centered ? ' text-anchor="middle"' : ''}${fit}>${escapeXml(line)}</text>`
  }).join('')
}