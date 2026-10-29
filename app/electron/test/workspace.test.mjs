import assert from 'node:assert/strict'
import { test } from 'node:test'
import path from 'node:path'
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { createWorkspaceSettings, registerWorkspaceBridge } from '../workspace.mjs'

async function fixture(t, options = {}) {
  const parent = path.resolve('test-results', 'dgm138-owner', 'unit')
  await mkdir(parent, { recursive: true })
  const root = await mkdtemp(path.join(parent, 'owned-'))
  const documents = path.join(root, 'OS Documents')
  await mkdir(documents)
  let chosen, destination, cancelSave = false
  const calls = []
  const dialog = {
    showOpenDialog: async () => ({ canceled: !chosen, filePaths: chosen ? [chosen] : [] }),
    showSaveDialog: async (_window, options) => {
      calls.push(options)
      return { canceled: cancelSave, filePath: destination ?? options.defaultPath }
    },
  }
  const settings = createWorkspaceSettings({ profile: path.join(root, 'profile'), documents, dialog, ...options })
  return { root, documents, settings, calls, choose: value => { chosen = value }, override: value => { destination = value }, cancel: () => { cancelSave = true } }
}
const request = (documentId = 'same-title-1', filename = 'Diagram.json') => ({ documentId, filename, mimeType: 'application/json', bytes: new Uint8Array([123, 125]) })

test('should_resolve_OS_documents_lazily_and_persist_explicit_choices_across_restart', async t => {
  const f = await fixture(t)
  assert.deepEqual(await f.settings.read(), { root: path.join(f.documents, 'AzureDiagramStudio'), isDefault: true })
  assert.deepEqual(await readdir(f.documents), [])
  assert.equal((await f.settings.choose()).canceled, true)
  const custom = path.join(f.root, 'custom')
  await mkdir(custom)
  f.choose(custom)
  assert.equal((await f.settings.choose()).root, custom)
  const restarted = createWorkspaceSettings({ profile: path.join(f.root, 'profile'), documents: f.documents })
  assert.equal((await restarted.read()).root, custom)
  assert.equal((await restarted.reset()).isDefault, true)
  assert.equal((await f.settings.read()).isDefault, true)
  assert.deepEqual(await readdir(custom), [])
})

test('should_use_stable_distinct_bounded_workspaces_and_native_dialog_override_and_cancel', async t => {
  const f = await fixture(t)
  await f.settings.save(request())
  await f.settings.save(request('same-title-2'))
  await f.settings.save(request('same-title-1', 'Renamed.json'))
  const defaults = f.calls.map(call => call.defaultPath)
  assert.equal(path.dirname(defaults[0]), path.dirname(defaults[2]))
  assert.notEqual(path.dirname(defaults[0]), path.dirname(defaults[1]))
  assert.ok(defaults.every(file => file.startsWith(path.join(f.documents, 'AzureDiagramStudio') + path.sep)))
  f.override(path.join(f.root, 'explicit-override.json'))
  assert.equal(await f.settings.save(request()), true)
  assert.equal(await readFile(path.join(f.root, 'explicit-override.json'), 'utf8'), '{}')
  f.cancel()
  assert.equal(await f.settings.save(request()), false)
  for (const [mimeType, filename] of [['image/svg+xml', 'x.svg'], ['image/png', 'x.png'], ['application/zip', 'x.zip'], ['text/markdown;charset=utf-8', 'x.md']]) {
    assert.equal(await f.settings.save({ ...request(), mimeType, filename }), false)
    assert.equal(path.basename(f.calls.at(-1).defaultPath), filename)
  }
})

