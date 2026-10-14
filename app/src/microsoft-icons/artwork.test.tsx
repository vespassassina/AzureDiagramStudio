// @vitest-environment jsdom
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { renderToStaticMarkup } from 'react-dom/server'
import { test } from 'vitest'
import { microsoftLibrary } from './catalog.ts'
import { microsoftAssets } from './assets.ts'

test('should_place_each_trusted_asset_in_a_35px_svg_component_without_mutating_its_bytes', () => {
  for (const item of microsoftLibrary) {
    const source = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={35} height={35} viewBox="0 0 35 35"><image href={microsoftAssets[item.icon]} width={35} height={35} preserveAspectRatio="xMidYMid meet" /></svg>)
    const document = new DOMParser().parseFromString(source, 'image/svg+xml')
    assert.equal(document.querySelector('parsererror'), null)
    const image = document.querySelector('image')!
    assert.equal(image.getAttribute('href'), microsoftAssets[item.icon])
    assert.equal(image.getAttribute('width'), '35')
    assert.equal(image.getAttribute('height'), '35')
    assert.equal(image.getAttribute('preserveAspectRatio'), 'xMidYMid meet')
    assert.doesNotMatch(source, /<script|https:\/\/download|blob:|file:/i)
  }
})

test('should_render_a_self_contained_svg_export_with_all_microsoft_components', () => {
  const source = renderToStaticMarkup(<svg xmlns="http://www.w3.org/2000/svg" width={700} height={200} viewBox="0 0 700 200">{microsoftLibrary.map((item, index) => <g key={item.icon} transform={`translate(${index * 45}, 10)`}><image href={microsoftAssets[item.icon]} width={35} height={35} preserveAspectRatio="xMidYMid meet" /><title>{`${item.label}: ${item.subtitle}`}</title></g>)}</svg>)
  const document = new DOMParser().parseFromString(source, 'image/svg+xml')
  assert.equal(document.querySelectorAll('image').length, microsoftLibrary.length)
  for (const [index, image] of [...document.querySelectorAll('image')].entries()) {
    const item = microsoftLibrary[index]
    assert.match(item.source.entry, /\.(svg|png)$/)
    const isPng = item.source.entry.endsWith('.png')
    const prefix = `data:image/${isPng ? 'png' : 'svg+xml'};base64,`
    const href = image.getAttribute('href') ?? ''
    assert.equal(href, microsoftAssets[item.icon])
    assert.ok(href.startsWith(prefix), `Descriptor format for ${item.icon}`)
    const payload = href.slice(prefix.length)
    const bytes = Buffer.from(payload, 'base64')
    assert.ok(bytes.length > 0)
    assert.equal(bytes.toString('base64'), payload)
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.source.sha256)
    if (isPng) assert.deepEqual([...bytes.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10])
    else {
      const artwork = new DOMParser().parseFromString(bytes.toString('utf8'), 'image/svg+xml')
      assert.equal(artwork.querySelector('parsererror'), null)
      assert.equal(artwork.documentElement.localName, 'svg')
      assert.equal(artwork.documentElement.namespaceURI, 'http://www.w3.org/2000/svg')
    }
    assert.equal(image.parentElement?.querySelector('title')?.textContent, `${item.label}: ${item.subtitle}`)
  }
  assert.equal(document.querySelector('parsererror'), null)
})