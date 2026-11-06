import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import path from 'node:path'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { test } from 'node:test'
import { createMcpPortSettings } from '../mcp-port-settings.mjs'
import { createMcpServer, DEFAULT_MCP_PORT } from '../mcp.mjs'
import { createSnapshotStore } from '../mcp-bridge.mjs'

async function profile() {
  const parent = path.resolve('test-results', 'dgm161', 'native')
  await mkdir(parent, { recursive: true })
  return mkdtemp(path.join(parent, 'profile-'))
}

test('should_persist_valid_port_and_use_it_across_two_starts_DGM161', async () => {
  const root = await profile()
  const settings = createMcpPortSettings({ profile: root })
  assert.equal(await settings.readPort(), DEFAULT_MCP_PORT)
  const probe = createServer()
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve))
  const port = probe.address().port
  await new Promise(resolve => probe.close(resolve))
  assert.equal(await settings.savePort(port), port)
  const first = createMcpServer({ version: 'test', store: createSnapshotStore(), port: await settings.readPort(), log: () => {} })
  await first.start()
  assert.equal(new URL(first.status().address).port, String(port))
  await first.stop()
  const restarted = createMcpServer({ version: 'test', store: createSnapshotStore(), port: await createMcpPortSettings({ profile: root }).readPort(), log: () => {} })
  await restarted.start()
  assert.equal(new URL(restarted.status().address).port, String(port))
  await restarted.stop()
})

test('should_reject_invalid_corrupt_oversized_and_failed_port_preferences_DGM161', async () => {
  const root = await profile()
  const settings = createMcpPortSettings({ profile: root })
  for (const invalid of [0, -1, 65536, 1.5, NaN, Infinity, '49321', null]) await assert.rejects(() => settings.savePort(invalid), /port|integer|range/i)
  const file = path.join(root, 'mcp-settings.json')
  await writeFile(file, JSON.stringify({ version: 1, port: '49321' }))
  await assert.rejects(() => settings.readPort(), /settings|port|shape/i)
  await writeFile(file, 'x'.repeat(16_385))
  await assert.rejects(() => settings.readPort(), /settings|port|size|limit/i)
  const durable = JSON.stringify({ version: 1, port: 49321 }) + '\n'
  await writeFile(file, durable)
  const broken = createMcpPortSettings({ profile: root, persist: async () => { throw new Error('rename refused') } })
  await assert.rejects(() => broken.savePort(49322), /rename refused/)
  assert.equal(await readFile(file, 'utf8'), durable)
})

test('should_report_occupied_port_without_fallback_DGM161', async t => {
  const blocker = createServer()
  await new Promise(resolve => blocker.listen(0, '127.0.0.1', resolve))
  t.after(() => new Promise(resolve => blocker.close(resolve)))
  const server = createMcpServer({ version: 'test', store: createSnapshotStore(), port: blocker.address().port, log: () => {} })
  await server.start()
  assert.equal(server.status().state, 'error')
  assert.equal(server.status().address, undefined)
})
