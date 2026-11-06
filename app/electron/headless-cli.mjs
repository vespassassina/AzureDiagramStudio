import { randomUUID } from 'node:crypto'
import { spawn } from 'node:child_process'
import { createReadStream } from 'node:fs'
import { access, mkdir, open, readFile, rename, rm, stat, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { app, BrowserWindow, ipcMain, session } from 'electron'
import { createLocalHandler } from './protocol.mjs'
import { APP_ID, PRODUCT_NAME, PROFILE_NAME, SCHEME_PRIVILEGES } from './policy.mjs'
import { secureSession, secureWindow } from './security.mjs'
import { runStdioMcp } from './headless-mcp.mjs'
import { validateMutation, validateWorkbookOperation } from './mcp-schema.mjs'
import { createPdfRenderer } from './pdf.mjs'

// DGM-151A: a workbook root may reach 64 MiB; the renderer's shared parser still
// refuses a standalone Diagram over 5 MiB and every page over 5 MiB.
const MAX_INPUT_BYTES = 64 * 1024 * 1024
const usage = `Usage: ads <command> [options]

Commands: new validate inspect edit arrange export workbook catalog templates mcp
Run "ads <command> --help" for command options. Results are JSON on stdout.

Workbooks: new --workbook [--title TITLE]; workbook FILE --commands FILE;
--page PAGE_ID selects a page for inspect/edit/arrange/export (required for
workbook inputs); export --scope page|workbook, page formats
svg|png|json|markdown|pdf|vsdx, workbook formats json|zip|pdf|vsdx.
`
class CliError extends Error {
  constructor(code, message) { super(message); this.code = code }
}
const message = error => error instanceof Error ? error.message : String(error)
const fail = (code, text) => { throw new CliError(code, text) }

// Pseudocode:
// 1. Describe each approved command's positional and option grammar.
// 2. Consume every argument once, rejecting unknown, duplicate, or valueless options.
// 3. Check positional cardinality before any file read or renderer startup.
// 4. Leave semantic option values to the command implementation below.
function validateGrammar(args) {
  const command = args[0]
  if (!command) return { informational: true }
  if (command === '--help' || command === '-h') {
    if (args.length !== 1) fail(2, `${command} does not accept additional arguments`)
    return { informational: true }
  }
  if (command === '--version') {
    if (args.length !== 1) fail(2, '--version does not accept options or positional arguments')
    return { informational: true }
  }
  if (args.includes('--help')) {
    if (!['new', 'validate', 'inspect', 'edit', 'arrange', 'export', 'workbook', 'catalog', 'templates', 'mcp'].includes(command)) fail(2, `Unknown command: ${command}`)
    if (args.length !== 2) fail(2, '--help does not accept additional arguments')
    return { informational: true }
  }
  const grammar = {
    new: { positional: 0, options: { '--template': true, '--workbook': false, '--title': true, '--out': true, '--overwrite': false } },
    validate: { positional: 1, options: {} },
    inspect: { positional: 1, options: { '--page': true } },
    edit: { positional: 1, required: ['--commands'], options: { '--commands': true, '--page': true, '--out': true, '--overwrite': false } },
    arrange: { positional: 1, options: { '--direction': true, '--arrangement': true, '--page': true, '--out': true, '--overwrite': false } },
    export: { positional: 1, required: ['--format', '--out'], options: { '--format': true, '--scope': true, '--page': true, '--out': true, '--overwrite': false } },
    workbook: { positional: 1, required: ['--commands'], options: { '--commands': true, '--out': true, '--overwrite': false } },
    catalog: { positional: 1, optionalPositionals: true, options: {} },
    templates: { positional: 0, options: {} },
    mcp: { positional: 0, options: { '--input': true } },
  }[command]
  if (!grammar) fail(2, `Unknown command: ${command}`)
  const seen = new Set()
  let positionalCount = 0
  for (let index = 1; index < args.length; index++) {
    const argument = args[index]
    if (!argument.startsWith('--')) {
      positionalCount++
      continue
    }
    if (!Object.hasOwn(grammar.options, argument)) fail(2, `Unknown or inapplicable option: ${argument}`)
    if (seen.has(argument)) fail(2, `Duplicate option: ${argument}`)
    seen.add(argument)
    if (!grammar.options[argument]) continue
    const value = args[++index]
    if (value === undefined || (value.startsWith('--') && value !== '-')) fail(2, `${argument} requires a value`)
  }
  const maximum = grammar.optionalPositionals ? grammar.positional : grammar.positional
  const minimum = grammar.optionalPositionals ? 0 : grammar.positional
  if (positionalCount < minimum) fail(2, `${command} requires FILE`)
  if (positionalCount > maximum) fail(2, `Unexpected positional argument for ${command}`)
  for (const required of grammar.required ?? []) {
    if (!seen.has(required)) fail(2, `${command} requires ${required} ${required === '--commands' ? 'COMMANDS_FILE' : 'FILE'}`)
  }
  return { informational: false }
}

function option(args, name) {
  const index = args.indexOf(name)
  if (index < 0) return undefined
  if (index === args.length - 1 || args[index + 1].startsWith('--')) fail(2, `${name} requires a value`)
  return args[index + 1]
}
function has(args, name) { return args.includes(name) }
const valueOptions = new Set(['--template', '--out', '--commands', '--direction', '--arrangement', '--format', '--input', '--page', '--scope', '--title'])
function positional(args) {
  return args.filter((value, index) => !value.startsWith('--') && (index === 0 || !valueOptions.has(args[index - 1])))
}
async function readStdin() {
  const chunks = []
  // Electron's main-process stdin facade can miss buffered source-runner data.
  // Use the inherited native descriptor, matching the stdio MCP transport.
  for await (const chunk of createReadStream(null, { fd: 0, autoClose: false })) {
    chunks.push(chunk)
    if (Buffer.concat(chunks).length > MAX_INPUT_BYTES) fail(3, 'Input exceeds 64 MiB')
  }
  return Buffer.concat(chunks).toString('utf8')
}
async function readInput(file) {
  if (file === '-') return readStdin()
  try {
    const info = await stat(file)
    if (!info.isFile()) fail(4, 'Input path is not a file')
    if (info.size > MAX_INPUT_BYTES) fail(3, 'Input exceeds 64 MiB')
    return await readFile(file, 'utf8')
  } catch (error) {
    if (error instanceof CliError) throw error
    fail(error?.code === 'ENOENT' ? 4 : 4, `Cannot read input: ${message(error)}`)
  }
}
async function atomicWrite(file, bytes, overwrite) {
  if (!file || file === '-') fail(2, '--out requires a file path')
  try {
    await access(file)
    if (!overwrite) fail(4, 'Output exists; pass --overwrite to replace it.')
  } catch (error) {
    if (error instanceof CliError) throw error
    if (error?.code !== 'ENOENT') fail(4, `Cannot access output: ${message(error)}`)
  }
  const directory = path.dirname(path.resolve(file))
  const pending = path.join(directory, `.${path.basename(file)}.${randomUUID()}.pending`)
  let handle
  try {
    await mkdir(directory, { recursive: true })
    handle = await open(pending, 'wx', 0o600)
    await handle.writeFile(bytes)
    await handle.sync()
    await handle.close(); handle = undefined
    await rename(pending, file)
  } catch (error) {
    if (error instanceof CliError) throw error
    fail(4, `Cannot write output: ${message(error)}`)
  } finally {
    await handle?.close()
    await rm(pending, { force: true })
  }
}
function emit(value) { process.stdout.write(`${JSON.stringify(value)}\n`) }

function scheduleProfileCleanup(disposableProfile) {
  const helper = spawn(process.execPath, [
    path.join(app.getAppPath(), 'electron', 'headless-profile-cleanup.mjs'),
    disposableProfile,
    String(process.pid),
    app.getPath('appData'),
  ], {
    detached: true,
    stdio: 'ignore',
    windowsHide: true,
    env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
  })
  helper.once('error', error => {
    process.stderr.write(`Headless disposable profile cleanup helper failed to start: ${message(error)}\n`)
  })
  helper.unref()
}

// Pseudocode: run one sandboxed never-visible renderer, exchange only
// request/response data with its active main frame, and dispose its own profile
// and window after the CLI command or stdio EOF completes.
async function createRuntime() {
  const requestedProfile = process.env.ADS_HEADLESS_PROFILE
  const disposableProfile = requestedProfile && path.dirname(requestedProfile) === app.getPath('appData') &&
    path.basename(requestedProfile).startsWith(`${PROFILE_NAME}-headless-`)
    ? requestedProfile
    : path.join(app.getPath('appData'), `${PROFILE_NAME}-headless-${process.pid}-${randomUUID()}`)
  app.setPath('userData', disposableProfile)
  scheduleProfileCleanup(disposableProfile)
  await app.whenReady()
  // An unpersisted session avoids Chromium's default-profile databases and
  // makes the renderer's storage lifetime exactly match this worker.
  const workerSession = session.fromPartition(`headless-${randomUUID()}`, { cache: false })
  secureSession(workerSession)
  await workerSession.protocol.handle('ads', createLocalHandler(path.join(app.getAppPath(), 'dist')))
  const worker = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: true, contextIsolation: true, nodeIntegration: false, webSecurity: true, webviewTag: false,
      session: workerSession,
      preload: path.join(app.getAppPath(), 'electron', 'headless-preload.cjs'),
    },
  })
  secureWindow(worker)
  const pending = new Map()
  const trusted = event => event.sender === worker.webContents && event.senderFrame === worker.webContents.mainFrame &&
    worker.isDestroyed() === false && worker.webContents.isDestroyed() === false && worker.webContents.getURL() === 'ads://studio/headless.html'
  const response = (event, id, result) => {
    if (!trusted(event) || typeof id !== 'string' || !result || typeof result !== 'object') return
    const request = pending.get(id)
    if (!request) return
    pending.delete(id); clearTimeout(request.timer)
    result.ok === true ? request.resolve(result.value) : request.reject(new Error(typeof result.message === 'string' ? result.message : 'Headless worker failed.'))
  }
  ipcMain.on('headless:response', response)
  // DGM-151C: the worker's structured PDF jobs render in a hidden print window
  // on the same disposable session; only the worker's main frame may ask.
  const renderPdf = createPdfRenderer({ BrowserWindow, ipcMain, appPath: app.getAppPath(), session: workerSession })
  ipcMain.handle('headless:pdf', async (event, job) => {
    if (!trusted(event)) throw new Error('Untrusted PDF sender')
    return new Uint8Array(await renderPdf(job))
  })
  await worker.loadURL('ads://studio/headless.html')
  const call = (kind, fields = {}, timeout = 16_000) => new Promise((resolve, reject) => {
    const id = randomUUID()
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Headless worker timed out.')) }, timeout)
    pending.set(id, { resolve, reject, timer })
    worker.webContents.send('headless:request', { id, kind, ...fields })
  })
  return {
    state: () => call('state'),
    catalog: query => call('catalog', { query }),
    templates: () => call('templates'),
    load: text => call('load', { text }),
    mutate: operation => call('mutate', { operation }, operation.name === 'arrange_diagram' ? 16_000 : 5_000),
    output: operation => call('output', { operation }, 5_000),
    select: pageId => call('select', { pageId }),
    // Whole-workbook PDF/Visio rendering is bounded by the worker (65 s) and PDF host.
    workbook: operation => call('workbook', { operation }, operation.name === 'export_workbook' ? 70_000 : 5_000),
    async stop() {
      for (const request of pending.values()) { clearTimeout(request.timer); request.reject(new Error('Headless worker stopped.')) }
      pending.clear()
      ipcMain.off('headless:response', response)
      ipcMain.removeHandler('headless:pdf')
      if (!worker.isDestroyed()) worker.destroy()
      // The source runner owns deletion after Electron's process has exited:
      // Chromium holds default-session journals until that point on Windows.
    },
  }
}

