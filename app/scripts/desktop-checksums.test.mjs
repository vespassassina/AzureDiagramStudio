import assert from 'node:assert/strict'
import { createHash, randomUUID } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { test } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../', import.meta.url))
const version = '0.3.0'
const architectures = ['arm64', 'x64']
const name = architecture => `Azure-Diagram-Studio-${version}-win-${architecture}-portable.exe`
const executable = Buffer.alloc(10_000_001, 0)
executable.write('MZ')

async function withRelease(run) {
  const fixture = path.join(root, 'test-results', 'desktop-checksums', randomUUID())
  await mkdir(path.join(fixture, 'scripts'), { recursive: true })
  await mkdir(path.join(fixture, 'release'))
  try {
    await copyFile(new URL('./desktop-checksums.mjs', import.meta.url), path.join(fixture, 'scripts', 'desktop-checksums.mjs'))
    await writeFile(path.join(fixture, 'package.json'), JSON.stringify({ version }))
    for (const architecture of architectures) await writeFile(path.join(fixture, 'release', name(architecture)), executable)
    const execute = () => spawnSync(process.execPath, [path.join(fixture, 'scripts', 'desktop-checksums.mjs')], { cwd: root, encoding: 'utf8' })
    await run(fixture, execute)
  } finally {
    await rm(fixture, { recursive: true, force: true })
  }
}

test('should_hash_both_current_version_executables_when_release_is_valid', async () => {
  await withRelease(async (fixture, execute) => {
    const result = execute()
    assert.equal(result.status, 0, result.stderr)
    const hash = createHash('sha256').update(executable).digest('hex')
    const expected = architectures.map(architecture => `${hash}  ${name(architecture)}`).join('\n') + '\n'
    assert.equal(await readFile(path.join(fixture, 'release', 'SHA256SUMS.txt'), 'utf8'), expected)
    assert.equal(result.stdout.replaceAll('\r\n', '\n'), expected)
  })
})

for (const architecture of architectures) {
  for (const failure of ['missing', 'invalid signature', 'undersized']) {
    test(`should_reject_${failure.replaceAll(' ', '_')}_exe_when_${architecture}_artifact_is_invalid`, async () => {
      await withRelease(async (fixture, execute) => {
        const artifact = path.join(fixture, 'release', name(architecture))
        if (failure === 'missing') await rm(artifact)
        else {
          const invalid = Buffer.from(executable)
          if (failure === 'invalid signature') invalid.write('NO')
          await writeFile(artifact, failure === 'undersized' ? invalid.subarray(0, 10_000_000) : invalid)
        }
        const result = execute()
        assert.notEqual(result.status, 0, 'invalid releases must not succeed')
        assert.ok(result.stderr.includes(name(architecture)), result.stderr)
        const reason = failure === 'missing' ? 'ENOENT'
          : failure === 'invalid signature' ? 'must be a Windows executable'
            : 'must bundle the runtime, not be a network bootstrapper'
        assert.ok(result.stderr.includes(reason), result.stderr)
        await assert.rejects(readFile(path.join(fixture, 'release', 'SHA256SUMS.txt')), { code: 'ENOENT' })
      })
    })
  }
}
