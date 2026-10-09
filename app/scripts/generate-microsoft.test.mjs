import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { validateArtwork, validateDefinitions } from './generate-microsoft.mjs'

const svg = content => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${content}</svg>`)

test('should_accept_inert_vector_geometry_and_local_gradient_references', () => {
  assert.doesNotThrow(() => validateArtwork(svg('<defs><linearGradient id="ink"><stop offset="0" stop-color="#111"/></linearGradient></defs><path d="M0 0H64V64H0Z" fill="url(#ink)"/>'), 'svg'))
})

for (const [name, content] of [
  ['script', '<script>alert(1)</script>'], ['foreign-object', '<foreignObject><div/></foreignObject>'],
  ['event', '<path onload="alert(1)"/>'], ['external-href', '<image href="https://example.com/icon.png"/>'],
  ['external-use', '<use href="file:///icon.svg"/>'], ['encoded-href', '<use href="&#106;avascript:alert(1)"/>'],
  ['external-paint', '<path fill="url(https://example.com/paint.svg#ink)"/>'],
  ['css-import', '<style>@import "https://example.com/a.css";</style>'],
  ['css-escape', '<style>.a { fill: u\\72l(https://example.com/a.svg); }</style>'],
  ['animation', '<animate attributeName="href" values="https://example.com"/>'],
  ['xml-base', '<g xml:base="https://example.com/"><use href="#ink"/></g>'],
]) test(`should_reject_${name}_before_artwork_is_registered`, () => assert.throws(() => validateArtwork(svg(content), 'svg')))

test('should_reject_xml_entities_malformed_xml_and_non_png_bytes', () => {
  assert.throws(() => validateArtwork(Buffer.from('<!DOCTYPE svg [<!ENTITY ink SYSTEM "file:///secret">]><svg/>'), 'svg'))
  assert.throws(() => validateArtwork(svg('<path>'), 'svg'))
  assert.throws(() => validateArtwork(Buffer.from('not a PNG'), 'png'))
})

test('should_reject_duplicate_keys_paths_and_false_official_classification', async () => {
  const definitions = JSON.parse(await readFile(new URL('../src/microsoft-icons/definitions.json', import.meta.url), 'utf8'))
  assert.doesNotThrow(() => validateDefinitions(definitions))
  assert.throws(() => validateDefinitions([...definitions, definitions[0]]))
  assert.throws(() => validateDefinitions([{ ...definitions[0], key: '../upload' }]))
  assert.throws(() => validateDefinitions([{ ...definitions[0], classification: 'official-icon', collection: undefined, sha256: undefined }]))
  assert.throws(() => validateDefinitions([{ ...definitions[0], url: 'file:///icon.svg' }]))
})

test('should_accept_a_pinned_official_microsoft_cdn_png_definition', () => {
  assert.doesNotThrow(() => validateDefinitions([{
    key: 'sharepoint',
    label: 'SharePoint',
    classification: 'official-cdn-png',
    url: 'https://res-1.cdn.office.net/files/fabric-cdn-prod_20221209.001/assets/brand-icons/product/png/sharepoint_48x1.png',
    sha256: 'a'.repeat(64),
    color: '#038387',
    aliases: ['SharePoint Online'],
    keywords: ['collaboration'],
  }]))
})