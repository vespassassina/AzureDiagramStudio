import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { createLocalHandler } from '../protocol.mjs'
import { APP_ID, PRODUCT_NAME, PROFILE_NAME, SCHEME_PRIVILEGES, WINDOW_OPTIONS, CSP, allowsRequest, isStudioUrl } from '../policy.mjs'

async function bundle(callback) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'ads-protocol-'))
  const root = path.join(directory, 'dist')
  await mkdir(path.join(root, 'assets'), { recursive: true })
  await writeFile(path.join(root, 'index.html'), '<!doctype html><title>Azure Diagram Studio</title>')
  await writeFile(path.join(root, 'assets', 'worker.js'), 'self.onmessage = () => {}')
  await writeFile(path.join(root, 'assets', 'font.woff2'), 'font')
  await writeFile(path.join(directory, 'secret.txt'), 'NOT FOR THE RENDERER')
  try { await callback(createLocalHandler(root), root, directory) }
  finally { await rm(directory, { recursive: true, force: true }) }
}

test('should_serve_index_assets_and_safe_spa_routes_when_local', async () => bundle(async handler => {
  for (const address of ['ads://studio/', 'ads://studio/index.html', 'ads://studio/workspace/demo']) {
    const response = await handler({ url: address, method: 'GET' })
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type'), /^text\/html/)
    assert.match(await response.text(), /Azure Diagram Studio/)
    assert.equal(response.headers.get('content-security-policy'), CSP)
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff')
  }
  const worker = await handler({ url: 'ads://studio/assets/worker.js?v=1', method: 'GET' })
  assert.equal(worker.status, 200)
  assert.match(worker.headers.get('content-type'), /javascript/)
  const head = await handler({ url: 'ads://studio/assets/font.woff2', method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(head.headers.get('content-type'), 'font/woff2')
  assert.equal(await head.text(), '')
}))

test('should_reject_traversal_and_ambiguous_paths_before_url_normalization', async () => bundle(async handler => {
  const attacks = [
    'ads://studio/../secret.txt', 'ads://studio/assets/../../secret.txt',
    'ads://studio/%2e%2e/secret.txt', 'ads://studio/assets/%2E./secret.txt',
    'ads://studio/assets%2f..%2fsecret.txt', 'ads://studio/assets%5c..%5csecret.txt',
    'ads://studio/%252e%252e/secret.txt', 'ads://studio/%00secret.txt',
    'ads://studio/%ZZ', 'ads://studio//secret.txt', 'ads://studio/C:/secret.txt',
    'ads://studio/assets/file.js:stream', 'ads://studio/assets/file.js.',
    'ads://studio/assets/file.js%20', 'ads://studio/assets/CON.js',
    'ads://studio\\assets\\worker.js', 'ads://user@studio/',
    'ads://studio:80/', 'ads://elsewhere/', 'file:///secret.txt',
    'ads://studio/assets/worker.js?../../secret.txt',
    'ads://studio/assets/worker.js?%2e%2e%2fsecret.txt',
  ]
  for (const url of attacks) {
    const response = await handler({ url, method: 'GET' })
    assert.equal(response.status, 403, url)
    assert.doesNotMatch(await response.text(), /NOT FOR THE RENDERER/)
  }
}))

test('should_reject_unallowlisted_missing_and_non_get_resources', async () => bundle(async handler => {
  for (const url of ['ads://studio/electron/main.mjs', 'ads://studio/package.json', 'ads://studio/src/App.tsx', 'ads://studio/assets/missing.js']) {
    assert.equal((await handler({ url, method: 'GET' })).status, 404, url)
  }
  assert.equal((await handler({ url: 'ads://studio/', method: 'POST' })).status, 405)
}))

test('should_serve_bundled_feature_notices_without_exposing_arbitrary_root_files', async () => bundle(async (handler, root) => {
  for (const name of ['VENDOR-NOTICES.md', 'MICROSOFT-APP-NOTICES.md']) {
    await writeFile(path.join(root, name), 'Unmodified asset notices')
    const response = await handler({ url: `ads://studio/${name}`, method: 'GET' })
    assert.equal(response.status, 200)
    assert.equal(await response.text(), 'Unmodified asset notices')
    assert.equal(response.headers.get('content-security-policy'), CSP)
  }
  await writeFile(path.join(root, 'PRIVATE.md'), 'private')
  assert.equal((await handler({ url: 'ads://studio/PRIVATE.md', method: 'GET' })).status, 404)
}))

test('should_reject_junction_resource_when_it_points_outside_bundle', async () => bundle(async (handler, root, directory) => {
  const outside = path.join(directory, 'outside')
  await mkdir(outside)
  await writeFile(path.join(outside, 'escape.js'), 'NOT FOR THE RENDERER')
  await symlink(outside, path.join(root, 'assets', 'linked'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.equal((await handler({ url: 'ads://studio/assets/linked/escape.js', method: 'GET' })).status, 403)
}))

test('should_keep_renderer_sandboxed_and_origin_secure_without_node_bridge', () => {
  assert.equal(PRODUCT_NAME, 'Azure Diagram Studio')
  assert.equal(PROFILE_NAME, 'AzureDiagramStudio')
  assert.equal(APP_ID, 'com.azurediagramstudio.desktop')
  assert.deepEqual(WINDOW_OPTIONS.webPreferences, { sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false })
  assert.deepEqual(SCHEME_PRIVILEGES, { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true })
  assert.ok(!CSP.includes('unsafe-eval'))
  assert.ok(!CSP.includes('https:'))
  assert.match(CSP, /style-src 'self' 'unsafe-inline'/)
  assert.match(CSP, /worker-src 'self' blob:/)
})

test('should_deny_remote_network_and_external_navigation', () => {
  for (const url of ['https://example.com/', 'http://localhost:5173/', 'ws://localhost/', 'wss://example.com/', 'file:///C:/Windows/win.ini', 'blob:https://example.com/id', 'ads://evil/', 'ads://studio:80/', 'ads://user@studio/']) {
    assert.equal(allowsRequest(url), false, url)
    assert.equal(isStudioUrl(url), false, url)
  }
  for (const url of ['ads://studio/', 'ads://studio/assets/worker.js', 'blob:ads://studio/id', 'data:image/svg+xml;base64,AA==']) assert.equal(allowsRequest(url), true, url)
  assert.equal(isStudioUrl('blob:ads://studio/id'), false)
  assert.equal(isStudioUrl('ads://studio/'), true)
})