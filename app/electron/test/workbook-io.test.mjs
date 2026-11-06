import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateOutput, validDocument, createMutationBroker } from '../mcp-bridge.mjs'
import { validateWorkbookOperation, workbookTools } from '../mcp-schema.mjs'
import { validatePdfJob, PRINT_URL } from '../pdf.mjs'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { createLocalHandler } from '../protocol.mjs'
import config from '../../electron-builder.config.cjs'

// DGM-151C/D authored acceptance cases (not yet executed in this lane).
const page = (id, title = id) => ({ schemaVersion: 1, id, title, subtitle: '', revision: 0, direction: 'RIGHT', synthetic: false, legendVisible: true, legend: [], entities: [], connections: [] })
const root = { kind: 'workbook', schemaVersion: 1, id: 'book', title: 'Program', revision: 2, pages: [page('p1'), page('p2')] }

function exported(format, { scope = 'workbook', pageId, bytes, mimeType, filename = `program.${format}` }) {
  const token = 'life:w1'
  const resource = { uri: `diagrammer://exports/${encodeURIComponent(token)}/${filename}`, mimeType, ...(format === 'json' ? { text: bytes.toString('utf8') } : { blob: bytes.toString('base64') }) }
  return {
    operation: { name: 'export_workbook', arguments: { stateToken: token, scope, ...(pageId ? { pageId } : {}), format } },
    value: { content: [{ type: 'resource', resource }, { type: 'text', text: JSON.stringify({ stateToken: token, scope, ownerId: pageId ?? 'book', mimeType, filename, byteLength: bytes.length }) }] },
  }
}

test('should_accept_workbook_tool_schemas_when_arguments_are_bounded_and_known', () => {
  assert.deepEqual(workbookTools.map(tool => tool.name).sort(), ['edit_workbook', 'export_workbook', 'get_workbook'])
  assert.equal(validateWorkbookOperation({ name: 'get_workbook', arguments: {} }), true)
  assert.equal(validateWorkbookOperation({ name: 'edit_workbook', arguments: { stateToken: 't', commands: [{ type: 'addPage', pageId: 'p3', title: 'Three' }] } }), true)
  assert.equal(validateWorkbookOperation({ name: 'edit_workbook', arguments: { stateToken: 't', commands: [{ type: 'addPage', pageId: 'p3', path: 'C:\\x' }] } }), false)
  assert.equal(validateWorkbookOperation({ name: 'edit_workbook', arguments: { stateToken: 't', commands: [{ type: 'reorderPages', pageIds: ['p1', 'p1'] }] } }), false)
  assert.equal(validateWorkbookOperation({ name: 'export_workbook', arguments: { stateToken: 't', scope: 'workbook', format: 'vsdx' } }), true)
  assert.equal(validateWorkbookOperation({ name: 'export_workbook', arguments: { stateToken: 't', scope: 'workbook', format: 'vsdx', path: 'out.vsdx' } }), false)
  assert.equal(validateWorkbookOperation({ name: 'get_workbook', arguments: { extra: true } }), false)
})

test('should_validate_workbook_json_pdf_and_vsdx_outputs_when_signatures_and_metadata_match', () => {
  const json = exported('json', { bytes: Buffer.from(JSON.stringify(root)), mimeType: 'application/json' })
  assert.equal(validateOutput(json.value, json.operation), true)
  const pdf = exported('pdf', { bytes: Buffer.from('%PDF-1.7\n'), mimeType: 'application/pdf' })
  assert.equal(validateOutput(pdf.value, pdf.operation), true)
  const vsdx = exported('vsdx', { bytes: Buffer.from([80, 75, 3, 4, 0, 0]), mimeType: 'application/vnd.ms-visio.drawing' })
  assert.equal(validateOutput(vsdx.value, vsdx.operation), true)
  const fakePdf = exported('pdf', { bytes: Buffer.from('<html>'), mimeType: 'application/pdf' })
  assert.equal(validateOutput(fakePdf.value, fakePdf.operation), false)
  const pageJson = exported('json', { scope: 'page', pageId: 'p2', bytes: Buffer.from(JSON.stringify(page('p2'))), mimeType: 'application/json', filename: 'p2.json' })
  assert.equal(validateOutput(pageJson.value, pageJson.operation), true)
  // A page export whose owner is a different page is a wrong-page response.
  const meta = JSON.parse(pageJson.value.content[1].text)
  pageJson.value.content[1].text = JSON.stringify({ ...meta, ownerId: 'p1' })
  assert.equal(validateOutput(pageJson.value, pageJson.operation), false)
})

test('should_accept_normalized_v2_connector_offsets_and_reject_out_of_range_values', () => {
  // Same fully-valid v2 baseline as mcp-v2-state-styles.test.mjs; only the anchor varies.
  const base = {
    schemaVersion: 2, id: 'anchors', title: 'Anchors', subtitle: '', revision: 0, direction: 'RIGHT', synthetic: false, legendVisible: true, legend: [],
    entities: [
      { id: 'box', kind: 'component', label: 'Box', x: 0, y: 0, width: 220, height: 88, color: 'azure' },
      { id: 'peer', kind: 'component', label: 'Peer', x: 300, y: 0, width: 220, height: 88, color: 'azure' },
    ],
    connections: [],
  }
  const connection = (sourceOffset, targetOffset = 0.5) => ({ id: 'edge', from: 'box', to: 'peer', label: 'Call', style: 'solid', arrow: 'forward', sourceSide: 'right', targetSide: 'left', sourceOffset, targetOffset })
  assert.equal(validDocument(base), true)
  for (const offset of [0, 0.25, 1]) assert.equal(validDocument({ ...base, connections: [connection(offset)] }), true)
  for (const offset of [-0.1, 1.5, Number.NaN]) assert.equal(validDocument({ ...base, connections: [connection(offset)] }), false)
  assert.equal(validDocument({ ...base, connections: [connection(0.5, 2)] }), false)
  // Offsets are a v2-only field; v1 documents must not carry them.
  assert.equal(validDocument({ ...base, schemaVersion: 1, connections: [connection(0.5)] }), false)
})

