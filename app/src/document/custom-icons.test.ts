import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { MAX_CUSTOM_ICON_ENCODED_BYTES } from '../custom-icons/contract.ts'
import { iconFixture } from '../custom-icons/test-fixtures.ts'
import type { DocumentCommand } from '../contracts.ts'
import { computeLayout } from '../layout.ts'
import { createDocument, historyCommit, historyRedo, historyUndo, sampleDiagram } from '../model.ts'
import type { CustomIcon } from '../model.ts'
import { applyCommand, captureSelection, parseDocument, validateDocument } from './index.ts'
import { inspectJson, MAX_BYTES } from './validation.ts'

function customDocument() {
  const document = sampleDiagram()
  Object.assign(document.entities.find(entity => entity.id === 'app')!, { customIcon: iconFixture() })
  return document
}

test('should_preserve_embedded_png_and_all_metadata_when_json_round_trips', () => {
  const document = customDocument()
  const parsed = parseDocument(JSON.stringify(document))
  assert.ok(parsed.ok)
  assert.deepEqual(parsed.value, document)
  assert.deepEqual(validateDocument(sampleDiagram()), { ok: true, value: sampleDiagram() })
})

test('should_reject_total_embedded_png_bytes_when_individually_valid_shared_images_exceed_5_mib', () => {
  const customIcon: CustomIcon = iconFixture(256, 256, 61)
  assert.ok(customIcon.dataUrl.length < MAX_CUSTOM_ICON_ENCODED_BYTES)
  const component = sampleDiagram().entities.find(entity => entity.id === 'app')!
  const document = createDocument('custom-byte-cap')
  document.entities = Array.from({ length: 16 }, (_, index) => ({ ...component, id: `image-${index}`, parentId: null, customIcon }))
  assert.ok(Buffer.byteLength(JSON.stringify(document)) > MAX_BYTES)
  assert.match(inspectJson(document)?.message ?? '', /5 MiB/)
  for (const result of [validateDocument(document), parseDocument(JSON.stringify(document))]) {
    assert.equal(result.ok, false)
    if (!result.ok) assert.deepEqual(result.errors, [{ path: '$', message: 'JSON exceeds the 5 MiB limit' }])
  }
  const withinLimit = { ...document, entities: document.entities.slice(0, -2) }
  assert.ok(Buffer.byteLength(JSON.stringify(withinLimit)) < MAX_BYTES)
  assert.ok(validateDocument(withinLimit).ok)
  const before = structuredClone(withinLimit)
  const fragment = { entities: document.entities.slice(-2), connections: [], origin: { x: 0, y: 0 } }
  assert.throws(() => applyCommand(withinLimit, { type: 'paste', fragment, idMap: { 'image-14': 'copy-14', 'image-15': 'copy-15' }, offset: { x: 0, y: 0 } }), /5 MiB/)
  assert.deepEqual(withinLimit, before)
})

test('should_count_exact_encoded_custom_json_bytes_when_names_have_unicode_and_escapes', () => {
  const document = customDocument()
  document.entities.find(entity => entity.id === 'app')!.customIcon!.name = '\u6f22\ud83d\ude00"\\\n\u0000'
  const input = { ...document, padding: '' }
  input.padding = 'x'.repeat(MAX_BYTES - Buffer.byteLength(JSON.stringify(input)))
  assert.equal(Buffer.byteLength(JSON.stringify(input)), MAX_BYTES)
  assert.equal(inspectJson(input), undefined)
  const parsed = parseDocument(JSON.stringify(input))
  assert.ok(parsed.ok)
  assert.deepEqual(parsed.value, document)
  input.padding += 'x'
  assert.match(inspectJson(input)?.message ?? '', /5 MiB/)
  assert.equal(validateDocument(input).ok, false)
  assert.equal(parseDocument(JSON.stringify(input)).ok, false)
})

test.each(['data:image/svg+xml;base64,PHN2Zy8+', 'data:text/html;base64,PHNjcmlwdD4=', 'https://evil/icon.png', 'data:image/png;base64,AAAA'])('should_reject_unsafe_custom_data_when_json_supplies_%s', dataUrl => {
  const document = customDocument()
  Object.assign(document.entities.find(entity => entity.id === 'app')!, { customIcon: { ...iconFixture(), dataUrl } })
  const result = validateDocument(document)
  assert.equal(result.ok, false)
  if (!result.ok) assert.ok(result.errors.some(error => error.path === 'entities[5].customIcon'))
})

test('should_replace_and_clear_atomically_when_custom_icon_commands_are_undone', () => {
  const original = sampleDiagram()
  const replacement = applyCommand(original, { type: 'updateEntity', id: 'app', patch: { customIcon: iconFixture() } } as DocumentCommand)
  assert.deepEqual(replacement, customDocumentWithRevision(1))
  const history = historyCommit({ past: [], present: original, future: [] }, replacement)
  assert.deepEqual(historyUndo(history).present, original)
  assert.deepEqual(historyRedo(historyUndo(history)).present, replacement)
  const cleared = applyCommand(replacement, { type: 'updateEntity', id: 'app', patch: { customIcon: undefined, icon: 'service' } } as DocumentCommand)
  assert.equal(Object.hasOwn(cleared.entities.find(entity => entity.id === 'app')!, 'customIcon'), false)
  assert.deepEqual(historyUndo(historyCommit(history, cleared)).present, replacement)
})

