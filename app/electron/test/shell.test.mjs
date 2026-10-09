import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { secureSession, secureWindow } from '../security.mjs'
import config from '../../electron-builder.config.cjs'

test('should_deny_permissions_and_remote_requests_in_the_electron_session', () => {
  const callbacks = {}
  const session = {
    setPermissionRequestHandler: callback => { callbacks.permission = callback },
    setPermissionCheckHandler: callback => { callbacks.check = callback },
    setDevicePermissionHandler: callback => { callbacks.device = callback },
    webRequest: { onBeforeRequest: callback => { callbacks.request = callback } },
    on: (event, callback) => { callbacks[event] = callback },
  }
  secureSession(session)
  let allowed = true
  callbacks.permission({}, 'geolocation', result => { allowed = result })
  assert.equal(allowed, false)
  assert.equal(callbacks.check(), false)
  assert.equal(callbacks.device(), false)
  for (const [url, expected] of [['https://example.com', true], ['wss://example.com', true], ['ads://studio/assets/main.js', false], ['blob:ads://studio/id', false]]) {
    callbacks.request({ url }, result => assert.equal(result.cancel, expected))
  }
  let cancelled = false
  callbacks['will-download']({}, { getURL: () => 'https://example.com/evil.exe', cancel: () => { cancelled = true } })
  assert.equal(cancelled, true)
  let options
  callbacks['will-download']({}, { getURL: () => 'blob:ads://studio/id', getMimeType: () => 'image/svg+xml', getFilename: () => 'diagram.svg', setSaveDialogOptions: value => { options = value } })
  assert.equal(options.title, 'Save Azure Diagram Studio export')
})

test('should_block_popups_external_navigation_and_webviews', () => {
  const callbacks = {}
  secureWindow({ webContents: { setWindowOpenHandler: handler => { callbacks.popup = handler }, on: (event, handler) => { callbacks[event] = handler } } })
  assert.deepEqual(callbacks.popup({ url: 'ads://studio/' }), { action: 'deny' })
  for (const event of ['will-navigate', 'will-redirect']) {
    let blocked = false
    callbacks[event]({ preventDefault: () => { blocked = true } }, 'https://example.com')
    assert.equal(blocked, true)
    callbacks[event]({ preventDefault: () => assert.fail('Local navigation blocked') }, 'ads://studio/workspace/demo')
  }
  let prevented = false
  callbacks['will-attach-webview']({ preventDefault: () => { prevented = true } })
  assert.equal(prevented, true)
})

test('should_register_scheme_and_profile_before_ready_and_lock_before_creating_windows', async () => {
  const source = await readFile(new URL('../main.mjs', import.meta.url), 'utf8')
  assert.ok(source.indexOf('protocol.registerSchemesAsPrivileged') < source.indexOf('app.whenReady'))
  assert.ok(source.indexOf("app.setPath('userData'") < source.indexOf('app.whenReady'))
  assert.ok(source.indexOf('app.requestSingleInstanceLock') < source.indexOf('new BrowserWindow'))
  assert.doesNotMatch(source, /preload|ipcMain|remote-debugging|openDevTools|disable-web-security/)
})

test('should_package_both_unsigned_portable_targets_with_exact_identity_and_allowlist', async () => {
  assert.equal(config.appId, 'com.azurediagramstudio.desktop')
  assert.equal(config.productName, 'Azure Diagram Studio')
  assert.equal(config.executableName, 'AzureDiagramStudio')
  assert.equal(config.asar, true)
  assert.deepEqual(config.win.target, ['portable'])
  const metadata = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  assert.match(metadata.scripts['desktop:pack'], /--win --arm64 --publish never && electron-builder.*--win --x64 --publish never/)
  assert.equal(config.win.icon, 'public/branding/app-icon.ico')
  assert.equal(config.artifactName, 'Azure-Diagram-Studio-${version}-win-${arch}-portable.${ext}')
  assert.equal(config.forceCodeSigning, false)
  assert.equal(config.publish, null)
  assert.equal(config.portable.buildUniversalInstaller, false)
  assert.deepEqual(config.files, ['dist/**', 'electron/*.mjs', 'package.json', '!node_modules/**'])
  assert.equal(config.directories.app, '.desktop-stage')
})

test('should_use_stable_profile_by_default_and_standard_explicit_test_profile_switch', async () => {
  const source = await readFile(new URL('../main.mjs', import.meta.url), 'utf8')
  assert.match(source, /app\.commandLine\.getSwitchValue\('user-data-dir'\)/)
  assert.match(source, /app\.getPath\('appData'\)/)
  assert.match(source, /PROFILE_NAME/)
})