test('should_reject_pdf_jobs_with_html_paths_duplicate_or_oversized_pages', () => {
  assert.equal(PRINT_URL, 'ads://studio/print.html')
  const job = { title: 'Program', pages: [page('p1'), page('p2')], background: 'diagram' }
  assert.equal(validatePdfJob(job), true)
  assert.equal(validatePdfJob({ ...job, html: '<script>' }), false)
  assert.equal(validatePdfJob({ ...job, url: 'https://example.com' }), false)
  assert.equal(validatePdfJob({ ...job, pages: [page('p1'), page('p1')] }), false)
  assert.equal(validatePdfJob({ ...job, pages: [] }), false)
  assert.equal(validatePdfJob({ ...job, background: 'transparent' }), false)
  assert.equal(validatePdfJob({ ...job, pages: Array.from({ length: 101 }, (_, index) => page(`p${index}`)) }), false)
  assert.equal(validatePdfJob({ ...job, pages: [{ ...page('big'), subtitle: 'x'.repeat(5 * 1024 * 1024) }] }), false)
})

test('should_route_workbook_operations_through_broker_and_validate_state_results', async () => {
  const sent = []
  const broker = createMutationBroker({ send: request => sent.push(request), timeout: 1_000 })
  const operation = { name: 'get_workbook', arguments: {} }
  const pending = broker.request(operation)
  assert.equal(sent.length, 1)
  assert.deepEqual(sent[0].operation, operation)
  const state = { kind: 'workbook', id: 'book', title: 'Program', revision: 2, activePageId: 'p1', stateToken: 'life:w1', pages: [{ id: 'p1', title: 'p1', stateToken: 'life:p1:p1' }, { id: 'p2', title: 'p2', stateToken: 'life:p2:p2' }] }
  broker.complete(sent[0].id, { ok: true, value: state })
  assert.deepEqual(await pending, { ok: true, value: state })
})

test('should_serve_bundled_print_page_and_assets_but_no_other_html_when_local', async () => {
  // Scratch bundle lives beside this test (not a system temp folder) and is removed afterwards.
  const directory = await mkdtemp(path.join(fileURLToPath(new URL('./', import.meta.url)), '.print-bundle-'))
  const root = path.join(directory, 'dist')
  try {
    await mkdir(path.join(root, 'assets'), { recursive: true })
    await writeFile(path.join(root, 'print.html'), '<!doctype html><title>Print</title>')
    await writeFile(path.join(root, 'assets', 'print-abc.js'), 'void 0')
    await writeFile(path.join(root, 'other.html'), '<!doctype html><title>Other</title>')
    const handler = createLocalHandler(root)
    const page = await handler({ url: PRINT_URL, method: 'GET' })
    assert.equal(page.status, 200)
    assert.match(page.headers.get('content-type'), /^text\/html/)
    assert.match(await page.text(), /Print/)
    assert.equal((await handler({ url: 'ads://studio/assets/print-abc.js', method: 'GET' })).status, 200)
    assert.equal((await handler({ url: 'ads://studio/other.html', method: 'GET' })).status, 404)
    assert.equal((await handler({ url: 'ads://studio/print.html/../other.html', method: 'GET' })).status, 403)
    assert.equal((await handler({ url: 'ads://studio/print.html', method: 'POST' })).status, 405)
  } finally { await rm(directory, { recursive: true, force: true }) }
})

test('should_stage_and_package_every_main_process_module_and_preload_the_desktop_imports', async () => {
  // Walk relative imports from main.mjs plus every electron/*.cjs preload referenced
  // by path.join(..., 'electron', NAME); each must be staged and packaged.
  const electron = new URL('../', import.meta.url)
  const needed = new Set(), queue = ['main.mjs']
  while (queue.length) {
    const name = queue.pop()
    if (needed.has(name)) continue
    needed.add(name)
    const source = await readFile(new URL(name, electron), 'utf8')
    for (const match of source.matchAll(/from '\.\/([\w.-]+\.mjs)'/g)) queue.push(match[1])
    for (const match of source.matchAll(/'electron', '([\w-]+\.cjs)'/g)) needed.add(match[1])
  }
  for (const preload of ['preload.cjs', 'print-preload.cjs', 'headless-preload.cjs']) assert.ok(needed.has(preload), preload)
  const stage = await readFile(new URL('../../scripts/stage-desktop.mjs', import.meta.url), 'utf8')
  const staged = new Set(runInNewContext(/for \(const name of (\[[^\n]+\])\)/.exec(stage)?.[1] ?? '[]'))
  for (const name of needed) assert.ok(staged.has(name), `stage-desktop.mjs must copy electron/${name}`)
  for (const name of [...needed].filter(item => item.endsWith('.cjs'))) assert.ok(config.files.includes(`electron/${name}`), `electron-builder files must include electron/${name}`)
  assert.ok(config.files.includes('electron/*.mjs'))
})
