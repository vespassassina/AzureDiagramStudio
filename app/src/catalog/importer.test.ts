import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, test } from 'vitest'

const extractor = fileURLToPath(new URL('../../scripts/import-catalog-extract.ps1', import.meta.url))
const generator = fileURLToPath(new URL('../../scripts/import-catalog.mjs', import.meta.url))
const xmlns = 'xmlns="http://www.w3.org/2000/svg"'
const cases = [
  ['valid', `<svg ${xmlns}><defs><linearGradient id="paint"/></defs><path fill="url(#paint)"/></svg>`, []],
  ['script', `<svg ${xmlns}><script>alert(1)</script></svg>`, ['unsafe-element:script']],
  ['external', `<svg ${xmlns}><image href="https://example.com/icon.svg"/></svg>`, ['external-resource:href']],
  ['handler', `<svg ${xmlns} onload="alert(1)"/>`, ['event-handler:onload']],
  ['root', '<html/>', ['invalid-svg-root']],
  ['stylesheet', `<?xml-stylesheet href="https://example.com/style.css"?><svg ${xmlns}/>`, ['processing-instruction:xml-stylesheet']],
  ['trailing-stylesheet', `<svg ${xmlns}/><?xml-stylesheet href="https://example.com/style.css"?>`, ['processing-instruction:xml-stylesheet']],
  ['nested-stylesheet', `<svg ${xmlns}><?xml-stylesheet href="https://example.com/style.css"?></svg>`, ['processing-instruction:xml-stylesheet']],
  ['safe-style', `<?xml version="1.0"?><svg ${xmlns}><style>.paint { fill: url(#paint); }</style><defs><linearGradient id="paint"/></defs><path class="paint"/></svg>`, []],
  ['external-style', `<svg ${xmlns}><style>@import "https://example.com/style.css";</style></svg>`, ['external-style-resource']],
  ['external-style-url', `<svg ${xmlns}><style>.paint { fill: url(https://example.com/paint.svg); }</style></svg>`, ['external-style-resource']],
  ['foreign-object', `<svg ${xmlns}><foreignObject/></svg>`, ['unsafe-element:foreignObject']],
  ['animation', `<svg ${xmlns}><animate/></svg>`, ['unsafe-element:animate']],
  ['external-xlink', `<svg ${xmlns} xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="https://example.com/icon.svg"/></svg>`, ['external-resource:xlink:href']],
  ['javascript', `<svg ${xmlns}><path style="fill:javascript:alert(1)"/></svg>`, ['unsafe-value:style']],
  ['namespace', '<svg xmlns="https://example.com/not-svg"/>', ['invalid-svg-root']],
] as const

function fixtureZip(zip: string, entries: Record<string, string>) {
  const encoded = Buffer.from(JSON.stringify(Object.entries(entries).map(([entry, svg]) => ({ entry, base64: Buffer.from(svg).toString('base64') })))).toString('base64')
  const command = `$ErrorActionPreference = 'Stop'; Add-Type -AssemblyName System.IO.Compression; Add-Type -AssemblyName System.IO.Compression.FileSystem; $zip = [IO.Compression.ZipFile]::Open('${zip.replace(/'/g, "''")}', [IO.Compression.ZipArchiveMode]::Create); try { $entries = [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')) | ConvertFrom-Json; foreach ($item in $entries) { $entry = $zip.CreateEntry($item.entry); $stream = $entry.Open(); try { $bytes = [Convert]::FromBase64String($item.base64); $stream.Write($bytes, 0, $bytes.Length) } finally { $stream.Dispose() } } } finally { $zip.Dispose() }`
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', command])
}

