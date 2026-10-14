import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { execFile } from 'node:child_process'
import { cp, mkdir, mkdtemp, readFile, readdir, stat, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import os from 'node:os'
import path from 'node:path'
import { launchDesktop, closePreservingFailure } from './desktop-driver.mjs'
import { listPackage, extractFile } from '@electron/asar'

const root = fileURLToPath(new URL('../', import.meta.url))
const execute = promisify(execFile)
const output = path.join(root, 'test-results', 'desktop')
const requestedArchitecture = process.argv[2] ?? process.env.DGM_DESKTOP_ARCH
const architectures = requestedArchitecture ? [requestedArchitecture] : ['arm64', 'x64']
const vendors = JSON.parse(await readFile(path.join(root, 'src/vendor-icons/catalog.generated.json'), 'utf8'))
const microsoft = JSON.parse(await readFile(path.join(root, 'src/microsoft-icons/catalog.generated.json'), 'utf8'))
const registry = [...vendors, ...microsoft]
const report = { startedAt: new Date().toISOString(), sourceCommit: (await execute('git', ['-C', root, 'rev-parse', 'HEAD'])).stdout.trim(), driverSha256: createHash('sha256').update(await readFile(path.join(root, 'scripts', 'desktop-driver.mjs'))).digest('hex'), host: { platform: os.platform(), architecture: os.arch(), node: process.version }, targets: [], limitations: ['Unsigned executables may trigger SmartScreen. Native Windows save-dialog appearance requires manual inspection; automation checks its options and saves the resulting DownloadItem.'], passed: false }
await mkdir(output, { recursive: true })

async function saved(page) {
  await page.waitForFunction(() => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device')
}
async function durable(page) {
  await saved(page)
  return page.evaluate(() => new Promise((resolve, reject) => {
    const request = indexedDB.open('diagrammer-v1', 1)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      const database = request.result
      const transaction = database.transaction('documents', 'readonly')
      const read = transaction.objectStore('documents').get('active-document')
      read.onsuccess = () => resolve(read.result)
      read.onerror = () => reject(read.error)
      transaction.oncomplete = () => database.close()
    }
  }))
}
async function closePanels(page) {
  for (const name of ['Close component library', 'Close properties']) {
    const button = page.getByRole('button', { name, exact: true })
    if (await button.isVisible()) await button.click()
  }
}
async function clickNode(page, id) {
  await page.locator(`.react-flow__node[data-id="${id}"]`).click({ position: { x: 18, y: 18 } })
}
async function editTitle(page, title) {
  await page.getByLabel('Document title', { exact: true }).fill(title)
  await page.getByLabel('Document title', { exact: true }).press('Tab')
  await saved(page)
}
async function openJson(page, filename) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: 'Open JSON', exact: true }).click()
  await (await chooser).setFiles(filename)
  await saved(page)
}

