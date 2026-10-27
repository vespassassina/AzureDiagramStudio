import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { secureSession, secureWindow } from '../security.mjs'
import config from '../../electron-builder.config.cjs'
import { compute7zCompressArgs } from 'app-builder-lib/out/targets/archive.js'

function sessionHandlers() {
  const callbacks = {}
  const session = {
    setPermissionRequestHandler: callback => { callbacks.permission = callback },
    setPermissionCheckHandler: callback => { callbacks.check = callback },
    setDevicePermissionHandler: callback => { callbacks.device = callback },
    webRequest: { onBeforeRequest: callback => { callbacks.request = callback } },
    on: (event, callback) => { callbacks[event] = callback },
  }
  secureSession(session)
  return callbacks
}

function studioWindow(registered = true) {
  const frame = { url: 'ads://studio/', isDestroyed: () => false, detached: false }
  const contents = {
    mainFrame: frame, getURL: () => 'ads://studio/', isDestroyed: () => false,
    setWindowOpenHandler: () => {}, on: () => {},
  }
  const window = { webContents: contents, isDestroyed: () => false }
  if (registered) secureWindow(window)
  return { window, contents, frame }
}

function assertPermission(callbacks, contents, permission, details, expected, label = 'permission callback result and count') {
  const results = []
  callbacks.permission(contents, permission, result => { results.push(result) }, details)
  assert.deepEqual(results, [expected], label)
}

test('should_allow_fullscreen_when_the_registered_live_studio_main_frame_requests_it', () => {
  const callbacks = sessionHandlers()
  const { contents } = studioWindow()
  assertPermission(callbacks, contents, 'fullscreen', { isMainFrame: true, requestingUrl: 'ads://studio/' }, true)
})

test('should_deny_fullscreen_when_contents_are_not_the_registered_window_identity', () => {
  const callbacks = sessionHandlers()
  const details = { isMainFrame: true, requestingUrl: 'ads://studio/' }
  const unregistered = studioWindow(false)
  assertPermission(callbacks, unregistered.contents, 'fullscreen', details, false, 'no registered app window')
  const registered = studioWindow()
  assertPermission(callbacks, studioWindow(false).contents, 'fullscreen', details, false, 'foreign contents at the same URL')
  registered.window.webContents = unregistered.contents
  assertPermission(callbacks, registered.contents, 'fullscreen', details, false, 'window no longer owns contents')
  for (const contents of [null, undefined, {}]) {
    assertPermission(callbacks, contents, 'fullscreen', details, false, 'missing contents identity')
  }
})

test('should_deny_fullscreen_when_main_frame_request_details_are_missing_or_not_strict', () => {
  const callbacks = sessionHandlers()
  const { contents } = studioWindow()
  for (const details of [undefined, null, {}, { requestingUrl: 'ads://studio/' }, { isMainFrame: true }]) {
    assertPermission(callbacks, contents, 'fullscreen', details, false, 'missing request provenance')
  }
  for (const isMainFrame of [false, undefined, null, 0, 1, 'true', {}, []]) {
    assertPermission(callbacks, contents, 'fullscreen', { isMainFrame, requestingUrl: 'ads://studio/' }, false, `isMainFrame ${String(isMainFrame)}`)
  }
})

test('should_deny_fullscreen_when_any_request_contents_or_frame_url_is_untrusted', () => {
  const callbacks = sessionHandlers()
  const addresses = [
    undefined, null, '', {}, 'not a URL', 'https://studio/', 'https://example.com/',
    'data:text/html,studio', 'blob:ads://studio/id', 'ads://foreign/', 'ads://studio.evil/',
    'ads://user@studio/', 'ads://user:secret@studio/', 'ads://studio:443/', 'ads://studio:80/',
    'file:///studio/', 'about:blank',
  ]
  for (const address of addresses) {
    for (const source of ['request', 'contents', 'frame']) {
      const { contents, frame } = studioWindow()
      const details = { isMainFrame: true, requestingUrl: 'ads://studio/' }
      if (source === 'request') details.requestingUrl = address
      if (source === 'contents') contents.getURL = () => address
      if (source === 'frame') frame.url = address
      assertPermission(callbacks, contents, 'fullscreen', details, false, `${source}: ${String(address)}`)
    }
  }
})

