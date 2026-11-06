import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { createRecentFiles } from '../recent.mjs'

async function fixture() {
  const parent = path.resolve('test-results', 'dgm149-owner')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(path.join(parent, 'recent-'))
  await mkdir(path.join(root, 'profile'))
  return { root, recent: createRecentFiles({ profile: path.join(root, 'profile') }) }
}

test('should_retain_twenty_newest_distinct_originals_when_restarted', async () => {
  const f = await fixture()
  for (let index = 0; index < 21; index++) {
    const file = path.join(f.root, `same-${index}.json`)
    await writeFile(file, '{}')
    await f.recent.record(file, index + 1)
  }
  const listed = await f.recent.list()
  assert.equal(listed.length, 20)
  assert.equal(listed[0].name, 'same-20.json')
  await f.recent.record(path.join(f.root, 'same-1.json'), 30)
  assert.deepEqual((await f.recent.list()).slice(0, 2).map(item => item.name), ['same-1.json', 'same-20.json'])
  const restarted = createRecentFiles({ profile: path.join(f.root, 'profile') })
  assert.equal((await restarted.list()).length, 20)
})

test('should_read_only_registered_ids_and_preserve_store_when_invalid_file_fails', async () => {
  const f = await fixture()
  const source = path.join(f.root, 'diagram.json')
  await writeFile(source, '{"document":true}')
  await f.recent.record(source, 1)
  const entry = (await f.recent.list())[0]
  const read = await f.recent.read(entry.id)
  assert.equal(read.name, 'diagram.json')
  assert.equal(read.source, '{"document":true}')
  await assert.rejects(() => f.recent.read(source), /registered/i)
  // DGM-151A: raw reads allow a 64 MiB workbook root; the renderer parser still
  // rejects any standalone Diagram over 5 MiB (workbook.test.ts).
  await writeFile(source, 'x'.repeat(5 * 1024 * 1024 + 1))
  assert.equal((await f.recent.read(entry.id)).source.length, 5 * 1024 * 1024 + 1)
  await writeFile(source, 'x'.repeat(64 * 1024 * 1024 + 1))
  await assert.rejects(() => f.recent.read(entry.id), /64 MiB/i)
  assert.deepEqual(await f.recent.list(), [entry])
})

test('should_promote_only_a_registered_original_after_a_successful_reopen', async () => {
  const f = await fixture()
  const first = path.join(f.root, 'first.json'), second = path.join(f.root, 'second.json')
  await writeFile(first, '{}'); await writeFile(second, '{}')
  const firstEntry = await f.recent.record(first, 1)
  await f.recent.record(second, 2)
  await f.recent.read(firstEntry.id)
  await f.recent.promote(firstEntry.id)
  assert.deepEqual((await f.recent.list()).map(entry => entry.name), ['first.json', 'second.json'])
  await assert.rejects(() => f.recent.promote('not-registered'), /registered/i)
})

test('should_reject_corrupt_store_without_overwriting_existing_bytes', async () => {
  const f = await fixture()
  const store = path.join(f.root, 'profile', 'recent-diagrams.json')
  await writeFile(store, '{broken')
  await assert.rejects(() => f.recent.list(), /Recent diagrams/i)
  const before = await (await import('node:fs/promises')).readFile(store, 'utf8')
  await assert.rejects(() => f.recent.record(path.join(f.root, 'x.json'), 1), /Recent diagrams/i)
  assert.equal(await (await import('node:fs/promises')).readFile(store, 'utf8'), before)
})
