import assert from 'node:assert/strict'
import { test, vi } from 'vitest'
import { MAX_CUSTOM_ICON_ENCODED_BYTES, validateCustomIcon } from './contract.ts'
import { iconFixture, pngBytes, pngChunk } from './test-fixtures.ts'

test('should_return_a_detached_four_field_value_when_a_real_transparent_png_is_validated', () => {
  const input = iconFixture()
  const result = validateCustomIcon(input)
  assert.deepEqual(result, { ok: true, value: input })
  assert.ok(result.ok)
  assert.notEqual(result.value, input)
})

test.each([null, [], 'png', 12, {}, { ...iconFixture(), name: 'x'.repeat(121) }, { ...iconFixture(), width: 0 }, { ...iconFixture(), width: 1.5 }, { ...iconFixture(), height: 513 }, { ...iconFixture(), width: 1 }, { ...iconFixture(), extra: 'ignored' }])('should_reject_invalid_shape_or_dimensions_when_input_is_%j', input => {
  assert.equal(validateCustomIcon(input).ok, false)
})

test('should_not_execute_accessors_when_custom_input_is_not_inert', () => {
  const getter = vi.fn(() => 'unsafe')
  const input = Object.defineProperty(iconFixture(), 'name', { get: getter })
  assert.equal(validateCustomIcon(input).ok, false)
  assert.equal(getter.mock.calls.length, 0)
  assert.equal(validateCustomIcon(Object.assign(Object.create({}), iconFixture())).ok, false)
  assert.equal(validateCustomIcon({ ...iconFixture(), toJSON() { assert.fail('hook executed') } }).ok, false)
  assert.equal(validateCustomIcon(Object.assign(Object.create(null), iconFixture())).ok, true)
})

test.each(['data:image/svg+xml;base64,AAAA', 'data:text/html;base64,AAAA', 'data:image/png;charset=utf8;base64,AAAA', 'DATA:image/png;base64,AAAA', 'http://example/icon.png', 'file:///icon.png', 'data:image/png;base64,AAAA\n', 'data:image/png;base64,AA=A', 'data:image/png;base64,A==='])('should_reject_noncanonical_data_when_url_is_%s', dataUrl => {
  assert.equal(validateCustomIcon({ ...iconFixture(), dataUrl }).ok, false)
})

test('should_reject_crc_truncation_trailing_data_and_chunk_injection_when_png_structure_is_unsafe', () => {
  const png = pngBytes()
  const crc = Buffer.from(png)
  crc[29] ^= 1
  const cases = [crc, png.subarray(0, -1), Buffer.concat([png, Buffer.from([0])]), Buffer.concat([png.subarray(0, -12), pngChunk('acTL', Buffer.alloc(8)), png.subarray(-12)]), Buffer.concat([png.subarray(0, -12), pngChunk('tEXt', Buffer.from('<script>')), png.subarray(-12)]), Buffer.concat([png.subarray(0, 33), png.subarray(-12)])]
  for (const bytes of cases) assert.equal(validateCustomIcon({ ...iconFixture(), dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }).ok, false)
})

test('should_check_sizes_names_and_bytes_again_when_a_cached_png_string_is_reused', () => {
  const input = iconFixture()
  assert.ok(validateCustomIcon(input).ok)
  input.width = 3
  assert.equal(validateCustomIcon(input).ok, false)
  input.width = 2
  input.name = 'x'.repeat(121)
  assert.equal(validateCustomIcon(input).ok, false)
  input.name = 'Changed'
  input.dataUrl = input.dataUrl.slice(0, -4) + 'AAAA'
  assert.equal(validateCustomIcon(input).ok, false)
})

test('should_enforce_encoded_size_before_decoding_when_payload_is_oversized', () => {
  const decode = vi.spyOn(globalThis, 'atob')
  try {
    assert.equal(validateCustomIcon({ ...iconFixture(), dataUrl: 'data:image/png;base64,' + 'A'.repeat(MAX_CUSTOM_ICON_ENCODED_BYTES) }).ok, false)
    assert.equal(decode.mock.calls.length, 0)
  } finally { decode.mockRestore() }
})

test('should_decode_only_once_when_validated_immutable_bytes_are_reused', () => {
  const input = iconFixture(7, 2)
  const decode = vi.spyOn(globalThis, 'atob')
  try {
    for (let index = 0; index < 20; index++) assert.ok(validateCustomIcon({ ...input, name: `Name ${index}` }).ok)
    assert.equal(decode.mock.calls.length, 1)
  } finally { decode.mockRestore() }
})

test('should_evict_old_png_keys_when_more_than_16_immutable_strings_are_validated', () => {
  const first = iconFixture(21, 1)
  const decode = vi.spyOn(globalThis, 'atob')
  try {
    assert.ok(validateCustomIcon(first).ok)
    for (let width = 22; width <= 38; width++) assert.ok(validateCustomIcon(iconFixture(width, 1)).ok)
    assert.ok(validateCustomIcon(first).ok)
    assert.equal(decode.mock.calls.length, 19)
  } finally { decode.mockRestore() }
})

test('should_evict_large_png_strings_when_the_4_mib_cache_budget_is_reached_before_16_entries', () => {
  const first = iconFixture(256, 256, 1)
  assert.ok(first.dataUrl.length < MAX_CUSTOM_ICON_ENCODED_BYTES)
  assert.ok(first.dataUrl.length * 13 > 4 * 1024 * 1024)
  const decode = vi.spyOn(globalThis, 'atob')
  try {
    assert.ok(validateCustomIcon(first).ok)
    for (let seed = 2; seed <= 13; seed++) assert.ok(validateCustomIcon(iconFixture(256, 256, seed)).ok)
    assert.ok(validateCustomIcon(first).ok)
    assert.equal(decode.mock.calls.length, 14)
  } finally { decode.mockRestore() }
})

test('should_reject_bad_magic_depth_interlace_duplicate_headers_and_noncanonical_padding_when_png_is_supplied', () => {
  const png = pngBytes()
  const magic = Buffer.from(png)
  magic[0] = 0
  const depth = Buffer.from(png.subarray(16, 29))
  depth[8] = 16
  const interlace = Buffer.from(png.subarray(16, 29))
  interlace[12] = 1
  const cases = [magic, Buffer.concat([png.subarray(0, 8), pngChunk('IHDR', depth), png.subarray(33)]), Buffer.concat([png.subarray(0, 8), pngChunk('IHDR', interlace), png.subarray(33)]), Buffer.concat([png.subarray(0, 33), png.subarray(8, 33), png.subarray(33)])]
  for (const bytes of cases) assert.equal(validateCustomIcon({ ...iconFixture(), dataUrl: `data:image/png;base64,${bytes.toString('base64')}` }).ok, false)
  const padded = iconFixture(3, 2)
  assert.ok(validateCustomIcon(padded).ok)
  assert.equal(validateCustomIcon({ ...padded, dataUrl: padded.dataUrl.replace(/=+$/, '') + '\n' }).ok, false)
})