test('should_deny_fullscreen_when_live_window_contents_or_frame_provenance_is_missing_or_destroyed', () => {
  const callbacks = sessionHandlers()
  const details = { isMainFrame: true, requestingUrl: 'ads://studio/' }
  for (const target of ['window', 'contents', 'frame']) {
    for (const state of [true, undefined, null, 0, 'false']) {
      const fixture = studioWindow()
      fixture[target].isDestroyed = () => state
      assertPermission(callbacks, fixture.contents, 'fullscreen', details, false, `${target} destruction state ${String(state)}`)
    }
    const fixture = studioWindow()
    delete fixture[target].isDestroyed
    assertPermission(callbacks, fixture.contents, 'fullscreen', details, false, `${target} missing isDestroyed`)
  }
  for (const detached of [true, undefined, null, 0, 'false']) {
    const { contents, frame } = studioWindow()
    frame.detached = detached
    assertPermission(callbacks, contents, 'fullscreen', details, false, `detached ${String(detached)}`)
  }
  for (const mainFrame of [null, undefined, {}]) {
    const { contents } = studioWindow()
    contents.mainFrame = mainFrame
    assertPermission(callbacks, contents, 'fullscreen', details, false, 'missing live frame')
  }
  const { contents } = studioWindow()
  delete contents.getURL
  assertPermission(callbacks, contents, 'fullscreen', details, false, 'missing current contents URL')
})

test('should_deny_fullscreen_once_when_live_provenance_access_throws', () => {
  const callbacks = sessionHandlers()
  for (const [target, property] of [
    ['window', 'isDestroyed'], ['window', 'webContents'], ['contents', 'isDestroyed'],
    ['contents', 'mainFrame'], ['contents', 'getURL'], ['frame', 'isDestroyed'],
    ['frame', 'url'], ['frame', 'detached'],
  ]) {
    const fixture = studioWindow()
    Object.defineProperty(fixture[target], property, { get: () => { throw new Error('Destroyed during access') } })
    assertPermission(callbacks, fixture.contents, 'fullscreen', { isMainFrame: true, requestingUrl: 'ads://studio/' }, false, `${target}.${property} getter throws`)
  }
  for (const target of ['window', 'contents', 'frame']) {
    const fixture = studioWindow()
    fixture[target].isDestroyed = () => { throw new Error('Destroyed during call') }
    assertPermission(callbacks, fixture.contents, 'fullscreen', { isMainFrame: true, requestingUrl: 'ads://studio/' }, false, `${target}.isDestroyed throws`)
  }
  const { contents } = studioWindow()
  contents.getURL = () => { throw new Error('Destroyed before URL lookup') }
  assertPermission(callbacks, contents, 'fullscreen', { isMainFrame: true, requestingUrl: 'ads://studio/' }, false, 'getURL throws')
  for (const property of ['isMainFrame', 'requestingUrl']) {
    const details = { isMainFrame: true, requestingUrl: 'ads://studio/' }
    Object.defineProperty(details, property, { get: () => { throw new Error('Unavailable request provenance') } })
    assertPermission(callbacks, contents, 'fullscreen', details, false, `${property} throws`)
  }
})

test('should_deny_fullscreen_when_window_or_frame_identity_changes_during_validation', () => {
  const callbacks = sessionHandlers()
  const details = { isMainFrame: true, requestingUrl: 'ads://studio/' }
  for (const target of ['window', 'contents', 'frame']) {
    const fixture = studioWindow()
    fixture.contents.getURL = () => {
      fixture[target].isDestroyed = () => true
      return 'ads://studio/'
    }
    assertPermission(callbacks, fixture.contents, 'fullscreen', details, false, `${target} destroyed during URL lookup`)
  }
  for (const change of ['window', 'frame', 'detached']) {
    const fixture = studioWindow()
    fixture.contents.getURL = () => {
      if (change === 'window') fixture.window.webContents = studioWindow(false).contents
      if (change === 'frame') fixture.contents.mainFrame = studioWindow(false).frame
      if (change === 'detached') fixture.frame.detached = true
      return 'ads://studio/'
    }
    assertPermission(callbacks, fixture.contents, 'fullscreen', details, false, `${change} changed during URL lookup`)
  }
})