const safetyTemporary = mkdtempSync(join(tmpdir(), 'diagrammer-catalog-test-'))
let safetyInventory: Record<string, { entries: { entry: string; safetyFlags: string[]; base64: string }[] }>
beforeAll(() => {
  const zip = join(safetyTemporary, 'fixture.zip')
  const output = join(safetyTemporary, 'inventory.json')
  fixtureZip(zip, Object.fromEntries(cases.map(([name, svg]) => [`${name}.svg`, svg])))
  execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', extractor, '-AzureZip', zip, '-FabricZip', zip, '-OutputPath', output])
  safetyInventory = JSON.parse(readFileSync(output, 'utf8'))
})
afterAll(() => rmSync(safetyTemporary, { recursive: true, force: true }))

test.each(cases)('should_report_exact_svg_safety_flags_when_extracting_%s', (_name, svg, expected) => {
  const bytes = Buffer.from(svg).toString('base64')
  for (const vendor of ['azure', 'fabric']) {
    assert.equal(safetyInventory[vendor].entries.length, cases.length)
    const entry = safetyInventory[vendor].entries.find(entry => entry.entry === `${_name}.svg`)
    assert.ok(entry)
    assert.deepEqual(entry.safetyFlags, expected)
    assert.equal(entry.base64, bytes)
  }
})

test.each([
  ['external-dtd', `<!DOCTYPE svg SYSTEM "http://127.0.0.1:1/never-resolve.dtd"><svg ${xmlns}/>`],
  ['internal-dtd', `<!DOCTYPE svg [<!ENTITY payload "must-not-expand">]><svg ${xmlns}><text>&payload;</text></svg>`],
  ['malformed', `<svg ${xmlns}>`],
])('should_abort_extraction_without_output_when_xml_is_%s', (_name, svg) => {
  const temporary = mkdtempSync(join(tmpdir(), 'diagrammer-catalog-reject-'))
  try {
    const zip = join(temporary, 'fixture.zip')
    const output = join(temporary, 'inventory.json')
    fixtureZip(zip, { 'fixture.svg': svg })
    assert.throws(() => execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-File', extractor, '-AzureZip', zip, '-FabricZip', zip, '-OutputPath', output], { stdio: 'pipe' }), /DTD is prohibited|Unexpected end of file/)
    assert.equal(existsSync(output), false)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
})

function isolatedGenerator(temporary: string, fabricSvg: string) {
  const scripts = join(temporary, 'scripts')
  const directory = join(temporary, 'src/catalog')
  mkdirSync(scripts, { recursive: true })
  mkdirSync(directory, { recursive: true })
  copyFileSync(extractor, join(scripts, 'import-catalog-extract.ps1'))
  copyFileSync(generator, join(scripts, 'import-catalog.mjs'))
  const svg = `<?xml version="1.0"?><svg ${xmlns} viewBox="0 0 16 16"><path fill="#123456" d="M0 0h16v16H0z"/></svg>`
  const azureZip = join(temporary, 'diagrammer-azure-v24.zip')
  const fabricZip = join(temporary, 'diagrammer-fabric-icons.zip')
  fixtureZip(azureZip, { 'Azure_Public_Service_Icons/Icons/compute/001-icon-service-Compute.svg': svg, 'Azure_Public_Service_Icons/Icons/other/001-icon-service-Compute.svg': svg })
  fixtureZip(fabricZip, { 'Icons/SVG/one_lake_16_color.svg': fabricSvg })
  const semantics = JSON.parse(readFileSync(new URL('./semantics.json', import.meta.url), 'utf8'))
  semantics.archiveHashes = Object.fromEntries([['azure', azureZip], ['fabric', fabricZip]].map(([vendor, path]) => [vendor, createHash('sha256').update(readFileSync(path)).digest('hex')]))
  writeFileSync(join(directory, 'semantics.json'), JSON.stringify(semantics))
  const entra = JSON.parse(readFileSync(new URL('./legacy.json', import.meta.url), 'utf8')).find((entry: { icon: string }) => entry.icon === 'azure-entra')
  writeFileSync(join(directory, 'legacy.json'), JSON.stringify([entra]))
  mkdirSync(join(temporary, 'src/assets/azure'), { recursive: true })
  copyFileSync(fileURLToPath(new URL('../assets/azure/azure-entra.svg', import.meta.url)), join(temporary, 'src/assets/azure/azure-entra.svg'))
  return () => execFileSync(process.execPath, [join(scripts, 'import-catalog.mjs')], { env: { ...process.env, TMP: temporary, TEMP: temporary }, stdio: 'pipe' })
}

test('should_abort_generation_before_writing_assets_when_a_later_archive_contains_a_stylesheet', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'diagrammer-catalog-generate-reject-'))
  try {
    const generate = isolatedGenerator(temporary, `<?xml-stylesheet href="https://example.com/style.css"?><svg ${xmlns}/>`)
    assert.throws(generate, /Unsafe SVG.*processing-instruction:xml-stylesheet/)
    assert.deepEqual(readdirSync(join(temporary, 'src/assets/azure')), ['azure-entra.svg'])
    assert.equal(existsSync(join(temporary, 'src/assets/fabric')), false)
    for (const filename of ['catalog.generated.ts', 'inventory.json', 'assets.generated.json']) assert.equal(existsSync(join(temporary, 'src/catalog', filename)), false)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
})

