import { deflateSync } from 'node:zlib'

export function fixtureCrc(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export function pngChunk(type: string, data: Uint8Array): Buffer {
  const chunk = Buffer.alloc(data.length + 12)
  chunk.writeUInt32BE(data.length, 0)
  chunk.write(type, 4, 'ascii')
  chunk.set(data, 8)
  chunk.writeUInt32BE(fixtureCrc(chunk.subarray(4, -4)), chunk.length - 4)
  return chunk
}

export function pngBytes(width = 2, height = 1, seed?: number): Buffer {
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 6
  const pixels = Buffer.alloc((width * 4 + 1) * height)
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const offset = row * (width * 4 + 1) + 1 + column * 4
      if (seed === undefined) pixels.set([255, 0, 0, column % 2 ? 0 : 128], offset)
      else for (let channel = 0; channel < 4; channel++) {
        seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
        pixels[offset + channel] = seed >>> 24
      }
    }
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pngChunk('IHDR', header), pngChunk('IDAT', deflateSync(pixels)), pngChunk('IEND', Buffer.alloc(0))])
}

export function iconFixture(width = 2, height = 1, seed?: number) {
  return { name: 'Transparent icon.png', dataUrl: `data:image/png;base64,${pngBytes(width, height, seed).toString('base64')}`, width, height }
}