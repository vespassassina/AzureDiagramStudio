import { app, BrowserWindow, Menu, protocol, session, dialog } from 'electron'
import path from 'node:path'
import { APP_ID, PRODUCT_NAME, PROFILE_NAME, STUDIO_URL, SCHEME_PRIVILEGES, WINDOW_OPTIONS } from './policy.mjs'
import { createLocalHandler } from './protocol.mjs'
import { secureSession, secureWindow } from './security.mjs'

protocol.registerSchemesAsPrivileged([{ scheme: 'ads', privileges: SCHEME_PRIVILEGES }])
app.setName(PRODUCT_NAME)
app.setAppUserModelId(APP_ID)
const profileRoot = app.commandLine.getSwitchValue('user-data-dir') || app.getPath('appData')
app.setPath('userData', path.join(profileRoot, PROFILE_NAME))

const ownsProfile = app.requestSingleInstanceLock()
let window
if (!ownsProfile) app.quit()
else {
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
    window = new BrowserWindow({ ...WINDOW_OPTIONS, icon: path.join(root, 'branding', 'app-icon.ico') })
    secureWindow(window)
    window.once('ready-to-show', () => window.show())
    await window.loadURL(STUDIO_URL)
  }).catch(error => {
    console.error('Desktop startup failed', { message: error.message })
    dialog.showErrorBox(PRODUCT_NAME, 'The bundled application could not be opened. Please obtain a fresh portable executable. Your saved diagrams remain in your Windows profile.')
    app.quit()
  })
}