function customDocumentWithRevision(revision: number) {
  return { ...customDocument(), revision }
}

test('should_preserve_detached_custom_artwork_when_clipboard_crosses_documents', () => {
  const document = customDocument()
  const fragment = captureSelection(document, ['app'])
  assert.deepEqual((fragment.entities[0] as unknown as { customIcon: unknown }).customIcon, iconFixture())
  const pasted = applyCommand(createDocument('new'), { type: 'paste', fragment, idMap: { app: 'copy' }, offset: { x: 0, y: 0 } })
  assert.deepEqual((pasted.entities[0] as unknown as { customIcon: unknown }).customIcon, iconFixture())
  fragment.entities[0].customIcon!.name = 'mutated'
  assert.deepEqual((pasted.entities[0] as unknown as { customIcon: unknown }).customIcon, iconFixture())
  assert.deepEqual(document, customDocument())
})

test.each(['name', 'dataUrl', 'width', 'height', 'remove'])('should_reject_layout_semantic_changes_when_custom_%s_is_modified', field => {
  const document = customDocument()
  const layout = structuredClone(document)
  const entity = layout.entities.find(entity => entity.id === 'app')! as unknown as { customIcon?: ReturnType<typeof iconFixture> }
  if (field === 'remove') delete entity.customIcon
  else if (field === 'name') entity.customIcon!.name = 'Changed'
  else entity.customIcon = iconFixture(1, 2)
  assert.throws(() => applyCommand(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } }))
  assert.deepEqual(document, customDocument())
})

test('should_reject_valid_same_size_png_substitution_when_layout_changes_only_artwork_bytes', () => {
  const document = customDocument()
  const layout = structuredClone(document)
  layout.entities.find(entity => entity.id === 'app')!.customIcon!.dataUrl = iconFixture(2, 1, 77).dataUrl
  assert.ok(validateDocument(layout).ok)
  assert.throws(() => applyCommand(document, { type: 'applyLayout', expectedRevision: 0, result: { revision: 0, diagram: layout } }), /content, annotations and membership must remain unchanged/)
  assert.deepEqual(document, customDocument())
})

test('should_preserve_custom_artwork_when_real_layout_grouping_order_and_metadata_commands_run', async () => {
  let document = customDocument()
  const commands: DocumentCommand[] = [
    { type: 'metadata', patch: { title: 'Artwork', synthetic: true } },
    { type: 'order', ids: ['app'], layer: 'background' },
    { type: 'reparent', ids: ['app'], parentId: null },
    { type: 'group', ids: ['app'], boundary: { id: 'custom-group', kind: 'boundary', label: 'Custom', color: 'teal', x: 0, y: 0, width: 300, height: 200 } },
    { type: 'ungroup', boundaryIds: ['custom-group'] },
  ]
  for (const command of commands) {
    document = applyCommand(document, command)
    assert.deepEqual(document.entities.find(entity => entity.id === 'app')!.customIcon, iconFixture())
  }
  for (const direction of ['RIGHT', 'DOWN'] as const) {
    const result = await computeLayout(document, direction, document.revision)
    document = applyCommand(document, { type: 'applyLayout', expectedRevision: document.revision, result })
    assert.deepEqual(document.entities.find(entity => entity.id === 'app')!.customIcon, iconFixture())
  }
})

test('should_reject_invalid_replacements_and_noncomponent_images_without_mutating_history_input', () => {
  const document = customDocument()
  const before = structuredClone(document)
  for (const id of ['app', 'platform', 'note']) assert.throws(() => applyCommand(document, { type: 'updateEntity', id, patch: { customIcon: { ...iconFixture(), dataUrl: 'data:image/svg+xml;base64,AAAA' } } }))
  for (const id of ['platform', 'note']) assert.throws(() => applyCommand(document, { type: 'updateEntity', id, patch: { customIcon: iconFixture() } }))
  assert.deepEqual(document, before)
})

test('should_reuse_only_validated_png_strings_when_ordinary_commands_revalidate_the_snapshot', () => {
  const document = customDocument()
  document.entities.find(entity => entity.id === 'app')!.customIcon = iconFixture(9, 3)
  assert.ok(validateDocument(document).ok)
  const decode = vi.spyOn(globalThis, 'atob')
  try {
    for (let index = 0; index < 20; index++) applyCommand(document, { type: 'move', positions: [{ id: 'users', x: 30 + index, y: 220 }] })
    assert.equal(decode.mock.calls.length, 0)
    document.entities.find(entity => entity.id === 'app')!.customIcon!.height = 2
    assert.throws(() => applyCommand(document, { type: 'metadata', patch: { title: 'Invalid' } }))
    assert.equal(decode.mock.calls.length, 0)
  } finally { decode.mockRestore() }
})