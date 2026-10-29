import { app, BrowserWindow, Menu, protocol, session, dialog, ipcMain, clipboard } from 'electron'
import path from 'node:path'
import { APP_ID, PRODUCT_NAME, PROFILE_NAME, STUDIO_URL, SCHEME_PRIVILEGES, WINDOW_OPTIONS } from './policy.mjs'
import { createLocalHandler } from './protocol.mjs'
import { secureSession, secureWindow } from './security.mjs'
import { createMcpServer } from './mcp.mjs'
import { createSnapshotStore, createMutationBroker, registerMcpBridge } from './mcp-bridge.mjs'
import { createWorkspaceSettings, registerWorkspaceBridge } from './workspace.mjs'

protocol.registerSchemesAsPrivileged([{ scheme: 'ads', privileges: SCHEME_PRIVILEGES }])
app.setName(PRODUCT_NAME)
app.setAppUserModelId(APP_ID)
const profileRoot = app.commandLine.getSwitchValue('user-data-dir') || app.getPath('appData')
app.setPath('userData', path.join(profileRoot, PROFILE_NAME))

const ownsProfile = app.requestSingleInstanceLock()
let window
if (!ownsProfile) app.quit()
else {
  const store = createSnapshotStore()
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
    await mcp.start()
    window = new BrowserWindow({ ...WINDOW_OPTIONS, webPreferences: { ...WINDOW_OPTIONS.webPreferences, preload: path.join(app.getAppPath(), 'electron', 'preload.cjs') }, icon: path.join(root, 'branding', 'app-icon.ico') })
    secureWindow(window)
    registerMcpBridge({ ipcMain, clipboard, window, server: mcp, store, broker })
    registerWorkspaceBridge({ ipcMain, window, settings: createWorkspaceSettings({ profile: app.getPath('userData'), documents: app.getPath('documents'), dialog, window }) })
    window.once('ready-to-show', () => window.show())
    await window.loadURL(STUDIO_URL)
  }).catch(error => {
    console.error('Desktop startup failed', { message: error.message })
    dialog.showErrorBox(PRODUCT_NAME, 'The bundled application could not be opened. Please obtain a fresh portable executable. Your saved diagrams remain in your Windows profile.')
    app.quit()
  })
}