async function load(runtime, file) {
  const text = await readInput(file)
  try { return await runtime.load(text) }
  catch (error) {
    const detail = message(error)
    if (/^(?:Open failed:|Input diagram could not be opened|JSON files must)/i.test(detail)) fail(3, detail)
    throw error
  }
}
function documentOutput(state) { return JSON.stringify(state.document, null, 2) }
// Workbook inputs always write the complete root, never a lone page.
function rootOutput(state) { return JSON.stringify(state.root, null, 2) }
function outputBytes(output) {
  const [payload] = output.content ?? []
  if (payload?.type === 'image') return Buffer.from(payload.data, 'base64')
  if (payload?.type === 'resource') return Buffer.from(payload.resource.blob ?? payload.resource.text ?? '', payload.resource.blob ? 'base64' : 'utf8')
  fail(5, 'Headless renderer returned invalid export output.')
}

async function cli(runtime, args) {
  const command = args[0]
  if (!command || command === '--help' || command === '-h') { process.stdout.write(usage); return }
  if (command === '--version') { process.stdout.write(`${app.getVersion()}\n`); return }
  if (has(args, '--help')) { process.stdout.write(usage); return }
  const rest = args.slice(1)
  if (command === 'catalog') { emit({ ok: true, ...(await runtime.catalog(positional(rest)[0] ?? '')) }); return }
  if (command === 'templates') { emit({ ok: true, ...(await runtime.templates()) }); return }
  if (command === 'mcp') {
    const input = option(rest, '--input')
    if (input) await load(runtime, input)
    await runStdioMcp({ runtime, version: app.getVersion(), stop: () => runtime.stop() })
    return
  }
  if (command === 'new') {
    const template = option(rest, '--template')
    const workbook = has(rest, '--workbook')
    const title = option(rest, '--title')
    if (title !== undefined && !workbook) fail(2, '--title requires --workbook')
    if (template && workbook) fail(2, '--template cannot be combined with --workbook')
    if (title !== undefined && title.length > 120) fail(2, '--title must be at most 120 characters')
    const state = await runtime.state()
    const out = option(rest, '--out')
    if (workbook) {
      // Explicit root creation only: a new workbook with one blank page.
      await runtime.workbook({ name: 'edit_workbook', arguments: { stateToken: state.workbook.stateToken, commands: [{ type: 'newWorkbook', id: `workbook-${randomUUID()}`, pageId: `page-${randomUUID()}`, ...(title === undefined ? {} : { title }) }] } })
      const after = await runtime.state()
      if (out) await atomicWrite(out, rootOutput(after), has(rest, '--overwrite'))
      emit({ ok: true, root: after.root, ...(out ? { output: out } : {}) })
      return
    }
    const next = await runtime.mutate({ name: 'create_diagram', arguments: { stateToken: state.stateToken, ...(template ? { template } : {}) } })
    if (out) await atomicWrite(out, documentOutput(next), has(rest, '--overwrite'))
    emit({ ok: true, document: next.document, ...(out ? { output: out } : {}) })
    return
  }
  if (!['validate', 'inspect', 'edit', 'arrange', 'export', 'workbook'].includes(command)) fail(2, `Unknown command: ${command}`)
  const file = positional(rest)[0]
  if (!file) fail(2, `${command} requires FILE`)
  const opened = await load(runtime, file)
  const isWorkbook = opened.workbook.kind === 'workbook'
  if (command === 'validate') { emit({ ok: true, ...(isWorkbook ? { root: opened.root } : { document: opened.document }) }); return }
  if (command === 'workbook') {
    const commands = await readCommands(rest)
    const operation = { name: 'edit_workbook', arguments: { stateToken: opened.workbook.stateToken, commands } }
    if (!validateWorkbookOperation(operation)) fail(3, 'Invalid workbook command batch.')
    await runtime.workbook(operation)
    const after = await runtime.state()
    const out = option(rest, '--out')
    if (out) await atomicWrite(out, rootOutput(after), has(rest, '--overwrite'))
    emit({ ok: true, root: after.root, ...(out ? { output: out } : {}) }); return
  }
  const pageId = option(rest, '--page')
  const scope = option(rest, '--scope') ?? 'page'
  if (!['page', 'workbook'].includes(scope)) fail(2, '--scope must be page or workbook')
  if (scope === 'workbook' && pageId !== undefined) fail(2, '--page cannot be combined with --scope workbook')
  // Page operations on a workbook must name their page; a legacy Diagram is its own page.
  if (isWorkbook && pageId === undefined && command !== 'inspect' && scope === 'page') fail(2, `${command} on a workbook requires --page PAGE_ID`)
  let state = opened
  if (pageId !== undefined) {
    try { state = await runtime.select(pageId) } catch (error) { fail(3, message(error)) }
  }
  const pageOutput = after => isWorkbook ? rootOutput(after) : documentOutput(after)
  if (command === 'inspect') {
    const summary = { entities: state.document.entities.length, connections: state.document.connections.length, direction: state.document.direction }
    emit({ ok: true, document: state.document, summary, ...(isWorkbook ? { workbook: { id: state.workbook.id, title: state.workbook.title, revision: state.workbook.revision, pages: state.workbook.pages.map(({ id, title }) => ({ id, title })) } } : {}) }); return
  }
  if (command === 'edit') {
    const commands = await readCommands(rest)
    const operation = { name: 'edit_diagram', arguments: { stateToken: state.stateToken, commands } }
    if (!validateMutation(operation)) fail(3, 'Invalid command batch.')
    const next = await runtime.mutate(operation)
    const after = isWorkbook ? await runtime.state() : next
    const out = option(rest, '--out')
    if (out) await atomicWrite(out, pageOutput(after), has(rest, '--overwrite'))
    emit({ ok: true, document: next.document, ...(isWorkbook ? { root: after.root } : {}), ...(out ? { output: out } : {}) }); return
  }
  if (command === 'arrange') {
    const direction = option(rest, '--direction') ?? state.document.direction
    if (!['RIGHT', 'DOWN'].includes(direction)) fail(2, '--direction must be RIGHT or DOWN')
    const arrangement = option(rest, '--arrangement')
    if (arrangement !== undefined && !['standard', 'stacked'].includes(arrangement)) fail(2, '--arrangement must be standard or stacked')
    const next = await runtime.mutate({ name: 'arrange_diagram', arguments: { stateToken: state.stateToken, direction, ...(arrangement ? { arrangement } : {}) } })
    const after = isWorkbook ? await runtime.state() : next
    const out = option(rest, '--out')
    if (out) await atomicWrite(out, pageOutput(after), has(rest, '--overwrite'))
    emit({ ok: true, document: next.document, ...(isWorkbook ? { root: after.root } : {}), ...(out ? { output: out } : {}) }); return
  }
  if (command === 'export') {
    const format = option(rest, '--format')
    const out = option(rest, '--out')
    const formats = scope === 'workbook' ? ['json', 'zip', 'pdf', 'vsdx'] : ['svg', 'png', 'json', 'markdown', 'pdf', 'vsdx']
    if (!formats.includes(format)) fail(2, `export --scope ${scope} requires --format ${formats.join('|')}`)
    if (!out) fail(2, 'export requires --out FILE')
    // The legacy single-diagram path stays byte-identical for its original formats.
    const legacy = !isWorkbook && scope === 'page' && pageId === undefined && ['svg', 'png', 'json', 'markdown'].includes(format)
    const output = legacy
      ? await runtime.output({ name: 'export_diagram', arguments: { stateToken: state.stateToken, format } })
      : await runtime.workbook({ name: 'export_workbook', arguments: scope === 'workbook'
        ? { stateToken: state.workbook.stateToken, scope: 'workbook', format }
        : { stateToken: state.workbook.stateToken, scope: 'page', pageId: state.document.id, format } })
    await atomicWrite(out, outputBytes(output), has(rest, '--overwrite'))
    emit({ ok: true, output: out }); return
  }
  fail(2, `Unknown command: ${command}`)
}

