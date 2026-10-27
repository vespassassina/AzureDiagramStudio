import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const root = fileURLToPath(new URL('../', import.meta.url))
const stage = path.join(root, '.desktop-stage')
const metadata = JSON.parse(await readFile(path.join(root, 'package.json'), 'utf8'))
await rm(stage, { recursive: true, force: true })
await mkdir(path.join(stage, 'electron'), { recursive: true })
await cp(path.join(root, 'dist'), path.join(stage, 'dist'), { recursive: true })
await mkdir(path.join(stage, 'dist', 'licenses'), { recursive: true })
await cp(path.join(root, 'node_modules', 'dompurify', 'LICENSE'), path.join(stage, 'dist', 'licenses', 'DOMPurify-LICENSE.txt'))
for (const name of ['main.mjs', 'policy.mjs', 'protocol.mjs', 'security.mjs', 'mcp.mjs', 'mcp-bridge.mjs', 'mcp-schema.mjs', 'preload.cjs']) await cp(path.join(root, 'electron', name), path.join(stage, 'electron', name))
await writeFile(path.join(stage, 'package.json'), JSON.stringify({ name: 'azure-diagram-studio', version: metadata.version, private: true, description: 'Offline architecture diagram editor', author: 'Azure Diagram Studio', type: 'module', main: 'electron/main.mjs' }, null, 2) + '\n')
console.log('Desktop staging contains compiled assets, seven main modules and the sandboxed preload; no npm dependencies or source tests.')