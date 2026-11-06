import assert from 'node:assert/strict'
import test from 'node:test'
import { createSnapshotStore, validateOutput } from '../mcp-bridge.mjs'

const stateToken = 'mcp-v2:7'
const document = {
  schemaVersion: 2, id: 'mcp-v2', title: 'State styles', subtitle: '', revision: 7, direction: 'RIGHT', synthetic: false, legendVisible: true, legend: [],
  stateStyles: [{ id: 'degraded', name: 'Degraded', meaning: 'Reduced capability.', box: { fill: '#ff8800', stroke: '#112233', textColor: '#ffffff', strokeWidth: 2, lineStyle: 'dotted' }, connector: { stroke: '#ff8800', textColor: '#112233', strokeWidth: 3, lineStyle: 'dashed' } }],
  entities: [
    { id: 'box', kind: 'component', label: 'Box', x: 0, y: 0, width: 220, height: 88, color: 'azure', status: 'degraded' },
    { id: 'peer', kind: 'component', label: 'Peer', x: 300, y: 0, width: 220, height: 88, color: 'azure', status: 'degraded' },
  ],
  connections: [{ id: 'edge', from: 'box', to: 'peer', label: 'Call', style: 'solid', arrow: 'forward', status: 'degraded' }],
}

function jsonOutput(value = document) {
  const text = JSON.stringify(value)
  return {
    content: [
      { type: 'resource', resource: { uri: `diagrammer://exports/${encodeURIComponent(stateToken)}/state-styles.json`, mimeType: 'application/json', text } },
      { type: 'text', text: JSON.stringify({ stateToken, mimeType: 'application/json', filename: 'state-styles.json', byteLength: Buffer.byteLength(text) }) },
    ],
  }
}

test('should_publish_and_validate_a_resolved_v2_state_style_document_DGM157', () => {
  const store = createSnapshotStore()
  store.publish(JSON.stringify({ document, stateToken, catalog: [], templates: [] }))
  assert.equal(store.available(), true)
  assert.equal(validateOutput(jsonOutput(), { name: 'export_diagram', arguments: { stateToken, format: 'json' } }), true)
})

test('should_reject_unknown_or_dangling_v2_state_style_data_at_mcp_boundary_DGM157', () => {
  const unknown = { ...document, stateStyles: [{ ...document.stateStyles[0], box: { ...document.stateStyles[0].box, url: 'https://invalid.example' } }] }
  const dangling = { ...document, connections: [{ ...document.connections[0], status: 'missing' }] }
  for (const candidate of [unknown, dangling]) {
    assert.equal(validateOutput(jsonOutput(candidate), { name: 'export_diagram', arguments: { stateToken, format: 'json' } }), false)
    assert.throws(() => createSnapshotStore().publish(JSON.stringify({ document: candidate, stateToken, catalog: [], templates: [] })))
  }
})

test('should_keep_v1_legacy_shape_and_distinguish_absent_from_explicit_empty_DGM157', () => {
  const legacy = { ...document, schemaVersion: 1, stateStyles: undefined, entities: document.entities.map(item => ({ ...item, status: 'planned' })), connections: [{ ...document.connections[0], status: undefined }] }
  assert.equal(validateOutput(jsonOutput(legacy), { name: 'export_diagram', arguments: { stateToken, format: 'json' } }), true)
  const invalidV1Connection = { ...legacy, connections: [{ ...legacy.connections[0], status: 'planned' }] }
  const emptyWithReference = { ...document, stateStyles: [] }
  for (const candidate of [invalidV1Connection, emptyWithReference]) assert.equal(validateOutput(jsonOutput(candidate), { name: 'export_diagram', arguments: { stateToken, format: 'json' } }), false)
})
