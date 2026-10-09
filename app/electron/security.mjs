import { PRODUCT_NAME, allowsRequest, isStudioUrl } from './policy.mjs'

export function secureSession(session) {
  session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))
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
}