import { readFile, realpath, stat } from 'node:fs/promises'
import path from 'node:path'
import { CSP } from './policy.mjs'

const MIME = Object.freeze({
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf',
  '.md': 'text/plain; charset=utf-8', '.txt': 'text/plain; charset=utf-8', '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
})
const headers = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-cache' }
const failure = status => new Response(null, { status, headers })

// Inspect the original spelling before URL can erase dot segments; decode once,
// reject Windows aliases/streams and nested encodings, then choose bundled files.
function resourceName(address) {
  const matched = /^ads:\/\/studio(\/[^?#]*)(?:\?([^#]*))?$/.exec(address)
  if (!matched || /%(?:2f|5c)/i.test(matched[1])) return null
  let pathname, query
  try { pathname = decodeURIComponent(matched[1]); query = decodeURIComponent(matched[2] ?? '') }
  catch { return null }
  if (/[\\%:\u0000-\u001f\u007f]/.test(pathname) || /[\\/%:\u0000-\u001f\u007f]|\.\./.test(query)) return null
  const segments = pathname.slice(1).split('/')
  if (pathname !== '/' && segments.some(segment => !segment || segment === '.' || segment === '..' || !/^[a-zA-Z0-9_. -]+$/.test(segment) || /[. ]$/.test(segment) || /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(segment))) return null
  if (pathname === '/' || pathname === '/index.html' || /^\/workspace(?:\/[a-zA-Z0-9_-]+)*$/.test(pathname)) return 'index.html'
  return pathname.slice(1)
}

function allowedResource(name) {
  return name === 'index.html' || name === 'favicon.svg' || name === 'favicon.ico' || ['THIRD-PARTY-NOTICES.md', 'VENDOR-NOTICES.md', 'MICROSOFT-APP-NOTICES.md'].includes(name) || /^(?:assets|branding|licenses)\//.test(name)
}

// Resolve and compare real paths before reading; junctions and symbolic links may
// never turn an allowlisted resource into a read outside (or elsewhere in) dist.
export function createLocalHandler(bundleRoot) {
  const root = path.resolve(bundleRoot)
  return async request => {
    if (request.method !== 'GET' && request.method !== 'HEAD') return failure(405)
    const name = resourceName(request.url)
    if (name === null) return failure(403)
    if (!allowedResource(name)) return failure(404)
    const mime = MIME[path.extname(name).toLowerCase()] ?? (name.startsWith('licenses/') && !path.extname(name) ? 'text/plain; charset=utf-8' : undefined)
    if (!mime) return failure(404)
    const candidate = path.resolve(root, name)
    try {
      const [actualRoot, actualFile] = await Promise.all([realpath(root), realpath(candidate)])
      const expected = path.join(actualRoot, name)
      const equal = process.platform === 'win32' ? actualFile.toLowerCase() === expected.toLowerCase() : actualFile === expected
      if (!equal || path.relative(actualRoot, actualFile).startsWith('..')) return failure(403)
      const metadata = await stat(actualFile)
      if (!metadata.isFile()) return failure(404)
      return new Response(request.method === 'HEAD' ? null : await readFile(actualFile), { headers: { ...headers, 'Content-Type': mime, 'Content-Length': String(metadata.size) } })
    } catch (error) {
      if (error.code === 'ENOENT' || error.code === 'ENOTDIR') return failure(404)
      console.error('Desktop resource failed', { resource: name, code: error.code ?? 'READ_FAILED' })
      return failure(500)
    }
  }
}