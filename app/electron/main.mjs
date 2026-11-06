import { app, BrowserWindow, Menu, protocol, session, dialog, ipcMain, clipboard } from 'electron'
import path from 'node:path'
import { APP_ID, PRODUCT_NAME, PROFILE_NAME, STUDIO_URL, SCHEME_PRIVILEGES, WINDOW_OPTIONS } from './policy.mjs'
import { createLocalHandler } from './protocol.mjs'
import { secureSession, secureWindow } from './security.mjs'
import { createMcpServer } from './mcp.mjs'
import { createSnapshotStore, createMutationBroker, registerMcpBridge, trustedSender } from './mcp-bridge.mjs'
import { createPdfRenderer } from './pdf.mjs'
import { createMcpPortSettings } from './mcp-port-settings.mjs'
import { createWorkspaceSettings, registerWorkspaceBridge } from './workspace.mjs'
import { createRecentFiles, registerRecentBridge } from './recent.mjs'
import { runHeadless } from './headless-cli.mjs'

protocol.registerSchemesAsPrivileged([{ scheme: 'ads', privileges: SCHEME_PRIVILEGES }])
app.setName(PRODUCT_NAME)
app.setAppUserModelId(APP_ID)
const headlessIndex = process.argv.indexOf('--headless-cli')
if (headlessIndex >= 0) {
  app.on('window-all-closed', event => event.preventDefault())
  void runHeadless(process.argv.slice(headlessIndex + 1)).then(code => {
    process.exitCode = code
    process.stderr.write(`\u001eADS_EXIT:${code}\n`, () => process.exit(code))
  })
} else {
  const profileRoot = app.commandLine.getSwitchValue('user-data-dir') || app.getPath('appData')
  app.setPath('userData', path.join(profileRoot, PROFILE_NAME))
  const ownsProfile = app.requestSingleInstanceLock()
  let window
  if (!ownsProfile) app.quit()
  else {
  const store = createSnapshotStore()
  const mcpSettings = createMcpPortSettings({ profile: app.getPath('userData') })
  const broker = createMutationBroker({ send: request => {
    if (!window || window.isDestroyed() || window.webContents.isDestroyed()) throw new Error('Renderer unavailable')
    window.webContents.send('mcp:mutation', request)
  }, cancel: id => {
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send('mcp:cancel', id)
  } })
  const mcp = createMcpServer({ version: app.getVersion(), store, mutate: broker.request })
  let quitting = false
  app.on('before-quit', event => {
    if (quitting) return
    event.preventDefault()
    quitting = true
    broker.clear('Desktop app is shutting down.')
    void mcp.stop().finally(() => app.quit())
  })
  app.on('second-instance', () => {
    if (!window) return
    if (window.isMinimized()) window.restore()
    window.show()
    window.focus()
  })
  app.on('window-all-closed', () => app.quit())
  app.whenReady().then(async () => {
    const root = path.join(app.getAppPath(), 'dist')
    secureSession(session.defaultSession)
    await protocol.handle('ads', createLocalHandler(root))
    Menu.setApplicationMenu(null)
    try { await mcp.start(await mcpSettings.readPort()) }
    catch (error) { mcp.reportConfigurationError(error) }
    window = new BrowserWindow({ ...WINDOW_OPTIONS, webPreferences: { ...WINDOW_OPTIONS.webPreferences, preload: path.join(app.getAppPath(), 'electron', 'preload.cjs') }, icon: path.join(root, 'branding', 'app-icon.ico') })
    secureWindow(window)
    registerMcpBridge({ ipcMain, clipboard, window, server: mcp, store, broker, settings: mcpSettings })
    // DGM-151C: structured, data-only PDF jobs from the trusted studio frame only.
    const renderPdf = createPdfRenderer({ BrowserWindow, ipcMain, appPath: app.getAppPath() })
    ipcMain.handle('pdf:render', async (event, job) => {
      if (!trustedSender(window, event)) throw new Error('Untrusted PDF sender')
      return new Uint8Array(await renderPdf(job))
    })
    let workspaceSettings
    const recent = createRecentFiles({ profile: app.getPath('userData'), onRecord: source => workspaceSettings?.markKnownDiagram(source) })
    workspaceSettings = createWorkspaceSettings({ profile: app.getPath('userData'), documents: app.getPath('documents'), dialog, window, recent })
    registerWorkspaceBridge({ ipcMain, window, settings: workspaceSettings })
    registerRecentBridge({ ipcMain, window, dialog, recent })
    window.once('ready-to-show', () => window.show())
    await window.loadURL(STUDIO_URL)
  }).catch(error => {
    console.error('Desktop startup failed', { message: error.message })
    dialog.showErrorBox(PRODUCT_NAME, 'The bundled application could not be opened. Please obtain a fresh portable executable. Your saved diagrams remain in your Windows profile.')
    app.quit()
  })
  }
}