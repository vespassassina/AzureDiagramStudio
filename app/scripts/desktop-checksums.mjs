import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const release = fileURLToPath(new URL('../release/', import.meta.url))
const lines = []
for (const architecture of ['arm64', 'x64']) {
  const name = `Azure-Diagram-Studio-0.1.0-win-${architecture}-portable.exe`
  const bytes = await readFile(path.join(release, name))
  assert.equal(bytes.subarray(0, 2).toString(), 'MZ', `${name} must be a Windows executable`)
  assert.ok(bytes.length > 10_000_000, `${name} must bundle the runtime, not be a network bootstrapper`)
  lines.push(`${createHash('sha256').update(bytes).digest('hex')}  ${name}`)
}
await writeFile(path.join(release, 'SHA256SUMS.txt'), lines.join('\n') + '\n')
console.log(lines.join('\n'))