test('should_generate_identical_catalogs_and_bytes_when_the_same_safe_archives_are_imported_twice', () => {
  const temporary = mkdtempSync(join(tmpdir(), 'diagrammer-catalog-determinism-'))
  try {
    const svg = `<?xml version="1.0"?><svg ${xmlns} viewBox="0 0 16 16"><path fill="#abcdef" d="M0 0h16v16H0z"/></svg>`
    const generate = isolatedGenerator(temporary, svg)
    generate()
    const filenames = ['src/catalog/catalog.generated.ts', 'src/catalog/inventory.json', 'src/assets/fabric/fabric-one-lake-16-color.svg', 'src/assets/azure/azure-001-icon-service-compute.svg', 'src/assets/azure/azure-entra.svg', 'src/catalog/assets.generated.json']
    const before = filenames.map(filename => readFileSync(join(temporary, filename)))
    assert.equal(before[2].toString(), svg)
    const registered = JSON.parse(before[5].toString())
    assert.equal(Object.keys(registered).length, 3)
    for (const bytes of before.slice(2, 5)) {
      const sha256 = createHash('sha256').update(bytes).digest('hex')
      assert.equal(registered[sha256], `data:image/svg+xml;charset=utf-8,${encodeURIComponent(bytes.toString('utf8'))}`)
      assert.equal(createHash('sha256').update(decodeURIComponent(registered[sha256].split(',')[1])).digest('hex'), sha256)
    }
    const inventory = JSON.parse(before[1].toString())
    assert.equal(inventory.archives.azure.entryCount, 2)
    assert.equal(inventory.archives.azure.uniqueItemCount, 1)
    assert.equal(inventory.archives.azure.duplicatePlacementCount, 1)
    assert.deepEqual(inventory.archives.fabric.safetyFlags, [])
    assert.deepEqual(inventory.archives.fabric.svgValidation, {
      root: { localName: 'svg', namespaceURI: 'http://www.w3.org/2000/svg' },
      checkedEntryCount: 1,
      byteHashCheckedEntryCount: 1,
      documentScope: 'entire-xml-document',
      dtdProcessing: 'prohibit',
      xmlResolver: 'disabled',
      unsafeContentPolicy: 'reject',
    })
    assert.deepEqual(inventory.archives.fabric.variants, { filenameFamilyCount: 1, styles: { color: 1 }, sizes: { '16': 1 }, unclassifiedEntryCount: 0 })
    generate()
    assert.deepEqual(filenames.map(filename => readFileSync(join(temporary, filename))), before)
  } finally { rmSync(temporary, { recursive: true, force: true }) }
}, 15000)