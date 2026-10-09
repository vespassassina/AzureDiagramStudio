export const PRODUCT_NAME = 'Azure Diagram Studio'
export const PROFILE_NAME = 'AzureDiagramStudio'
export const APP_ID = 'com.azurediagramstudio.desktop'
export const STUDIO_URL = 'ads://studio/'
export const SCHEME_PRIVILEGES = Object.freeze({ standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true })
export const WINDOW_OPTIONS = Object.freeze({
  width: 1440, height: 960, minWidth: 640, minHeight: 480,
  title: PRODUCT_NAME, backgroundColor: '#f4f8f7', show: false,
  webPreferences: Object.freeze({ sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false }),
})
export const CSP = [
  "default-src 'none'", "script-src 'self'", "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:", "font-src 'self' data:", "connect-src 'self' blob:",
  "worker-src 'self' blob:", "object-src 'none'", "base-uri 'none'",
  "form-action 'none'", "frame-ancestors 'none'",
].join('; ')

export function isStudioUrl(address) {
  if (typeof address !== 'string' || !/^ads:\/\/studio\//.test(address)) return false
  try {
    const url = new URL(address)
    return url.protocol === 'ads:' && url.hostname === 'studio' && !url.port && !url.username && !url.password
  } catch { return false }
}

export function allowsRequest(address) {
  return isStudioUrl(address) || address.startsWith('data:') || (address.startsWith('blob:') && isStudioUrl(address.slice(5)))
}