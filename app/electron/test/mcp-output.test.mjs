import { test } from 'node:test'
import assert from 'node:assert/strict'
import { outputTools, validateOutputOperation } from '../mcp-schema.mjs'
import { validateOutput, MAX_OUTPUT_BYTES, createMutationBroker } from '../mcp-bridge.mjs'

const operation = { name: 'snapshot_diagram', arguments: { stateToken: 'current' } }
function output(token = 'current') {
  const bytes = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  return { content: [
    { type: 'image', mimeType: 'image/png', data: bytes.toString('base64') },
    { type: 'text', text: JSON.stringify({ stateToken: token, mimeType: 'image/png', filename: 'diagram.png', byteLength: bytes.length }) },
  ] }
}
test('should_advertise_strict_read_only_output_tools_and_reject_invalid_options', () => {
  assert.deepEqual(outputTools.map(tool => tool.name), ['snapshot_diagram', 'export_diagram'])
  assert.ok(outputTools.every(tool => tool.annotations.readOnlyHint))
  assert.ok(validateOutputOperation(operation))
  for (const args of [
    { stateToken: 'current', format: 'json', scale: 1 },
    { stateToken: 'current', format: 'markdown', includeMarkdown: true },
    { stateToken: 'current', format: 'png', scale: 3 },
    { stateToken: 'current', format: 'svg', path: 'file.svg' },
    { stateToken: '', format: 'png' },
  ]) assert.equal(validateOutputOperation({ name: 'export_diagram', arguments: args }), false)
  assert.equal(validateOutputOperation({ ...operation, arguments: { stateToken: 'current', includeMarkdown: false } }), false)
  for (const format of ['svg', 'png', 'json', 'markdown']) assert.ok(validateOutputOperation({ name: 'export_diagram', arguments: { stateToken: 'current', format } }))
})
test('should_validate_exact_output_metadata_token_mime_base64_size_and_resource_uri', () => {
  assert.ok(validateOutput(output(), operation))
  assert.equal(validateOutput(output('stale'), operation), false)
  for (const change of [
    value => { value.content[0].data = 'not base64' },
    value => { value.content[0].mimeType = 'text/html' },
    value => { value.content[0].data = Buffer.from('not PNG').toString('base64') },
    value => { value.content[1].text = value.content[1].text.replace('"byteLength":8', '"byteLength":9') },
    value => { value.content[1].text = value.content[1].text.replace('diagram.png', '../diagram.png') },
    value => { value.extra = true },
    value => { value.content[0].data = 'a'.repeat(MAX_OUTPUT_BYTES) },
  ]) { const value = output(); change(value); assert.equal(validateOutput(value, operation), false) }
})
test('should_share_broker_exclusion_and_reject_mismatched_or_expired_output', async () => {
  let sent
  const broker = createMutationBroker({ send: value => { sent = value }, timeout: 100 })
  const pending = broker.request(operation)
  assert.equal((await broker.request(operation)).ok, false)
  assert.equal(broker.complete(sent.id, { ok: true, output: output('stale') }), false)
  assert.equal(broker.complete(sent.id, { ok: true, output: output() }), true)
  assert.deepEqual(await pending, { ok: true, output: output() })
  const late = broker.request(operation)
  const id = sent.id
  broker.clear('Renderer reloaded.')
  assert.equal((await late).ok, false)
  assert.equal(broker.complete(id, { ok: true, output: output() }), false)
})
test('should_validate_text_resources_and_ZIP_metadata_and_reject_foreign_uris_or_wrong_content', () => {
  const document = { schemaVersion: 1, id: 'test', title: 'Committed', subtitle: '', revision: 3, direction: 'RIGHT', synthetic: false, legendVisible: true, legend: [], entities: [], connections: [] }
  for (const [format, mimeType, text] of [
    ['svg', 'image/svg+xml', '<svg xmlns="http://www.w3.org/2000/svg"><text>世界</text></svg>'],
    ['json', 'application/json', JSON.stringify(document)],
    ['markdown', 'text/markdown', '# 世界\n\n![Diagram](data:image/png;base64,iVBORw0KGgo=)\n'],
    ['zip', 'application/zip', Buffer.from([80, 75, 3, 4]).toString('base64')],
  ]) {
    const operation = { name: 'export_diagram', arguments: { stateToken: 'current', format: format === 'zip' ? 'png' : format, ...(format === 'zip' ? { includeMarkdown: true } : {}) } }
    const filename = `diagram.${format === 'markdown' ? 'md' : format}`
    const resource = { uri: `diagrammer://exports/current/${filename}`, mimeType, ...(format === 'zip' ? { blob: text } : { text }) }
    const result = { content: [{ type: 'resource', resource }, { type: 'text', text: JSON.stringify({ stateToken: 'current', filename, mimeType, byteLength: format === 'zip' ? 4 : Buffer.byteLength(text) }) }] }
    assert.ok(validateOutput(result, operation), format)
    for (const invalid of [
      { ...resource, uri: 'file:///diagram.svg' }, { ...resource, mimeType: 'text/html' },
      { ...resource, extra: true }, { ...resource, ...(format === 'zip' ? { blob: 'iVBORw0KGgo=' } : { text: 'not output' }) },
    ]) assert.equal(validateOutput({ ...result, content: [{ type: 'resource', resource: invalid }, result.content[1]] }, operation), false)
  }
})
test('should_cancel_output_on_disconnect_and_wall_clock_expiry_without_accepting_late_result', async () => {
  let sent
  const broker = createMutationBroker({ send: value => { sent = value }, timeout: 15 })
  const controller = new AbortController()
  const disconnected = broker.request(operation, controller.signal), id = sent.id
  controller.abort()
  assert.equal((await disconnected).ok, false)
  assert.equal(broker.complete(id, { ok: true, output: output() }), false)
  const expired = broker.request(operation), late = sent.id
  await new Promise(resolve => setTimeout(resolve, 25))
  assert.equal((await expired).ok, false)
  assert.equal(broker.complete(late, { ok: true, output: output() }), false)
})
test('should_keep_snapshot_and_export_at_the_default_four_second_broker_boundary', async t => {
  t.mock.timers.enable({ apis: ['Date', 'setTimeout'] })
  const exportOperation = { name: 'export_diagram', arguments: { stateToken: 'current', format: 'png' } }
  for (const outputOperation of [operation, exportOperation]) {
    let sent
    const broker = createMutationBroker({ send: value => { sent = value } })
    const started = Date.now(), pending = broker.request(outputOperation)
    assert.equal(sent.deadline, started + 4_000)
    t.mock.timers.tick(4_000)
    assert.deepEqual(await pending, { ok: false, message: 'MCP operation timed out.' })
    assert.equal(broker.complete(sent.id, { ok: true, output: output() }), false)
  }
})
