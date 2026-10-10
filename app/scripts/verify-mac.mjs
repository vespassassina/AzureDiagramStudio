// Checks the macOS ZIP as a user receives it: unzipped with ditto, signature
// intact (a broken seal makes Gatekeeper report the app as damaged), arm64,
// carrying the product icon rather than Electron's default, and launching to a
// rendered diagram (a renderer error leaves an empty window, not a crash).
import assert from 'node:assert/strict'
import { execFile } from 'node:child_process'
import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import os from 'node:os'
import path from 'node:path'
import { launchDesktop } from './desktop-driver.mjs'

const execute = promisify(execFile)
const root = fileURLToPath(new URL('../', import.meta.url))
const { version } = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
const zip = path.join(root, 'release', `Azure-Diagram-Studio-${version}-mac-arm64.zip`)
const temp = await mkdtemp(path.join(os.tmpdir(), 'ads-mac-'))

try {
  await execute('ditto', ['-x', '-k', zip, temp])
  const bundles = (await readdir(temp)).filter((name) => name.endsWith('.app'))
  assert.equal(bundles.length, 1, `expected one .app in ${zip}, found ${bundles.join(', ') || 'none'}`)
  const app = path.join(temp, bundles[0])

  await execute('codesign', ['--verify', '--deep', '--strict', app]).catch((error) => {
    throw new Error(`signature check failed for ${bundles[0]}: ${error.stderr.trim()}. Rebuild with mac.identity set.`)
  })

  const plist = JSON.parse((await execute('plutil', ['-convert', 'json', '-o', '-', path.join(app, 'Contents', 'Info.plist')])).stdout)
  assert.equal(plist.CFBundleIdentifier, 'com.azurediagramstudio.desktop')
  assert.notEqual(plist.CFBundleIconFile, 'electron.icns', 'bundle uses the default Electron icon; set mac.icon')

  const binary = path.join(app, 'Contents', 'MacOS', plist.CFBundleExecutable)
  const { stdout: kind } = await execute('file', [binary])
  assert.match(kind, /arm64/, `executable is not arm64: ${kind.trim()}`)

  const profile = await mkdtemp(path.join(temp, 'profile-'))
  const application = await launchDesktop({ executablePath: binary, cwd: temp, env: { ...process.env }, profileRoot: profile, timeout: 60_000 })
  try {
    const page = await application.firstWindow()
    const errors = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.reload()
    await page.locator('.react-flow__node').first().waitFor({ timeout: 30_000 }).catch(() => {
      throw new Error(`app opened but rendered no diagram. Renderer errors: ${errors.join('; ') || 'none captured'}`)
    })
  } finally {
    await application.close()
  }

  console.log(`macOS package verified: ${path.relative(root, zip)} (${bundles[0]}, ${plist.CFBundleShortVersionString}, arm64, signature intact, renders)`)
} finally {
  await rm(temp, { recursive: true, force: true })
}
