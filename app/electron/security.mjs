import { PRODUCT_NAME, allowsRequest, isStudioUrl } from './policy.mjs'

const securedWindows = new WeakMap()

function allowsFullscreen(contents, details) {
  try {
    if (details?.isMainFrame !== true || !isStudioUrl(details.requestingUrl)) return false
    const window = securedWindows.get(contents)
    if (!window || window.isDestroyed() !== false || contents.isDestroyed() !== false || window.webContents !== contents) return false
    const frame = contents.mainFrame
    if (!frame || frame.isDestroyed() !== false || frame.detached !== false) return false
    return isStudioUrl(contents.getURL()) && isStudioUrl(frame.url) &&
      contents.mainFrame === frame && window.webContents === contents &&
      window.isDestroyed() === false && contents.isDestroyed() === false &&
      frame.isDestroyed() === false && frame.detached === false
  } catch { return false }
}

export function secureSession(session) {
  session.setPermissionRequestHandler((contents, permission, callback, details) => callback(permission === 'fullscreen' && allowsFullscreen(contents, details)))
  session.setPermissionCheckHandler(() => false)
  session.setDevicePermissionHandler(() => false)
  session.webRequest.onBeforeRequest((details, callback) => callback({ cancel: !allowsRequest(details.url) }))
  session.on('will-download', (_event, item) => {
    if (!item.getURL().startsWith('blob:ads://studio/')) {
      item.cancel()
      return
    }
    const mime = item.getMimeType().split(';')[0]
    if (!['application/json', 'image/svg+xml', 'image/png'].includes(mime)) {
      item.cancel()
      return
    }
    item.setSaveDialogOptions({ title: `Save ${PRODUCT_NAME} export`, filters: [{ name: mime === 'application/json' ? 'JSON diagram' : mime === 'image/svg+xml' ? 'SVG image' : 'PNG image', extensions: [mime === 'application/json' ? 'json' : mime === 'image/svg+xml' ? 'svg' : 'png'] }] })
  })
}

export function secureWindow(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  for (const event of ['will-navigate', 'will-redirect']) {
    window.webContents.on(event, (navigation, address) => { if (!isStudioUrl(address)) navigation.preventDefault() })
  }
  window.webContents.on('will-frame-navigate', navigation => { if (!isStudioUrl(navigation.url)) navigation.preventDefault() })
  window.webContents.on('will-attach-webview', event => event.preventDefault())
  securedWindows.set(window.webContents, window)
}