// Use the executable, not a dev server or source Electron process. The test
// harness supplies inspector arguments; the distributed shell never does.
async function launch(executable, appData, target) {
  const application = await launchDesktop({ executablePath: executable, cwd: path.dirname(executable), env: { ...process.env }, profileRoot: appData, timeout: 60_000 })
  target.sessions.push(application.diagnostics)
  try {
  const page = await application.firstWindow()
  page.setDefaultTimeout(30_000)
  const errors = []
  application.diagnostics.renderer = { errors, failedRequests: [], consoleErrors: [], externalRequests: [] }
  page.on('request', request => { if (/^(?:https?|wss?):/i.test(request.url())) application.diagnostics.renderer.externalRequests.push(request.url()) })
  page.on('pageerror', error => { if (!error.message.startsWith('ResizeObserver loop')) errors.push(error.message) })
  page.on('requestfailed', request => application.diagnostics.renderer.failedRequests.push({ url: request.url(), error: request.failure()?.errorText }))
  page.on('console', message => { if (message.type() === 'error') application.diagnostics.renderer.consoleErrors.push(message.text()) })
  page.on('dialog', dialog => dialog.accept())
  await page.waitForLoadState('domcontentloaded')
  await page.locator('.react-flow__node').first().waitFor()
  await saved(page)
  await page.evaluate(() => document.fonts.ready)
  const identity = await application.evaluate(({ app, BrowserWindow }) => ({
    packaged: app.isPackaged, name: app.getName(), profile: app.getPath('userData'),
    executable: process.execPath, arch: process.arch, version: process.versions.electron,
    preferences: BrowserWindow.getAllWindows()[0].webContents.getLastWebPreferences(),
  }))
  assert.equal(identity.packaged, true)
  assert.equal(identity.arch, target.architecture)
  assert.equal(identity.name, 'Azure Diagram Studio')
  assert.equal(createHash('sha256').update(await readFile(path.join(path.dirname(identity.executable), 'resources', 'app.asar'))).digest('hex'), target.bundle.sha256, 'Extracted portable runtime must match the verified final ASAR')
  assert.equal(path.basename(identity.profile), 'AzureDiagramStudio')
  assert.ok(identity.profile.toLowerCase().startsWith(appData.toLowerCase()), 'Tests must not modify the real Windows user profile')
  assert.equal(identity.preferences.sandbox, true)
  assert.equal(identity.preferences.contextIsolation, true)
  assert.equal(identity.preferences.nodeIntegration, false)
  assert.equal(identity.preferences.webSecurity, true)
  assert.equal(page.url(), 'ads://studio/')
  assert.equal(await page.title(), 'Azure Diagram Studio')
  assert.deepEqual(await page.evaluate(() => ({ process: typeof process, require: typeof require, Buffer: typeof Buffer, secure: isSecureContext, locks: typeof navigator.locks, idb: typeof indexedDB })), { process: 'undefined', require: 'undefined', Buffer: 'undefined', secure: true, locks: 'object', idb: 'object' })
  assert.equal(await page.evaluate(() => navigator.onLine), false)
  target.offline = { enabledBeforeFirstNavigation: true, requestEmulationBeforeReload: true, explicitChromiumStateAfterReload: true, navigatorOnline: false, customOrigin: page.url() }
  target.font = await page.evaluate(() => ({ family: getComputedStyle(document.body).fontFamily, loaded: document.fonts.check('14px "IBM Plex Sans"') }))
  assert.match(target.font.family, /IBM Plex Sans/)
  assert.equal(target.font.loaded, true)
  target.runtime = identity
  return { application, page, errors }
  } catch (error) {
    await closePreservingFailure(application, error)
  }
}

async function download(application, page, filename, action, target) {
  const destination = path.join(output, filename)
  await application.evaluate((electron, destination) => {
    electron.download = new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Native download timed out')), 30_000)
      electron.session.defaultSession.once('will-download', (_event, item) => {
        const options = item.getSaveDialogOptions()
        item.setSavePath(destination)
        item.once('done', (_event, state) => {
          clearTimeout(timer)
          if (state !== 'completed') reject(new Error(`Native download ${state}`))
          else resolve({ path: item.getSavePath(), options, state })
        })
      })
    })
    electron.download.catch(() => {})
  }, destination)
  await action()
  const completed = await application.evaluate(electron => electron.download)
  assert.equal(completed.options.title, 'Save Azure Diagram Studio export')
  const bytes = await readFile(completed.path)
  if (completed.path !== destination) await writeFile(destination, bytes)
  assert.ok(bytes.length > 30)
  target.downloads.push({ filename, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') })
  return { bytes, destination }
}

async function upload(page, file, name) {
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name, exact: true }).click()
  await (await chooser).setFiles(file)
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Import custom icon"]').disabled)
  await saved(page)
}

