import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { secureSession, secureWindow } from '../security.mjs'
import config from '../../electron-builder.config.cjs'
import { compute7zCompressArgs } from 'app-builder-lib/out/targets/archive.js'

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
  assert.equal(metadata.scripts['desktop:pack:mac'], 'npm run test:desktop && npm run desktop:stage && electron-builder --config electron-builder.config.cjs --mac --arm64 --publish never')
  assert.equal(config.win.icon, 'public/branding/app-icon.ico')
  assert.equal(config.artifactName, 'Azure-Diagram-Studio-${version}-win-${arch}-portable.${ext}')
  assert.deepEqual(config.mac.target, ['zip'])
  assert.equal(config.mac.artifactName, 'Azure-Diagram-Studio-${version}-mac-${arch}.${ext}')
  assert.equal(config.mac.icon, 'public/branding/logo-512.png')
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