async function readCommands(rest) {
  const commandFile = option(rest, '--commands')
  if (!commandFile) fail(2, 'requires --commands COMMANDS_FILE')
  try { return JSON.parse(await readInput(commandFile)) } catch (error) {
    if (error instanceof CliError && error.code !== 3) throw error
    fail(3, `Invalid command batch: ${message(error)}`)
  }
}
export async function runHeadless(args) {
  let runtime
  try {
    // Help and version are grammar-only responses. Do this before app readiness,
    // profile selection, protocol registration, or worker construction.
    const grammar = validateGrammar(args)
    if (grammar.informational) {
      await cli(undefined, args)
      return 0
    }
    runtime = await createRuntime()
    await cli(runtime, args)
    if (args[0] !== 'mcp') await runtime.stop()
    return 0
  } catch (error) {
    let detail = message(error)
    let cleanupFailure
    if (runtime) {
      try { await runtime.stop() } catch (stopError) { cleanupFailure = message(stopError) }
    }
    if (cleanupFailure) detail = `${detail}; ${cleanupFailure}`
    const code = cleanupFailure ? 5 : error instanceof CliError ? error.code : /stale stateToken/i.test(detail) ? 6 : 5
    process.stderr.write(`${detail}\n`)
    return code
  }
}

export function configureHeadlessApp() {
  protocol.registerSchemesAsPrivileged([{ scheme: 'ads', privileges: SCHEME_PRIVILEGES }])
  app.setName(PRODUCT_NAME)
  app.setAppUserModelId(APP_ID)
}