async function featureChecks(application, page, architecture, target) {
  target.initialTheme = await page.evaluate(() => ({ systemDark: matchMedia('(prefers-color-scheme: dark)').matches, selected: document.documentElement.dataset.theme }))
  assert.equal(target.initialTheme.selected, target.initialTheme.systemDark ? 'dark' : 'light')
  if (await page.getByRole('button', { name: 'Switch to light theme', exact: true }).isVisible()) await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await page.getByRole('button', { name: 'New diagram', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 0)
  await upload(page, { name: 'desktop-custom.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="512"><path fill="#db2134" d="M0 0h512v512H0z"/><path fill="#117865" d="M512 0h512v512H512z"/></svg>') }, 'Import custom icon')
  const created = await durable(page)
  assert.equal(created.entities.length, 1)
  const custom = created.entities[0]
  assert.equal(custom.customIcon.width, 512)
  assert.equal(custom.customIcon.height, 256)
  assert.match(custom.customIcon.dataUrl, /^data:image\/png;base64,/)
  await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
  await clickNode(page, custom.id)
  if (!(await page.getByRole('button', { name: 'Replace component icon', exact: true }).isVisible())) await page.getByRole('button', { name: 'Open properties', exact: true }).click()
  const rasters = await page.evaluate(() => {
    const canvas = document.createElement('canvas'); canvas.width = 40; canvas.height = 20
    const context = canvas.getContext('2d'); context.fillStyle = '#1741e0'; context.fillRect(0, 0, 40, 20)
    return ['image/png', 'image/jpeg', 'image/webp'].map(mime => ({ mime, data: canvas.toDataURL(mime).split(',')[1] }))
  })
  const files = rasters.map(({ mime, data }) => ({ name: `native.${mime === 'image/jpeg' ? 'jpg' : mime.split('/')[1]}`, mimeType: mime, buffer: Buffer.from(data, 'base64') }))
  files.push({ name: 'native.gif', mimeType: 'image/gif', buffer: Buffer.from('47494638396101000100800000ff00000000ff21f904000a0000002c000000000100010000020244010021f904000a0000002c00000000010001000002024c01003b', 'hex') })
  for (const file of files) {
    await upload(page, file, 'Replace component icon')
    const replaced = await durable(page)
    assert.equal(replaced.entities[0].customIcon.name, file.name)
    assert.ok(replaced.entities[0].customIcon.width <= 512 && replaced.entities[0].customIcon.height <= 512)
    if (file.mimeType === 'image/gif') {
      target.gifFirstFrame = await page.evaluate(async dataUrl => {
        const image = new Image(); image.src = dataUrl; await image.decode()
        const canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1
        const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
        return [...context.getImageData(0, 0, 1, 1).data]
      }, replaced.entities[0].customIcon.dataUrl)
      assert.deepEqual(target.gifFirstFrame, [255, 0, 0, 255])
    }
    await page.getByRole('button', { name: 'Undo', exact: true }).click()
    assert.deepEqual(await durable(page), created)
  }
  await upload(page, { name: 'unsafe.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>') }, 'Replace component icon')
  assert.match(await page.getByRole('status').textContent(), /Could not import image/)
  assert.deepEqual(await durable(page), created)
  await page.keyboard.press('Control+c')
  await page.getByRole('button', { name: 'New diagram', exact: true }).click()
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 0)
  await page.keyboard.press('Control+v')
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node').length === 1)
  const pasted = await durable(page)
  assert.deepEqual(pasted.entities[0].customIcon, custom.customIcon)
  target.customClipboard = { crossDocument: true, normalizedPngPreserved: true }
  target.imports = ['SVG rasterized to 512x256 PNG', 'PNG', 'JPEG/JPG', 'GIF still', 'WebP', 'Unsafe SVG rejected atomically']
  const mixed = { ...created, title: `Offline integrated ${architecture}`, synthetic: true, legendVisible: false, entities: [
    ...registry.map((item, index) => ({ id: item.icon, kind: 'component', label: item.label, subtitle: item.subtitle, icon: item.icon, color: item.color, parentId: null, layer: 'foreground', width: 220, height: 120, x: index % 4 * 250, y: Math.floor(index / 4) * 140 })),
    { ...custom, id: 'custom', x: 750, y: 980, height: 120 },
  ], connections: [] }
  const source = path.join(output, `${architecture}-mixed-source.json`)
  await writeFile(source, JSON.stringify(mixed))
  await openJson(page, source)
  assert.deepEqual(await durable(page), mixed)
  await closePanels(page)
  await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
  await page.waitForFunction(() => !document.querySelector('button[aria-label="Auto-arrange"]').disabled)
  const arranged = await durable(page)
  assert.equal(arranged.revision, mixed.revision + 1)
  assert.deepEqual(arranged.entities.find(entity => entity.id === 'custom').customIcon, custom.customIcon)
  await page.getByRole('button', { name: 'Undo', exact: true }).click()
  assert.deepEqual(await durable(page), mixed)
  const json = await download(application, page, `${architecture}-mixed-backup.json`, () => page.getByRole('button', { name: 'Save JSON', exact: true }).click(), target)
  assert.deepEqual(JSON.parse(json.bytes), mixed)
  const pictures = {}
  target.iconPixels = {}
  for (const format of ['svg', 'png']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    pictures[format] = (await download(application, page, `${architecture}-mixed.${format}`, () => page.getByRole('button', { name: format === 'svg' ? 'Export SVG' : 'Export PNG 1x', exact: true }).click(), target)).bytes
  }
  const svg = pictures.svg.toString()
  assert.equal((svg.match(/<image /g) ?? []).length, registry.length + 1)
  assert.ok(svg.includes(custom.customIcon.dataUrl))
  assert.equal(/foreignObject|<script|href="https?:|href="file:/i.test(svg), false)
  const box = /viewBox="([\d.-]+) ([\d.-]+) ([\d.-]+) ([\d.-]+)"/.exec(svg)
  for (const format of ['svg', 'png']) {
    const slots = await page.evaluate(async ({ data, mime, entities, origin }) => {
      const image = new Image(); image.src = `data:${mime};base64,${data}`; await image.decode()
      const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
      const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
      return entities.map(entity => {
        const pixels = context.getImageData(entity.x + 17 - origin.x, entity.y + 24 - origin.y, 28, 28).data
        let ink = 0
        for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset + 3] && Math.min(pixels[offset], pixels[offset + 1], pixels[offset + 2]) < 180) ink++
        return { id: entity.id, ink }
      })
    }, { data: pictures[format].toString('base64'), mime: format === 'svg' ? 'image/svg+xml' : 'image/png', entities: mixed.entities, origin: { x: Number(box[1]), y: Number(box[2]) } })
    for (const slot of slots) assert.ok(slot.ink > 5, `Blank ${format} artwork: ${slot.id}`)
    target.iconPixels[format] = slots
  }
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
  assert.deepEqual(await durable(page), mixed)
  for (const format of ['svg', 'png']) {
    await page.getByRole('button', { name: 'Export', exact: true }).click()
    const dark = await download(application, page, `${architecture}-mixed-dark.${format}`, () => page.getByRole('button', { name: format === 'svg' ? 'Export SVG' : 'Export PNG 1x', exact: true }).click(), target)
    assert.deepEqual(dark.bytes, pictures[format])
  }
  await page.getByRole('button', { name: 'Fit diagram', exact: true }).click()
  await page.screenshot({ path: path.join(output, `${architecture}-integrated-dark.png`) })
  if (!(await page.locator('.library').evaluate(element => element.classList.contains('open')))) await page.getByRole('button', { name: 'Open component library', exact: true }).click()
  target.catalog = { vendors: vendors.length, microsoft: microsoft.length, classifications: registry.map(item => ({ key: item.icon, label: item.label, classification: item.subtitle })), searches: [] }
  for (const query of ['Oracle', 'SAP', 'IBM', 'AWS', 'GCP', 'HP', 'HPE', 'SharePoint', 'Business Central', 'Dynamics', 'Microsoft 365', 'Copilot', 'Excel', 'Word', 'PowerPoint', 'Teams']) {
    await page.getByLabel('Search components', { exact: true }).fill(query)
    assert.ok(await page.locator('.library-item').count(), `Missing catalog query: ${query}`)
    await page.waitForFunction(() => [...document.querySelectorAll('.library img')].every(image => image.complete && image.naturalWidth > 0))
    target.catalog.searches.push(query)
  }
  await page.getByLabel('Search components', { exact: true }).fill('')
  await page.screenshot({ path: path.join(output, `${architecture}-catalog-dark.png`) })
  await page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
  await page.screenshot({ path: path.join(output, `${architecture}-integrated-light.png`) })
  await page.getByRole('button', { name: 'Switch to dark theme', exact: true }).click()
  assert.deepEqual(await durable(page), mixed)
  for (const name of ['VENDOR-NOTICES.md', 'MICROSOFT-APP-NOTICES.md', 'licenses/DOMPurify-LICENSE.txt']) {
    const content = await page.evaluate(async name => { const response = await fetch(`ads://studio/${name}`); return { status: response.status, text: await response.text() } }, name)
    assert.equal(content.status, 200)
    assert.ok(content.text.length > 100)
  }
  target.theme = { documentUnchanged: true, exportsByteIdentical: true, persistedAfterMove: false }
  target.checks.push('Five native file-input formats, animated GIF red first frame, 512px SVG normalization, atomic unsafe rejection, undo and cross-document custom clipboard', '17 vendor + 14 Microsoft + custom icon slots visible in both exports; honest classification/search', 'Light/dark screenshots, unchanged document/export bytes and local feature/license notices')
  return mixed
}

