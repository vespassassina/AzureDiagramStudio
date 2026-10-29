import path from 'node:path'
import { constants } from 'node:fs'
import { access, lstat, mkdir, open, realpath, rename, rm, stat } from 'node:fs/promises'
import { createHash, randomUUID } from 'node:crypto'
import { trustedSender } from './mcp-bridge.mjs'

const formats = { json: 'application/json', svg: 'image/svg+xml', png: 'image/png', zip: 'application/zip', md: 'text/markdown' }
const MAX_BYTES = 64 * 1024 * 1024
const validRoot = value => typeof value === 'string' && value.length <= 4096 && !/[\0-\x1f]/.test(value) && path.isAbsolute(value)
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

// Write a sibling exclusively, flush it, then replace the preference in one
// rename. A failed operation never changes the active preference.
async function atomicWrite(file, bytes) {
  await mkdir(path.dirname(file), { recursive: true })
  const pending = `${file}.${randomUUID()}.pending`
  let handle
  try {
    handle = await open(pending, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close(); handle = undefined
    await rename(pending, file)
  } finally { await handle?.close(); await rm(pending, { force: true }) }
}
const atomicPreference = (file, value) => atomicWrite(file, JSON.stringify(value) + '\n')

export function createWorkspaceSettings({ profile, documents, dialog, window, persist = atomicPreference }) {
  const file = path.join(profile, 'workspace-settings.json')
  const defaultRoot = path.join(documents, 'AzureDiagramStudio')
  let busy = false
  async function read() {
    let handle
    try {
      handle = await open(file, 'r')
      const buffer = Buffer.alloc(16385)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      if (bytesRead > 16384) throw new Error('Settings exceed the size limit.')
      const value = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'))
      if (!exact(value, ['version', 'root']) || value.version !== 1 || (value.root !== null && !validRoot(value.root))) throw new Error('Invalid settings shape.')
      return { root: value.root ?? defaultRoot, isDefault: value.root === null }
    } catch (error) {
      if (error.code === 'ENOENT') return { root: defaultRoot, isDefault: true }
      throw new Error(`Workspace settings could not be read. Reset explicitly to repair: ${error.message}`)
    } finally { await handle?.close() }
  }
  async function usable(root) {
    try {
      if (!(await stat(root)).isDirectory()) throw new Error('Not a directory.')
      await access(root, constants.W_OK | constants.X_OK)
    } catch (error) { throw new Error(`Workspace root unavailable: ${error.message}`) }
  }
  async function exclusive(action) {
    if (busy) throw new Error('Another workspace operation is in progress.')
    busy = true
    try { return await action() } finally { busy = false }
  }
  function checkActive(active) { if (!active()) throw new Error('Workspace sender is no longer active.') }
  const choose = (active = () => true) => exclusive(async () => {
    checkActive(active)
    const selection = await dialog.showOpenDialog(window, { title: 'Choose workspace root', properties: ['openDirectory', 'createDirectory'] })
    checkActive(active)
    if (selection.canceled) return { canceled: true }
    const root = selection.filePaths?.[0]
    if (selection.filePaths?.length !== 1 || !validRoot(root)) throw new Error('Invalid workspace root selection.')
    await usable(root)
    checkActive(active)
    await persist(file, { version: 1, root })
    return { root, isDefault: false }
  })
  const reset = (active = () => true) => exclusive(async () => {
    checkActive(active)
    await persist(file, { version: 1, root: null })
    return { root: defaultRoot, isDefault: true }
  })

  // Validate before touching disk; derive a fixed hash-only child from identity,
  // never from title/path. Resolve and reject redirected children. Only the
  // native dialog can supply an override path; renderer and MCP cannot.
  const save = (request, active = () => true) => exclusive(async () => {
    checkActive(active)
    if (!exact(request, ['documentId', 'filename', 'mimeType', 'bytes'])) throw new Error('Invalid export arguments.')
    const { documentId, filename, mimeType, bytes } = request
    if (typeof documentId !== 'string' || !/^[a-zA-Z0-9_.:-]{1,128}$/.test(documentId) || ['__proto__', 'prototype', 'constructor'].includes(documentId)) throw new Error('Invalid document identity.')
    if (typeof filename !== 'string' || !/^[a-zA-Z0-9_-][a-zA-Z0-9_.-]{0,100}\.(json|svg|png|zip|md)$/.test(filename) ||
      /^(con|prn|aux|nul|com[0-9]|lpt[0-9])(\.|$)/i.test(filename)) throw new Error('Unsafe export filename.')
    const extension = path.extname(filename).slice(1)
    if (typeof mimeType !== 'string' || mimeType.length > 100 || formats[extension] !== mimeType.split(';')[0]) throw new Error('Invalid export type.')
    if (!(bytes instanceof Uint8Array) || bytes.byteLength < 1 || bytes.byteLength > MAX_BYTES) throw new Error('Invalid export byte bounds.')
    const preference = await read()
    checkActive(active)
    if (preference.isDefault) {
      // Only the app-owned leaf may be created; never fabricate a missing OS
      // Documents root or recreate a missing explicitly selected directory.
      await usable(documents)
      await mkdir(preference.root, { recursive: true })
    }
    await usable(preference.root)
    const root = await realpath(preference.root)
    const directory = path.join(root, `workspace-${createHash('sha256').update(documentId).digest('hex')}`)
    try { await mkdir(directory) } catch (error) { if (error.code !== 'EEXIST') throw error }
    if ((await lstat(directory)).isSymbolicLink() || await realpath(directory) !== directory) throw new Error('Workspace directory was redirected.')
    await usable(directory)
    checkActive(active)
    const result = await dialog.showSaveDialog(window, {
      title: 'Save Azure Diagram Studio export', defaultPath: path.join(directory, filename),
      filters: [{ name: `${extension.toUpperCase()} export`, extensions: [extension] }],
      properties: ['showOverwriteConfirmation'],
    })
    checkActive(active)
    if (result.canceled) return false
    if (!validRoot(result.filePath)) throw new Error('No valid save destination was selected.')
    // Atomic replacement preserves an existing file if writing fails. Reject
    // special files/links before writing; no destructive usability probes.
    try {
      const destination = await lstat(result.filePath)
      if (!destination.isFile() || destination.isSymbolicLink()) throw new Error('Save destination is not a regular file.')
    } catch (error) { if (error.code !== 'ENOENT') throw error }
    checkActive(active)
    await atomicWrite(result.filePath, bytes)
    return true
  })
  return { read, choose, reset, save }
}

export function registerWorkspaceBridge({ ipcMain, window, settings }) {
  for (const [operation, count] of [['read', 0], ['choose', 0], ['reset', 0], ['save', 1]]) {
    ipcMain.handle(`workspace:${operation}`, (event, ...args) => {
      if (!trustedSender(window, event)) throw new Error('Untrusted workspace bridge sender.')
      if (args.length !== count) throw new Error('Invalid workspace arguments.')
      return settings[operation](...args, () => trustedSender(window, event))
    })
  }
}
