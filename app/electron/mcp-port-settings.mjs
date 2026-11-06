import path from 'node:path'
import { open } from 'node:fs/promises'
import { atomicWrite } from './workspace.mjs'
import { DEFAULT_MCP_PORT } from './mcp.mjs'

const MAX_SETTINGS_BYTES = 16 * 1024
const SETTINGS_FILE = 'mcp-settings.json'
const exact = (value, keys) => value !== null && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key))

export function validMcpPort(port) {
  return typeof port === 'number' && Number.isInteger(port) && port >= 1 && port <= 65535
}

// Pseudocode:
// 1. Read one bounded profile-only preference file.
// 2. Use the documented default only when that file is absent.
// 3. Reject malformed or unreadable preferences so a user can explicitly repair them.
// 4. Serialize one save at a time and atomically replace the complete preference.
export function createMcpPortSettings({ profile, persist = async (file, value) => atomicWrite(file, JSON.stringify(value) + '\n') }) {
  const file = path.join(profile, SETTINGS_FILE)
  let busy = false
  async function readPort() {
    let handle
    try {
      handle = await open(file, 'r')
      const buffer = Buffer.alloc(MAX_SETTINGS_BYTES + 1)
      const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0)
      if (bytesRead > MAX_SETTINGS_BYTES) throw new Error('MCP port settings exceed the size limit.')
      const value = JSON.parse(buffer.subarray(0, bytesRead).toString('utf8'))
      if (!exact(value, ['version', 'port']) || value.version !== 1 || !validMcpPort(value.port)) throw new Error('Invalid MCP port settings shape.')
      return value.port
    } catch (error) {
      if (error?.code === 'ENOENT') return DEFAULT_MCP_PORT
      throw new Error(`MCP port settings could not be read. Save a valid port to repair: ${error.message}`)
    } finally { await handle?.close() }
  }
  async function savePort(port) {
    if (!validMcpPort(port)) throw new Error('MCP port must be an integer from 1 through 65535.')
    if (busy) throw new Error('Another MCP port save is in progress.')
    busy = true
    try {
      await persist(file, { version: 1, port })
      return port
    } finally { busy = false }
  }
  return { readPort, savePort }
}
