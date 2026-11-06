import { spawn } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const binary = process.platform === 'win32'
  ? path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron.exe')
  : path.join(appRoot, 'node_modules', 'electron', 'dist', 'electron')
const environment = Object.fromEntries(Object.entries(process.env).filter(([key]) => !['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'NODE_PATH'].includes(key.toUpperCase())))
const appData = environment.APPDATA || (process.platform === 'win32' ? path.join(os.homedir(), 'AppData', 'Roaming') : path.join(os.homedir(), '.config'))
const disposableProfile = path.join(appData, `AzureDiagramStudio-headless-${process.pid}-${randomUUID()}`)
environment.ADS_HEADLESS_PROFILE = disposableProfile
const child = spawn(binary, [appRoot, '--headless-cli', ...process.argv.slice(2)], { cwd: appRoot, env: environment, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true })
process.stdin.pipe(child.stdin)
// Electron can emit an empty CRLF while bootstrapping. It is not a CLI result
// and would violate the machine-readable stdout contract on error paths.
let stdout = ''
child.stdout.setEncoding('utf8')
child.stdout.on('data', chunk => {
  stdout += chunk
  const lines = stdout.split(/\r?\n/)
  stdout = lines.pop()
  for (const line of lines) {
    if (line.trim()) process.stdout.write(`${line}\n`)
  }
})
let stderr = ''
child.stderr.setEncoding('utf8')
child.stderr.on('data', chunk => {
  stderr += chunk
  const lines = stderr.split(/\r?\n/)
  stderr = lines.pop()
  for (const line of lines) {
    const status = /^\u001eADS_EXIT:(\d+)$/.exec(line)
    if (status) child.headlessExitCode = Number(status[1])
    else process.stderr.write(`${line}\n`)
  }
})
const stop = signal => { if (!child.killed) child.kill(signal) }
process.once('SIGINT', () => stop('SIGINT'))
process.once('SIGTERM', () => stop('SIGTERM'))
child.once('error', error => { process.stderr.write(`Unable to launch Electron: ${error.message}\n`); process.exitCode = 5 })
child.once('close', async (code, signal) => {
  if (stdout.trim()) process.stdout.write(stdout)
  if (stderr) {
    const status = /^\u001eADS_EXIT:(\d+)$/.exec(stderr)
    if (status) child.headlessExitCode = Number(status[1])
    else process.stderr.write(stderr)
  }
  let exitCode = child.headlessExitCode ?? code ?? (signal ? 5 : 0)
  let cleanupError
  for (let attempt = 0; attempt < 5; attempt++) {
    try { await rm(disposableProfile, { recursive: true, force: true }); cleanupError = undefined; break }
    catch (error) { cleanupError = error; if (attempt < 4) await new Promise(resolve => setTimeout(resolve, 100)) }
  }
  if (cleanupError) {
    process.stderr.write(`Headless disposable profile cleanup failed: ${cleanupError.message}\n`)
    exitCode = 5
  }
  process.exitCode = exitCode
})
