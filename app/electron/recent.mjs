import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { lstat, open, realpath } from 'node:fs/promises'
import { atomicWrite } from './workspace.mjs'

const MAX_WORKBOOK_BYTES = 64 * 1024 * 1024
const MAX_ENTRIES = 20
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

export function createRecentFiles({ profile, persist = atomicWrite, onRecord }) {
  const file = path.join(profile, 'recent-diagrams.json')
  const pending = new Map()
  async function load() {
    let handle
    try {
      handle = await open(file, 'r')
      const buffer = Buffer.alloc(16385)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      if (bytesRead > 16384) throw new Error('Recent diagrams exceed the size limit.')
      const value = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'))
      if (!exact(value, ['version', 'entries']) || value.version !== 1 || !Array.isArray(value.entries) || value.entries.length > MAX_ENTRIES ||
        !value.entries.every(entry => exact(entry, ['id', 'path', 'name', 'savedAt']) && typeof entry.id === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(entry.id) && typeof entry.path === 'string' && path.isAbsolute(entry.path) && typeof entry.name === 'string' && typeof entry.savedAt === 'number' && Number.isFinite(entry.savedAt))) throw new Error('Recent diagrams have an invalid shape.')
      return value.entries
    } catch (error) {
      if (error.code === 'ENOENT') return []
      throw new Error(`Recent diagrams could not be read. Existing history was not changed: ${error.message}`)
    } finally { await handle?.close() }
  }
  async function write(entries) { await persist(file, JSON.stringify({ version: 1, entries }) + '\n') }
  async function list() { return await load() }
  async function record(source, savedAt = Date.now()) {
    if (typeof source !== 'string' || !path.isAbsolute(source) || !Number.isFinite(savedAt)) throw new Error('Invalid recent diagram source.')
    const entries = await load()
    const resolved = await realpath(source)
    const details = await lstat(resolved)
    if (!details.isFile() || details.isSymbolicLink() || details.size > MAX_WORKBOOK_BYTES || path.extname(resolved).toLowerCase() !== '.json') throw new Error('Recent document must be a regular JSON file at most 64 MiB.')
    const previous = entries.find(entry => entry.path === resolved)
    const entry = { id: previous?.id ?? randomUUID().replaceAll('-', ''), path: resolved, name: path.basename(resolved), savedAt }
    await write([entry, ...entries.filter(item => item.path !== resolved)].slice(0, MAX_ENTRIES))
    await onRecord?.(resolved)
    return entry
  }
  async function read(id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('A registered recent diagram ID is required.')
    const entry = (await load()).find(item => item.id === id)
    if (!entry) throw new Error('Recent diagram is not registered.')
    let handle
    try {
      const details = await lstat(entry.path)
      if (!details.isFile() || details.isSymbolicLink() || details.size > MAX_WORKBOOK_BYTES) throw new Error('The original file is missing, unreadable, or exceeds 64 MiB.')
      handle = await open(entry.path, 'r')
      const bytes = Buffer.alloc(details.size)
      const { bytesRead } = await handle.read(bytes, 0, bytes.length, 0)
      if (bytesRead !== details.size) throw new Error('The original file changed while it was read.')
      return { id: entry.id, name: entry.name, source: bytes.toString('utf8') }
    } catch (error) { throw new Error(`Could not reopen original diagram: ${error.message}`) }
    finally { await handle?.close() }
  }
  async function promote(id) {
    if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(id)) throw new Error('A registered recent diagram ID is required.')
    const entry = (await load()).find(item => item.id === id)
    if (!entry) throw new Error('Recent diagram is not registered.')
    return record(entry.path)
  }
  function registerChosen(source) {
    const id = randomUUID().replaceAll('-', '')
    pending.set(id, source)
    if (pending.size > 32) pending.delete(pending.keys().next().value)
    return id
  }
  async function acceptChosen(id) {
    const source = pending.get(id)
    if (!source) throw new Error('Selected diagram is no longer available.')
    pending.delete(id)
    return record(source)
  }
  async function readChosen(id) {
    const source = pending.get(id)
    if (!source) throw new Error('Selected diagram is no longer available.')
    const details = await lstat(source)
    if (!details.isFile() || details.isSymbolicLink() || details.size > MAX_WORKBOOK_BYTES || path.extname(source).toLowerCase() !== '.json') throw new Error('Selected file must be a regular JSON file at most 64 MiB.')
    const handle = await open(source, 'r')
    try { return { id, name: path.basename(source), source: await handle.readFile('utf8') } }
    finally { await handle.close() }
  }
  return { list, record, read, promote, registerChosen, acceptChosen, readChosen }
}

export function registerRecentBridge({ ipcMain, window, recent, dialog }) {
  const active = event => window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && !event.sender.isDestroyed()
  const guarded = (count, action) => async (event, ...args) => {
    if (!active(event)) throw new Error('Untrusted recent-files bridge sender.')
    if (args.length !== count) throw new Error('Invalid recent-files arguments.')
    const result = await action(...args)
    if (!active(event)) throw new Error('Recent-files sender is no longer active.')
    return result
  }
  ipcMain.handle('recent:list', guarded(0, () => recent.list()))
  ipcMain.handle('recent:read', guarded(1, id => recent.read(id)))
  ipcMain.handle('recent:promote', guarded(1, id => recent.promote(id)))
  ipcMain.handle('recent:read-chosen', guarded(1, id => recent.readChosen(id)))
  ipcMain.handle('recent:accept-chosen', guarded(1, id => recent.acceptChosen(id)))
  ipcMain.handle('recent:choose', guarded(0, async () => {
    const selected = await dialog.showOpenDialog(window, { title: 'Open diagram JSON', filters: [{ name: 'Diagram JSON', extensions: ['json'] }], properties: ['openFile'] })
    if (selected.canceled) return { canceled: true }
    if (selected.filePaths?.length !== 1 || typeof selected.filePaths[0] !== 'string' || !path.isAbsolute(selected.filePaths[0])) throw new Error('Invalid diagram selection.')
    return { canceled: false, id: recent.registerChosen(selected.filePaths[0]) }
  }))
}