test('should_deny_other_permissions_automatic_fullscreen_checks_and_devices_even_when_trusted', () => {
  const callbacks = sessionHandlers()
  const { contents } = studioWindow()
  const details = { isMainFrame: true, requestingUrl: 'ads://studio/' }
  const permissions = [
    'automatic-fullscreen', 'clipboard-read', 'clipboard-sanitized-write', 'display-capture',
    'geolocation', 'idle-detection', 'media', 'mediaKeySystem', 'midi', 'midiSysex',
    'notifications', 'pointerLock', 'keyboardLock', 'openExternal', 'speaker-selection',
    'storage-access', 'top-level-storage-access', 'window-management', 'unknown', 'fileSystem',
    'hid', 'serial', 'usb', 'deprecated-sync-clipboard-read', '', null, undefined,
  ]
  for (const permission of permissions) assertPermission(callbacks, contents, permission, details, false, String(permission))
  for (const candidate of [contents, studioWindow(false).contents, null, undefined]) {
    for (const permission of ['fullscreen', ...permissions]) {
      assert.equal(callbacks.check(candidate, permission, 'ads://studio/', details), false)
    }
  }
  for (const deviceType of ['hid', 'serial', 'usb', 'unknown']) {
    assert.equal(callbacks.device({ deviceType, origin: 'ads://studio/', device: {} }), false)
  }
  assert.equal(callbacks.device(), false)
})

test('should_not_retry_the_fullscreen_callback_when_the_callback_itself_throws', () => {
  const callbacks = sessionHandlers()
  const { contents } = studioWindow()
  const failure = new Error('Callback failed')
  const results = []
  assert.throws(() => callbacks.permission(contents, 'fullscreen', result => {
    results.push(result)
    throw failure
  }, { isMainFrame: true, requestingUrl: 'ads://studio/' }), error => error === failure)
  assert.deepEqual(results, [true])
})