try {
  for (const architecture of architectures) {
    assert.ok(['arm64', 'x64'].includes(architecture))
    const target = { architecture, execution: architecture === os.arch() ? 'native' : `${architecture} emulation on ${os.arch()}`, passed: false, checks: [], downloads: [], sessions: [] }
    report.targets.push(target)
    const portable = path.join(root, 'release', `Azure-Diagram-Studio-0.1.0-win-${architecture}-portable.exe`)
    const artifact = await stat(portable)
    assert.ok(artifact.size > 10_000_000)
    target.artifact = { filename: path.basename(portable), bytes: artifact.size, modified: artifact.mtime.toISOString(), sha256: createHash('sha256').update(await readFile(portable)).digest('hex'), qualification: 'Current integrated final build; passed only after runtime checks and cleanup' }
    const packagedRoot = path.join(root, 'release', architecture === 'arm64' ? 'win-arm64-unpacked' : 'win-unpacked')
    const archive = path.join(packagedRoot, 'resources', 'app.asar')
    target.bundle = { bytes: (await stat(archive)).size, sha256: createHash('sha256').update(await readFile(archive)).digest('hex'), compiledFilesCompared: 0 }
    const files = listPackage(archive).map(name => name.replaceAll('\\', '/'))
    assert.ok(files.every(name => /^\/(?:dist|electron)(?:\/|$)/.test(name) || name === '/package.json'))
    assert.ok(!files.some(name => /node_modules|\.test\.|\/src\/|\.env|\.git|test-results|cache/i.test(name)))
    for (const resource of ['dist/branding/app-icon.ico', 'dist/THIRD-PARTY-NOTICES.md', 'dist/VENDOR-NOTICES.md', 'dist/MICROSOFT-APP-NOTICES.md', 'dist/licenses/DOMPurify-LICENSE.txt', 'dist/licenses/IBM-Plex-OFL.txt', 'electron/main.mjs']) assert.ok(extractFile(archive, resource.replaceAll('/', path.sep)).length > 10)
    for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs']) assert.deepEqual(extractFile(archive, path.join('electron', name)), await readFile(path.join(root, 'electron', name)), `Stale packaged shell: ${name}`)
    for (const file of await readdir(path.join(root, 'dist'), { recursive: true, withFileTypes: true })) {
      if (!file.isFile()) continue
      const absolute = path.join(file.parentPath, file.name)
      const relative = path.relative(path.join(root, 'dist'), absolute)
      assert.deepEqual(extractFile(archive, path.join('dist', relative)), await readFile(absolute), `Stale compiled asset: ${relative}`)
      target.bundle.compiledFilesCompared++
    }
    assert.ok(files.some(name => /elk-worker.*\.js$/.test(name)))
    assert.ok(files.some(name => /plex-sans.*\.ttf$/.test(name)))
    for (const license of ['LICENSE.electron.txt', 'LICENSES.chromium.html']) assert.ok((await stat(path.join(packagedRoot, license))).size > 100)
    target.checks.push('ASAR allowlist, branding, worker, font, MIT/Chromium/font/icon notices')
    const appData = await mkdtemp(path.join(output, `profile-${architecture}-`))
    let application
    let lastPage
    try {
      console.log(`VERIFY ${architecture}: existing portable ${portable}; isolated profile ${appData}`)
      let launched = await launch(portable, appData, target)
      application = launched.application
      const page = launched.page
      lastPage = page
      target.checks.push('Actual portable launcher, packaged runtime, offline emulation, secure origin, no Node globals')
      const initial = await durable(page)
      await editTitle(page, `Desktop offline ${architecture}`)
      assert.equal((await durable(page)).title, `Desktop offline ${architecture}`)
      await closePanels(page)
      const componentIds = initial.entities.filter(entity => entity.kind === 'component').slice(0, 2).map(entity => entity.id)
      assert.equal(componentIds.length, 2)
      await page.getByRole('button', { name: 'Connect components', exact: true }).click()
      await clickNode(page, componentIds[0]); await clickNode(page, componentIds[1])
      assert.equal((await durable(page)).connections.length, initial.connections.length + 1)
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      assert.equal((await durable(page)).connections.length, initial.connections.length)
      await page.getByRole('button', { name: 'Select tool', exact: true }).click()
      const before = await durable(page)
      await page.getByRole('button', { name: 'Auto-arrange', exact: true }).click()
      await page.waitForFunction(revision => document.querySelector('.statusbar .save-label')?.textContent === 'Saved on this device' && !document.querySelector('button[aria-label="Auto-arrange"]').disabled && !/Auto-arrange failed/.test(document.querySelector('[role="status"]')?.textContent ?? ''), before.revision)
      const arranged = await durable(page)
      assert.equal(arranged.revision, before.revision + 1)
      assert.ok(arranged.connections.every(connection => connection.points?.length >= 2 && connection.routeRevision === arranged.revision))
      await page.getByRole('button', { name: 'Undo', exact: true }).click()
      assert.deepEqual(await durable(page), before)
      target.checks.push('Edit, connect, bundled ELK worker arrangement, exact undo')
      const backup = await download(application, page, `${architecture}-backup.json`, () => page.getByRole('button', { name: 'Save JSON', exact: true }).click(), target)
      assert.deepEqual(JSON.parse(backup.bytes), before)
      for (const format of ['svg', 'png']) {
        await page.getByRole('button', { name: 'Export', exact: true }).click()
        const file = await download(application, page, `${architecture}-export.${format}`, () => page.getByRole('button', { name: format === 'svg' ? 'Export SVG' : 'Export PNG 1x', exact: true }).click(), target)
        if (format === 'svg') {
          assert.match(file.bytes.toString(), /<svg/)
          assert.match(file.bytes.toString(), /data:font\/ttf;base64/)
        } else assert.equal(file.bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a')
        const pixels = await page.evaluate(async ({ base64, format }) => {
          const image = new Image()
          image.src = `data:image/${format === 'svg' ? 'svg+xml' : 'png'};base64,${base64}`
          await image.decode()
          const canvas = document.createElement('canvas')
          canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
          const context = canvas.getContext('2d'); context.drawImage(image, 0, 0)
          const data = context.getImageData(0, 0, canvas.width, canvas.height).data
          let ink = 0
          for (let offset = 0; offset < data.length; offset += 4) if (data[offset + 3] && Math.min(data[offset], data[offset + 1], data[offset + 2]) < 200) ink++
          return { width: canvas.width, height: canvas.height, ink }
        }, { base64: file.bytes.toString('base64'), format })
        assert.ok(pixels.ink > 1000)
        target[`${format}Pixels`] = pixels
      }
      target.checks.push('JSON/SVG/PNG DownloadItems, save-dialog options, nonblank pixels and embedded font')
      await page.screenshot({ path: path.join(output, `${architecture}-packaged-offline.png`) })
      await page.getByRole('button', { name: 'New diagram', exact: true }).click()
      await page.waitForFunction(() => document.querySelector('.object-count')?.textContent.includes('0 objects'))
      await saved(page)
      await openJson(page, backup.destination)
      await page.waitForFunction(title => document.querySelector('input[aria-label="Document title"]')?.value === title, before.title)
      assert.deepEqual(await durable(page), before)
      target.checks.push('New diagram and native file-input JSON Open')
      const finalDocument = await featureChecks(application, page, architecture, target)
      assert.deepEqual(launched.errors, [])
      assert.deepEqual(application.diagnostics.renderer.externalRequests, [])
      await application.close(); application = undefined
      const moved = path.join(output, `moved-${architecture}`, path.basename(portable))
      await mkdir(path.dirname(moved), { recursive: true })
      await cp(portable, moved)
      launched = await launch(moved, appData, target)
      application = launched.application
      lastPage = launched.page
      assert.deepEqual(await durable(launched.page), finalDocument)
      assert.equal(await launched.page.getByRole('button', { name: 'Switch to light theme', exact: true }).isVisible(), true)
      target.theme.persistedAfterMove = true
      await launched.page.screenshot({ path: path.join(output, `${architecture}-moved-relaunched-dark.png`) })
      target.checks.push('Autosave survives close/relaunch after moving portable executable')
      assert.deepEqual(launched.errors, [])
      assert.deepEqual(application.diagnostics.renderer.externalRequests, [])
      await launched.page.getByRole('button', { name: 'Switch to light theme', exact: true }).click()
      assert.deepEqual(await durable(launched.page), finalDocument)
      await application.close(); application = undefined
      launched = await launch(portable, appData, target)
      application = launched.application
      lastPage = launched.page
      assert.deepEqual(await durable(launched.page), finalDocument)
      assert.equal(await launched.page.getByRole('button', { name: 'Switch to dark theme', exact: true }).isVisible(), true)
      await launched.page.screenshot({ path: path.join(output, `${architecture}-relaunched-light.png`) })
      target.theme.lightAndDarkPersistedAfterRelaunch = true
      target.checks.push('Both light and dark preferences survive close/relaunch without document changes')
      assert.deepEqual(launched.errors, [])
      assert.deepEqual(application.diagnostics.renderer.externalRequests, [])
      target.passed = true
      console.log(`PASS ${architecture}: ${target.checks.join('; ')}`)
    } catch (error) {
      target.error = error.stack
      if (error.cleanupError) target.cleanupError = error.cleanupError
      if (error.diagnostics) target.sessions.push(error.diagnostics)
      if (lastPage) try { await lastPage.screenshot({ path: path.join(output, `${architecture}-failure.png`), timeout: 5000 }) } catch (screenshotError) { target.failureScreenshotError = screenshotError.message }
      console.error(`FAIL ${architecture}: ${error.message}`)
    } finally {
      if (application) try { await application.close() } catch (error) { target.cleanupError = error.stack; target.passed = false }
    }
  }
  report.passed = report.targets.length === architectures.length && report.targets.every(target => target.passed)
  if (report.passed) {
    for (const target of report.targets) {
      const filename = path.join(root, 'release', target.artifact.filename).replaceAll("'", "''")
      const { stdout } = await execute('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `(Get-AuthenticodeSignature -FilePath '${filename}').Status.ToString()`], { timeout: 30_000, windowsHide: true })
      target.artifact.authenticodeStatus = stdout.trim()
      assert.ok(target.artifact.authenticodeStatus)
    }
    if (architectures.length === 2) await writeFile(path.join(root, 'release', 'SHA256SUMS.json'), JSON.stringify({ generatedAt: new Date().toISOString(), host: report.host, artifacts: report.targets.map(target => ({ architecture: target.architecture, execution: target.execution, ...target.artifact })) }, null, 2) + '\n')
  }
} catch (error) {
  report.passed = false
  report.error = error.stack
  throw error
} finally {
  report.completedAt = new Date().toISOString()
  await writeFile(path.join(output, 'desktop-report.json'), JSON.stringify(report, null, 2) + '\n')
}
if (!report.passed) process.exitCode = 1