test('should_reject_unsafe_arguments_corrupt_preferences_and_missing_selected_roots_without_fallback', async t => {
  const f = await fixture(t)
  for (const bad of [{ filename: '../escape.json' }, { filename: 'CON.json' }, { documentId: '../id' }, { mimeType: 'text/html' }, { extra: 'path' }, { bytes: new Uint8Array(0) }]) {
    await assert.rejects(() => f.settings.save({ ...request(), ...bad }))
  }
  assert.equal(f.calls.length, 0)
  assert.deepEqual(await readdir(f.documents), [])
  await mkdir(path.join(f.root, 'profile'))
  await writeFile(path.join(f.root, 'profile', 'workspace-settings.json'), '{broken')
  await assert.rejects(() => f.settings.read(), /settings/i)
  await assert.rejects(() => f.settings.save(request()), /settings/i)
  await f.settings.reset()
  await writeFile(path.join(f.root, 'profile', 'workspace-settings.json'), JSON.stringify({ version: 1, root: path.join(f.root, 'missing') }))
  await assert.rejects(() => f.settings.save(request()), /root/i)
  assert.equal(f.calls.length, 0)
})

test('should_keep_previous_preference_when_atomic_persistence_fails', async t => {
  const f = await fixture(t, { persist: async () => { throw new Error('disk denied') } })
  const custom = path.join(f.root, 'custom')
  await mkdir(custom)
  f.choose(custom)
  await assert.rejects(() => f.settings.choose(), /disk denied/)
  assert.equal((await f.settings.read()).isDefault, true)
})

test('should_refuse_stale_native_completions_without_writing_settings_or_export_bytes', async t => {
  const f = await fixture(t)
  const custom = path.join(f.root, 'custom')
  await mkdir(custom)
  f.choose(custom)
  await assert.rejects(() => f.settings.choose(() => false), /sender|active/i)
  assert.equal((await f.settings.read()).isDefault, true)
  await assert.rejects(() => f.settings.save(request(), () => false), /sender|active/i)
  assert.deepEqual(await readdir(f.documents), [])
})

test('should_preserve_prior_profile_bytes_when_persistence_adapter_rejects', async t => {
  const f = await fixture(t)
  await f.settings.reset()
  const settingsFile = path.join(f.root, 'profile', 'workspace-settings.json')
  const original = await readFile(settingsFile, 'utf8')
  const custom = path.join(f.root, 'custom')
  await mkdir(custom); f.choose(custom)
  // Inject only rename failure through the existing persistence seam, using
  // real profile bytes as the no-change oracle.
  const broken = createWorkspaceSettings({ profile: path.join(f.root, 'profile'), documents: f.documents, dialog: { showOpenDialog: async () => ({ canceled: false, filePaths: [custom] }) }, persist: async () => { throw new Error('rename refused') } })
  await assert.rejects(() => broken.choose(), /rename refused/)
  assert.equal(await readFile(settingsFile, 'utf8'), original)
})

test('should_recheck_sender_after_real_asynchronous_native_dialog_completion', async t => {
  const f = await fixture(t)
  let active = true
  const settings = createWorkspaceSettings({
    profile: path.join(f.root, 'profile'), documents: f.documents,
    dialog: { showSaveDialog: async () => { await Promise.resolve(); active = false; return { canceled: false, filePath: path.join(f.root, 'must-not-write.json') } } },
  })
  await assert.rejects(() => settings.save(request(), () => active), /sender.*active/i)
  await assert.rejects(() => readFile(path.join(f.root, 'must-not-write.json')), { code: 'ENOENT' })
})

test('should_reject_unregistered_subframe_stale_and_extra_IPC_arguments', () => {
  const handlers = new Map()
  const frame = { url: 'ads://studio/', isDestroyed: () => false, detached: false }
  const contents = { mainFrame: frame, getURL: () => 'ads://studio/', isDestroyed: () => false }
  const window = { webContents: contents, isDestroyed: () => false }
  registerWorkspaceBridge({ ipcMain: { handle: (name, callback) => handlers.set(name, callback) }, window, settings: { read: () => 'ok' } })
  const read = handlers.get('workspace:read')
  assert.equal(read({ sender: contents, senderFrame: frame }), 'ok')
  assert.throws(() => read({ sender: contents, senderFrame: { ...frame } }), /Untrusted/)
  assert.throws(() => read({ sender: contents, senderFrame: frame }, '/arbitrary'), /arguments/)
  contents.mainFrame = { ...frame }
  assert.throws(() => read({ sender: contents, senderFrame: frame }), /Untrusted/)
})