test('should_deny_permissions_and_remote_requests_in_the_electron_session', () => {
  const callbacks = sessionHandlers()
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
  assert.doesNotMatch(source, /remote-debugging|openDevTools|disable-web-security/)
  assert.match(source, /preload: path\.join\(app\.getAppPath\(\), 'electron', 'preload\.cjs'\)/)
  assert.match(source, /webPreferences: \{ \.\.\.WINDOW_OPTIONS\.webPreferences, preload:/)
  assert.ok(source.indexOf('if (!ownsProfile) app.quit()') < source.indexOf('createMcpServer({'))
  assert.ok(source.indexOf('await mcp.start()') < source.indexOf('new BrowserWindow'))
  assert.match(source, /mcp\.stop\(\)\.finally/)
})

test('should_package_both_unsigned_portable_targets_with_exact_identity_and_allowlist', async () => {
  assert.equal(config.appId, 'com.azurediagramstudio.desktop')
  assert.equal(config.productName, 'Azure Diagram Studio')
  assert.equal(config.executableName, 'AzureDiagramStudio')
  assert.equal(config.asar, true)
  assert.deepEqual(config.win.target, ['portable'])
  const metadata = JSON.parse(await readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  assert.match(metadata.scripts['desktop:pack'], /--win --arm64 --publish never && electron-builder.*--win --x64 --publish never/)
  assert.equal(metadata.scripts['desktop:pack:mac'], 'npm run test:desktop && npm run desktop:stage && electron-builder --config electron-builder.config.cjs --mac --arm64 --publish never')
  assert.equal(config.win.icon, 'public/branding/app-icon.ico')
  assert.equal(config.artifactName, 'Azure-Diagram-Studio-${version}-win-${arch}-portable.${ext}')
  assert.deepEqual(config.mac.target, ['zip'])
  assert.equal(config.mac.artifactName, 'Azure-Diagram-Studio-${version}-mac-${arch}.${ext}')
  assert.equal(config.mac.icon, 'public/branding/logo-512.png')
  assert.equal(config.forceCodeSigning, false)
  assert.equal(config.publish, null)
  assert.equal(config.portable.buildUniversalInstaller, false)
  assert.deepEqual(config.files, ['dist/**', 'electron/*.mjs', 'electron/preload.cjs', 'package.json', '!node_modules/**'])
  assert.equal(config.directories.app, '.desktop-stage')
})

test('should_use_stable_profile_by_default_and_standard_explicit_test_profile_switch', async () => {
  const source = await readFile(new URL('../main.mjs', import.meta.url), 'utf8')
  assert.match(source, /app\.commandLine\.getSwitchValue\('user-data-dir'\)/)
  assert.match(source, /app\.getPath\('appData'\)/)
  assert.match(source, /PROFILE_NAME/)
})

test('should_resolve_current_package_version_and_report_it_when_verifying_desktop', async () => {
  const source = await readFile(new URL('../../scripts/verify-desktop.mjs', import.meta.url), 'utf8')
  assert.match(source, /const metadata = JSON\.parse\(await readFile\(path\.join\(root, 'package.json'\), 'utf8'\)\)/)
  assert.ok(source.includes('`Azure-Diagram-Studio-${metadata.version}-win-${architecture}-portable.exe`'))
  assert.match(source, /const report = \{[^\n]*version: metadata\.version/)
  assert.match(source, /appVersion: app\.getVersion\(\)/)
  assert.match(source, /assert\.equal\(identity\.appVersion, metadata\.version\)/)
  assert.doesNotMatch(source, /Azure-Diagram-Studio-\d+\.\d+\.\d+-win-/)
})

test('should_choose_blank_at_each_new_diagram_site_when_the_current_chooser_opens', async () => {
  const source = await readFile(new URL('../../scripts/verify-desktop.mjs', import.meta.url), 'utf8')
  const chooser = await readFile(new URL('../../src/editor/EditorSurface.tsx', import.meta.url), 'utf8')
  assert.match(chooser, /<h2 id=\{titleId\}>New diagram<\/h2>/)
  assert.match(chooser, /aria-label="Blank"[^>]*onClick=\{\(\) => onChoose\(null\)\}/)
  const sites = [...source.matchAll(/await page\.getByRole\('button', \{ name: 'New diagram', exact: true \}\)\.click\(\)/g)]
  assert.equal(sites.length, 3)
  for (const site of sites) {
    assert.match(source.slice(site.index + site[0].length), /^\s*await page\.getByRole\('dialog', \{ name: 'New diagram', exact: true \}\)\.getByRole\('button', \{ name: 'Blank', exact: true \}\)\.click\(\)/)
  }
})

test('should_use_current_exact_export_names_in_the_export_dialog_when_downloading', async () => {
  const source = await readFile(new URL('../../scripts/verify-desktop.mjs', import.meta.url), 'utf8')
  const dialog = await readFile(new URL('../../src/editor/ExportDialog.tsx', import.meta.url), 'utf8')
  assert.match(dialog, /<h2 id=\{`\$\{id\}-title`\}>Export diagram<\/h2>/)
  assert.ok(dialog.includes("aria-label={action.format === 'svg' ? 'Export SVG' : `Export PNG ${action.scale}x`}"))
  const control = "page.getByRole('dialog', { name: 'Export diagram', exact: true }).getByRole('button', { name: format === 'svg' ? 'Export SVG' : 'Export PNG 1x', exact: true })"
  assert.equal(source.split(control).length - 1, 3)
  assert.equal(source.split("name: format === 'svg' ? 'Export SVG' : 'Export PNG 1x'").length - 1, 3)
})

test('should_explicitly_commit_the_title_when_verifying_durable_desktop_edits', async () => {
  const source = await readFile(new URL('../../scripts/verify-desktop.mjs', import.meta.url), 'utf8')
  const editTitle = source.slice(source.indexOf('async function editTitle('), source.indexOf('async function openJson('))
  assert.match(editTitle, /\.fill\(title\)\s+await page\.getByLabel\('Document title', \{ exact: true \}\)\.press\('Enter'\)\s+await saved\(page\)/)
  assert.doesNotMatch(editTitle, /\.press\('Tab'\)/)
  assert.ok(source.includes('assert.equal((await durable(page)).title, `Desktop offline ${architecture}`)'))
})

test('should_avoid_native_arm64_archive_filters_when_building_nsis_portables', () => {
  assert.ok(compute7zCompressArgs('7z', { compression: config.compression }).includes('-mx=0'))
})

function macConfigWith(certificate) {
  const require = createRequire(import.meta.url)
  const file = require.resolve('../../electron-builder.config.cjs')
  const saved = process.env.CSC_LINK
  try {
    if (certificate === undefined) delete process.env.CSC_LINK
    else process.env.CSC_LINK = certificate
    delete require.cache[file]
    return require(file).mac
  } finally {
    if (saved === undefined) delete process.env.CSC_LINK
    else process.env.CSC_LINK = saved
    delete require.cache[file]
  }
}

test('should_sign_mac_ad_hoc_without_hardened_runtime_when_no_certificate_is_supplied', () => {
  for (const certificate of [undefined, '']) {
    const mac = macConfigWith(certificate)
    assert.equal(mac.identity, '-')
    assert.equal(mac.hardenedRuntime, false)
  }
})

test('should_sign_mac_with_supplied_developer_id_and_hardened_runtime_for_notarization', () => {
  const mac = macConfigWith('/secure/developer-id.p12')
  assert.equal(mac.identity, undefined)
  assert.equal(mac.hardenedRuntime, true)
})
